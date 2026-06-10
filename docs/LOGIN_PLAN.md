# 로그인 + 사용자별 데이터 저장 설계

GTO 프리플랍 차트 앱에 **구글 OAuth 로그인**과 **사용자별 퀴즈 기록 저장**을 추가한다.
서버는 **Vercel Functions**, 저장소는 **Vercel Blob**(DB 미사용, 파일 기반)을 쓴다.

## 결정 사항 (확정)

| 항목 | 선택 | 비고 |
|---|---|---|
| 서버 | Vercel Functions (Node.js 서버리스) | `/api` 디렉터리 |
| 로그인 제공자 | **구글** 단일 | 이메일 불필요, `sub`만 식별자로 사용 |
| OAuth 구현 | **직접 구현(hand-rolled)** + PKCE(S256) | `arctic` 미사용 — 의존성/버전 리스크 최소화 |
| 세션 | JWT(HS256) in **httpOnly 쿠키** | `jose`로 서명/검증, 30일 |
| 저장소 | **Vercel Blob**, 유저당 `users/{sub}/records.json` 단일 파일 | 읽기 → 병합 → 덮어쓰기 |
| 동시성 | **lost-update 감수** | "한 유저가 동시에 안 씀" 전제 |
| 배포 | **Vercel 단일** | GitHub Pages는 `/api`를 못 돌려 로그인 불가 → 주 배포에서 제외 |

## 아키텍처

```
[Vite SPA]
   │  "구글로 로그인" 클릭
   ▼
GET /api/auth/google           → state·code_verifier(PKCE) 쿠키 발급 → 구글 동의화면으로 302
GET /api/auth/google/callback  → code 교환(서버에서 client_secret 사용) → id_token에서 sub 추출
                                 → 세션 JWT를 httpOnly 쿠키로 set → "/"로 302
GET /api/auth/me               → 쿠키 검증 → { authenticated, user } 반환 (없으면 401)
POST /api/auth/logout          → 세션 쿠키 제거

GET  /api/records              → users/{sub}/records.json 읽어서 반환 (없으면 빈 배열)
POST /api/records              → { records, mode } 받아 기존과 병합(timestamp 기준 dedup) 후 덮어쓰기
                                 mode='replace'면 통째로 교체 (초기화/가져오기용)
```

핵심 규칙:
- **client_secret / JWT_SECRET은 서버 환경변수에만** — 프론트 번들에 절대 없음.
- **Blob 경로의 `{sub}`는 반드시 세션에서 추출** — 클라이언트 입력값으로 경로를 만들지 않음.

## 데이터 모델

기존 퀴즈 기록(`QuizRecord[]`, `src/types.ts`)을 그대로 저장한다.
각 레코드의 `timestamp`(ms)를 **병합 dedup 키**로 사용 (기존 `importRecords`와 동일한 의미론).

```jsonc
// users/{sub}/records.json
[
  { "question": { ... }, "userAnswer": "raise", "correct": true, "timestamp": 1733800000000 },
  ...
]
```

## 동기화 전략 (오프라인 우선 + 서버 병합)

localStorage(`holdem_quiz_records`)를 **로컬 작업 저장소**로 유지하고 서버와 양방향 동기화한다.

- **로그인 직후**: `syncQuizRecords()` — 로컬을 서버에 POST(merge) → 서버가 병합한 합집합을 받아 로컬 갱신. (양쪽 합쳐짐)
- **문제 풀이 후**: 새 레코드를 `pushQuizRecords([record])`로 fire-and-forget 전송 (서버에서 merge).
- **기록 초기화**: 로컬 비우고 `mode='replace'`로 빈 배열 전송.
- **기록 가져오기**: 로컬 병합 후 전체를 push.

모든 동기화 호출은 실패해도 UX를 막지 않도록 `.catch(()=>{})`로 무시한다 (오프라인/로컬 dev 대응).

## 파일 목록

