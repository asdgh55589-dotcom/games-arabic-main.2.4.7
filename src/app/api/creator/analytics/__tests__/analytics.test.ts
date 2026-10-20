/**
 * PART 2 Phase 2 Step 3 — analytics history + summary endpoints.
 * Bounded, creator-scoped (authorId), aggregate-first, Arabic errors.
 */
jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
    mod: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    modView: { findMany: jest.fn(), count: jest.fn() },
    downloadClick: { findMany: jest.fn(), count: jest.fn() },
    modComment: { count: jest.fn() },
    commentSectionClick: { findMany: jest.fn(), count: jest.fn() },
    endorsement: { count: jest.fn() },
    news: { findMany: jest.fn() },
    newsView: { count: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { requireCreatorStudio } from '@/lib/auth';
import { db } from '@/lib/db';
import { GET as historyGET } from '../history/route';
import { GET as analyticsGET } from '../route';

const mockDb = db as unknown as {
  $queryRaw: jest.Mock;
  mod: { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
  modView: { findMany: jest.Mock; count: jest.Mock };
  downloadClick: { findMany: jest.Mock; count: jest.Mock };
  modComment: { count: jest.Mock };
  commentSectionClick: { findMany: jest.Mock; count: jest.Mock };
  endorsement: { count: jest.Mock };
  news: { findMany: jest.Mock };
  newsView: { count: jest.Mock };
};

const MODS = [{ id: 'm-1' }, { id: 'm-2' }];

beforeEach(() => {
  jest.clearAllMocks();
  (requireCreatorStudio as jest.Mock).mockResolvedValue({
    user: { id: 'creator-1', role: 'creator' },
    error: null,
  });
  mockDb.mod.findMany.mockResolvedValue(MODS);
});

describe('GET /api/creator/analytics/history', () => {
  beforeEach(() => {
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.modView.findMany.mockResolvedValue([]);
    mockDb.downloadClick.findMany.mockResolvedValue([]);
    mockDb.commentSectionClick.findMany.mockResolvedValue([]);
    mockDb.modView.count.mockResolvedValue(0);
    mockDb.downloadClick.count.mockResolvedValue(0);
    mockDb.commentSectionClick.count.mockResolvedValue(0);
  });

  it('returns zero-filled daily buckets for the range', async () => {
    const res = await historyGET(new NextRequest('http://localhost/x?range=7'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.views).toHaveLength(7);
    expect(json.data.downloads).toHaveLength(7);
    expect(json.data.views[0]).toHaveProperty('date');
    expect(json.data.views[0]).toHaveProperty('count', 0);
    expect(json.data).toMatchObject({ totalViews: 0, totalDownloads: 0 });
  });

  it('scopes queries to creator mods only', async () => {
    await historyGET(new NextRequest('http://localhost/x?range=7'));

    expect(mockDb.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'creator-1' }) }),
    );
    expect(mockDb.$queryRaw).toHaveBeenCalled();
  });

  it('buckets events into calendar days', async () => {
    const day2 = new Date();
    day2.setDate(day2.getDate() - 2);
    day2.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    mockDb.$queryRaw
      .mockResolvedValueOnce([{ day: day2, count: 2 }, { day: today, count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockDb.modView.count.mockResolvedValue(3);

    const res = await historyGET(new NextRequest('http://localhost/x?range=7'));
    const json = await res.json();

    const total = (json.data.views as { count: number }[]).reduce((n, d) => n + d.count, 0);
    expect(total).toBe(3);
    expect(json.data.totalViews).toBe(3);
  });

  it('rejects invalid range in Arabic', async () => {
    const res = await historyGET(new NextRequest('http://localhost/x?range=bogus'));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(JSON.stringify(json)).toMatch(/النطاق/);
  });

  it('401 when unauthenticated', async () => {
    (requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null });

    const res = await historyGET(new NextRequest('http://localhost/x?range=7'));

    expect([401, 403]).toContain(res.status);
  });
});

describe('GET /api/creator/analytics', () => {
  beforeEach(() => {
    mockDb.mod.count.mockResolvedValue(5);
    mockDb.modView.count.mockResolvedValue(100);
    mockDb.downloadClick.count.mockResolvedValue(40);
    mockDb.modComment.count.mockResolvedValue(12);
    mockDb.commentSectionClick.count.mockResolvedValue(0);
    mockDb.endorsement.count.mockResolvedValue(0);
    mockDb.news.findMany.mockResolvedValue([]);
    mockDb.newsView.count.mockResolvedValue(0);
    mockDb.mod.aggregate.mockResolvedValue({ _sum: { endorsements: 9 } });
  });

  it('returns totals + previous-period change', async () => {
    // current 100 views vs previous 50 → +100%
    mockDb.modView.count
      .mockResolvedValueOnce(100) // current
      .mockResolvedValueOnce(50); // previous
    mockDb.downloadClick.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(40);

    const res = await analyticsGET(new NextRequest('http://localhost/x?range=30'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.totalViews).toBe(100);
    expect(json.data.viewsChange).toBe(100);
    expect(json.data.totalDownloads).toBe(40);
    expect(json.data.downloadsChange).toBe(0);
    expect(json.data).toHaveProperty('totalComments', 12);
    expect(json.data).toHaveProperty('newModsThisPeriod');
    expect(json.data).toHaveProperty('activeModsCount');
  });

  it('zero previous period yields null change (new growth, no division by zero)', async () => {
    mockDb.modView.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);

    const res = await analyticsGET(new NextRequest('http://localhost/x?range=30'));
    const json = await res.json();

    expect(json.data.viewsChange).toBeNull();
  });
});
