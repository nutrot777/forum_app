import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bookmarks" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
      "discussion_id" INTEGER NOT NULL REFERENCES "discussions"("id"),
      "created_at" TIMESTAMP DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_user_discussion_idx" ON "bookmarks" ("user_id", "discussion_id");
  `);
}

export async function down() {
  await db.execute(sql`
    DROP TABLE IF EXISTS "bookmarks";
  `);
}