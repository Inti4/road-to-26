import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronDown, ChevronRight, CircleHelp, Clock3, Globe2, Grid2X2,
  Home, MapPin, Moon, Sun, Trophy, UsersRound,
} from 'lucide-react';
import { bracketStages, groupData, matches } from './data';
import { countdownLabel, formatMatchDisplay, timeZoneOptions } from './shared/time';
import type {
  GroupStandings,
  KnockoutStage,
  MatchFixture,
  NavigationSection,
  ThemeMode,
  TimeZoneKey,
} from './shared/types';
import {
  applyLockedAdvancementStatuses,
  groupStageIsComplete,
  projectedSlot,
  projectThirdPlaceTeams,
  thirdPlaceTable,
  type ProjectedThirdPlaceTeam,
} from './shared/worldCup';
import { useWorldCupData } from './useWorldCupData';

const groups = 'ABCDEFGHIJKL'.split('');
const knockoutStages: KnockoutStage[] = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semifinals', 'Final'];
const colors: Record<string, string[]> = {
  US: ['#1647ad', '#fff', '#e22635'], PY: ['#df2535', '#fff', '#1647ad'],
  AU: ['#f4b400', '#158442', '#158442'], EU: ['#a8adb5', '#d7d9dd', '#8d939b'],
  CA: ['#e12636', '#fff', '#e12636'], CH: ['#e12636', '#fff', '#e12636'],
  QA: ['#7b1641', '#fff', '#7b1641'], BR: ['#119447', '#f4c430', '#1647ad'],
  MA: ['#d51f30', '#fff', '#169447'], GB: ['#244a9a', '#fff', '#d51f30'], HT: ['#174794', '#d51f30', '#fff'],
};

interface FlagBarProps {
  code?: string;
  logo?: string | null;
}

function FlagBar({ code = 'EU', logo }: FlagBarProps) {
  if (logo) return <img className="team-flag" src={logo} alt="" />;
  const palette = colors[code] || colors.EU;
  return <span className="flagbar" aria-hidden="true">{palette.map((c, i) => <i key={`${c}-${i}`} style={{ background: c }} />)}</span>;
}

interface SidebarProps {
  active: NavigationSection;
  setActive: (section: NavigationSection) => void;
  timeZone: TimeZoneKey;
}

