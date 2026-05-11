import cron from "node-cron";
import PortfolioStock from "../models/PortfolioStock.js";
import WatchlistStock from "../models/WatchlistStock.js";
import Alert from "../models/Alert.js";
import { fetchPrice, fetchMarketTrend, isMarketOpen, NIFTY50 } from "../services/nse.js";
import { evaluateStock, scoreStock } from "../services/decisionEngine.js";
import { sendTelegram } from "../services/telegram.js";
import alertEmitter from "../services/alertEmitter.js";

// Alert types that are worth notifying the user about
const ALERTABLE = new Set(["BOOK_PROFIT", "PARTIAL_SELL", "STOP_LOSS", "BUY_MORE", "ACCUMULATE", "NEAR_52W_LOW"]);

const TELEGRAM_EMOJI = {
  BOOK_PROFIT:  "🎯",
  PARTIAL_SELL: "💰",
  STOP_LOSS:    "🔴",
  BUY_MORE:     "🟢",
  ACCUMULATE:   "📥",
  NEAR_52W_LOW: "🔍",
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Returns "YYYY-MM-DD" in IST for dedup key
function todayIST() {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

export async function runPortfolioAnalysis() {
  const istTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`[Portfolio] Analysis @ ${istTime}`);

  // Auto-cleanup: drop alerts older than 30 days
  await Alert.deleteMany({ createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

  const todayStr = todayIST();
  const stocks = await PortfolioStock.find({ shares: { $gt: 0 } }).populate("userId");

  for (const stock of stocks) {
    try {
      const data = await fetchPrice(stock.symbol);
      if (!data) { await sleep(300); continue; }

      const decision = evaluateStock(stock, data);

      // Only act on actionable signals
      if (!ALERTABLE.has(decision.type)) { await sleep(300); continue; }

      // Dedup: one alert per stock + type per calendar day (IST)
      const exists = await Alert.findOne({
        userId: stock.userId._id,
        symbol: stock.symbol,
        type:   decision.type,
        date:   todayStr,
      });
      if (exists) { await sleep(300); continue; }

      try {
        await Alert.create({
          userId:  stock.userId._id,
          symbol:  stock.symbol,
          name:    stock.name,
          type:    decision.type,
          message: decision.message,
          price:   data.price,
          changeP: data.changeP,
          source:  "portfolio",
          date:    todayStr,
        });
        // Push real-time badge update to any connected SSE clients
        alertEmitter.emit(`user:${stock.userId._id}`, null);
      } catch (createErr) {
        if (createErr.code === 11000) { await sleep(300); continue; } // duplicate — silently skip
        throw createErr;
      }

      const chatId = stock.userId.telegramChatId;
      if (chatId || process.env.CHAT_ID) {
        const emoji = TELEGRAM_EMOJI[decision.type] || "📊";
        await sendTelegram(
          `${emoji} <b>${decision.type.replace(/_/g, " ")}</b> — ${stock.name} (${stock.symbol})\n` +
          `Price: ₹${data.price}  (${data.changeP >= 0 ? "+" : ""}${data.changeP?.toFixed(2)}% today)\n` +
          `${decision.message}`,
          chatId
        );
      }
    } catch (err) {
      console.error(`[Portfolio] Error for ${stock.symbol}:`, err.message);
    }
    await sleep(400);
  }

  console.log("[Portfolio] Done");
}

export async function runWatchlistAnalysis() {
  const istTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`[Watchlist] Analysis @ ${istTime}`);

  const todayStr = todayIST();
  const stocks = await WatchlistStock.find({ targetBuy: { $ne: null } }).populate("userId");

  for (const stock of stocks) {
    try {
      const data = await fetchPrice(stock.symbol);
      if (!data) { await sleep(300); continue; }

      if (data.price <= stock.targetBuy) {
        // Dedup: one WATCHLIST_TARGET alert per stock per calendar day
        const exists = await Alert.findOne({
          userId: stock.userId._id, symbol: stock.symbol,
          type: "WATCHLIST_TARGET", date: todayStr,
        });
        if (exists) { await sleep(300); continue; }

        const gap = ((stock.targetBuy - data.price) / stock.targetBuy * 100).toFixed(1);
        const msg = `₹${data.price} is at or below your buy target of ₹${stock.targetBuy}` +
          (Number(gap) > 0 ? ` (${gap}% below target)` : "") + `. Consider entering your planned position.`;

        try {
          await Alert.create({
            userId:  stock.userId._id,
            symbol:  stock.symbol,
            name:    stock.name,
            type:    "WATCHLIST_TARGET",
            message: msg,
            price:   data.price,
            changeP: data.changeP,
            source:  "watchlist",
            date:    todayStr,
          });
          alertEmitter.emit(`user:${stock.userId._id}`, null);
        } catch (createErr) {
          if (createErr.code !== 11000) throw createErr; // 11000 = dup key, silently skip
        }

        const chatId = stock.userId.telegramChatId;
        if (chatId || process.env.CHAT_ID) {
          await sendTelegram(
            `🟢 <b>BUY SIGNAL</b> — ${stock.name} (${stock.symbol})\n` +
            `Price ₹${data.price} hit your target ₹${stock.targetBuy}!\n` +
            `Consider entering your planned position.`,
            chatId
          );
        }
      }
    } catch (err) {
      console.error(`[Watchlist] Error for ${stock.symbol}:`, err.message);
    }
    await sleep(400);
  }

  console.log("[Watchlist] Done");
}

export async function runRecommendations() {
  const market = await fetchMarketTrend();
  if (market.trend === "BEARISH") return { bearish: true };

  const results = [];
  for (const sym of NIFTY50) {
    try {
      const data = await fetchPrice(sym);
      if (data) {
        const { score, reasons } = scoreStock(data);
        results.push({ symbol: sym, price: data.price, changeP: data.changeP, score, reasons });
      }
    } catch {}
    await sleep(400);
  }

  results.sort((a, b) => b.score - a.score);
  return { market, top: results.slice(0, 5) };
}

export function startScheduler() {
  // Every hour at :30 past, 9:30 AM–3:30 PM IST, Mon–Fri
  // Covers: 9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30
  cron.schedule("30 9-15 * * 1-5", async () => {
    const open = await isMarketOpen();
    if (!open) {
      console.log("[Scheduler] Market closed or holiday — skipping scan");
      return;
    }
    console.log("[Scheduler] Hourly market scan triggered");
    await runPortfolioAnalysis();
    await runWatchlistAnalysis();
  }, { timezone: "Asia/Kolkata" });

  console.log("[Scheduler] Registered: :30 past each hour, 9:30 AM–3:30 PM IST, Mon–Fri");
}
