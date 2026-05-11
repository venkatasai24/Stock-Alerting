import mongoose from "mongoose";

const portfolioStockSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  symbol:     { type: String, required: true, uppercase: true, trim: true },
  name:       { type: String, required: true },
  shares:     { type: Number, required: true, min: 0 },
  avgPrice:   { type: Number, required: true, min: 0 },
  buyBelow:   { type: Number, default: null },
  sellAbove:  { type: Number, default: null },
  action:     { type: String, enum: ["HOLD", "WATCH", "EXIT"], default: "HOLD" },
}, { timestamps: true });

portfolioStockSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export default mongoose.model("PortfolioStock", portfolioStockSchema);
