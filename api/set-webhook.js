const { BASE_URL, SET_WEBHOOK_KEY, TELEGRAM_WEBHOOK_SECRET } = require("../lib/config");
const { methodNotAllowed, sendJson } = require("../lib/http");
const { setWebhook } = require("../lib/telegram");

function getRequestKey(req) {
  const url = new URL(req.url, "http://localhost");
  return req.headers["x-set-webhook-key"] || url.searchParams.get("key") || "";
}

module.exports = async function setWebhookHandler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  if (SET_WEBHOOK_KEY) {
    const key = getRequestKey(req);
    if (key !== SET_WEBHOOK_KEY) {
      return sendJson(res, 401, { ok: false, error: "Invalid set-webhook key." });
    }
  }

  if (!BASE_URL) {
    return sendJson(res, 400, { ok: false, error: "BASE_URL is not configured." });
  }

  const webhookUrl = `${BASE_URL}/api/webhook`;

  try {
    const result = await setWebhook(webhookUrl, TELEGRAM_WEBHOOK_SECRET);
    return sendJson(res, 200, {
      ok: true,
      webhookUrl,
      result
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
};
