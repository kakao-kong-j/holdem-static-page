# Claude Code 저장소 안내

이 저장소의 공통 작업 규칙은 [AGENTS.md](AGENTS.md)에 있습니다. 작업 전에 해당 문서를 읽고 따릅니다. 설치·실행·환경변수·배포 명령은 [README.md](README.md)를 기준으로 확인합니다.

## 프로젝트 개요

한국어 Holdem 학습·기록 앱입니다. 프리플랍 차트, Bencb, 플랍 C-bet, 캐시 레인지, 퀴즈·통계, CoinPoker 분석·복기 노트, 뱅크롤·컨디션, 거래내역, 팟오즈 계산기를 제공합니다.

React 19 / TypeScript / Vite 8 / Tailwind CSS 4를 사용합니다. 별도 라우터나 차트 라이브러리 없이 상태 기반 화면 전환과 커스텀 차트를 사용합니다. 배포는 Vercel이며 Google OAuth와 Blob 저장을 위한 `/api`가 필요합니다.

## 작업별 진입점

| 작업 | 먼저 확인할 파일 |
| --- | --- |
| 메뉴·탭·레이아웃 | `src/App.tsx`, `src/app/viewRegistry.tsx`, `src/components/AppShell.tsx` |
| 로그인·세션 | `src/hooks/useAuth.ts`, `src/components/LoginGate.tsx`, `api/auth/`, `api/_lib/` |
| 기본 차트·SB·상대 대응 | `src/hooks/useChartData.ts`, `src/utils/hand.ts`, `src/utils/chartDataValidation.ts`, `src/utils/scenarioMap.ts`, `src/pages/SbOpenPage.tsx` |
| Bencb 필터·검색 | `src/pages/BencbPreflopPage.tsx`, `src/data/bencb.ts`, `src/data/bencbLookup.ts` |
| 플랍 C-bet·보드 매칭 | `src/pages/FlopCbetPage.tsx`, `src/data/flopCbet.ts`, `src/data/flopBoardMatch.ts`, `src/components/FlopBoardLookup.tsx` |
| 캐시 레인지 | `src/pages/CashHandRangePage.tsx`, `src/utils/cashRange.ts`, `src/components/CashRangeGrid.tsx` |
| 퀴즈·통계 | `src/pages/QuizPage.tsx`, `src/pages/QuizStatsPage.tsx`, `src/utils/recordsSync.ts`, `api/records.ts` |
| CoinPoker 파싱·저장 | `src/utils/coinpokerParser.ts`, `src/utils/coinpokerCompare.ts`, `src/pages/coinpoker/useCoinPokerStore.ts`, `src/utils/coinpokerSync.ts`, `shared/coinpokerHands.ts`, `api/coinpoker.ts` |
| 복기 노트 | `src/components/handReviews/`, `shared/handReviews.ts`, `api/hand-reviews.ts` |
| 뱅크롤·컨디션 | `src/pages/BankrollPage.tsx`, `src/pages/bankroll/`, `src/utils/bankroll.ts`, `src/utils/sessionCondition.ts`, `api/bankroll.ts` |
| 거래내역 | `src/pages/TransactionsPage.tsx`, `src/utils/transactions.ts`, `src/utils/transactionsSync.ts`, `api/transactions.ts` |
| 팟오즈·필요 에쿼티 | `src/pages/EquityCalculatorPage.tsx` |
| 암복호화·데이터 변환 | `scripts/charts-crypto.mjs`, `scripts/convert_flop_cbet.py`, `docs/flop-cbet-data.md` |

## 혼동하기 쉬운 점

- SB Open은 15·25·40·100BB 모두 사용합니다. 과거의 “15/100BB 전용” 설명과 고정 콤보 합계는 현재 구현 기준으로 다시 확인해야 합니다.
- `npm run dev`만으로 로그인과 서버 저장이 동작하지 않습니다. 화면 개발에는 개발 전용 인증 우회와 복호화된 데이터가 필요하고, 실제 계정 기능에는 `npm run dev:vercel`과 서버 환경변수가 필요합니다.
- `npm run build`는 차트를 복호화하지 않습니다. 배포 명령 `npm run build:vercel`이 다섯 데이터 파일을 복호화한 뒤 빌드합니다.
- CoinPoker는 불변 청크를 추가하지만 퀴즈·뱅크롤·거래내역·복기 노트는 단일 JSON을 갱신합니다. 모든 기능이 같은 저장·오프라인 동작을 갖는다고 가정하지 않습니다.
- 에쿼티 화면은 필요 에쿼티 계산기입니다. 카드 대 레인지 계산은 구현된 기능으로 설명하지 않습니다.
- `docs/superpowers/`의 계획과 상세 문서의 과거 검증 수치는 이력입니다. 현재 구현 여부와 검증 결과를 코드 및 이번 실행으로 확인합니다.

## 검증

기능 변경에는 `npm test`, `npm run lint`, `npm run build`를 실행합니다. 플랍 변환기 변경에는 Python unittest도 실행합니다. 문서 변경은 링크·경로·명령·코드 대조와 `git diff --check`로 검증합니다. 세부 데이터 의미와 저장 계약은 `AGENTS.md`에 모아 관리합니다.
