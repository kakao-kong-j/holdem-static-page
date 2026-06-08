import { describe, expect, it } from 'vitest';
import { parseCoinPokerHands, normalizeHoleCards } from './coinpokerParser';

const SAMPLE = `CoinPoker Hand #68315300002: NLH (50/100/13) 2026/06/03 23:02:53 KST
Tournament 'Level Up Freeroll' '63001' 7-max Seat #6 is the button
Seat 1: f1d20c9b (3,000 in chips)
Seat 2: c5b02981 (5,100 in chips)
Seat 3: a6e443c7 (7,200 in chips)
Seat 4: b723a0e1 (6,400 in chips)
Seat 5: e03a2b9f (9,300 in chips)
Seat 6: Hero (4,887 in chips)
Seat 7: d34501f2 (8,800 in chips)
d34501f2: posts small blind 50
f1d20c9b: posts big blind 100
c5b02981: posts ante 13
a6e443c7: posts ante 13
b723a0e1: posts ante 13
e03a2b9f: posts ante 13
Hero: posts ante 13
d34501f2: posts ante 13
f1d20c9b: posts ante 13
*** HOLE CARDS ***
Dealt to Hero [Th Td]
c5b02981: folds
a6e443c7: folds
b723a0e1: folds
Hero: raises 700 to 800
d34501f2: ALLIN 4,824
f1d20c9b: folds
Hero: ALLIN 4,087
*** FLOP *** [2c 3d 4h]
*** SUMMARY ***

CoinPoker Hand #68315300003: NLH (60/120/15) 2026/06/03 23:05:01 KST
Tournament 'Level Up Freeroll' '63001' 7-max Seat #2 is the button
Seat 2: c5b02981 (12,400 in chips)
Seat 3: a6e443c7 (5,000 in chips)
Seat 4: b723a0e1 (6,750 in chips)
Seat 5: e03a2b9f (9,300 in chips)
Seat 6: Hero (10,226 in chips)
Seat 7: d34501f2 (8,800 in chips)
a6e443c7: posts small blind 60
b723a0e1: posts big blind 120
c5b02981: posts ante 15
a6e443c7: posts ante 15
b723a0e1: posts ante 15
e03a2b9f: posts ante 15
Hero: posts ante 15
d34501f2: posts ante 15
*** HOLE CARDS ***
Dealt to Hero [7c 3c]
e03a2b9f: folds
Hero: raises 180 to 300
d34501f2: raises 600 to 900
c5b02981: folds
a6e443c7: folds
b723a0e1: folds
*** FLOP *** [Ah Kd Qs]
d34501f2: bets 1,200
*** SUMMARY ***

CoinPoker Hand #68315300004: NLH (50/100/13) 2026/06/03 23:08:22 KST
Tournament 'Level Up Freeroll' '63001' 6-max Seat #5 is the button
Seat 1: f1d20c9b (7,100 in chips)
Seat 2: c5b02981 (8,200 in chips)
Seat 3: a6e443c7 (6,000 in chips)
Seat 4: b723a0e1 (9,500 in chips)
Seat 5: e03a2b9f (4,200 in chips)
Seat 6: Hero (3,600 in chips)
Hero: posts small blind 50
f1d20c9b: posts big blind 100
c5b02981: posts ante 13
a6e443c7: posts ante 13
b723a0e1: posts ante 13
e03a2b9f: posts ante 13
Hero: posts ante 13
f1d20c9b: posts ante 13
*** HOLE CARDS ***
Dealt to Hero [Tc 5s]
c5b02981: folds
a6e443c7: folds
b723a0e1: folds
e03a2b9f: calls 100
Hero: calls 50
f1d20c9b: checks
*** FLOP *** [9c 8d 2h]
*** SUMMARY ***`;

