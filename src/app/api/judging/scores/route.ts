import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { judgeAssignments, rubricCriteria, scores } from "@/db/schema/judging";
import { forbidden, isJudgeAnywhere, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Own scores only.
 *   GET /api/judging/scores                      -> all my scores
 *   GET /api/judging/scores?assignment_id=<id>   -> mine => 200, someone else's => 403
 *   GET /api/judging/scores?judge_id=<id>        -> only my own id allowed
 * Participants / non-judges => 403. Unauthenticated => 401.
 */
export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!(await isJudgeAnywhere(user.id))) return forbidden("Judges only");

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("assignment_id");
  const judgeId = searchParams.get("judge_id");

  if ((assignmentId && !UUID_RE.test(assignmentId)) || (judgeId && !UUID_RE.test(judgeId))) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (judgeId && judgeId !== user.id) return forbidden("Cannot read another judge's scores");

  if (assignmentId) {
    const [a] = await db
      .select({ judgeId: judgeAssignments.judgeId })
      .from(judgeAssignments)
      .where(eq(judgeAssignments.id, assignmentId))
      .limit(1);
    // Same response for "not found" and "not yours" avoids leaking existence.
    if (!a || a.judgeId !== user.id) return forbidden("Not your assignment");
  }

  const rows = await db
    .select({
      assignmentId: scores.assignmentId,
      criterionId: scores.criterionId,
      value: scores.value,
      updatedAt: scores.updatedAt,
    })
    .from(scores)
    .innerJoin(judgeAssignments, eq(scores.assignmentId, judgeAssignments.id))
    .where(
      and(
        eq(judgeAssignments.judgeId, user.id),
        assignmentId ? eq(scores.assignmentId, assignmentId) : undefined,
      ),
    );

  return NextResponse.json({ scores: rows });
}

const bodySchema = z.object({
  assignmentId: z.string().regex(UUID_RE),
  scores: z
    .array(z.object({ criterionId: z.string().regex(UUID_RE), value: z.number().finite() }))
    .min(1)
    .max(50),
});

/** Create/update my scores for one of my assignments. Window + range enforced server-side. */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!(await isJudgeAnywhere(user.id))) return forbidden("Judges only");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { assignmentId, scores: input } = parsed.data;

  const [a] = await db
    .select({ judgeId: judgeAssignments.judgeId, event: events })
    .from(judgeAssignments)
    .innerJoin(events, eq(judgeAssignments.eventId, events.id))
    .where(eq(judgeAssignments.id, assignmentId))
    .limit(1);
  if (!a || a.judgeId !== user.id) return forbidden("Not your assignment");

  const now = new Date();
  if (a.event.judgingOpensAt && now < a.event.judgingOpensAt) {
    return forbidden("Judging has not opened yet");
  }
  if (a.event.judgingClosesAt && now > a.event.judgingClosesAt) {
    return forbidden("Judging is closed");
  }

  const criteria = await db
    .select()
    .from(rubricCriteria)
    .where(eq(rubricCriteria.eventId, a.event.id));
  const byId = new Map(criteria.map((c) => [c.id, c]));

  for (const s of input) {
    const c = byId.get(s.criterionId);
    if (!c) return NextResponse.json({ error: "Unknown criterion" }, { status: 422 });
    if (s.value < 0 || s.value > c.maxScore) {
      return NextResponse.json(
        { error: `Score for "${c.name}" must be between 0 and ${c.maxScore}` },
        { status: 422 },
      );
    }
  }

  await db.transaction(async (tx) => {
    for (const s of input) {
      await tx
        .insert(scores)
        .values({ assignmentId, criterionId: s.criterionId, value: s.value })
        .onConflictDoUpdate({
          target: [scores.assignmentId, scores.criterionId],
          set: { value: s.value, updatedAt: now },
        });
    }
  });

  return NextResponse.json({ saved: input.length });
}
