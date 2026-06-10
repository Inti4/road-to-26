import express from 'express';
import { config as loadEnv } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_ROOT,
  API_TIMEOUT_MS,
  buildBracket,
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
} from './src/shared/worldCup';

const ROOT = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(ROOT, '.env.local'), quiet: true });
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const CACHE_FILE = resolve(ROOT, '.cache/world-cup.json');

let cache: ProviderCache | null = null;
let refreshPromise: Promise<ProviderCache> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`World Cup feed returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function persistCache(): Promise<void> {
  if (!cache) return;
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache), 'utf8');
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!cache?.schedule?.nextRefreshAt) return;
  const delay = Math.max(10_000, new Date(cache.schedule.nextRefreshAt).getTime() - Date.now());
  refreshTimer = setTimeout(() => void refreshFromProvider(), delay);
  refreshTimer.unref?.();
}

async function refreshFromProvider(): Promise<ProviderCache> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const [gameBody, groupBody] = await Promise.all([
        apiGet<ProviderGamesResponse>('/get/games'),
        apiGet<ProviderGroupsResponse>('/get/groups'),
      ]);

      let teams = cache?.entities.teams ?? [];
      let stadiums = cache?.entities.stadiums ?? [];
      if (!teams.length || !stadiums.length) {
        const [teamBody, stadiumBody] = await Promise.all([
          apiGet<ProviderTeamsResponse>('/get/teams'),
          apiGet<ProviderStadiumsResponse>('/get/stadiums'),
        ]);
        teams = teamBody.teams;
        stadiums = stadiumBody.stadiums;
      }

      cache = normalizeProviderData({
        games: gameBody.games,
        groups: groupBody.groups,
        entities: { teams, stadiums },
      });
      await persistCache();
      console.log(`[data] refreshed ${cache.matches.length} fixtures; next: ${cache.schedule.reason} at ${cache.schedule.nextRefreshAt}`);
      return cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown refresh error';
      console.error(`[data] refresh failed: ${message}`);
      if (cache) {
        cache = { ...retryScheduleAfterError(cache), lastError: message };
        return cache;
      }
      throw error;
    } finally {
      refreshPromise = null;
      scheduleRefresh();
    }
  })();
  return refreshPromise;
}

async function loadCache(): Promise<void> {
  try {
    const parsed = JSON.parse(await readFile(CACHE_FILE, 'utf8')) as ProviderCache;
    cache = isKnownSource(parsed) ? hydrateCachedData(parsed) : null;
  } catch {
    cache = null;
  }
}

const app = express();
app.disable('x-powered-by');

app.get('/api/world-cup', async (_request, response) => {
  try {
    if (!cache) await refreshFromProvider();
    if (!cache) throw new Error('World Cup cache unavailable');
    if (Date.now() >= new Date(cache.schedule.nextRefreshAt).getTime()) void refreshFromProvider();
    response.set('Cache-Control', 'private, max-age=60');
    response.json(toPublicWorldCupData(cache));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown data error';
    response.status(503).json({ error: message, source: 'local fallback' });
  }
});

app.get('/api/world-cup/status', (_request, response) => {
  response.json({ provider: 'WorldCup26.ir', cached: Boolean(cache), schedule: cache?.schedule || null });
});

await loadCache();
const loadedCache = cache as ProviderCache | null;
if (loadedCache) {
  cache = { ...loadedCache, bracket: buildBracket(loadedCache.matches) };
  scheduleRefresh();
} else {
  void refreshFromProvider();
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(ROOT, 'dist')));
  app.use((_request, response) => response.sendFile(resolve(ROOT, 'dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(PORT, HOST, () => console.log(`Road to 26 running at http://${HOST}:${PORT}`));
