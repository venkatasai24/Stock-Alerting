# StockAlert

Full-stack NSE portfolio monitoring app with real-time alerts, AI signals, and Telegram notifications.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, React Router v6, Recharts |
| Backend | Node.js + Express (ES modules) |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (localStorage) |
| Market Data | Yahoo Finance NSE API (`.NS` suffix) |
| Real-time | Server-Sent Events (SSE) for badge push |
| Notifications | Telegram Bot API |

## Features

- **Auth** — register / login with JWT
- **Portfolio** — add stocks with avg buy price, targets, priority, stop-loss; live P&L
- **Decision engine** — 7 alert types based on price vs targets, P&L %, 52W range, intraday momentum
- **Watchlist** — track stocks you don't own with a target buy price; 5-signal analysis with scored verdict
- **Alerts** — real-time unread badge via SSE; per-day dedup prevents duplicate alerts
- **Nifty 50 Picks** — live scoring of all 50 Nifty stocks, top 5 shown on dashboard
- **Market trend** — Nifty 50 live price, change %, bull/bear/sideways label
- **Scheduled analysis** — runs at :30 past each hour, 9:30 AM–3:30 PM IST, Mon–Fri
- **Manual trigger** — "Run Analysis" button on dashboard
- **Telegram alerts** — optional per-user or global chat ID
- **Dark / Light theme** — persisted in localStorage
- **Mobile responsive** — bottom navigation bar, pie chart, search

## Alert Types

| Type | Trigger |
|------|---------|
| BUY_MORE | Price ≤ `buyBelow` target |
| BOOK_PROFIT | Price ≥ `sellAbove` target |
| PARTIAL_SELL | P&L ≥ +25% and price near 52W high |
| STOP_LOSS | P&L ≤ stop-loss threshold |
| ACCUMULATE | Price dipped ≥ 3% from avg, not at buy target yet |
| NEAR_52W_LOW | Price within 8% of 52-week low |
| WATCHLIST_TARGET | Watchlist stock at or below target buy price |

## Local Development

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure server

Copy `server/.env.example` to `server/.env` and fill in:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/stock-alerting
JWT_SECRET=a_long_random_secret
CLIENT_URL=http://localhost:5173
BOT_TOKEN=           # optional — Telegram bot token
CHAT_ID=             # optional — fallback Telegram chat ID
```

### 3. Run

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open http://localhost:5173

## Production Deployment

### Backend → Render

1. Push repo to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables (same as `.env` above, with production values):
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `JWT_SECRET` — random secret (32+ chars)
   - `CLIENT_URL` — your Vercel URL, e.g. `https://stockalert.vercel.app`
   - `BOT_TOKEN`, `CHAT_ID` — optional

### Frontend → Vercel

1. Create a **new project** on [vercel.com](https://vercel.com), import your GitHub repo
   - Root directory: `client`
   - Framework preset: **Vite**
2. Add environment variable:
   - `VITE_API_URL` = `https://your-render-service.onrender.com/api`
3. Deploy

> The Vite proxy (`/api → localhost:5000`) is dev-only. In production, `VITE_API_URL` points directly to Render.

## Project Structure

```
stock-alerting/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── api/axios.js     # Axios instance (VITE_API_URL aware)
│       ├── components/      # Navbar (SSE badge), StockModal, etc.
│       ├── pages/           # Dashboard, Portfolio, Watchlist, Alerts
│       ├── hooks/           # useAutoRefresh, useTheme
│       └── utils/           # marketStatus, decisionEngine helpers
└── server/                  # Express backend
    └── src/
        ├── routes/          # auth, portfolio, watchlist, market, alerts (SSE)
        ├── models/          # User, PortfolioStock, WatchlistStock, Alert
        ├── services/        # nse.js, decisionEngine.js, telegram.js, alertEmitter.js
        ├── jobs/            # scheduler.js — cron + analysis functions
        └── index.js         # Express entry point
```
