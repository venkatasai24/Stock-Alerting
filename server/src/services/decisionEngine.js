// ─────────────────────────────────────────────
// Decision Engine — Sai's Portfolio Strategy
// ─────────────────────────────────────────────

const PROFIT_PARTIAL = 60.0;   // partial sell when up 60%+
const PROFIT_STRONG  = 100.0;  // book profit when up 100%+ (free-ride strategy)
const BUY_MORE_DIP   = -3.0;   // intraday dip % to trigger buy-more
const STOP_LOSS_ZONE = -30.0;  // stop loss warning at -30%
const AVG_DOWN_ZONE  = -15.0;  // review / avg-down zone at -15%

function getLongTermView(pnlP, price, weekLow, weekHigh) {
  let rangePos = null;
  if (weekHigh > weekLow) {
    rangePos = Math.round(((price - weekLow) / (weekHigh - weekLow)) * 100);
  }

  if (pnlP > 100)
    return { rating: "Multi-bagger", note: "Stock has doubled! Consider free-ride strategy — sell half, hold rest forever.", color: "green" };
  if (pnlP > 50)
    return { rating: "Strong Performer", note: "Significant wealth created — approaching free-ride zone. Stay invested.", color: "green" };
  if (pnlP > 15)
    return { rating: "Performing Well", note: "Solid gains. Stay invested for compounding.", color: "green" };
  if (pnlP >= 0)
    return { rating: "In Profit", note: "Positive territory. Hold for long-term growth.", color: "green" };
  if (pnlP < -10 && pnlP >= -25)
    return { rating: "Under Pressure", note: "Moderate loss. Monitor closely — check if fundamentals changed.", color: "yellow" };
  if (rangePos !== null && rangePos <= 15)
    return { rating: "Accumulation Zone", note: "Near 52W low — good zone to add if conviction is high.", color: "blue" };
  if (pnlP < -25)
    return { rating: "Review Position", note: "Significant drawdown. Reassess your original thesis before averaging down.", color: "red" };

  return { rating: "Hold Steady", note: "Short-term dip — normal for long-term investing.", color: "muted" };
}

