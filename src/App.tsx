import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronDown, ChevronRight, CircleHelp, Clock3, Globe2, Grid2X2,
  Home, MapPin, Trophy, UsersRound,
} from 'lucide-react';
import { groupData, matches } from './data';
import { formatMatchDisplay, timeZoneOptions } from './shared/time';
import type { GroupStandings, MatchFixture, NavigationSection, TimeZoneKey } from './shared/types';

const groups = 'ABCDEFGHIJKL'.split('');
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

export default function App() {
  const [active, setActive] = useState<NavigationSection>('Overview');
  const [group, setGroup] = useState('A');
  const [filter, setFilter] = useState('All teams');
  const [timeZone, setTimeZone] = useState<TimeZoneKey>(() => {
    const stored = window.localStorage.getItem('road-to-26-timezone');
    return timeZoneOptions.some(option => option.value === stored) ? stored as TimeZoneKey : 'ET';
  });

  useEffect(() => {
    window.localStorage.setItem('road-to-26-timezone', timeZone);
  }, [timeZone]);

  const standings: GroupStandings = groupData;
  const upcomingMatches = matches;
  const nextMatch = matches[0];
  const nextMatchDisplay = formatMatchDisplay(nextMatch, timeZone);

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
          <div><h1>World Cup 2026</h1><p>48 teams. 16 host cities. One trophy.</p></div>
          <div className="header-controls">
            <button onClick={() => jumpTo('Groups')}><Grid2X2 size={18} />All groups<ChevronDown size={16} /></button>
            <label className="timezone-control"><Clock3 size={18} /><select value={timeZone} onChange={event => setTimeZone(event.target.value as TimeZoneKey)} aria-label="Display match times in"><option value="ET">Eastern (ET)</option><option value="CT">Central (CT)</option><option value="PT">Pacific (PT)</option><option value="VENUE">Venue local</option></select></label>
          </div>
        </header>
        <div className="dashboard-grid">
          <div className="primary">
            <section className="next-match">
              <div><small>NEXT MATCH</small><div className="versus"><span><FlagBar code={nextMatch.codes?.[0]} logo={nextMatch.homeLogo} />{nextMatch.home}</span><em>vs</em><span><FlagBar code={nextMatch.codes?.[1]} logo={nextMatch.awayLogo} />{nextMatch.away}</span></div></div>
              <div className="event-meta"><CalendarDays /><strong>{`${nextMatchDisplay.month} ${nextMatchDisplay.day} · ${nextMatchDisplay.time}`}</strong><span><MapPin />{nextMatch.venue}<br /><i>{nextMatch.city}</i></span></div>
            </section>
            <Standings group={group} setGroup={setGroup} standings={standings} />
            <GroupFixtures group={group} matchData={matches} timeZone={timeZone} />
          </div>
          <MatchRail filter={filter} setFilter={setFilter} matchData={upcomingMatches} timeZone={timeZone} />
        </div>
      </main>
    </div>
  );
}
