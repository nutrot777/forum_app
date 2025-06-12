import { eq, and, isNull, desc, asc, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
	users,
	discussions,
	replies,
	helpfulMarks,
	notifications,
	bookmarks,
	type User,
	type InsertUser,
	type Discussion,
	type InsertDiscussion,
	type Reply,
	type InsertReply,
	type HelpfulMark,
	type InsertHelpfulMark,
	type Notification,
	type InsertNotification,
	type NotificationWithUser,
	type DiscussionWithUser,
	type ReplyWithUser,
	type DiscussionWithDetails,
} from "@shared/schema";
import { IStorage } from "./storage";

// Declare a userId variable for 'my' filter
declare global {
	var userId: number | undefined;
}

// Utility to normalize reply fields
function normalizeReply<T extends { captions?: string[] | null; imagePaths?: string[] | null }>(reply: T): T & { captions: string[]; imagePaths: string[] } {
  return {
    ...reply,
    captions: Array.isArray(reply.captions) ? reply.captions : [],
    imagePaths: Array.isArray(reply.imagePaths) ? reply.imagePaths : [],
  };
}

// Utility to normalize discussion fields
function normalizeDiscussion<T extends { captions?: string[] | null; imagePaths?: string[] | null }>(discussion: T): T & { captions: string[]; imagePaths: string[] } {
  return {
    ...discussion,
    captions: Array.isArray(discussion.captions) ? discussion.captions : [],
    imagePaths: Array.isArray(discussion.imagePaths) ? discussion.imagePaths : [],
  };
}

