import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

// For serverless/edge environments or standard node
const client = postgres(connectionString, {
  prepare: false,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
