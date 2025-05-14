import { eq, and, isNull, desc, asc, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  users,
  discussions,
  replies,
  helpfulMarks,
  type User,
  type InsertUser,
  type Discussion,
  type InsertDiscussion,
  type Reply,
  type InsertReply,
  type HelpfulMark,
  type InsertHelpfulMark,
  type DiscussionWithUser,
  type ReplyWithUser,
  type DiscussionWithDetails
} from "@shared/schema";
import { IStorage } from "./storage";

// Declare a userId variable for 'my' filter
declare global {
  var userId: number | undefined;
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
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ isOnline })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async getOnlineUsers(): Promise<number> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.isOnline, true));
    return result.length;
  }

  // Discussion operations
  async createDiscussion(insertDiscussion: InsertDiscussion): Promise<Discussion> {
    const [discussion] = await db
      .insert(discussions)
      .values({
        ...insertDiscussion,
        imagePath: insertDiscussion.imagePath || null
      })
      .returning();
    return discussion;
  }

  async getDiscussions(filter: string = 'recent'): Promise<DiscussionWithUser[]> {
    const allDiscussions = await db.select().from(discussions);
    const userIds = Array.from(new Set(allDiscussions.map(d => d.userId)));
    
    let allUsers: User[] = [];
    if (userIds.length > 0) {
      allUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
    }
    
    const discussionsWithUsers: DiscussionWithUser[] = [];
    
    for (const discussion of allDiscussions) {
      const user = allUsers.find(u => u.id === discussion.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        discussionsWithUsers.push({
          ...discussion,
          user: userWithoutPassword
        });
      }
    }
    
    if (filter === 'helpful') {
      discussionsWithUsers.sort((a, b) => {
        const aCount = a.helpfulCount || 0;
        const bCount = b.helpfulCount || 0;
        return bCount - aCount;
      });
    } else if (filter === 'my' && global.userId) {
      return discussionsWithUsers.filter(d => d.userId === global.userId);
    } else {
      // Default to 'recent'
      discussionsWithUsers.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    }
    
    return discussionsWithUsers;
  }

  async getDiscussionById(id: number): Promise<DiscussionWithDetails | undefined> {
    const [discussion] = await db
      .select()
      .from(discussions)
      .where(eq(discussions.id, id));
    
    if (!discussion) return undefined;
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, discussion.userId));
    
    if (!user) return undefined;
    
    const { password, ...userWithoutPassword } = user;
    
    const allReplies = await db
      .select()
      .from(replies)
      .where(eq(replies.discussionId, id));
    
    const userIds = Array.from(new Set(allReplies.map(r => r.userId)));
    
    let replyUsers: User[] = [];
    if (userIds.length > 0) {
      replyUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
    }
    
    const repliesWithUsers: ReplyWithUser[] = [];
    const topLevelReplies = allReplies.filter(r => r.parentId === null);
    
    for (const reply of topLevelReplies) {
      const replyUser = replyUsers.find(u => u.id === reply.userId);
      if (replyUser) {
        const { password, ...userWithoutPassword } = replyUser;
        const childReplies = this.buildReplyTree(reply.id, allReplies, replyUsers);
        
        repliesWithUsers.push({
          ...reply,
          user: userWithoutPassword,
          childReplies
        });
      }
    }
    
    return {
      ...discussion,
      user: userWithoutPassword,
      replies: repliesWithUsers
    };
  }

  private buildReplyTree(parentId: number, allReplies: Reply[], replyUsers: User[]): ReplyWithUser[] {
    const childReplies: ReplyWithUser[] = [];
    const directChildren = allReplies.filter(r => r.parentId === parentId);
    
    for (const child of directChildren) {
      const childUser = replyUsers.find(u => u.id === child.userId);
      if (childUser) {
        const { password, ...userWithoutPassword } = childUser;
        const nestedChildren = this.buildReplyTree(child.id, allReplies, replyUsers);
        
        childReplies.push({
          ...child,
          user: userWithoutPassword,
          childReplies: nestedChildren
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
        imagePath: partialDiscussion.imagePath || null
      })
      .where(eq(discussions.id, id))
      .returning();
    return updatedDiscussion || undefined;
  }

  async deleteDiscussion(id: number): Promise<boolean> {
    // First delete all replies related to this discussion
    await db
      .delete(replies)
      .where(eq(replies.discussionId, id));
    
    // Delete helpful marks for this discussion
    await db
      .delete(helpfulMarks)
      .where(eq(helpfulMarks.discussionId, id));
    
    // Then delete the discussion
    const result = await db
      .delete(discussions)
      .where(eq(discussions.id, id))
      .returning();
    
    return result.length > 0;
  }
  
  // Reply operations
  async createReply(insertReply: InsertReply): Promise<Reply> {
    const [reply] = await db
      .insert(replies)
      .values({
        ...insertReply,
        parentId: insertReply.parentId || null,
        imagePath: insertReply.imagePath || null
      })
      .returning();
    return reply;
  }

  async getReplyById(id: number): Promise<Reply | undefined> {
    const [reply] = await db
      .select()
      .from(replies)
      .where(eq(replies.id, id));
    return reply || undefined;
  }

  async getRepliesByDiscussionId(discussionId: number): Promise<ReplyWithUser[]> {
    const allReplies = await db
      .select()
      .from(replies)
      .where(eq(replies.discussionId, discussionId));
    
    const userIds = Array.from(new Set(allReplies.map(r => r.userId)));
    
    let replyUsers: User[] = [];
    if (userIds.length > 0) {
      replyUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
    }
    
    const topLevelReplies = allReplies.filter(r => r.parentId === null);
    const result: ReplyWithUser[] = [];
    
    for (const reply of topLevelReplies) {
      const user = replyUsers.find(u => u.id === reply.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        const childReplies = this.buildReplyTree(reply.id, allReplies, replyUsers);
        
        result.push({
          ...reply,
          user: userWithoutPassword,
          childReplies
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
        imagePath: partialReply.imagePath || null
      })
      .where(eq(replies.id, id))
      .returning();
    return updatedReply || undefined;
  }

  async deleteReply(id: number): Promise<boolean> {
    // First delete helpful marks for this reply
    await db
      .delete(helpfulMarks)
      .where(eq(helpfulMarks.replyId, id));
    
    // Then delete the reply
    const result = await db
      .delete(replies)
      .where(eq(replies.id, id))
      .returning();
    
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
          insertMark.replyId 
            ? eq(helpfulMarks.replyId, insertMark.replyId) 
            : isNull(helpfulMarks.replyId)
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
        replyId: insertMark.replyId || null
      })
      .returning();
    
    // Update helpful count
    if (mark.discussionId) {
      await db
        .update(discussions)
        .set({
          helpfulCount: sql`${discussions.helpfulCount} + 1`
        })
        .where(eq(discussions.id, mark.discussionId));
    } else if (mark.replyId) {
      await db
        .update(replies)
        .set({
          helpfulCount: sql`${replies.helpfulCount} + 1`
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
          discussionId 
            ? eq(helpfulMarks.discussionId, discussionId) 
            : isNull(helpfulMarks.discussionId),
          replyId 
            ? eq(helpfulMarks.replyId, replyId) 
            : isNull(helpfulMarks.replyId)
        )
      );
    
    if (marks.length === 0) return false;
    const markToDelete = marks[0];
    
    // Update helpful count
    if (markToDelete.discussionId) {
      await db
        .update(discussions)
        .set({
          helpfulCount: sql`GREATEST(${discussions.helpfulCount} - 1, 0)`
        })
        .where(eq(discussions.id, markToDelete.discussionId));
    } else if (markToDelete.replyId) {
      await db
        .update(replies)
        .set({
          helpfulCount: sql`GREATEST(${replies.helpfulCount} - 1, 0)`
        })
        .where(eq(replies.id, markToDelete.replyId));
    }
    
    // Delete the mark
    const result = await db
      .delete(helpfulMarks)
      .where(eq(helpfulMarks.id, markToDelete.id))
      .returning();
    
    return result.length > 0;
  }

  async isMarkedAsHelpful(userId: number, discussionId?: number, replyId?: number): Promise<boolean> {
    const marks = await db
      .select()
      .from(helpfulMarks)
      .where(
        and(
          eq(helpfulMarks.userId, userId),
          discussionId 
            ? eq(helpfulMarks.discussionId, discussionId) 
            : isNull(helpfulMarks.discussionId),
          replyId 
            ? eq(helpfulMarks.replyId, replyId) 
            : isNull(helpfulMarks.replyId)
        )
      );
    
    return marks.length > 0;
  }
}