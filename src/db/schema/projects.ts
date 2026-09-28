import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { events } from "./events";
import { teams } from "./teams";
import { tracks } from "./tracks";
import { users } from "./users";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "submitted",
  "withdrawn",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "restrict",
      }),

    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, {
        onDelete: "restrict",
      }),

    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "restrict",
    }),

    title: varchar("title", {
      length: 200,
    }).notNull(),

    tagline: varchar("tagline", {
      length: 500,
    }).notNull(),

    description: text("description").notNull(),

    thumbnailUrl: text("thumbnail_url"),

    imageUrls: jsonb("image_urls")
      .$type<string[]>()
      .notNull()
      .default([]),

    videoUrl: text("video_url"),

    repoUrl: text("repo_url"),

    liveUrl: text("live_url"),

    techTags: jsonb("tech_tags")
      .$type<string[]>()
      .notNull()
      .default([]),

    status: projectStatusEnum("status")
      .notNull()
      .default("draft"),

    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
    }),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),

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
    uniqueIndex("projects_event_team_unique").on(
      table.eventId,
      table.teamId,
    ),

    index("projects_event_idx").on(table.eventId),
    index("projects_team_idx").on(table.teamId),
    index("projects_track_idx").on(table.trackId),
    index("projects_status_idx").on(table.status),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
