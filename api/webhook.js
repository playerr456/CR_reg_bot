const { CHANNEL_CHAT_ID, CHANNEL_URL, TELEGRAM_WEBHOOK_SECRET, WEBAPP_URL } = require("../lib/config");
const { getLatestRegistration, hasRegistrationFolder } = require("../lib/blob-store");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { answerCallbackQuery, getChatMember, sendMessage } = require("../lib/telegram");

function formatDateFromTimestamp(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return "";
  }
  return new Date(numericTimestamp).toISOString().slice(0, 10).replace(/-/g, ".");
}

function isSubscribedToChannel(chatMember) {
  if (!chatMember || typeof chatMember.status !== "string") {
    return false;
  }

  if (chatMember.status === "left" || chatMember.status === "kicked") {
    return false;
  }

  if (chatMember.status === "restricted") {
    return Boolean(chatMember.is_member);
  }

  return ["member", "administrator", "creator"].includes(chatMember.status);
}

function buildSubscribeCheckKeyboard() {
  const inlineKeyboard = [];

  if (CHANNEL_URL) {
    inlineKeyboard.push([
      {
        text: "Подписаться на канал",
        url: CHANNEL_URL
      }
    ]);
  }

  inlineKeyboard.push([
    {
      text: "Проверить подписку",
      callback_data: "check_subscription"
    }
  ]);

  return { inline_keyboard: inlineKeyboard };
}

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

async function checkSubscriptionState(userId) {
  if (!CHANNEL_CHAT_ID) {
    return { subscribed: true, verified: false };
  }

  try {
    const member = await getChatMember(CHANNEL_CHAT_ID, userId);
    return {
      subscribed: isSubscribedToChannel(member),
      verified: true
    };
  } catch (error) {
    const text = String(error?.message || "");
    if (/member list is inaccessible/i.test(text)) {
      return { subscribed: true, verified: false };
    }

    return {
      subscribed: false,
      verified: false,
      error: "Не удалось проверить подписку. Попробуйте еще раз."
    };
  }
}

async function handleCheckSubscription(callbackQuery) {
  const callbackQueryId = callbackQuery?.id;
  const chatId = callbackQuery?.message?.chat?.id;
  const userId = callbackQuery?.from?.id;

  if (!callbackQueryId || !chatId || !userId) {
    return;
  }

  const subscriptionState = await checkSubscriptionState(userId);
  if (subscriptionState.error) {
    await answerCallbackQuery(callbackQueryId, subscriptionState.error);
    return;
  }

  if (!subscriptionState.subscribed) {
    await answerCallbackQuery(callbackQueryId, "Подписка не найдена.");
    await sendMessage(
      chatId,
      "Сначала подпишитесь на канал, затем нажмите «Проверить подписку».",
      buildSubscribeCheckKeyboard()
    );
    return;
  }

  const registration = await getLatestRegistration(String(userId));
  if (!registration) {
    await answerCallbackQuery(callbackQueryId, "Регистрация не найдена.");
    await sendMessage(chatId, "Регистрация не найдена. Заполните форму снова.");
    return;
  }

  const formattedDate = formatDateFromTimestamp(registration.timestamp);
  const lines = [
    "Регистрация принята.",
    `ФИО: ${registration.fullName}`,
    `номер группы: ${registration.groupNumber}`,
    `CR тэг: ${registration.crId}`,
    `CR nickname: ${registration.crNickname}`,
    `Время: ${formattedDate || registration.timestamp}`
  ];

  await sendMessage(chatId, lines.join("\n"));
  await answerCallbackQuery(callbackQueryId, "Готово.");
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

  const callbackQuery = update?.callback_query;
  if (callbackQuery?.data === "check_subscription") {
    await handleCheckSubscription(callbackQuery);
  }

  return sendJson(res, 200, { ok: true });
};
