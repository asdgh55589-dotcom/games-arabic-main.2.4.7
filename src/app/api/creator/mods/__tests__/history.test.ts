/**
 * PART 2 Phase 1 — Fix 2 tests: creator workflow/versions history GETs.
 * These endpoints back the mod-form history panels; callers 404'd before.
 */
jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn() },
    workflowEntry: { findMany: jest.fn() },
    modVersion: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { requireCreatorStudio } from '@/lib/auth';
import { db } from '@/lib/db';
import { GET as workflowGET } from '../[id]/workflow/route';
import { GET as versionsGET } from '../[id]/versions/route';

const mockDb = db as unknown as {
  mod: { findUnique: jest.Mock };
  workflowEntry: { findMany: jest.Mock };
  modVersion: { findMany: jest.Mock };
};
const mockAuth = requireCreatorStudio as jest.Mock;

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'creator-A', role: 'creator' }, error: null });
  mockDb.mod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'creator-A' });
});

describe('GET /api/creator/mods/[id]/workflow', () => {
  it('returns own-mod entries newest-first', async () => {
    mockDb.workflowEntry.findMany.mockResolvedValue([
      { id: 'w2', toStatus: 'PUBLISHED' },
      { id: 'w1', toStatus: 'IN_REVIEW' },
    ]);

    const res = await workflowGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'mod-1' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(mockDb.workflowEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ modId: 'mod-1' }),
        orderBy: expect.objectContaining({ changedAt: 'desc' }),
      }),
    );
  });

  it('403 for another creator mod', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'creator-B' });

    const res = await workflowGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'mod-1' }),
    });

    expect(res.status).toBe(403);
    expect(mockDb.workflowEntry.findMany).not.toHaveBeenCalled();
  });

  it('404 for missing mod', async () => {
    mockDb.mod.findUnique.mockResolvedValue(null);

    const res = await workflowGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'nope' }),
    });

    expect(res.status).toBe(404);
  });

  it('401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: null });

    const res = await workflowGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'mod-1' }),
    });

    expect([401, 403]).toContain(res.status);
  });
});

describe('GET /api/creator/mods/[id]/versions', () => {
  it('returns own-mod versions newest-first', async () => {
    mockDb.modVersion.findMany.mockResolvedValue([{ id: 'v1', version: '1.0' }]);

    const res = await versionsGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'mod-1' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockDb.modVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ modId: 'mod-1' }),
        orderBy: expect.objectContaining({ createdAt: 'desc' }),
      }),
    );
  });

  it('403 for another creator mod', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'creator-B' });

    const res = await versionsGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'mod-1' }),
    });

    expect(res.status).toBe(403);
    expect(mockDb.modVersion.findMany).not.toHaveBeenCalled();
  });

  it('404 for missing mod', async () => {
    mockDb.mod.findUnique.mockResolvedValue(null);

    const res = await versionsGET(req('http://localhost/x'), {
      params: Promise.resolve({ id: 'nope' }),
    });

    expect(res.status).toBe(404);
  });
});
