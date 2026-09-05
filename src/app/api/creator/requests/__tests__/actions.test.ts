/**
 * PART 2 Phase 1 — Fix 4 tests: request accept/boost/cancel IDOR + spam guards.
 */
jest.mock('@/lib/db', () => ({
  db: {
    modRequest: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    mod: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { requireCreatorStudio } from '@/lib/auth';
import { db } from '@/lib/db';
import { PATCH } from '../[id]/route';

const mockDb = db as unknown as {
  modRequest: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  mod: { findUnique: jest.Mock };
  notification: { create: jest.Mock };
};
const mockAuth = requireCreatorStudio as jest.Mock;

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'creator-A', role: 'creator' }, error: null });
  mockDb.notification.create.mockResolvedValue({ id: 'n-1' });
});

describe('accept', () => {
  it('second concurrent accept fails (atomic claim on open)', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'open',
      userId: 'requester',
      gameName: 'G',
    });
    // already claimed by someone else at write time
    mockDb.modRequest.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(req({ action: 'accept' }), params('r-1'));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({});
  });

  it('accept with foreign modId is rejected', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'open',
      userId: 'requester',
      gameName: 'G',
    });
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm-x', authorId: 'creator-B' });

    const res = await PATCH(req({ action: 'accept', modId: 'm-x' }), params('r-1'));

    expect(res.status).toBe(422);
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled();
  });

  it('accept with own modId succeeds', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'open',
      userId: 'requester',
      gameName: 'G',
    });
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm-a', authorId: 'creator-A' });
    mockDb.modRequest.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(req({ action: 'accept', modId: 'm-a' }), params('r-1'));

    expect(res.status).toBe(200);
  });
});

describe('boost rate limit', () => {
  it('second boost within the hour returns 429', async () => {
    const { rateLimitMiddleware } = jest.requireMock('@/lib/rate-limit') as {
      rateLimitMiddleware: jest.Mock;
    };
    mockDb.modRequest.findUnique.mockResolvedValue({ id: 'r-1', status: 'open' });
    rateLimitMiddleware
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'x', code: 'RATE_LIMITED' }), { status: 429 }),
      );

    const first = await PATCH(req({ action: 'boost' }), params('r-1'));
    expect(first.status).toBe(200);

    const second = await PATCH(req({ action: 'boost' }), params('r-1'));
    expect(second.status).toBe(429);
  });
});

describe('cancel', () => {
  it('accepter can release an accepted (not started) request back to open', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'accepted',
      userId: 'requester',
      acceptedBy: 'creator-A',
    });
    mockDb.modRequest.update.mockResolvedValue({});

    const res = await PATCH(req({ action: 'cancel' }), params('r-1'));

    expect(res.status).toBe(200);
    expect(mockDb.modRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'open' }),
      }),
    );
  });

  it('accepter cannot cancel a completed request', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'completed',
      userId: 'requester',
      acceptedBy: 'creator-A',
    });

    const res = await PATCH(req({ action: 'cancel' }), params('r-1'));

    expect(res.status).toBe(403);
  });

  it('stranger cannot cancel', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'accepted',
      userId: 'requester',
      acceptedBy: 'creator-B',
    });

    const res = await PATCH(req({ action: 'cancel' }), params('r-1'));

    expect(res.status).toBe(403);
  });
});
