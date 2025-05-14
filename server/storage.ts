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

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined>;
  getOnlineUsers(): Promise<number>;

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private discussions: Map<number, Discussion>;
  private replies: Map<number, Reply>;
  private helpfulMarks: Map<number, HelpfulMark>;
  private userIdCounter: number;
  private discussionIdCounter: number;
  private replyIdCounter: number;
  private helpfulIdCounter: number;

  constructor() {
    this.users = new Map();
    this.discussions = new Map();
    this.replies = new Map();
    this.helpfulMarks = new Map();
    this.userIdCounter = 1;
    this.discussionIdCounter = 1;
    this.replyIdCounter = 1;
    this.helpfulIdCounter = 1;

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
    
    return repliesWithUsers.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
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
    
    return childRepliesWithUsers.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
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
}

export const storage = new MemStorage();
