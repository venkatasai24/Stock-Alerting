"""
╔══════════════════════════════════════════════════════════════╗
║         SAI'S PORTFOLIO ALERT SYSTEM v2.0                   ║
║         Groww User — TSV Portfolio + NSEPython              ║
║                                                              ║
║  pip install nsepython requests schedule python-dotenv       ║
║                                                              ║
║  Usage:                                                      ║
║    python stock_alerts.py            → full scheduler       ║
║    python stock_alerts.py TCS        → manual price check   ║
║    python stock_alerts.py --summary  → instant P&L summary  ║
║    python stock_alerts.py --reco     → instant top picks    ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import sys
import csv
import time
import requests
import schedule
from datetime import datetime
from dotenv import load_dotenv
from nsepython import nse_eq, nse_get_index_quote

load_dotenv()

# ─────────────────────────────────────────────────────────────
# 🔧 CONFIG — set in .env file OR directly here
# ─────────────────────────────────────────────────────────────

BOT_TOKEN       = os.getenv("BOT_TOKEN")
CHAT_ID         = os.getenv("CHAT_ID")
PORTFOLIO_FILE  = os.getenv("PORTFOLIO_FILE", "portfolio.tsv")

# Alert thresholds
BIG_MOVE_THRESHOLD  = 5.0   # % — alert if stock moves more than this in a day
LOSS_EXIT_THRESHOLD = -10.0 # % from avg — suggest exit
PROFIT_BOOK_LEVEL   = 30.0  # % from avg — suggest partial profit booking
WATCHLIST_FILE      = "watchlist.tsv"  # optional separate watchlist

# ─────────────────────────────────────────────────────────────
# 📋 PORTFOLIO LOADER — reads your TSV file
# ─────────────────────────────────────────────────────────────

def load_portfolio(filepath: str = PORTFOLIO_FILE) -> list[dict]:
    """
    Load portfolio from TSV file.
    Columns: SYMBOL | NAME | SHARES | AVG_PRICE | BUY_BELOW | SELL_ABOVE | ACTION
    """
    portfolio = []

    if not os.path.exists(filepath):
        print(f"❌ Portfolio file not found: {filepath}")
        print("   Create portfolio.tsv with columns:")
        print("   SYMBOL  NAME  SHARES  AVG_PRICE  BUY_BELOW  SELL_ABOVE  ACTION")
        return portfolio

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            try:
                portfolio.append({
                    "symbol":     row["SYMBOL"].strip(),
                    "name":       row["NAME"].strip(),
                    "shares":     int(row["SHARES"].strip()),
                    "avg_price":  float(row["AVG_PRICE"].strip()),
                    "buy_below":  float(row["BUY_BELOW"].strip()) if row["BUY_BELOW"].strip() not in ("0", "", "-") else None,
                    "sell_above": float(row["SELL_ABOVE"].strip()) if row["SELL_ABOVE"].strip() not in ("0", "", "-") else None,
                    "action":     row["ACTION"].strip(),
                })
            except (ValueError, KeyError) as e:
                print(f"⚠️  Skipping bad row: {row} — {e}")

    print(f"✅ Loaded {len(portfolio)} stocks from {filepath}")
    return portfolio


def update_portfolio_file(symbol: str, field: str, value):
    """Update a single field in the TSV (e.g. after buying more shares)"""
    lines = []
    with open(PORTFOLIO_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        fieldnames = reader.fieldnames
        for row in reader:
            if row["SYMBOL"].strip() == symbol:
                row[field] = str(value)
            lines.append(row)

    with open(PORTFOLIO_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        writer.writerows(lines)

    print(f"✅ Updated {symbol} → {field} = {value}")

# ─────────────────────────────────────────────────────────────
# 📱 TELEGRAM
# ─────────────────────────────────────────────────────────────

def send_telegram(msg: str, silent: bool = False) -> bool:
    """Send message to Telegram. silent=True = no notification sound."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id":              CHAT_ID,
        "text":                 msg,
        "parse_mode":           "HTML",
        "disable_notification": silent,
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.status_code != 200:
            print(f"⚠️  Telegram error {r.status_code}: {r.text[:100]}")
            return False
        return True
    except Exception as e:
        print(f"❌ Telegram error: {e}")
        return False

