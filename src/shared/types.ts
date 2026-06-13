export type GroupCode =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type QualificationStatus = 'advancing' | 'possible' | 'out';

export type FixtureStatusShort = 'NS' | 'LIVE' | 'FT';

export type KnockoutStage =
  | 'Round of 32'
  | 'Round of 16'
  | 'Quarter-finals'
  | 'Semifinals'
  | 'Final';

export type TimeZoneKey = 'ET' | 'CT' | 'PT' | 'VENUE';

export type ThemeMode = 'light' | 'dark';

export type NavigationSection = 'Overview' | 'Groups' | 'Matches' | 'Bracket';

export interface FixtureStatus {
  short: FixtureStatusShort;
  long: string;
  elapsed: string | null;
}

export interface Goals {
  home: number;
  away: number;
}

export interface MatchFixture {
  id?: number | string;
  date?: string;
  timestamp?: number;
  month?: string;
  day?: string;
  dow?: string;
  time?: string;
  venue?: string;
  city?: string;
  venueTimezone?: string;
  status?: FixtureStatus;
  round?: string;
  group?: string;
  home?: string;
  away?: string;
  a?: string;
  b?: string;
  codes?: string[];
  homeLogo?: string | null;
  awayLogo?: string | null;
  goals?: Goals;
  homeScorers?: string[];
  awayScorers?: string[];
}

export interface TeamStanding {
  team: string;
  code: string;
  logo?: string | null;
  p: number;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
  gf?: number;
  status: QualificationStatus;
}

export type GroupStandings = Record<string, TeamStanding[]>;

export type Bracket = Partial<Record<KnockoutStage, MatchFixture[]>>;

export interface RefreshSchedule {
  nextRefreshAt: string;
  reason: string;
  policy: string;
}

export interface WorldCupData {
  source: string;
  fetchedAt: string;
  groups: GroupStandings;
  matches: MatchFixture[];
  bracket: Bracket;
  schedule: RefreshSchedule;
  lastError?: string;
}

export interface ProviderTeam {
  id: string | number;
  name_en?: string;
  fifa_code?: string;
  flag?: string | null;
}

export interface ProviderStadium {
  id: string | number;
  fifa_name?: string;
  name_en?: string;
  city_en?: string;
}

export interface ProviderGame {
  id: string | number;
  stadium_id: string | number;
  local_date: string;
  time_elapsed?: string | number | null;
  finished?: string | boolean | null;
  type?: string;
  group?: string;
  home_team_id?: string | number;
  away_team_id?: string | number;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;
  away_team_label?: string;
  home_score?: string | number | null;
  away_score?: string | number | null;
  home_scorers?: string | null;
  away_scorers?: string | null;
}

export interface ProviderGroupTeam {
  team_id: string | number;
  mp?: string | number | null;
  w?: string | number | null;
  d?: string | number | null;
  l?: string | number | null;
  gd?: string | number | null;
  gf?: string | number | null;
  pts?: string | number | null;
}

export interface ProviderGroup {
  name: string;
  teams: ProviderGroupTeam[];
}

export interface ProviderGamesResponse {
  games: ProviderGame[];
}

export interface ProviderGroupsResponse {
  groups: ProviderGroup[];
}

export interface ProviderTeamsResponse {
  teams: ProviderTeam[];
}

export interface ProviderStadiumsResponse {
  stadiums: ProviderStadium[];
}

export interface ProviderEntities {
  teams: ProviderTeam[];
  stadiums: ProviderStadium[];
}

export interface ProviderCache extends WorldCupData {
  entities: ProviderEntities;
}
