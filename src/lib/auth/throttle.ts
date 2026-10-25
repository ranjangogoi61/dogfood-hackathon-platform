import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { loginThrottle } from "@/db/schema/auth-throttle";

const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;
export const EMAIL_LIMIT = 5; // failures per window per account
export const IP_LIMIT = 30; // failures per window per client IP (only when IP is trustworthy)

const emailKey = (email: string) =>
  `e:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;

function keysFor(email: string, ip: string | null) {
  const keys = [{ key: emailKey(email), limit: EMAIL_LIMIT }];
  if (ip) keys.push({ key: `i:${ip}`, limit: IP_LIMIT });
  return keys;
}

/** True when any bucket for this attempt is currently blocked. Same answer for known/unknown emails. */
export async function isBlocked(email: string, ip: string | null): Promise<boolean> {
  for (const { key } of keysFor(email, ip)) {
    const [row] = await db
      .select({ blockedUntil: loginThrottle.blockedUntil })
      .from(loginThrottle)
      .where(eq(loginThrottle.key, key))
      .limit(1);
    if (row?.blockedUntil && row.blockedUntil > new Date()) return true;
  }
  return false;
}

/** Atomically record a failed attempt; blocks the bucket once the limit is reached. */
export async function recordFailure(email: string, ip: string | null): Promise<void> {
  for (const { key, limit } of keysFor(email, ip)) {
    await db.execute(sql`
      INSERT INTO login_throttle (key, failures, window_started_at, blocked_until)
      VALUES (${key}, 1, now(), CASE WHEN ${limit} <= 1 THEN now() + make_interval(mins => ${BLOCK_MINUTES}) END)
      ON CONFLICT (key) DO UPDATE SET
        failures = CASE
          WHEN login_throttle.window_started_at < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1
          ELSE login_throttle.failures + 1 END,
        window_started_at = CASE
          WHEN login_throttle.window_started_at < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN now()
          ELSE login_throttle.window_started_at END,
        blocked_until = CASE
          WHEN (CASE WHEN login_throttle.window_started_at < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1
                     ELSE login_throttle.failures + 1 END) >= ${limit}
          THEN now() + make_interval(mins => ${BLOCK_MINUTES})
          ELSE login_throttle.blocked_until END
    `);
  }
}

/** A successful login clears the per-account bucket only. */
export async function recordSuccess(email: string): Promise<void> {
  await db.delete(loginThrottle).where(eq(loginThrottle.key, emailKey(email)));
}
