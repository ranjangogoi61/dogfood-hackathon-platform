import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/lib/db";

async function main() {
  await migrate(db, {
    migrationsFolder: "./src/db/migrations",
  });

  console.log("Migrations completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
