import axios from "axios";

export async function sendTelegram(msg, chatId, silent = false) {
  const token = process.env.BOT_TOKEN;
  const target = chatId || process.env.CHAT_ID;
  if (!token || !target) return false;

  try {
    const r = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: target, text: msg, parse_mode: "HTML", disable_notification: silent },
      { timeout: 10000 }
    );
    return r.status === 200;
  } catch (e) {
    console.error("Telegram error:", e.message);
    return false;
  }
}
