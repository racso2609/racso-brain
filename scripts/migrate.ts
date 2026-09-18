import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }

  console.log("Connecting to database for migrations...");
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log("Running migrations from ./drizzle/migrations...");
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });

  console.log("Migrations successfully applied!");
  await sql.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
