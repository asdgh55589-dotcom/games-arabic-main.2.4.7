/**
 * PART 2 Phase 1 — Fix 7 tests: creator stats without full-table scans.
 * No unbounded findMany; same response shape.
 */
jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { requireCreatorStudio } from '@/lib/auth';
import { db } from '@/lib/db';
import { GET } from '../route';

const mockDb = db as unknown as {
  mod: { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  (requireCreatorStudio as jest.Mock).mockResolvedValue({
    user: { id: 'creator-1', role: 'creator' },
    error: null,
  });
  mockDb.mod.count.mockResolvedValue(3);
  mockDb.mod.groupBy.mockResolvedValue([
    { workflowStatus: 'PUBLISHED', _count: { workflowStatus: 2 } },
    { workflowStatus: 'DRAFT', _count: { workflowStatus: 1 } },
  ]);
  mockDb.mod.aggregate.mockResolvedValue({
    _sum: { views: 100, downloads: 50, endorsements: 5, comments: 7 },
    _avg: { rating: 4.5 },
  });
  mockDb.mod.findMany.mockResolvedValue([]);
});

describe('GET /api/creator/stats bounded aggregation', () => {
  it('returns totals/topMods/recentActivity shape', async () => {
    const res = await GET(new NextRequest('http://localhost/api/creator/stats'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.totals).toMatchObject({
      totalMods: 3,
      published: 2,
      drafts: 1,
      totalViews: 100,
      totalDownloads: 50,
      totalEndorsements: 5,
      totalComments: 7,
      averageRating: 4.5,
    });
    expect(json.data).toHaveProperty('topMods');
    expect(json.data).toHaveProperty('recentActivity');
  });

  it('every findMany call is bounded with take and creator-scoped', async () => {
    await GET(new NextRequest('http://localhost/api/creator/stats'));

    expect(mockDb.mod.findMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of mockDb.mod.findMany.mock.calls) {
      expect(call[0]).toHaveProperty('take');
      expect(call[0].take).toBeLessThanOrEqual(20);
      expect(call[0].where).toMatchObject({ authorId: 'creator-1' });
    }
  });

  it('401 when unauthenticated', async () => {
    (requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null });

    const res = await GET(new NextRequest('http://localhost/api/creator/stats'));

    expect([401, 403]).toContain(res.status);
  });
});
