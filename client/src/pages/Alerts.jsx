import { useEffect, useState } from "react";
import api from "../api/axios";

const ALERT_META = {
  BUY_MORE:         { cls: "chip-green",  icon: "🟢", label: "Buy More" },
  BOOK_PROFIT:      { cls: "chip-yellow", icon: "🎯", label: "Book Profit" },
  PARTIAL_SELL:     { cls: "chip-yellow", icon: "💰", label: "Partial Sell" },
  STOP_LOSS:        { cls: "chip-red",    icon: "🔴", label: "Stop Loss" },
  ACCUMULATE:       { cls: "chip-blue",   icon: "📥", label: "Accumulate" },
  NEAR_52W_LOW:     { cls: "chip-blue",   icon: "🔍", label: "Near 52W Low" },
  WATCHLIST_TARGET: { cls: "chip-green",  icon: "🟢", label: "Buy Signal" },
};

function notifyNavbar() {
  window.dispatchEvent(new CustomEvent("alerts-changed"));
}

export default function Alerts() {
  const [alerts,   setAlerts]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [clearing, setClearing] = useState(false);
  const [filter,   setFilter]   = useState("all");

  async function fetchAlerts() {
    const params = filter === "unread" ? "?unread=true&limit=100" : "?limit=100";
    const { data } = await api.get(`/alerts${params}`);
    setAlerts(data.alerts);
    setUnread(data.unreadCount);
    setLoading(false);
    notifyNavbar();
  }

  useEffect(() => { fetchAlerts(); }, [filter]);

  async function markRead(id) {
    await api.put(`/alerts/${id}/read`);
    setAlerts(a => a.map(x => x._id === id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
    notifyNavbar();
  }

  async function markAllRead() {
    await api.put("/alerts/read-all");
    setAlerts(a => a.map(x => ({ ...x, read: true })));
    setUnread(0);
    notifyNavbar();
  }

  async function deleteAlert(id) {
    await api.delete(`/alerts/${id}`);
    setAlerts(a => a.filter(x => x._id !== id));
    notifyNavbar();
  }

  async function clearAll() {
    setClearing(true);
    try {
      await api.delete("/alerts");
      setAlerts([]);
      setUnread(0);
      notifyNavbar();
    } finally { setClearing(false); }
  }

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-meta">
            {unread > 0 ? `${unread} unread · ` : ""}{alerts.length} total
          </div>
        </div>
        <div className="flex gap-8">
          {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
          <button className="btn btn-danger btn-sm" onClick={clearAll} disabled={clearing || alerts.length === 0}>
            {clearing ? <span className="spinner spinner-sm" /> : "Clear all"}
          </button>
        </div>
      </div>

      <div className="flex gap-8 mb-16">
        {[
          { k: "all",    l: `All (${alerts.length})` },
          { k: "unread", l: `Unread${unread > 0 ? ` (${unread})` : ""}` },
        ].map(f => (
          <button key={f.k} className={`btn btn-sm ${filter === f.k ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f.k)}>
            {f.l}
          </button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🔔</div>
          <div>{filter === "unread" ? "No unread alerts." : "No alerts yet — run an analysis from the dashboard."}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 20px" }}>
          {alerts.map((a, idx) => {
            const meta = ALERT_META[a.type] || ALERT_META.HOLD;
            return (
              <div key={a._id} className={`alert-item ${!a.read ? "unread" : ""}`}
                style={{ borderBottom: idx < alerts.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="alert-icon">{meta.icon}</div>
                <div className="alert-body">
                  <div className="alert-title-row">
                    <span className="font-bold" style={{ fontSize: 14, letterSpacing: -0.2 }}>{a.symbol}</span>
                    <span className={`chip ${meta.cls}`} style={{ fontSize: 10 }}>{meta.label}</span>
                    {!a.read && <span className="chip chip-cyan" style={{ fontSize: 10 }}>New</span>}
                    <span className="alert-time">
                      {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>{a.message}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
                    <span>₹{a.price}</span>
                    {a.changeP != null && (
                      <span className={a.changeP >= 0 ? "text-green" : "text-red"}>
                        {a.changeP >= 0 ? "+" : ""}{a.changeP?.toFixed(2)}% today
                      </span>
                    )}
                    <span className="chip chip-muted" style={{ fontSize: 10 }}>{a.source}</span>
                  </div>
                </div>
                <div className="flex gap-8" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                  {!a.read && <button className="btn btn-ghost btn-sm" onClick={() => markRead(a._id)}>✓ Read</button>}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteAlert(a._id)}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
