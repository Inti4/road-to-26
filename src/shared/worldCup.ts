import { DEFAULT_DISPLAY_TIMEZONE, timezoneForCity, zonedLocalToUtc } from './time';
import type {
  Bracket,
  FixtureStatus,
  FixtureStatusShort,
  GroupStandings,
  KnockoutStage,
  MatchFixture,
  ProviderCache,
  ProviderEntities,
  ProviderGame,
  ProviderGamesResponse,
  ProviderGroup,
  ProviderGroupsResponse,
  ProviderGroupTeam,
  ProviderStadium,
  ProviderStadiumsResponse,
  ProviderTeam,
  ProviderTeamsResponse,
  TeamStanding,
  WorldCupData,
} from './types';

export const API_ROOT = 'https://worldcup26.ir';
export const SOURCE_NAME = 'WorldCup26.ir open API';
export const API_TIMEOUT_MS = 35_000;
export const LIVE_REFRESH_MS = 60 * 1000;
export const KICKOFF_REFRESH_MS = 60 * 1000;
export const NEAR_MATCH_REFRESH_MS = 5 * 60 * 1000;
export const ERROR_RETRY_MS = 5 * 60 * 1000;
export const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
export const PRE_KICKOFF_WINDOW_MS = 10 * 60 * 1000;
export const NEAR_MATCH_WINDOW_MS = 60 * 60 * 1000;
export const REFRESH_POLICY = '1 minute live; 1 minute pre-kickoff; match-window scheduling otherwise';

const LIVE_VALUES = new Set(['live', '1h', 'ht', '2h', 'et', 'penalties']);

export interface NextRefresh {
  at: number;
  reason: 'live match' | 'kickoff window' | 'next match window' | 'daily tournament check';
}

export interface NormalizeProviderInput {
  games: ProviderGame[];
  groups: ProviderGroup[];
  entities: ProviderEntities;
  fetchedAt?: Date;
}

function numeric(value: string | number | null | undefined): number {
  return Number(value) || 0;
}

// Provider sends scorers as a Postgres-array string like {"Pulisic 27'","Reyna 75'"} or null.
export function parseScorers(raw?: string | number | null): string[] {
  if (raw === null || raw === undefined) return [];
  const value = String(raw).trim();
  if (!value || value.toLowerCase() === 'null') return [];
  const quoted = value.match(/"([^"]*)"/g);
  const entries = quoted
    ? quoted.map(entry => entry.slice(1, -1))
    : value.replace(/^\{|\}$/g, '').split(',');
  // Provider sometimes wraps names in straight or curly quotes; strip them but keep the minute apostrophe.
  return entries.map(entry => entry.replace(/^[\s"“”]+/, '').replace(/[\s"“”]+$/, '')).filter(Boolean);
}

function mapById<T extends { id: string | number }>(items: T[]): Map<string, T> {
  return new Map(items.map(item => [String(item.id), item]));
}

export function fixtureStatus(game: Pick<ProviderGame, 'time_elapsed' | 'finished'>): FixtureStatus {
  const elapsed = String(game.time_elapsed || '').toLowerCase();
  const finished = String(game.finished).toUpperCase() === 'TRUE';
  if (finished || elapsed === 'finished') return { short: 'FT', long: 'Finished', elapsed: null };
  if (LIVE_VALUES.has(elapsed)) return { short: 'LIVE', long: 'Live', elapsed };
  return { short: 'NS', long: 'Not Started', elapsed: null };
}

export function formatFixture(
  game: ProviderGame,
  teamMap: Map<string, ProviderTeam>,
  stadiumMap: Map<string, ProviderStadium>,
): MatchFixture {
  const stadium = stadiumMap.get(String(game.stadium_id));
  const venueTimezone = timezoneForCity(stadium?.city_en);
  const date = zonedLocalToUtc(game.local_date, venueTimezone);
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_DISPLAY_TIMEZONE,
    month: 'short',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(entry => entry.type === type)?.value || '';
  const homeTeam = teamMap.get(String(game.home_team_id));
  const awayTeam = teamMap.get(String(game.away_team_id));
  return {
    id: Number(game.id),
    date: date.toISOString(),
    timestamp: date.getTime(),
    month: part('month').toUpperCase(),
    day: part('day'),
    dow: part('weekday').toUpperCase(),
    time: new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_DISPLAY_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
    venue: stadium?.fifa_name || stadium?.name_en || 'Venue TBA',
    city: stadium?.city_en || 'City TBA',
    venueTimezone,
    status: fixtureStatus(game),
    round: game.type,
    group: game.group,
    home: game.home_team_name_en || game.home_team_label || homeTeam?.name_en || 'TBD',
    away: game.away_team_name_en || game.away_team_label || awayTeam?.name_en || 'TBD',
    homeLogo: homeTeam?.flag || null,
    awayLogo: awayTeam?.flag || null,
    goals: { home: numeric(game.home_score), away: numeric(game.away_score) },
    homeScorers: parseScorers(game.home_scorers),
    awayScorers: parseScorers(game.away_scorers),
  };
}

