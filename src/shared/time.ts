import type { MatchFixture, TimeZoneKey } from './types';

export const DEFAULT_DISPLAY_TIMEZONE = 'America/New_York';

export const cityTimeZones: Record<string, string> = {
  Atlanta: 'America/New_York',
  Boston: 'America/New_York',
  Dallas: 'America/Chicago',
  Guadalajara: 'America/Mexico_City',
  Houston: 'America/Chicago',
  'Kansas City': 'America/Chicago',
  'Los Angeles': 'America/Los_Angeles',
  Miami: 'America/New_York',
  Monterrey: 'America/Monterrey',
  'Mexico City': 'America/Mexico_City',
  'New York': 'America/New_York',
  Philadelphia: 'America/New_York',
  'San Francisco': 'America/Los_Angeles',
  Seattle: 'America/Los_Angeles',
  Toronto: 'America/Toronto',
  Vancouver: 'America/Vancouver',
  'East Rutherford': 'America/New_York',
};

export const timeZoneOptions: Array<{ value: TimeZoneKey; label: string; zone: string | null }> = [
  { value: 'ET', label: 'Eastern', zone: 'America/New_York' },
  { value: 'CT', label: 'Central', zone: 'America/Chicago' },
  { value: 'PT', label: 'Pacific', zone: 'America/Los_Angeles' },
  { value: 'VENUE', label: 'Venue local', zone: null },
];

export interface MatchDisplayTime {
  month: string;
  day?: string;
  dow?: string;
  time: string;
}

export function timezoneForCity(city = ''): string {
  const normalizedCity = city.toLowerCase();
  const match = Object.entries(cityTimeZones).find(([knownCity]) => {
    const normalizedKnownCity = knownCity.toLowerCase();
    return normalizedCity === normalizedKnownCity || normalizedCity.includes(normalizedKnownCity);
  });
  return match?.[1] || DEFAULT_DISPLAY_TIMEZONE;
}

export function zonedLocalToUtc(localDate: string, timeZone: string): Date {
  const [datePart = '', timePart = '00:00'] = localDate.split(' ');
  const [month = 1, day = 1, year = 1970] = datePart.split('/').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  const represented = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  return new Date(guess - (represented - guess));
}

export function formatMatchDisplay(match: MatchFixture, zoneKey: TimeZoneKey): MatchDisplayTime {
  const option = timeZoneOptions.find(item => item.value === zoneKey) || timeZoneOptions[0];
  const timeZone = option.zone || match.venueTimezone || DEFAULT_DISPLAY_TIMEZONE;
  const timestamp = match.timestamp ?? Number.NaN;
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
    return {
      month: match.month || 'JUN',
      day: match.day,
      dow: match.dow,
      time: `${match.time || 'TBD'} ${zoneKey === 'VENUE' ? 'local' : zoneKey}`,
    };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return {
    month: part('month').toUpperCase(),
    day: part('day'),
    dow: part('weekday').toUpperCase(),
    time: `${part('hour')}:${part('minute')} ${part('dayPeriod')} ${zoneKey === 'VENUE' ? part('timeZoneName') : zoneKey}`,
  };
}

export function countdownLabel(deadline: string | undefined, now: number): string {
  if (!deadline) return 'Update schedule loading';
  const remaining = Math.max(0, new Date(deadline).getTime() - now);
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes <= 1) return 'Next data check in under a minute';
  if (minutes < 60) return `Next data check in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Next data check in ${hours} hr${rest ? ` ${rest} min` : ''}`;
}
