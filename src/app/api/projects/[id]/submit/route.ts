import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teamMembers } from "@/db/schema/teams";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Submit a project. Deadline and permissions are enforced server-side only. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const { user, error } = await requireUser();
  if (error) return error;

  const [row] = await db
    .select({ project: projects, event: events })
    .from(projects)
    .innerJoin(events, eq(projects.eventId, events.id))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { project, event } = row;

  const [membership] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, user.id)))
    .limit(1);

  const allowed =
    !!membership || user.isAdmin || (await hasEventRole(user.id, event.id, "organizer"));
  if (!allowed) return forbidden();

  const now = new Date();
  if (event.status !== "published") {
    return forbidden("Submissions are closed for this event");
  }
  if (event.submissionOpensAt && now < event.submissionOpensAt) {
    return forbidden("Submissions have not opened yet");
  }
  if (event.submissionClosesAt && now > event.submissionClosesAt) {
    return forbidden("Submission deadline has passed");
  }

  if (project.status === "withdrawn") {
    return NextResponse.json({ error: "Project was withdrawn" }, { status: 409 });
  }
  if (!project.title?.trim() || !project.description?.trim()) {
    return NextResponse.json({ error: "Title and description are required" }, { status: 422 });
  }

  const [updated] = await db
    .update(projects)
    .set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(eq(projects.id, id))
    .returning({ id: projects.id, status: projects.status, submittedAt: projects.submittedAt });

  return NextResponse.json({ project: updated });
}
