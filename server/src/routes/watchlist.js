import { Router } from "express";
import WatchlistStock from "../models/WatchlistStock.js";
import { protect } from "../middleware/auth.js";
import { fetchPrice } from "../services/nse.js";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  try {
    const stocks = await WatchlistStock.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(stocks);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { symbol, name, shares, targetBuy, notes, priority } = req.body;
    if (!symbol || !name) return res.status(400).json({ message: "symbol and name required" });

    const existing = await WatchlistStock.findOne({ userId: req.user._id, symbol: symbol.toUpperCase() });
    if (existing) return res.status(400).json({ message: "Already in watchlist" });

    const stock = await WatchlistStock.create({
      userId: req.user._id, symbol, name,
      shares: shares || null, targetBuy: targetBuy || null, notes: notes || "",
      priority: priority || "medium",
    });
    res.status(201).json(stock);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const stock = await WatchlistStock.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!stock) return res.status(404).json({ message: "Not found" });
    res.json(stock);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const stock = await WatchlistStock.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!stock) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/live", async (req, res) => {
  try {
    const stocks = await WatchlistStock.find({ userId: req.user._id });
    if (!stocks.length) return res.json([]);

    // Parallel price fetches
    const prices = await Promise.all(stocks.map(s => fetchPrice(s.symbol).catch(() => null)));

    const enriched = stocks.map((stock, i) => {
      const data     = prices[i];
      const atTarget = stock.targetBuy && data && data.price <= stock.targetBuy;
      return { stock, data, atTarget };
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

export default router;
