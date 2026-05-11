import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(to, otp) {
  await resend.emails.send({
    from: "StockAlert <onboarding@resend.dev>",
    to,
    subject: "Your StockAlert password reset OTP",
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
        <h2 style="color:#06b6d4;margin:0 0 8px">StockAlert</h2>
        <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">Password reset request</p>
        <p style="font-size:14px;color:#e2e8f0;margin:0 0 20px">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#06b6d4">${otp}</div>
        <p style="font-size:12px;color:#64748b;margin:20px 0 0">If you didn't request this, ignore this email — your password won't change.</p>
      </div>
    `,
  });
}
