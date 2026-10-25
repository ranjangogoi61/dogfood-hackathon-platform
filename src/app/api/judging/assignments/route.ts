import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { judgeAssignments, rubricCriteria, scores } from "@/db/schema/judging";
import { forbidden, isJudgeAnywhere, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

/** A judge's OWN assignments (and own scores only). Never returns peer data. */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!(await isJudgeAnywhere(user.id))) return forbidden("Judges only");

  const assignments = await db
    .select({
      assignmentId: judgeAssignments.id,
      eventId: judgeAssignments.eventId,
      eventName: events.name,
      judgingOpensAt: events.judgingOpensAt,
      judgingClosesAt: events.judgingClosesAt,
      projectId: projects.id,
      projectTitle: projects.title,
      projectTagline: projects.tagline,
    })
    .from(judgeAssignments)
    .innerJoin(projects, eq(judgeAssignments.projectId, projects.id))
    .innerJoin(events, eq(judgeAssignments.eventId, events.id))
    .where(eq(judgeAssignments.judgeId, user.id));

  const ids = assignments.map((a) => a.assignmentId);
  const eventIds = [...new Set(assignments.map((a) => a.eventId))];

  const ownScores = ids.length
    ? await db
        .select({
          assignmentId: scores.assignmentId,
          criterionId: scores.criterionId,
          value: scores.value,
        })
        .from(scores)
        .where(inArray(scores.assignmentId, ids))
    : [];

  const criteria = eventIds.length
    ? await db
        .select()
        .from(rubricCriteria)
        .where(inArray(rubricCriteria.eventId, eventIds))
    : [];

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      ...a,
      scores: ownScores.filter((s) => s.assignmentId === a.assignmentId),
      rubric: criteria
        .filter((c) => c.eventId === a.eventId)
        .sort((x, y) => x.position - y.position)
        .map((c) => ({ id: c.id, name: c.name, weight: c.weight, maxScore: c.maxScore })),
    })),
  });
}
