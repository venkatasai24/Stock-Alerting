import { useEffect, useState, useCallback, useRef } from "react";
import { getMarketStatus } from "../utils/marketStatus";
import api from "../api/axios";
import StockModal from "../components/StockModal";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

const PRIORITY = {
  high:   { cls: "chip-red",    label: "High" },
  medium: { cls: "chip-yellow", label: "Medium" },
  low:    { cls: "chip-green",  label: "Low" },
};
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const VERDICT_STYLE = {
  "Strong Buy":    { cls: "chip-green",  color: "var(--green)"  },
  "Good to Buy":   { cls: "chip-green",  color: "var(--green)"  },
  "Wait for Dip":  { cls: "chip-yellow", color: "var(--yellow)" },
  "Poor Entry":    { cls: "chip-red",    color: "var(--red)"    },
  "Avoid for Now": { cls: "chip-red",    color: "var(--red)"    },
};

// type: "good" | "warn" | "bad" | "neutral"
const SIG_COLOR = { good: "var(--green)", warn: "var(--yellow)", bad: "var(--red)", neutral: "var(--muted)" };

function evaluateBuy(priceData, targetBuy) {
  const { price, changeP = 0, weekLow = 0, weekHigh = 0, open = 0, high = 0, low = 0 } = priceData;
  const signals = [];
  let score = 0;

  // ── 1. Target price proximity ──────────────────────────────
  if (targetBuy) {
    const distPct = ((price - targetBuy) / targetBuy) * 100;
    if (price <= targetBuy) {
      signals.push({ type: "good",    text: `✅  Price is at/below your entry target of ₹${targetBuy} — price condition met.` });
      score += 3;
    } else if (distPct <= 3) {
      signals.push({ type: "warn",    text: `🟡  Only ${distPct.toFixed(1)}% above target ₹${targetBuy} — very close; set an alert and wait.` });
      score += 1;
    } else if (distPct <= 15) {
      signals.push({ type: "neutral", text: `⏳  ${distPct.toFixed(1)}% above your target of ₹${targetBuy} — wait for a pullback.` });
    } else {
      signals.push({ type: "bad",     text: `❌  ${distPct.toFixed(1)}% above target ₹${targetBuy} — significantly overpriced vs your plan.` });
      score -= 2;
    }
  }

  // ── 2. 52-week range position ──────────────────────────────
  if (weekLow > 0 && weekHigh > 0 && weekHigh > weekLow) {
    const rangePos  = ((price - weekLow) / (weekHigh - weekLow)) * 100;
    const fromLow   = ((price - weekLow) / weekLow) * 100;
    const fromHigh  = ((weekHigh - price) / weekHigh) * 100;

    if (rangePos <= 15) {
      signals.push({ type: "good",    text: `💎  Near 52W low — bottom ${rangePos.toFixed(0)}% of its yearly range. Historically a strong accumulation zone.` });
      score += 3;
    } else if (rangePos <= 35) {
      signals.push({ type: "good",    text: `📉  Lower third of 52W range (${fromLow.toFixed(0)}% above low). Reasonable entry territory.` });
      score += 2;
    } else if (rangePos <= 60) {
      signals.push({ type: "neutral", text: `📊  Mid-range: ${fromLow.toFixed(0)}% above 52W low, ${fromHigh.toFixed(0)}% below 52W high. Neutral zone.` });
      score += 1;
    } else if (rangePos <= 80) {
      signals.push({ type: "warn",    text: `⚠️  Upper 52W range (${fromHigh.toFixed(0)}% below high). Buying in the upper range limits upside.` });
      score -= 1;
    } else {
      signals.push({ type: "bad",     text: `🔴  Near 52W high — only ${fromHigh.toFixed(1)}% from the peak. High risk entry; limited room to run.` });
      score -= 3;
    }
  }

  // ── 3. Today's momentum ────────────────────────────────────
  if (changeP <= -4) {
    signals.push({ type: "good",    text: `📉  Down ${Math.abs(changeP).toFixed(1)}% today — sharp dip could be a good entry window.` });
    score += 2;
  } else if (changeP <= -1.5) {
    signals.push({ type: "good",    text: `📉  Down ${Math.abs(changeP).toFixed(1)}% today — mild weakness, slightly better entry.` });
    score += 1;
  } else if (changeP >= 4) {
    signals.push({ type: "bad",     text: `🚀  Up ${changeP.toFixed(1)}% today — strong surge. Chasing after a big up day is high-risk.` });
    score -= 2;
  } else if (changeP >= 1.5) {
    signals.push({ type: "warn",    text: `📈  Up ${changeP.toFixed(1)}% today — stock is running. Consider waiting for it to settle.` });
    score -= 1;
  } else {
    signals.push({ type: "neutral", text: `➡️  Flat today (${changeP >= 0 ? "+" : ""}${changeP.toFixed(1)}%) — no strong directional signal.` });
  }

  // ── 4. Intraday volatility ─────────────────────────────────
  if (high > 0 && low > 0) {
    const intraRange = ((high - low) / low) * 100;
    if (intraRange > 5) {
      signals.push({ type: "bad",  text: `⚡  Very high intraday swing (${intraRange.toFixed(1)}% H-L range). Unpredictable — avoid market orders.` });
      score -= 1;
    } else if (intraRange > 3) {
      signals.push({ type: "warn", text: `⚡  Elevated intraday volatility (${intraRange.toFixed(1)}% H-L). Use limit orders for entry.` });
    }
  }

  // ── 5. Price holding above/below open ─────────────────────
  if (open > 0) {
    const vsOpen = ((price - open) / open) * 100;
    if (vsOpen <= -1.5) {
      signals.push({ type: "warn",    text: `📭  Price is ${Math.abs(vsOpen).toFixed(1)}% below today's open — intraday selling pressure.` });
      score -= 1;
    } else if (vsOpen >= 1.5) {
      signals.push({ type: "neutral", text: `📈  Price is ${vsOpen.toFixed(1)}% above today's open — holding intraday strength.` });
    }
  }

  // ── Verdict ────────────────────────────────────────────────
  let verdict, summary;
  if (score >= 6) {
    verdict = "Strong Buy";
    summary = "Multiple signals align — this looks like a high-quality entry zone.";
  } else if (score >= 3) {
    verdict = "Good to Buy";
    summary = "Conditions lean favorable. Good entry, but watch for further downside.";
  } else if (score >= 1) {
    verdict = "Wait for Dip";
    summary = "Not a bad stock, but entry timing isn't ideal. Wait for a pullback.";
  } else if (score >= -1) {
    verdict = "Poor Entry";
    summary = "Technical picture is unfavorable right now. Price may need to correct more.";
  } else {
    verdict = "Avoid for Now";
    summary = "Multiple red flags for entry here — even at target, the setup is weak. Wait for a better opportunity.";
  }

  return { verdict, summary, signals, score };
}

