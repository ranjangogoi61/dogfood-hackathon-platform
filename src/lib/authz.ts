import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { eventRoles } from "@/db/schema/event-roles";
import { getCurrentSession } from "@/lib/auth/session";

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    } as const;
  }
  return { user: session.user, error: null } as const;
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function hasEventRole(
  userId: string,
  eventId: string,
  role: "organizer" | "judge" | "participant",
) {
  const rows = await db
    .select({ id: eventRoles.id })
    .from(eventRoles)
    .where(
      and(
        eq(eventRoles.userId, userId),
        eq(eventRoles.eventId, eventId),
        eq(eventRoles.role, role),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function isJudgeAnywhere(userId: string) {
  const rows = await db
    .select({ id: eventRoles.id })
    .from(eventRoles)
    .where(and(eq(eventRoles.userId, userId), eq(eventRoles.role, "judge")))
    .limit(1);
  return rows.length > 0;
}