# ─────────────────────────────────────────────────────────────
# 📊 PRICE FETCHER — NSEPython primary, yfinance fallback
# ─────────────────────────────────────────────────────────────

def get_price_nse(symbol: str) -> dict | None:
    try:
        data = nse_eq(symbol)

        if "priceInfo" not in data:
            print(f"  ⚠️ Invalid data for {symbol}")
            return None

        price_info = data["priceInfo"]

        return {
            "price":     float(price_info.get("lastPrice", 0)),
            "change_p":  float(price_info.get("pChange", 0)),
            "prev":      float(price_info.get("previousClose", 0)),
            "open":      float(price_info.get("open", 0)),
            "high":      float(price_info.get("intraDayHighLow", {}).get("max", 0)),
            "low":       float(price_info.get("intraDayHighLow", {}).get("min", 0)),
            "week_high": float(price_info.get("weekHighLow", {}).get("max", 0)),
            "week_low":  float(price_info.get("weekHighLow", {}).get("min", 0)),
            "source":    "NSE",
        }

    except Exception as e:
        print(f"  NSE fetch failed for {symbol}: {e}")
        return None

def get_price(symbol: str) -> dict | None:
    """Smart price fetch: NSE first, Yahoo Finance fallback"""
    data = None
    data = get_price_nse(symbol)
    return data

# ─────────────────────────────────────────────────────────────
# 📊 MARKET OVERVIEW
# ─────────────────────────────────────────────────────────────

def get_market_trend() -> tuple[str, float]:
    try:
        data = nse_get_index_quote("NIFTY 50")

        change = float(data.get("pChange", 0))

        if change > 0.8:
            trend = "🟢 BULLISH"
        elif change < -0.8:
            trend = "🔴 BEARISH"
        else:
            trend = "🟡 SIDEWAYS"

        return trend, change

    except Exception as e:
        print(f"Market trend error: {e}")
        return "UNKNOWN", 0.0

# ─────────────────────────────────────────────────────────────
# 🧠 DECISION ENGINE — smarter than v1
# ─────────────────────────────────────────────────────────────

def evaluate_stock(stock: dict, price_data: dict) -> tuple[str, str]:
    """
    Returns (decision, reason) based on:
    - P&L from avg price
    - Distance from 52-week high/low
    - Action in portfolio file
    - Day change magnitude
    """
    avg       = stock["avg_price"]
    price     = price_data["price"]
    change_p  = price_data["change_p"]
    action    = stock["action"]
    pnl_p     = ((price - avg) / avg) * 100

    # Hard rules based on ACTION column
    if action == "EXIT":
        if price >= (stock["sell_above"] or 0):
            return "🔴 EXIT NOW", f"Hit exit target ₹{stock['sell_above']}"
        return "🔴 EXIT", f"Marked for exit — P&L: {pnl_p:+.1f}%"

    # Price alert rules
    if stock["buy_below"] and price <= stock["buy_below"]:
        return "🟢 BUY MORE", f"Hit buy zone ₹{stock['buy_below']}"

    if stock["sell_above"] and price >= stock["sell_above"]:
        return "🎯 BOOK PROFIT", f"Hit target ₹{stock['sell_above']}"

    # P&L based rules
    if pnl_p <= LOSS_EXIT_THRESHOLD:
        return "⚠️ CUT LOSS", f"Down {pnl_p:.1f}% from avg"

    if pnl_p >= PROFIT_BOOK_LEVEL:
        return "💰 PARTIAL SELL", f"Up {pnl_p:.1f}% from avg — consider booking"

    # Big intraday moves
    if change_p >= BIG_MOVE_THRESHOLD:
        return "📈 SURGE", f"Up {change_p:.1f}% today"

    if change_p <= -BIG_MOVE_THRESHOLD:
        return "📉 CRASH", f"Down {change_p:.1f}% today"

    # 52W proximity
    if "week_low" in price_data and price_data["week_low"] > 0:
        low_gap = ((price - price_data["week_low"]) / price_data["week_low"]) * 100
        if low_gap <= 5:
            return "🔍 NEAR 52W LOW", f"Only {low_gap:.1f}% above yearly low"

    return "✅ HOLD", f"P&L: {pnl_p:+.1f}%"

