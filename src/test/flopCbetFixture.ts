// Synthetic values; tests run without private workbook files or DATA_KEY.
export function flopCbetFixture() {
  const record = (spot: string, profile: string, stack_bb: number, hero: string, villain: string, board_id: string, frequency_pct: number, pct: number, row: number) => ({
    spot, profile, stack_bb, hero, villain, board_id, frequency_pct, action: 'cbet',
    size: { kind: 'pot', pct } as { kind: string; pct?: number },
    source: { sheet: 'DATA_SYNTHETIC', row, url: 'https://drive.google.com/file/d/example/view' },
  });
  return {
    schema_version: 1,
    source: { workbook: 'synthetic.xlsx', sha256: '0'.repeat(64) },
    boards: [
      { id: 'AsAh7s', cards: ['As', 'Ah', '7s'], textures: ['Paired'] },
      { id: 'AsKs3h', cards: ['As', 'Ks', '3h'], textures: ['ABx'] },
      { id: 'KcTd2h', cards: ['Kc', 'Td', '2h'] },
    ],
    records: [
      record('srp-ip', 'GTO', 50, 'BTN', 'BB', 'AsAh7s', 80, 25, 2),
      record('srp-ip', 'GTO', 50, 'BTN', 'BB', 'AsKs3h', 20, 50, 3),
      record('srp-ip', 'Calling Station', 20, 'CO', 'BB', 'AsAh7s', 99, 75, 4),
      { ...record('4bp-oop', 'GTO', 50, 'UTG', 'BTN', 'AsAh7s', 70, 25, 5), size: { kind: 'all-in' } },
      { ...record('blind-war', 'GTO', 20, 'BB', 'SB', 'KcTd2h', 0, 25, 6), action: 'stab' },
    ],
    corrections: [],
  };
}