export function evaluateStock(stock, priceData) {
  const { avgPrice, shares, isETF } = stock;
  const { price, weekLow, weekHigh, changeP = 0 } = priceData;
  const pnlP = ((price - avgPrice) / avgPrice) * 100;
  const ltv  = getLongTermView(pnlP, price, weekLow, weekHigh);

  // ── ETF: never sell, only hold or accumulate on dips
  if (isETF) {
    if (changeP <= BUY_MORE_DIP) {
      return { type: "BUY_MORE", pnlP, longTermView: ltv,
        message: `ETF dipped ${Math.abs(changeP).toFixed(1)}% today — great opportunity to add more units. ETFs should never be sold, only accumulated.` };
    }
    return { type: "HOLD", pnlP, longTermView: ltv,
      message: `P&L ${pnlP.toFixed(1)}%. Keep your monthly SIP running. Never sell ETFs — just keep adding units.` };
  }

  // ── 1. INTRADAY DIP — check before profit levels to catch dip in winners too
  // Only when in the -10% to PROFIT_PARTIAL band (outside that range, different logic applies)
  if (changeP <= BUY_MORE_DIP && pnlP >= -10 && pnlP < PROFIT_PARTIAL) {
    return { type: "BUY_MORE", pnlP, longTermView: ltv,
      message: `Down ${Math.abs(changeP).toFixed(1)}% today${pnlP >= 0 ? `, still up ${pnlP.toFixed(1)}% overall` : ` (${pnlP.toFixed(1)}% from avg)`}. Looks like a temporary dip — consider adding more shares.` };
  }

  // ── 2. BOOK PROFIT — stock has doubled (free-ride strategy)
  if (pnlP >= PROFIT_STRONG) {
    if (shares <= 1) {
      return { type: "BOOK_PROFIT", pnlP, sharesToSell: 1, longTermView: ltv,
        message: `Up ${pnlP.toFixed(1)}% with only 1 share. You've doubled your money! Consider selling and redeploying, or hold with strong long-term conviction.` };
    }
    const sharesToSell = Math.max(1, Math.round(shares * 0.5));
    const actualPct    = Math.round((sharesToSell / shares) * 100);
    return { type: "BOOK_PROFIT", pnlP, sharesToSell, longTermView: ltv,
      message: `Up ${pnlP.toFixed(1)}% — stock has doubled! Sell ${sharesToSell} of ${shares} shares (${actualPct}%) to recover your full investment. Let remaining shares ride for free.` };
  }

  // ── 3. PARTIAL SELL — up 60%+, approaching free-ride territory
  if (pnlP >= PROFIT_PARTIAL) {
    const sharesToSell = Math.max(1, Math.round(shares * 0.3));
    if (shares - sharesToSell <= 1) {
      return { type: "HOLD", pnlP, sharesToSell: null, longTermView: ltv,
        message: `Up ${pnlP.toFixed(1)}% — excellent gains! You only hold ${shares} share${shares > 1 ? "s" : ""}. Selling would cut your position too thin. Hold and let it compound toward the 100%+ free-ride target.` };
    }
    const actualPct = Math.round((sharesToSell / shares) * 100);
    return { type: "PARTIAL_SELL", pnlP, sharesToSell, longTermView: ltv,
      message: `Up ${pnlP.toFixed(1)}% — approaching free-ride zone! Consider selling ${sharesToSell} of ${shares} shares (${actualPct}%) to de-risk. Target: hold till 100%+ for full free-ride strategy.` };
  }

  // ── 4. STOP LOSS — deep loss; check 52W position before deciding
  if (pnlP <= STOP_LOSS_ZONE) {
    const lowGap = weekLow > 0 ? ((price - weekLow) / weekLow) * 100 : null;

    if (lowGap === null || lowGap <= 15) {
      const note = lowGap === null
        ? `Down ${Math.abs(pnlP).toFixed(1)}% from your avg. 52W low data unavailable — unable to confirm position. If conviction is high, consider averaging down cautiously.`
        : `Down ${Math.abs(pnlP).toFixed(1)}% from avg, but only ${lowGap.toFixed(1)}% above 52W low. Market has broadly sold this off. If conviction is high, this zone may be worth averaging into.`;
      return { type: "ACCUMULATE", pnlP, longTermView: ltv, message: note };
    }

    const stopPrice = (price * 0.92).toFixed(2);
    return { type: "STOP_LOSS", pnlP, longTermView: ltv,
      message: `Down ${Math.abs(pnlP).toFixed(1)}% from your avg buy of ₹${avgPrice} and still ${lowGap.toFixed(0)}% above its 52W low. Consider exiting to limit further losses. Suggested stop: ₹${stopPrice} (~8% below current price).` };
  }

  // ── 5. NEAR 52W LOW — potential accumulation zone
  if (weekLow > 0) {
    const lowGap = ((price - weekLow) / weekLow) * 100;
    if (lowGap <= 5) {
      return { type: "NEAR_52W_LOW", pnlP, longTermView: ltv,
        message: `Only ${lowGap.toFixed(1)}% above 52W low. If you believe in the business, this is a good accumulation zone. Consider adding 2–3 more shares.` };
    }
  }

  // ── 6. MODERATE LOSS — avg-down check with 52W context
  if (pnlP <= AVG_DOWN_ZONE) {
    const lowGap    = weekLow > 0 ? ((price - weekLow) / weekLow) * 100 : null;
    const isNearLow = lowGap !== null && lowGap <= 20;
    return { type: isNearLow ? "ACCUMULATE" : "REVIEW", pnlP, longTermView: ltv,
      message: isNearLow
        ? `Down ${Math.abs(pnlP).toFixed(1)}% from avg and near 52W low — potential accumulation zone. Add only if fundamentals are intact.`
        : `Down ${Math.abs(pnlP).toFixed(1)}% from avg. Review fundamentals before averaging down — stock still has room to fall further from its 52W low.` };
  }

  // ── 7. HOLD
  return { type: "HOLD", pnlP, longTermView: ltv,
    message: `P&L ${pnlP.toFixed(1)}%. No action needed — stay invested and let compounding work.` };
}

// ─────────────────────────────────────────────
// Nifty 50 Stock Scorer — Max score: 13 points
// ─────────────────────────────────────────────

export function scoreStock(priceData) {
  const { price, changeP, open, high, low, weekHigh, weekLow } = priceData;
  let score = 0;
  const reasons = [];

  if (changeP > 2)          { score += 3; reasons.push(`Strong day +${changeP.toFixed(1)}%`); }
  else if (changeP > 0.5)   { score += 2; reasons.push(`Positive day +${changeP.toFixed(1)}%`); }
  else if (changeP > 0)     { score += 1; }
  else if (changeP <= -2)   { score -= 2; reasons.push(`Falling ${changeP.toFixed(1)}% today`); }
  else if (changeP <= -0.5) { score -= 1; }

  if (open && price > open) { score += 2; reasons.push("Above open price"); }

  if (high && low) {
    const range = ((high - low) / low) * 100;
    if (range < 2)      { score += 2; reasons.push("Low intraday volatility"); }
    else if (range < 3) { score += 1; }
  }

  if (weekHigh > 0) {
    const fromHigh = ((weekHigh - price) / weekHigh) * 100;
    if (fromHigh >= 10 && fromHigh <= 30) { score += 3; reasons.push(`${fromHigh.toFixed(0)}% below 52W high — good entry zone`); }
    else if (fromHigh < 10)               { score += 1; }
  }

  if (weekLow > 0) {
    const fromLow = ((price - weekLow) / weekLow) * 100;
    if (fromLow > 20)      { score += 3; reasons.push(`${fromLow.toFixed(0)}% above 52W low — stable`); }
    else if (fromLow > 10) { score += 1; }
  }

  return { score: Math.max(0, score), reasons };
}
