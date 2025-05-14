import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertDiscussionSchema, 
  insertReplySchema,
  insertHelpfulMarkSchema
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";

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

  // Temporarily disable WebSocket for troubleshooting
  console.log("WebSocket functionality is temporarily disabled for troubleshooting");

  // Set default online count to 1 for testing
  await storage.updateUserOnlineStatus(1, true);

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
      const { userId, discussionId, replyId } = req.body;
      
      if (!userId || (!discussionId && !replyId)) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }
      
      const data = {
        userId: parseInt(userId),
        discussionId: discussionId ? parseInt(discussionId) : undefined,
        replyId: replyId ? parseInt(replyId) : undefined
      };
      
      const validatedData = insertHelpfulMarkSchema.parse(data);
      const mark = await storage.markAsHelpful(validatedData);
      res.status(201).json(mark);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
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

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));

  return httpServer;
}
