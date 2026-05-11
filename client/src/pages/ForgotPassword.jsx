import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../components/Toast";

const OTP_TTL = 10 * 60; // 10 minutes in seconds

export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL);
  const timerRef = useRef(null);

  function startTimer() {
    setSecondsLeft(OTP_TTL);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function handleSendOtp(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setStep(2);
      startTimer();
      toast("OTP sent to your email", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Failed to send OTP", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setOtp("");
      startTimer();
      toast("OTP resent to your email", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Failed to resend OTP", "error");
    } finally {
      setResending(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      toast("Password reset! Redirecting to login…", "success");
      setDone(true);
      clearInterval(timerRef.current);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to reset password", "error");
    } finally {
      setLoading(false);
    }
  }

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const expired = secondsLeft === 0;

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-logo">📈 StockAlert</div>
        <div className="auth-title">{step === 1 ? "Forgot password" : "Reset password"}</div>
        <div className="auth-sub">
          {step === 1
            ? "Enter your email and we'll send you a one-time code"
            : `Code sent to ${email}`}
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: "var(--radius)", marginBottom: 16,
              background: expired ? "var(--red-dim)" : "var(--bg2)",
              border: `1px solid ${expired ? "rgba(244,63,94,.25)" : "var(--border)"}`,
              fontSize: 12,
            }}>
              <span style={{ color: expired ? "#fb7185" : "var(--muted)" }}>
                {expired ? "OTP expired" : `Expires in ${mins}:${secs}`}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResend}
                disabled={resending}
                style={{ fontSize: 11, padding: "2px 10px" }}
              >
                {resending ? <span className="spinner spinner-sm" /> : "Resend"}
              </button>
            </div>

            <div className="form-group">
              <label>One-time code (OTP)</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code" required autoFocus
                style={{ letterSpacing: 6, fontSize: 20, textAlign: "center" }}
              />
            </div>
            <div className="form-group">
              <label>New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={loading || done || expired}
            >
              {loading ? <span className="spinner spinner-sm" /> : "Reset Password"}
            </button>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 13 }}>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => { setStep(1); setOtp(""); setNewPassword(""); setConfirm(""); setDone(false); clearInterval(timerRef.current); }}>
                ← Change email
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          Remembered it? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
