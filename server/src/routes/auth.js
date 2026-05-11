import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { sendOtpEmail } from "../services/email.js";

const router = Router();

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({ username, email, password });
    res.status(201).json({ token: signToken(user._id), user: { id: user._id, username, email } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({ token: signToken(user._id), user: { id: user._id, username: user.username, email } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/me", protect, (req, res) => {
  const { _id, username, email, telegramChatId } = req.user;
  res.json({ id: _id, username, email, telegramChatId });
});

router.put("/me", protect, async (req, res) => {
  try {
    const { telegramChatId } = req.body;
    await User.findByIdAndUpdate(req.user._id, { telegramChatId });
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "No account found with that email" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = await bcrypt.hash(otp, 8);
    user.resetOtp = hashed;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save({ validateModifiedOnly: true });

    await sendOtpEmail(email, otp);
    res.json({ message: "OTP sent" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "Email, OTP, and new password required" });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetOtp || !user.resetOtpExpiry)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    if (user.resetOtpExpiry < new Date())
      return res.status(400).json({ message: "OTP has expired. Request a new one." });

    const valid = await bcrypt.compare(otp, user.resetOtp);
    if (!valid) return res.status(400).json({ message: "Incorrect OTP" });

    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
