import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session"; // Add session middleware
import { 
  insertUserSchema, 
  insertDiscussionSchema, 
  insertReplySchema,
  insertHelpfulMarkSchema,
  insertNotificationSchema
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import { sendEmail, generateReplyNotificationEmail, generateHelpfulNotificationEmail } from "./emailService";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage2 = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage: storage2,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG and GIF are allowed.") as any);
    }
  },
});

// WebSocket clients for online status tracking
const clients = new Map<string, { userId: number; lastSeen: Date }>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Ensure session middleware is used
  app.use(
    session({
      secret: "your-secret-key", // Replace with a secure secret key
      resave: false,
      saveUninitialized: true,
    })
  );

  // Temporarily disable WebSocket for troubleshooting
  console.log("WebSocket functionality is temporarily disabled for troubleshooting");

  // Set default online count to 1 for testing
  //await storage.updateUserOnlineStatus(1, true);

  // --- REMOVE TEST ROUTES AND DEBUG LOGGING ---
  // (No /api/test route, no debug logs)

  // API Routes
  // Auth routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(validatedData);
      
      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set user as online
      await storage.updateUserOnlineStatus(user.id, true);
      
      // Don't return password in response
      const { password: _, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      await new Promise <void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      await storage.updateUserOnlineStatus(userId, false);
      req.session.userId = null;
      await new Promise <void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Online users count
  app.get("/api/users/online", async (_req: Request, res: Response) => {
    try {
      const count = await storage.getOnlineUsers();
      res.status(200).json({ count });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  // Get total user count
  app.get("/api/users/count", async (_req: Request, res: Response) => {
    try {
      const count = await storage.getTotalUserCount();
      res.status(200).json({ count });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  // Discussion routes
  app.get("/api/discussions", async (req: Request, res: Response) => {
    try {
      const filter = req.query.filter as string || "recent";
      const discussions = await storage.getDiscussions(filter);
      res.status(200).json(discussions);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.get("/api/discussions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid discussion ID" });
      }
      
      const discussion = await storage.getDiscussionById(id);
      
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      res.status(200).json(discussion);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.post("/api/discussions", upload.single("image"), async (req: Request, res: Response) => {
    try {
      console.log("POST /api/discussions request body:", req.body);
      console.log("POST /api/discussions file:", req.file);
      
      const data = {
        ...req.body,
        userId: parseInt(req.body.userId),
        imagePath: req.file ? `/uploads/${req.file.filename}` : null
      };
      
      console.log("Data prepared for validation:", data);
      
      const validatedData = insertDiscussionSchema.parse(data);
      const discussion = await storage.createDiscussion(validatedData);
      res.status(201).json(discussion);
    } catch (error) {
      console.error("Error creating discussion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.patch("/api/discussions/:id", upload.single("image"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid discussion ID" });
      }
      
      const discussion = await storage.getDiscussionById(id);
      
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      // Check if the user is the owner of the discussion
      if (discussion.userId !== parseInt(req.body.userId)) {
        return res.status(403).json({ message: "You can only edit your own discussions" });
      }
      
      console.log("PATCH /api/discussions/:id request body:", req.body);
      console.log("PATCH /api/discussions/:id file:", req.file);
      
      const data = {
        ...req.body,
        userId: parseInt(req.body.userId),
        imagePath: req.file ? `/uploads/${req.file.filename}` : discussion.imagePath
      };
      
      console.log("Data prepared for update:", data);
      
      const updatedDiscussion = await storage.updateDiscussion(id, data);
      res.status(200).json(updatedDiscussion);
    } catch (error) {
      console.error("Error updating discussion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.delete("/api/discussions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = parseInt(req.body.userId);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid discussion ID" });
      }
      
      const discussion = await storage.getDiscussionById(id);
      
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      // Check if the user is the owner of the discussion
      if (discussion.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own discussions" });
      }
      
      await storage.deleteDiscussion(id);
      res.status(200).json({ message: "Discussion deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Reply routes
  app.post("/api/replies", upload.single("image"), async (req: Request, res: Response) => {
    try {
      console.log("POST /api/replies request body:", req.body);
      console.log("POST /api/replies file:", req.file);
      
      const data = {
        ...req.body,
        userId: parseInt(req.body.userId),
        discussionId: parseInt(req.body.discussionId),
        parentId: req.body.parentId ? parseInt(req.body.parentId) : null,
        imagePath: req.file ? `/uploads/${req.file.filename}` : null
      };
      
      console.log("Data prepared for validation:", data);
      
      const validatedData = insertReplySchema.parse(data);
      const reply = await storage.createReply(validatedData);
      
      // Get the reply with user data
      const user = await storage.getUser(reply.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create notification for the discussion creator
      const discussion = await storage.getDiscussionById(reply.discussionId);
      if (discussion && discussion.userId !== reply.userId) {
        // If replying to someone else's discussion
        try {
          const notificationData = {
            userId: discussion.userId,
            triggeredByUserId: reply.userId,
            discussionId: discussion.id,
            replyId: reply.id,
            type: 'reply',
            message: `${user.username} replied to your discussion "${discussion.title}"`,
          };
          
          const notification = await storage.createNotification(notificationData);
          
          // Send email notification if the user has email and notifications enabled
          const discussionCreator = await storage.getUser(discussion.userId);
          if (discussionCreator && discussionCreator.email && discussionCreator.emailNotifications) {
            const emailContent = generateReplyNotificationEmail(
              discussionCreator.username,
              user.username,
              discussion.title,
              reply.content,
              discussion.id
            );
            
            await sendEmail(
              discussionCreator.email,
              `New reply to your discussion: ${discussion.title}`,
              emailContent.text,
              emailContent.html
            );
            
            await storage.markNotificationEmailSent(notification.id);
          }
        } catch (error) {
          console.error("Error creating notification:", error);
          // Don't fail the whole request if notification creation fails
        }
      }
      
      // If it's a reply to another reply, notify that person too
      if (reply.parentId) {
        const parentReply = await storage.getReplyById(reply.parentId);
        if (parentReply && parentReply.userId !== reply.userId) {
          try {
            const notificationData = {
              userId: parentReply.userId,
              triggeredByUserId: reply.userId,
              discussionId: reply.discussionId,
              replyId: reply.id,
              type: 'reply',
              message: `${user.username} replied to your comment`,
            };
            
            const notification = await storage.createNotification(notificationData);
            
            // Send email notification
            const parentReplyCreator = await storage.getUser(parentReply.userId);
            if (parentReplyCreator && parentReplyCreator.email && parentReplyCreator.emailNotifications) {
              const emailContent = generateReplyNotificationEmail(
                parentReplyCreator.username,
                user.username,
                discussion?.title || "a discussion", // Fallback if discussion not found
                reply.content,
                reply.discussionId
              );
              
              await sendEmail(
                parentReplyCreator.email,
                `New reply to your comment`,
                emailContent.text,
                emailContent.html
              );
              
              await storage.markNotificationEmailSent(notification.id);
            }
          } catch (error) {
            console.error("Error creating notification for reply parent:", error);
          }
        }
      }
      
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({
        ...reply,
        user: userWithoutPassword,
        childReplies: []
      });
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.patch("/api/replies/:id", upload.single("image"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = parseInt(req.body.userId);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reply ID" });
      }
      
      // Get reply by ID
      const reply = await storage.getReplyById(id);
      
      if (!reply) {
        return res.status(404).json({ message: "Reply not found" });
      }
      
      // Check if the user is the owner of the reply
      if (reply.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own replies" });
      }
      
      const data = {
        ...req.body,
        content: req.body.content,
        imagePath: req.file ? `/uploads/${req.file.filename}` : reply.imagePath
      };
      
      const updatedReply = await storage.updateReply(id, data);
      res.status(200).json(updatedReply);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.delete("/api/replies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = parseInt(req.body.userId);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reply ID" });
      }
      
      // Get reply by ID
      const reply = await storage.getReplyById(id);
      
      if (!reply) {
        return res.status(404).json({ message: "Reply not found" });
      }
      
      // Check if the user is the owner of the reply
      if (reply.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own replies" });
      }
      
      await storage.deleteReply(id);
      res.status(200).json({ message: "Reply deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Helpful mark routes
  app.post("/api/helpful", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, replyId, type } = req.body; // type: 'upvote' | 'downvote'
      
      if (!userId || (!discussionId && !replyId) || !type) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      
      const data = {
        userId: parseInt(userId),
        discussionId: discussionId ? parseInt(discussionId) : undefined,
        replyId: replyId ? parseInt(replyId) : undefined,
        type
      };
      
      const mark = await storage.markAsHelpful(data);
      
      // Get the user who marked as helpful
      const markingUser = await storage.getUser(parseInt(userId));
      if (!markingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create notification based on whether it's for a discussion or reply
      try {
        if (discussionId) {
          const discussion = await storage.getDiscussionById(parseInt(discussionId));
          if (discussion && discussion.userId !== parseInt(userId)) {
            // Create notification for discussion author
            const notificationData = {
              userId: discussion.userId,
              triggeredByUserId: parseInt(userId),
              discussionId: parseInt(discussionId),
              replyId: null,
              type: 'helpful',
              message: `${markingUser.username} marked your discussion "${discussion.title}" as helpful`,
            };
            
            const notification = await storage.createNotification(notificationData);
            
            // Send email notification if user has email and notifications enabled
            const discussionOwner = await storage.getUser(discussion.userId);
            if (discussionOwner && discussionOwner.email && discussionOwner.emailNotifications) {
              const emailContent = generateHelpfulNotificationEmail(
                discussionOwner.username,
                markingUser.username,
                discussion.title,
                'discussion',
                discussion.id
              );
              
              await sendEmail(
                discussionOwner.email,
                `Your discussion was marked as helpful!`,
                emailContent.text,
                emailContent.html
              );
              
              await storage.markNotificationEmailSent(notification.id);
            }
          }
        } else if (replyId) {
          const reply = await storage.getReplyById(parseInt(replyId));
          if (reply && reply.userId !== parseInt(userId)) {
            // Get the parent discussion for context
            const discussion = await storage.getDiscussionById(reply.discussionId);
            
            // Create notification for reply author
            const notificationData = {
              userId: reply.userId,
              triggeredByUserId: parseInt(userId),
              discussionId: reply.discussionId,
              replyId: parseInt(replyId),
              type: 'helpful',
              message: `${markingUser.username} marked your reply as helpful`,
            };
            
            const notification = await storage.createNotification(notificationData);
            
            // Send email notification
            const replyOwner = await storage.getUser(reply.userId);
            if (replyOwner && replyOwner.email && replyOwner.emailNotifications) {
              const emailContent = generateHelpfulNotificationEmail(
                replyOwner.username,
                markingUser.username,
                discussion ? discussion.title : 'a discussion',
                'reply',
                reply.discussionId
              );
              
              await sendEmail(
                replyOwner.email,
                `Your reply was marked as helpful!`,
                emailContent.text,
                emailContent.html
              );
              
              await storage.markNotificationEmailSent(notification.id);
            }
          }
        }
      } catch (error) {
        console.error("Error creating helpful notification:", error);
        // Don't fail the request if notification creation fails
      }
      
      res.status(201).json(mark);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.delete("/api/helpful", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, replyId, type } = req.body;
      
      if (!userId || (!discussionId && !replyId) || !type) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      
      const result = await storage.removeHelpfulMark(
        parseInt(userId),
        discussionId ? parseInt(discussionId) : undefined,
        replyId ? parseInt(replyId) : undefined,
        type
      );
      
      if (!result) {
        return res.status(404).json({ message: "Helpful mark not found" });
      }
      
      res.status(200).json({ message: "Helpful mark removed successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.get("/api/helpful/check", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, replyId } = req.query;
      
      if (!userId || (!discussionId && !replyId)) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      
      const isMarked = await storage.isMarkedAsHelpful(
        parseInt(userId as string),
        discussionId ? parseInt(discussionId as string) : undefined,
        replyId ? parseInt(replyId as string) : undefined
      );
      
      res.status(200).json({ isMarked });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Bookmark routes
  app.post("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.body;

      if (!userId || !discussionId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      console.log("Checking if addBookmark exists on storage:", typeof storage.addBookmark);

      const bookmark = await storage.addBookmark({
        userId: parseInt(userId),
        discussionId: parseInt(discussionId),
      });

      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Error in /api/bookmarks endpoint:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.delete("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.body;

      if (!userId || !discussionId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      const result = await storage.removeBookmark(
        parseInt(userId),
        parseInt(discussionId)
      );

      if (!result) {
        return res.status(404).json({ message: "Bookmark not found" });
      }

      res.status(200).json({ message: "Bookmark removed successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.get("/api/bookmarks/check", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.query;

      if (!userId || !discussionId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      const isBookmarked = await storage.isBookmarked(
        parseInt(userId as string),
        parseInt(discussionId as string)
      );

      res.status(200).json({ isBookmarked });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      console.log("Checking if getBookmarkedDiscussions exists on storage:", typeof storage.getBookmarkedDiscussions);

      const bookmarkedDiscussions = await storage.getBookmarkedDiscussions(parseInt(userId as string));

      res.status(200).json(bookmarkedDiscussions);
    } catch (error) {
      console.error("Error in /api/bookmarks endpoint:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getNotifications(userId);
      res.status(200).json(notifications);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.get("/api/notifications/unread/count", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const count = await storage.getUnreadNotificationsCount(userId);
      res.status(200).json({ count });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      if (notification.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.status(200).json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.patch("/api/notifications/read/all", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  app.delete("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      if (notification.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteNotification(notificationId);
      res.status(200).json({ message: "Notification deleted" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  // User profile routes
  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { email, emailNotifications } = req.body;
      
      // We only allow updating these specific fields
      const userData: Partial<{ email: string | null, emailNotifications: boolean }> = {};
      
      if (email !== undefined) {
        userData.email = email;
      }
      
      if (emailNotifications !== undefined) {
        userData.emailNotifications = emailNotifications;
      }

      const updatedUser = await storage.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return the password
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));

  return httpServer;
}
