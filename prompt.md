# GTO Preflop Charts 앱 구현 프롬프트

## 개요

포커 GTO(Game Theory Optimal) 프리플랍 차트 시각화 앱을 만든다.
데이터 파일: `gto-preflop-charts-all.json` (같은 디렉토리에 위치)

---

## 1. 기술 스택

- **React + TypeScript + Vite**
- **Tailwind CSS** (스타일링)
- 외부 라이브러리 최소화 (차트는 직접 구현)

---

## 2. 데이터 파일 구조

```
gto-preflop-charts-all.json
└── data
    ├── "15BB"  → { [chartName: string]: { [action: string]: string[] } }
    ├── "25BB"  → { ... }
    ├── "40BB"  → { ... }
    └── "100BB" → { ... }
```

### 핸드 표기법

- 169가지 핸드: 페어(13) + suited(78) + offsuit(78)
- 페어: `"AA"`, `"KK"`, ..., `"22"` → 6 combos each
- Suited: `"AKs"`, `"AQs"`, ..., `"32s"` → 4 combos each
- Offsuit: `"AKo"`, `"AQo"`, ..., `"32o"` → 12 combos each
- 총 1326 combos

### 13×13 그리드 매핑

```
RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
행 인덱스 ri, 열 인덱스 ci 에서:
  ri === ci → 페어 (예: ri=0,ci=0 → "AA")
  ci > ri   → suited (예: ri=0,ci=1 → "AKs")
  ci < ri   → offsuit (예: ri=1,ci=0 → "AKo")
```

---

## 3. 스택별 차트 목록 및 액션

### 3-1. 15BB (43개 차트)

#### RFI (Raise First In) 차트 8개

| 차트 이름 | 액션 | combos |
|-----------|------|--------|
| `"UTG RFI"` | raise=222 | 222 |
| `"UTG+1 RFI"` | raise=248 | 248 |
| `"UTG+2 RFI"` | raise=208, allIn=34 | 242 |
| `"LJ RFI"` | raise=208, allIn=76 | 284 |
| `"HJ RFI"` | raise=232, allIn=76 | 308 |
| `"CO RFI"` | raise=218, allIn=168 | 386 |
| `"BTN RFI"` | raise=244, allIn=258 | 502 |
| `"SB RFI"` | call=764, allIn=256 | 1020 |

#### Facing RFI 차트 (상대 오픈에 대응)

```
"UTG1/2 vs UTG RFI"    → allIn
"LJ/HJ vs UTG RFI"     → allIn
"CO vs UTG RFI"        → allIn
"BTN vs UTG RFI"       → call, allIn
"SB vs UTG RFI"        → allIn, call
"BB vs UTG RFI"        → call, allIn
"HJ vs LJ RFI"         → allIn
"CO vs LJ/HJ RFI"      → allIn
"BTN vs LJ/HJ RFI"     → call, allIn
"SB vs LJ/HJ RFI"      → allIn, call
"BB vs LJ/HJ RFI"      → call, allIn
"BTN vs CO RFI"        → call, allIn
"SB vs CO RFI"         → allIn
"BB vs CO RFI"         → call, allIn
"SB vs BTN RFI"        → allIn
"BB vs BTN RFI"        → call, allIn
```

#### RFI vs All-In (오픈 후 잼 당했을 때)

```
"UTG RFI vs UTG1-CO Allin"  → call
"UTG RFI vs BTN Allin"      → call
"UTG RFI vs SB Allin"       → call
"UTG RFI vs BB Allin"       → call
"UTG1 RFI vs UTG2-CO Allin" → call
"UTG1 RFI vs BTN Allin"     → call
"UTG1 RFI vs SB Allin"      → call
"UTG1 RFI vs BB Allin"      → call
"UTG2 RFI vs Allin"         → call
"LJ RFI vs Allin"           → call
"HJ RFI vs Allin"           → call
"CO RFI vs Allin"           → call
"BTN RFI vs Allin"          → call
```

#### Blind vs Blind (BvB) 차트

```
"SB RFI BvB"          → call, allIn
"BB vs SB Limp"       → raise, call, allIn
"BB vs SB Allin"      → call
"SB Limp vs BB Raise" → call, allIn
"SB Limp vs BB Allin" → call
"BB vs SB Limp/Jam"   → call
```

