const { TELEGRAM_WEBHOOK_SECRET, WEBAPP_URL } = require("../lib/config");
const { hasRegistrationFolder } = require("../lib/blob-store");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { sendMessage } = require("../lib/telegram");

function buildKeyboard(hasExistingRegistration) {
  const inlineKeyboard = [
    [
      {
        text: "Открыть регистрацию",
        web_app: { url: `${WEBAPP_URL}?mode=new` }
      }
    ]
  ];

  if (hasExistingRegistration) {
    inlineKeyboard.push([
      {
        text: "Изменить регистрацию",
        web_app: { url: `${WEBAPP_URL}?mode=edit` }
      }
    ]);
  }

  return { inline_keyboard: inlineKeyboard };
}

async function handleStartCommand(message) {
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  if (!chatId || !userId) {
    return;
  }

  if (!WEBAPP_URL) {
    await sendMessage(chatId, "WEBAPP_URL не настроен. Обратитесь к администратору.");
    return;
  }

  let hasExistingRegistration = false;
  try {
    hasExistingRegistration = await hasRegistrationFolder(String(userId));
  } catch (_error) {
    hasExistingRegistration = false;
  }

  const text = hasExistingRegistration
    ? "Вы уже зарегистрированы. Нажмите «Изменить регистрацию», чтобы обновить данные."
    : "Нажмите кнопку ниже, чтобы открыть мини-приложение и пройти регистрацию.";

  await sendMessage(chatId, text, buildKeyboard(hasExistingRegistration));
}

module.exports = async function webhookHandler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ok: true, message: "Webhook is alive." });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  if (TELEGRAM_WEBHOOK_SECRET) {
    const token = req.headers["x-telegram-bot-api-secret-token"];
    if (token !== TELEGRAM_WEBHOOK_SECRET) {
      return sendJson(res, 401, { ok: false, error: "Invalid webhook secret token." });
    }
  }

  let update;
  try {
    update = req.body && typeof req.body === "object" ? req.body : await parseJsonBody(req);
  } catch (_error) {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON payload." });
  }

  const message = update?.message;
  if (message?.text && message.text.startsWith("/start")) {
    await handleStartCommand(message);
  }

  return sendJson(res, 200, { ok: true });
};