export function compareGroupRows(a: ProviderGroupTeam, b: ProviderGroupTeam): number {
  const pointDiff = numeric(b.pts) - numeric(a.pts);
  return pointDiff || numeric(b.gd) - numeric(a.gd) || numeric(b.gf) - numeric(a.gf);
}

export function normalizeGroups(groupRows: ProviderGroup[], teamMap: Map<string, ProviderTeam>): GroupStandings {
  const groups: GroupStandings = {};
  for (const group of groupRows) {
    const rows = [...group.teams].sort(compareGroupRows);
    groups[group.name] = rows.map((row, index): TeamStanding => {
      const team = teamMap.get(String(row.team_id));
      return {
        team: team?.name_en || `Team ${row.team_id}`,
        code: team?.fifa_code || '--',
        logo: team?.flag || null,
        p: numeric(row.mp),
        w: numeric(row.w),
        d: numeric(row.d),
        l: numeric(row.l),
        gd: numeric(row.gd),
        gf: numeric(row.gf),
        pts: numeric(row.pts),
        status: index <= 1 ? 'advancing' : index === 2 ? 'possible' : 'out',
      };
    });
  }
  return groups;
}

export function stageName(type = ''): KnockoutStage | null {
  const value = type.toLowerCase();
  if (value === 'r32') return 'Round of 32';
  if (value === 'r16') return 'Round of 16';
  if (value === 'qf' || value.includes('quarter')) return 'Quarter-finals';
  if (value === 'sf' || value.includes('semi')) return 'Semifinals';
  if (value === 'final') return 'Final';
  return null;
}

export function buildBracket(matches: MatchFixture[] = []): Bracket {
  const bracket: Bracket = {};
  for (const match of matches) {
    const stage = stageName(match.round);
    if (stage) (bracket[stage] ||= []).push(match);
  }
  return bracket;
}

export function groupStageIsComplete(matches: MatchFixture[], expectedGroupMatches = 72): boolean {
  const groupMatches = matches.filter(match => match.round === 'group');
  return groupMatches.length >= expectedGroupMatches && groupMatches.every(match => match.status?.short === 'FT');
}

export function computeNextRefresh(matches: MatchFixture[], now = Date.now()): NextRefresh {
  if (matches.some(match => match.status?.short === 'LIVE')) {
    return { at: now + LIVE_REFRESH_MS, reason: 'live match' };
  }
  const next = matches
    .filter(match => typeof match.timestamp === 'number' && match.timestamp > now)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0];
  if (!next?.timestamp) return { at: now + DAILY_REFRESH_MS, reason: 'daily tournament check' };
  const untilKickoff = next.timestamp - now;
  if (untilKickoff <= PRE_KICKOFF_WINDOW_MS) return { at: now + KICKOFF_REFRESH_MS, reason: 'kickoff window' };
  if (untilKickoff <= NEAR_MATCH_WINDOW_MS) return { at: now + NEAR_MATCH_REFRESH_MS, reason: 'kickoff window' };
  return {
    at: Math.min(next.timestamp - PRE_KICKOFF_WINDOW_MS, now + DAILY_REFRESH_MS),
    reason: 'next match window',
  };
}

export function normalizeProviderData({
  games,
  groups,
  entities,
  fetchedAt = new Date(),
}: NormalizeProviderInput): ProviderCache {
  const teamMap = mapById(entities.teams);
  const stadiumMap = mapById(entities.stadiums);
  const matches = games
    .map(game => formatFixture(game, teamMap, stadiumMap))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const nextRefresh = computeNextRefresh(matches, fetchedAt.getTime());
  return {
    source: SOURCE_NAME,
    fetchedAt: fetchedAt.toISOString(),
    groups: normalizeGroups(groups, teamMap),
    matches,
    bracket: buildBracket(matches),
    entities,
    schedule: {
      nextRefreshAt: new Date(nextRefresh.at).toISOString(),
      reason: nextRefresh.reason,
      policy: REFRESH_POLICY,
    },
  };
}

