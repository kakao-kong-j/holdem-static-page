# 에이전트 작업 지침

이 문서는 저장소 전체에 적용되는 공통 작업 안내입니다. 사용자 설명과 작업 결과는 한국어를 기본으로 하고, 실행·환경 설정은 [README.md](README.md)를 참고합니다.

## 작업 시작과 범위

- 먼저 `git status --short`와 관련 코드를 확인합니다. 기존 수정 파일, 미추적 데이터, 다른 작업의 산출물을 덮어쓰거나 정리하지 않습니다.
- 독립 기능을 별도 워크트리로 요청받으면 `.worktrees/` 아래에서 분리합니다. 새 브랜치의 기본 접두사는 `feature/`입니다.
- pull/rebase 전에 추적·미추적 파일과 유입 파일의 충돌을 확인합니다. 덮어쓰기 오류를 `reset --hard`나 `clean`으로 해결하지 않습니다.
- 과거 `docs/superpowers/` 계획을 현재 구현으로 단정하지 않습니다. 명령은 `package.json`, 메뉴는 `src/app/viewRegistry.tsx`, 암호화 대상은 `scripts/charts-crypto.mjs`가 기준입니다.

## 구조와 구현 규칙

- React + TypeScript + Vite + Tailwind CSS 앱입니다. 라우터 없이 `App.tsx`의 상태와 `viewRegistry.tsx`로 화면을 전환합니다.
- 화면은 `src/pages/`, 공통 UI는 `src/components/`, 데이터 모델·검색은 `src/data/`, 계산·파서·동기화는 `src/utils/`에 둡니다.
- API와 프런트엔드가 공유하는 검증·중복 처리 계약은 `shared/`를 사용합니다. Vercel API 내부의 로컬 모듈 import는 기존 `.js` 확장자 패턴을 따릅니다.
- 공개 차트 JSON은 런타임 fetch로 읽습니다. 테스트에는 가능한 합성 데이터를 사용하며 민감한 원본을 fixture로 커밋하지 않습니다.
- 차트 그리드는 기존 커스텀 컴포넌트를 사용합니다. 단순 문서·UI 수정에 새 라이브러리를 추가하지 않습니다.

## 차트 의미 보존

- 기본 GTO 데이터는 `data[stackSize][chartName][action] = string[]` 구조입니다. 미포함 핸드는 fold로 처리하며, 169 핸드 클래스의 콤보 합은 1,326입니다.
- Open Range는 UTG부터 BTN까지를 집계하고 SB/BB를 제외합니다. SB Open은 현재 네 스택 모두 선택 가능하며, 단순 SB RFI보다 BvB 차트의 액션 종류가 많으면 BvB를 사용합니다.
- 15BB의 일반형 `RFI vs Allin` 상대 확장, 100BB의 value/bluff 구분과 `scenarioMap.ts`의 도달 가능 차트 필터를 유지합니다. 예전 문서의 차트 개수·콤보 합계를 검증 없이 고정하지 않습니다.
- Bencb는 원본 데이터와 조회 인덱스를 분리합니다. `unmarked`를 fold로 바꾸거나 `label: null`인 범례를 추측하지 않습니다. 혼합 비율은 이미지 색상 폭 추정값입니다.
- Bencb 검색은 모든 검색어를 포함하는 방식입니다. 통합 스택의 표시 문구와 `15bb`·`20bb` 등의 검색 토큰을 분리합니다. 차트 숨기기는 그리드만 숨기며 인접 정보·검색·이동 상태를 유지합니다.
- 플랍 C-bet은 보드별 사이즈 하나와 빈도 하나입니다. all-in을 100% 팟으로 바꾸지 않습니다. 목록 평균은 단순 평균이며 직접 보드 조회 결과와 분리합니다.
- 유사 보드 추천은 `src/data/flopBoardMatch.ts`의 결정적 휴리스틱입니다. 실제 카드와 다르면 `추측 기반`으로 표시하고 참고 보드의 값을 입력 보드의 계산 결과로 표현하지 않습니다. 텍스처 매핑·변환 규칙은 [상세 문서](docs/flop-cbet-data.md)를 따릅니다.

## 저장과 인증 계약

