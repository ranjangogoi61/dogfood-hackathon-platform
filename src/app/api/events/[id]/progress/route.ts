import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { judgeAssignments, rubricCriteria, scores } from "@/db/schema/judging";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Organizer/admin: judging progress per judge (counts only, no score values). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return forbidden();

  const [{ criteriaCount }] = await db
    .select({ criteriaCount: sql<number>`count(*)::int` })
    .from(rubricCriteria)
    .where(eq(rubricCriteria.eventId, id));

  const rows = await db
    .select({
      judgeId: judgeAssignments.judgeId,
      judge: users.displayName,
      assignments: sql<number>`count(distinct ${judgeAssignments.id})::int`,
      scoredCells: sql<number>`count(${scores.id})::int`,
    })
    .from(judgeAssignments)
    .innerJoin(users, eq(judgeAssignments.judgeId, users.id))
    .leftJoin(scores, eq(scores.assignmentId, judgeAssignments.id))
    .where(eq(judgeAssignments.eventId, id))
    .groupBy(judgeAssignments.judgeId, users.displayName);

  return NextResponse.json({
    progress: rows.map((r) => ({
      judgeId: r.judgeId,
      judge: r.judge,
      assignments: r.assignments,
      completedAssignmentsApprox: criteriaCount ? Math.floor(r.scoredCells / criteriaCount) : 0,
    })),
  });
}
