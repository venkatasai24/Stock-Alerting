import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  symbol:   { type: String, required: true },
  name:     { type: String, required: true },
  type:     {
    type: String,
    enum: ["BUY_MORE", "BOOK_PROFIT", "PARTIAL_SELL", "STOP_LOSS", "ACCUMULATE", "NEAR_52W_LOW", "WATCHLIST_TARGET"],
    required: true,
  },
  message:  { type: String, required: true },
  price:    { type: Number, required: true },
  changeP:  { type: Number, default: 0 },
  source:   { type: String, enum: ["portfolio", "watchlist"], default: "portfolio" },
  date:     { type: String },   // "YYYY-MM-DD" IST — per-day dedup key
  read:     { type: Boolean, default: false },
}, { timestamps: true });

alertSchema.index({ userId: 1, symbol: 1, type: 1, date: 1 });

export default mongoose.model("Alert", alertSchema);
