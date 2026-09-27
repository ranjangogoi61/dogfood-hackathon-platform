import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions } from "@/db/schema/sessions";
import { users } from "@/db/schema/users";
import { SESSION_COOKIE_NAME } from "./cookie";

const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function generateSessionToken() {
  const raw = crypto.randomBytes(32).toString("hex");

  const hash = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");

  return {
    raw,
    hash,
  };
}

export async function createSession(
  userId: string,
  options?: {
    ip?: string;
    userAgent?: string;
  },
) {
  const token = generateSessionToken();
  const now = Date.now();

  const expiresAt = new Date(now + SLIDING_TTL_MS);
  const absoluteExpiresAt = new Date(
    now + ABSOLUTE_TTL_MS,
  );

  await db.insert(sessions).values({
    userId,
    tokenHash: token.hash,
    expiresAt,
    absoluteExpiresAt,
    lastAccessedAt: new Date(),
    ip: options?.ip,
    userAgent: options?.userAgent,
  });

  return {
    token: token.raw,
    expiresAt,
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();

  const rawToken = cookieStore.get(
    SESSION_COOKIE_NAME,
  )?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const result = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      expiresAt: sessions.expiresAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
    })
    .from(sessions)
    .innerJoin(
      users,
      eq(sessions.userId, users.id),
    )
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const current = result[0];

  if (!current) {
    return null;
  }

  const now = Date.now();

  const refreshedExpiry = new Date(
    Math.min(
      now + SLIDING_TTL_MS,
      current.absoluteExpiresAt.getTime(),
    ),
  );

  await db
    .update(sessions)
    .set({
      expiresAt: refreshedExpiry,
      lastAccessedAt: new Date(),
    })
    .where(eq(sessions.id, current.sessionId));

  return {
    sessionId: current.sessionId,
    rawToken,
    user: {
      id: current.userId,
      email: current.email,
      displayName: current.displayName,
      isAdmin: current.isAdmin,
    },
    expiresAt: refreshedExpiry,
  };
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();

  const rawToken = cookieStore.get(
    SESSION_COOKIE_NAME,
  )?.value;

  if (!rawToken) {
    return;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
      ),
    );
}
