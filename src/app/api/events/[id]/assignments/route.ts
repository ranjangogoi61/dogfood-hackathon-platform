import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { eventRoles } from "@/db/schema/event-roles";
import { projects } from "@/db/schema/projects";
import { teamMembers } from "@/db/schema/teams";
import { judgeAssignments } from "@/db/schema/judging";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.union([
  z.object({ projectId: z.string().uuid(), judgeId: z.string().uuid() }),
  z.object({ auto: z.object({ judgesPerProject: z.number().int().min(1).max(20) }) }),
]);

/**
 * Organizer/admin only. Either assign one judge to one project, or
 * auto-assign `judgesPerProject` judges to every submitted project
 * (least-loaded judges first; judges never score their own team's project).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return forbidden();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const judges = (
    await db
      .select({ userId: eventRoles.userId })
      .from(eventRoles)
      .where(and(eq(eventRoles.eventId, id), eq(eventRoles.role, "judge")))
  ).map((r) => r.userId);

  const projectRows = await db
    .select({ id: projects.id, teamId: projects.teamId })
    .from(projects)
    .where(and(eq(projects.eventId, id), eq(projects.status, "submitted"), isNull(projects.deletedAt)));

  const members = await db
    .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.eventId, id));
  const conflicts = (teamId: string, judgeId: string) =>
    members.some((m) => m.teamId === teamId && m.userId === judgeId);

  const existing = await db
    .select({ projectId: judgeAssignments.projectId, judgeId: judgeAssignments.judgeId })
    .from(judgeAssignments)
    .where(eq(judgeAssignments.eventId, id));

  const toInsert: { eventId: string; projectId: string; judgeId: string }[] = [];

  if ("projectId" in parsed.data) {
    const { projectId, judgeId } = parsed.data;
    const project = projectRows.find((p) => p.id === projectId);
    if (!project) return NextResponse.json({ error: "Project not found or not submitted" }, { status: 404 });
    if (!judges.includes(judgeId)) return NextResponse.json({ error: "User is not a judge for this event" }, { status: 422 });
    if (conflicts(project.teamId, judgeId)) return NextResponse.json({ error: "Judge belongs to this project's team" }, { status: 422 });
    toInsert.push({ eventId: id, projectId, judgeId });
  } else {
    if (judges.length === 0) return NextResponse.json({ error: "No judges invited" }, { status: 422 });
    const load = new Map(judges.map((j) => [j, existing.filter((e) => e.judgeId === j).length]));
    for (const p of projectRows) {
      const have = new Set(existing.filter((e) => e.projectId === p.id).map((e) => e.judgeId));
      const candidates = judges
        .filter((j) => !have.has(j) && !conflicts(p.teamId, j))
        .sort((a, b) => load.get(a)! - load.get(b)!);
      const need = parsed.data.auto.judgesPerProject - have.size;
      for (const j of candidates.slice(0, Math.max(0, need))) {
        toInsert.push({ eventId: id, projectId: p.id, judgeId: j });
        load.set(j, load.get(j)! + 1);
      }
    }
  }

  if (toInsert.length) {
    await db.insert(judgeAssignments).values(toInsert).onConflictDoNothing();
  }
  return NextResponse.json({ created: toInsert.length }, { status: 201 });
}
