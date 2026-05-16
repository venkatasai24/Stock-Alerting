import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

const DEFAULT_PORTFOLIO = { symbol: "", name: "", shares: "", avgPrice: "", isETF: false };
const DEFAULT_WATCHLIST = { symbol: "", name: "", shares: "", targetBuy: "", notes: "", priority: "medium" };

function StockSearch({ onChange }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce  = useRef(null);
  const wrapRef   = useRef(null);

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    clearTimeout(debounce.current);
    if (q.length < 1) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/market/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 350);
  }

  function select(stock) {
    setQuery(stock.symbol);
    setOpen(false);
    setResults([]);
    onChange(stock.symbol, stock.name, stock.type);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input value={query} onChange={handleInput} onFocus={() => query && setOpen(true)}
        placeholder="Type symbol or company name…" autoComplete="off" />
      {open && (loading || results.length > 0) && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 300,
          background: "var(--card2)", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
          maxHeight: 240, overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.6)"
        }}>
          {loading && (
            <div style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <span className="spinner spinner-sm" /> Searching NSE stocks…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 13 }}>No NSE stocks found</div>
          )}
          {results.map(s => (
            <div key={s.symbol} onMouseDown={() => select(s)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--primary-dim)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span className="font-bold" style={{ color: "var(--primary)", minWidth: 90 }}>{s.symbol}</span>
              <span className="text-muted" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              {s.type === "ETF"   && <span className="chip chip-yellow" style={{ fontSize: 10, padding: "1px 7px", flexShrink: 0 }}>ETF</span>}
              {s.type === "InvIT" && <span className="chip chip-blue"   style={{ fontSize: 10, padding: "1px 7px", flexShrink: 0 }}>InvIT</span>}
              {s.type === "REIT"  && <span className="chip chip-blue"   style={{ fontSize: 10, padding: "1px 7px", flexShrink: 0 }}>REIT</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockModal({ mode = "portfolio", initial = null, onSave, onClose }) {
  const isPortfolio = mode === "portfolio";
  const [form,   setForm]   = useState(isPortfolio ? DEFAULT_PORTFOLIO : DEFAULT_WATCHLIST);
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    if (isPortfolio) {
      setForm({ symbol: initial.symbol||"", name: initial.name||"",
        shares: initial.shares??"", avgPrice: initial.avgPrice??"", isETF: initial.isETF ?? false });
    } else {
      setForm({ symbol: initial.symbol||"", name: initial.name||"",
        shares: initial.shares??"", targetBuy: initial.targetBuy??"", notes: initial.notes||"",
        priority: initial.priority||"medium" });
    }
  }, [initial]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = isPortfolio
        ? { ...form, shares: Number(form.shares), avgPrice: Number(form.avgPrice), isETF: form.isETF ?? false }
        : { ...form, shares: form.shares ? Number(form.shares) : null, targetBuy: form.targetBuy ? Number(form.targetBuy) : null };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{initial ? "Edit" : "Add"} {isPortfolio ? "Portfolio Stock" : "Watchlist Stock"}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>Search NSE Stock *</label>
            {initial
              ? <input value={form.symbol} disabled />
              : <StockSearch onChange={(sym, name, type) => setForm(f => ({ ...f, symbol: sym, name, isETF: type === "ETF" || type === "InvIT" || type === "REIT" }))} />
            }
            {form.name && (
              <div className="stock-name-hint">
                {initial ? form.name : `✓ ${form.name}`}
              </div>
            )}
          </div>

          {isPortfolio ? (
            <>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Shares *</label>
                  <input type="number" value={form.shares} onChange={e => set("shares", e.target.value)} min="0" required />
                </div>
                <div className="form-group">
                  <label>Avg Buy Price (₹) *</label>
                  <input type="number" value={form.avgPrice} onChange={e => set("avgPrice", e.target.value)} step="0.01" min="0" required />
                </div>
              </div>
              {form.isETF && (
                <div style={{ fontSize: 12, color: "var(--yellow)", marginTop: 4 }}>
                  📊 ETF detected — analysis will use accumulate-only mode (never sell)
                </div>
              )}
            </>
          ) : (
            <>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Planned Shares</label>
                  <input type="number" value={form.shares} onChange={e => set("shares", e.target.value)}
                    min="1" placeholder="How many to buy" />
                </div>
                <div className="form-group">
                  <label>Target Buy Price (₹)</label>
                  <input type="number" value={form.targetBuy} onChange={e => set("targetBuy", e.target.value)}
                    step="0.01" min="0" placeholder="Price to enter" />
                </div>
              </div>
              <div className="modal-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Priority</label>
                  <div className="priority-pills">
                    {[["high","High"],["medium","Medium"],["low","Low"]].map(([val, label]) => (
                      <button key={val} type="button"
                        className={`priority-pill ${form.priority === val ? `pp-active-${val}` : ""}`}
                        onClick={() => set("priority", val)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Notes</label>
                  <input value={form.notes} onChange={e => set("notes", e.target.value)}
                    placeholder="Why you're watching…" />
                </div>
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.symbol}>
              {saving ? <span className="spinner spinner-sm" /> : (initial ? "Save Changes" : "Add Stock")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
