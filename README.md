# Holdem 학습 · 기록 도구

한국어 UI로 프리플랍 레인지와 플랍 C-bet 전략을 조회하고, 퀴즈·CoinPoker 핸드 분석·뱅크롤을 관리하는 웹 앱입니다. React 19, TypeScript, Vite 8, Tailwind CSS 4를 사용하며, Google 로그인과 계정별 저장은 Vercel Functions 및 Vercel Blob으로 처리합니다.

## 주요 기능

| 메뉴 | 제공 기능 |
| --- | --- |
| Open Range / SB Open / Facing Charts | 15·25·40·100BB 프리플랍 13×13 차트, 포지션별 오픈과 상대 액션 대응 |
| Bencb 프리플랍 | 전략 → 내 포지션 → 상대/구도 → 스택 → 추가 조건 필터, 복합 검색, 차트 숨기기, JSON 보기·다운로드 |
| 플랍 C-bet | 상황·상대 성향·스택·포지션별 빈도와 사이즈, 텍스처, 원본 미리보기, 직접 보드 조회와 유사 보드 참고 |
| 캐시 핸드레인지 | 캐시 프리플랍 차트의 액션별 빈도 조회 |
| 퀴즈 / 통계 | 차트 기반 연습, 정답률·취약점·오답 복습 |
| CoinPoker 분석 | 핸드 히스토리 가져오기, Cash / Tournament 분리, 프리플랍 비교, 캐시 레인지 분석, 복기 노트 |
| 뱅크롤 | 캐시·토너먼트 기록과 손익 추이, 새틀라이트 필터·티켓 상금, 세션 컨디션 기록 |
| 거래내역 | 입출금·이체 기록과 잔액 추이 |
| 에쿼티 계산기 | 팟과 베팅액으로 콜에 필요한 에쿼티·팟오즈 계산, 직접 입력한 에쿼티와 비교 |

에쿼티 계산기는 카드 대 레인지 승률을 계산하지 않습니다. 플랍의 유사 보드 결과는 참고 보드의 원본 전략을 표시하는 휴리스틱이며, 입력 보드를 새로 푼 솔버 결과가 아닙니다.

## 로컬 실행

Node.js 22.12 이상과 npm, `openssl`이 필요합니다. 현재 Vite의 Node 요구 범위는 `^20.19.0 || >=22.12.0`입니다. 플랍 데이터 변환·변환기 테스트에는 Python 3도 사용합니다.

```sh
npm ci
```

### 화면 개발

`.env.example`을 참고해 `.env.local`을 만들고 아래 값을 설정합니다. 기존 `.env.local`이 있으면 필요한 항목만 추가합니다.

```dotenv
VITE_LOCAL_AUTH_BYPASS=1
```

승인된 차트 키를 셸 환경변수 `DATA_KEY`로 설정한 터미널에서 실행합니다. 키 자체를 코드나 문서에 기록하지 않습니다.

```sh
npm run decrypt
npm run dev
```

- `encrypt` / `decrypt`는 `.env.local`을 자동으로 읽지 않습니다.
- 인증 우회는 Vite 개발 모드에서만 적용됩니다. 프로덕션 빌드에는 적용되지 않습니다.
- 앱 진입에는 기본 GTO 평문 JSON이 필요합니다. 각 추가 차트 메뉴에도 해당 평문 데이터가 필요합니다.
- 일반 Vite 서버에는 `/api`가 없습니다. 인증 우회는 서버 저장을 제공하지 않으므로 계정 저장 기능은 아래 환경에서 확인합니다.

### 로그인 · 서버 저장 개발

Vercel CLI를 준비하고 프로젝트와 Blob 저장소를 연결한 뒤, `.env.example`의 서버 환경변수를 설정합니다. 실제 인증을 확인할 때는 `VITE_LOCAL_AUTH_BYPASS`를 끄거나 제거합니다.

```sh
npm run dev:vercel
```

Google OAuth 클라이언트에 개발 서버의 `/api/auth/google/callback` 주소를 리디렉션 URI로 등록합니다. 인증은 페이지 비밀번호 확인 → Google OAuth(PKCE) → httpOnly 쿠키의 JWT 세션 순서입니다.

| 환경변수 | 용도 |
| --- | --- |
| `DATA_KEY` | 차트 암복호화 및 Vercel 빌드 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 |
| `JWT_SECRET` | 세션 JWT 서명 |
| `PAGE_PASSWORD_HASH` | Google 로그인 전 확인하는 공용 비밀번호의 SHA-256 hex |
| `GOOGLE_REDIRECT_URI` | 선택 사항. 미설정 시 요청 호스트로 콜백 주소 구성 |
| `BLOB_READ_WRITE_TOKEN` | Blob 접근. 배포에서는 연결된 저장소가 주입하며 로컬에서는 별도 설정 |
| `VITE_LOCAL_AUTH_BYPASS` | `1`일 때 개발 모드의 프런트엔드 인증 우회 |
| `COINPOKER_SHARD_SIZE` | 선택 사항. CoinPoker 서버 저장 청크당 핸드 수, 기본 10,000 |