function Sidebar({ active, setActive, timeZone }: SidebarProps) {
  const items: Array<[NavigationSection, ComponentType<{ size?: number }>]> = [['Overview', Home], ['Groups', Grid2X2], ['Matches', CalendarDays], ['Bracket', Trophy]];
  const zoneLabel = timeZoneOptions.find(option => option.value === timeZone)?.label || 'Eastern';
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setActive('Overview')} aria-label="Road to 26 home">
        <img src="/site-logo.png" alt="" />
        <span>ROAD<br />TO 26</span>
      </button>
      <nav aria-label="Main navigation">
        {items.map(([label, Icon]) => (
          <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="side-stats">
        <div><UsersRound /><strong>12</strong><span>GROUPS</span></div>
        <div><Grid2X2 /><strong>104</strong><span>MATCHES</span></div>
        <div><Globe2 /><strong>3</strong><span>HOST NATIONS</span></div>
      </div>
      <div className="side-footer"><Clock3 size={18} />{zoneLabel} time<ChevronRight size={16} /></div>
    </aside>
  );
}

interface StandingsProps {
  group: string;
  setGroup: (group: string) => void;
  standings: GroupStandings;
}

function Standings({ group, setGroup, standings }: StandingsProps) {
  const rows = standings[group] || groupData[group] || groupData.A;
  return (
    <section className="standings" id="groups">
      <h2>Group standings</h2>
      <div className="group-tabs" role="tablist" aria-label="World Cup groups">
        {groups.map(g => <button key={g} role="tab" aria-selected={group === g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>Group {g}</button>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th>Status</th></tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={row.team}>
              <td><div className="team-cell"><span className="rank">{index + 1}</span><FlagBar code={row.code} logo={row.logo} /><strong>{row.team}</strong></div></td>
              <td>{row.p}</td><td>{row.w}</td><td>{row.d}</td><td>{row.l}</td><td>{row.gd > 0 ? '+' : ''}{row.gd}</td><td><strong>{row.pts}</strong></td>
              <td><span className={`status ${row.status}`}><i />{row.status === 'out' ? 'Eliminated' : row.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="legend"><span><i className="green" />Top 2 advance to Round of 32</span><span><i className="orange" />3rd place may advance</span><span><i className="gray" />Eliminated</span></div>
      <details className="qualification-rules">
        <summary><CircleHelp size={18} /><span><strong>How points, ties and third-place advancement work</strong><small>3 for a win · 1 for a draw · 0 for a loss</small></span><ChevronDown size={17} /></summary>
        <div className="qualification-rules-content">
          <section><h3>Group tiebreakers</h3><p>When teams finish level on points, they are separated in this order:</p><ol><li>Points in matches between the tied teams</li><li>Goal difference in those head-to-head matches</li><li>Goals scored in those head-to-head matches</li><li>Goal difference in all group matches</li><li>Goals scored in all group matches</li><li>Best team conduct score</li><li>FIFA World Ranking</li></ol></section>
          <section><h3>Best third-place teams</h3><p>The top eight third-place finishers complete the 32-team knockout field. They are ranked by:</p><ol><li>Total points</li><li>Goal difference</li><li>Goals scored</li><li>Best team conduct score</li><li>FIFA World Ranking</li></ol></section>
        </div>
      </details>
    </section>
  );
}

interface GroupFixtureRowProps {
  match: MatchFixture;
  timeZone: TimeZoneKey;
}

function GroupFixtureRow({ match, timeZone }: GroupFixtureRowProps) {
  const isLive = match.status?.short === 'LIVE';
  const isFinished = match.status?.short === 'FT';
  const display = formatMatchDisplay(match, timeZone);
  const goals = match.goals || { home: 0, away: 0 };
  return (
    <article className={`group-fixture-row ${isLive ? 'is-live' : ''}`}>
      <div className="group-fixture-date">
        <strong>{display.month} {display.day}</strong>
        <span>{display.dow}</span>
      </div>
      <div className="group-matchup">
        <span><FlagBar code={match.codes?.[0]} logo={match.homeLogo} />{match.home}</span>
        <span><FlagBar code={match.codes?.[1]} logo={match.awayLogo} />{match.away}</span>
      </div>
      <div className="group-fixture-outcome">
        {isFinished || isLive ? <strong>{goals.home}–{goals.away}</strong> : <strong>{display.time}</strong>}
        <small>{isLive ? 'LIVE' : isFinished ? 'FINAL' : match.city}</small>
      </div>
    </article>
  );
}

interface GroupFixturesProps {
  group: string;
  matchData: MatchFixture[];
  timeZone: TimeZoneKey;
}

function GroupFixtures({ group, matchData, timeZone }: GroupFixturesProps) {
  const groupMatches = useMemo(
    () => matchData.filter(match => match.group === group && match.round === 'group').sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
    [group, matchData],
  );
  const played = groupMatches.filter(match => match.status?.short === 'FT');
  const pending = groupMatches.filter(match => match.status?.short !== 'FT');

  return (
    <section className="group-fixtures" aria-labelledby="group-fixtures-title">
      <header className="group-fixtures-head">
        <div><h2 id="group-fixtures-title">Group {group} matchups</h2><p>Who has played, every score, and what comes next.</p></div>
        <span>{played.length} of {groupMatches.length || 6} played</span>
      </header>
      {groupMatches.length ? (
        <div className="fixture-ledger">
          <div className="fixture-ledger-column">
            <h3>Results</h3>
            <div>{played.length ? played.map(match => <GroupFixtureRow key={match.id} match={match} timeZone={timeZone} />) : <p className="group-fixture-empty">No completed matches yet.</p>}</div>
          </div>
          <div className="fixture-ledger-column">
            <h3>Next up</h3>
            <div>{pending.length ? pending.map(match => <GroupFixtureRow key={match.id} match={match} timeZone={timeZone} />) : <p className="group-fixture-empty">Group stage complete.</p>}</div>
          </div>
        </div>
      ) : <p className="group-fixture-empty">Fixture details are loading.</p>}
    </section>
  );
}

interface MatchRailProps {
  filter: string;
  setFilter: (filter: string) => void;
  matchData: MatchFixture[];
  timeZone: TimeZoneKey;
}

function MatchRail({ filter, setFilter, matchData, timeZone }: MatchRailProps) {
  const teamOptions = useMemo(
    () => [...new Set(matchData.flatMap(match => [match.home, match.away]))]
      .filter((team): team is string => Boolean(team && team !== 'TBD'))
      .sort(),
    [matchData],
  );
  const visible = filter === 'All teams' ? matchData : matchData.filter(m => m.home === filter || m.away === filter);
  return (
    <aside className="match-rail" id="matches">
      <div className="rail-head"><div><h2>Upcoming matches</h2><span>Next 48 hours</span></div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter matches by team"><option>All teams</option>{teamOptions.map(team => <option key={team}>{team}</option>)}</select></div>
      <div className="match-list">{visible.map(match => {
        const display = formatMatchDisplay(match, timeZone);
        const goals = match.goals || { home: 0, away: 0 };
        return <article className="match-row" key={`${match.day}-${match.home}`}>
          <time><small>{display.month}</small><strong>{display.day}</strong><small>{display.dow}</small></time>
          <div className="teams"><span><FlagBar code={match.codes?.[0]} logo={match.homeLogo} />{match.home}</span><span><FlagBar code={match.codes?.[1]} logo={match.awayLogo} />{match.away}</span></div>
          <div className="match-meta"><strong>{match.status?.short === 'LIVE' ? `${goals.home}–${goals.away} · LIVE` : display.time}</strong><span>{match.venue}</span><small>{match.city}</small></div>
        </article>;
      })}</div>
      {visible.length === 0 ? <p className="empty">No matches found.</p> : null}
    </aside>
  );
}

interface KnockoutMatchProps {
  fixture: MatchFixture;
  index: number;
  nextStage: KnockoutStage | 'Champion';
  standings: GroupStandings;
  projectedThird: ProjectedThirdPlaceTeam[];
  bracket?: Partial<Record<KnockoutStage, MatchFixture[]>>;
  timeZone: TimeZoneKey;
}

function KnockoutMatch({ fixture, index, nextStage, standings, projectedThird, bracket, timeZone }: KnockoutMatchProps) {
  const isLive = fixture.status?.short === 'LIVE';
  const isFinished = fixture.status?.short === 'FT';
  const showScore = isLive || isFinished;
  const home = fixture.home || fixture.a;
  const away = fixture.away || fixture.b;
  const goals = fixture.goals || { home: 0, away: 0 };
  const display = formatMatchDisplay(fixture, timeZone);
  const date = fixture.timestamp ? `${display.month} ${display.day} · ${display.time}` : fixture.date;
  const homeProjection = projectedSlot(home, standings, projectedThird, bracket);
  const awayProjection = projectedSlot(away, standings, projectedThird, bracket);
  return (
    <article className={`knockout-match ${isLive ? 'is-live' : ''}`}>
      <header><span>Match {fixture.id || index + 1}</span><time>{date}</time></header>
      <div className="knockout-team"><FlagBar logo={fixture.homeLogo} code="US" /><span><b>{home}</b>{homeProjection ? <small>{homeProjection}</small> : null}</span>{showScore ? <strong>{goals.home}</strong> : null}</div>
      <div className="knockout-team"><FlagBar logo={fixture.awayLogo} code="EU" /><span><b>{away}</b>{awayProjection ? <small>{awayProjection}</small> : null}</span>{showScore ? <strong>{goals.away}</strong> : null}</div>
      <footer>
        <span>{isLive ? 'Live now' : isFinished ? 'Final' : `Winner → ${nextStage}`}</span>
        {fixture.venue ? <small>{fixture.venue} · {fixture.city}</small> : null}
      </footer>
    </article>
  );
}

interface BracketProps {
  stage: KnockoutStage;
  setStage: (stage: KnockoutStage) => void;
  liveBracket?: Partial<Record<KnockoutStage, MatchFixture[]>>;
  standings: GroupStandings;
  thirdPlacesLocked: boolean;
  timeZone: TimeZoneKey;
}

function ThirdPlaceTracker({ standings, locked }: { standings: GroupStandings; locked: boolean }) {
  const rows = thirdPlaceTable(standings);
  return (
    <div className="third-place-tracker">
      <div><strong>{locked ? 'Locked third-place qualifiers' : 'Current third-place projection'}</strong><span>{locked ? 'Top eight are through · bottom four are out' : 'Top eight advance if groups ended now'}</span></div>
      <div className="third-place-table" role="table" aria-label="Third-place ranking table">
        <div className="third-place-row third-place-head" role="row"><span>#</span><span>Team</span><span>Pts</span><span>GD</span><span>GF</span><span>Status</span></div>
        {rows.map((team, index) => {
          const inTopEight = index < 8;
          return (
            <div className={`third-place-row ${inTopEight ? 'is-in' : 'is-out'}`} role="row" key={`${team.group}-${team.team}`}>
              <span>{index + 1}</span>
              <span><small>{team.group}</small>{team.team}</span>
              <span>{team.pts}</span>
              <span>{team.gd > 0 ? '+' : ''}{team.gd}</span>
              <span>{team.gf ?? 0}</span>
              <span>{inTopEight ? 'IN' : 'OUT'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bracket({ stage, setStage, liveBracket, standings, thirdPlacesLocked, timeZone }: BracketProps) {
  const fallbackFixtures = bracketStages[stage] || [{ a: 'Winner Semifinal 1', b: 'Winner Semifinal 2', date: 'Jul 19 · 3:00 PM ET' }];
  const fixtures = liveBracket?.[stage]?.length ? liveBracket[stage] : fallbackFixtures;
  const currentStageIndex = knockoutStages.indexOf(stage);
  const nextStage = knockoutStages[currentStageIndex + 1] || 'Champion';
  const directSlots = Object.values(standings).reduce((total, rows) => total + Math.min(rows.length, 2), 0);
  const projectedThird = projectThirdPlaceTeams(standings);
  return (
    <section className="bracket" id="bracket">
      <div className="knockout-intro">
        <div><span className="eyebrow">After the group stage</span><h2>Road to the Round of 32</h2><p>The top two teams in every group advance, joined by the eight best third-place teams.</p></div>
        <div className="qualification-math" aria-label="Round of 32 qualification breakdown">
          <div><strong>{directSlots || 24}</strong><span>Top-two<br />qualifiers</span></div><b>+</b>
          <div><strong>8</strong><span>Best third-place<br />teams</span></div><b>=</b>
          <div className="total"><strong>32</strong><span>Knockout<br />teams</span></div>
        </div>
      </div>
      <div className="third-place-preview">
        <div><strong>{thirdPlacesLocked ? 'Locked third-place qualifiers' : 'Current third-place projection'}</strong><span>{thirdPlacesLocked ? 'The eight advancing third-place teams are set' : 'Top eight advance if groups ended now'}</span></div>
        <div className="third-place-list">{projectedThird.map(team => <span key={team.group}><small>{team.group}</small>{team.team}</span>)}</div>
      </div>
      <ThirdPlaceTracker standings={standings} locked={thirdPlacesLocked} />
      <div className="knockout-flow" aria-label="Knockout tournament stages">
        <span>Group stage<small>48 teams</small></span><ChevronRight />
        {knockoutStages.map((name, index) => <button key={name} className={stage === name ? 'active' : ''} onClick={() => setStage(name)}><strong>{name}</strong><small>{index === 0 ? '32 teams' : index === 1 ? '16 teams' : index === 2 ? '8 teams' : index === 3 ? '4 teams' : '2 teams'}</small></button>)}
      </div>
      <div className="knockout-round-head">
        <div><span className="eyebrow">Selected round</span><h3>{stage}</h3></div>
        <p>{fixtures.length} {fixtures.length === 1 ? 'match' : 'matches'} · Times follow your selected zone</p>
      </div>
      <div className="knockout-grid">
        {fixtures.map((fixture, index) => <KnockoutMatch key={fixture.id || `${stage}-${index}`} fixture={fixture} index={index} nextStage={nextStage} standings={standings} projectedThird={projectedThird} bracket={liveBracket} timeZone={timeZone} />)}
      </div>
    </section>
  );
}

export default function App() {
  const { data: liveData, loading, error } = useWorldCupData();
  const [active, setActive] = useState<NavigationSection>('Overview');
  const [group, setGroup] = useState('A');
  const [filter, setFilter] = useState('All teams');
  const [stage, setStage] = useState<KnockoutStage>('Round of 32');
  const [now, setNow] = useState(() => Date.now());
  const [timeZone, setTimeZone] = useState<TimeZoneKey>(() => {
    const stored = window.localStorage.getItem('road-to-26-timezone');
    return timeZoneOptions.some(option => option.value === stored) ? stored as TimeZoneKey : 'ET';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('road-to-26-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('road-to-26-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('road-to-26-timezone', timeZone);
  }, [timeZone]);

  const rawStandings: GroupStandings = liveData?.groups && Object.keys(liveData.groups).length ? liveData.groups : groupData;
  const thirdPlacesLocked = liveData?.matches ? groupStageIsComplete(liveData.matches) : false;
  const standings: GroupStandings = thirdPlacesLocked ? applyLockedAdvancementStatuses(rawStandings) : rawStandings;
  const liveGroup = useMemo(() => standings[group] ? group : Object.keys(standings)[0] || 'A', [group, standings]);
  const upcomingMatches = useMemo(() => {
    if (!liveData?.matches?.length) return matches;
    const cutoff = now - 30 * 60 * 1000;
    const windowEnd = now + 48 * 60 * 60 * 1000;
    const eligible = liveData.matches.filter(match => {
      const status = match.status?.short || 'NS';
      return status === 'LIVE' || (status !== 'FT' && (match.timestamp || 0) > cutoff);
    });
    const next48Hours = eligible.filter(match => match.status?.short === 'LIVE' || (match.timestamp || 0) <= windowEnd);
    return next48Hours.length ? next48Hours : eligible.slice(0, 5);
  }, [liveData, now]);
  const nextMatch = upcomingMatches[0] || matches[0];
  const nextMatchGoals = nextMatch.goals || { home: 0, away: 0 };
  const nextMatchDisplay = formatMatchDisplay(nextMatch, timeZone);
  const refreshCountdown = countdownLabel(liveData?.schedule?.nextRefreshAt, now);
  const feedLabel = error
    ? 'Live feed delayed · showing cached data'
    : liveData?.fetchedAt
      ? `Live data · updated ${new Date(liveData.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : 'Live data loading';

  const jumpTo = (name: NavigationSection) => {
    setActive(name);
    const id = ({ Groups: 'groups', Matches: 'matches', Bracket: 'bracket' } as Partial<Record<NavigationSection, string>>)[name];
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} setActive={jumpTo} timeZone={timeZone} />
      <main>
        <header className="topbar">
          <div><h1>World Cup 2026</h1><p>48 teams. 16 host cities. One trophy.</p><small className={`feed-state ${error ? 'feed-error' : ''}`}>{loading ? 'Connecting to live tournament data…' : <><span>{feedLabel}</span><span className="refresh-countdown">{refreshCountdown}</span></>}</small></div>
          <div className="header-controls">
            <button onClick={() => jumpTo('Groups')}><Grid2X2 size={18} />All groups<ChevronDown size={16} /></button>
            <label className="timezone-control"><Clock3 size={18} /><select value={timeZone} onChange={event => setTimeZone(event.target.value as TimeZoneKey)} aria-label="Display match times in"><option value="ET">Eastern (ET)</option><option value="CT">Central (CT)</option><option value="PT">Pacific (PT)</option><option value="VENUE">Venue local</option></select></label>
            <button className="theme-toggle" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>
        <div className="dashboard-grid">
          <div className="primary">
            <section className="next-match">
              <div><small>{nextMatch.status?.short === 'LIVE' ? 'LIVE NOW' : 'NEXT MATCH'}</small><div className="versus"><span><FlagBar code={nextMatch.codes?.[0]} logo={nextMatch.homeLogo} />{nextMatch.home}</span><em>{nextMatch.status?.short === 'LIVE' ? `${nextMatchGoals.home}–${nextMatchGoals.away}` : 'vs'}</em><span><FlagBar code={nextMatch.codes?.[1]} logo={nextMatch.awayLogo} />{nextMatch.away}</span></div></div>
              <div className="event-meta"><CalendarDays /><strong>{`${nextMatchDisplay.month} ${nextMatchDisplay.day} · ${nextMatchDisplay.time}`}</strong><span><MapPin />{nextMatch.venue}<br /><i>{nextMatch.city}</i></span></div>
            </section>
            <Standings group={liveGroup} setGroup={setGroup} standings={standings} />
            <GroupFixtures group={liveGroup} matchData={liveData?.matches || []} timeZone={timeZone} />
          </div>
          <MatchRail filter={filter} setFilter={setFilter} matchData={upcomingMatches} timeZone={timeZone} />
        </div>
        <Bracket stage={stage} setStage={setStage} liveBracket={liveData?.bracket} standings={standings} thirdPlacesLocked={thirdPlacesLocked} timeZone={timeZone} />
      </main>
    </div>
  );
}
