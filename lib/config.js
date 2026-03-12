const fs = require("fs");
const path = require("path");

function normalizeUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

function readBotToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN.trim();
  }

  const localTokenPath = path.join(process.cwd(), "bot_token.env");
  if (fs.existsSync(localTokenPath)) {
    const token = fs.readFileSync(localTokenPath, "utf8").trim();
    if (token) {
      return token;
    }
  }

  throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
}

const BOT_TOKEN = readBotToken();

const BASE_URL = process.env.BASE_URL
  ? normalizeUrl(process.env.BASE_URL.trim())
  : process.env.VERCEL_URL
    ? normalizeUrl(`https://${process.env.VERCEL_URL}`)
    : "";

const WEBAPP_URL = normalizeUrl(
  process.env.WEBAPP_URL
    ? process.env.WEBAPP_URL.trim()
    : BASE_URL
      ? `${BASE_URL}/miniapp`
      : ""
);

const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const SET_WEBHOOK_KEY = process.env.SET_WEBHOOK_KEY || "";

module.exports = {
  BASE_URL,
  BOT_TOKEN,
  SET_WEBHOOK_KEY,
  TELEGRAM_WEBHOOK_SECRET,
  WEBAPP_URL
};
