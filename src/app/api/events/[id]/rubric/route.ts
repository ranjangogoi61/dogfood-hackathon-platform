import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { rubricCriteria, scores, judgeAssignments } from "@/db/schema/judging";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function organizer(id: string) {
  const { user, error } = await requireUser();
  if (error) return { error } as const;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return { error: forbidden() } as const;
  return { user } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const auth = await organizer(id);
  if ("error" in auth) return auth.error;
  const rows = await db.select().from(rubricCriteria).where(eq(rubricCriteria.eventId, id)).orderBy(asc(rubricCriteria.position));
  return NextResponse.json({ criteria: rows });
}

const bodySchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        weight: z.number().positive().max(1000),
        maxScore: z.number().int().min(1).max(1000).default(10),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * Replace the event's rubric. Allowed only while no scores exist, so a
 * rubric can never change underneath submitted ballots.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const auth = await organizer(id);
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  const names = parsed.data.criteria.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    return NextResponse.json({ error: "Criterion names must be unique" }, { status: 422 });
  }

  const result = await db.transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(scores)
      .innerJoin(judgeAssignments, eq(scores.assignmentId, judgeAssignments.id))
      .where(eq(judgeAssignments.eventId, id));
    if (n > 0) return null;

    await tx.delete(rubricCriteria).where(eq(rubricCriteria.eventId, id));
    return tx
      .insert(rubricCriteria)
      .values(parsed.data.criteria.map((c, i) => ({ eventId: id, name: c.name, weight: c.weight, maxScore: c.maxScore, position: i + 1 })))
      .returning();
  });

  if (!result) return NextResponse.json({ error: "Rubric is locked: scores already exist" }, { status: 409 });
  return NextResponse.json({ criteria: result });
}
