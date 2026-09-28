import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { events } from "./events";
import { tracks } from "./tracks";
import { users } from "./users";

export const eventRoleEnum = pgEnum("event_role", [
  "participant",
  "judge",
  "organizer",
]);

export const eventRoles = pgTable(
  "event_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
      }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    role: eventRoleEnum("role").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("event_roles_event_user_role_unique").on(
      table.eventId,
      table.userId,
      table.role,
    ),
    index("event_roles_event_idx").on(table.eventId),
    index("event_roles_user_idx").on(table.userId),
  ],
);

export const judgeTrackScopes = pgTable(
  "judge_track_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
      }),

    judgeUserId: uuid("judge_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("judge_track_scopes_event_judge_track_unique").on(
      table.eventId,
      table.judgeUserId,
      table.trackId,
    ),
    index("judge_track_scopes_event_idx").on(table.eventId),
    index("judge_track_scopes_judge_idx").on(table.judgeUserId),
    index("judge_track_scopes_track_idx").on(table.trackId),
  ],
);

export type EventRole = typeof eventRoles.$inferSelect;
export type NewEventRole = typeof eventRoles.$inferInsert;

export type JudgeTrackScope = typeof judgeTrackScopes.$inferSelect;
export type NewJudgeTrackScope = typeof judgeTrackScopes.$inferInsert;
