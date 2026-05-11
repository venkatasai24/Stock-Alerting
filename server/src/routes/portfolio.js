import { Router } from "express";
import PortfolioStock from "../models/PortfolioStock.js";
import { protect } from "../middleware/auth.js";
import { fetchPrice } from "../services/nse.js";
import { evaluateStock } from "../services/decisionEngine.js";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  try {
    const stocks = await PortfolioStock.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(stocks);
  } catch (e) {
    console.error("[Portfolio] GET / error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { symbol, name, shares, avgPrice, buyBelow, sellAbove, action } = req.body;
    if (!symbol || !name || shares == null || !avgPrice)
      return res.status(400).json({ message: "symbol, name, shares, avgPrice required" });

    const existing = await PortfolioStock.findOne({ userId: req.user._id, symbol: symbol.toUpperCase() });
    if (existing) return res.status(400).json({ message: "Stock already in portfolio" });

    const stock = await PortfolioStock.create({
      userId: req.user._id, symbol, name, shares, avgPrice,
      buyBelow: buyBelow || null, sellAbove: sellAbove || null, action: action || "HOLD",
    });
    console.log(`[Portfolio] Added ${symbol} for user ${req.user._id}`);
    res.status(201).json(stock);
  } catch (e) {
    console.error("[Portfolio] POST / error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const stock = await PortfolioStock.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!stock) return res.status(404).json({ message: "Not found" });
    res.json(stock);
  } catch (e) {
    console.error("[Portfolio] PUT /:id error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const stock = await PortfolioStock.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!stock) return res.status(404).json({ message: "Not found" });
    console.log(`[Portfolio] Deleted ${stock.symbol} for user ${req.user._id}`);
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error("[Portfolio] DELETE /:id error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

router.get("/summary/live", async (req, res) => {
  try {
    const stocks = await PortfolioStock.find({ userId: req.user._id, shares: { $gt: 0 } });
    if (!stocks.length) {
      return res.json({ totalInvested: 0, totalCurrent: 0, totalPnl: 0, totalPnlP: 0, stocks: [] });
    }

    console.log(`[Portfolio] Summary/live for user ${req.user._id} — ${stocks.length} stocks`);
    const prices = await Promise.all(stocks.map(s => fetchPrice(s.symbol).catch(() => null)));

    const totalInvested = stocks.reduce((sum, s) => sum + s.shares * s.avgPrice, 0);
    let totalCurrent = 0;

    const enriched = stocks.map((stock, i) => {
      const data = prices[i];
      if (!data) return { stock, data: null, decision: null, invested: stock.shares * stock.avgPrice };
      const invested = stock.shares * stock.avgPrice;
      const current  = stock.shares * data.price;
      totalCurrent  += current;
      const decision = evaluateStock(stock, data);
      return { stock, data, decision, invested, current };
    });

    const holiday = prices.some(p => p && p.marketState && p.marketState !== "REGULAR" && p.marketState !== "PRE" && p.marketState !== "POST");

    res.json({
      totalInvested,
      totalCurrent,
      totalPnl:  totalCurrent - totalInvested,
      totalPnlP: totalInvested ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
      stocks: enriched,
      holiday,
    });
  } catch (e) {
    console.error("[Portfolio] GET /summary/live error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

router.get("/:id/live", async (req, res) => {
  try {
    const stock = await PortfolioStock.findOne({ _id: req.params.id, userId: req.user._id });
    if (!stock) return res.status(404).json({ message: "Not found" });
    const data = await fetchPrice(stock.symbol);
    if (!data) return res.status(503).json({ message: "Price unavailable" });
    const decision = evaluateStock(stock, data);
    res.json({ ...data, decision });
  } catch (e) {
    console.error("[Portfolio] GET /:id/live error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

export default router;
