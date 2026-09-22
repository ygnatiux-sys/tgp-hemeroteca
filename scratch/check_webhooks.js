import 'dotenv/config';

async function checkWebhook(botName, token) {
  if (!token) {
    console.log(`[${botName}] No token found.`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    console.log(`[${botName}] Webhook Info:`, data.result);
  } catch (err) {
    console.error(`[${botName}] Error:`, err.message);
  }
}

async function main() {
  console.log("=== Telegram Webhook Status ===");
  await checkWebhook("Omni Bot (Analista)", process.env.TELEGRAM_TOKEN);
  await checkWebhook("Social Bot", process.env.TELEGRAM_SOCIAL_TOKEN);
  await checkWebhook("Assistant Bot (Xavier)", process.env.TELEGRAM_TGP_CLOUD_TOKEN);
}

main();
