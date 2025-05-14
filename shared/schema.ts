import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const discussions = pgTable("discussions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  imagePath: text("image_path"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const replies = pgTable("replies", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  discussionId: integer("discussion_id").notNull().references(() => discussions.id),
  parentId: integer("parent_id").references(() => replies.id),
  imagePath: text("image_path"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const helpfulMarks = pgTable("helpful_marks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  discussionId: integer("discussion_id").references(() => discussions.id),
  replyId: integer("reply_id").references(() => replies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDiscussionSchema = createInsertSchema(discussions).pick({
  title: true,
  content: true,
  userId: true,
  imagePath: true,
});

export const insertReplySchema = createInsertSchema(replies).pick({
  content: true,
  userId: true,
  discussionId: true,
  parentId: true,
  imagePath: true,
});

export const insertHelpfulMarkSchema = createInsertSchema(helpfulMarks).pick({
  userId: true,
  discussionId: true,
  replyId: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Discussion = typeof discussions.$inferSelect;
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;

export type Reply = typeof replies.$inferSelect;
export type InsertReply = z.infer<typeof insertReplySchema>;

export type HelpfulMark = typeof helpfulMarks.$inferSelect;
export type InsertHelpfulMark = z.infer<typeof insertHelpfulMarkSchema>;

// Extended Types for API responses
export type DiscussionWithUser = Discussion & {
  user: Omit<User, 'password'>;
};

export type ReplyWithUser = Reply & {
  user: Omit<User, 'password'>;
  childReplies?: ReplyWithUser[];
};

export type DiscussionWithDetails = DiscussionWithUser & {
  replies: ReplyWithUser[];
};
