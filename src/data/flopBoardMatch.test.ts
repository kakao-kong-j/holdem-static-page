import { describe, expect, it } from 'vitest';
import { classifyBoardTexture, matchFlopBoard, parseFlopBoard } from './flopBoardMatch';

const boards = (...ids: string[]) => ids.map(id => ({ id, cards: id.match(/../g)!, textures: [classifyBoardTexture(id.match(/../g)!)] }));

describe('flop board input', () => {
  it('accepts case, spaces and suit symbols and ignores card order for exact matches', () => {
    expect(parseFlopBoard('asjs7s')).toEqual(['As', 'Js', '7s']);
    expect(parseFlopBoard('T♠ 9♥ 2♦')).toEqual(['Ts', '9h', '2d']);
    expect(matchFlopBoard('2d ts 9h', boards('Ts9h2d'))).toMatchObject({ kind: 'exact', board: { id: 'Ts9h2d' } });
  });
  it('rejects incomplete input, invalid cards, and duplicate cards', () => {
    for (const input of ['AK3', 'AsAs7s', '1sJh7h', 'AsKs3h2d']) expect(parseFlopBoard(input)).toBeNull();
  });
});

describe('ordered board matching rules', () => {
  it('tries suits before changing any rank and prefers equivalent suit relationships', () => {
    expect(matchFlopBoard('AcJc7c', boards('AsJs6h', 'AsJh7s', 'AhJh7h')))
      .toMatchObject({ kind: 'inferred', rule: 'suits', board: { id: 'AhJh7h' } });
    expect(matchFlopBoard('asjs7s', boards('AsJs6h', 'AsJh7s')))
      .toMatchObject({ kind: 'inferred', rule: 'suits', board: { id: 'AsJh7s' } });
  });
  it('changes only the disconnected lowest rank, choosing the closest available rank', () => {
    expect(matchFlopBoard('ts9h2d', boards('Ts8h2d', 'Ts9h4d', 'Ts9h3d')))
      .toMatchObject({ kind: 'inferred', rule: 'low-card', board: { id: 'Ts9h3d' } });
  });
  it('keeps texture boundaries and never creates or breaks pairs', () => {
    expect(matchFlopBoard('Ts9h6d', boards('Ts9h2d')).kind).toBe('unmatched');
    expect(matchFlopBoard('As5h2d', boards('As5h3d'))).toMatchObject({ kind: 'inferred', rule: 'texture' });
    expect(matchFlopBoard('Ts9h2d', boards('Ts9h9d', 'Ts9h6d')).kind).toBe('unmatched');
    expect(matchFlopBoard('Ts2h2d', boards('Ts2h3d')).kind).toBe('unmatched');
  });
  it('reports missing candidates and invalid input explicitly', () => {
    expect(matchFlopBoard('ts9h2d', boards('AsJs7s')).kind).toBe('unmatched');
    expect(matchFlopBoard('AsAs7s', boards('AsJs7s')).kind).toBe('invalid');
  });
});


describe('same-texture fallback', () => {
  it('falls back within the same texture when both strict rules fail', () => {
    expect(matchFlopBoard('ts9h2d', boards('Ts5h2d', 'KsTs9h', '9s8h2d')))
      .toMatchObject({ kind: 'inferred', rule: 'texture', texture: 'J/T + 2', board: { id: 'Ts5h2d' } });
  });
  it('retains pair position and flush relationships before rank proximity', () => {
    expect(matchFlopBoard('QsQh4s', boards('Ks4h4s', 'JsJh9s')))
      .toMatchObject({ kind: 'inferred', rule: 'texture', board: { id: 'JsJh9s' } });
    expect(matchFlopBoard('8s5s2s', boards('9s6s2h', '9s3s2s')))
      .toMatchObject({ kind: 'inferred', board: { id: '9s3s2s' } });
  });
  it('fixes the overly broad ace exclusion without crossing textures', () => {
    expect(matchFlopBoard('as9h2d', boards('As9h3d')))
      .toMatchObject({ kind: 'inferred', rule: 'low-card', texture: 'Axy' });
    expect(matchFlopBoard('AsKs9h', boards('AsKsTh')).kind).toBe('unmatched');
  });
  it('never substitutes paired boards for trips when that texture is absent', () => {
    expect(matchFlopBoard('AsAhAd', boards('AsAh7s')))
      .toMatchObject({ kind: 'unmatched', texture: 'Trips' });
  });
});


it.each([
  ['AsAhAd', 'Trips'], ['AsAh7s', 'Paired'], ['AsKsQh', 'ABB'], ['AsJs7s', 'ABx'],
  ['As9h2d', 'Axy'], ['KsQsJh', 'BBB'], ['KsQh2d', '2 Broadway'], ['Qs7h2d', 'K/Q + 2'],
  ['Ts7h6d', 'J/T connected'], ['Ts7h5d', 'J/T + 2'],
  ['9s7h5d', 'Low connected'], ['9s6h4d', 'Low unconnected'],
])('classifies %s as %s independently of input order', (input, expected) => {
  const cards = parseFlopBoard(input)!;
  expect(classifyBoardTexture(cards)).toBe(expected);
  expect(classifyBoardTexture([...cards].reverse())).toBe(expected);
});
