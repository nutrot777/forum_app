import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  await db.execute(sql`
    ALTER TABLE "discussions" 
      ADD COLUMN IF NOT EXISTS "image_paths" text[],
      ADD COLUMN IF NOT EXISTS "captions" text[];
    ALTER TABLE "replies" 
      ADD COLUMN IF NOT EXISTS "image_paths" text[],
      ADD COLUMN IF NOT EXISTS "captions" text[];
    -- Optionally migrate old imagePath to imagePaths
    UPDATE "discussions" SET image_paths = ARRAY[image_path] WHERE image_path IS NOT NULL AND (image_paths IS NULL OR array_length(image_paths, 1) = 0);
    UPDATE "replies" SET image_paths = ARRAY[image_path] WHERE image_path IS NOT NULL AND (image_paths IS NULL OR array_length(image_paths, 1) = 0);
  `);
}

export async function down() {
  await db.execute(sql`
    ALTER TABLE "discussions" DROP COLUMN IF EXISTS "image_paths";
    ALTER TABLE "discussions" DROP COLUMN IF EXISTS "captions";
    ALTER TABLE "replies" DROP COLUMN IF EXISTS "image_paths";
    ALTER TABLE "replies" DROP COLUMN IF EXISTS "captions";
  `);
}
