# 🚀 Sai's Stock Alert System — Pro Setup Guide

## 🧠 Overview

This is a **fully dynamic stock monitoring system** that:

* 📊 Fetches your **real portfolio** from Zerodha (Kite API)
* 📈 Uses NSE data via `nsepython`
* 🔔 Sends **Telegram alerts** at key market times
* 🧠 Provides **buy/sell/hold decisions**
* 🔥 Recommends **top long-term stocks daily**

---

# ⚡ Quick Start (Local Testing)

```bash
# 1. Install dependencies
pip install kiteconnect nsepython schedule requests

# 2. Add your credentials in script
#    API_KEY, ACCESS_TOKEN, BOT_TOKEN, CHAT_ID

# 3. Run system
python your_script.py
```

---

# 🤖 Step 1: Create Telegram Bot

1. Open Telegram → Search **@BotFather**
2. Send `/newbot`
3. Give name (e.g., "Sai Portfolio Alerts")
4. Copy the **BOT_TOKEN**
5. Open **@userinfobot**
6. Copy your **CHAT_ID**
7. Add both in your script

---

# 🔑 Step 2: Zerodha Setup (Kite API)

1. Go to Kite Connect dashboard
2. Create a new app
3. Get:

   * `API_KEY`
   * `API_SECRET`
4. Generate **ACCESS_TOKEN**

👉 Add to script:

```python
API_KEY = "your_api_key"
ACCESS_TOKEN = "your_access_token"
```

⚠️ Note: Access token expires daily (manual refresh needed for now)

---

# ⏰ How Alerts Work

## 📅 Active Days

* Monday → Friday only

## 🕙 Alert Times

| Time     | Action                      |
| -------- | --------------------------- |
| 10:45 AM | Portfolio + Recommendations |
| 1:00 PM  | Portfolio Check             |
| 3:00 PM  | Portfolio Check             |

---

# 🔔 Alert Types

### 📊 Portfolio Update

* Total invested
* Current value
* Overall P&L

### ⚠️ Action Alerts

Triggered only when needed:

* ❌ **EXIT** → Loss > 10%
* 💰 **PARTIAL SELL** → Profit > 25%
* ⚠️ **REVIEW** → Weak stock

---

### 🔥 Daily Recommendations (10:45 AM)

* Top 3 stocks from NIFTY 50
* Based on:

  * Momentum
  * Stability
  * Price strength

---

# ☁️ Deployment (Recommended)

## 🚀 Deploy on Railway

```bash
# Push code to GitHub
git init
git add .
git commit -m "stock bot"
git push origin main
```

### Then:

1. Go to Railway.app
2. New Project → Deploy from GitHub
3. Select repo
4. Add environment variables:

```bash
API_KEY=xxx
ACCESS_TOKEN=xxx
BOT_TOKEN=xxx
CHAT_ID=xxx
```

5. Start command:

```bash
python your_script.py
```

---

# 🧠 Architecture

```
Zerodha API → Portfolio
        ↓
nsepython → Live Market Data
        ↓
Decision Engine
        ↓
Telegram Alerts
        ↓
Scheduler (Timed Execution)
```

---

# 📱 Notes

* ❌ No hardcoded stocks
* ✅ Fully dynamic portfolio
* ❌ No Yahoo Finance dependency
* ✅ Uses NSE + Zerodha only

---

# ⚠️ Important

* Zerodha **ACCESS_TOKEN expires daily**
* You must refresh it manually (for now)

---

# 🚀 Future Upgrades (Optional)

* 🔁 Auto-refresh Zerodha token
* 📊 Sector-based stock picking
* 🧠 Fundamental analysis (PE, ROE)
* 🔕 Alert only on changes (no repetition)
* 📈 Chart integration

---

## 💬 Final Note

This is a **decision-support system**, not a trading bot.
Always validate before executing trades.

---

python stock_alerts.py           # full scheduler
python stock_alerts.py TCS       # check any stock
python stock_alerts.py --summary # instant P&L
python stock_alerts.py --reco    # instant top picks
python stock_alerts.py --score TCS  # score a stock

Built for Sai's Portfolio 🚀
