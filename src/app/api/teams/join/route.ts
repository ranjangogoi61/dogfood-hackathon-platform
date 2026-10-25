import { NextResponse } from "next/server";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { eventRoles } from "@/db/schema/event-roles";
import { teamMembers, teams } from "@/db/schema/teams";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ inviteCode: z.string().trim().min(8).max(128) });

/** Join a team by invite code. Team-size cap is enforced server-side. */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [row] = await db
    .select({ team: teams, event: events })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(and(eq(teams.inviteCode, parsed.data.inviteCode), isNull(teams.deletedAt), eq(teams.status, "active")))
    .limit(1);
  if (!row || row.event.status === "draft") {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }
  const { team, event } = row;

  if (event.status === "closed" || (event.submissionClosesAt && new Date() > event.submissionClosesAt)) {
    return NextResponse.json({ error: "Event is closed" }, { status: 403 });
  }

  try {
    await db.transaction(async (tx) => {
      // lock the team row so concurrent joins cannot exceed the cap
      await tx.execute(
        sql`SELECT id FROM teams WHERE id = ${team.id} FOR UPDATE`,
      );
      const [{ n }] = await tx
        .select({ n: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, team.id));
      if (event.maxTeamSize !== null && n >= event.maxTeamSize) {
        throw Object.assign(new Error("full"), { code: "TEAM_FULL" });
      }
      await tx.insert(teamMembers).values({ teamId: team.id, eventId: event.id, userId: user.id, role: "member" });
      await tx
        .insert(eventRoles)
        .values({ eventId: event.id, userId: user.id, role: "participant" })
        .onConflictDoNothing();
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "TEAM_FULL") return NextResponse.json({ error: "Team is full" }, { status: 409 });
    if (code === "23505") return NextResponse.json({ error: "You already belong to a team in this event" }, { status: 409 });
    throw e;
  }

  return NextResponse.json({ team: { id: team.id, name: team.name, eventId: event.id } });
}