---

### 3-2. 25BB (28개 차트)

#### RFI 차트 8개

| 차트 이름 | 액션 | combos |
|-----------|------|--------|
| `"UTG RFI"` | raise=222 | 222 |
| `"UTG+1 RFI"` | raise=248 | 248 |
| `"UTG+2 RFI"` | raise=276 | 276 |
| `"LJ RFI"` | raise=320 | 320 |
| `"HJ RFI"` | raise=368 | 368 |
| `"CO RFI"` | raise=454 | 454 |
| `"BTN RFI"` | raise=614 | 614 |
| `"SB RFI"` | raise=398, call=664, allIn=24 | 1086 |

#### Facing RFI 차트

```
"UTG1/2 vs UTG RFI"   → threebet, call
"LJ/HJ vs UTG RFI"    → threebet, call, allIn
"CO vs UTG RFI"       → threebet, call, allIn
"BTN vs UTG RFI"      → call, threebet, allIn
"SB vs UTG RFI"       → threebet, call, allIn
"BB vs UTG RFI"       → threebet, call, allIn
"HJ vs LJ RFI"        → call, threebet, allIn
"CO vs LJ/HJ RFI"     → call, threebet, allIn
"BTN vs LJ/HJ RFI"    → threebet, call, allIn
"SB vs LJ/HJ RFI"     → threebet, call, allIn
"BB vs LJ/HJ RFI"     → threebet, call, allIn
"BTN vs CO RFI"       → call, threebet, allIn
"SB vs CO RFI"        → threebet, call, allIn
"BB vs CO RFI"        → threebet, call, allIn
"SB vs BTN RFI"       → threebet, call, allIn
"BB vs BTN RFI"       → threebet, call, allIn
```

#### BvB 차트

```
"SB RFI BvB"           → allIn, limp_call, raise_fold, limp_fold, raise_call, raise_limp
"BB vs SB Limp"        → raise, allIn
"BB vs SB Raise"       → call, allIn
"BB vs SB Limp/All-In" → call, allIn
```

---

### 3-3. 40BB (27개 차트)

#### RFI 차트 8개

| 차트 이름 | 액션 | combos |
|-----------|------|--------|
| `"UTG RFI"` | raise=214 | 214 |
| `"UTG+1 RFI"` | raise=232 | 232 |
| `"UTG+2 RFI"` | raise=272 | 272 |
| `"LJ RFI"` | raise=312 | 312 |
| `"HJ RFI"` | raise=380 | 380 |
| `"CO RFI"` | raise=480 | 480 |
| `"BTN RFI"` | raise=674 | 674 |
| `"SB RFI"` | raise=352, call=722 | 1074 |

#### Facing RFI 차트

```
"UTG1/2 vs UTG RFI"  → threebet, call
"LJ/HJ vs UTG RFI"   → threebet, call
"CO vs UTG RFI"      → threebet, call
"BTN vs UTG RFI"     → threebet, call
"SB vs UTG RFI"      → threebet, call
"BB vs UTG RFI"      → threebet, call
"HJ vs LJ RFI"       → threebet, call
"CO vs LJ/HJ RFI"    → threebet, call
"BTN vs LJ/HJ RFI"   → threebet, call
"SB vs LJ/HJ RFI"    → threebet, call
"BB vs LJ/HJ RFI"    → threebet, call
"BTN vs CO RFI"      → threebet, call
"SB vs CO RFI"       → threebet, call
"BB vs CO RFI"       → threebet, call
"SB vs BTN RFI"      → threebet, call, allIn
"BB vs BTN RFI"      → threebet, call, allIn
```

#### BvB 차트

```
"SB RFI BvB"    → raise_call, limp_raise, raise4bet, limp_call, raise_fold, limp_fold
"BB vs SB Limp" → raise
"BB vs SB Raise"→ threebet, call
```

---

### 3-4. 100BB (68개 차트)

#### RFI 차트 8개

| 차트 이름 | 액션 | combos |
|-----------|------|--------|
| `"UTG RFI"` | raise=134 | 134 |
| `"UTG+1 RFI"` | raise=190 | 190 |
| `"UTG+2 RFI"` | raise=208 | 208 |
| `"LJ RFI"` | raise=242 | 242 |
| `"HJ RFI"` | raise=282 | 282 |
| `"CO RFI"` | raise=358 | 358 |
| `"BTN RFI"` | raise=678 | 678 |
| `"SB RFI"` | limp=644, raise=118, raise_bluff=172 | 934 |

