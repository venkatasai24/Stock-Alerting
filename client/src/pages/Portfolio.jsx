import { useEffect, useState, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getMarketStatus } from "../utils/marketStatus";
import api from "../api/axios";
import StockModal from "../components/StockModal";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

const DECISION_STYLE = {
  BUY_MORE:     { cls: "chip-green",  icon: "🟢", label: "Buy More" },
  BOOK_PROFIT:  { cls: "chip-yellow", icon: "🎯", label: "Book Profit" },
  PARTIAL_SELL: { cls: "chip-yellow", icon: "💰", label: "Partial Sell" },
  STOP_LOSS:    { cls: "chip-red",    icon: "🔴", label: "Stop Loss" },
  ACCUMULATE:   { cls: "chip-blue",   icon: "📥", label: "Accumulate" },
  NEAR_52W_LOW: { cls: "chip-blue",   icon: "🔍", label: "Near 52W Low" },
  HOLD:         { cls: "chip-muted",  icon: "✅", label: "Hold" },
};

const LTV_COLOR = {
  green:  "var(--green)",
  blue:   "var(--blue)",
  yellow: "var(--yellow)",
  muted:  "var(--muted)",
};

const PIE_COLORS = [
  "#06b6d4","#10b981","#f59e0b","#8b5cf6","#f43f5e",
  "#3b82f6","#e879f9","#fb923c","#4ade80","#818cf8",
];

const inr = (v) => "₹" + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const pct = (v, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d) + "%";

/* ── Pie tooltip ── */
function PieTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="font-bold" style={{ color: d.payload.fill }}>{d.name}</div>
      <div className="text-muted" style={{ marginTop: 2 }}>
        {inr(d.value)} · {((d.value / total) * 100).toFixed(1)}%
      </div>
    </div>
  );
}

/* ── Allocation donut — chart only, no legend ── */
function DonutChart({ data, total }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data} cx="50%" cy="50%"
          innerRadius="52%" outerRadius="80%"
          paddingAngle={3} dataKey="value"
          startAngle={90} endAngle={-270}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip total={total} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Stock detail modal (opens when row clicked) ── */
