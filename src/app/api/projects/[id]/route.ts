import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teamMembers } from "@/db/schema/teams";
import { tracks } from "@/db/schema/tracks";
import { hasEventRole, requireUser } from "@/lib/authz";
import { updateProjectSchema } from "@/lib/projects/input";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  const [row] = await db
    .select({ project: projects, event: events })
    .from(projects)
    .innerJoin(events, eq(projects.eventId, events.id))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return row;
}

/** Drafts are visible to team members/organizers only; submitted projects of live events are public. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const row = await load(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPublic = row.project.status === "submitted" && row.event.status !== "draft";
  if (isPublic) return NextResponse.json({ project: row.project });

  const { user } = await requireUser();
  if (user) {
    const [m] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, row.project.teamId), eq(teamMembers.userId, user.id)))
      .limit(1);
    if (m || user.isAdmin || (await hasEventRole(user.id, row.event.id, "organizer"))) {
      return NextResponse.json({ project: row.project });
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Team members edit their project until the submission deadline. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;

  const row = await load(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { project, event } = row;

  const [m] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, user.id)))
    .limit(1);
  if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  if (
    event.status !== "published" ||
    (event.submissionOpensAt && now < event.submissionOpensAt) ||
    (event.submissionClosesAt && now > event.submissionClosesAt)
  ) {
    return NextResponse.json({ error: "Submissions are closed" }, { status: 403 });
  }
  if (project.status === "withdrawn") {
    return NextResponse.json({ error: "Project was withdrawn" }, { status: 409 });
  }

  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project", issues: parsed.error.issues }, { status: 400 });
  }
  const { trackId, ...rest } = parsed.data;

  if (trackId) {
    const [t] = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.eventId, event.id)))
      .limit(1);
    if (!t) return NextResponse.json({ error: "Track does not belong to this event" }, { status: 422 });
  }

  const [updated] = await db
    .update(projects)
    .set({ ...rest, ...(trackId !== undefined ? { trackId } : {}), updatedAt: now })
    .where(eq(projects.id, id))
    .returning();
  return NextResponse.json({ project: updated });
}