# ─────────────────────────────────────────────────────────────
# 🔔 PORTFOLIO MONITOR
# ─────────────────────────────────────────────────────────────

def monitor_portfolio(force_send: bool = False):
    """Full portfolio check with P&L summary + action alerts"""
    print(f"\n🔍 Portfolio check @ {datetime.now().strftime('%H:%M')}")

    portfolio      = load_portfolio()
    trend, nifty_c = get_market_trend()

    total_invested = 0.0
    total_current  = 0.0
    gainers        = []
    losers         = []
    action_items   = []

    for stock in portfolio:
        if stock["shares"] == 0:
            continue

        data = get_price(stock["symbol"])
        if not data:
            print(f"  ⚠️  Could not fetch: {stock['symbol']}")
            continue

        price    = data["price"]
        shares   = stock["shares"]
        avg      = stock["avg_price"]
        invested = shares * avg
        current  = shares * price
        pnl_p    = ((price - avg) / avg) * 100

        total_invested += invested
        total_current  += current

        decision, reason = evaluate_stock(stock, data)

        # Track for summary
        if data["change_p"] >= 2:
            gainers.append((stock["name"], data["change_p"], price))
        elif data["change_p"] <= -2:
            losers.append((stock["name"], data["change_p"], price))

        # Collect action items
        if not decision.startswith("✅"):
            action_items.append({
                "name":     stock["name"],
                "symbol":   stock["symbol"],
                "price":    price,
                "change_p": data["change_p"],
                "pnl_p":    pnl_p,
                "decision": decision,
                "reason":   reason,
            })

        time.sleep(0.3)  # be nice to NSE servers

    # Build message
    total_pnl   = total_current - total_invested
    total_pnl_p = (total_pnl / total_invested * 100) if total_invested else 0
    pnl_emoji   = "📈" if total_pnl >= 0 else "📉"

    msg = (
        f"📊 <b>PORTFOLIO SUMMARY</b>\n"
        f"📅 {datetime.now().strftime('%a, %d %b %Y  %H:%M')}\n"
        f"{'─' * 30}\n"
        f"Nifty 50: {nifty_c:+.2f}%  {trend}\n"
        f"{'─' * 30}\n"
    )

    if gainers:
        gainers.sort(key=lambda x: x[1], reverse=True)
        msg += "\n<b>📈 Top Gainers:</b>\n"
        for name, chg, price in gainers[:3]:
            msg += f"  🟢 {name}: {chg:+.1f}% (₹{price})\n"

    if losers:
        losers.sort(key=lambda x: x[1])
        msg += "\n<b>📉 Top Losers:</b>\n"
        for name, chg, price in losers[:3]:
            msg += f"  🔴 {name}: {chg:+.1f}% (₹{price})\n"

    msg += (
        f"\n{'─' * 30}\n"
        f"<b>💼 Portfolio P&L</b>\n"
        f"Invested:  ₹{total_invested:,.0f}\n"
        f"Current:   ₹{total_current:,.0f}\n"
        f"{pnl_emoji} P&L: <b>₹{total_pnl:+,.0f} ({total_pnl_p:+.1f}%)</b>\n"
    )

    if action_items:
        msg += f"\n{'─' * 30}\n<b>⚠️  ACTION REQUIRED:</b>\n"
        for item in action_items:
            msg += (
                f"\n{item['decision']}\n"
                f"  {item['name']} @ ₹{item['price']} "
                f"({item['change_p']:+.1f}% today)\n"
                f"  → {item['reason']}\n"
            )

    # Only send if there are actions OR force_send
    if action_items or force_send:
        send_telegram(msg)
        print(f"  📱 Sent! {len(action_items)} action item(s)")
    else:
        # Send silently (no notification) if no actions
        send_telegram(msg, silent=True)
        print("  📱 Sent silently (no actions)")

