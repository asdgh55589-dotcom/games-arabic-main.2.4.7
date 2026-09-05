/**
 * PART 2 Phase 1 — Fix 3 tests: creator requests pagination.
 * 1000 open requests must not render unbounded: API pages (default 20,
 * max 50) and returns pagination meta.
 */
jest.mock('@/lib/db', () => ({
  db: {
    modRequest: { findMany: jest.fn(), count: jest.fn() },
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
  modRequest: { findMany: jest.Mock; count: jest.Mock };
};
const mockAuth = requireCreatorStudio as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'creator-1', role: 'creator' }, error: null });
  mockDb.modRequest.findMany.mockResolvedValue([]);
  mockDb.modRequest.count.mockResolvedValue(0);
});

describe('GET /api/creator/requests pagination', () => {
  it('defaults to page 1, limit 20', async () => {
    const res = await GET(new NextRequest('http://localhost/api/creator/requests'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockDb.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(json.data.pagination).toMatchObject({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('clamps limit to max 50', async () => {
    await GET(new NextRequest('http://localhost/api/creator/requests?limit=1000'));

    expect(mockDb.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('page 2 skips the first page', async () => {
    await GET(new NextRequest('http://localhost/api/creator/requests?page=2&limit=20'));

    expect(mockDb.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });

  it('keeps status filter alongside pagination', async () => {
    await GET(new NextRequest('http://localhost/api/creator/requests?status=mine'));

    expect(mockDb.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ acceptedBy: 'creator-1' }),
        take: 20,
      }),
    );
  });
});
