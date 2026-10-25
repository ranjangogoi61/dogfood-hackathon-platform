import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { projects } from "@/db/schema/projects";
import { teams } from "@/db/schema/teams";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public gallery: submitted projects of published/closed events. No auth required. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id");
  const trackId = searchParams.get("track_id");
  const q = searchParams.get("q")?.trim();

  if ((eventId && !UUID_RE.test(eventId)) || (trackId && !UUID_RE.test(trackId))) {
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  }

  const conditions = [
    eq(projects.status, "submitted"),
    isNull(projects.deletedAt),
    inArray(events.status, ["published", "closed"]),
  ];
  if (eventId) conditions.push(eq(projects.eventId, eventId));
  if (trackId) conditions.push(eq(projects.trackId, trackId));
  if (q) {
    const escaped = q.slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`);
    const pattern = `%${escaped}%`;
    conditions.push(
      or(ilike(projects.title, pattern), ilike(projects.tagline, pattern), ilike(projects.description, pattern))!,
    );
  }

  const rows = await db
    .select({
      id: projects.id,
      eventId: projects.eventId,
      trackId: projects.trackId,
      title: projects.title,
      tagline: projects.tagline,
      description: projects.description,
      thumbnailUrl: projects.thumbnailUrl,
      imageUrls: projects.imageUrls,
      videoUrl: projects.videoUrl,
      repoUrl: projects.repoUrl,
      liveUrl: projects.liveUrl,
      techTags: projects.techTags,
      submittedAt: projects.submittedAt,
      teamName: teams.name,
    })
    .from(projects)
    .innerJoin(events, eq(projects.eventId, events.id))
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .where(and(...conditions))
    .orderBy(desc(projects.submittedAt))
    .limit(200);

  return NextResponse.json({ projects: rows, count: rows.length });
}
