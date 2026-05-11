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
console.log("[CORS] Allowed origins:", [...allowedOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked: ${origin}`);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// Log every incoming request
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use("/api/auth",      authRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/market",    marketRoutes);
app.use("/api/alerts",    alertRoutes);

app.get("/health", (_, res) => res.json({ status: "ok" }));

// Global error handler — logs unhandled route errors
app.use((err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.path} —`, err.message);
  res.status(err.status || 500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;

console.log("[Startup] Connecting to MongoDB…");
connectDB()
  .then(() => {
    console.log("[Startup] MongoDB connected");
    app.listen(PORT, () => console.log(`[Startup] Server listening on port ${PORT}`));
    startScheduler();
    initNseCache();
  })
  .catch((err) => {
    console.error("[Startup] MongoDB connection failed:", err.message);
    process.exit(1);
  });
