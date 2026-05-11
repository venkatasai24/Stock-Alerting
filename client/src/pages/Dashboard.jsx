import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getMarketStatus } from "../utils/marketStatus";

const ALERT_META = {
  BUY_MORE:         { cls: "chip-green",  icon: "🟢", label: "Buy More" },
  BOOK_PROFIT:      { cls: "chip-yellow", icon: "🎯", label: "Book Profit" },
  PARTIAL_SELL:     { cls: "chip-yellow", icon: "💰", label: "Partial Sell" },
  STOP_LOSS:        { cls: "chip-red",    icon: "🔴", label: "Stop Loss" },
  ACCUMULATE:       { cls: "chip-blue",   icon: "📥", label: "Accumulate" },
  NEAR_52W_LOW:     { cls: "chip-blue",   icon: "🔍", label: "Near 52W Low" },
  WATCHLIST_TARGET: { cls: "chip-green",  icon: "🟢", label: "Buy Signal" },
};

function TrendBanner({ market }) {
  if (!market) return null;

  const isHoliday = market.trend === "HOLIDAY";
  const cls   = market.trend === "BULLISH" ? "trend-bull" : market.trend === "BEARISH" ? "trend-bear" : "trend-side";
  const arrow = market.trend === "BULLISH" ? "▲" : market.trend === "BEARISH" ? "▼" : "—";
  const color = market.trend === "BULLISH" ? "var(--green)" : market.trend === "BEARISH" ? "var(--red)" : "var(--yellow)";

  return (
    <div className={`trend-banner ${isHoliday ? "trend-holiday" : cls}`}>
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Nifty 50</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: "var(--text)" }}>
            ₹{market.price?.toLocaleString("en-IN")}
          </span>
          {isHoliday ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "var(--bg2)", padding: "2px 10px", borderRadius: 99 }}>
              NSE Holiday · 0.00%
            </span>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color }}>
              {arrow} {market.changeP >= 0 ? "+" : ""}{market.changeP?.toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>
          {isHoliday ? "" : `${market.trend} · `}
          {new Date().toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const marketOpen = getMarketStatus().open;
  const [market,    setMarket]    = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [picks,     setPicks]     = useState(null);
  const [picksLoad, setPicksLoad] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [loading,   setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [mkt, alts] = await Promise.all([
        api.get("/market/trend"),
        api.get("/alerts?limit=6"),
      ]);
      setMarket(mkt.data);
      setAlerts(alts.data.alerts);
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastUpdated, refreshing, refresh } = useAutoRefresh(fetchData, 60000);

  const loadPicks = useCallback(async () => {
    setPicksLoad(true);
    try {
      const { data } = await api.get("/market/picks");
      setPicks(data);
    } catch { setPicks(null); } finally { setPicksLoad(false); }
  }, []);

  // Auto-load picks on mount, refresh every 5 minutes
  useEffect(() => {
    loadPicks();
    const id = setInterval(loadPicks, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadPicks]);

  async function runAnalysis() {
    setAnalysing(true);
    try {
      await api.post("/alerts/run-analysis");
      setTimeout(refresh, 3000);
    } catch {} finally { setAnalysing(false); }
  }

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-meta">
            {refreshing ? "Refreshing…" : lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Loading…"}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? <><span className="spinner spinner-sm" /> Refreshing…</> : "⟳ Refresh"}
          </button>
          <button className="btn btn-primary" onClick={runAnalysis} disabled={analysing}>
            {analysing ? <><span className="spinner spinner-sm" /> Running…</> : "▶ Run Analysis"}
          </button>
        </div>
      </div>

      <TrendBanner market={market} />

      <div className="grid-2 mt-16">
        {/* Recent Alerts */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="section-title">Recent Alerts</div>
              <div className="page-meta" style={{ marginTop: 2 }}>From your last analysis run</div>
            </div>
            <Link to="/alerts" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
          </div>

          {alerts.length === 0 ? (
            <div className="empty" style={{ padding: "36px 20px" }}>
              <div className="empty-icon">🔔</div>
              <div style={{ fontSize: 13 }}>No alerts yet</div>
              <button className="btn btn-primary btn-sm mt-16" onClick={runAnalysis} disabled={analysing}>
                {analysing ? "Running…" : "Run Analysis"}
              </button>
            </div>
          ) : (
            <div style={{ padding: "4px 20px" }}>
              {alerts.map((a, idx) => {
                const meta = ALERT_META[a.type] ?? { cls: "chip-muted", icon: "📊", label: a.type };
                return (
                  <div key={a._id} className={`alert-item ${!a.read ? "unread" : ""}`}
                    style={{ borderBottom: idx < alerts.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div className="alert-icon">{meta.icon}</div>
                    <div className="alert-body">
                      <div className="alert-title-row">
                        <span className="font-bold" style={{ fontSize: 13 }}>{a.symbol}</span>
                        <span className={`chip ${meta.cls}`} style={{ fontSize: 10 }}>{meta.label}</span>
                        <span className="alert-time">
                          {new Date(a.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{a.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Nifty Picks — auto-loads */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="section-title">Top Nifty 50 Picks</div>
              <div className="page-meta" style={{ marginTop: 2 }}>Live scores · auto-refreshes every 5 min</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadPicks} disabled={picksLoad}>
              {picksLoad ? <span className="spinner spinner-sm" /> : "⟳"}
            </button>
          </div>

          {picksLoad && !picks && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px" }}>
              <div className="spinner" />
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Scoring 50 Nifty stocks live…</div>
            </div>
          )}

          {picks?.bearish && (
            <div className="empty" style={{ padding: "36px 20px" }}>
              <div className="empty-icon" style={{ fontSize: 32 }}>🔴</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Market is bearish — avoid fresh entries today</div>
            </div>
          )}

          {picks && !picks.bearish && picks.top && (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {picks.top.map((s, i) => (
                <div key={s.symbol} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 22px",
                  borderBottom: i < picks.top.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", minWidth: 22 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: -0.2 }}>{s.symbol}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: !marketOpen ? "var(--muted)" : s.changeP >= 0 ? "var(--green)" : "var(--red)" }}>
                        {!marketOpen ? "0.00%" : `${s.changeP >= 0 ? "▲" : "▼"} ${Math.abs(s.changeP).toFixed(2)}%`}
                      </span>
                    </div>
                    {s.reasons[0] && (
                      <div style={{ fontSize: 11, color: "var(--primary)" }}>✓ {s.reasons[0]}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>₹{s.price}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Score {s.score}/13</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