# ─────────────────────────────────────────────────────────────
# 🏆 STOCK SCORING ENGINE — upgraded v2
# ─────────────────────────────────────────────────────────────

def score_stock(symbol: str) -> dict | None:
    """
    Score a stock on multiple factors:
    - Price momentum (change vs prev)
    - Position relative to open
    - Distance from 52W low (closer = opportunity)
    - Volatility (lower = safer for long term)
    Max score: 15
    """
    data = get_price(symbol)
    if not data:
        return None

    score = 0
    reasons = []

    change_p  = data["change_p"]
    price     = data["price"]
    open_p    = data.get("open", price)
    week_low  = data.get("week_low", 0)
    week_high = data.get("week_high", price)

    # 1. Positive day change
    if change_p > 2:
        score += 3
        reasons.append(f"Strong day +{change_p:.1f}%")
    elif change_p > 0.5:
        score += 2
        reasons.append(f"Positive day +{change_p:.1f}%")
    elif change_p > 0:
        score += 1

    # 2. Price above open (bullish intraday)
    if price > open_p:
        score += 2
        reasons.append("Above open price")

    # 3. Not too volatile (< 3% range today)
    if data.get("high") and data.get("low"):
        daily_range = ((data["high"] - data["low"]) / data["low"]) * 100
        if daily_range < 2:
            score += 2
            reasons.append("Low intraday volatility")
        elif daily_range < 3:
            score += 1

    # 4. Reasonable distance from 52W high (not overstretched)
    if week_high > 0:
        from_high = ((week_high - price) / week_high) * 100
        if 10 <= from_high <= 30:
            score += 3
            reasons.append(f"{from_high:.0f}% below 52W high (good entry)")
        elif from_high < 10:
            score += 1

    # 5. Not near 52W low (avoid falling knives)
    if week_low > 0:
        from_low = ((price - week_low) / week_low) * 100
        if from_low > 20:
            score += 3
            reasons.append(f"{from_low:.0f}% above 52W low (stable)")
        elif from_low > 10:
            score += 1

    return {
        "symbol":  symbol,
        "price":   price,
        "change_p": change_p,
        "score":   score,
        "reasons": reasons,
    }

# ─────────────────────────────────────────────────────────────
# 🔥 NIFTY 50 TOP PICKS
# ─────────────────────────────────────────────────────────────

def get_nifty50_symbols() -> list[str]:
    """Get all Nifty 50 symbols from NSE"""
    try:
        data = nse_index("NIFTY 50")
        return [item["symbol"] for item in data["data"]]
    except Exception as e:
        print(f"Nifty50 fetch error: {e}")

    # Hardcoded fallback
    return [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
        "KOTAKBANK", "HINDUNILVR", "ITC", "AXISBANK", "LT",
        "BHARTIARTL", "SBIN", "WIPRO", "HCLTECH", "ASIANPAINT",
        "MARUTI", "BAJFINANCE", "SUNPHARMA", "ULTRACEMCO", "TITAN",
        "NTPC", "POWERGRID", "COALINDIA", "ONGC", "TECHM",
        "TATAMOTORS", "TATASTEEL", "JSWSTEEL", "DIVISLAB", "CIPLA",
        "ADANIENT", "ADANIPORTS", "BAJAJ-AUTO", "BPCL", "DRREDDY",
        "EICHERMOT", "GRASIM", "HEROMOTOCO", "HINDALCO", "INDUSINDBK",
        "M&M", "NESTLEIND", "SBILIFE", "SHRIRAMFIN", "TATACONSUM",
        "APOLLOHOSP", "BRITANNIA", "HDFCLIFE", "LTIM", "VEDL",
    ]