export class DatabaseStorage implements IStorage {
	// User operations
	async getUser(id: number): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user || undefined;
	}

	async getUserByUsername(username: string): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.username, username));
		return user || undefined;
	}

	async createUser(insertUser: InsertUser): Promise<User> {
		const [user] = await db.insert(users).values(insertUser).returning();
		return user;
	}

	async updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined> {
		const [updatedUser] = await db.update(users).set({ isOnline }).where(eq(users.id, id)).returning();
		return updatedUser || undefined;
	}

	async getOnlineUsers(): Promise<number> {
		const result = await db.select().from(users).where(eq(users.isOnline, true));
		return result.length;
	}

	async getTotalUserCount(): Promise<number> {
		// Explicitly select the id column to ensure Drizzle returns an array
		const result = await db.select({ id: users.id }).from(users);
		console.log('Total users query result:', result);
		return result.length;
	}

	// Discussion operations
	async createDiscussion(insertDiscussion: InsertDiscussion): Promise<Discussion> {
		const [discussion] = await db
			.insert(discussions)
			.values({
				...insertDiscussion,
				imagePaths: insertDiscussion.imagePaths || [],
				captions: insertDiscussion.captions || [],
			})
			.returning();
		return normalizeDiscussion(discussion);
	}

	// Add logging to debug the `user` field in discussions
	async getDiscussions(filter: string = "recent"): Promise<DiscussionWithUser[]> {
		const allDiscussionsRaw = await db.select().from(discussions);
		const allDiscussions = allDiscussionsRaw.map(normalizeDiscussion);
		const userIds = Array.from(new Set(allDiscussions.map((d) => d.userId)));

		let allUsers: User[] = [];
		if (userIds.length > 0) {
			allUsers = await db.select().from(users).where(inArray(users.id, userIds));
		}

		const discussionsWithUsers: DiscussionWithUser[] = [];

		for (const discussion of allDiscussions) {
			const user = allUsers.find((u) => u.id === discussion.userId);
			if (user) {
				const { password, ...userWithoutPassword } = user;
				discussionsWithUsers.push({
					...discussion,
					user: userWithoutPassword,
				});
			} else {
				console.warn("User not found for discussion:", discussion);
			}
		}

		console.log("Discussions with users:", discussionsWithUsers);

		if (filter === "helpful") {
			discussionsWithUsers.sort((a, b) => {
				const aCount = a.helpfulCount || 0;
				const bCount = b.helpfulCount || 0;
				return bCount - aCount;
			});
		} else if (filter === "my" && global.userId) {
			return discussionsWithUsers.filter((d) => d.userId === global.userId);
		} else {
			// Default to 'recent'
			discussionsWithUsers.sort((a, b) => {
				if (!a.createdAt || !b.createdAt) return 0;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
		}

		return discussionsWithUsers;
	}

	async getDiscussionById(id: number): Promise<DiscussionWithDetails | undefined> {
		const [discussionRaw] = await db.select().from(discussions).where(eq(discussions.id, id));
		if (!discussionRaw) return undefined;
		const discussion = normalizeDiscussion(discussionRaw);
		const [user] = await db.select().from(users).where(eq(users.id, discussion.userId));
		if (!user) return undefined;
		const { password, ...userWithoutPassword } = user;
		// Normalize allReplies
		const allRepliesRaw = await db.select().from(replies).where(eq(replies.discussionId, id));
		const allReplies = allRepliesRaw.map(normalizeReply);
		const userIds = Array.from(new Set(allReplies.map((r) => r.userId)));
		let replyUsers: User[] = [];
		if (userIds.length > 0) {
			replyUsers = await db.select().from(users).where(inArray(users.id, userIds));
		}
		const repliesWithUsers: ReplyWithUser[] = [];
		const topLevelReplies = allReplies.filter((r) => r.parentId === null);
		for (const reply of topLevelReplies) {
			const replyUser = replyUsers.find((u) => u.id === reply.userId);
			if (replyUser) {
				const { password, ...userWithoutPassword } = replyUser;
				const childReplies = this.buildReplyTree(reply.id, allReplies, replyUsers);
				repliesWithUsers.push({
					...reply,
					user: userWithoutPassword,
					childReplies,
				});
			}
		}
		return {
			...discussion,
			user: userWithoutPassword,
			replies: repliesWithUsers,
		};
	}

	private buildReplyTree(parentId: number, allReplies: Reply[], replyUsers: User[]): ReplyWithUser[] {
		// allReplies must be normalized before calling this
		const childReplies: ReplyWithUser[] = [];
		const directChildren = allReplies.filter((r) => r.parentId === parentId);
		for (const child of directChildren) {
			const childUser = replyUsers.find((u) => u.id === child.userId);
			if (childUser) {
				const { password, ...userWithoutPassword } = childUser;
				const nestedChildren = this.buildReplyTree(child.id, allReplies, replyUsers);
				childReplies.push({
					...child,
					user: userWithoutPassword,
					childReplies: nestedChildren,
				});
			}
		}
		return childReplies;
	}

	async updateDiscussion(id: number, partialDiscussion: Partial<InsertDiscussion>): Promise<Discussion | undefined> {
		const [updatedDiscussion] = await db
			.update(discussions)
			.set({
				...partialDiscussion,
				imagePaths: partialDiscussion.imagePaths || [],
				captions: partialDiscussion.captions || [],
			})
			.where(eq(discussions.id, id))
			.returning();
		return updatedDiscussion ? normalizeDiscussion(updatedDiscussion) : undefined;
	}

	async deleteDiscussion(id: number): Promise<boolean> {
		// First delete all replies related to this discussion
		await db.delete(replies).where(eq(replies.discussionId, id));

		// Delete helpful marks for this discussion
		await db.delete(helpfulMarks).where(eq(helpfulMarks.discussionId, id));

		// Then delete the discussion
		const result = await db.delete(discussions).where(eq(discussions.id, id)).returning();

		return result.length > 0;
	}

	// Reply operations
	async createReply(insertReply: InsertReply): Promise<Reply> {
		const [reply] = await db
			.insert(replies)
			.values({
				...insertReply,
				imagePaths: insertReply.imagePaths || [],
				captions: insertReply.captions || [],
			})
			.returning();
		return normalizeReply(reply);
	}

	async getReplyById(id: number): Promise<Reply | undefined> {
		const [reply] = await db.select().from(replies).where(eq(replies.id, id));
		return reply ? normalizeReply(reply) : undefined;
	}

	async getRepliesByDiscussionId(discussionId: number): Promise<ReplyWithUser[]> {
		const allRepliesRaw = await db.select().from(replies).where(eq(replies.discussionId, discussionId));
		const allReplies = allRepliesRaw.map(normalizeReply);
		const userIds = Array.from(new Set(allReplies.map((r) => r.userId)));
		let replyUsers: User[] = [];
		if (userIds.length > 0) {
			replyUsers = await db.select().from(users).where(inArray(users.id, userIds));
		}
		const topLevelReplies = allReplies.filter((r) => r.parentId === null);
		const result: ReplyWithUser[] = [];
		for (const reply of topLevelReplies) {
			const user = replyUsers.find((u) => u.id === reply.userId);
			if (user) {
				const { password, ...userWithoutPassword } = user;
				const childReplies = this.buildReplyTree(reply.id, allReplies, replyUsers);
				result.push({
					...reply,
					user: userWithoutPassword,
					childReplies,
				});
			}
		}
		return result;
	}

	async updateReply(id: number, partialReply: Partial<InsertReply>): Promise<Reply | undefined> {
		const [updatedReply] = await db
			.update(replies)
			.set({
				...partialReply,
				imagePaths: partialReply.imagePaths || [],
				captions: partialReply.captions || [],
			})
			.where(eq(replies.id, id))
			.returning();
		return updatedReply ? normalizeReply(updatedReply) : undefined;
	}

	async deleteReply(id: number): Promise<boolean> {
		// First delete helpful marks for this reply
		await db.delete(helpfulMarks).where(eq(helpfulMarks.replyId, id));

		// Then delete the reply
		const result = await db.delete(replies).where(eq(replies.id, id)).returning();

		return result.length > 0;
	}

	// Helpful marks
	async markAsHelpful(insertMark: InsertHelpfulMark): Promise<HelpfulMark> {
		// Check if mark already exists
		const existingMarks = await db
			.select()
			.from(helpfulMarks)
			.where(
				and(
					eq(helpfulMarks.userId, insertMark.userId),
					insertMark.discussionId
						? eq(helpfulMarks.discussionId, insertMark.discussionId)
						: isNull(helpfulMarks.discussionId),
					insertMark.replyId ? eq(helpfulMarks.replyId, insertMark.replyId) : isNull(helpfulMarks.replyId)
				)
			);

		if (existingMarks.length > 0) {
			return existingMarks[0];
		}

		// Create new mark
		const [mark] = await db
			.insert(helpfulMarks)
			.values({
				...insertMark,
				discussionId: insertMark.discussionId || null,
				replyId: insertMark.replyId || null,
			})
			.returning();

		// Update helpful count
		if (mark.discussionId) {
			await db
				.update(discussions)
				.set({
					helpfulCount: sql`${discussions.helpfulCount} + 1`,
				})
				.where(eq(discussions.id, mark.discussionId));
		} else if (mark.replyId) {
			await db
				.update(replies)
				.set({
					helpfulCount: sql`${replies.helpfulCount} + 1`,
				})
				.where(eq(replies.id, mark.replyId));
		}

		return mark;
	}

	async removeHelpfulMark(userId: number, discussionId?: number, replyId?: number): Promise<boolean> {
		// Find the mark to delete
		const marks = await db
			.select()
			.from(helpfulMarks)
			.where(
				and(
					eq(helpfulMarks.userId, userId),
					discussionId ? eq(helpfulMarks.discussionId, discussionId) : isNull(helpfulMarks.discussionId),
					replyId ? eq(helpfulMarks.replyId, replyId) : isNull(helpfulMarks.replyId)
				)
			);

		if (marks.length === 0) return false;
		const markToDelete = marks[0];

		// Update helpful count
		if (markToDelete.discussionId) {
			await db
				.update(discussions)
				.set({
					helpfulCount: sql`GREATEST(${discussions.helpfulCount} - 1, 0)`,
				})
				.where(eq(discussions.id, markToDelete.discussionId));
		} else if (markToDelete.replyId) {
			await db
				.update(replies)
				.set({
					helpfulCount: sql`GREATEST(${replies.helpfulCount} - 1, 0)`,
				})
				.where(eq(replies.id, markToDelete.replyId));
		}

		// Delete the mark
		const result = await db.delete(helpfulMarks).where(eq(helpfulMarks.id, markToDelete.id)).returning();

		return result.length > 0;
	}

	async isMarkedAsHelpful(userId: number, discussionId?: number, replyId?: number): Promise<boolean> {
		const marks = await db
			.select()
			.from(helpfulMarks)
			.where(
				and(
					eq(helpfulMarks.userId, userId),
					discussionId ? eq(helpfulMarks.discussionId, discussionId) : isNull(helpfulMarks.discussionId),
					replyId ? eq(helpfulMarks.replyId, replyId) : isNull(helpfulMarks.replyId)
				)
			);

		return marks.length > 0;
	}

	// Update user data
	async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
		const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
		return user || undefined;
	}

	// Notification operations
	async createNotification(notification: InsertNotification): Promise<Notification> {
		const [newNotification] = await db
			.insert(notifications)
			.values({
				...notification,
				discussionId: notification.discussionId || null,
				replyId: notification.replyId || null,
				isRead: false,
				emailSent: false,
			})
			.returning();
		return newNotification;
	}

	async getNotifications(userId: number): Promise<NotificationWithUser[]> {
		const allNotifications = await db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(desc(notifications.createdAt));

		const userIds = Array.from(new Set(allNotifications.map((n) => n.triggeredByUserId)));
		const discussionIds = Array.from(
			new Set(allNotifications.map((n) => n.discussionId).filter(Boolean) as number[])
		);
		const replyIds = Array.from(new Set(allNotifications.map((n) => n.replyId).filter(Boolean) as number[]));

		// Get users
		let notificationUsers: User[] = [];
		if (userIds.length > 0) {
			notificationUsers = await db.select().from(users).where(inArray(users.id, userIds));
		}

		// Get discussions
		let relatedDiscussions: Discussion[] = [];
		if (discussionIds.length > 0) {
			relatedDiscussions = (await db.select().from(discussions).where(inArray(discussions.id, discussionIds))).map(normalizeDiscussion);
		}

		// Get replies and normalize them
		let relatedReplies: Reply[] = [];
		if (replyIds.length > 0) {
			const rawReplies = await db.select().from(replies).where(inArray(replies.id, replyIds));
			relatedReplies = rawReplies.map(normalizeReply);
		}

		// Build the result
		const result: NotificationWithUser[] = [];

		for (const notification of allNotifications) {
			const triggeredByUser = notificationUsers.find((u) => u.id === notification.triggeredByUserId);

			if (triggeredByUser) {
				const { password, ...userWithoutPassword } = triggeredByUser;

				// Find related discussion or reply if any
				const discussion = notification.discussionId
					? relatedDiscussions.find((d) => d.id === notification.discussionId)
					: undefined;

				const reply = notification.replyId
					? relatedReplies.find((r) => r.id === notification.replyId)
					: undefined;

				result.push({
					...notification,
					triggeredByUser: userWithoutPassword,
					discussion,
					reply,
				});
			}
		}

		return result;
	}

	async getNotification(id: number): Promise<Notification | undefined> {
		const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
		return notification || undefined;
	}

	async markNotificationAsRead(id: number): Promise<Notification | undefined> {
		const [notification] = await db
			.update(notifications)
			.set({ isRead: true })
			.where(eq(notifications.id, id))
			.returning();
		return notification || undefined;
	}

	async markAllNotificationsAsRead(userId: number): Promise<boolean> {
		const result = await db
			.update(notifications)
			.set({ isRead: true })
			.where(eq(notifications.userId, userId))
			.returning();
		return result.length > 0;
	}

	async deleteNotification(id: number): Promise<boolean> {
		const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
		return result.length > 0;
	}

	async getUnreadNotificationsCount(userId: number): Promise<number> {
		const result = await db
			.select()
			.from(notifications)
			.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
		return result.length;
	}

	async markNotificationEmailSent(id: number): Promise<boolean> {
		const result = await db
			.update(notifications)
			.set({ emailSent: true })
			.where(eq(notifications.id, id))
			.returning();
		return result.length > 0;
	}

	async getPendingEmailNotifications(): Promise<NotificationWithUser[]> {
		const pendingNotifications = await db
			.select()
			.from(notifications)
			.where(and(eq(notifications.emailSent, false), eq(notifications.isRead, false)));

		if (pendingNotifications.length === 0) {
			return [];
		}

		const userIds = Array.from(
			new Set([
				...pendingNotifications.map((n) => n.triggeredByUserId),
				...pendingNotifications.map((n) => n.userId),
			])
		);

		// Get all related users
		const allUsers = await db.select().from(users).where(inArray(users.id, userIds));

		// Build the result with user info
		const result: NotificationWithUser[] = [];

		for (const notification of pendingNotifications) {
			const triggeredByUser = allUsers.find((u) => u.id === notification.triggeredByUserId);
			const recipient = allUsers.find((u) => u.id === notification.userId);

			if (triggeredByUser && recipient && recipient.email && recipient.emailNotifications) {
				const { password: pw1, ...userWithoutPassword } = triggeredByUser;

				result.push({
					...notification,
					triggeredByUser: userWithoutPassword,
				});
			}
		}

		return result;
	}

	// Ensure the `user` details are included in the response
	async getBookmarkedDiscussions(userId: number) {
		// console.log("getBookmarkedDiscussions called with userId:", userId);
		// console.log("Checking db object:", db);

		try {
			const result = await db
				.select()
				.from(discussions)
				.innerJoin(bookmarks, eq(discussions.id, bookmarks.discussionId))
				.innerJoin(users, eq(discussions.userId, users.id))
				.where(eq(bookmarks.userId, userId));

      // console.log("Query result with users:", result);
      return result.map(({ discussions, users, bookmarks }) => ({
        ...discussions,
        user: users,
        bookmark: bookmarks,
      }));
    } catch (error) {
      console.error("Error executing getBookmarkedDiscussions query:", error);
      throw error;
    }
  }

  async removeBookmark(userId: number, disscussionID: number) {
    try {
      const results = await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.discussionId, disscussionID),
          ),
        );
      console.log(results);
      return results;
    } catch (error) {
      console.error("Error executing deleteBookmard query:", error);
      throw error;
    }
  }

	// Update the addBookmark method to upsert (insert or update) the bookmark
	async addBookmark({
		userId,
		discussionId,
		saveDiscussionThread,
	}: {
		userId: number;
		discussionId: number;
		saveDiscussionThread: boolean;
	}) {
		try {
			// Check if bookmark exists
			const [existing] = await db
				.select()
				.from(bookmarks)
				.where(
					and(
						eq(bookmarks.userId, userId),
						eq(bookmarks.discussionId, discussionId)
					)
				);
			if (existing) {
				// Update saveDiscussionThread value
				const [updated] = await db
					.update(bookmarks)
					.set({ saveDiscussionThread })
					.where(
						and(
							eq(bookmarks.userId, userId),
							eq(bookmarks.discussionId, discussionId)
						)
					)
					.returning();
				return updated;
			} else {
				// Insert new bookmark
				const result = await db.execute(
					sql`INSERT INTO bookmarks (user_id, discussion_id, save_discussion_thread) VALUES (${userId}, ${discussionId}, ${saveDiscussionThread}) RETURNING *`
				);
				return result.rows[0];
			}
		} catch (error) {
			console.error("Error executing addBookmark query:", error);
			throw error;
		}
	}
}