#### Facing RFI 차트 (30개) — 100BB는 더 세분화됨

```
"UTG+1 vs UTG"         → threebet_value, threebet_bluff, call
"UTG+2 vs UTG/UTG+1"   → threebet_value, threebet_bluff, call
"LJ vs UTG/UTG+1"      → threebet_value, threebet_bluff, call
"LJ vs UTG+2"          → threebet_value, threebet_bluff, call
"HJ vs UTG"            → threebet_value, threebet_bluff, call
"HJ vs UTG+1"          → threebet_value, threebet_bluff, call
"HJ vs UTG+2"          → threebet_value, threebet_bluff, call
"HJ vs LJ"             → threebet_value, threebet_bluff, call
"CO vs UTG/UTG+1"      → threebet_value, threebet_bluff, call
"CO vs UTG+2"          → threebet_value, threebet_bluff, call
"CO vs LJ"             → threebet_value, threebet_bluff, call
"CO vs HJ"             → threebet_value, threebet_bluff, call
"BTN vs UTG"           → threebet_value, threebet_bluff, call
"BTN vs UTG+1"         → threebet_value, threebet_bluff, call
"BTN vs UTG+2"         → threebet_value, threebet_bluff, call
"BTN vs LJ"            → threebet_value, threebet_bluff, call
"BTN vs HJ"            → threebet_value, threebet_bluff, call
"BTN vs CO"            → threebet_value, threebet_bluff, call
"SB vs UTG/UTG+1"      → threebet_value, threebet_bluff, call
"SB vs UTG+2"          → threebet_value, threebet_bluff, call
"SB vs LJ"             → threebet_value, threebet_bluff, call
"SB vs HJ"             → threebet_value, threebet_bluff, call
"SB vs CO"             → threebet_value, threebet_bluff  (call 없음!)
"SB vs BTN"            → threebet_value, threebet_bluff  (call 없음!)
"BB vs UTG/UTG+1"      → threebet_value, threebet_bluff, call
"BB vs UTG+2"          → threebet_value, threebet_bluff, call
"BB vs LJ"             → threebet_value, threebet_bluff, call
"BB vs HJ"             → threebet_value, threebet_bluff, call
"BB vs CO"             → threebet_value, threebet_bluff, call
"BB vs BTN"            → threebet_value, threebet_bluff, call
"BB vs SB"             → threebet_value, threebet_bluff, call
```

#### RFI vs 3bet 차트 (30개) — 100BB 전용

오프너 → 3베터 가능 목록:

```
"UTG"    → ["UTG+1", "UTG+2", "LJ", "HJ", "CO/BTN", "SB/BB"]
"UTG+1"  → ["UTG+2", "LJ", "HJ/CO", "BTN", "SB/BB"]
"UTG+2"  → ["LJ", "HJ", "CO/BTN", "SB/BB"]
"LJ"     → ["HJ", "CO", "BTN", "SB", "BB"]
"HJ"     → ["CO", "BTN", "SB", "BB"]
"CO"     → ["BTN/SB", "BB"]
"BTN"    → ["SB/BB"]
"SB RFI" → ["BB"]
```

차트 이름 형식: `"{opener} vs {bettor} 3bet"`
예: `"UTG vs HJ 3bet"`, `"LJ vs BB 3bet"`, `"SB RFI vs BB 3bet"`

특수 차트:
- `"SB Limp vs BB Raise"` → threebet_value, threebet_bluff, call

---

## 4. 액션 → 색상 매핑

