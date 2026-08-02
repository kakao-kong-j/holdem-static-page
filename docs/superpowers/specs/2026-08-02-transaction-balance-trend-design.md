# 거래내역 잔고 추이 설계

## 목표

거래내역 페이지에서 선택 기간의 실제 잔고(`balance`) 추이를 확인하고, deposit을 Income·Net 집계에 포함할지 선택할 수 있게 한다.

## 동작

- 기존 From/To 필터를 적용한 거래를 날짜 오름차순으로 정렬한다.
- `balance`가 있는 거래를 SVG 라인 차트로 표시한다. 잔고 값은 원본 거래의 실제 잔고이므로 deposit 포함 여부와 관계없이 항상 그대로 표시한다.
- `입금 포함` 체크박스를 요약 카드 가까이에 둔다. 기본값은 꺼짐이다.
  - 꺼짐: deposit은 Income과 Net에서 제외한다.
  - 켜짐: deposit은 Income과 Net에 포함한다.
- Expense, Transfer, Rows, 거래 목록과 기존 Direction 필터의 의미는 바꾸지 않는다.
- balance가 있는 거래가 없으면 차트에는 데이터 없음 상태를 보인다.

## 구현 경계

- `src/utils/transactions.ts`: 요약 함수가 deposit 포함 여부를 받도록 하며, balance 차트 포인트를 만드는 순수 함수를 추가한다.
- `src/components/BankrollTrendChart.tsx`: 이미 있는 의존성 없는 SVG 라인 차트를 재사용한다. 거래 차트에 맞는 최소 공용 point 타입만 허용한다.
- `src/pages/TransactionsPage.tsx`: 체크박스 상태, 필터된 차트 데이터, 차트 섹션을 연결한다.
- `src/utils/transactions.test.ts`: deposit 집계 전환과 날짜순 balance 포인트 생성만 테스트한다.

## 제약 및 검증

- 새 의존성을 추가하지 않는다.
- 차트는 선택된 기간만 반영한다.
- 기존 거래 분류와 저장 형식은 변경하지 않는다.
- Vitest 단위 테스트와 TypeScript/Vite 프로덕션 빌드를 통과해야 한다.
