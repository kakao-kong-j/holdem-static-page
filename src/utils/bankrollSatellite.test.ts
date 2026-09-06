import { describe, expect, it } from 'vitest';
import { filterBySatellite, isSatelliteTournament, type BankrollSession } from './bankroll';

const session: BankrollSession = {
  id: '1', kind: 'tournament', datetime: '2026-09-01', profit: -2,
  winLoss: 0, buyIn: 2, tags: [],
};

describe('satellite classification', () => {
  it.each([
    ['15 Seats to ₮11 Regs Round Table', true],
    ['1 Seat to ₮109 Main', true],
    ['Step [2] to ₮109 Main', true],
    ['  STEP [3] TO Main  ', true],
    ['Sunday SATELLITE', true],
    ['세틀라이트 예선', true],
    ['새틀라이트 예선', true],
    ['Main Event', false],
    ['Step Up Main Event', false],
    ['', false],
  ])('classifies %s without requiring a ticket win', (name, expected) => {
    expect(isSatelliteTournament({ ...session, name, isTicket: false })).toBe(expected);
  });

  it('uses ticket wins as a fallback but never classifies cash as satellite', () => {
    expect(isSatelliteTournament({ ...session, isTicket: true })).toBe(true);
    expect(isSatelliteTournament({ ...session, kind: 'cash', name: 'Satellite', isTicket: true })).toBe(false);
    expect(isSatelliteTournament(session)).toBe(false);
  });

  it('excludes only satellites or selects only satellites without changing the input', () => {
    const cash = { ...session, id: 'cash', kind: 'cash' as const };
    const satellite = { ...session, id: 'sat', name: 'Step [2] to Main' };
    const sessions = [cash, satellite, session];
    const before = structuredClone(sessions);
    expect(filterBySatellite(sessions, 'all')).toEqual(sessions);
    expect(filterBySatellite(sessions, 'exclude')).toEqual([cash, session]);
    expect(filterBySatellite(sessions, 'only')).toEqual([satellite]);
    expect(sessions).toEqual(before);
  });
});
