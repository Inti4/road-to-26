import { describe, expect, it } from 'vitest';
import {
  KICKOFF_REFRESH_MS,
  LIVE_REFRESH_MS,
  PRE_KICKOFF_WINDOW_MS,
  applyLockedAdvancementStatuses,
  computeNextRefresh,
  groupStageIsComplete,
  normalizeProviderData,
  parseScorers,
  projectThirdPlaceTeams,
  projectedSlot,
  thirdPlaceTable,
} from './worldCup';
import type { GroupStandings, MatchFixture, ProviderEntities, ProviderGame, ProviderGroup, TeamStanding } from './types';

const now = Date.UTC(2026, 5, 12, 12, 0);

function match(timestamp: number, short: NonNullable<MatchFixture['status']>['short'] = 'NS'): MatchFixture {
  return { timestamp, status: { short, long: short, elapsed: null } };
}

function standing(team: string, pts: number, gd: number, gf: number): TeamStanding {
  return { team, code: team.slice(0, 2).toUpperCase(), p: 3, w: 1, d: 0, l: 2, gd, gf, pts, status: 'possible' };
}

describe('refresh scheduling', () => {
  it('refreshes every minute while a match is live', () => {
    const next = computeNextRefresh([match(now - 5 * 60_000, 'LIVE')], now);
    expect(next.reason).toBe('live match');
    expect(next.at).toBe(now + LIVE_REFRESH_MS);
  });

  it('uses the one-minute cadence inside the final pre-kickoff window', () => {
    const next = computeNextRefresh([match(now + 5 * 60_000)], now);
    expect(next.reason).toBe('kickoff window');
    expect(next.at).toBe(now + KICKOFF_REFRESH_MS);
  });

  it('schedules the next check ten minutes before a future match', () => {
    const kickoff = now + 4 * 60 * 60_000;
    const next = computeNextRefresh([match(kickoff)], now);
    expect(next.reason).toBe('next match window');
    expect(next.at).toBe(kickoff - PRE_KICKOFF_WINDOW_MS);
  });

  it('falls back to a daily check after the tournament schedule ends', () => {
    const next = computeNextRefresh([match(now - 60_000, 'FT')], now);
    expect(next.reason).toBe('daily tournament check');
    expect(next.at).toBe(now + 24 * 60 * 60_000);
  });
});

describe('provider normalization', () => {
  it('normalizes fixtures, standings, venues, scores and bracket stage data', () => {
    const entities: ProviderEntities = {
      teams: [
        { id: 1, name_en: 'USA', fifa_code: 'USA', flag: 'usa.png' },
        { id: 2, name_en: 'Canada', fifa_code: 'CAN', flag: 'canada.png' },
      ],
      stadiums: [{ id: 10, fifa_name: 'SoFi Stadium', city_en: 'Los Angeles' }],
    };
    const games: ProviderGame[] = [{
      id: 99,
      stadium_id: 10,
      local_date: '6/12/2026 17:00',
      type: 'r32',
      group: 'A',
      home_team_id: 1,
      away_team_id: 2,
      home_score: 2,
      away_score: 1,
      finished: 'TRUE',
      home_scorers: `{"Pulisic 27'"}`,
    }];
    const groups: ProviderGroup[] = [{
      name: 'A',
      teams: [
        { team_id: 2, mp: 1, w: 0, d: 0, l: 1, gd: -1, gf: 1, pts: 0 },
        { team_id: 1, mp: 1, w: 1, d: 0, l: 0, gd: 1, gf: 2, pts: 3 },
      ],
    }];

    const normalized = normalizeProviderData({ games, groups, entities, fetchedAt: new Date(now) });

    expect(normalized.matches[0]).toMatchObject({
      id: 99,
      timestamp: Date.UTC(2026, 5, 13, 0, 0),
      venue: 'SoFi Stadium',
      city: 'Los Angeles',
      venueTimezone: 'America/Los_Angeles',
      home: 'USA',
      away: 'Canada',
      goals: { home: 2, away: 1 },
      homeScorers: ["Pulisic 27'"],
      status: { short: 'FT' },
    });
    expect(normalized.groups.A.map(row => row.team)).toEqual(['USA', 'Canada']);
    expect(normalized.bracket['Round of 32']).toHaveLength(1);
  });

  it('detects when all group matches are complete', () => {
    const finishedGroups = Array.from({ length: 72 }, (_, index) => match(now - index, 'FT'));
    finishedGroups.forEach(fixture => { fixture.round = 'group'; });
    expect(groupStageIsComplete(finishedGroups)).toBe(true);
    expect(groupStageIsComplete([...finishedGroups, { ...match(now + 1000), round: 'group' }])).toBe(false);
  });
});

describe('third-place projection', () => {
  it('selects the top eight third-place teams and resolves knockout slot labels', () => {
    const standings: GroupStandings = Object.fromEntries(
      'ABCDEFGHIJKL'.split('').map((group, index) => [
        group,
        [
          standing(`Winner ${group}`, 7, 4, 7),
          standing(`Runner ${group}`, 5, 2, 5),
          standing(`Third ${group}`, 12 - index, index % 3, 8 - index),
          standing(`Fourth ${group}`, 0, -4, 1),
        ],
      ]),
    );

    const projected = projectThirdPlaceTeams(standings);

    expect(projected).toHaveLength(8);
    expect(projected.map(team => team.group)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(thirdPlaceTable(standings)).toHaveLength(12);
    expect(projectedSlot('Winner Group B', standings, projected)).toBe('Currently Winner B');
    expect(projectedSlot('3rd Group H/I/J', standings, projected)).toBe('Projected Third H · Group H');
    expect(projectedSlot('Winner Match 73', standings, projected, {
      'Round of 32': [{ id: 73, home: 'South Africa', away: 'Canada' }],
    })).toBe('Possible: South Africa / Canada');

    const locked = applyLockedAdvancementStatuses(standings);
    expect(locked.A[2].status).toBe('advancing');
    expect(locked.I[2].status).toBe('out');
  });
});

describe('scorer parsing', () => {
  it('parses provider scorer arrays and handles empty values', () => {
    expect(parseScorers(`{"Nestory Irankunda 27'","C. Metcalfe 75'"}`)).toEqual(["Nestory Irankunda 27'", "C. Metcalfe 75'"]);
    expect(parseScorers(`{"“J. Quiñones 9'”","”R. Jiménez 67'”"}`)).toEqual(["J. Quiñones 9'", "R. Jiménez 67'"]);
    expect(parseScorers('null')).toEqual([]);
    expect(parseScorers(null)).toEqual([]);
    expect(parseScorers(undefined)).toEqual([]);
  });
});
