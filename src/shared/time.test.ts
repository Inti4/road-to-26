import { describe, expect, it } from 'vitest';
import { formatMatchDisplay, timezoneForCity, zonedLocalToUtc } from './time';
import type { MatchFixture } from './types';

describe('timezone helpers', () => {
  it('maps host cities to their venue time zones', () => {
    expect(timezoneForCity('Los Angeles')).toBe('America/Los_Angeles');
    expect(timezoneForCity('East Rutherford')).toBe('America/New_York');
    expect(timezoneForCity('Unknown City')).toBe('America/New_York');
  });

  it('converts provider local venue time into UTC', () => {
    const kickoff = zonedLocalToUtc('6/12/2026 17:00', 'America/Los_Angeles');
    expect(kickoff.toISOString()).toBe('2026-06-13T00:00:00.000Z');
  });

  it('formats the same match in selected and venue-local zones', () => {
    const match: MatchFixture = {
      timestamp: Date.UTC(2026, 5, 13, 0, 0),
      venueTimezone: 'America/Los_Angeles',
    };

    expect(formatMatchDisplay(match, 'ET').time).toBe('8:00 PM ET');
    expect(formatMatchDisplay(match, 'PT').time).toBe('5:00 PM PT');
    expect(formatMatchDisplay(match, 'VENUE').time).toBe('5:00 PM PDT');
  });
});
