# 뱅크롤 관리 페이지 설계

작성일: 2026-06-12

## 목적

CoinPoker 세션 요약 JSON(캐시 게임 history, 토너먼트 history)을 import 하여 뱅크롤
추이와 태그별 손익을 시각화하는 새 페이지를 추가한다. 레퍼런스 이미지의 Analytics
대시보드가 목표 디자인이며, 제공된 두 JSON이 그 이미지와 동일한 데이터셋임을 확인했다.

## 비목표 (YAGNI)

- 데이터 영속화(localStorage / Blob). **메모리 전용** — 방문 시마다 다시 import.
- 토너먼트의 게임타입 세부 분류(레퍼런스 이미지에 없음).
- 기존 `CoinPokerAnalysisPage`(핸드 히스토리 텍스트 GTO 비교)와의 통합. 완전히 별개 페이지.
- 다중 플랫폼/계정 합산. 단일 사용자, 단일 import 흐름.

## 입력 데이터

### 캐시 게임 (`cash_history_*.json`) — 배열
주요 필드: `game_type`, `minigames_type_id`, `internal_ref`, `start_datetime`,
`buy_in`(문자열), `win_loss`(문자열, **이미 순손익**), `total_no_hands`.

### 토너먼트 (`table_history_*.json`) — 배열
주요 필드: `tournament_id`, `tournament_name`, `tournament_type`, `minigames_type_id`,
`start_datetime`, `internal_ref`, `buy_in`(문자열), `win_loss`(문자열, **획득 총액**),
`rank`, `total_no_of_entries`, `is_ticket`, `bounty_amount`.

### 파일 타입 자동 판별
한 입력으로 여러 파일을 받고, 각 파일 배열의 첫 항목에 `tournament_id` 키가 있으면
토너먼트, 없으면 캐시로 판별한다.

## 데이터 모델 (`src/utils/bankroll.ts`)

```ts
export type BankrollKind = 'cash' | 'tournament';

export interface BankrollSession {
  id: string;          // dedupe 키: cash → internal_ref, tournament → tournament_id
  kind: BankrollKind;
  datetime: string;    // start_datetime (정렬용, ISO-유사 'YYYY-MM-DD HH:mm:ss')
  profit: number;      // 순손익 (아래 계산식)
  winLoss: number;     // 원본 win_loss
  buyIn?: number;      // 토너먼트 바이인 단가
  entries?: number;    // 토너먼트 total_no_of_entries
  name?: string;       // tournament_name 또는 캐시 game_type
  rank?: number;       // 토너먼트 순위
  tags: string[];
}
```

### 순손익(profit) 계산
- 캐시: `profit = parseFloat(win_loss)` (이미 순손익).
- 토너먼트: `profit = parseFloat(win_loss) - parseFloat(buy_in) * total_no_of_entries`.

### 태깅 (다중·중첩 태그)
각 세션은 여러 태그를 동시에 가진다. 태그 성과는 해당 태그를 가진 세션 profit 합.

- 모든 세션 → `CoinPoker`
- 캐시 → `Cash History` + 게임타입 태그(아래)
- 토너먼트 → `Tournament History`

게임타입 태그 매핑 (캐시 전용):

| game_type | minigames_type_id | 태그 |
|---|---|---|
| Texas Hold'em | 1 | NL |
| Omaha | 2 | PLO4 |
| Five cards omaha | (5카드) | PLO5 |
| Six cards omaha | 20 | PLO6 |

매핑 함수는 `minigames_type_id` 우선, 없으면 `game_type` 문자열로 fallback.
알 수 없는 타입은 게임타입 태그를 부여하지 않고 `Cash History`/`CoinPoker`만 유지.

### Dedupe
- 캐시: `internal_ref` 기준 유니크.
- 토너먼트: `tournament_id` 기준 유니크.
- 같은 파일 재import / 파일 간 중복 시 마지막 항목으로 덮어쓰기(merge by key).

### 파생 계산
- `computeTrend(sessions)`: datetime 오름차순 정렬 → profit 누적합 →
  `{ datetime, value }[]` (value = 0에서 시작한 누적 뱅크롤).
- `computeTagPerformance(sessions)`: 태그별 `{ tag, sessions, profit }[]`.
  표시 순서: CoinPoker, Tournament History, Cash History, 그다음 게임타입 태그(profit 내림차순).
