import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  emailNotifications: boolean("email_notifications").default(true),
});

export const discussions = pgTable("discussions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  imagePath: text("image_path"),
  helpfulCount: integer("helpful_count").default(0),
  upvoteCount: integer("upvote_count").default(0),
  downvoteCount: integer("downvote_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const replies = pgTable("replies", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  discussionId: integer("discussion_id")
    .notNull()
    .references(() => discussions.id),
  parentId: integer("parent_id"), // Self-reference handled later
  imagePath: text("image_path"),
  helpfulCount: integer("helpful_count").default(0),
  upvoteCount: integer("upvote_count").default(0),
  downvoteCount: integer("downvote_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// For self-references in Drizzle, we just use the integer column
// and handle the relationship in the application logic

export const helpfulMarks = pgTable("helpful_marks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  discussionId: integer("discussion_id").references(() => discussions.id),
  replyId: integer("reply_id").references(() => replies.id),
  type: text("type").notNull(), // 'upvote' or 'downvote'
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  triggeredByUserId: integer("triggered_by_user_id")
    .notNull()
    .references(() => users.id),
  discussionId: integer("discussion_id").references(() => discussions.id),
  replyId: integer("reply_id").references(() => replies.id),
  type: text("type").notNull(), // "reply" or "helpful"
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  discussionId: integer("discussion_id")
    .notNull()
    .references(() => discussions.id),
  saveDiscussionThread: boolean("save_discussion_thread").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
    email: true,
    emailNotifications: true,
  })
  .extend({
    email: z.string().email().nullable().optional(),
    emailNotifications: z.boolean().optional(),
  });

export const insertDiscussionSchema = createInsertSchema(discussions)
  .pick({
    title: true,
    content: true,
    userId: true,
    imagePath: true,
  })
  .extend({
    imagePath: z.string().nullable().optional(),
  });

export const insertReplySchema = createInsertSchema(replies)
  .pick({
    content: true,
    userId: true,
    discussionId: true,
    parentId: true,
    imagePath: true,
  })
  .extend({
    imagePath: z.string().nullable().optional(),
    parentId: z.number().nullable().optional(),
  });

export const insertHelpfulMarkSchema = createInsertSchema(helpfulMarks)
  .pick({
    userId: true,
    discussionId: true,
    replyId: true,
    type: true,
  })
  .extend({
    discussionId: z.number().nullable().optional(),
    replyId: z.number().nullable().optional(),
    type: z.enum(["upvote", "downvote"]),
  });

export const insertNotificationSchema = createInsertSchema(notifications)
  .pick({
    userId: true,
    triggeredByUserId: true,
    discussionId: true,
    replyId: true,
    type: true,
    message: true,
  })
  .extend({
    discussionId: z.number().nullable().optional(),
    replyId: z.number().nullable().optional(),
  });

export const insertBookmarkSchema = createInsertSchema(bookmarks).pick({
  userId: true,
  discussionId: true,
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

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;

// Extended Types for API responses
export type DiscussionWithUser = Discussion & {
  user: Omit<User, "password">;
};

export type ReplyWithUser = Reply & {
  user: Omit<User, "password">;
  childReplies?: ReplyWithUser[];
};

export type DiscussionWithDetails = DiscussionWithUser & {
  replies: ReplyWithUser[];
};

export type NotificationWithUser = Notification & {
  triggeredByUser: Omit<User, "password">;
  discussion?: Discussion;
  reply?: Reply;
};
