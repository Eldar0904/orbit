import express, { type Express } from "express";
import path from "node:path";
import { existsSync } from "node:fs";

/** Only the standalone server serves UI files; serverless exports stay API-only. */
export function mountFrontend(app: Express, directory: string): void {
  const root = path.resolve(directory);
  const index = path.join(root, "index.html");
  if (!existsSync(index)) throw new Error("Frontend build is missing");
  app.use("/api", (_req, res) => { res.status(404).json({ error: "Not found" }); });
  app.use(express.static(root, { index: false, maxAge: 0 }));
  app.get("/{*path}", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) { next(); return; }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(index);
  });
}
