const crypto = require("crypto");
const { BOT_TOKEN } = require("./config");

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

function secureHexCompare(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyInitData(initData) {
  if (!initData || typeof initData !== "string") {
    return { ok: false, error: "Missing Telegram initData." };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, error: "Invalid Telegram initData: hash is missing." };
  }

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!secureHexCompare(hash, expectedHash)) {
    return { ok: false, error: "Telegram initData signature mismatch." };
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) {
    return { ok: false, error: "Invalid Telegram initData: auth_date is missing." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, error: "Telegram initData has expired." };
  }

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch (_error) {
    return { ok: false, error: "Invalid Telegram initData: user payload cannot be parsed." };
  }

  if (!user || !user.id) {
    return { ok: false, error: "Telegram user is missing." };
  }

  return { ok: true, user };
}

module.exports = {
  verifyInitData
};
