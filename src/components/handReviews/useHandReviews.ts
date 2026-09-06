import { useEffect, useRef, useState } from 'react';
import { isReview, type HandReview, type ReviewMutation } from '../../../shared/handReviews';
export function useHandReviews() {
  const [reviews, setReviews] = useState<HandReview[]>([]);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  async function request(mutation?: ReviewMutation) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch('/api/hand-reviews', { credentials: 'include', cache: 'no-store', ...(mutation ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mutation) } : {}) });
      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json();
          if (mounted.current) setError(typeof data.error === 'string' ? data.error : '노트 저장 한도를 초과했습니다.');
          return false;
        }
        throw new Error();
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('reviews' in data) || !Array.isArray(data.reviews) || !data.reviews.every(isReview)) throw new Error();
      if (mounted.current) { setReviews(data.reviews); setReady(true); }
      return true;
    } catch {
      if (mounted.current) setError(mutation ? '저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.' : '복기 노트를 불러오지 못했습니다. 다시 불러와 주세요.');
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true;
    void request();
    return () => { mounted.current = false; };
  }, []);
  return { reviews, busy, ready, error, request };
}
export type ReviewStore = ReturnType<typeof useHandReviews>;
