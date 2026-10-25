import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teams } from "@/db/schema/teams";
import { judgeAssignments, rubricCriteria, scores } from "@/db/schema/judging";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";
import { normalizeJudgeScores, weightedTotal } from "@/lib/judging/normalization";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CSV-escape and neutralise spreadsheet formula injection. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Organizer/admin only. Per-judge normalization, then mean per project. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return forbidden();

  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const criteria = await db.select().from(rubricCriteria).where(eq(rubricCriteria.eventId, id));
  const rows = await db
    .select({
      projectId: projects.id,
      title: projects.title,
      status: projects.status,
      team: teams.name,
    })
    .from(projects)
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .where(and(eq(projects.eventId, id), isNull(projects.deletedAt)));

  const assignments = await db
    .select({ id: judgeAssignments.id, projectId: judgeAssignments.projectId, judgeId: judgeAssignments.judgeId })
    .from(judgeAssignments)
    .where(eq(judgeAssignments.eventId, id));

  const scoreRows = await db
    .select({ assignmentId: scores.assignmentId, criterionId: scores.criterionId, value: scores.value })
    .from(scores)
    .innerJoin(judgeAssignments, eq(scores.assignmentId, judgeAssignments.id))
    .where(eq(judgeAssignments.eventId, id));

  const valuesByAssignment = new Map<string, Map<string, number>>();
  for (const s of scoreRows) {
    if (!valuesByAssignment.has(s.assignmentId)) valuesByAssignment.set(s.assignmentId, new Map());
    valuesByAssignment.get(s.assignmentId)!.set(s.criterionId, s.value);
  }

  // raw total (0-100) per assignment; incomplete assignments are skipped, never zero-filled
  const rawByAssignment = new Map<string, number>();
  for (const a of assignments) {
    const total = weightedTotal(criteria, valuesByAssignment.get(a.id) ?? new Map());
    if (total !== null) rawByAssignment.set(a.id, total);
  }

  // normalize within each judge
  const normByAssignment = new Map<string, number>();
  const byJudge = new Map<string, string[]>();
  for (const a of assignments) {
    if (!rawByAssignment.has(a.id)) continue;
    byJudge.set(a.judgeId, [...(byJudge.get(a.judgeId) ?? []), a.id]);
  }
  for (const ids of byJudge.values()) {
    const result = normalizeJudgeScores(
      ids.map((i) => rawByAssignment.get(i)!),
      { minSamples: event.normalizationMinSamples, epsilon: event.normalizationEpsilon },
    );
    ids.forEach((aid, i) => normByAssignment.set(aid, result.values[i]));
  }

  const header = [
    "project_id", "project_title", "team", "status",
    "judges_scored", "mean_raw_score", "mean_normalized_score",
  ];
  const lines = [header.join(",")];
  for (const p of rows) {
    const mine = assignments.filter((a) => a.projectId === p.projectId && rawByAssignment.has(a.id));
    const raw = mean(mine.map((a) => rawByAssignment.get(a.id)!));
    const norm = mean(mine.map((a) => normByAssignment.get(a.id)!));
    lines.push(
      [
        p.projectId, p.title, p.team, p.status, mine.length,
        raw === null ? "" : raw.toFixed(4),
        norm === null ? "" : norm.toFixed(4),
      ].map(cell).join(","),
    );
  }

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
