/** Select new hands for one game type, keeping the first occurrence of each ID. */
export function selectNewHands<T extends { handId: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(existing.map(hand => hand.handId));
  return incoming.filter(hand => {
    if (seen.has(hand.handId)) return false;
    seen.add(hand.handId);
    return true;
  });
}