## 명령어와 검증

```sh
npm test             # Vitest + Node 암복호화 테스트
npm run lint         # ESLint
npm run build        # TypeScript 검사 + dist/ 생성
npm run preview      # 정적 빌드 미리보기 (/api 제공 안 함)
```

```sh
npm run test:watch   # Vitest 감시 모드 (Node 암복호화 테스트 제외)
python3 -m unittest discover -s scripts -p 'test_convert_flop_cbet.py'
```

`npm run build`는 복호화를 수행하지 않습니다. 빌드 성공만으로 차트 파일 준비나 로그인·서버 저장 성공이 검증되지는 않습니다. Python 변환기 테스트는 `npm test`와 별도로 실행합니다.

## 차트 데이터와 배포

Git에는 다음 파일의 `.enc` 암호화본을 보관합니다. 평문은 Git에서 제외합니다.

| 복호화 경로 | 사용처 |
| --- | --- |
| `public/gto-preflop-charts-all.json` | 기본 토너먼트 프리플랍 차트·퀴즈 |
| `public/gto-cache-preflop-chart.json` | 캐시 레인지·캐시 핸드 분석 |
| `public/bencb-preflop-charts.json` | Bencb 프리플랍 |
| `public/tournament-flop-cbet.json` | 플랍 C-bet |
| `scripts/data/flop-board-textures.json` | 플랍 변환기의 텍스처 매핑, 정적 배포 대상 아님 |

```sh
npm run encrypt       # 평문 5개 검증 후 암호화본 갱신
npm run decrypt       # 암호화본 5개 복호화 및 JSON 검증
npm run build:vercel  # decrypt 후 build
```

변환 스크립트는 OpenSSL AES-256-CBC / PBKDF2를 사용합니다. 모든 입력의 변환·JSON 검증이 끝난 뒤 각 파일을 교체하므로 변환 실패 시 기존 출력은 보존됩니다. 여러 파일의 최종 교체 전체가 하나의 트랜잭션인 것은 아닙니다.

Vercel 설정은 `vercel.json`에 있으며 `npm run build:vercel`로 `dist/`를 배포합니다. 인증·저장에 `/api`가 필요하므로 GitHub Pages는 지원 배포 대상이 아닙니다. 암호화는 Git 보관을 위한 처리입니다. 복호화된 `public/` JSON은 정적 자산으로 배포되며 로그인 화면이 파일 자체의 접근을 제한하지 않습니다.

## 계정 데이터 저장

API는 로그인한 Google 계정으로 저장 경로를 구분합니다. 퀴즈는 localStorage와 서버를 동기화하고, CoinPoker는 Cash / Tournament별 새 청크를 추가합니다. 뱅크롤·거래내역·복기 노트는 계정별 JSON 파일을 갱신합니다.

동일 토너먼트 ID를 다시 가져오면 금액 필드는 덮어쓰고 컨디션 기록은 유지합니다. CoinPoker 복기 노트는 핸드 원문을 별도로 저장하므로 업로드 기록을 지워도 남습니다. 배포만으로 기존에 저장된 데이터가 다시 계산되거나 재수입되지는 않습니다.

현재 Blob 저장은 `access: 'public'`입니다. API 인증과 별개로 Blob URL을 아는 사람은 해당 파일을 읽을 수 있습니다. 단일 JSON을 덮어쓰는 저장 기능에는 여러 탭·기기의 동시 수정 충돌 해결이 없습니다.

## 코드와 상세 문서

- `src/app/viewRegistry.tsx`: 메뉴·화면 등록. 별도 라우터 없이 상태로 화면 전환
- `src/pages/`, `src/components/`: 화면과 UI
- `src/data/`, `src/utils/`, `shared/`: 차트 처리, 계산·동기화, 클라이언트/API 공통 계약
- `api/`: 인증과 계정 데이터 API
- `scripts/`: 차트 암복호화·플랍 변환 도구

[에이전트 작업 지침](AGENTS.md) · [Claude Code 안내](CLAUDE.md) · [로그인 설정](docs/LOGIN_PLAN.md) · [Bencb 데이터](docs/bencb-preflop.md) · [플랍 C-bet 데이터](docs/flop-cbet-data.md) · [복기 노트](docs/HAND_REVIEW_NOTEBOOK.md) · [컨디션 기록](docs/SESSION_CONDITION_JOURNAL.md) · [Blob 접근 검토](docs/security/blob-privacy-review.md)

상세 문서의 과거 검증 수치·설계 계획은 작성 시점의 기록입니다. 현재 명령과 데이터 파일 목록은 `package.json`, `scripts/charts-crypto.mjs`, 실제 구현을 기준으로 확인합니다.
