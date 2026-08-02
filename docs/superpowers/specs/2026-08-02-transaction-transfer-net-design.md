# 거래내역 Transfer Net 집계 설계

## 목표

거래내역의 transfer 금액을 양수로 Net에 반영한다.

## 동작

- `summarizeTransactions`의 Net 계산을 `Income - Expense + Transfer`로 변경한다.
- transfer는 현재 집계하는 원본 `amount`를 항상 양수로 더한다.
- Income, Expense, Transfer 카드와 `입금 포함` 체크박스 동작은 바꾸지 않는다.
- 기존 잔고 그래프 데이터도 변경하지 않는다.

## 구현 및 검증

- `src/utils/transactions.ts`의 Net 계산만 변경한다.
- `src/utils/transactions.test.ts`에 transfer가 Net에 더해지는 단위 테스트를 추가한다.
- Vitest 집중 테스트, 전체 테스트, 프로덕션 빌드를 통과해야 한다.
