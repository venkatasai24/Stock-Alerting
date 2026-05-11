import mongoose from "mongoose";

const watchlistStockSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  symbol:    { type: String, required: true, uppercase: true, trim: true },
  name:      { type: String, required: true },
  shares:    { type: Number, default: null },
  targetBuy: { type: Number, default: null },
  notes:     { type: String, default: "" },
  priority:  { type: String, enum: ["high", "medium", "low"], default: "medium" },
}, { timestamps: true });

watchlistStockSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export default mongoose.model("WatchlistStock", watchlistStockSchema);
