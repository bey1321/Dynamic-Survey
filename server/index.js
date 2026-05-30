import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import surveyRoutes from "./routes/survey.js";
import questionsRoutes from "./routes/questions.js";
import chatRoutes from "./routes/chat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use("/api", surveyRoutes);
app.use("/api", questionsRoutes);
app.use("/api", chatRoutes);

// In production (Docker), serve the compiled React client and handle SPA routing.
if (process.env.NODE_ENV === "production") {
  const clientDist = join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
