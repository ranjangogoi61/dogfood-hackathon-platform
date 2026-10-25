import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { eventRoles } from "@/db/schema/event-roles";
import { teamMembers, teams } from "@/db/schema/teams";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

/** Create a team in a published event; the creator becomes leader and participant. */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { eventId, name } = parsed.data;

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status === "draft") return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status === "closed" || (event.submissionClosesAt && new Date() > event.submissionClosesAt)) {
    return NextResponse.json({ error: "Event is closed to new teams" }, { status: 403 });
  }

  const [already] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.eventId, eventId), eq(teamMembers.userId, user.id)))
    .limit(1);
  if (already) return NextResponse.json({ error: "You already belong to a team in this event" }, { status: 409 });

  try {
    const team = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(teams)
        .values({ eventId, name, inviteCode: randomBytes(16).toString("hex"), createdBy: user.id })
        .returning();
      await tx.insert(teamMembers).values({ teamId: t.id, eventId, userId: user.id, role: "leader" });
      await tx
        .insert(eventRoles)
        .values({ eventId, userId: user.id, role: "participant" })
        .onConflictDoNothing();
      return t;
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Team name already taken in this event" }, { status: 409 });
    }
    throw e;
  }
}
