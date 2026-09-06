/**
 * Tests for Telegram Login Widget wiring (D.1 slice 1+2).
 *
 * The official Telegram Login Widget protocol
 * (https://core.telegram.org/widgets/login) delivers the auth result via a
 * global callback named in the `data-onauth` script attribute — NOT via
 * postMessage. These tests lock that contract in.
 */

import {
  TELEGRAM_WIDGET_CALLBACK_NAME,
  TELEGRAM_WIDGET_SCRIPT_SRC,
  buildTelegramWidgetAttributes,
  getTelegramBotUsername,
} from '@/lib/telegram-widget'

describe('buildTelegramWidgetAttributes', () => {
  it('sets data-onauth to the global callback name (official widget protocol)', () => {
    const attrs = buildTelegramWidgetAttributes('MY_BOT', TELEGRAM_WIDGET_CALLBACK_NAME)
    expect(attrs['data-telegram-login']).toBe('MY_BOT')
    // Official format is executable JS: CallbackName(user)
    expect(attrs['data-onauth']).toBe(`${TELEGRAM_WIDGET_CALLBACK_NAME}(user)`)
  })

  it('keeps required widget attributes', () => {
    const attrs = buildTelegramWidgetAttributes('MY_BOT', TELEGRAM_WIDGET_CALLBACK_NAME)
    expect(attrs['data-size']).toBe('large')
    expect(attrs['data-userpic']).toBe('true')
    expect(attrs['data-lang']).toBe('ar')
  })

  it('exposes the official widget script src', () => {
    expect(TELEGRAM_WIDGET_SCRIPT_SRC).toContain('telegram.org/js/telegram-widget.js')
  })
})

describe('getTelegramBotUsername', () => {
  const OLD_PUBLIC = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  const OLD_PRIVATE = process.env.TELEGRAM_BOT_NAME

  afterEach(() => {
    if (OLD_PUBLIC === undefined) delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    else process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = OLD_PUBLIC
    if (OLD_PRIVATE === undefined) delete process.env.TELEGRAM_BOT_NAME
    else process.env.TELEGRAM_BOT_NAME = OLD_PRIVATE
  })

  it('returns the NEXT_PUBLIC_ username when set', () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = 'PUBLIC_BOT'
    expect(getTelegramBotUsername()).toBe('PUBLIC_BOT')
  })

  it('ignores the non-public TELEGRAM_BOT_NAME (always undefined in browser bundles)', () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    process.env.TELEGRAM_BOT_NAME = 'PRIVATE_BOT'
    expect(getTelegramBotUsername()).toBeUndefined()
  })

  it('returns undefined when nothing is configured', () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    delete process.env.TELEGRAM_BOT_NAME
    expect(getTelegramBotUsername()).toBeUndefined()
  })
})
