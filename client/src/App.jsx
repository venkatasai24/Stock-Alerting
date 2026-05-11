import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import Alerts from "./pages/Alerts";
import { getMarketStatus } from "./utils/marketStatus";

function MarketBanner() {
  const [status, setStatus] = useState(getMarketStatus);
  useEffect(() => {
    const id = setInterval(() => setStatus(getMarketStatus()), 30000);
    return () => clearInterval(id);
  }, []);
  if (status.open) return null;
  const isHoliday = status.label === "Holiday";
  return (
    <div className="market-closed-banner">
      <span>{isHoliday ? "🗓" : "🔒"}</span>
      <span>{isHoliday ? "NSE Holiday — market closed today" : status.reason}</span>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      {user && <MarketBanner />}
      <Routes>
        <Route path="/login"           element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register"        element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
        <Route path="/"         element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
        <Route path="/watchlist" element={<PrivateRoute><Watchlist /></PrivateRoute>} />
        <Route path="/alerts"    element={<PrivateRoute><Alerts /></PrivateRoute>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
