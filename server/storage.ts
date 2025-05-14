import {
  users,
  discussions,
  replies,
  helpfulMarks,
  notifications,
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
  type DiscussionWithUser,
  type ReplyWithUser,
  type DiscussionWithDetails,
  type NotificationWithUser
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined>;
  getOnlineUsers(): Promise<number>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;

  // Discussion operations
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  getDiscussions(filter?: string): Promise<DiscussionWithUser[]>;
  getDiscussionById(id: number): Promise<DiscussionWithDetails | undefined>;
  updateDiscussion(id: number, discussion: Partial<InsertDiscussion>): Promise<Discussion | undefined>;
  deleteDiscussion(id: number): Promise<boolean>;
  
  // Reply operations
  createReply(reply: InsertReply): Promise<Reply>;
  getReplyById(id: number): Promise<Reply | undefined>;
  getRepliesByDiscussionId(discussionId: number): Promise<ReplyWithUser[]>;
  updateReply(id: number, reply: Partial<InsertReply>): Promise<Reply | undefined>;
  deleteReply(id: number): Promise<boolean>;
  
  // Helpful marks
  markAsHelpful(mark: InsertHelpfulMark): Promise<HelpfulMark>;
  removeHelpfulMark(userId: number, discussionId?: number, replyId?: number): Promise<boolean>;
  isMarkedAsHelpful(userId: number, discussionId?: number, replyId?: number): Promise<boolean>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<NotificationWithUser[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationEmailSent(id: number): Promise<boolean>;
  getPendingEmailNotifications(): Promise<NotificationWithUser[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private discussions: Map<number, Discussion>;
  private replies: Map<number, Reply>;
  private helpfulMarks: Map<number, HelpfulMark>;
  private notifications: Map<number, Notification>;
  private userIdCounter: number;
  private discussionIdCounter: number;
  private replyIdCounter: number;
  private helpfulIdCounter: number;
  private notificationIdCounter: number;

  constructor() {
    this.users = new Map();
    this.discussions = new Map();
    this.replies = new Map();
    this.helpfulMarks = new Map();
    this.notifications = new Map();
    this.userIdCounter = 1;
    this.discussionIdCounter = 1;
    this.replyIdCounter = 1;
    this.helpfulIdCounter = 1;
    this.notificationIdCounter = 1;

    // Add some initial users for testing
    this.createUser({ username: "emma", password: "password123" });
    this.createUser({ username: "michael", password: "password123" });
    this.createUser({ username: "sarah", password: "password123" });
    this.createUser({ username: "alex", password: "password123" });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      user => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      ...insertUser,
      id,
      isOnline: false,
      lastSeen: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      isOnline,
      lastSeen: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getOnlineUsers(): Promise<number> {
    return Array.from(this.users.values()).filter(user => user.isOnline).length;
  }

  // Discussion operations
  async createDiscussion(insertDiscussion: InsertDiscussion): Promise<Discussion> {
    const id = this.discussionIdCounter++;
    const discussion: Discussion = {
      ...insertDiscussion,
      id,
      helpfulCount: 0,
      createdAt: new Date(),
      imagePath: insertDiscussion.imagePath || null
    };
    this.discussions.set(id, discussion);
    return discussion;
  }

  async getDiscussions(filter: string = 'recent'): Promise<DiscussionWithUser[]> {
    const discussions = Array.from(this.discussions.values());
    const discussionsWithUsers: DiscussionWithUser[] = [];

    for (const discussion of discussions) {
      const user = await this.getUser(discussion.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        discussionsWithUsers.push({
          ...discussion,
          user: userWithoutPassword
        });
      }
    }

    // Apply filters
    switch (filter) {
      case 'helpful':
        return discussionsWithUsers.sort((a, b) => {
          const aCount = a.helpfulCount || 0;
          const bCount = b.helpfulCount || 0;
          return bCount - aCount;
        });
      case 'my':
        // This would normally filter by the current user, but we'll skip that for now
        return discussionsWithUsers;
      case 'recent':
      default:
        return discussionsWithUsers.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  }

  async getDiscussionById(id: number): Promise<DiscussionWithDetails | undefined> {
    const discussion = this.discussions.get(id);
    if (!discussion) return undefined;

    const user = await this.getUser(discussion.userId);
    if (!user) return undefined;

    const { password, ...userWithoutPassword } = user;
    const replies = await this.getRepliesByDiscussionId(id);

    return {
      ...discussion,
      user: userWithoutPassword,
      replies
    };
  }

  async updateDiscussion(id: number, partialDiscussion: Partial<InsertDiscussion>): Promise<Discussion | undefined> {
    const discussion = this.discussions.get(id);
    if (!discussion) return undefined;

    const updatedDiscussion: Discussion = {
      ...discussion,
      ...partialDiscussion
    };
    this.discussions.set(id, updatedDiscussion);
    return updatedDiscussion;
  }

  async deleteDiscussion(id: number): Promise<boolean> {
    // Delete all related replies and helpful marks first
    const replyIds = Array.from(this.replies.values())
      .filter(reply => reply.discussionId === id)
      .map(reply => reply.id);

    for (const replyId of replyIds) {
      await this.deleteReply(replyId);
    }

    // Delete helpful marks for this discussion
    const helpfulMarksToDelete = Array.from(this.helpfulMarks.values())
      .filter(mark => mark.discussionId === id);

    for (const mark of helpfulMarksToDelete) {
      this.helpfulMarks.delete(mark.id);
    }

    return this.discussions.delete(id);
  }

  // Reply operations
  async createReply(insertReply: InsertReply): Promise<Reply> {
    const id = this.replyIdCounter++;
    const reply: Reply = {
      ...insertReply,
      id,
      helpfulCount: 0,
      createdAt: new Date(),
      imagePath: insertReply.imagePath || null,
      parentId: insertReply.parentId || null
    };
    this.replies.set(id, reply);
    return reply;
  }

  async getReplyById(id: number): Promise<Reply | undefined> {
    return this.replies.get(id);
  }

  async getRepliesByDiscussionId(discussionId: number): Promise<ReplyWithUser[]> {
    const allReplies = Array.from(this.replies.values())
      .filter(reply => reply.discussionId === discussionId);
    
    // Get all top-level replies (no parentId)
    const topReplies = allReplies.filter(reply => !reply.parentId);
    
    // Create a map of replies with their users
    const repliesWithUsers: ReplyWithUser[] = [];
    
    for (const reply of topReplies) {
      const user = await this.getUser(reply.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        const replyWithUser: ReplyWithUser = {
          ...reply,
          user: userWithoutPassword,
          childReplies: []
        };
        
        // Get child replies recursively
        replyWithUser.childReplies = await this.getChildReplies(reply.id, allReplies);
        
        repliesWithUsers.push(replyWithUser);
      }
    }
    
    return repliesWithUsers.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
  
  private async getChildReplies(parentId: number, allReplies: Reply[]): Promise<ReplyWithUser[]> {
    const childReplies = allReplies.filter(reply => reply.parentId === parentId);
    const childRepliesWithUsers: ReplyWithUser[] = [];
    
    for (const reply of childReplies) {
      const user = await this.getUser(reply.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        const replyWithUser: ReplyWithUser = {
          ...reply,
          user: userWithoutPassword,
          childReplies: []
        };
        
        // Get nested replies recursively
        replyWithUser.childReplies = await this.getChildReplies(reply.id, allReplies);
        
        childRepliesWithUsers.push(replyWithUser);
      }
    }
    
    return childRepliesWithUsers.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async updateReply(id: number, partialReply: Partial<InsertReply>): Promise<Reply | undefined> {
    const reply = this.replies.get(id);
    if (!reply) return undefined;

    const updatedReply: Reply = {
      ...reply,
      ...partialReply
    };
    this.replies.set(id, updatedReply);
    return updatedReply;
  }

  async deleteReply(id: number): Promise<boolean> {
    // Delete all child replies first
    const childReplyIds = Array.from(this.replies.values())
      .filter(reply => reply.parentId === id)
      .map(reply => reply.id);

    for (const childId of childReplyIds) {
      await this.deleteReply(childId);
    }

    // Delete helpful marks for this reply
    const helpfulMarksToDelete = Array.from(this.helpfulMarks.values())
      .filter(mark => mark.replyId === id);

    for (const mark of helpfulMarksToDelete) {
      this.helpfulMarks.delete(mark.id);
    }

    return this.replies.delete(id);
  }

  // Helpful marks
  async markAsHelpful(insertMark: InsertHelpfulMark): Promise<HelpfulMark> {
    // Check if mark already exists
    const existingMark = Array.from(this.helpfulMarks.values()).find(
      mark => 
        mark.userId === insertMark.userId &&
        mark.discussionId === insertMark.discussionId &&
        mark.replyId === insertMark.replyId
    );

    if (existingMark) {
      return existingMark;
    }

    const id = this.helpfulIdCounter++;
    const mark: HelpfulMark = {
      ...insertMark,
      id,
      createdAt: new Date(),
      discussionId: insertMark.discussionId || null,
      replyId: insertMark.replyId || null
    };
    this.helpfulMarks.set(id, mark);

    // Update helpful count on discussion or reply
    if (insertMark.discussionId) {
      const discussion = this.discussions.get(insertMark.discussionId);
      if (discussion) {
        discussion.helpfulCount = (discussion.helpfulCount || 0) + 1;
        this.discussions.set(discussion.id, discussion);
      }
    } else if (insertMark.replyId) {
      const reply = this.replies.get(insertMark.replyId);
      if (reply) {
        reply.helpfulCount = (reply.helpfulCount || 0) + 1;
        this.replies.set(reply.id, reply);
      }
    }

    return mark;
  }

  async removeHelpfulMark(userId: number, discussionId?: number, replyId?: number): Promise<boolean> {
    const markToDelete = Array.from(this.helpfulMarks.values()).find(
      mark => 
        mark.userId === userId &&
        mark.discussionId === discussionId &&
        mark.replyId === replyId
    );

    if (!markToDelete) return false;

    // Update helpful count on discussion or reply
    if (markToDelete.discussionId) {
      const discussion = this.discussions.get(markToDelete.discussionId);
      if (discussion) {
        discussion.helpfulCount = Math.max(0, (discussion.helpfulCount || 0) - 1);
        this.discussions.set(discussion.id, discussion);
      }
    } else if (markToDelete.replyId) {
      const reply = this.replies.get(markToDelete.replyId);
      if (reply) {
        reply.helpfulCount = Math.max(0, (reply.helpfulCount || 0) - 1);
        this.replies.set(reply.id, reply);
      }
    }

    return this.helpfulMarks.delete(markToDelete.id);
  }

  async isMarkedAsHelpful(userId: number, discussionId?: number, replyId?: number): Promise<boolean> {
    return Array.from(this.helpfulMarks.values()).some(
      mark => 
        mark.userId === userId &&
        mark.discussionId === discussionId &&
        mark.replyId === replyId
    );
  }

  // User profile updates
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) {
      return undefined;
    }

    const updatedUser: User = {
      ...user,
      ...userData,
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const now = new Date();
    
    const newNotification: Notification = {
      id,
      userId: notification.userId,
      triggeredByUserId: notification.triggeredByUserId,
      discussionId: notification.discussionId ?? null,
      replyId: notification.replyId ?? null,
      type: notification.type,
      message: notification.message,
      isRead: false,
      emailSent: false,
      createdAt: now,
    };
    
    this.notifications.set(id, newNotification);
    return newNotification;
  }
  
  async getNotifications(userId: number): Promise<NotificationWithUser[]> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    const result: NotificationWithUser[] = [];
    
    for (const notification of userNotifications) {
      const triggeredByUser = this.users.get(notification.triggeredByUserId);
      if (!triggeredByUser) continue;
      
      const { password, ...userWithoutPassword } = triggeredByUser;
      
      let discussion: Discussion | undefined;
      if (notification.discussionId) {
        discussion = this.discussions.get(notification.discussionId);
      }
      
      let reply: Reply | undefined;
      if (notification.replyId) {
        reply = this.replies.get(notification.replyId);
      }
      
      result.push({
        ...notification,
        triggeredByUser: userWithoutPassword,
        discussion,
        reply,
      });
    }
    
    return result;
  }
  
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) {
      return undefined;
    }
    
    const updatedNotification: Notification = {
      ...notification,
      isRead: true,
    };
    
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);
    
    if (userNotifications.length === 0) {
      return false;
    }
    
    for (const notification of userNotifications) {
      this.notifications.set(notification.id, {
        ...notification,
        isRead: true,
      });
    }
    
    return true;
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    return this.notifications.delete(id);
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && !notification.isRead)
      .length;
  }
  
  async markNotificationEmailSent(id: number): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) {
      return false;
    }
    
    this.notifications.set(id, {
      ...notification,
      emailSent: true,
    });
    
    return true;
  }
  
  async getPendingEmailNotifications(): Promise<NotificationWithUser[]> {
    const pendingNotifications = Array.from(this.notifications.values())
      .filter(notification => !notification.emailSent)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    const result: NotificationWithUser[] = [];
    
    for (const notification of pendingNotifications) {
      const user = this.users.get(notification.userId);
      const triggeredByUser = this.users.get(notification.triggeredByUserId);
      
      if (!user || !triggeredByUser || !user.email) continue;
      
      const { password: _, ...userWithoutPassword } = triggeredByUser;
      
      let discussion: Discussion | undefined;
      if (notification.discussionId) {
        discussion = this.discussions.get(notification.discussionId);
      }
      
      let reply: Reply | undefined;
      if (notification.replyId) {
        reply = this.replies.get(notification.replyId);
      }
      
      result.push({
        ...notification,
        triggeredByUser: userWithoutPassword,
        discussion,
        reply,
      });
    }
    
    return result;
  }
}

// Import the DatabaseStorage class
import { DatabaseStorage } from "./databaseStorage";

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
