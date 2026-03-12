const { BASE_URL, TELEGRAM_WEBHOOK_SECRET } = require("../lib/config");
const { setWebhook } = require("../lib/telegram");

async function main() {
  if (!BASE_URL) {
    throw new Error("BASE_URL is not configured.");
  }

  const webhookUrl = `${BASE_URL}/api/webhook`;
  const result = await setWebhook(webhookUrl, TELEGRAM_WEBHOOK_SECRET);
  console.log("Webhook configured:", webhookUrl);
  console.log("Telegram response:", result);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
