import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { addEmailColumnsToUsers, createNotificationsTable } from "./migrations/addEmailToUsers";
import { up, down } from "./migrations/add_type_to_helpful_marks";
import { up as upUpvoteDownvoteCount, down as downUpvoteDownvoteCount } from "./migrations/add_upvote_downvote_count";
import {up as upBookmarks, down as downBookmarks} from "./migrations/20240515_add_bookmarks";
import { up as upImagePaths, down as downImagePaths } from "./migrations/20240609_add_imagepaths_array";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run migrations
  try {
    log("Running database migrations...");
    await addEmailColumnsToUsers();
    await createNotificationsTable();
    await up();
    await upUpvoteDownvoteCount();
    await upBookmarks();
    await upImagePaths();
    log("Migrations completed successfully");
  } catch (err) {
    log("Error running migrations: " + (err as Error).message);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 9909;
  // server.listen({
  //   port,
  //   host: "localhost",
  //   reusePort: true,
  // }, () => {
  //   log(`serving on port ${port}`);
  // });
  server.listen(port, ()=>{
    log(`serving on port ${port}`);
  })
})();
