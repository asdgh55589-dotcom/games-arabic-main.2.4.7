/**
 * lib/telegram-widget.ts — Telegram Login Widget wiring helpers (D.1).
 *
 * The official Telegram Login Widget protocol
 * (https://core.telegram.org/widgets/login) delivers the auth result by
 * calling a GLOBAL function named in the script's `data-onauth` attribute:
 *
 *   <script ... data-telegram-login="BotName" data-onauth="onTelegramAuth(user)">
 *
 * It does NOT postMessage anything — so listening for `message` events from
 * oauth.telegram.org never fires. These helpers lock the correct contract in
 * one place so the component (`components/telegram-login.tsx`) and the login
 * view cannot drift from it.
 */

/** Official widget loader. */
export const TELEGRAM_WIDGET_SCRIPT_SRC = 'https://telegram.org/js/telegram-widget.js?22'

/**
 * Name of the window-global callback the widget invokes with the auth payload.
 * The component assigns `window[TELEGRAM_WIDGET_CALLBACK_NAME] = onAuth`.
 */
export const TELEGRAM_WIDGET_CALLBACK_NAME = 'onTelegramAuth'

/** Attributes to set on the injected widget <script> element. */
export function buildTelegramWidgetAttributes(
  botName: string,
  callbackName: string = TELEGRAM_WIDGET_CALLBACK_NAME,
): Record<string, string> {
  return {
    'data-telegram-login': botName,
    'data-size': 'large',
    'data-radius': '8',
    'data-request-access': 'write',
    'data-userpic': 'true',
    'data-lang': 'ar',
    'data-onauth': `${callbackName}(user)`,
  }
}

/**
 * Client-safe bot username resolver.
 *
 * Only `NEXT_PUBLIC_`-prefixed vars are inlined into browser bundles — a
 * server-only name like `TELEGRAM_BOT_NAME` is ALWAYS undefined on the
 * client, so gating UI on it silently disables Telegram login. Callers must
 * pass nothing else; server code keeps reading `TELEGRAM_BOT_NAME` directly.
 */
export function getTelegramBotUsername(): string | undefined {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || undefined
}