describe('normalizeHoleCards', () => {
  it('normalizes pairs, suited hands, and offsuit hands', () => {
    expect(normalizeHoleCards(['Th', 'Td'])).toBe('TT');
    expect(normalizeHoleCards(['7c', '3c'])).toBe('73s');
    expect(normalizeHoleCards(['Tc', '5s'])).toBe('T5o');
  });

  it('rejects invalid suits and duplicate exact cards', () => {
    expect(normalizeHoleCards(['Ah', 'Ax'])).toBeNull();
    expect(normalizeHoleCards(['Ah', 'Ah'])).toBeNull();
  });

  it('rejects card tokens with trailing junk', () => {
    expect(normalizeHoleCards(['Ahx', 'Kd'])).toBeNull();
    expect(normalizeHoleCards(['Ah', 'Kd?'])).toBeNull();
  });
});

describe('parseCoinPokerHands', () => {
  it('parses Hero hands and marks only supported unopened RFI candidates eligible', () => {
    const hands = parseCoinPokerHands(SAMPLE);

    expect(hands).toHaveLength(3);

    expect(hands[0]).toMatchObject({
      handId: '68315300002',
      startedAt: '2026/06/03 23:02:53 KST',
      smallBlind: 50,
      bigBlind: 100,
      ante: 13,
      tableSize: 7,
      buttonSeat: 6,
      heroSeat: 6,
      heroStack: 4887,
      heroStackBb: 48.87,
      heroPosition: 'BTN',
      heroCards: ['Th', 'Td'],
      heroHand: 'TT',
      heroFirstAction: 'raises',
      rfiEligible: true,
      exclusionReason: null,
    });
    expect(hands[0].preflopActions.map((action) => action.action)).toEqual([
      'folds',
      'folds',
      'folds',
      'raises',
      'ALLIN',
      'folds',
      'ALLIN',
    ]);

    expect(hands[1]).toMatchObject({
      handId: '68315300003',
      smallBlind: 60,
      bigBlind: 120,
      ante: 15,
      tableSize: 7,
      buttonSeat: 2,
      heroSeat: 6,
      heroStack: 10226,
      heroStackBb: 85.22,
      heroPosition: 'HJ',
      heroCards: ['7c', '3c'],
      heroHand: '73s',
      heroFirstAction: 'raises',
      rfiEligible: true,
      exclusionReason: null,
    });
    expect(hands[1].preflopActions.map((action) => action.action)).toEqual([
      'folds',
      'raises',
      'raises',
      'folds',
      'folds',
      'folds',
    ]);

    expect(hands[2]).toMatchObject({
      handId: '68315300004',
      tableSize: 6,
      buttonSeat: 5,
      heroSeat: 6,
      heroPosition: 'SB',
      heroCards: ['Tc', '5s'],
      heroHand: 'T5o',
      heroFirstAction: 'calls',
      rfiEligible: false,
      exclusionReason: 'position-not-supported',
    });
  });

  it('parses decimal blind and stack amounts without dropping the hand', () => {
    const hands = parseCoinPokerHands(`CoinPoker Hand #68315300005: NLH (0.50/1.00/0.13) 2026/06/03 23:10:01 KST
Tournament 'Level Up Freeroll' '63001' 6-max Seat #5 is the button
Seat 1: f1d20c9b (7,100 in chips)
Seat 5: e03a2b9f (4,200 in chips)
Seat 6: Hero (4,887.50 in chips)
Hero: posts small blind 0.50
f1d20c9b: posts big blind 1.00
Hero: posts ante 0.13
*** HOLE CARDS ***
Dealt to Hero [As Ks]
e03a2b9f: folds
Hero: raises 2.00 to 3.00
*** FLOP *** [2c 3d 4h]
*** SUMMARY ***`);

    expect(hands).toHaveLength(1);
    expect(hands[0]).toMatchObject({
      handId: '68315300005',
      smallBlind: 0.5,
      bigBlind: 1,
      ante: 0.13,
      heroStack: 4887.5,
      heroStackBb: 4887.5,
      heroHand: 'AKs',
    });
  });
});