```typescript
const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  // RFI 오픈
  raise:          { bg: '#C94040', text: '#fff', label: 'R'  },
  allIn:          { bg: '#7B2FBE', text: '#fff', label: 'J'  },
  call:           { bg: '#2AA875', text: '#fff', label: 'C'  },
  raise_bluff:    { bg: '#1C7AA8', text: '#fff', label: 'Rb' },
  limp:           { bg: '#2AA875', text: '#fff', label: 'L'  },

  // Facing RFI
  threebet:       { bg: '#C94040', text: '#fff', label: '3'  },
  threebet_value: { bg: '#C94040', text: '#fff', label: '3v' },
  threebet_bluff: { bg: '#1C7AA8', text: '#fff', label: '3b' },

  // vs 3bet (100BB)
  fourbet_value:  { bg: '#C94040', text: '#fff', label: '4v' },
  fourbet_bluff:  { bg: '#1C7AA8', text: '#fff', label: '4b' },

  // BvB (40BB SB RFI)
  raise4bet:      { bg: '#1C7AA8', text: '#fff', label: 'R4' },
  raise_fold:     { bg: '#6BAD25', text: '#1e3800', label: 'Rf' },
  raise_call:     { bg: '#2AA875', text: '#fff', label: 'Rc' },
  limp_call:      { bg: '#D97632', text: '#fff', label: 'Lc' },
  limp_raise:     { bg: '#C94040', text: '#fff', label: 'Lr' },
  limp_fold:      { bg: '#B8BD2A', text: '#4a4100', label: 'Lf' },

  // fold (기본값)
  fold:           { bg: 'transparent', text: 'var(--muted)', label: '-' },
};
```

### 오픈 레인지 그리드 포지션 색상

```typescript
const POSITION_COLORS: Record<string, string> = {
  'UTG':   '#C94040',
  'UTG+1': '#D97632',
  'UTG+2': '#C99322',
  'LJ':    '#B8BD2A',
  'HJ':    '#6BAD25',
  'CO':    '#2AA875',
  'BTN':   '#1C7AA8',
  'SB':    '#6B4DB8',
};
```

---

## 5. 구현할 화면 2가지

---

### 화면 A: 오픈 레인지 그리드 (Open Range Overview)

**목적**: 각 스택에서 핸드별로 어느 포지션부터 오픈할 수 있는지 한눈에 보기

**규칙**:
- 각 핸드마다 "가장 먼저 오픈 가능한 포지션(earliest position)"을 표시
- UTG부터 SB 순서로 RFI 차트를 순회하며 해당 핸드가 처음 등장하는 포지션을 기록
- 어떤 스택에서도 오픈 안 하는 핸드 → fold(회색/투명)
- 액션 종류(raise/allIn/limp 등) 구분 없이 "이 포지션에서 플레이 가능"만 표시

**검증 데이터** (earliest position 기준 combos):

| 스택 | UTG | UTG+1 | UTG+2 | LJ | HJ | CO | BTN | SB | Fold |
|------|-----|-------|-------|----|----|----|-----|-----|------|
| 15BB | 222 | 26 | 20 | 28 | 32 | 64 | 116 | 512 | 306 |
| 25BB | 222 | 26 | 28 | 44 | 48 | 86 | 160 | 472 | 240 |
| 40BB | 214 | 18 | 40 | 40 | 68 | 100 | 194 | 400 | 252 |
| 100BB| 134 | 56 | 18 | 34 | 40 | 76 | 320 | 256 | 392 |

**UI 요구사항**:
- 상단에 스택 선택 탭: `[15BB] [25BB] [40BB] [100BB]`
- 탭 변경 시 그리드 즉시 업데이트
- 13×13 그리드: 행 = 첫 번째 카드(A~2), 열 = 두 번째 카드(A~2)
- 각 셀 = 포지션 색상 배경 + 핸드명(작게) + 포지션명
- 셀 hover 시 약간 확대(scale 1.1~1.15)
- 그리드 하단에 범례(포지션별 색상 + combos 수) 표시
- 그리드 하단에 통계: `전체 오픈 가능: N combos (X%)`, `EP 전용(UTG~UTG+2): N combos`, `Fold: N combos`

---

### 화면 B: RFI vs 상대 액션 (Facing Charts)

**목적**: 특정 상황(스택 + 차트 선택)에서 핸드별 대응 액션을 13×13 그리드로 표시

**UI 요구사항**:

```
[스택 탭: 15BB | 25BB | 40BB | 100BB]

[차트 그룹 탭 or 드롭다운]
예시:
- RFI (내가 오픈할 때)
- Facing RFI (상대 오픈에 대응)
- RFI vs All-In / RFI vs 3bet (오픈 후 상대 3bet/잼 대응)  ← 100BB만
- BvB (블라인드 vs 블라인드)

[차트 선택 드롭다운 or 버튼 목록]
← 선택된 스택 + 그룹에 맞는 차트 목록 자동 필터링

[13×13 그리드 — 항상 표시]
← 선택이 바뀌면 즉시 업데이트, 애니메이션 없이 즉시

[범례: 사용된 액션만 표시]
[통계: 각 액션별 combos 수]
```

