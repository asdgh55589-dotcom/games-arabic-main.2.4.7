/**
 * RED error-signal fix: errors recorded AT THE SOURCE with the REAL status.
 *
 * Regression: proxy.ts (middleware, runs BEFORE route handlers) logged
 * res.status from proxyInner — always 200 for pass-throughs — so `isError`
 * was false forever and the in-memory RED store had no readers.
 * Fix: api-response.ts fail() + proxyJson() record via recordRouteError(),
 * exposed through getRouteErrors() on the monitoring endpoint.
 * All backends mocked (no network/DB/Redis).
 */

jest.mock('@/lib/redis', () => ({
  redisGet: jest.fn(),
  redisSet: jest.fn(),
  redisDel: jest.fn(),
  redisSetNX: jest.fn(),
  redisIncr: jest.fn(),
  getRedisInfo: () => ({ connected: false, type: 'in-memory', storeSize: 0 }),
  redisClient: null,
}));

import {
  getRouteErrors,
  recordRouteError,
  resetRouteErrors,
} from '@/lib/observability/red-metrics';
import { fail, notFound, unauthorized, validationFail } from '@/lib/api-response';

beforeEach(() => {
  resetRouteErrors();
  jest.clearAllMocks();
});

describe('recordRouteError — source-side error ledger', () => {
  test('records route + real status', async () => {
    recordRouteError('/api/mods/nope', 404);
    const errors = await getRouteErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ route: '/api/mods/nope', status: 404, count: 1 });
  });

  test('aggregates repeated errors on the same route+status', async () => {
    recordRouteError('/api/x', 500);
    recordRouteError('/api/x', 500);
    recordRouteError('/api/x', 422);
    const errors = await getRouteErrors();
    const e500 = errors.find((e) => e.status === 500);
    const e422 = errors.find((e) => e.status === 422);
    expect(e500?.count).toBe(2);
    expect(e422?.count).toBe(1);
  });

  test('never throws, even with hostile input', async () => {
    expect(() => recordRouteError('', NaN)).not.toThrow();
    expect(() => recordRouteError('/api/x', 404)).not.toThrow();
    const errors = await getRouteErrors();
    expect(errors.length).toBeGreaterThan(0);
  });

  test('results sorted by count desc', async () => {
    recordRouteError('/api/rare', 404);
    recordRouteError('/api/hot', 500);
    recordRouteError('/api/hot', 500);
    recordRouteError('/api/hot', 500);
    const errors = await getRouteErrors();
    expect(errors[0].route).toBe('/api/hot');
  });
});

describe('fail() — every error response feeds the RED ledger', () => {
  test('notFound() records 404 with instance as route', async () => {
    const res = notFound('Mod not found', '/api/mods/nope');
    expect(res.status).toBe(404);
    const errors = await getRouteErrors();
    expect(errors).toContainEqual(
      expect.objectContaining({ route: '/api/mods/nope', status: 404, count: 1 }),
    );
  });

  test('unauthorized() records 401', async () => {
    unauthorized('يجب تسجيل الدخول', '/api/reports');
    const errors = await getRouteErrors();
    expect(errors).toContainEqual(
      expect.objectContaining({ route: '/api/reports', status: 401 }),
    );
  });

  test('validationFail() records 422 (not 400, not 200)', async () => {
    const res = validationFail({ field: 'bad' }, '/api/auth/login');
    expect(res.status).toBe(422);
    const errors = await getRouteErrors();
    expect(errors).toContainEqual(
      expect.objectContaining({ route: '/api/auth/login', status: 422 }),
    );
  });

  test('missing instance falls back to unknown route (still counted)', async () => {
    fail('INTERNAL_ERROR', 'boom', 500);
    const errors = await getRouteErrors();
    expect(errors).toContainEqual(
      expect.objectContaining({ route: 'unknown', status: 500 }),
    );
  });

  test('error response body unchanged (backward compat)', async () => {
    const res = notFound('Gone', '/api/x');
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.problem.status).toBe(404);
    expect(body.error.requestId).toBeDefined();
  });
});
