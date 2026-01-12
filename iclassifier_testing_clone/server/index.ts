import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleBugReport } from "./routes/bug-report";
import iclassifierApi from "./routes/iclassifier-api";
import jseshProxy from "./routes/jsesh-proxy";
import dictionaryProxy from "./routes/dictionary-proxy";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/bug-report", handleBugReport);

  // iClassifier API routes
  app.use("/api/iclassifier", iclassifierApi);
  app.use("/api/jsesh", jseshProxy);
  app.use("/api/dictionary", dictionaryProxy);

  return app;
}
