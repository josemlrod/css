import { describe, expect, it } from 'vitest';

import { getTourStartAt, isTourStartBookable } from '~/lib/dates';

describe('getTourStartAt', () => {
  it.each([
    ['2026-09-25', '9:00 AM', '2026-09-25T13:00:00Z'],
    ['2026-12-25', '12:30 PM', '2026-12-25T17:30:00Z'],
    ['2026-12-25', '12:00 AM', '2026-12-25T05:00:00Z'],
  ])('reads %s %s in Eastern time', (date, time, expected) => {
    expect(getTourStartAt(date, time)).toBe(Date.parse(expected));
  });

  it('returns NaN for an unknown time format', () => {
    expect(getTourStartAt('2026-09-25', 'noon')).toBeNaN();
  });
});

describe('isTourStartBookable', () => {
  const now = Date.parse('2026-09-25T19:00:00Z'); // 3:00 PM Eastern

  it.each([
    ['9:00 AM', false],
    ['3:00 PM', false],
    ['4:30 PM', true],
  ])('today at %s is bookable: %s', (time, expected) => {
    expect(isTourStartBookable('2026-09-25', time, now)).toBe(expected);
  });
});
