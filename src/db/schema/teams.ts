import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { events } from "./events";
import { users } from "./users";

export const teamStatusEnum = pgEnum("team_status", [
  "active",
  "archived",
]);

export const teamMemberRoleEnum = pgEnum("team_member_role", [
  "leader",
  "member",
]);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
      }),

    name: varchar("name", {
      length: 120,
    }).notNull(),

    inviteCode: varchar("invite_code", {
      length: 128,
    })
      .notNull()
      .unique(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    status: teamStatusEnum("status")
      .notNull()
      .default("active"),

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
    uniqueIndex("teams_event_name_unique").on(
      table.eventId,
      table.name,
    ),
    index("teams_event_idx").on(table.eventId),
    index("teams_created_by_idx").on(table.createdBy),
    index("teams_status_idx").on(table.status),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
      }),

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

    role: teamMemberRoleEnum("role").notNull(),

    joinedAt: timestamp("joined_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_team_user_unique").on(
      table.teamId,
      table.userId,
    ),
    uniqueIndex("team_members_user_event_unique").on(
      table.userId,
      table.eventId,
    ),
    index("team_members_team_idx").on(table.teamId),
    index("team_members_event_idx").on(table.eventId),
    index("team_members_user_idx").on(table.userId),
  ],
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
