/**
 * Centralized env validation (Feature 5).
 */
import * as fs from 'fs'
import * as path from 'path'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) delete process.env[key]
  Object.assign(process.env, ORIGINAL_ENV)
}

afterEach(() => {
  restoreEnv()
  jest.resetModules()
})

describe('env validation', () => {
  it('valid env passes', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?sslmode=require'
    jest.resetModules()
    const mod = await import('@/lib/env')
    expect(mod.env).toBeDefined()
    expect(mod.validateEnv(process.env).DATABASE_URL).toBe(process.env.DATABASE_URL)
  })

  it('missing required throws', () => {
    delete process.env.DATABASE_URL
    jest.resetModules()
    expect(() => require('@/lib/env')).toThrow()
  })

  it('invalid URL throws', () => {
    process.env.DATABASE_URL = 'not-a-url'
    jest.resetModules()
    expect(() => require('@/lib/env')).toThrow(/Invalid environment variables|Invalid URL/)
  })

  it('redaction in errors', () => {
    const secret = 'super-secret-redaction-value-98765'
    process.env.DATABASE_URL = secret
    jest.resetModules()
    let thrown: Error | null = null
    try {
      require('@/lib/env')
    } catch (e) {
      thrown = e as Error
    }
    expect(thrown).not.toBeNull()
    expect(thrown!.message).not.toContain(secret)
  })
})
