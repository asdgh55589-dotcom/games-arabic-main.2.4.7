/**
 * backup-status.test.ts — SA-3 Backup JSON Trap Fix (TDD)
 *
 * Covers:
 *  - pg_dump success → completed
 *  - pg_dump fail (+ JSON fallback failure) → failed, NEVER completed
 *  - JSON fallback fires → partial + warning log with exact reason
 *  - .gitignore covers /backups/
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { db } from '@/lib/db';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('@/lib/db', () => {
  const sharedFindMany = jest.fn().mockResolvedValue([]);
  const delegates: Record<string, { findMany: unknown }> = {};
  const names = [
    'user', 'creatorRequest', 'oAuthAccount', 'apiKey', 'follow', 'game', 'category',
    'mod', 'workflowEntry', 'modVersion', 'endorsement', 'modFile', 'modFileLink',
    'modVideoGroup', 'modVideo', 'modTeamMember', 'modContactLink', 'modCustomTab',
    'series', 'team', 'teamFollow', 'teamMembership', 'teamContactLink', 'teamCustomTab',
    'userAction', 'tierRule', 'tierHistory', 'specialRole', 'news', 'newsView', 'newsClick',
    'modComment', 'modRequest', 'auditLog', 'siteSetting', 'homepageAd', 'adClick',
    'notification', 'notificationPreference', 'notificationLog', 'notificationJob',
    'notificationTemplate', 'ipBan', 'userTrustScore', 'report', 'reportFraudSignal',
    'reportStatusHistory', 'bookmark', 'commentLike', 'section', 'downloadClick', 'modView',
    'commentSectionClick', 'scheduledJob', 'modRating', 'ticket', 'ticketMessage', 'ticketTag',
    'achievement', 'teamAchievement', 'teamPoints', 'pointsTransaction', 'savedSearch',
    'searchClick', 'platformView', 'uTMTracking', 'brokenImage', 'imageHealthLog', 'session',
    'uploadAsset', 'quotaPolicy', 'quotaOverride', 'uploadUsageDaily', 'creatorStorage',
    'passwordResetToken',
  ];
  for (const n of names) delegates[n] = { findMany: sharedFindMany };
  return { db: delegates };
});

const mockExec = exec as unknown as jest.Mock;
function mockFindMany() {
  // All delegates share one jest.fn in the factory; grab any handle.
  return (db as unknown as Record<string, { findMany: jest.Mock }>).user.findMany;
}

describe('backup status (SA-3)', () => {
  const origDbUrl = process.env.DATABASE_URL;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany().mockResolvedValue([]);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (origDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = origDbUrl;
    // cleanup any backups written during tests
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readdirSync, unlinkSync, existsSync: ex } = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { join: pjoin } = require('path') as typeof import('path');
      const dir = pjoin(process.cwd(), 'backups');
      if (ex(dir)) {
        for (const f of readdirSync(dir)) {
          if (f.startsWith('db-backup-')) {
            try { unlinkSync(pjoin(dir, f)); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }
  });

  it('pg_dump success → completed', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    mockExec.mockImplementation((_cmd: string, cb: (e: unknown, out: unknown, err: string) => void) =>
      cb(null, { stdout: '-- pg dump data --', stderr: '' }, ''),
    );
    const { createDatabaseBackup } = await import('@/lib/backup');
    const result = await createDatabaseBackup();
    expect(result.status).toBe('completed');
  });

  it('pg_dump fail → failed, NEVER completed', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    const pgErr = Object.assign(new Error("password authentication failed for user 'u'"), {
      code: 1,
      stderr: "pg_dump: error: password authentication failed for user 'u'",
    });
    mockExec.mockImplementation((_cmd: string, cb: (e: unknown, out: string, err: string) => void) =>
      cb(pgErr, '', "pg_dump: error: password authentication failed for user 'u'"),
    );
    // Force JSON fallback to also fail so the backup cannot succeed silently
    mockFindMany().mockRejectedValueOnce(new Error('db down'));
    const { createDatabaseBackup } = await import('@/lib/backup');
    const result = await createDatabaseBackup();
    expect(result.status).toBe('failed');
    expect(result.status).not.toBe('completed');
  });

  it('JSON fallback fires → partial + warning with exact reason', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    const stderr = "pg_dump: error: password authentication failed for user 'u'";
    const pgErr = Object.assign(new Error(stderr), { code: 1, stderr });
    mockExec.mockImplementation((_cmd: string, cb: (e: unknown, out: string, err: string) => void) =>
      cb(pgErr, '', stderr),
    );
    mockFindMany().mockResolvedValue([]);
    const { createDatabaseBackup } = await import('@/lib/backup');
    const result = await createDatabaseBackup();
    expect(result.status).toBe('partial');
    // warning log must propagate the exact pg_dump reason
    const warned = warnSpy.mock.calls.flat().join(' ');
    expect(warned).toMatch(/password authentication failed/);
  });

  it('.gitignore covers /backups/', () => {
    const gitignorePath = join(process.cwd(), '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, 'utf-8');
    expect(content).toMatch(/^\/backups\//m);
  });

  it('listBackups labels JSON-partial artifacts partial, pg_dump completed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { gzipSync } = require('zlib') as typeof import('zlib');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const dir = join(process.cwd(), 'backups');
    if (!existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts = Date.now();
    const partialName = `db-backup-test-partial-${ts}.sql.gz`;
    const fullName = `db-backup-test-full-${ts}.sql.gz`;
    fs.writeFileSync(
      join(dir, partialName),
      gzipSync(Buffer.from(JSON.stringify({ version: '1.0', partial: true, tables: {}, data: {} }))),
    );
    fs.writeFileSync(join(dir, fullName), gzipSync(Buffer.from('-- pg dump data --\nSELECT 1;')));
    const { listBackups } = await import('@/lib/backup');
    const byFile = new Map(listBackups().map((b) => [b.filename, b.status]));
    expect(byFile.get(partialName)).toBe('partial');
    expect(byFile.get(fullName)).toBe('completed');
  });
});
