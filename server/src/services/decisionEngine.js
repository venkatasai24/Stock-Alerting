const PROFIT_PARTIAL   = 50.0;   // partial sell when up 50%+
const PROFIT_STRONG    = 70.0;   // book profit when up 70%+
const BUY_MORE_DIP     = -3.0;   // intraday dip % to trigger buy-more
const STOP_LOSS_ZONE   = -35.0;
const AVG_DOWN_ZONE    = -20.0;

function getLongTermView(pnlP, price, weekLow, weekHigh) {
  let rangePos = null;
  if (weekHigh > weekLow) {
    rangePos = Math.round(((price - weekLow) / (weekHigh - weekLow)) * 100);
  }

  if (pnlP > 50)
    return { rating: "Strong Performer", note: "Significant wealth created — continue holding.", color: "green" };
  if (pnlP > 15)
    return { rating: "Performing Well", note: "Solid gains. Stay invested for compounding.", color: "green" };
  if (pnlP >= 0)
    return { rating: "In Profit", note: "Positive territory. Hold for long-term growth.", color: "green" };
  if (rangePos !== null && rangePos <= 15)
    return { rating: "Accumulation Zone", note: "Near 52W low — good zone to add if conviction is high.", color: "blue" };
  if (pnlP < -25)
    return { rating: "Review Position", note: "Significant drawdown. Reassess your original thesis.", color: "yellow" };
  return { rating: "Hold Steady", note: "Short-term dip — normal for long-term investing.", color: "muted" };
}

