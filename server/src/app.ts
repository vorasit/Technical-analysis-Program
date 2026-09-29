import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";

// Built separately from index.ts so the same app can run as a long-lived
// local server (index.ts calls listen) and as a Vercel Function (api/index.ts
// re-exports it, and Vercel handles the listening).
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

export default app;
