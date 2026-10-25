import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { eventRoles } from "@/db/schema/event-roles";
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
  const rows = await db
    .select({ userId: users.id, email: users.email, displayName: users.displayName })
    .from(eventRoles)
    .innerJoin(users, eq(eventRoles.userId, users.id))
    .where(and(eq(eventRoles.eventId, id), eq(eventRoles.role, "judge")));
  return NextResponse.json({ judges: rows });
}

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

/** Invite a registered user as a judge for this event (organizer/admin only). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const auth = await organizer(id);
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [target] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.email, parsed.data.email), isNull(users.deletedAt)))
    .limit(1);
  if (!target) return NextResponse.json({ error: "No registered user with that email" }, { status: 404 });

  await db.insert(eventRoles).values({ eventId: id, userId: target.id, role: "judge" }).onConflictDoNothing();
  return NextResponse.json({ judge: target }, { status: 201 });
}
