import { TelegramClient, TelegramRateLimitError } from '@/lib/telegram/client'

describe('TelegramClient', () => {
  const TOKEN = 'secret-token-123'
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    jest.restoreAllMocks()
    delete process.env.TELEGRAM_BOT_TOKEN
    fetchMock = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  it('uses env token when no constructor arg', async () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient()
    await client.sendMessage({ chatId: '5', text: 'hi' })
    expect(fetchMock).toHaveBeenCalled()
    const url = fetchMock.mock.calls[0][0]
    expect(String(url)).toContain(TOKEN)
  })

  it('accepts a token string in constructor', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    expect(client.getToken()).toBe(TOKEN)
  })

  it('accepts an options object in constructor', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient({ botToken: TOKEN })
    expect(client.getToken()).toBe(TOKEN)
  })

  it('sendMessage returns ok:true on success', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res = await client.sendMessage({ chatId: '5', text: 'hi' })
    expect(res.ok).toBe(true)
    expect(res.result.message_id).toBe(7)
  })

  it('sendMessage sends expected body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    await client.sendMessage({ chatId: '5', text: 'hi', parseMode: 'HTML' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body.chat_id).toBe('5')
    expect(body.text).toBe('hi')
    expect(body.parse_mode).toBe('HTML')
  })

  it('sendPhoto returns ok:true on success', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res = await client.sendPhoto({ chatId: '5', photo: 'http://img', caption: 'cap' })
    expect(res.ok).toBe(true)
  })

  it('editMessage calls editMessageText', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    await client.editMessage({ chatId: '5', messageId: 7, text: 'edited' })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('editMessageText')
  })

  it('deleteMessage calls deleteMessage', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res = await client.deleteMessage({ chatId: '5', messageId: 7 })
    expect(res.ok).toBe(true)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('deleteMessage')
  })

  it('throws TelegramRateLimitError on 429 with retry_after', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: false, parameters: { retry_after: 12 } }), { status: 429 })))
    const client = new TelegramClient(TOKEN)
    await expect(client.sendMessage({ chatId: '5', text: 'hi' })).rejects.toBeInstanceOf(TelegramRateLimitError)
    try {
      await client.sendMessage({ chatId: '5', text: 'hi' })
    } catch (e) {
      expect((e as TelegramRateLimitError).retryAfter).toBe(12)
    }
  })

  it('returns ok:false without fetch when no token', async () => {
    const client = new TelegramClient(null)
    const res = await client.sendMessage({ chatId: '5', text: 'hi' })
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
