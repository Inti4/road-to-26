/// <reference types="@cloudflare/workers-types" />

import { Hono } from 'hono';
import {
  API_ROOT,
  API_TIMEOUT_MS,
  hydrateCachedData,
  isKnownSource,
  normalizeProviderData,
  retryScheduleAfterError,
  toPublicWorldCupData,
  type ProviderCache,
  type ProviderGamesResponse,
  type ProviderGroupsResponse,
  type ProviderStadiumsResponse,
  type ProviderTeamsResponse,
} from '../src/shared/worldCup';

type Bindings = {
  WORLD_CUP_CACHE: KVNamespace;
  ASSETS: Fetcher;
  REFRESH_SECRET?: string;
};

const CACHE_KEY = 'world-cup-cache:v1';

const app = new Hono<{ Bindings: Bindings }>();

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`World Cup feed returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function readCache(env: Bindings): Promise<ProviderCache | null> {
  const cached = await env.WORLD_CUP_CACHE.get(CACHE_KEY, 'json');
  if (!cached) return null;
  const parsed = cached as ProviderCache;
  return isKnownSource(parsed) ? hydrateCachedData(parsed) : null;
}

async function writeCache(env: Bindings, cache: ProviderCache): Promise<void> {
  await env.WORLD_CUP_CACHE.put(CACHE_KEY, JSON.stringify(cache));
}

async function refreshFromProvider(env: Bindings, existingCache?: ProviderCache | null): Promise<ProviderCache> {
  const [gameBody, groupBody] = await Promise.all([
    apiGet<ProviderGamesResponse>('/get/games'),
    apiGet<ProviderGroupsResponse>('/get/groups'),
  ]);

  let teams = existingCache?.entities.teams ?? [];
  let stadiums = existingCache?.entities.stadiums ?? [];
  if (!teams.length || !stadiums.length) {
    const [teamBody, stadiumBody] = await Promise.all([
      apiGet<ProviderTeamsResponse>('/get/teams'),
      apiGet<ProviderStadiumsResponse>('/get/stadiums'),
    ]);
    teams = teamBody.teams;
    stadiums = stadiumBody.stadiums;
  }

  const cache = normalizeProviderData({
    games: gameBody.games,
    groups: groupBody.groups,
    entities: { teams, stadiums },
  });
  await writeCache(env, cache);
  return cache;
}

async function refreshSafely(env: Bindings, existingCache?: ProviderCache | null): Promise<ProviderCache> {
  try {
    return await refreshFromProvider(env, existingCache);
  } catch (error) {
    if (!existingCache) throw error;
    const message = error instanceof Error ? error.message : 'Unknown refresh error';
    const erroredCache = { ...retryScheduleAfterError(existingCache), lastError: message };
    await writeCache(env, erroredCache);
    return erroredCache;
  }
}

function isRefreshDue(cache: ProviderCache): boolean {
  return Date.now() >= new Date(cache.schedule.nextRefreshAt).getTime();
}

function refreshAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-refresh-secret');
  return bearer === secret || headerSecret === secret;
}

app.get('/api/world-cup', async context => {
  const cache = await readCache(context.env);
  if (!cache) {
    const fresh = await refreshSafely(context.env);
    return context.json(toPublicWorldCupData(fresh), 200, { 'Cache-Control': 'public, max-age=60' });
  }
  if (isRefreshDue(cache)) {
    context.executionCtx.waitUntil(refreshSafely(context.env, cache));
  }
  return context.json(toPublicWorldCupData(cache), 200, { 'Cache-Control': 'public, max-age=60' });
});

app.get('/api/world-cup/status', async context => {
  const cache = await readCache(context.env);
  return context.json({
    provider: 'WorldCup26.ir',
    cached: Boolean(cache),
    fetchedAt: cache?.fetchedAt || null,
    lastError: cache?.lastError || null,
    schedule: cache?.schedule || null,
  });
});

app.post('/api/world-cup/refresh', async context => {
  if (!refreshAuthorized(context.req.raw, context.env.REFRESH_SECRET)) {
    return context.json({ error: 'Unauthorized refresh request' }, 401);
  }
  const cache = await readCache(context.env);
  const fresh = await refreshSafely(context.env, cache);
  return context.json({
    refreshed: true,
    fetchedAt: fresh.fetchedAt,
    schedule: fresh.schedule,
  });
});

app.notFound(context => {
  const { pathname } = new URL(context.req.url);
  if (pathname.startsWith('/api/')) {
    return context.json({ error: 'Not found' }, 404);
  }
  return context.env.ASSETS.fetch(context.req.raw);
});

async function scheduledRefresh(env: Bindings): Promise<void> {
  const cache = await readCache(env);
  if (!cache || isRefreshDue(cache)) {
    await refreshSafely(env, cache);
  }
}

export default {
  fetch: app.fetch,
  scheduled(_event, env, context) {
    context.waitUntil(scheduledRefresh(env));
  },
} satisfies ExportedHandler<Bindings>;
