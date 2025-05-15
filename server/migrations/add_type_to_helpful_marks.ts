import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  await db.execute(sql`
    ALTER TABLE "helpful_marks" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'upvote';
  `);
}

export async function down() {
  await db.execute(sql`
    ALTER TABLE "helpful_marks" DROP COLUMN IF EXISTS "type";
  `);
}