export function hydrateCachedData(cache: ProviderCache): ProviderCache {
  const matches = cache.matches.map(match => ({
    ...match,
    venueTimezone: match.venueTimezone || timezoneForCity(match.city),
  }));
  const nextRefresh = computeNextRefresh(matches);
  return {
    ...cache,
    matches,
    bracket: buildBracket(matches),
    schedule: {
      ...cache.schedule,
      nextRefreshAt: new Date(nextRefresh.at).toISOString(),
      reason: nextRefresh.reason,
      policy: REFRESH_POLICY,
    },
  };
}

export function toPublicWorldCupData(cache: ProviderCache): WorldCupData {
  const { entities: _entities, ...publicCache } = cache;
  return publicCache;
}

export interface ProjectedThirdPlaceTeam extends TeamStanding {
  group: string;
}

export function thirdPlaceTable(standings: GroupStandings): ProjectedThirdPlaceTeam[] {
  return Object.entries(standings)
    .map(([group, rows]) => ({ ...rows[2], group }))
    .filter((team): team is ProjectedThirdPlaceTeam => Boolean(team.team))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || (b.gf || 0) - (a.gf || 0) || a.group.localeCompare(b.group))
}

export function projectThirdPlaceTeams(standings: GroupStandings, limit = 8): ProjectedThirdPlaceTeam[] {
  return thirdPlaceTable(standings).slice(0, limit);
}

export function applyLockedAdvancementStatuses(standings: GroupStandings, thirdLimit = 8): GroupStandings {
  const qualifyingThirdGroups = new Set(projectThirdPlaceTeams(standings, thirdLimit).map(team => team.group));
  return Object.fromEntries(Object.entries(standings).map(([group, rows]) => [
    group,
    rows.map((row, index) => ({
      ...row,
      status: index <= 1 || (index === 2 && qualifyingThirdGroups.has(group)) ? 'advancing' : 'out',
    })),
  ]));
}

function findBracketMatch(bracket: Bracket | undefined, id: string): MatchFixture | undefined {
  if (!bracket) return undefined;
  return Object.values(bracket).flat().find(match => String(match.id) === id);
}

export function winnerMatchProjection(slot: string | undefined, bracket?: Bracket): string | null {
  const matchSlot = slot?.match(/^Winner Match (\d+)$/);
  if (!matchSlot) return null;
  const sourceMatch = findBracketMatch(bracket, matchSlot[1]);
  if (!sourceMatch) return null;
  const home = sourceMatch.home || sourceMatch.a;
  const away = sourceMatch.away || sourceMatch.b;
  if (!home || !away) return null;
  return `Possible: ${home} / ${away}`;
}

export function projectedSlot(
  slot: string | undefined,
  standings: GroupStandings,
  projectedThird: ProjectedThirdPlaceTeam[],
  bracket?: Bracket,
): string | null {
  const winnerProjection = winnerMatchProjection(slot, bracket);
  if (winnerProjection) return winnerProjection;
  const groupSlot = slot?.match(/^(Winner|Runner-up) Group ([A-L])$/);
  if (groupSlot) {
    const row = standings[groupSlot[2]]?.[groupSlot[1] === 'Winner' ? 0 : 1];
    return row?.team ? `Currently ${row.team}` : null;
  }
  const thirdSlot = slot?.match(/^3rd Group ([A-L/]+)$/);
  if (thirdSlot) {
    const eligibleGroups = thirdSlot[1].split('/');
    const candidate = projectedThird.find(team => eligibleGroups.includes(team.group));
    return candidate ? `Projected ${candidate.team} · Group ${candidate.group}` : null;
  }
  return null;
}

export function retryScheduleAfterError(cache: ProviderCache, now = Date.now()): ProviderCache {
  return {
    ...cache,
    schedule: {
      ...cache.schedule,
      nextRefreshAt: new Date(now + ERROR_RETRY_MS).toISOString(),
      reason: 'retry after error',
    },
  };
}

export function isKnownSource(cache: Pick<ProviderCache, 'source'>): boolean {
  return cache.source === SOURCE_NAME;
}

export type {
  Bracket,
  FixtureStatusShort,
  GroupStandings,
  KnockoutStage,
  MatchFixture,
  ProviderCache,
  ProviderEntities,
  ProviderGame,
  ProviderGamesResponse,
  ProviderGroup,
  ProviderGroupsResponse,
  ProviderStadium,
  ProviderStadiumsResponse,
  ProviderTeam,
  ProviderTeamsResponse,
  TeamStanding,
  WorldCupData,
};
