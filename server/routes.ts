import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
const clients = new Map<string, { userId: number; ws: import("ws").WebSocket }>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // --- Enable WebSocket for real-time notifications ---
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");
    if (userId) {
      // If a previous connection exists for this user, close it first
      const existing = clients.get(userId);
      if (existing && existing.ws.readyState === existing.ws.OPEN) {
        existing.ws.close(4000, "Another session opened");
      }
      clients.set(userId, { userId: parseInt(userId), ws });
      console.log(`[WebSocket] User ${userId} connected`);
      ws.on("close", () => {
        // Only remove if the same ws instance is still mapped
        const current = clients.get(userId);
        if (current && current.ws === ws) {
          clients.delete(userId);
          console.log(`[WebSocket] User ${userId} disconnected`);
        }
      });
    } else {
      console.log(`[WebSocket] Connection attempt without userId`);
    }
  });

  // Helper to send notification event to a user
  function sendNotificationToUser(userId: number, payload: any) {
    const client = clients.get(String(userId));
    if (client && client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(payload));
      console.log(`[WebSocket] Sent notification to user ${userId}`);
    } else {
      console.log(`[WebSocket] Tried to send notification to user ${userId}, but no active connection`);
    }
  }

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
      (req.session as any).userId = user.id;
      await new Promise <void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });
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
      (req.session as any).userId = null;
      await new Promise <void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });
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
      const filter = (req.query.filter as string) || "recent";
      const discussions = await storage.getDiscussions(filter);
      // Commented out noisy debug log
      // console.log(discussions);
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

      // Debug log: print discussion object including replies
      console.log("[DEBUG] /api/discussions/:id response:", JSON.stringify(discussion, null, 2));

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
        // WebSocket: Notify all users about new discussion
        Array.from(clients.values()).forEach(client => {
          if (client.ws.readyState === client.ws.OPEN) {
            client.ws.send(JSON.stringify({ type: "discussion", discussionId: discussion.id }));
          }
        });
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
        let mergedCaptions: string[] = [];
        for (let i = 0; i < imagePaths.length - (files?.length || 0); i++) {
          mergedCaptions.push(captions[i] || "");
        }
        for (let i = 0; i < (files?.length || 0); i++) {
          mergedCaptions.push(newCaptions[i] || "");
        }
        if (imagePaths.length === 0) mergedCaptions = [];

        // --- Delete removed images from Cloudinary ---
        if (discussion.imagePaths && Array.isArray(discussion.imagePaths)) {
          const removed = discussion.imagePaths.filter((url: string) => !imagePaths.includes(url));
          for (const url of removed) {
            try {
              const match = url.match(/\/forum_uploads\/([^./]+)(\.[a-zA-Z0-9]+)?$/);
              let publicId = null;
              if (match) {
                publicId = `forum_uploads/${match[1]}`;
              } else {
                const fallback = url.split("/upload/")[1];
                if (fallback) publicId = fallback.replace(/\.[a-zA-Z0-9]+$/, "").replace(/\?.*$/, "");
              }
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
              }
            } catch (err) {
              console.error("Failed to delete image from Cloudinary:", url, err);
            }
          }
        }

        const data = {
          ...req.body,
          userId: parseInt(req.body.userId),
          imagePaths,
          captions: mergedCaptions,
        };
        const updatedDiscussion = await storage.updateDiscussion(id, data);
        // WebSocket: Notify all users about updated discussion
        if (updatedDiscussion && updatedDiscussion.id) {
          Array.from(clients.values()).forEach(client => {
            if (client.ws.readyState === client.ws.OPEN) {
              client.ws.send(JSON.stringify({ type: "discussion", discussionId: updatedDiscussion.id }));
            }
          });
        }
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

      // --- Delete images from Cloudinary ---
      if (discussion.imagePaths && Array.isArray(discussion.imagePaths)) {
        for (const url of discussion.imagePaths) {
          try {
            // Extract public ID from Cloudinary URL
            // Example: https://res.cloudinary.com/<cloud_name>/image/upload/v1234567890/forum_uploads/filename.jpg
            const match = url.match(/\/forum_uploads\/([^./]+)(\.[a-zA-Z0-9]+)?$/);
            let publicId = null;
            if (match) {
              publicId = `forum_uploads/${match[1]}`;
            } else {
              // fallback: try to extract after '/upload/'
              const fallback = url.split("/upload/")[1];
              if (fallback) publicId = fallback.replace(/\.[a-zA-Z0-9]+$/, "").replace(/\?.*$/, "");
            }
            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (err) {
            console.error("Failed to delete image from Cloudinary:", url, err);
          }
        }
      }

      await storage.deleteDiscussion(id);
      // WebSocket: Notify all users about deleted discussion
      Array.from(clients.values()).forEach(client => {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(JSON.stringify({ type: "discussion", discussionId: id, deleted: true }));
        }
      });
      res.status(200).json({ message: "Discussion deleted successfully" });
    } catch (error) {
      console.error("[ERROR] /api/discussions/:id DELETE:", error);
      res.status(500).json({ message: "Failed to delete discussion" });
    }
  });

  // --- REPLY ROUTES ---
  app.post("/api/replies", upload.array("images", 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      let imagePaths: string[] = [];
      if (files && files.length > 0) {
        imagePaths = await Promise.all(
          files.map((file) => uploadToCloudinary(file).then((r) => r.url)),
        );
      }
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
        parentId: req.body.parentId ? parseInt(req.body.parentId) : null,
        imagePaths,
        captions,
      };
      const validatedData = insertReplySchema.parse(data);
      const reply = await storage.createReply(validatedData);
      // WebSocket: Notify all users about new reply
      Array.from(clients.values()).forEach(client => {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(JSON.stringify({ type: "reply", discussionId: reply.discussionId }));
        }
      });
      // --- Send notification to the recipient (discussion owner, unless replying to a reply) ---
      // Find the recipient userId (discussion owner or parent reply owner)
      let recipientUserId: number | undefined = undefined;
      if (reply.parentId) {
        const parentReply = await storage.getReplyById(reply.parentId);
        if (parentReply) recipientUserId = parentReply.userId;
      } else {
        const discussion = await storage.getDiscussionById(reply.discussionId);
        if (discussion) recipientUserId = discussion.user.id;
      }
      // Don't notify yourself
      if (recipientUserId && recipientUserId !== reply.userId) {
        // Create notification in DB
        await storage.createNotification({
          userId: recipientUserId,
          triggeredByUserId: reply.userId,
          discussionId: reply.discussionId,
          replyId: reply.id,
          type: "reply",
          message: `${req.body.username || "Someone"} replied to your post`,
        });
        // WebSocket: Notify recipient
        sendNotificationToUser(recipientUserId, { type: "notification" });
      }
      res.status(201).json(reply);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.patch("/api/replies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reply ID" });
      const data = { ...req.body };
      if (data.userId) data.userId = parseInt(data.userId);
      if (data.parentId) data.parentId = parseInt(data.parentId);
      const reply = await storage.updateReply(id, data);
      if (!reply) return res.status(404).json({ message: "Reply not found" });
      // WebSocket: Notify all users about updated reply
      Array.from(clients.values()).forEach(client => {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(JSON.stringify({ type: "reply", discussionId: reply.discussionId }));
        }
      });
      res.status(200).json(reply);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.delete("/api/replies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reply ID" });
      const reply = await storage.getReplyById(id);
      if (!reply) return res.status(404).json({ message: "Reply not found" });
      await storage.deleteReply(id);
      // WebSocket: Notify all users about deleted reply
      Array.from(clients.values()).forEach(client => {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(JSON.stringify({ type: "reply", discussionId: reply.discussionId }));
        }
      });
      res.status(200).json({ message: "Reply deleted successfully" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // --- HELPFUL MARK ROUTES ---
  app.post("/api/helpful", async (req: Request, res: Response) => {
    try {
      const data = insertHelpfulMarkSchema.parse(req.body);
      const mark = await storage.markAsHelpful(data);
      // WebSocket: Notify all users about helpful mark
      const discussionId = data.discussionId || (mark.replyId ? (await storage.getReplyById(mark.replyId))?.discussionId : null);
      if (discussionId) {
        Array.from(clients.values()).forEach(client => {
          if (client.ws.readyState === client.ws.OPEN) {
            client.ws.send(JSON.stringify({ type: "helpful", discussionId }));
          }
        });
      }
      // --- Send notification to the recipient (discussion/reply owner) ---
      let recipientUserId: number | undefined = undefined;
      if (mark.replyId) {
        const reply = await storage.getReplyById(mark.replyId);
        if (reply) recipientUserId = reply.userId;
      } else if (mark.discussionId) {
        const discussion = await storage.getDiscussionById(mark.discussionId);
        if (discussion) recipientUserId = discussion.user.id;
      }
      // Don't notify yourself
      if (recipientUserId && recipientUserId !== data.userId) {
        await storage.createNotification({
          userId: recipientUserId,
          triggeredByUserId: data.userId,
          discussionId: discussionId || undefined,
          replyId: mark.replyId || undefined,
          type: "helpful",
          message: `${req.body.username || "Someone"} marked your post as helpful`,
        });
        sendNotificationToUser(recipientUserId, { type: "notification" });
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
      await storage.removeHelpfulMark(userId, discussionId, replyId);
      // WebSocket: Notify all users about helpful mark removal
      const did = discussionId || (replyId ? (await storage.getReplyById(replyId))?.discussionId : null);
      if (did) {
        Array.from(clients.values()).forEach(client => {
          if (client.ws.readyState === client.ws.OPEN) {
            client.ws.send(JSON.stringify({ type: "helpful", discussionId: did }));
          }
        });
      }
      res.status(200).json({ message: "Helpful mark removed" });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // --- BOOKMARK ROUTES ---
  app.post("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.body;
      if (!userId || !discussionId) {
        return res.status(400).json({ message: "userId and discussionId are required" });
      }
      // Save bookmark (saveDiscussionThread defaults to false)
      const bookmark = await storage.addBookmark({
        userId: parseInt(userId),
        discussionId: parseInt(discussionId),
        saveDiscussionThread: false,
      });
      res.status(201).json({ isBookmarked: true, bookmark });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  app.delete("/api/delete-bookmark", async (req: Request, res: Response) => {
    try {
      const { userId, discussionId } = req.body;
      if (!userId || !discussionId) {
        return res.status(400).json({ message: "userId and discussionId are required" });
      }
      await storage.removeBookmark(parseInt(userId), parseInt(discussionId));
      res.status(200).json({ isBookmarked: false });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // --- GET USER BOOKMARKED DISCUSSIONS ---
  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      const discussions = await storage.getBookmarkedDiscussions(userId);
      res.status(200).json(discussions);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // --- CHECK IF DISCUSSION IS BOOKMARKED BY USER ---
  app.get("/api/bookmarks/check", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.query.userId as string);
      const discussionId = parseInt(req.query.discussionId as string);
      if (!userId || !discussionId) {
        return res.status(400).json({ isBookmarked: false, message: "userId and discussionId are required" });
      }
      const bookmarks = await storage.getBookmarkedDiscussions(userId);
      const isBookmarked = bookmarks.some((b: any) => b.id === discussionId);
      res.status(200).json({ isBookmarked });
    } catch (error) {
      res.status(400).json({ isBookmarked: false, message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  return httpServer;
}
