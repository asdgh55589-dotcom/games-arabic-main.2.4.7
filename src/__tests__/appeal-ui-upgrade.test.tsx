/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { AppealDialog } from '@/components/creator/appeal-dialog'
import { AppealSchema } from '@/lib/schemas/appeal'

afterEach(() => cleanup())

describe('AppealSchema', () => {
  it('accepts valid reason with min length', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(10) })
    expect(r.success).toBe(true)
  })

  it('rejects reason shorter than 10', () => {
    const r = AppealSchema.safeParse({ reason: 'short' })
    expect(r.success).toBe(false)
  })

  it('rejects reason longer than 2000', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(2001) })
    expect(r.success).toBe(false)
  })

  it('accepts empty evidenceUrl', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(10), evidenceUrl: '' })
    expect(r.success).toBe(true)
  })

  it('accepts valid evidenceUrl', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(10), evidenceUrl: 'https://example.com/proof' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid evidenceUrl', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(10), evidenceUrl: 'not-a-url' })
    expect(r.success).toBe(false)
  })

  it('accepts missing evidenceUrl', () => {
    const r = AppealSchema.safeParse({ reason: 'a'.repeat(10) })
    expect(r.success).toBe(true)
  })
})

describe('AppealDialog', () => {
  it('renders trigger button', () => {
    render(<AppealDialog reportId="r1" />)
    expect(screen.getByText('استئناف')).toBeTruthy()
  })

  it('opens dialog on trigger click', () => {
    render(<AppealDialog reportId="r1" />)
    fireEvent.click(screen.getByText('استئناف'))
    expect(screen.getByPlaceholderText('سبب الطعن')).toBeTruthy()
  })

  it('submits valid appeal and calls fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock as any
    const onSuccess = jest.fn()
    render(<AppealDialog reportId="r1" onSuccess={onSuccess} />)
    fireEvent.click(screen.getByText('استئناف'))
    fireEvent.change(screen.getByPlaceholderText('سبب الطعن'), { target: { value: 'a'.repeat(10) } })
    const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement
    fireEvent.click(submit)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('does not submit invalid reason', async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as any
    render(<AppealDialog reportId="r1" />)
    fireEvent.click(screen.getByText('استئناف'))
    const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement
    fireEvent.click(submit)
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('reports-client integration', () => {
  it('uses AppealDialog', () => {
    const root = process.cwd()
    const ui = fs.readFileSync(path.join(root, 'src/components/creator/reports-client.tsx'), 'utf8')
    expect(ui).toContain('AppealDialog')
    expect(ui).toContain('<AppealDialog')
  })
})