function StockDetailModal({ s, onEdit, onDelete, onClose }) {
  const ld         = s.ld;
  const marketOpen = getMarketStatus().open;
  const ds  = ld?.decision ? DECISION_STYLE[ld.decision.type] || DECISION_STYLE.HOLD : null;
  const ltv = ld?.decision?.longTermView;
  const pos = s.pnlP != null && s.pnlP >= 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ letterSpacing: -0.3 }}>{s.symbol}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.name}</div>
          </div>
          {ds && <span className={`chip ${ds.cls}`} style={{ fontSize: 11 }}>{ds.icon} {ds.label}</span>}
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 8 }}>×</button>
        </div>

        {/* live price */}
        {ld && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, padding: "12px 16px", background: "var(--bg2)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
              ₹{ld.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: !marketOpen ? "var(--muted)" : ld.changeP >= 0 ? "var(--green)" : "var(--red)" }}>
              {!marketOpen ? "0.00% today" : `${ld.changeP >= 0 ? "▲" : "▼"} ${Math.abs(ld.changeP).toFixed(2)}% today`}
            </span>
          </div>
        )}

        {/* position stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Shares",    val: s.shares },
            { label: "Avg Buy",   val: `₹${s.avgPrice.toLocaleString("en-IN")}` },
            { label: "Invested",  val: inr(s.invested) },
            { label: "Current",   val: s.current != null ? inr(s.current) : "—" },
            { label: "P&L",       val: s.pnlVal != null ? `${pos ? "+" : "−"}${inr(s.pnlVal)}` : "—", color: pos ? "var(--green)" : "var(--red)" },
            { label: "Returns",   val: s.pnlP   != null ? pct(s.pnlP) : "—",                          color: pos ? "var(--green)" : "var(--red)" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
              <div className="stat-label" style={{ marginBottom: 5 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: color || "var(--text)" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* analysis */}
        {ld?.decision && (
          <div style={{ padding: "14px 16px", background: "var(--bg2)", borderRadius: "var(--radius)", marginBottom: 20 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Long-term Analysis</div>
            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{ld.decision.message}</div>
            {ltv && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: LTV_COLOR[ltv.color] || "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  {ltv.rating}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{ltv.note}</div>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Remove</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={onEdit}>Edit Position</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function Portfolio() {
  const [stocks,     setStocks]     = useState([]);
  const [liveMap,    setLiveMap]    = useState({});
  const [summary,    setSummary]    = useState(null);
  const [liveError,  setLiveError]  = useState(null);
  const [modal,      setModal]      = useState(null);   // "add" | stock object (edit)
  const [detailStock,setDetailStock]= useState(null);   // stock for detail modal
  const [loading,    setLoading]    = useState(true);
  const [deleteId,   setDeleteId]   = useState(null);
  const [sort,        setSort]        = useState({ key: "pnlP", dir: "desc" });
  const [filter,      setFilter]      = useState("all");
  const [search,      setSearch]      = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);

  async function fetchStocks() {
    const { data } = await api.get("/portfolio");
    setStocks(data);
    setLoading(false);
  }

  const fetchLiveData = useCallback(async () => {
    setLiveError(null);
    try {
      const { data } = await api.get("/portfolio/summary/live");
      const map = {};
      data.stocks.forEach(s => {
        if (s.data) map[s.stock._id] = { ...s.data, decision: s.decision };
      });
      setLiveMap(map);
      setSummary(data);
    } catch (e) {
      setLiveError(e.response?.data?.message || "Could not load live prices");
    }
  }, []);

  const { lastUpdated, refreshing, refresh } = useAutoRefresh(fetchLiveData, 60000);

  useEffect(() => { fetchStocks(); }, []);

  useEffect(() => {
    function handler(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSave(payload) {
    if (modal === "add") await api.post("/portfolio", payload);
    else await api.put(`/portfolio/${modal._id}`, payload);
    await fetchStocks();
    refresh();
  }

  async function handleDelete(id) {
    await api.delete(`/portfolio/${id}`);
    setDeleteId(null);
    setDetailStock(null);
    setStocks(s => s.filter(x => x._id !== id));
    setLiveMap(m => { const n = { ...m }; delete n[id]; return n; });
  }

  const enriched = stocks.map(s => {
    const ld         = liveMap[s._id];
    const invested   = s.shares * s.avgPrice;
    const current    = ld ? s.shares * ld.price : null;
    const pnlVal     = current != null ? current - invested : null;
    const pnlP       = pnlVal  != null ? (pnlVal / invested) * 100 : null;
    const allocation = summary?.totalCurrent ? (current / summary.totalCurrent) * 100 : null;
    return { ...s, ld, invested, current, pnlVal, pnlP, allocation };
  });

  const SORT_DEFAULT_DIR = { pnlP: "desc", invested: "desc", current: "desc", dayChange: "desc", name: "asc" };

  function handleSort(key) {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
      : { key, dir: SORT_DEFAULT_DIR[key] ?? "desc" }
    );
  }

  const d   = sort.dir === "asc" ? 1 : -1;
  const sorted = [...enriched].sort((a, b) => {
    switch (sort.key) {
      case "pnlP":      return d * ((a.pnlP ?? -Infinity) - (b.pnlP ?? -Infinity));
      case "invested":  return d * (a.invested - b.invested);
      case "current":   return d * ((a.current ?? 0) - (b.current ?? 0));
      case "dayChange": return d * ((a.ld?.changeP ?? -Infinity) - (b.ld?.changeP ?? -Infinity));
      case "name":      return d * a.symbol.localeCompare(b.symbol);
      default:          return 0;
    }
  });
  const filtered = sorted.filter(s => {
    if (filter === "gainers") return s.pnlP != null && s.pnlP >= 0;
    if (filter === "losers")  return s.pnlP != null && s.pnlP  < 0;
    return true;
  });
  const q        = search.trim().toLowerCase();
  const displayed = q
    ? filtered.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    : filtered;

  const hasActiveFilters = sort.key !== "pnlP" || sort.dir !== "desc" || filter !== "all";

  function dirText(key, dir) {
    if (key === "name") return dir === "asc" ? "A → Z" : "Z → A";
    return dir === "desc" ? "High → Low" : "Low → High";
  }

  const marketOpen    = getMarketStatus().open;
  const hasLive       = Object.keys(liveMap).length > 0;
  const pnlPos        = (summary?.totalPnl ?? 0) >= 0;
  const dayPnl        = enriched.reduce((sum, s) => sum + (s.ld ? s.shares * s.ld.price * (s.ld.changeP / 100) : 0), 0);
  const totalInvested = enriched.reduce((sum, s) => sum + s.invested, 0);

  const rawPie = enriched.filter(s => s.current != null && s.current > 0).sort((a, b) => b.current - a.current);
  const topPie = rawPie.slice(0, 8);
  if (rawPie.length > 8) {
    const othersVal = rawPie.slice(8).reduce((s, x) => s + x.current, 0);
    topPie.push({ symbol: "Others", current: othersVal });
  }
  const pieData = topPie.map(s => ({ name: s.symbol, value: s.current }));

  // keep detail modal in sync with live data
  const detailEnriched = detailStock ? enriched.find(s => s._id === detailStock._id) : null;

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">

      {/* header */}
      <div className="section-header">
        <div>
          <div className="page-title">Portfolio</div>
          <div className="page-meta">
            {stocks.length} position{stocks.length !== 1 ? "s" : ""}
            {lastUpdated && !refreshing && ` · ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            {refreshing && " · Refreshing…"}
          </div>
        </div>
        <div className="flex gap-8" style={{ alignItems: "center" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{ width: 180, fontSize: 13 }}
          />
          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              className={`btn ${hasActiveFilters ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFiltersOpen(o => !o)}
            >
              ⚙ Filters{hasActiveFilters ? " •" : ""}
            </button>
            {filtersOpen && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-label">Sort by</div>
                {[
                  { k: "pnlP",      l: "Returns %"  },
                  { k: "dayChange", l: "Day Change"  },
                  { k: "invested",  l: "Invested"    },
                  { k: "current",   l: "Current"     },
                  { k: "name",      l: "Name"        },
                ].map(o => {
                  const active = sort.key === o.k;
                  return (
                    <div key={o.k}
                      className={`filter-dropdown-item${active ? " fdi-active" : ""}`}
                      onClick={() => handleSort(o.k)}>
                      <span>{o.l}</span>
                      {active && <span className="fdi-dir">{dirText(o.k, sort.dir)}</span>}
                    </div>
                  );
                })}
                <div className="user-dropdown-divider" />
                <div className="filter-dropdown-label">Show</div>
                {[
                  { k: "all",     l: `All (${enriched.length})` },
                  { k: "gainers", l: `Gainers (${enriched.filter(s => s.pnlP != null && s.pnlP >= 0).length})` },
                  { k: "losers",  l: `Losers (${enriched.filter(s => s.pnlP != null && s.pnlP < 0).length})` },
                ].map(o => (
                  <div key={o.k}
                    className={`filter-dropdown-item${filter === o.k ? " fdi-active" : ""}`}
                    onClick={() => { setFilter(o.k); setFiltersOpen(false); }}>
                    <span>{o.l}</span>
                    {filter === o.k && <span>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? <><span className="spinner spinner-sm" /> Refreshing…</> : "⟳ Refresh"}
          </button>
          <button className="btn btn-primary" onClick={() => setModal("add")}>+ Add Stock</button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📊</div>
          <div>No stocks in your portfolio yet.</div>
          <button className="btn btn-primary mt-16" onClick={() => setModal("add")}>Add your first stock</button>
        </div>
      ) : (
        <>
          {/* summary + donut — split card */}
          <div className="card portfolio-summary" style={{ marginBottom: 20, display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
            {/* left: 2×2 stats */}
            <div style={{ flex: "0 0 50%", padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
              <div className="section-title" style={{ marginBottom: 4 }}>Portfolio Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                  <div className="stat-label">Invested</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{inr(totalInvested)}</div>
                </div>
                <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                  <div className="stat-label">Current</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{hasLive ? inr(summary?.totalCurrent ?? 0) : "—"}</div>
                </div>
                <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                  <div className="stat-label">P&L</div>
                  <div className={`stat-value ${pnlPos ? "text-green" : "text-red"}`} style={{ fontSize: 18 }}>
                    {hasLive ? `${pnlPos ? "+" : "−"}${inr(summary?.totalPnl ?? 0)}` : "—"}
                  </div>
                </div>
                <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                  <div className="stat-label">Returns</div>
                  <div className={`stat-value ${pnlPos ? "text-green" : "text-red"}`} style={{ fontSize: 18 }}>
                    {hasLive ? pct(summary?.totalPnlP ?? 0) : "—"}
                  </div>
                  {hasLive && (
                    <div className={`stat-sub ${!marketOpen ? "" : dayPnl >= 0 ? "text-green" : "text-red"}`} style={{ fontSize: 11, color: !marketOpen ? "var(--muted)" : undefined }}>
                      Today {dayPnl >= 0 ? "+" : "−"}{inr(dayPnl)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* divider */}
            <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />

            {/* right: donut chart */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", minHeight: 240 }}>
              {hasLive && pieData.length >= 1 ? (
                <div style={{ width: "100%", height: 240 }}>
                  <DonutChart data={pieData} total={summary?.totalCurrent} />
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: 13, textAlign: "center" }}>
                  {refreshing ? <span className="spinner spinner-sm" /> : "Load live prices to see allocation"}
                </div>
              )}
            </div>
          </div>


          {liveError && (
            <div className="error-msg" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{liveError}</span>
              <button className="btn btn-ghost btn-sm" onClick={refresh}>Retry</button>
            </div>
          )}

          {/* stock list — click row → detail modal */}
          {displayed.length === 0 ? (
            <div className="card empty" style={{ padding: 32 }}>
              {q ? `No stocks match "${search}".` : "No stocks match this filter."}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Live Price</th>
                      <th>P&L</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(s => {
                      const ld  = s.ld;
                      const ds  = ld?.decision ? DECISION_STYLE[ld.decision.type] || DECISION_STYLE.HOLD : null;
                      const pos = s.pnlP != null && s.pnlP >= 0;
                      return (
                        <tr key={s._id}
                          onClick={() => setDetailStock(s)}
                          style={{ cursor: "pointer" }}>

                          <td>
                            <div className="font-bold" style={{ fontSize: 14, letterSpacing: -0.2 }}>{s.symbol}</div>
                            <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{s.name}</div>
                          </td>

                          <td>
                            {ld ? (
                              <>
                                <div className="font-bold" style={{ fontSize: 14 }}>
                                  ₹{ld.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </div>
                                <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: !marketOpen ? "var(--muted)" : ld.changeP >= 0 ? "var(--green)" : "var(--red)" }}>
                                  {!marketOpen ? "0.00%" : `${ld.changeP >= 0 ? "▲" : "▼"} ${Math.abs(ld.changeP).toFixed(2)}%`}
                                </div>
                              </>
                            ) : refreshing ? (
                              <span className="spinner spinner-sm" />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          <td>
                            <div className={`font-bold ${pos ? "text-green" : "text-red"}`} style={{ fontSize: 15 }}>
                              {s.pnlP != null ? pct(s.pnlP) : "—"}
                            </div>
                            {s.pnlVal != null && (
                              <div style={{ fontSize: 11, marginTop: 2, color: "var(--muted)" }}>
                                {pos ? "+" : "−"}{inr(s.pnlVal)}
                              </div>
                            )}
                          </td>

                          <td>
                            {ds ? (
                              <span className={`chip ${ds.cls}`} style={{ fontSize: 10 }}>
                                {ds.icon} {ds.label}
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* stock detail modal */}
      {detailEnriched && (
        <StockDetailModal
          s={detailEnriched}
          onClose={() => setDetailStock(null)}
          onEdit={() => { setDetailStock(null); setModal(detailEnriched); }}
          onDelete={() => setDeleteId(detailEnriched._id)}
        />
      )}

      {/* add / edit modal */}
      {(modal === "add" || (modal && modal !== "add")) && (
        <StockModal mode="portfolio"
          initial={modal === "add" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)} />
      )}

      {/* confirm delete */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remove Stock</span>
            </div>
            <p className="text-muted" style={{ fontSize: 13 }}>Remove this stock from your portfolio?</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
