# 뱅크롤 새틀라이트 티켓 상금 매칭 설계

작성일: 2026-08-13

## 목표

CoinPoker 토너먼트 history에서 `is_ticket: true`인 기록이 획득한 다음 단계
티켓의 가치를 상금으로 반영한다. 동일 토너먼트 참가 티켓 가격을 상금으로 잘못
사용해 `profit`이 0이 되는 문제를 해결한다.

## 확인된 데이터 의미

- 토너먼트 history의 `buy_in`은 `total_no_of_entries`를 이미 반영한 총비용이다.
- `is_ticket: true`는 해당 토너먼트에서 티켓을 획득했다는 뜻이다.
- 티켓 export 최상위 항목의 `ticketAmount`는 그 항목이 나타내는 티켓의 액면가다.
- 티켓 export의 `eligibleTournaments[].tourneyName`과 `tourneyId`는 그 티켓으로
  참가할 수 있는 토너먼트를 식별한다.
- 토너먼트와 이름이 같은 티켓은 해당 토너먼트의 참가 티켓이다. 획득 상금은
  다음 단계 토너먼트의 참가 티켓이므로 같은 이름의 `ticketAmount`를 상금으로
  사용하지 않는다.

## 상금 결정 규칙

### Seats 토너먼트

`N Seat to ₮X ...` 또는 `N Seats to ₮X ...` 형식이면 이름의 첫 `to ₮X`에서
금액을 추출해 상금으로 사용한다.

예:

- `15 Seats to ₮11 Regs Round Table` → `$11`
- `20 Seat to ₮8.88 ONE TIME FREEZEOUT` → `$8.88`
- `15 Seats to ₮5.50 Micro Kickoff` → `$5.50`

이 규칙은 목적지 본선 티켓이 현재 티켓 export에 없어도 적용한다.

### Step 토너먼트

티켓 export를 다음 구조로 평탄화한다.

```ts
interface TicketCandidate {
  tourneyId: string;
  tourneyName: string;
  ticketAmount: number;
}
```

각 `eligibleTournaments[]` 항목에 최상위 `ticketAmount`를 연결해 후보를 만든다.
유효하고 0 이상인 숫자만 허용한다.

- `Step [N]` (`N > 2`)의 다음 단계는 같은 목적지의 `Step [N-1]`이다.
- `Step [2]`의 다음 단계는 같은 목적지의 `N Seat(s) to ...` 토너먼트다.
- 후보의 `tourneyId`는 원본 `tournament_id`보다 작아야 한다.
- 같은 다음 단계 후보가 여러 개면 가장 큰 `tourneyId`, 즉 원본 ID에 가장 가까운
  이전 토너먼트를 선택한다.
- 먼저 정규화한 전체 목적지 이름이 같은 후보를 찾는다.

CoinPoker 이름이 단계 사이에서 바뀐 두 실제 기록을 위해 제한적인 fallback을 둔다.
정확한 이름 후보가 없을 때만 `tourneyId === tournament_id - 1`, 목적지의 `₮` 금액이
같고 다음 단계 형태가 맞는 후보를 허용한다. 이 규칙은 다음 두 기록을 일반화해
처리한다.

- `63887 Step [3] ... SHIBA` → `63886 Step [2] ... PEPE`, 상금 `$1.10`
- `63886 Step [2] ... PEPE` → `63885 20 Seats ... SHIBA`, 상금 `$11`

조건을 만족하는 후보가 없으면 자동으로 추측하지 않는다. 기존의 티켓 가격 누락
표시와 수동 편집 경로를 유지한다.

## Profit 계산

```text
일반 토너먼트: profit = win_loss - buy_in
티켓 획득:     profit = win_loss + ticketPrize - buy_in
```

`buy_in`은 총비용이므로 `total_no_of_entries`를 다시 곱하지 않는다.

실제 데이터 예:

- `85494 Step [4] to ₮215 ...`: `$0.30 - $0.00 = +$0.30`
- `85119 Step [3] to ₮215 ...`: `$3.30 - $0.30 = +$3.00`
- `85123 Step [2] to ₮215 ...`: `$5.50 - $0.55 = +$4.95`
- `83097 15 Seats to ₮11 ...`: `$11.00 - $2.20 = +$8.80`
- `63887 Step [3] ... SHIBA`: `$1.10 - $0.10 = +$1.00`
- `63886 Step [2] ... PEPE`: `$11.00 - $1.10 = +$9.90`

## Import와 저장 데이터 갱신

- 토너먼트 history와 티켓 export를 한 번에 가져오거나 어느 순서로 가져와도 같은
  결과가 나와야 한다.
- 티켓 export만 나중에 가져오면 저장된 `isTicket` 세션도 새 규칙으로 다시 매칭하고
  `recalculateSessionProfit`을 거쳐 서버에 저장한다.
- 기존에 잘못 저장된 동일 이름 티켓 가격도 새로 계산한 다음 단계 상금으로
  덮어쓴다.
- 편집 중 import 동기화와 import 중 편집 잠금 동작은 유지한다.
- `BankrollSession.ticketPrice` 필드는 호환성을 위해 유지하되 의미를 “획득한 티켓
  상금”으로 명확히 한다.

## 테스트

실제 JSON을 축약한 fixture로 다음을 검증한다.

- `Step [4] → Step [3]`, `Step [3] → Step [2]`, `Step [2] → Seats` 상금 매칭
- 같은 이름의 참가 티켓 가격을 상금으로 선택하지 않음
- 동일 이름의 과거 후보가 여러 개면 가장 가까운 이전 `tourneyId`를 선택
- `Seat`와 `Seats`, 정수·소수 목적지 금액 파싱
- `SHIBA → PEPE` 이름 변경 fallback 두 건
- 잘못된 `ticketAmount` 거부와 매칭 실패 시 수동 입력 유지
- 토너먼트 먼저/티켓 먼저/동시 import 및 기존 저장 세션 갱신
- 티켓 상금 변경 후 요약, ROI, 태그 성과가 재계산됨

검증 명령은 집중 Vitest, 전체 `npm test`, `npm run lint`, `npm run build`,
`git diff --check` 순서로 실행한다. 마지막으로 제공된 두 JSON 전체를 대상으로
`is_ticket: true` 71건의 상금 계산 결과를 재현한다.

## 비목표

- `is_ticket: false` 토너먼트의 기존 계산 변경
- 티켓 export에 없는 Step 상금을 이름의 최종 목적지 금액으로 추측
- 관련 없는 뱅크롤 UI 또는 저장 API 리팩터링
