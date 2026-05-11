import { Router } from "express";
import jwt from "jsonwebtoken";
import Alert from "../models/Alert.js";
import { protect } from "../middleware/auth.js";
import { runPortfolioAnalysis, runWatchlistAnalysis } from "../jobs/scheduler.js";
import alertEmitter from "../services/alertEmitter.js";

const router = Router();

// ── SSE — real-time unread badge ───────────────────────────────────────────
// EventSource can't send custom headers, so the JWT comes in as ?token=
router.get("/stream", async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendCount = async () => {
    try {
      const count = await Alert.countDocuments({ userId, read: false });
      res.write(`data: ${count}\n\n`);
    } catch {}
  };

  await sendCount(); // send immediately on connect

  alertEmitter.on(`user:${userId}`, sendCount);

  // Heartbeat every 25s so proxies/browsers don't close the connection
  const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 25000);

  req.on("close", () => {
    alertEmitter.off(`user:${userId}`, sendCount);
    clearInterval(hb);
  });
});

router.use(protect);

router.get("/", async (req, res) => {
  try {
    const { limit = 50, unread } = req.query;
    const filter = { userId: req.user._id };
    if (unread === "true") filter.read = false;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await Alert.countDocuments({ userId: req.user._id, read: false });
    res.json({ alerts, unreadCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put("/:id/read", async (req, res) => {
  try {
    await Alert.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true });
    res.json({ message: "Marked read" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put("/read-all", async (req, res) => {
  try {
    await Alert.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ message: "All marked read" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await Alert.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/", async (req, res) => {
  try {
    await Alert.deleteMany({ userId: req.user._id });
    res.json({ message: "All alerts cleared" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Manual trigger — runs analysis now (lock prevents duplicate runs from double-click)
let analysisRunning = false;
router.post("/run-analysis", async (req, res) => {
  if (analysisRunning) {
    return res.status(429).json({ message: "Analysis already running, please wait" });
  }
  analysisRunning = true;
  res.json({ message: "Analysis started" });
  try {
    await runPortfolioAnalysis();
    await runWatchlistAnalysis();
  } catch (e) {
    console.error(e);
  } finally {
    analysisRunning = false;
  }
});

export default router;
