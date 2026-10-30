import { TelegramClient, validateFileSize } from '@/lib/telegram/client'

describe('TelegramClient media types', () => {
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

  it('sendMediaGroup rejects fewer than 2 items', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendMediaGroup('5', [{ type: 'photo', media: 'a' }])
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendMediaGroup rejects more than 10 items', async () => {
    const client = new TelegramClient(TOKEN)
    const items = Array.from({ length: 11 }, () => ({ type: 'photo', media: 'a' }))
    const res: any = await client.sendMediaGroup('5', items)
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendMediaGroup rejects mixed types', async () => {
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendMediaGroup('5', [
      { type: 'photo', media: 'a' },
      { type: 'video', media: 'b' },
    ])
    expect(res.ok).toBe(false)
  })

  it('sendMediaGroup success returns messageId', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: [{ message_id: 42 }] }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendMediaGroup('5', [
      { type: 'photo', media: 'a' },
      { type: 'photo', media: 'b' },
    ])
    expect(res.ok).toBe(true)
    expect(res.messageId).toBe(42)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('sendMediaGroup')
  })

  it('sendMediaGroup rejects oversized photo', async () => {
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendMediaGroup('5', [
      { type: 'photo', media: 'a', size: 60 * 1024 * 1024 },
      { type: 'photo', media: 'b' },
    ])
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendDocument calls sendDocument endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendDocument('5', 'doc.pdf', 'cap')
    expect(res.ok).toBe(true)
    expect(res.messageId).toBe(7)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('sendDocument')
  })

  it('sendVideo passes thumbnail', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendVideo('5', 'vid.mp4', 'cap', 'thumb.jpg')
    expect(res.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.thumbnail).toBe('thumb.jpg')
  })

  it('sendAudio calls sendAudio endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendAudio('5', 'a.mp3', 'cap')
    expect(res.ok).toBe(true)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('sendAudio')
  })

  it('sendSticker calls sendSticker endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendSticker('5', 'sticker.webp')
    expect(res.ok).toBe(true)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('sendSticker')
  })

  it('sendPoll calls sendPoll endpoint with options', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 11 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendPoll('5', 'Q?', ['a', 'b'])
    expect(res.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.options).toEqual(['a', 'b'])
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('sendPoll')
  })

  it('sendLocation calls sendLocation endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 12 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendLocation('5', 1.5, 2.5)
    expect(res.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.latitude).toBe(1.5)
    expect(body.longitude).toBe(2.5)
  })

  it('sendContact calls sendContact endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 13 } }), { status: 200 }))
    const client = new TelegramClient(TOKEN)
    const res: any = await client.sendContact('5', '+123', 'John')
    expect(res.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.phone_number).toBe('+123')
    expect(body.first_name).toBe('John')
  })

  it('validateFileSize helper', () => {
    expect(validateFileSize('photo', 10 * 1024 * 1024)).toBe(true)
    expect(validateFileSize('photo', 60 * 1024 * 1024)).toBe(false)
    expect(validateFileSize('video', 1 * 1024 * 1024 * 1024)).toBe(true)
    expect(validateFileSize('video', 3 * 1024 * 1024 * 1024)).toBe(false)
    expect(validateFileSize('photo')).toBe(true)
  })
})
