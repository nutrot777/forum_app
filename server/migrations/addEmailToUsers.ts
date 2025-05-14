import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Run this migration to add email and email_notifications columns to users table
 */
export async function addEmailColumnsToUsers() {
  try {
    // Check if column exists before trying to add it
    const columnsQuery = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email'
    `);
    
    const hasEmailColumn = columnsQuery.rows.length > 0;
    
    if (!hasEmailColumn) {
      console.log("Adding email column to users table");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN email TEXT,
        ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE
      `);
      console.log("Email columns added successfully");
    } else {
      console.log("Email column already exists in users table");
    }
    
    return true;
  } catch (error) {
    console.error("Error adding email columns to users table:", error);
    return false;
  }
}

/**
 * Create notifications table if it doesn't exist
 */
export async function createNotificationsTable() {
  try {
    // Check if table exists before trying to create it
    const tableQuery = await db.execute(sql`
      SELECT to_regclass('public.notifications') as table_exists
    `);
    
    const tableExists = tableQuery.rows[0]?.table_exists !== null;
    
    if (!tableExists) {
      console.log("Creating notifications table");
      await db.execute(sql`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          triggered_by_user_id INTEGER NOT NULL REFERENCES users(id),
          discussion_id INTEGER REFERENCES discussions(id),
          reply_id INTEGER REFERENCES replies(id),
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          email_sent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("Notifications table created successfully");
    } else {
      console.log("Notifications table already exists");
    }
    
    return true;
  } catch (error) {
    console.error("Error creating notifications table:", error);
    return false;
  }
}

// In ESM, we can't check require.main === module, so we'll use this approach
// This file will be imported and the functions called directly from index.ts