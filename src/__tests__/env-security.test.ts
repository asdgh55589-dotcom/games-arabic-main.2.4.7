/**
 * Env/secret hygiene invariants (deploy-readiness audit).
 *
 * - Local .env files stay gitignored (never committed).
 * - No tracked file carries a real-looking secret (placeholders like
 *   "your-..."/"example"/"test"/"xxx"/empty are allowed).
 * - Reports NEVER print values — file paths + match counts only.
 */
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function trackedFiles(): string[] {
  const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|js|jsx|json|md|mdx|yml|yaml|toml|sh)$/.test(f))
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'stripe-live', re: /sk_live_[0-9a-zA-Z]+/ },
  { name: 'slack-token', re: /xox[bpas]-[0-9A-Za-z-]+/ },
  { name: 'neon-key', re: /npg_[A-Za-z0-9_]+/ },
  { name: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'resend-live', re: /re_[A-Za-z0-9]{20,}/ },
  { name: 'supabase-service-role', re: /sb_secret_[A-Za-z0-9_]+/ },
  { name: 'telegram-token', re: /[0-9]{6,}:[A-Za-z0-9_-]{30,}/ },
]

/** Placeholder-shaped values are documentation, not secrets. */
function isPlaceholderHit(line: string): boolean {
  return /your-|example|placeholder|xxx+|test-|changeme|^\s*#|NEXT_PUBLIC_|process\.env\.|getenv|PLACEHOLDER/i.test(
    line,
  )
}

describe('env files stay out of git', () => {
  it('.env variants are gitignored', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
    for (const entry of ['.env\n', '.env.local', '.env.production', '.env.*.local']) {
      expect(gitignore).toContain(entry)
    }
    for (const f of ['.env', '.env.local', '.env.production']) {
      const out = execSync(`git check-ignore ${f} || true`, { cwd: ROOT, encoding: 'utf8' }).trim()
      expect(out).toBe(f)
    }
  })

  it('git ls-files contains no .env with values', () => {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    const hits = out.split('\n').filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'))
    expect(hits).toEqual([])
  })
})

describe('no real secrets in tracked files', () => {
  it('secret patterns hit only placeholders/docs', () => {
    const offenders: string[] = []
    for (const f of trackedFiles()) {
      let text: string
      try {
        text = fs.readFileSync(path.join(ROOT, f), 'utf8')
      } catch {
        continue
      }
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        for (const p of SECRET_PATTERNS) {
          if (p.re.test(line) && !isPlaceholderHit(line)) {
            offenders.push(`${f}:${i + 1} [${p.name}]`)
          }
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
