import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * PostgreSQL-backed login throttle. One row per bucket key
 * ("e:<sha256 of email>" or "i:<client ip>"). Mutable state on purpose:
 * the append-only history lives in audit events, not here.
 */
export const loginThrottle = pgTable("login_throttle", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