**100BB RFI vs 3bet 전용 UI** (특수 케이스):
- 드롭다운 2개: `[내 포지션(오프너)] → 3bet by [상대 포지션]`
- 오프너 선택 시 → 해당 오프너에 맞는 3베터 목록 자동 갱신
- 오프너→3베터 매핑은 섹션 3-4 참조

---

## 6. 공통 컴포넌트: RangeGrid

```typescript
interface RangeGridProps {
  // 핸드 → 액션 매핑 (169개 핸드, 없는 핸드는 'fold')
  handAction: Record<string, string>;
  // 셀 클릭 핸들러 (선택 사항)
  onCellClick?: (hand: string, action: string) => void;
}
```

**셀 렌더링 로직**:
```typescript
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

function getHandName(ri: number, ci: number): string {
  if (ri === ci) return `${RANKS[ri]}${RANKS[ri]}`;           // 페어
  if (ci > ri)  return `${RANKS[ri]}${RANKS[ci]}s`;           // suited (upper-right)
  return `${RANKS[ci]}${RANKS[ri]}o`;                          // offsuit (lower-left)
}

function getCombos(ri: number, ci: number): number {
  if (ri === ci) return 6;   // 페어
  if (ci > ri)  return 4;    // suited
  return 12;                  // offsuit
}
```

**handAction 생성 방법** (JSON 데이터 → 그리드 변환):
```typescript
function buildHandAction(chartData: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [action, hands] of Object.entries(chartData)) {
    for (const hand of hands) {
      result[hand] = action;
    }
  }
  return result;
}
// 없는 핸드는 'fold'로 처리
```

---

## 7. 검증 포인트

앱 구현 후 반드시 아래 수치와 일치하는지 확인:

### RFI combos 검증

| 스택 | 포지션 | raise | allIn | call | limp | raise_bluff |
|------|--------|-------|-------|------|------|-------------|
| 15BB | UTG | 222 | - | - | - | - |
| 15BB | SB | - | 256 | 764 | - | - |
| 25BB | UTG | 222 | - | - | - | - |
| 25BB | BTN | 614 | - | - | - | - |
| 25BB | SB | 398 | 24 | 664 | - | - |
| 40BB | UTG | 214 | - | - | - | - |
| 40BB | BTN | 674 | - | - | - | - |
| 40BB | SB | 352 | - | 722 | - | - |
| 100BB | UTG | 134 | - | - | - | - |
| 100BB | BTN | 678 | - | - | - | - |
| 100BB | SB | 118 | - | - | 644 | 172 |

### 오픈 레인지 그리드 검증 (total)

| 스택 | 오픈 가능 | Fold |
|------|-----------|------|
| 15BB | 1020 | 306 |
| 25BB | 1086 | 240 |
| 40BB | 1074 | 252 |
| 100BB | 934 | 392 |

---

## 8. 앱 전체 라우팅 구조

```
/                     → 스택 선택 홈 (선택 없으면 100BB 기본)
/open-range           → 화면 A: 오픈 레인지 그리드
/facing               → 화면 B: Facing 차트 (스택/차트 선택 포함)
```

또는 단일 페이지에서 탭으로 전환해도 무방.

---

## 9. 주의사항

1. **JSON 데이터를 직접 import** 하지 말고 `fetch`로 로드 (파일 크기 약 70KB)
2. **핸드 목록은 JSON에서 오는 그대로 사용** — 직접 하드코딩하지 말 것
3. **combos 계산**: pair=6, suited=4, offsuit=12 — 고정값
4. **fold는 JSON에 없음** — 169개 핸드에서 chart에 없는 핸드는 fold 처리
5. **100BB SB RFI의 raise/raise_bluff/limp**: 전부 "오픈 가능"으로 처리 (오픈 레인지 그리드에서 SB 색상으로 표시)
6. **15BB SB RFI의 call**: BvB에서 리스크 없이 콜하는 것 — 오픈 레인지 그리드에서 SB로 처리
