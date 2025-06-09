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
  insertNotificationSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import {
  sendEmail,
  generateReplyNotificationEmail,
  generateHelpfulNotificationEmail,
} from "./emailService";
import cloudinary from "./cloudinary";
import streamifier from "streamifier";

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
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG and GIF are allowed.",
        ) as any,
      );
    }
  },
});

// Helper to upload buffer to Cloudinary
async function uploadToCloudinary(file: Express.Multer.File) {
  return new Promise<{ url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "forum_uploads" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url });
      },
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

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
    }),
  );

  // Temporarily disable WebSocket for troubleshooting
  console.log(
    "WebSocket functionality is temporarily disabled for troubleshooting",
  );

  // Set default online count to 1 for testing
  await storage.updateUserOnlineStatus(1, true);

  // API Routes
  // Auth routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(
        validatedData.username,
      );
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(validatedData);

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res
          .status(400)
          .json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      // Set user as online
      await storage.updateUserOnlineStatus(user.id, true);

      // Don't return password in response
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      await storage.updateUserOnlineStatus(userId, false);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Online users count
  app.get("/api/users/online", async (_req: Request, res: Response) => {
    try {
      const count = await storage.getOnlineUsers();
      res.status(200).json({ count });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Server error",
      });
    }
  });

  // Discussion routes
  app.get("/api/discussions", async (req: Request, res: Response) => {
    try {
      const filter = (req.query.filter as string) || "recent";
      const discussions = await storage.getDiscussions(filter);
      res.status(200).json(discussions);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Server error",
      });
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
      res.status(500).json({
        message: error instanceof Error ? error.message : "Server error",
      });
    }
  });

  app.post(
    "/api/discussions",
    upload.array("images", 20), // allow up to 20 images
    async (req: Request, res: Response) => {
      // Debug logging for troubleshooting Multer issues
     // console.log("[DEBUG] /api/discussions req.files:", req.files);
      //console.log("[DEBUG] /api/discussions req.body:", req.body);
      try {
        const files = req.files as Express.Multer.File[];
        let imagePaths: string[] = [];
        if (files && files.length > 0) {
          imagePaths = await Promise.all(
            files.map((file) => uploadToCloudinary(file).then((r) => r.url)),
          );
        }
        // Captions: support array or single string
        let captions: string[] = [];
        if (Array.isArray(req.body.captions)) {
          captions = req.body.captions;
        } else if (typeof req.body.captions === "string") {
          captions = [req.body.captions];
        }
        const data = {
          ...req.body,
          userId: parseInt(req.body.userId),
          imagePaths,
          captions,
        };
        const validatedData = insertDiscussionSchema.parse(data);
        const discussion = await storage.createDiscussion(validatedData);
        res.status(201).json(discussion);
      } catch (error) {
        console.error("[ERROR] /api/discussions:", error);
        res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid request",
        });
      }
    },
  );

  app.patch(
    "/api/discussions/:id",
    upload.array("images", 5),
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
          return res.status(400).json({ message: "Invalid discussion ID" });
        const discussion = await storage.getDiscussionById(id);
        if (!discussion)
          return res.status(404).json({ message: "Discussion not found" });
        if (discussion.userId !== parseInt(req.body.userId)) {
          return res
            .status(403)
            .json({ message: "You can only edit your own discussions" });
        }
        const files = req.files as Express.Multer.File[];
        // Support for editing images: merge existing and new
        let imagePaths: string[] = [];
        let captions: string[] = [];
        // Existing images/captions (kept by user)
        if (Array.isArray(req.body.existingImagePaths)) {
          imagePaths = req.body.existingImagePaths;
        } else if (typeof req.body.existingImagePaths === "string") {
          imagePaths = [req.body.existingImagePaths];
        }
        if (Array.isArray(req.body.existingCaptions)) {
          captions = req.body.existingCaptions;
        } else if (typeof req.body.existingCaptions === "string") {
          captions = [req.body.existingCaptions];
        }
        // New images/captions
        let newCaptions: string[] = [];
        if (Array.isArray(req.body.captions)) {
          newCaptions = req.body.captions;
        } else if (typeof req.body.captions === "string") {
          newCaptions = [req.body.captions];
        }
        if (files && files.length > 0) {
          const newPaths = await Promise.all(
            files.map((file) => uploadToCloudinary(file).then((r) => r.url)),
          );
          imagePaths = imagePaths.concat(newPaths);
        }
        // --- FIX: Always merge captions to match imagePaths length ---
        // captions = captions.concat(newCaptions);
        // If all images are removed, captions should be empty too
        // if (imagePaths.length === 0) captions = [];
        // --- New logic below ---
        // Merge captions so that captions array always matches imagePaths
        // (existingImages + newImages)
        let mergedCaptions: string[] = [];
        // Add captions for existing images
        for (let i = 0; i < imagePaths.length - (files?.length || 0); i++) {
          mergedCaptions.push(captions[i] || "");
        }
        // Add captions for new images
        for (let i = 0; i < (files?.length || 0); i++) {
          mergedCaptions.push(newCaptions[i] || "");
        }
        // If all images are removed, captions should be empty
        if (imagePaths.length === 0) mergedCaptions = [];
        const data = {
          ...req.body,
          userId: parseInt(req.body.userId),
          imagePaths,
          captions: mergedCaptions,
        };
        const updatedDiscussion = await storage.updateDiscussion(id, data);
        res.status(200).json(updatedDiscussion);
      } catch (error) {
        res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid request",
        });
      }
    },
  );

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
        return res
          .status(403)
          .json({ message: "You can only delete your own discussions" });
      }

      await storage.deleteDiscussion(id);
      res.status(200).json({ message: "Discussion deleted successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Reply routes
  app.post(
    "/api/replies",
    upload.array("images", 5),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        let imagePaths: string[] = [];
        if (files && files.length > 0) {
          imagePaths = await Promise.all(
            files.map((file) => uploadToCloudinary(file).then((r) => r.url)),
          );
        }
        // Captions: support array or single string
        let captions: string[] = [];
        if (Array.isArray(req.body.captions)) {
          captions = req.body.captions;
        } else if (typeof req.body.captions === "string") {
          captions = [req.body.captions];
        }
        const data = {
          ...req.body,
          userId: parseInt(req.body.userId),
          discussionId: parseInt(req.body.discussionId),
          imagePaths,
          captions,
        };
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
              type: "reply",
              message: `${user.username} replied to your discussion "${discussion.title}"`,
            };

            const notification =
              await storage.createNotification(notificationData);

            // Send email notification if the user has email and notifications enabled
            const discussionCreator = await storage.getUser(discussion.userId);
            if (
              discussionCreator &&
              discussionCreator.email &&
              discussionCreator.emailNotifications
            ) {
              const emailContent = generateReplyNotificationEmail(
                discussionCreator.username,
                user.username,
                discussion.title,
                reply.content,
                discussion.id,
              );

              await sendEmail(
                discussionCreator.email,
                `New reply to your discussion: ${discussion.title}`,
                emailContent.text,
                emailContent.html,
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
                type: "reply",
                message: `${user.username} replied to your comment`,
              };

              const notification =
                await storage.createNotification(notificationData);

              // Send email notification
              const parentReplyCreator = await storage.getUser(
                parentReply.userId,
              );
              if (
                parentReplyCreator &&
                parentReplyCreator.email &&
                parentReplyCreator.emailNotifications
              ) {
                const emailContent = generateReplyNotificationEmail(
                  parentReplyCreator.username,
                  user.username,
                  discussion?.title || "a discussion", // Fallback if discussion not found
                  reply.content,
                  reply.discussionId,
                );

                await sendEmail(
                  parentReplyCreator.email,
                  `New reply to your comment`,
                  emailContent.text,
                  emailContent.html,
                );

                await storage.markNotificationEmailSent(notification.id);
              }
            } catch (error) {
              console.error(
                "Error creating notification for reply parent:",
                error,
              );
            }
          }
        }

        const { password, ...userWithoutPassword } = user;

        res.status(201).json({
          ...reply,
          user: userWithoutPassword,
          childReplies: [],
        });
      } catch (error) {
        console.error("Error creating reply:", error);
        res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid request",
        });
      }
    },
  );

  app.patch(
    "/api/replies/:id",
    upload.array("images", 5),
    async (req: Request, res: Response) => {
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
          return res
            .status(403)
            .json({ message: "You can only edit your own replies" });
        }
        // Support for editing images: merge existing and new
        let imagePaths: string[] = [];
        let captions: string[] = [];
        // Existing images/captions (kept by user)
        if (Array.isArray(req.body.existingImagePaths)) {
          imagePaths = req.body.existingImagePaths;
        } else if (typeof req.body.existingImagePaths === "string") {
          imagePaths = [req.body.existingImagePaths];
        }
        if (Array.isArray(req.body.existingCaptions)) {
          captions = req.body.existingCaptions;
        } else if (typeof req.body.existingCaptions === "string") {
          captions = [req.body.existingCaptions];
        }
        // New images/captions
        let newCaptions: string[] = [];
        if (Array.isArray(req.body.captions)) {
          newCaptions = req.body.captions;
        } else if (typeof req.body.captions === "string") {
          newCaptions = [req.body.captions];
        }
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const newPaths = await Promise.all(
            files.map((file) => uploadToCloudinary(file).then((r) => r.url)),
          );
          imagePaths = imagePaths.concat(newPaths);
        }
        // --- FIX: Always merge captions to match imagePaths length for replies ---
        let mergedCaptions: string[] = [];
        for (let i = 0; i < imagePaths.length - (files?.length || 0); i++) {
          mergedCaptions.push(captions[i] || "");
        }
        for (let i = 0; i < (files?.length || 0); i++) {
          mergedCaptions.push(newCaptions[i] || "");
        }
        if (imagePaths.length === 0) mergedCaptions = [];
        const data = {
          ...req.body,
          userId,
          imagePaths,
          captions: mergedCaptions,
        };
        const updatedReply = await storage.updateReply(id, data);
        res.status(200).json(updatedReply);
      } catch (error) {
        res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid request",
        });
      }
    },
  );

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
        return res
          .status(403)
          .json({ message: "You can only delete your own replies" });
      }

      await storage.deleteReply(id);
      res.status(200).json({ message: "Reply deleted successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
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
        type,
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
          const discussion = await storage.getDiscussionById(
            parseInt(discussionId),
          );
          if (discussion && discussion.userId !== parseInt(userId)) {
            // Create notification for discussion author
            const notificationData = {
              userId: discussion.userId,
              triggeredByUserId: parseInt(userId),
              discussionId: parseInt(discussionId),
              replyId: null,
              type: "helpful",
              message: `${markingUser.username} marked your discussion "${discussion.title}" as helpful`,
            };

            const notification =
              await storage.createNotification(notificationData);

            // Send email notification if user has email and notifications enabled
            const discussionOwner = await storage.getUser(discussion.userId);
            if (
              discussionOwner &&
              discussionOwner.email &&
              discussionOwner.emailNotifications
            ) {
              const emailContent = generateHelpfulNotificationEmail(
                discussionOwner.username,
                markingUser.username,
                discussion.title,
                "discussion",
                discussion.id,
              );

              await sendEmail(
                discussionOwner.email,
                `Your discussion was marked as helpful!`,
                emailContent.text,
                emailContent.html,
              );

              await storage.markNotificationEmailSent(notification.id);
            }
          }
        } else if (replyId) {
          const reply = await storage.getReplyById(parseInt(replyId));
          if (reply && reply.userId !== parseInt(userId)) {
            // Get the parent discussion for context
            const discussion = await storage.getDiscussionById(
              reply.discussionId,
            );

            // Create notification for reply author
            const notificationData = {
              userId: reply.userId,
              triggeredByUserId: parseInt(userId),
              discussionId: reply.discussionId,
              replyId: parseInt(replyId),
              type: "helpful",
              message: `${markingUser.username} marked your reply as helpful`,
            };

            const notification =
              await storage.createNotification(notificationData);

            // Send email notification
            const replyOwner = await storage.getUser(reply.userId);
            if (
              replyOwner &&
              replyOwner.email &&
              replyOwner.emailNotifications
            ) {
              const emailContent = generateHelpfulNotificationEmail(
                replyOwner.username,
                markingUser.username,
                discussion ? discussion.title : "a discussion",
                "reply",
                reply.discussionId,
              );

              await sendEmail(
                replyOwner.email,
                `Your reply was marked as helpful!`,
                emailContent.text,
                emailContent.html,
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
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.delete("/api/helpful", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, replyId } = req.body;
      if (!userId || (!discussionId && !replyId)) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      const result = await storage.removeHelpfulMark(
        parseInt(userId),
        discussionId ? parseInt(discussionId) : undefined,
        replyId ? parseInt(replyId) : undefined
      );
      if (!result) {
        return res.status(404).json({ message: "Helpful mark not found" });
      }
      res.status(200).json({ message: "Helpful mark removed successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Bookmark routes
  app.post("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, saveType } = req.body;

      if (!userId || !discussionId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      //
      // console.log(
      //   "Checking if addBookmark exists on storage:",
      //   typeof storage.addBookmark,
      //   type,
      // );

      const saveDiscussionThread = saveType === "current";
      console.log({ saveType, saveDiscussionThread });
      const bookmark = await storage.addBookmark({
        userId: parseInt(userId),
        discussionId: parseInt(discussionId),
        saveDiscussionThread,
      });

      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Error in /api/bookmarks endpoint:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Server error",
      });
    }
  });

  // Fix /api/bookmarks DELETE route
  app.delete("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      // Not implemented: removeBookmark
      return res.status(501).json({ message: "Bookmark removal not implemented" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Fix /api/bookmarks/check route
  app.get("/api/bookmarks/check", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.query;
      if (!userId || !discussionId) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      const getBookmarks = await storage.getBookmarkedDiscussions(
        parseInt(userId as string),
      );
      let isBookmarked = false;
      const isFound = getBookmarks.find((b) => {
        return b.bookmark.discussionId === parseInt(String(discussionId));
      });
      if (isFound) {
        isBookmarked = true;
      }
      res.status(200).json({ isBookmarked });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Fix helpful mark route type error (remove extra argument)
  app.delete("/api/helpful", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId, replyId } = req.body;
      if (!userId || (!discussionId && !replyId)) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      const result = await storage.removeHelpfulMark(
        parseInt(userId),
        discussionId ? parseInt(discussionId) : undefined,
        replyId ? parseInt(replyId) : undefined
      );
      if (!result) {
        return res.status(404).json({ message: "Helpful mark not found" });
      }
      res.status(200).json({ message: "Helpful mark removed successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // For userId, fallback to req.body.userId or req.query.userId only
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = req.body?.userId || req.query?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const notifications = await storage.getNotifications(parseInt(userId));
      res.status(200).json(notifications);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Server error",
      });
    }
  });
  // ...repeat this fallback for other routes using req.session.userId...

  // For updateUser, return 501 not implemented
  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    return res.status(501).json({ message: "User update not implemented" });
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));

  return httpServer;
}
