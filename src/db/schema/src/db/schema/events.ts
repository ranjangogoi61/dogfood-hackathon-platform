import {
  boolean,
  check,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users";

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "closed",
]);

export const resultsVisibilityEnum = pgEnum("results_visibility", [
  "hidden",
  "participants",
  "public",
]);

export const publicationStatusEnum = pgEnum("publication_status", [
  "unpublished",
  "published",
]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    slug: varchar("slug", { length: 120 }).notNull().unique(),

    name: varchar("name", { length: 200 }).notNull(),

    description: text("description"),

    status: eventStatusEnum("status").notNull().default("draft"),

    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("UTC"),

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

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    minTeamSize: integer("min_team_size")
      .notNull()
      .default(1),

    maxTeamSize: integer("max_team_size"),

    normalizationMethod: varchar("normalization_method", {
      length: 50,
    })
      .notNull()
      .default("zscore"),

    normalizationMinSamples: integer("normalization_min_samples")
      .notNull()
      .default(3),

    normalizationEpsilon: doublePrecision("normalization_epsilon")
      .notNull()
      .default(0.000001),

    fallbackMethod: varchar("fallback_method", {
      length: 50,
    })
      .notNull()
      .default("raw_scaled"),

    resultsVisibility: resultsVisibilityEnum("results_visibility")
      .notNull()
      .default("hidden"),

    publicationStatus: publicationStatusEnum("publication_status")
      .notNull()
      .default("unpublished"),

    blindToOrganizer: boolean("blind_to_organizer")
      .notNull()
      .default(false),

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
  },
  (table) => [
    check(
      "events_min_team_size_check",
      sql`${table.minTeamSize} >= 1`,
    ),
    check(
      "events_max_team_size_check",
      sql`${table.maxTeamSize} IS NULL OR ${table.maxTeamSize} >= ${table.minTeamSize}`,
    ),
    check(
      "events_normalization_min_samples_check",
      sql`${table.normalizationMinSamples} >= 1`,
    ),
    check(
      "events_normalization_epsilon_check",
      sql`${table.normalizationEpsilon} > 0`,
    ),
  ],
);
