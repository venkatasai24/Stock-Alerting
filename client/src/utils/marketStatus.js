// NSE trading hours: Mon–Fri 9:15 AM – 3:30 PM IST, excluding public holidays

const NSE_HOLIDAYS = new Set([
  // 2025
  "2025-02-26", // Mahashivratri
  "2025-03-14", // Holi
  "2025-03-31", // Id-Ul-Fitr (Ramzan Eid) — tentative
  "2025-04-10", // Ram Navami
  "2025-04-14", // Dr. Ambedkar Jayanti
  "2025-04-18", // Good Friday
  "2025-05-01", // Maharashtra Day
  "2025-08-15", // Independence Day
  "2025-08-27", // Ganesh Chaturthi
  "2025-10-02", // Gandhi Jayanti
  "2025-10-20", // Diwali – Laxmi Puja
  "2025-10-21", // Diwali – Balipratipada
  "2025-10-28", // Prakash Gurpurab
  "2025-12-25", // Christmas
  // 2026 (approximate)
  "2026-01-26", "2026-03-03", "2026-04-03",
  "2026-04-14", "2026-05-01", "2026-08-15",
  "2026-10-02", "2026-11-14", "2026-12-25",
]);

export function getMarketStatus() {
  const now = new Date();

  // Convert UTC → IST by adding exactly 330 minutes, then read UTC components
  // This works correctly regardless of the browser's local timezone
  const IST_OFFSET_MS = 330 * 60 * 1000; // 5h 30m
  const ist = new Date(now.getTime() + IST_OFFSET_MS);

  const day     = ist.getUTCDay();    // 0 = Sun, 6 = Sat
  const hours   = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const hhmm    = hours * 100 + minutes;
  const dateStr = ist.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const timeStr = `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")} IST`;

  if (day === 0) return { open: false, label: "Closed", reason: "Market closed — Sunday" };
  if (day === 6) return { open: false, label: "Closed", reason: "Market closed — Saturday" };

  if (NSE_HOLIDAYS.has(dateStr))
    return { open: false, label: "Holiday", reason: "Market closed today — public holiday" };

  if (hhmm < 915)
    return { open: false, label: "Pre-market", reason: `Market opens at 9:15 AM IST · now ${timeStr}` };

  if (hhmm >= 1530)
    return { open: false, label: "Closed", reason: `Market closed at 3:30 PM IST · prices are from today's close` };

  return { open: true, label: "Live", reason: null };
}
