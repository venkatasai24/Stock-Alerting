import { Router } from "express";
import { fetchPrice, fetchMarketTrend, NIFTY50 } from "../services/nse.js";
import { scoreStock } from "../services/decisionEngine.js";
import { protect } from "../middleware/auth.js";
import { runRecommendations } from "../jobs/scheduler.js";
import { searchNse } from "../data/nseCache.js";

const router = Router();
router.use(protect);

router.get("/trend", async (req, res) => {
  try {
    res.json(await fetchMarketTrend());
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/price/:symbol", async (req, res) => {
  try {
    const data = await fetchPrice(req.params.symbol.toUpperCase());
    if (!data) return res.status(404).json({ message: "Price not available" });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/picks", async (req, res) => {
  try {
    const result = await runRecommendations();
    if (!result) return res.json({ bearish: true, top: [] });
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/nifty50", async (req, res) => {
  res.json(NIFTY50);
});

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    // Tier 1: Local NSE database — instant, works for any query length
    const local = searchNse(q);
    if (local.length > 0) return res.json(local);

    const ax = (await import("axios")).default;
    const YF_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    };

    // Tier 2: Yahoo Finance search
    try {
      const { data } = await ax.get(
        "https://query2.finance.yahoo.com/v1/finance/search",
        {
          params: { q: `${q} NSE`, quotesCount: 20, newsCount: 0, listsCount: 0 },
          headers: { ...YF_HEADERS, "Referer": "https://finance.yahoo.com/" },
          timeout: 8000,
        }
      );
      const results = (data?.quotes || [])
        .filter(s => s.symbol?.endsWith(".NS"))
        .map(s => ({
          symbol: s.symbol.replace(".NS", ""),
          name:   s.shortname || s.longname || s.symbol.replace(".NS", ""),
          exchange: "NSE",
        }));
      if (results.length > 0) return res.json(results);
    } catch { /* fall through to tier 3 */ }

    // Tier 3: Direct symbol validation — handles any NSE stock not in cache
    // (InvITs, REITs, newly listed stocks, etc.)
    const sym = q.toUpperCase();
    if (/^[A-Z0-9&-]{2,20}$/.test(sym)) {
      try {
        const { data } = await ax.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS`,
          { headers: YF_HEADERS, params: { interval: "1d", range: "1d" }, timeout: 8000 }
        );
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          return res.json([{
            symbol:   sym,
            name:     meta.longName || meta.shortName || sym,
            exchange: "NSE",
            type:     "EQ",
          }]);
        }
      } catch { /* no result */ }
    }

    res.json([]);
  } catch (e) {
    console.error("[search]", e.message);
    res.status(500).json({ message: e.message });
  }
});

export default router;
