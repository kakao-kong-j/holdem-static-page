export interface SessionCondition {
  focus?: number;
  fatigue?: number;
  tilt?: number;
  memo?: string;
}

export function isSessionCondition(value: unknown): value is SessionCondition | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, v]) => {
    if (key === 'memo') return typeof v === 'string' && v.length <= 2000;
    return ['focus', 'fatigue', 'tilt'].includes(key)
      && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
  });
}

/** Missing means preserve; null is a durable explicit clear. */
export function preserveSessionCondition<T extends { condition?: unknown }>(previous: T | undefined, incoming: T): T {
  return incoming.condition === undefined && previous?.condition !== undefined
    ? { ...incoming, condition: previous.condition }
    : incoming;
}