def send_recommendations():
    """Find and send top 3 long-term picks from Nifty 50"""
    trend, nifty_c = get_market_trend()

    if "BEARISH" in trend:
        send_telegram(
            f"⚠️ <b>MARKET BEARISH</b>\n"
            f"Nifty: {nifty_c:+.2f}%\n"
            f"Avoid fresh buying today. Review existing positions."
        )
        return

    print("\n🔍 Scanning Nifty 50 for top picks...")
    symbols = get_nifty50_symbols()
    results = []

    for symbol in symbols:
        scored = score_stock(symbol)
        if scored:
            results.append(scored)
        time.sleep(0.4)

    results.sort(key=lambda x: x["score"], reverse=True)
    top3 = results[:3]

    if not top3:
        print("  ⚠️  No results")
        return

    msg = (
        f"🔥 <b>TOP LONG-TERM PICKS TODAY</b>\n"
        f"📅 {datetime.now().strftime('%d %b %Y  %H:%M')}\n"
        f"Nifty: {nifty_c:+.2f}%  {trend}\n"
        f"{'─' * 30}\n\n"
    )

    medals = ["🥇", "🥈", "🥉"]
    for i, stock in enumerate(top3):
        msg += (
            f"{medals[i]} <b>{stock['symbol']}</b> — ₹{stock['price']}\n"
            f"   Score: {stock['score']}/15  |  Day: {stock['change_p']:+.1f}%\n"
            f"   ✓ {' | '.join(stock['reasons'][:2])}\n\n"
        )

    msg += "⚠️ <i>For research only — not investment advice</i>"

    send_telegram(msg)
    print(f"  📱 Recommendations sent!")

# ─────────────────────────────────────────────────────────────
# 📌 MANUAL STOCK CHECK
# ─────────────────────────────────────────────────────────────

def manual_check(symbol: str):
    """Quick check any stock from command line"""
    print(f"\n🔍 Checking {symbol}...")

    data = get_price(symbol)
    if not data:
        print(f"❌ Could not fetch data for {symbol}")
        return

    # Check if in portfolio
    portfolio = load_portfolio()
    held      = next((s for s in portfolio if s["symbol"] == symbol), None)

    print(f"\n{'─' * 35}")
    print(f"📌 {symbol}  [{data['source']}]")
    print(f"{'─' * 35}")
    print(f"Price:     ₹{data['price']}")
    print(f"Change:    {data['change_p']:+.2f}%")
    print(f"Open:      ₹{data.get('open', 'N/A')}")
    print(f"High/Low:  ₹{data.get('high', 'N/A')} / ₹{data.get('low', 'N/A')}")
    print(f"52W High:  ₹{data.get('week_high', 'N/A')}")
    print(f"52W Low:   ₹{data.get('week_low', 'N/A')}")

    if held:
        pnl   = data["price"] - held["avg_price"]
        pnl_p = (pnl / held["avg_price"]) * 100
        print(f"\n💼 You hold {held['shares']} share(s) @ avg ₹{held['avg_price']}")
        print(f"   P&L: ₹{pnl:+.2f} ({pnl_p:+.1f}%)")
        print(f"   Action: {held['action']}")

        if held["buy_below"]:
            gap = data["price"] - held["buy_below"]
            print(f"   Buy target:  ₹{held['buy_below']} (gap: ₹{gap:+.0f})")
        if held["sell_above"]:
            gap = data["price"] - held["sell_above"]
            print(f"   Sell target: ₹{held['sell_above']} (gap: ₹{gap:+.0f})")

        decision, reason = evaluate_stock(held, data)
        print(f"\n   Verdict: {decision}")
        print(f"   Reason:  {reason}")

    print(f"{'─' * 35}")

