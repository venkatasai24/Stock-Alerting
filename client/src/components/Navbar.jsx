import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { getMarketStatus } from "../utils/marketStatus";
import { useTheme } from "../hooks/useTheme";

function HomeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function BriefcaseIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>;
}
function ListIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>;
}
function BellIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
}

function MobileBottomNav({ unread }) {
  const tabs = [
    { to: "/",          end: true, icon: <HomeIcon />,      label: "Dashboard" },
    { to: "/portfolio",            icon: <BriefcaseIcon />, label: "Portfolio" },
    { to: "/watchlist",            icon: <ListIcon />,      label: "Watchlist"  },
    { to: "/alerts",               icon: <BellIcon />,      label: "Alerts",    badge: unread },
  ];
  return (
    <nav className="mobile-bottom-nav">
      {tabs.map(({ to, end, icon, label, badge }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `mbn-tab${isActive ? " mbn-tab-active" : ""}`}>
          <span className="mbn-icon-wrap">
            {icon}
            {badge > 0 && <span className="mbn-badge">{badge > 9 ? "9+" : badge}</span>}
          </span>
          <span className="mbn-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function BrandLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect width="30" height="30" rx="8" fill="#06b6d4"/>
      <rect width="30" height="30" rx="8" fill="url(#brand-grad)" opacity="0.55"/>
      <polyline points="5,22 10,14 16,18 23,8"
        stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      <polyline points="5,22 10,14 16,18 23,8"
        stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="23" cy="8" r="2.8" fill="white"/>
      <defs>
        <linearGradient id="brand-grad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee"/>
          <stop offset="100%" stopColor="#0369a1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function UserMenu({ user, theme, toggle, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initial = user?.username?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="avatar-btn" onClick={() => setOpen(o => !o)} title={user?.username}>
        {initial}
      </button>

      {open && (
        <div className="user-dropdown">
          {/* identity */}
          <div className="user-dropdown-header">
            <div className="user-dropdown-avatar-lg">{initial}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Personal account</div>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          {/* theme toggle */}
          <button className="user-dropdown-item user-dropdown-btn" onClick={toggle}>
            <span style={{ display: "flex", alignItems: "center" }}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </span>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>

          <div className="user-dropdown-divider" />

          {/* logout */}
          <button className="user-dropdown-item user-dropdown-btn user-dropdown-logout" onClick={onLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [market, setMarket] = useState(getMarketStatus);
  const { theme, toggle } = useTheme();

  const pollAlerts = useCallback(async () => {
    try {
      const { data } = await api.get("/alerts?limit=1");
      setUnread(data.unreadCount ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    // SSE for real-time push; fall back to 60s poll if SSE fails
    const token = localStorage.getItem("token");
    let es = null;
    let fallbackId = null;

    if (token) {
      const apiBase = import.meta.env.VITE_API_URL ?? "/api";
      es = new EventSource(`${apiBase}/alerts/stream?token=${token}`);
      es.onmessage = (e) => {
        const n = Number(e.data);
        if (!isNaN(n)) setUnread(n);
      };
      es.onerror = () => {
        es.close();
        es = null;
        // SSE failed — start polling fallback
        pollAlerts();
        fallbackId = setInterval(pollAlerts, 60000);
      };
    } else {
      pollAlerts();
      fallbackId = setInterval(pollAlerts, 60000);
    }

    window.addEventListener("alerts-changed", pollAlerts);
    return () => {
      es?.close();
      if (fallbackId) clearInterval(fallbackId);
      window.removeEventListener("alerts-changed", pollAlerts);
    };
  }, [pollAlerts]);

  useEffect(() => {
    const id = setInterval(() => setMarket(getMarketStatus()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <BrandLogo />
          <span className="brand-text">Stock<span className="brand-text-thin">Alert</span></span>
        </Link>

        <div className="nav-links">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
          <NavLink to="/alerts">
            Alerts {unread > 0 && <span className="badge">{unread}</span>}
          </NavLink>
        </div>

        <div className="navbar-right">
          <div className="navbar-market">
            <span className={`market-dot-nav ${market.open ? "live" : "closed"}`} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>NSE {market.label}</span>
          </div>
          <UserMenu
            user={user}
            theme={theme}
            toggle={toggle}
            onLogout={() => { logout(); navigate("/login"); }}
          />
        </div>
      </nav>
      <MobileBottomNav unread={unread} />
    </>
  );
}
