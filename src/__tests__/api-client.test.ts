import { safeJson } from '@/lib/api-client'

function makeRes(status: number, body: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  } as unknown as Response
}

describe('safeJson', () => {
  it('returns parsed object on 200 with JSON', async () => {
    const res = makeRes(200, JSON.stringify({ data: { id: '1' } }))
    const out = await safeJson(res)
    expect(out).toEqual({ data: { id: '1' } })
  })

  it('returns null on 204', async () => {
    const res = makeRes(204, '')
    const out = await safeJson(res)
    expect(out).toBeNull()
  })

  it('returns null on 304', async () => {
    const res = makeRes(304, '')
    const out = await safeJson(res)
    expect(out).toBeNull()
  })

  it('returns null on 200 with empty body', async () => {
    const res = makeRes(200, '')
    const out = await safeJson(res)
    expect(out).toBeNull()
  })

  it('throws with server error message on 400 with JSON error', async () => {
    const res = makeRes(400, JSON.stringify({ error: { message: 'bad input' } }))
    await expect(safeJson(res)).rejects.toThrow('bad input')
  })

  it('throws HTTP status on 500 with HTML body', async () => {
    const res = makeRes(500, '<html>error</html>')
    await expect(safeJson(res)).rejects.toThrow('HTTP 500')
  })

  it('throws Invalid JSON response on 200 with invalid JSON', async () => {
    const res = makeRes(200, '{not json')
    await expect(safeJson(res)).rejects.toThrow('Invalid JSON response')
  })
})
