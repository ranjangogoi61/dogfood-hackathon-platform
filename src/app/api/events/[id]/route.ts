import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/db/schema/events";
import { forbidden, hasEventRole, requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const patchSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  submissionOpensAt: date.optional(),
  submissionClosesAt: date.optional(),
  judgingOpensAt: date.optional(),
  judgingClosesAt: date.optional(),
  minTeamSize: z.number().int().min(1).max(100).optional(),
  maxTeamSize: z.number().int().min(1).max(100).nullable().optional(),
});

// draft -> published -> closed (closed is final; no reopening via API)
const ALLOWED: Record<string, string[]> = {
  draft: ["published"],
  published: ["closed"],
  closed: [],
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.status === "draft") {
    const { user } = await requireUser();
    const ok = user && (user.isAdmin || (await hasEventRole(user.id, id, "organizer")));
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
}

/** Organizer/admin only: edit settings, publish, close. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { user, error } = await requireUser();
  if (error) return error;
  if (!user.isAdmin && !(await hasEventRole(user.id, id, "organizer"))) return forbidden();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, ...rest } = parsed.data;
  if (status && status !== event.status && !ALLOWED[event.status].includes(status)) {
    return NextResponse.json(
      { error: `Cannot change status from ${event.status} to ${status}` },
      { status: 409 },
    );
  }

  const merged = { ...event, ...rest };
  if (
    (merged.submissionOpensAt && merged.submissionClosesAt && merged.submissionClosesAt <= merged.submissionOpensAt) ||
    (merged.judgingOpensAt && merged.judgingClosesAt && merged.judgingClosesAt <= merged.judgingOpensAt) ||
    (merged.maxTeamSize != null && merged.maxTeamSize < merged.minTeamSize)
  ) {
    return NextResponse.json({ error: "Inconsistent dates or team sizes" }, { status: 422 });
  }

  const [updated] = await db
    .update(events)
    .set({ ...rest, ...(status ? { status } : {}), updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return NextResponse.json({ event: updated });
}
