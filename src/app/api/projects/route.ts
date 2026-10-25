import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teamMembers, teams } from "@/db/schema/teams";
import { tracks } from "@/db/schema/tracks";
import { requireUser } from "@/lib/authz";
import { createProjectSchema } from "@/lib/projects/input";

export const dynamic = "force-dynamic";

/** Create a draft project for a team the caller belongs to (one project per team). */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project", issues: parsed.error.issues }, { status: 400 });
  }
  const { teamId, trackId, ...fields } = parsed.data;

  const [row] = await db
    .select({ team: teams, event: events })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { event } = row;
  const now = new Date();
  if (
    event.status !== "published" ||
    (event.submissionOpensAt && now < event.submissionOpensAt) ||
    (event.submissionClosesAt && now > event.submissionClosesAt)
  ) {
    return NextResponse.json({ error: "Submissions are not open" }, { status: 403 });
  }

  if (trackId) {
    const [t] = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.eventId, event.id)))
      .limit(1);
    if (!t) return NextResponse.json({ error: "Track does not belong to this event" }, { status: 422 });
  }

  try {
    const [project] = await db
      .insert(projects)
      .values({
        ...fields,
        eventId: event.id,
        teamId,
        trackId: trackId ?? null,
        imageUrls: fields.imageUrls ?? [],
        techTags: fields.techTags ?? [],
        status: "draft",
        createdBy: user.id,
      })
      .returning();
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This team already has a project" }, { status: 409 });
    }
    throw e;
  }
}
