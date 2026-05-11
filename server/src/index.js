import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { startScheduler } from "./jobs/scheduler.js";
import { initNseCache } from "./data/nseCache.js";
import authRoutes      from "./routes/auth.js";
import portfolioRoutes from "./routes/portfolio.js";
import watchlistRoutes from "./routes/watchlist.js";
import marketRoutes    from "./routes/market.js";
import alertRoutes     from "./routes/alerts.js";

const app = express();

const allowedOrigins = new Set(
  (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(s => s.trim())
);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth",      authRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/market",    marketRoutes);
app.use("/api/alerts",    alertRoutes);

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  startScheduler();
  initNseCache(); // async, non-blocking
});
