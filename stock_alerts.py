import requests
import schedule
import time
import os
from datetime import datetime
from kiteconnect import KiteConnect
from nsepython import nse_eq, nse_index
from dotenv import load_dotenv

load_dotenv()  # loads .env file

# ─────────────────────────────────────────────
# 🔧 CONFIG
# ─────────────────────────────────────────────

API_KEY = os.getenv("API_KEY")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN")
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")

kite = KiteConnect(api_key=API_KEY)
kite.set_access_token(ACCESS_TOKEN)

# ─────────────────────────────────────────────
# 📱 TELEGRAM
# ─────────────────────────────────────────────

def send_telegram(msg):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={
            "chat_id": CHAT_ID,
            "text": msg,
            "parse_mode": "HTML"
        })
    except Exception as e:
        print("Telegram error:", e)

# ─────────────────────────────────────────────
# 📊 FETCH PORTFOLIO (ZERODHA)
# ─────────────────────────────────────────────

def get_portfolio():
    holdings = kite.holdings()
    portfolio = []

    for h in holdings:
        if h["quantity"] == 0:
            continue

        portfolio.append({
            "symbol": h["tradingsymbol"],
            "shares": h["quantity"],
            "avg_price": h["average_price"]
        })

    return portfolio

# ─────────────────────────────────────────────
# 📊 NSE PRICE FETCH
# ─────────────────────────────────────────────

def get_price(symbol):
    try:
        data = nse_eq(symbol)
        return {
            "price": data["priceInfo"]["lastPrice"],
            "change_p": data["priceInfo"]["pChange"]
        }
    except:
        return None
    
# ─────────────────────────────────────────────
# 📊 MANUAL MODE
# ─────────────────────────────────────────────

def manual(symbol):
    data = get_price(symbol)
    if not data:
        print("No data")
        return

    print(f"\n📊 {symbol}")
    print(f"Price: ₹{data['price']}")
    print(f"Change: {data['change_p']}%")

# ─────────────────────────────────────────────
# 📊 MARKET TREND
# ─────────────────────────────────────────────

def get_market_trend():
    try:
        data = nse_index("NIFTY 50")
        change = data["data"][0]["pChange"]

        if change > 0.5:
            return "BULLISH"
        elif change < -0.5:
            return "BEARISH"
        else:
            return "SIDEWAYS"
    except:
        return "UNKNOWN"

# ─────────────────────────────────────────────
# 🧠 PORTFOLIO DECISION ENGINE
# ─────────────────────────────────────────────

def evaluate_portfolio(stock, price):
    avg = stock["avg_price"]
    pnl = ((price - avg) / avg) * 100

    if pnl < -10:
        return "EXIT", "Cut losses"

    if pnl > 25:
        return "PARTIAL SELL", "Book profits"

    if pnl > 10:
        return "HOLD", "Strong position"

    if pnl < -5:
        return "REVIEW", "Weak stock"

    return "HOLD", "Normal"

# ─────────────────────────────────────────────
# 🔔 PORTFOLIO MONITOR
# ─────────────────────────────────────────────

def monitor_portfolio():
    portfolio = get_portfolio()
    trend = get_market_trend()

    total_invested = 0
    total_value = 0
    alerts = []

    for stock in portfolio:
        data = get_price(stock["symbol"])
        if not data:
            continue

        price = data["price"]
        shares = stock["shares"]
        avg = stock["avg_price"]

        invested = shares * avg
        value = shares * price

        total_invested += invested
        total_value += value

        decision, reason = evaluate_portfolio(stock, price)

        if decision in ["EXIT", "PARTIAL SELL", "REVIEW"]:
            alerts.append(
                f"{decision} — {stock['symbol']} | ₹{price} | {reason}"
            )

        time.sleep(0.3)

    total_pnl = total_value - total_invested
    pnl_percent = (total_pnl / total_invested) * 100 if total_invested else 0

    msg = f"""
📊 <b>PORTFOLIO UPDATE</b>

💼 Invested: ₹{int(total_invested)}
📤 Current: ₹{int(total_value)}
📈 PnL: ₹{int(total_pnl)} ({pnl_percent:+.2f}%)

📉 Market: {trend}
"""

    if alerts:
        msg += "\n⚠️ <b>ACTIONS:</b>\n"
        for a in alerts:
            msg += f"• {a}\n"

    msg += f"\n⏰ {datetime.now().strftime('%H:%M')}"

    send_telegram(msg)
    print("Portfolio check done")