export function evaluateStock(stock, priceData) {
  const { avgPrice, shares } = stock;
  const { price, weekLow, weekHigh, changeP = 0 } = priceData;
  const pnlP = ((price - avgPrice) / avgPrice) * 100;

  const ltv = getLongTermView(pnlP, price, weekLow, weekHigh);

  // Strong gain — book ~50%, let rest compound
  if (pnlP >= PROFIT_STRONG) {
    if (shares <= 1) {
      return { type: "BOOK_PROFIT", pnlP, sharesToSell: 1, longTermView: ltv,
        message: `Up ${pnlP.toFixed(1)}% — excellent gains. Consider a full exit and redeploy capital.` };
    }
    const sharesToSell = Math.max(1, Math.round(shares * 0.5));
    const actualPct    = Math.round((sharesToSell / shares) * 100);
    return { type: "BOOK_PROFIT", pnlP, sharesToSell, longTermView: ltv,
      message: `Up ${pnlP.toFixed(1)}% — sell ${sharesToSell} of ${shares} shares (${actualPct}%) to lock in gains. Hold the rest.` };
  }

  // Moderate gain — book ~30% to de-risk, hold the rest
  if (pnlP >= PROFIT_PARTIAL) {
    const sharesToSell = Math.max(1, Math.round(shares * 0.3));
    if (shares - sharesToSell <= 1) {
      // Selling would leave 1 or fewer shares — not worth a partial exit on such a small position
      return { type: "HOLD", pnlP, sharesToSell: null, longTermView: ltv,
        message: `Up ${pnlP.toFixed(1)}% — good gains, but you only hold ${shares} share${shares > 1 ? "s" : ""}. Selling would cut your position too thin. Hold and let it compound.` };
    }
    const actualPct = Math.round((sharesToSell / shares) * 100);
    return { type: "PARTIAL_SELL", pnlP, sharesToSell, longTermView: ltv,
      message: `Up ${pnlP.toFixed(1)}% — sell ${sharesToSell} of ${shares} shares (${actualPct}%) to book partial profit. Let the rest grow.` };
  }

  // Dipping hard today — buy more opportunity (works even if slightly underwater, ≥ -10%)
  if (pnlP >= -10 && changeP <= BUY_MORE_DIP) {
    return { type: "BUY_MORE", pnlP, longTermView: ltv,
      message: `Down ${Math.abs(changeP).toFixed(1)}% today${pnlP >= 0 ? `, still up ${pnlP.toFixed(1)}% overall` : ` (${pnlP.toFixed(1)}% from avg)`}. Looks like a temporary dip — consider adding more shares.` };
  }

  // Deep loss — but check 52W low position before calling it a stop loss.
  // If the stock is near its yearly low the whole market has punished it; that's
  // an accumulation zone, not necessarily an exit. Only flag stop loss when
  // the stock still has meaningful room below its 52W low (you bought near the top).
  if (pnlP <= STOP_LOSS_ZONE) {
    const lowGap = weekLow > 0 ? ((price - weekLow) / weekLow) * 100 : null;
    if (lowGap === null || lowGap <= 15) {
      // 52W low unavailable or near it — can't confirm entry was at top; treat as accumulation
      const note = lowGap === null
        ? `Down ${Math.abs(pnlP).toFixed(1)}% from your avg. 52W low data unavailable — unable to confirm position. If your conviction is high, consider averaging down cautiously.`
        : `Down ${Math.abs(pnlP).toFixed(1)}% from your avg, but only ${lowGap.toFixed(1)}% above the 52W low — the market has broadly sold this off. If your conviction is high, this zone may be worth averaging into.`;
      return { type: "ACCUMULATE", pnlP, longTermView: ltv, message: note };
    }
    // Still well above 52W low — you bought at a high and it keeps falling
    const stopPrice = (price * 0.92).toFixed(2);
    return { type: "STOP_LOSS", pnlP, longTermView: ltv,
      message: `Down ${Math.abs(pnlP).toFixed(1)}% from your avg buy of ₹${avgPrice} and still ${lowGap.toFixed(0)}% above its 52W low. Consider exiting to limit further losses. Suggested stop: ₹${stopPrice} (~8% below current price).` };
  }

  // Near 52W low — accumulation zone (shown in portfolio modal only, not alerted)
  if (weekLow > 0) {
    const lowGap = ((price - weekLow) / weekLow) * 100;
    if (lowGap <= 5) {
      return { type: "NEAR_52W_LOW", pnlP, longTermView: ltv,
        message: `Only ${lowGap.toFixed(1)}% above 52W low. If you believe in the business, this is a good accumulation zone.` };
    }
  }

  // Moderate loss — average down (shown in portfolio modal only, not alerted)
  if (pnlP <= AVG_DOWN_ZONE) {
    return { type: "ACCUMULATE", pnlP, longTermView: ltv,
      message: `Down ${Math.abs(pnlP).toFixed(1)}% from your avg. If the fundamentals are intact, consider averaging down to reduce your cost.` };
  }

  return { type: "HOLD", pnlP, longTermView: ltv,
    message: `P&L ${pnlP.toFixed(1)}%. No action needed — stay invested and let compounding work.` };
}

export function scoreStock(priceData) {
  const { price, changeP, open, high, low, weekHigh, weekLow } = priceData;
  let score = 0;
  const reasons = [];

  if (changeP > 2)        { score += 3; reasons.push(`Strong day +${changeP.toFixed(1)}%`); }
  else if (changeP > 0.5) { score += 2; reasons.push(`Positive day +${changeP.toFixed(1)}%`); }
  else if (changeP > 0)   { score += 1; }

  if (open && price > open) { score += 2; reasons.push("Above open price"); }

  if (high && low) {
    const range = ((high - low) / low) * 100;
    if (range < 2)      { score += 2; reasons.push("Low intraday volatility"); }
    else if (range < 3) { score += 1; }
  }

  if (weekHigh > 0) {
    const fromHigh = ((weekHigh - price) / weekHigh) * 100;
    if (fromHigh >= 10 && fromHigh <= 30) { score += 3; reasons.push(`${fromHigh.toFixed(0)}% below 52W high`); }
    else if (fromHigh < 10)               { score += 1; }
  }

  if (weekLow > 0) {
    const fromLow = ((price - weekLow) / weekLow) * 100;
    if (fromLow > 20)      { score += 3; reasons.push(`${fromLow.toFixed(0)}% above 52W low`); }
    else if (fromLow > 10) { score += 1; }
  }

  return { score, reasons };
}