- `summarize(sessions)`: `{ totalProfit, cashProfit, tournamentProfit, sessionCount }`.

## 환율 (`src/utils/fxRate.ts`)

```ts
export async function fetchUsdKrwRate(): Promise<number | null>;
```

- Naver 계산기 API 호출:
  `https://m.search.naver.com/p/csearch/content/qapirender.nhn?key=calculator&pkid=141&q=환율&where=m&u1=keb&u6=standardUnit&u7=0&u3=USD&u4=KRW&u8=down&u2=1`
- 응답 `country[1].value`(예: `"1,521.20"`)에서 콤마 제거 후 `parseFloat`.
- CORS 허용됨(`access-control-allow-origin: *`) → 브라우저 직접 fetch. 프록시 불필요.
- 실패/파싱 불가 시 `null` 반환(스로우 금지). 호출부는 null이면 환율 칩 숨김.

## 컴포넌트

### `src/components/BankrollTrendChart.tsx`
- 커스텀 SVG 라인 차트. props: `points: { datetime: string; value: number }[]`.
- y축 0 기준선, 점 마커, hover 시 툴팁(날짜 + 누적 뱅크롤 값).
- 빈/단일 포인트 방어.

### `src/components/TagPerformanceChart.tsx`
- 커스텀 SVG 막대 차트. props: `rows: { tag: string; profit: number; sessions: number }[]`.
- profit ≥ 0 녹색, < 0 적색. 0 기준선.
- 차트 아래(또는 페이지에서) 태그 테이블: 태그명 / N sessions / 손익.

### `src/pages/BankrollPage.tsx`
- 메모리 state: `sessions: BankrollSession[]`, `rate: number | null`, `fileError`.
- import 영역: 멀티 파일 `<input type="file" accept=".json,application/json" multiple>`.
  각 파일 읽기 → `JSON.parse` → 타입 자동 판별 → 정규화 → dedupe merge.
  파싱 실패 파일은 에러 메시지 표시, 나머지는 계속 진행.
- 마운트 시 `fetchUsdKrwRate()` 호출(실패 무시).
- 상단 칩: `Bankroll: $X.XX`, `USD/KRW: 1,521.2`(null이면 숨김), `Sessions: N`.
- 카드 3개: TOTAL PROFIT / CASH / TOURNAMENTS.
- 추이 차트 → 태그 막대 차트 → 태그 테이블.
- 빈 상태: import 안내 문구 + 입력만 표시.

### 포맷팅
- USD: `$12.85`, 음수 `-$0.72` (소수 2자리).
- 환율: 천 단위 콤마, 소수 1자리.

## App 통합 (`src/App.tsx`)

- `View` 타입에 `'bankroll'` 추가.
- `VIEWS`에 `{ value: 'bankroll', label: '뱅크롤' }` 추가.
- StackTabs 제외 조건에 `bankroll` 포함(coinpoker처럼).
- 렌더: `{view === 'bankroll' && <BankrollPage />}`.
- 필요 시 컨테이너 max-width를 coinpoker처럼 넓게(`max-w-7xl`) 적용.

## 테스트 (`src/utils/bankroll.test.ts`, Vitest)

기존 `*.test.ts` 패턴을 따라 순수 함수 검증. 제공된 샘플 데이터로 레퍼런스 수치 확인:

- 캐시 순손익 합 = `0.62`.
- 캐시 태그: NL 6세션 `-0.72`, PLO4 3세션 `-0.82`, PLO6 1세션 `2.16`.
- 토너먼트 순손익 합 ≈ `12.23` (win_loss − buy_in×entries).
- 전체 TOTAL PROFIT = cash + tournament.
- Dedupe: 동일 키 중복 제거.
- 게임타입 매핑(id 1/2/20, 5카드 fallback).
- `computeTrend` 누적합 단조 정의 및 정렬.

## 엣지 케이스

- 빈 배열 / 잘못된 JSON → 파일별 에러, 앱 정상 유지.
- `total_no_of_entries` 누락 → 1로 간주.
- `buy_in`/`win_loss` 공백·비정상 문자열 → `parseFloat` NaN 시 0 처리.
- 프리롤(buy_in 0, win_loss 0) → profit 0, 세션 수에는 포함.
- 환율 API 차단/오프라인(GitHub Pages 등) → 환율 칩 숨김, 나머지 동작.