# ─────────────────────────────────────────────
# 📈 STOCK SCORING ENGINE
# ─────────────────────────────────────────────

def score_stock(symbol):
    try:
        data = nse_eq(symbol)

        price = data["priceInfo"]["lastPrice"]
        change = data["priceInfo"]["pChange"]
        open_price = data["priceInfo"]["open"]

        score = 0

        if change > 1:
            score += 3
        elif change > 0:
            score += 2

        if abs(change) < 2:
            score += 2

        if price > open_price:
            score += 3

        return {
            "symbol": symbol,
            "price": price,
            "score": score
        }

    except:
        return None

# ─────────────────────────────────────────────
# 🔥 DYNAMIC STOCK LIST (NIFTY 50)
# ─────────────────────────────────────────────

def get_nifty50_symbols():
    try:
        data = nse_index("NIFTY 50")
        return [item["symbol"] for item in data["data"]]
    except:
        return []

# ─────────────────────────────────────────────
# 🔥 FIND TOP STOCKS
# ─────────────────────────────────────────────

def find_top_stocks():
    symbols = get_nifty50_symbols()
    results = []

    for s in symbols:
        data = score_stock(s)
        if data:
            results.append(data)

        time.sleep(0.5)

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:3]

# ─────────────────────────────────────────────
# 📢 SEND RECOMMENDATIONS
# ─────────────────────────────────────────────

def send_recommendations():
    trend = get_market_trend()

    if trend == "BEARISH":
        send_telegram("⚠️ Market bearish — avoid fresh buying")
        return

    picks = find_top_stocks()

    msg = "🔥 <b>TOP LONG-TERM STOCKS</b>\n\n"

    for p in picks:
        msg += f"{p['symbol']} — ₹{p['price']} (Score: {p['score']}/10)\n"

    msg += f"\n📈 Market: {trend}"
    msg += f"\n⏰ {datetime.now().strftime('%H:%M')}"

    send_telegram(msg)

# ─────────────────────────────────────────────
# ⏰ SAFE WRAPPERS
# ─────────────────────────────────────────────

def is_weekday():
    return datetime.now().weekday() < 5

def safe_monitor():
    if is_weekday():
        monitor_portfolio()

def safe_recommendation():
    if is_weekday():
        send_recommendations()

# ─────────────────────────────────────────────
# ⏰ SCHEDULER
# ─────────────────────────────────────────────

def schedule_jobs():
    times = ["10:45", "13:00", "15:00"]

    for t in times:
        schedule.every().monday.at(t).do(safe_monitor)
        schedule.every().tuesday.at(t).do(safe_monitor)
        schedule.every().wednesday.at(t).do(safe_monitor)
        schedule.every().thursday.at(t).do(safe_monitor)
        schedule.every().friday.at(t).do(safe_monitor)

    # Daily recommendation
    schedule.every().monday.at("10:45").do(safe_recommendation)
    schedule.every().tuesday.at("10:45").do(safe_recommendation)
    schedule.every().wednesday.at("10:45").do(safe_recommendation)
    schedule.every().thursday.at("10:45").do(safe_recommendation)
    schedule.every().friday.at("10:45").do(safe_recommendation)

# ─────────────────────────────────────────────
# ▶️ MAIN
# ─────────────────────────────────────────────

def run():
    print("🚀 PRO SYSTEM STARTED")
    schedule_jobs()

    while True:
        schedule.run_pending()
        time.sleep(30)

# ─────────────────────────────────────────────
# ▶️ MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        manual(sys.argv[1])
    else:
        run()