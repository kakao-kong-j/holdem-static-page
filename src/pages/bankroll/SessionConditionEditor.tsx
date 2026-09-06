import { useState } from 'react';
import { isSessionCondition, type SessionCondition } from '../../utils/sessionCondition';

const ratings = [['focus', '집중도'], ['fatigue', '피로도'], ['tilt', '틸트']] as const;
interface Props {
  value?: SessionCondition | null;
  disabled: boolean;
  onSave: (value: SessionCondition | null) => Promise<void>;
}

export function SessionConditionEditor({ value, disabled, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SessionCondition>({});
  const [error, setError] = useState<string | null>(null);
  const recorded = value && Object.values(value).some(v => v !== '');
  async function save(next: SessionCondition | null) {
    if (!isSessionCondition(next)) {
      setError('점수는 1~5 정수, 메모는 2,000자 이내로 입력하세요.');
      return;
    }
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      setError('컨디션을 저장하지 못했습니다. 입력은 유지됩니다. 다시 시도하세요.');
    }
  }
  return <div className="mt-2 min-w-60 space-y-2 text-xs">
    {!editing ? <>
      <div className="text-gray-400">{recorded ? ratings.filter(([key]) => value?.[key] !== undefined).map(([key, label]) => `${label} ${value?.[key]}`).join(' · ') : '컨디션 기록 없음'}</div>
      {value?.memo && <p className="max-w-80 whitespace-pre-wrap break-words text-gray-300">{value.memo}</p>}
      <button disabled={disabled} className="text-indigo-300 disabled:opacity-50" onClick={() => { setDraft(value ?? {}); setError(null); setEditing(true); }}>
        {recorded ? '컨디션 수정' : '컨디션 기록'}
      </button>
    </> : <fieldset disabled={disabled} className="space-y-2 disabled:opacity-60">
      <legend className="mb-1 text-gray-300">세션 컨디션 (선택 사항)</legend>
      <p className="text-gray-400">1 = 낮음 · 5 = 높음 (피로도·틸트는 높을수록 심함)</p>
      <div className="flex flex-wrap gap-2">
        {ratings.map(([key, label]) => <label key={key} className="flex flex-col gap-1">{label}
          <select value={draft[key] ?? ''} onChange={e => { const next = { ...draft }; if (e.target.value) next[key] = Number(e.target.value); else delete next[key]; setDraft(next); }} className="rounded border border-gray-700 bg-gray-950 p-1">
            <option value="">미기록</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>)}
      </div>
      <label className="block">메모 (최대 2,000자)
        <textarea value={draft.memo ?? ''} maxLength={2000} rows={3} onChange={e => setDraft({ ...draft, memo: e.target.value })} className="mt-1 w-full rounded border border-gray-700 bg-gray-950 p-2" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => save(Object.values(draft).some(v => v !== '') ? draft : null)} className="text-indigo-300">컨디션 저장</button>
        <button onClick={() => save(null)} className="text-red-300">컨디션 기록 지우기</button>
        <button onClick={() => { setEditing(false); setError(null); }}>취소</button>
      </div>
    </fieldset>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
