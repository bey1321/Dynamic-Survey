import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import surveyRoutes from "./routes/survey.js";
import questionsRoutes from "./routes/questions.js";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import surveysRoutes from "./routes/surveys.js";
import versionsRoutes from "./routes/versions.js";
import sharesRoutes, { publicRouter as sharedPublicRouter } from "./routes/shares.js";
import collaboratorsRoutes from "./routes/collaborators.js";
import { initRealtime } from "./services/realtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

initRealtime(io);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// AI generation routes (existing)
app.use("/api", surveyRoutes);
app.use("/api", questionsRoutes);
app.use("/api", chatRoutes);

// Auth & database routes
app.use("/api/auth", authRoutes);
app.use("/api/surveys", surveysRoutes);
app.use("/api/surveys/:id/versions", versionsRoutes);
app.use("/api/surveys/:id/shares", sharesRoutes);
app.use("/api/surveys/:id/collaborators", collaboratorsRoutes);
app.use("/api/shared", sharedPublicRouter);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "dynamic-survey" })
);

// In production, serve the compiled React client and handle SPA routing.
if (process.env.NODE_ENV === "production") {
  const clientDist = join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
}

const port = process.env.PORT || 4000;
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
