import axios from "axios";

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

export async function fetchPrice(symbol) {
  for (const suffix of [".NS", ".BO"]) {
    try {
      const { data } = await axios.get(`${YF_BASE}/${symbol}${suffix}`, {
        headers,
        params: { interval: "1d", range: "1d" },
        timeout: 8000,
      });

      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const marketState = meta.marketState ?? "CLOSED";
      const price       = meta.regularMarketPrice ?? 0;

      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
      const changeP   = price && prevClose
        ? +(((price - prevClose) / prevClose) * 100).toFixed(2)
        : 0;

      const rawHigh  = meta["52WeekHigh"] ?? 0;
      const rawLow   = meta["52WeekLow"]  ?? 0;
      const weekHigh = rawHigh >= price ? rawHigh : 0;
      const weekLow  = rawHigh >= price ? rawLow  : 0;

      console.log(`[NSE] ${symbol}${suffix} ₹${price} (${changeP >= 0 ? "+" : ""}${changeP}%) [${marketState}]`);

      return {
        symbol,
        price,
        prev:        prevClose,
        open:        meta.regularMarketOpen    ?? 0,
        high:        meta.regularMarketDayHigh ?? 0,
        low:         meta.regularMarketDayLow  ?? 0,
        weekHigh,
        weekLow,
        // REGULAR = live intraday, CLOSED = today's final change — both valid.
        // PRE = pre-market price (unreliable), zero it out.
        changeP:     (marketState === "REGULAR" || marketState === "CLOSED") ? changeP : 0,
        marketState,
        source:      `YF${suffix}`,
      };
    } catch (err) {
      console.warn(`[NSE] fetchPrice ${symbol}${suffix} failed: ${err.message}`);
    }
  }
  console.error(`[NSE] fetchPrice ${symbol} — both suffixes failed, returning null`);
  return null;
}

export async function isMarketOpen() {
  try {
    const { data } = await axios.get(`${YF_BASE}/%5ENSEI`, {
      headers,
      params: { interval: "1d", range: "1d" },
      timeout: 5000,
    });
    const meta = data?.chart?.result?.[0]?.meta;
    const open = meta?.marketState === "REGULAR";
    console.log(`[NSE] Market state: ${meta?.marketState ?? "unknown"} — open: ${open}`);
    return open;
  } catch (err) {
    console.warn("[NSE] isMarketOpen failed:", err.message);
    return false;
  }
}

export async function fetchMarketTrend() {
  try {
    const { data } = await axios.get(`${YF_BASE}/%5ENSEI`, {
      headers,
      params: { interval: "1d", range: "1d" },
      timeout: 8000,
    });
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return { trend: "UNKNOWN", changeP: 0, price: 0 };

    const marketState = meta.marketState ?? "CLOSED";
    // "CLOSED" = after-hours on a normal trading day, not a holiday
    const isHoliday   = !["REGULAR", "PRE", "POST", "CLOSED"].includes(marketState);

    const changeP = meta.regularMarketPrice && meta.chartPreviousClose
      ? +((( meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100).toFixed(2)
      : 0;

    const trend = isHoliday ? "HOLIDAY" : changeP > 0.8 ? "BULLISH" : changeP < -0.8 ? "BEARISH" : "SIDEWAYS";
    console.log(`[NSE] Nifty50 ₹${meta.regularMarketPrice} ${changeP >= 0 ? "+" : ""}${changeP}% — ${trend}`);

    return {
      price:       meta.regularMarketPrice,
      changeP:     isHoliday ? 0 : changeP,
      trend,
      marketState,
      holiday:     isHoliday,
    };
  } catch (err) {
    console.error("[NSE] fetchMarketTrend failed:", err.message);
    return { trend: "UNKNOWN", changeP: 0, price: 0 };
  }
}

export const NIFTY50 = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","KOTAKBANK","HINDUNILVR","ITC",
  "AXISBANK","LT","BHARTIARTL","SBIN","WIPRO","HCLTECH","ASIANPAINT","MARUTI",
  "BAJFINANCE","SUNPHARMA","ULTRACEMCO","TITAN","NTPC","POWERGRID","COALINDIA",
  "ONGC","TECHM","TATAMOTORS","TATASTEEL","JSWSTEEL","DIVISLAB","CIPLA",
  "ADANIENT","ADANIPORTS","BAJAJ-AUTO","BPCL","DRREDDY","EICHERMOT","GRASIM",
  "HEROMOTOCO","HINDALCO","INDUSINDBK","M&M","NESTLEIND","SBILIFE","SHRIRAMFIN",
  "TATACONSUM","APOLLOHOSP","BRITANNIA","HDFCLIFE","LTIM","VEDL",
];