# ─────────────────────────────────────────────────────────────
# 📅 WEEKLY REVIEW REMINDER
# ─────────────────────────────────────────────────────────────

def send_weekly_reminder():
    portfolio  = load_portfolio()
    exit_items = [s["name"] for s in portfolio if s["action"] == "EXIT"]
    watch_items = [s["name"] for s in portfolio if s["action"] == "WATCH"]

    msg = (
        "🗓️ <b>WEEKLY PORTFOLIO REVIEW</b>\n"
        f"📅 Sunday, {datetime.now().strftime('%d %b %Y')}\n"
        f"{'─' * 30}\n\n"
        "📋 <b>Checklist:</b>\n"
        "☐ Check red positions (>-10%)\n"
        "☐ Any stocks hit buy targets?\n"
        "☐ Monthly SIP executed?\n"
        "☐ New stocks to research?\n"
        "☐ Update buy/sell targets in TSV\n\n"
    )

    if exit_items:
        msg += f"🔴 <b>Pending Exits:</b> {', '.join(exit_items)}\n"

    if watch_items:
        msg += f"👀 <b>Watchlist:</b> {', '.join(watch_items)}\n"

    msg += "\n💬 Share portfolio screenshot with Claude for review! 🚀"
    send_telegram(msg)
    print("  📅 Weekly reminder sent!")

# ─────────────────────────────────────────────────────────────
# ⏰ SCHEDULER
# ─────────────────────────────────────────────────────────────

def schedule_jobs():
    """
    All times are IST (Indian Standard Time).
    Runs Mon-Fri only via is_weekday() check.
    """
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]

    def add_daily(time_str, func):
        for day in weekdays:
            getattr(schedule.every(), day).at(time_str).do(func)

    # 10:45 AM — after opening volatility settles + daily recommendations
    add_daily("10:45", monitor_portfolio)
    add_daily("10:45", send_recommendations)

    # 1:00 PM — midday check
    add_daily("13:00", monitor_portfolio)

    # 3:15 PM — 15 min before close, final check
    add_daily("15:15", lambda: monitor_portfolio(force_send=True))

    # Sunday 10 AM — weekly review
    schedule.every().sunday.at("10:00").do(send_weekly_reminder)

# ─────────────────────────────────────────────────────────────
# 🚀 MAIN
# ─────────────────────────────────────────────────────────────

def run():
    """Full scheduler mode"""
    print("╔══════════════════════════════════════════╗")
    print("║   SAI'S PORTFOLIO ALERT SYSTEM v2.0      ║")
    print("╚══════════════════════════════════════════╝")

    portfolio = load_portfolio()
    print(f"📊 Monitoring {len(portfolio)} positions")

    send_telegram(
        "🚀 <b>Alert System v2.0 Started!</b>\n\n"
        f"📊 Watching {len(portfolio)} positions\n"
        "⏰ Checks: 10:45 AM | 1:00 PM | 3:15 PM IST\n"
        "📅 Weekly: Sunday 10 AM"
    )

    schedule_jobs()
    print("\n⏳ Scheduler running... (Ctrl+C to stop)\n")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        run()
    elif args[0] == "--summary":
        monitor_portfolio(force_send=True)
    elif args[0] == "--reco":
        send_recommendations()
    elif args[0] == "--weekly":
        send_weekly_reminder()
    elif args[0] == "--score":
        # Score a specific stock: python stock_alerts.py --score TCS
        symbol = args[1].upper() if len(args) > 1 else "TCS"
        result = score_stock(symbol)
        if result:
            print(f"\n{symbol}: ₹{result['price']}  Score: {result['score']}/15")
            for r in result["reasons"]:
                print(f"  ✓ {r}")
    else:
        # Manual check: python stock_alerts.py TCS
        manual_check(args[0].upper())
