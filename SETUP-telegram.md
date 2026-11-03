# Telegram Setup

## Create the bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, follow the prompts, and save the HTTP API token BotFather returns.

## Configure the app

Set these server-side environment variables in your deployment environment:

- `TELEGRAM_BOT_TOKEN`: the HTTP API token from BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: a strong, randomly generated secret used to authenticate Telegram webhook deliveries.

Keep both values out of source control and logs. Restart or redeploy the app after setting them.

## Register the webhook

After the app is deployed at a public HTTPS URL, send a POST request to the setup endpoint once for that deployment:

```sh
curl --fail-with-body --request POST \
  https://your-app.example.com/_agent-native/integrations/telegram/setup
```

Replace `your-app.example.com` with the app's public host. The endpoint registers `/_agent-native/integrations/telegram/webhook` with Telegram.

## Connect and verify

1. Open **Settings → Integrations → Channels → Telegram** and enter the two server-side credentials if prompted.
2. Enable Telegram and confirm its status is connected.
3. Find the bot username supplied by BotFather and send it a message. The configured app agent should answer in Telegram, using the same agent and conversation history as web chat.

Telegram messages use the user's most recent Jam Session unless the user names another session.