신규 (`/api`):
- `api/_lib/session.ts` — JWT 서명/검증, 쿠키 파싱/직렬화, `getSessionUser`
- `api/_lib/google.ts` — PKCE 생성, authorize URL, code 교환, id_token 디코드
- `api/auth/google.ts` — 로그인 시작(302)
- `api/auth/google/callback.ts` — 콜백 처리
- `api/auth/me.ts` — 현재 세션 조회
- `api/auth/logout.ts` — 로그아웃
- `api/records.ts` — 기록 GET/POST(병합)

신규 (프론트):
- `src/components/LoginGate.tsx` — 구글 로그인 화면
- `src/utils/recordsSync.ts` — 동기화 헬퍼

수정:
- `src/hooks/useAuth.ts` — 비밀번호 게이트 → 서버 세션 기반
- `src/App.tsx` — LoginGate, 로그인 후 동기화, 헤더에 유저/로그아웃
- `src/pages/QuizPage.tsx` — 정답 제출 후 push
- `src/pages/QuizStatsPage.tsx` — 초기화/가져오기 시 서버 반영
- `src/utils/quiz.ts` — `replaceQuizRecords` 추가
- `src/env.d.ts` — 미사용 `VITE_PASSWORD_HASH` 제거
- `vercel.json` — SPA rewrite가 `/api`를 삼키지 않도록 제외

삭제:
- `src/components/PasswordGate.tsx`

## 환경변수 (Vercel 대시보드)

| 변수 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | 구글 OAuth 클라이언트 시크릿 |
| `JWT_SECRET` | 세션 JWT 서명키 (랜덤 32바이트+ 권장) |
| `GOOGLE_REDIRECT_URI` | (선택) 콜백 URL 고정. 미설정 시 요청 호스트로부터 자동 유도 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 스토어 연결 시 자동 주입 |

## 구글 클라우드 콘솔 설정 (수동, 1회)

1. https://console.cloud.google.com → 프로젝트 생성/선택
2. **APIs & Services → OAuth consent screen** 구성 (External, 앱 이름, 테스트 사용자 등록)
3. **Credentials → Create Credentials → OAuth client ID → Web application**
4. **Authorized redirect URIs**에 추가:
   - 운영: `https://<당신의-vercel-도메인>/api/auth/google/callback`
   - 로컬: `http://localhost:3000/api/auth/google/callback` (`vercel dev` 기준)
5. 발급된 Client ID / Secret을 Vercel 환경변수에 등록

## Vercel 설정

1. **Storage → Create → Blob** 스토어 생성 후 프로젝트에 연결 (→ `BLOB_READ_WRITE_TOKEN` 자동 주입)
2. 환경변수 등록 (위 표)
3. `npm i` 시 추가되는 의존성: `jose`, `@vercel/blob`, `@vercel/node`(types)

## 로컬 개발

`npm run dev`(vite)는 `/api` 함수를 실행하지 않는다. 인증·동기화를 로컬에서 테스트하려면:

```bash
npm i -g vercel   # 최초 1회
vercel dev        # http://localhost:3000 에서 프론트 + /api 함수 동시 구동
```

`vercel dev` 없이 `npm run dev`로 띄우면 `/api/auth/me`가 404 → 로그인 화면이 계속 표시된다(정상).

## 보안 노트 / 한계

- **Blob URL은 공개 모델**: 경로가 고정(`users/{sub}/records.json`)이라 sub를 알면 URL 추측 가능. 퀴즈 기록은 민감도가 낮아 일단 허용. 민감해지면 경로에 유저별 시크릿을 섞거나 비공개 스토어로 전환.
- **lost-update**: 같은 유저가 두 기기/탭에서 동시에 쓰면 한쪽 갱신이 덮어써질 수 있음 (전제상 허용).
- **id_token 검증**: 토큰 엔드포인트와의 직접 TLS 통신으로 받은 값이라 서명 재검증 없이 payload를 디코드해 `sub`만 사용 (표준적으로 허용되는 범위).
