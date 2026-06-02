import type { Bracket, GroupStandings, MatchFixture } from './shared/types';

export const groupData: GroupStandings = {
  A: [
    { team: 'USA', code: 'US', p: 1, w: 1, d: 0, l: 0, gd: 2, pts: 3, status: 'advancing' },
    { team: 'Paraguay', code: 'PY', p: 1, w: 1, d: 0, l: 0, gd: 1, pts: 3, status: 'advancing' },
    { team: 'Australia', code: 'AU', p: 1, w: 0, d: 0, l: 1, gd: -1, pts: 0, status: 'possible' },
    { team: 'UEFA Playoff C', code: 'EU', p: 1, w: 0, d: 0, l: 1, gd: -2, pts: 0, status: 'out' },
  ],
  B: [
    { team: 'Canada', code: 'CA', p: 1, w: 1, d: 0, l: 0, gd: 2, pts: 3, status: 'advancing' },
    { team: 'Switzerland', code: 'CH', p: 1, w: 0, d: 1, l: 0, gd: 0, pts: 1, status: 'advancing' },
    { team: 'Qatar', code: 'QA', p: 1, w: 0, d: 1, l: 0, gd: 0, pts: 1, status: 'possible' },
    { team: 'UEFA Playoff A', code: 'EU', p: 1, w: 0, d: 0, l: 1, gd: -2, pts: 0, status: 'out' },
  ],
  C: [
    { team: 'Brazil', code: 'BR', p: 1, w: 1, d: 0, l: 0, gd: 3, pts: 3, status: 'advancing' },
    { team: 'Morocco', code: 'MA', p: 1, w: 1, d: 0, l: 0, gd: 1, pts: 3, status: 'advancing' },
    { team: 'Scotland', code: 'GB', p: 1, w: 0, d: 0, l: 1, gd: -1, pts: 0, status: 'possible' },
    { team: 'Haiti', code: 'HT', p: 1, w: 0, d: 0, l: 1, gd: -3, pts: 0, status: 'out' },
  ],
};

export const matches: MatchFixture[] = [
  { day: '12', dow: 'FRI', home: 'USA', away: 'Paraguay', time: '8:00 PM', venue: 'SoFi Stadium', city: 'Los Angeles', codes: ['US', 'PY'] },
  { day: '13', dow: 'SAT', home: 'Australia', away: 'UEFA Playoff C', time: '3:00 PM', venue: 'Lumen Field', city: 'Seattle', codes: ['AU', 'EU'] },
  { day: '15', dow: 'MON', home: 'Paraguay', away: 'Australia', time: '6:00 PM', venue: 'NRG Stadium', city: 'Houston', codes: ['PY', 'AU'] },
  { day: '17', dow: 'WED', home: 'USA', away: 'UEFA Playoff C', time: '8:00 PM', venue: 'Arrowhead Stadium', city: 'Kansas City', codes: ['US', 'EU'] },
  { day: '21', dow: 'SUN', home: 'UEFA Playoff C', away: 'Paraguay', time: '5:00 PM', venue: 'AT&T Stadium', city: 'Dallas', codes: ['EU', 'PY'] },
];

export const bracketStages: Bracket = {
  'Round of 32': [
    { a: '1A', b: '2C', date: 'Jun 28–Jul 1' },
    { a: '1B', b: '2D', date: 'Jun 28–Jul 1' },
    { a: '1C', b: '3A/B/F', date: 'Jun 29–Jul 2' },
  ],
  'Round of 16': [
    { a: 'W R32 Match 1', b: 'W R32 Match 2', date: 'Jul 4–7' },
    { a: 'W R32 Match 3', b: 'W R32 Match 4', date: 'Jul 4–7' },
  ],
  'Quarter-finals': [
    { a: 'W R16 Match 1', b: 'W R16 Match 2', date: 'Jul 9–11' },
    { a: 'W R16 Match 3', b: 'W R16 Match 4', date: 'Jul 9–11' },
  ],
  Semifinals: [
    { a: 'W QF Match 1', b: 'W QF Match 2', date: 'Jul 14–15' },
    { a: 'W QF Match 3', b: 'W QF Match 4', date: 'Jul 14–15' },
  ],
};