/* ── Watchlist detail modal ── */
function WatchlistDetailModal({ s, liveEntry, onEdit, onDelete, onClose }) {
  const marketOpen = getMarketStatus().open;
  const priceData  = liveEntry?.data;
  const atTarget   = liveEntry?.atTarget;
  const pri        = PRIORITY[s.priority] || PRIORITY.medium;
  const analysis   = priceData ? evaluateBuy(priceData, s.targetBuy) : null;
  const vs         = analysis ? VERDICT_STYLE[analysis.verdict] : null;

  const dist = s.targetBuy && priceData?.price != null
    ? priceData.price - s.targetBuy
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ letterSpacing: -0.3 }}>{s.symbol}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.name}</div>
          </div>
          <span className={`chip ${pri.cls}`} style={{ fontSize: 11 }}>{pri.label} Priority</span>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 8 }}>×</button>
        </div>

        {/* live price */}
        {priceData && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, padding: "12px 16px", background: "var(--bg2)", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
              ₹{priceData.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: !marketOpen ? "var(--muted)" : priceData.changeP >= 0 ? "var(--green)" : "var(--red)" }}>
              {!marketOpen ? "0.00% today" : `${priceData.changeP >= 0 ? "▲" : "▼"} ${Math.abs(priceData.changeP).toFixed(2)}% today`}
            </span>
            {atTarget && <span className="chip chip-green" style={{ fontSize: 10, marginLeft: "auto" }}>🎯 At Target</span>}
          </div>
        )}

        {/* stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Target Price",    val: s.targetBuy ? `₹${s.targetBuy.toLocaleString("en-IN")}` : "—" },
            { label: "Distance",        val: dist !== null ? (atTarget ? "✓ Reached" : `₹${Math.abs(dist).toFixed(0)} ${dist > 0 ? "above" : "below"}`) : "—",
              color: dist !== null && dist <= 0 ? "var(--green)" : undefined },
            { label: "Planned Shares",  val: s.shares ?? "—" },
            { label: "Est. Investment", val: s.shares && s.targetBuy ? `₹${(s.shares * s.targetBuy).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
              <div className="stat-label" style={{ marginBottom: 5 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: color || "var(--text)" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* AI buy analysis */}
        {analysis ? (
          <div style={{ border: `1px solid ${vs?.color ?? "var(--border)"}22`, borderRadius: "var(--radius)", marginBottom: 20, overflow: "hidden" }}>
            {/* verdict header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: `${vs?.color ?? "var(--primary)"}14` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Buy Analysis</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Score: {analysis.score > 0 ? "+" : ""}{analysis.score}</span>
                <span className={`chip ${vs?.cls ?? "chip-muted"}`} style={{ fontSize: 11 }}>{analysis.verdict}</span>
              </div>
            </div>
            {/* summary */}
            <div style={{ padding: "10px 14px 0", fontSize: 13, color: vs?.color ?? "var(--text2)", fontStyle: "italic" }}>
              {analysis.summary}
            </div>
            {/* signals */}
            <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              {analysis.signals.map((sig, i) => (
                <div key={i} style={{ fontSize: 12.5, color: SIG_COLOR[sig.type] ?? "var(--text2)", lineHeight: 1.5 }}>
                  {sig.text}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "14px 16px", background: "var(--bg2)", borderRadius: "var(--radius)", marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
            Load live prices to see buy analysis.
          </div>
        )}

        {/* notes */}
        {s.notes && (
          <div style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: "var(--radius)", marginBottom: 20, fontSize: 13, color: "var(--text2)", fontStyle: "italic" }}>
            "{s.notes}"
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Remove</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function Watchlist() {
  const [stocks,      setStocks]      = useState([]);
  const [live,        setLive]        = useState([]);
  const [modal,       setModal]       = useState(null);
  const [detailStock, setDetailStock] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [deleteId,    setDeleteId]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [wSort,       setWSort]       = useState({ key: "priority", dir: "asc" });
  const [wFilter,     setWFilter]     = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);

  async function fetchStocks() {
    const { data } = await api.get("/watchlist");
    setStocks(data);
  }

  const fetchLiveData = useCallback(async () => {
    try {
      const { data } = await api.get("/watchlist/live");
      setLive(data);
    } finally {
      setLoading(false);
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
    if (modal === "add") await api.post("/watchlist", payload);
    else await api.put(`/watchlist/${modal._id}`, payload);
    await fetchStocks();
    refresh();
  }

  async function handleDelete(id) {
    await api.delete(`/watchlist/${id}`);
    setDeleteId(null);
    setDetailStock(null);
    setStocks(s => s.filter(x => x._id !== id));
    setLive(l => l.filter(x => x.stock._id !== id));
  }

  const liveMap    = Object.fromEntries(live.map(l => [l.stock._id, l]));
  const marketOpen = getMarketStatus().open;

  const W_SORT_DEFAULT = { priority: "asc", name: "asc", targetBuy: "desc", dayChange: "desc" };

  function handleWSort(key) {
    setWSort(s => s.key === key
      ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
      : { key, dir: W_SORT_DEFAULT[key] ?? "asc" }
    );
  }

  function wDirText(key, dir) {
    if (key === "name")     return dir === "asc" ? "A → Z" : "Z → A";
    if (key === "priority") return dir === "asc" ? "High → Low" : "Low → High";
    return dir === "desc" ? "High → Low" : "Low → High";
  }

  const wd = wSort.dir === "asc" ? 1 : -1;
  const sorted = [...stocks].sort((a, b) => {
    const aLive = liveMap[a._id]?.data;
    const bLive = liveMap[b._id]?.data;
    switch (wSort.key) {
      case "priority":  return wd * ((PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
      case "name":      return wd * a.symbol.localeCompare(b.symbol);
      case "targetBuy": return wd * ((a.targetBuy ?? 0) - (b.targetBuy ?? 0));
      case "dayChange": return wd * ((aLive?.changeP ?? -Infinity) - (bLive?.changeP ?? -Infinity));
      default:          return 0;
    }
  });

  const hasActiveWFilters = wSort.key !== "priority" || wSort.dir !== "asc" || wFilter !== "all";

  const q = search.trim().toLowerCase();
  const displayed = sorted.filter(s => {
    if (q && !s.symbol.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
    if (wFilter === "atTarget")  return !!liveMap[s._id]?.atTarget;
    if (wFilter === "highPri")   return s.priority === "high";
    if (wFilter === "noTarget")  return !s.targetBuy;
    return true;
  });

  // keep detail modal in sync with live data
  const detailLive = detailStock ? liveMap[detailStock._id] : null;
  const detailSync = detailStock ? stocks.find(s => s._id === detailStock._id) : null;

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <div className="page-title">Watchlist</div>
          <div className="page-meta">
            {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
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
              className={`btn ${hasActiveWFilters ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFiltersOpen(o => !o)}
            >
              ⚙ Filters{hasActiveWFilters ? " •" : ""}
            </button>
            {filtersOpen && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-label">Sort by</div>
                {[
                  { k: "priority",  l: "Priority"     },
                  { k: "name",      l: "Name"          },
                  { k: "targetBuy", l: "Target Price"  },
                  { k: "dayChange", l: "Day Change"    },
                ].map(o => {
                  const active = wSort.key === o.k;
                  return (
                    <div key={o.k}
                      className={`filter-dropdown-item${active ? " fdi-active" : ""}`}
                      onClick={() => handleWSort(o.k)}>
                      <span>{o.l}</span>
                      {active && <span className="fdi-dir">{wDirText(o.k, wSort.dir)}</span>}
                    </div>
                  );
                })}
                <div className="user-dropdown-divider" />
                <div className="filter-dropdown-label">Show</div>
                {[
                  { k: "all",       l: `All (${stocks.length})`                                           },
                  { k: "atTarget",  l: `At Target (${stocks.filter(s => liveMap[s._id]?.atTarget).length})` },
                  { k: "highPri",   l: `High Priority (${stocks.filter(s => s.priority === "high").length})` },
                  { k: "noTarget",  l: `No Target (${stocks.filter(s => !s.targetBuy).length})`           },
                ].map(o => (
                  <div key={o.k}
                    className={`filter-dropdown-item${wFilter === o.k ? " fdi-active" : ""}`}
                    onClick={() => { setWFilter(o.k); setFiltersOpen(false); }}>
                    <span>{o.l}</span>
                    {wFilter === o.k && <span>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? <><span className="spinner spinner-sm" /> Refreshing…</> : "⟳ Refresh"}
          </button>
          <button className="btn btn-primary" onClick={() => setModal("add")}>+ Add to Watchlist</button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">👀</div>
          <div>Your watchlist is empty.</div>
          <button className="btn btn-primary mt-16" onClick={() => setModal("add")}>Add first stock</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="card empty" style={{ padding: 32 }}>No stocks match "{search}".</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Live Price</th>
                  <th>Target</th>
                  <th>Planned</th>
                  <th>Priority</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(s => {
                  const ld        = liveMap[s._id];
                  const priceData = ld?.data;
                  const atTarget  = ld?.atTarget;
                  const pri       = PRIORITY[s.priority] || PRIORITY.medium;
                  const dist      = s.targetBuy && priceData?.price != null
                    ? priceData.price - s.targetBuy
                    : null;

                  return (
                    <tr key={s._id} onClick={() => setDetailStock(s)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="font-bold" style={{ fontSize: 14, letterSpacing: -0.2 }}>{s.symbol}</div>
                        <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{s.name}</div>
                      </td>

                      <td>
                        {priceData ? (
                          <>
                            <div className="font-bold" style={{ fontSize: 14 }}>
                              ₹{priceData.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: !marketOpen ? "var(--muted)" : priceData.changeP >= 0 ? "var(--green)" : "var(--red)" }}>
                              {!marketOpen ? "0.00%" : `${priceData.changeP >= 0 ? "▲" : "▼"} ${Math.abs(priceData.changeP).toFixed(2)}%`}
                            </div>
                          </>
                        ) : refreshing ? (
                          <span className="spinner spinner-sm" />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        {s.targetBuy ? (
                          <>
                            <div className="font-bold" style={{ fontSize: 14 }}>
                              ₹{s.targetBuy.toLocaleString("en-IN")}
                            </div>
                            {dist !== null && (
                              <div style={{ fontSize: 11, marginTop: 2, color: atTarget ? "var(--green)" : "var(--muted)" }}>
                                {atTarget ? "✓ reached" : `₹${Math.abs(dist).toFixed(0)} away`}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        {s.shares ? (
                          <>
                            <div className="font-bold" style={{ fontSize: 14 }}>{s.shares} shares</div>
                            {s.targetBuy && (
                              <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                                ≈ ₹{(s.shares * s.targetBuy).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        <span className={`chip ${pri.cls}`} style={{ fontSize: 10 }}>{pri.label}</span>
                        {atTarget && (
                          <div style={{ marginTop: 4 }}>
                            <span className="chip chip-green" style={{ fontSize: 10 }}>🎯 At Target</span>
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="text-muted" style={{ fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.notes || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* detail modal */}
      {detailSync && (
        <WatchlistDetailModal
          s={detailSync}
          liveEntry={detailLive}
          onClose={() => setDetailStock(null)}
          onEdit={() => { setDetailStock(null); setModal(detailSync); }}
          onDelete={() => setDeleteId(detailSync._id)}
        />
      )}

      {/* add / edit modal */}
      {(modal === "add" || (modal && modal !== "add")) && (
        <StockModal
          mode="watchlist"
          initial={modal === "add" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Remove from Watchlist</span></div>
            <p className="text-muted" style={{ fontSize: 13 }}>Remove this stock from your watchlist?</p>
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
