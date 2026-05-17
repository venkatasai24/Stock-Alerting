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

// marketState is null for indices from non-Indian servers — use
// currentTradingPeriod.regular.{start,end} Unix timestamps instead.
// On holidays those timestamps reflect a different day so now falls outside → false.
export async function isMarketOpen() {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  if (ist.getUTCDay() === 0 || ist.getUTCDay() === 6) {
    console.log("[NSE] isMarketOpen: weekend — false");
    return false;
  }
  try {
    const { data } = await axios.get(`${YF_BASE}/%5ENSEI`, {
      headers,
      params: { interval: "1d", range: "1d" },
      timeout: 5000,
    });
    const regular = data?.chart?.result?.[0]?.meta?.currentTradingPeriod?.regular;
    if (!regular) {
      console.warn("[NSE] isMarketOpen: no trading period data — false");
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    const open = now >= regular.start && now <= regular.end;
    console.log(`[NSE] isMarketOpen: session ${regular.start}–${regular.end} now=${now} → ${open}`);
    return open;
  } catch (err) {
    console.warn("[NSE] isMarketOpen fetch failed:", err.message, "— false");
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

// ─── NSE Corporate Actions ───────────────────────────────────────────────────
// NSE's API requires a browser-style session cookie. We fetch the homepage once
// to grab cookies, cache them for 5 min, then hit the corporate actions endpoint.
// Results are cached per-symbol for 6 hours — corporate actions don't change often.

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.nseindia.com/",
};

let nseCookies    = "";
let cookieExpiry  = 0;
let refreshInFlight = null; // singleton — prevents parallel refreshes
const corpCache   = new Map(); // symbol → { data, ts }
const CORP_TTL    = 6 * 60 * 60 * 1000; // 6 hours

async function refreshNseCookies() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await axios.get("https://www.nseindia.com", {
        headers: NSE_HEADERS,
        timeout: 10000,
      });
      const raw = res.headers["set-cookie"];
      if (raw?.length) {
        nseCookies   = raw.map(c => c.split(";")[0]).join("; ");
        cookieExpiry = Date.now() + 5 * 60 * 1000;
        console.log("[NSE] Corporate action session refreshed");
      }
    } catch (err) {
      console.warn("[NSE] Cookie refresh failed:", err.message);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function fetchCorporateEvents(symbol) {
  const cached = corpCache.get(symbol);
  if (cached && Date.now() - cached.ts < CORP_TTL) return cached.data;

  try {
    if (Date.now() > cookieExpiry) await refreshNseCookies();

    const { data } = await axios.get(
      "https://www.nseindia.com/api/corporates-corporateActions",
      {
        params: { index: "equities", symbol },
        headers: { ...NSE_HEADERS, Cookie: nseCookies },
        timeout: 8000,
      }
    );

    if (!Array.isArray(data)) {
      const result = { hasCorporateAction: false };
      corpCache.set(symbol, { data: result, ts: Date.now() });
      return result;
    }

    const now          = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const recent = data.filter(a => {
      const d = a.exDate && new Date(a.exDate);
      return d && d >= thirtyDaysAgo && d <= now;
    });

    const result = recent.length > 0
      ? { hasCorporateAction: true, type: recent[0].subject, date: recent[0].exDate }
      : { hasCorporateAction: false };

    corpCache.set(symbol, { data: result, ts: Date.now() });
    console.log(`[NSE] Corporate events ${symbol}: ${result.hasCorporateAction ? result.type : "none"}`);
    return result;
  } catch (err) {
    console.warn(`[NSE] fetchCorporateEvents ${symbol} failed: ${err.message}`);
    return { hasCorporateAction: false };
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