- 서버는 `getSessionUser`로 인증하고 검증된 계정 식별자로 Blob 경로를 만듭니다. 클라이언트의 사용자 ID를 저장 경로로 신뢰하지 않습니다.
- `VITE_LOCAL_AUTH_BYPASS=1`은 개발 모드 프런트엔드에만 적용합니다. API 인증을 우회하거나 프로덕션에서 활성화하지 않습니다.
- 퀴즈는 localStorage와 `/api/records`를 동기화하며 timestamp로 병합합니다. 서버 전용 기능의 실패를 로컬 저장 성공으로 표시하지 않습니다.
- CoinPoker는 Cash / Tournament를 나눠 `shared/coinpokerHands.ts`의 `selectNewHands`로 handId 중복을 제거합니다. 기존 핸드와 첫 신규 항목을 보존합니다.
- CoinPoker 업로드는 전체 JSON 요청의 UTF-8 크기로 최대 3 MiB씩 순차 전송합니다. POST `{ hands }`의 응답은 `{ added }`이며 실제 신규 저장 수입니다. 서버의 불변 청크 저장과 클라이언트 전송 배치는 서로 다른 단위입니다.
- 뱅크롤 필터는 공유 세션 목록에 적용해 기록·합계·차트·통계가 같은 모집단을 사용하게 합니다. 새틀라이트는 티켓 수령 여부만으로 분류하지 않습니다.
- 동일 세션 ID 재수입 시 금액은 갱신하지만 컨디션은 보존합니다. Cash / Tournament의 ID 공간을 분리합니다. 서버 컨디션 수정은 최신 세션의 해당 필드만 갱신합니다.
- 복기 노트는 게임 종류와 handId로 식별되는 독립 원문 스냅샷입니다. 재저장으로 기존 메모를 덮어쓰지 않으며 원본 핸드 삭제와 노트 삭제를 연결하지 않습니다. 읽기·저장 실패를 성공으로 처리하지 않습니다.
- Blob은 현재 public access이며 단일 파일 덮어쓰기에는 동시 수정 충돌 가능성이 있습니다. API 인증을 Blob 자체의 비공개 접근 제어로 설명하지 않습니다.

## 데이터와 비밀값

- `.env.local`, 키, 토큰, 실제 사용자 기록을 커밋하거나 로그에 출력하지 않습니다. `VITE_` 변수는 브라우저에 노출되므로 비밀값을 넣지 않습니다.
- 차트 평문 5개와 `output/bencb-preflop/*.json`은 Git 제외 대상입니다. `.gitignore`를 유지하고 암호화본만 커밋합니다.
- `npm run encrypt`와 `npm run decrypt`에는 셸 환경변수 `DATA_KEY`와 OpenSSL이 필요합니다. `.env.local` 자동 로드를 가정하지 않습니다.
- `public/`에 복호화한 차트는 배포 시 정적 공개 자산이 됩니다. 변환 전용 텍스처 매핑은 `scripts/data/`에 유지합니다.
- 데이터 변환은 원본·스키마·보드 충돌·빈도 단위를 확인합니다. 사용자가 지정한 JSON 필드와 값은 정확히 유지합니다.

## 검증과 완료 보고

기능 변경은 관련 테스트와 다음 검증을 실행합니다.

```sh
npm test
npm run lint
npm run build
```

플랍 변환기·매핑을 변경했다면 추가로 실행합니다.

```sh
python3 -m unittest discover -s scripts -p 'test_convert_flop_cbet.py'
```

- 문서만 변경했을 때는 파일 경로·명령·구현과의 일치, Markdown 링크, `git diff --check`를 확인합니다. 불필요한 새 테스트는 만들지 않습니다.
- `npm test`는 Vitest와 Node 암복호화 테스트를 포함합니다. Python 테스트와 인증된 저장 검증은 별도입니다.
- UI 변경은 관련 상태 전환, 빈 결과·오류, 모바일 레이아웃을 확인합니다. 실제 저장 검증은 `vercel dev` 또는 인증된 Vercel 환경이 필요합니다.
- 빌드 성공과 데이터 복호화 성공, 배포 성공과 계정 저장 성공을 구분합니다. 실행하지 않은 검증을 통과했다고 보고하지 않습니다.
- 완료 시 변경 내용, 검증 결과, 남은 제약을 간결하게 설명합니다. 기존 저장 데이터가 필요로 하는 재수입·마이그레이션 여부를 코드 변경과 구분합니다.
