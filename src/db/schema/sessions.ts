import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  inet,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, {
      onDelete: "cascade",
    })
    .notNull(),

  tokenHash: varchar("token_hash", {
    length: 64,
  })
    .notNull()
    .unique(),

  expiresAt: timestamp("expires_at", {
    withTimezone: true,
  }).notNull(),

  absoluteExpiresAt: timestamp("absolute_expires_at", {
    withTimezone: true,
  }).notNull(),

  lastAccessedAt: timestamp("last_accessed_at", {
    withTimezone: true,
  }),

  revokedAt: timestamp("revoked_at", {
    withTimezone: true,
  }),

  ip: inet("ip"),

  userAgent: varchar("user_agent", {
    length: 255,
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
