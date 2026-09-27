import { eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema/users";

export async function findUserByEmail(
  email: string,
) {
  const result = await db
    .select()
    .from(users)
    .where(
      eq(users.email, email),
    )
    .limit(1);

  return result[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}) {
  const result = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
    });

  return result[0];
}
