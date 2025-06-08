import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  await db.execute(sql`
    ALTER TABLE "discussions" ADD COLUMN IF NOT EXISTS "upvote_count" INTEGER DEFAULT 0;
    ALTER TABLE "discussions" ADD COLUMN IF NOT EXISTS "downvote_count" INTEGER DEFAULT 0;
    ALTER TABLE "replies" ADD COLUMN IF NOT EXISTS "upvote_count" INTEGER DEFAULT 0;
    ALTER TABLE "replies" ADD COLUMN IF NOT EXISTS "downvote_count" INTEGER DEFAULT 0;
  `);
}

export async function down() {
  await db.execute(sql`
    ALTER TABLE "discussions" DROP COLUMN IF EXISTS "upvote_count";
    ALTER TABLE "discussions" DROP COLUMN IF EXISTS "downvote_count";
    ALTER TABLE "replies" DROP COLUMN IF EXISTS "upvote_count";
    ALTER TABLE "replies" DROP COLUMN IF EXISTS "downvote_count";
  `);
}