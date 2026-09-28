import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const eventStateEnum = pgEnum("event_state", [
  "draft",
  "published",
  "closed",
  "archived",
]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),

  slug: varchar("slug", { length: 120 }).notNull().unique(),

  name: varchar("name", { length: 200 }).notNull(),

  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),

  state: eventStateEnum("state").notNull().default("draft"),

  startsAt: timestamp("starts_at", {
    withTimezone: true,
  }),

  endsAt: timestamp("ends_at", {
    withTimezone: true,
  }),

  submissionOpensAt: timestamp("submission_opens_at", {
    withTimezone: true,
  }),

  submissionClosesAt: timestamp("submission_closes_at", {
    withTimezone: true,
  }),

  judgingOpensAt: timestamp("judging_opens_at", {
    withTimezone: true,
  }),

  judgingClosesAt: timestamp("judging_closes_at", {
    withTimezone: true,
  }),

  settings: jsonb("settings").notNull().default({}),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
