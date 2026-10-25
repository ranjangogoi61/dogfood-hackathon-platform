import {
  doublePrecision,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { events } from "./events";
import { projects } from "./projects";
import { users } from "./users";

export const rubricCriteria = pgTable(
  "rubric_criteria",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    weight: doublePrecision("weight").notNull(),
    maxScore: integer("max_score").notNull().default(10),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    uniqueIndex("rubric_event_name_unique").on(table.eventId, table.name),
    index("rubric_event_idx").on(table.eventId),
  ],
);

export const judgeAssignments = pgTable(
  "judge_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    judgeId: uuid("judge_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("assignment_project_judge_unique").on(
      table.projectId,
      table.judgeId,
    ),
    index("assignment_judge_idx").on(table.judgeId),
  ],
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => judgeAssignments.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("score_assignment_criterion_unique").on(
      table.assignmentId,
      table.criterionId,
    ),
  ],
);

export type RubricCriterion = typeof rubricCriteria.$inferSelect;
export type JudgeAssignment = typeof judgeAssignments.$inferSelect;
export type Score = typeof scores.$inferSelect;
