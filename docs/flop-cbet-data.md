# 플랍 C-bet 데이터

앱의 **플랍 C-bet** 메뉴에서 토너먼트 플랍 전략을 조회한다. 트레이너는 포함하지 않는다.

## 생성된 파일

- 평문: `public/tournament-flop-cbet.json` — 로컬 조회와 다운로드용, Git 제외
- 변환기: `scripts/convert_flop_cbet.py` — Python 표준 라이브러리만 사용
- 화면: `src/pages/FlopCbetPage.tsx`
- 스키마 검증·필터·요약: `src/data/flopCbet.ts`

원본 XLSX의 숨김 DATA 시트 7개에서 **7,938행 / 49보드 / 162상황**을 추출했다. 각 상황에 49보드가 존재한다. 현재 선택값만 담긴 화면 시트의 수식 캐시나 그래프 색상에서 전략을 역산하지 않았다.

원본 파일 SHA256: `721244492842430df302220951e969390eab9eda18b95bdcd1e746a3be841055`

## JSON v1

최상위 필드는 `schema_version`, `source`, `boards`, `records`, `corrections`다. 생성 일시는 넣지 않아 동일 원본에서 동일 바이트를 재생성할 수 있다.

`boards`의 카드는 `As`, `Kh`처럼 랭크·수트 코드로 보존한다. 원본 보드 순서도 유지한다.

각 전략 행:

```json
{
  "spot": "srp-ip",
  "profile": "GTO",
  "stack_bb": 50,
  "hero": "BTN",
  "villain": "BB",
  "action": "cbet",
  "board_id": "AsKs3h",
  "size": { "kind": "pot", "pct": 25 },
  "frequency_pct": 99.7,
  "source": { "sheet": "DATA_SRP", "row": 3, "url": null }
}
```

위 예시의 URL은 생략했다. 실제 JSON에는 해당 빈도 셀에 연결된 원본 Google Drive 링크가 출처로 보존되어 있다. 조회 행과 직접 보드 조회의 원본 버튼은 `public/flop-cbet-images.json`에서 해당 Drive 파일 ID에 연결된 Vercel Blob URL을 찾아 이미지를 직접 표시한다. 브라우저는 Drive 미리보기를 요청하지 않는다. 닫기 버튼, 모달 바깥 클릭, Esc로 닫으며 이미지 로딩·오류·재시도를 표시한다. 이미지 목록이나 이미지 요청이 실패해도 전략 조회는 유지된다.

- `spot`: `srp-ip`, `srp-oop`, `blind-war`, `3bp-oop`, `3bp-ip`, `4bp-oop`, `4bp-ip`
- `profile`: `GTO`, `Calling Station`, `Maniac`
- `stack_bb`: 20, 35, 50. 4BP는 50만 존재한다.
- `action`: `cbet` 또는 Blind War의 BB vs SB에 해당하는 `stab`
- `size`: 팟 대비 사이즈 `{ "kind": "pot", "pct": 25 }` 또는 `{ "kind": "all-in" }`. 올인을 100% 팟 베팅으로 치환하지 않는다.
- `frequency_pct`: 0–100 사이의 베팅 빈도. 예를 들어 99.7은 99.7%다.

현재 데이터는 각 보드에 사이즈 하나와 빈도 하나를 담고 있다. 여러 사이즈의 혼합 전략이나 전체 핸드별 전략으로 확장하지 않는다. 조회 평균은 검색 결과에 포함된 보드들의 단순 평균이다. 사이즈별 평균은 해당 사이즈가 지정된 보드만 대상으로 한다. 플랍 발생 확률로 가중하지 않는다.

## 원본 이미지 이전

`scripts/migrate-flop-images.mjs`는 복호화된 전략 JSON의 모든 프로필에서 이미지 ID를 중복 제거하고, 원본 바이트를 public Vercel Blob의 `flop-cbet/<Drive 파일 ID>`에 저장한다. 확장자는 붙이지 않고 PNG/JPEG/GIF/WebP의 파일 시그니처로 Content-Type을 지정한다. HTML 권한 안내나 20 MiB 초과 응답은 거부한다. public Blob 이미지는 URL을 아는 사람이 로그인 없이 접근할 수 있다.

**전체 실행 전에 Vercel 대시보드의 저장 공간과 Advanced Operations 잔여량을 확인한다.** 현재 원본은 7,935개 파일이고, 3,146개 표본의 원본 크기는 1,036,673,861바이트다. 전체 크기는 약 2.6GB로 추정되며 업로드 횟수도 약 8천 회 필요하다. [Vercel Blob 사용량 안내](https://vercel.com/docs/vercel-blob/usage-and-pricing)의 Hobby 포함량(저장 1GB, Advanced Operations 2,000회)을 넘는다. 동일 저장소를 쓰는 기존 기록 기능도 한도 초과의 영향을 받을 수 있으므로, 필요한 한도 확보와 저장소 접근 확인 후 실행한다. 파일 삭제만으로 정지가 즉시 풀린다고 가정하지 않는다.

```sh
# 기존 프로젝트 환경을 별도 로컬 파일로 가져온다. 키 값을 출력하거나 커밋하지 않는다.
vercel env pull .env.migration.local --environment=production

# 평문 차트가 없는 새 체크아웃
node --env-file=.env.migration.local scripts/charts-crypto.mjs decrypt

# 일부 업로드로 먼저 확인 (최종 이미지 목록은 아직 교체하지 않음)
node --env-file=.env.migration.local scripts/migrate-flop-images.mjs --limit=3

# 전체 이전. 중단된 경우 같은 명령으로 재개한다.
node --env-file=.env.migration.local scripts/migrate-flop-images.mjs
```

Node.js 22 이상, 네트워크 접근과 `BLOB_READ_WRITE_TOKEN`이 필요하다. 복호화에는 추가로 `DATA_KEY`와 OpenSSL이 필요하다. 환경변수를 이미 셸에 설정했다면 `npm run migrate:flop-images`도 사용할 수 있다. 기본 동시 작업은 4개이며 `--concurrency=1`부터 `8`까지 지정할 수 있다.

이미 존재하는 동일 경로의 Blob은 메타데이터를 확인해 재사용하며 덮어쓰거나 삭제하지 않는다. 새 업로드는 응답 크기·형식을 Blob 메타데이터와 대조한다. 검증 완료 기록은 Git 제외 경로 `output/flop-cbet-images/progress.local`에 누적한다. 완료 기록이 없는 기존 Blob은 원본을 다시 내려받아 크기·형식을 검증하므로, 이전 실행의 검증 실패를 재실행으로 건너뛰지 않는다. 실패 또는 부분 실행에서는 기존 `public/flop-cbet-images.json`을 유지하고, 전체 파일 검증이 성공했을 때만 파일 ID → URL 목록을 원자적으로 교체한다. 실패가 20개 쌓이거나 저장소 정지 오류를 받으면 추가 작업을 멈춘다. 이미 업로드한 파일은 다음 실행에서 재사용한다. 원본 Drive 파일이 같은 ID에서 수정된 경우 자동 갱신하지 않는다.

생성된 이미지 목록은 전략 값·비밀키를 포함하지 않으며 Git에 포함해 배포한다. 이미지 자체는 Blob에만 보관한다. 기존 전략 JSON, 암호화본 5개, 변환기는 변경하지 않으므로 차트 재변환이나 사용자 기록 재수입이 필요 없다. Vercel 배포에는 생성된 목록과 새 화면 코드가 함께 포함돼야 한다.


## 숫자 표기 수정

| 원본 셀 | 원문 | 정규화 |
| --- | --- | --- |
| DATA_BvB!H2 | `89,6` | 89.6 |
| DATA_BvB!H188 | `46,3` | 46.3 |
| DATA_3BPOOP!H1429 | `99.9.` | 99.9 |

수정은 JSON의 `corrections`에도 기록한다. 다른 비정상 빈도, 범위 초과, 중복 전략 키, 중복 카드, 잘못된 사이즈는 실패 처리하며 기존 출력 파일을 덮어쓰지 않는다.

## 재생성

저장소 루트에서 실행한다. 첨부 원본 파일은 수정하지 않는다.

```bash
# DATA_KEY를 셸에 설정한 상태에서 실행 (값을 코드나 명령 기록에 적지 않음)
npm run decrypt
python3 scripts/convert_flop_cbet.py \
  '/Users/hongjinho/Downloads/Tournament Flop C-bet Master POGO의 사본.xlsx' \
  public/tournament-flop-cbet.json
```

```bash
python3 -m unittest discover -s scripts -p 'test_convert_flop_cbet.py'
npm test
npm run lint
npm run build
```

변환기는 XLSX의 ZIP/XML을 읽는다. 실제 원본 검증은 별도로 openpyxl을 사용해 모든 행의 프로필·스택·포지션·보드·사이즈·빈도·링크를 대조했고 모두 일치했다. UI는 기본 상황, 의존 필터 변경, 검색·정렬·초기화, Stab/ALL-IN, 오류 후 재시도를 합성 데이터로 검증한다.

## 암호화 상태

기존 차트와 동일하게 `public/tournament-flop-cbet.json.enc`를 보관하고 배포 시 복호화한다. 기존 배포용 DATA_KEY로 새 암호화 파일을 생성했다. 기존 차트 암호화 파일은 변경하지 않았다. `scripts/data/flop-board-textures.json.enc`도 같은 키로 보관하며 `npm run encrypt/decrypt`의 대상에 포함한다. 평문 매핑은 Git에서 제외하며 public 디렉터리에 복호화하지 않는다.

평문 데이터가 없는 깨끗한 Git 체크아웃에서 `npm run build:vercel`을 실행해 다섯 파일의 복호화 및 빌드를 검증했다. 복호화된 다섯 JSON 모두 로컬 원본과 바이트 단위로 일치했다. 키는 승인된 임시 환경변수 로드로만 사용했고, 환경변수 파일·복호화 파일·검증 체크아웃은 작업 후 삭제했다. 키를 코드·JSON·문서·커밋에 기록해서는 안 된다.

## Board Texture 태그

2026-09-13에 [30bb BTN vs BB 원본 시트](https://docs.google.com/spreadsheets/d/1atu97MBP2P_ZtY8MgBnkXStJoDn_qteoMF9GMUIKZtE/edit?gid=0#gid=0)의 A–C 카드와 F `Board Texture`를 화면에서 대조했습니다. 다운로드/사본 만들기 제한을 유지한 채 필요한 49개 대응 행만 조회했습니다.

`scripts/data/flop-board-textures.json.enc`의 복호화 결과는 대상 보드, 실제 원본 카드, 행 번호, 원문 태그를 보관합니다. 변환기는 모든 무늬 치환을 비교해 숫자와 무늬 관계가 같은지 검증하고 `boards[].textures`를 추가합니다. 카드 순서와 무늬 이름은 무시하지만 투톤의 어느 카드가 같은 무늬인지, 레인보우/모노톤 관계는 유지합니다. 미등록 보드는 추측하지 않고 빈 배열로 둡니다. 기존 변환 명령을 그대로 사용하면 태그도 재생성됩니다.

현재 49/49개 보드에 태그가 있고, 각 보드를 참조하는 7,938개 전략에 공통으로 표시됩니다. 시트의 30BB 베팅 빈도는 가져오지 않습니다. 기존 XLSX의 빈도/사이즈/프로필은 그대로이며 태그 명칭도 번역하거나 재분류하지 않았습니다. 예: `9s8s3h` → `Low unconnected`, `Ts7h6d` → `J/T connected`.

## 직접 보드 조회와 추측

`asjs7s`, `ts9h2d` 형식으로 세 장을 입력할 수 있습니다. 대소문자, 공백, 무늬 기호를 허용하고 중복 카드는 거부합니다. 카드 순서만 다른 경우는 실제 목록으로 취급합니다. 현재 선택한 상황에 존재하는 전략만 후보로 사용합니다.

매칭 순서는 실제 카드 일치 → 같은 텍스처 후보 중 무늬 변경 → 상위 두 숫자를 유지한 최저 카드 변경 → 같은 텍스처의 가장 가까운 보드입니다. 최저 카드 규칙은 입력/후보 모두 두 번째 카드와 5 이상 차이 나는 경우만 적용합니다. A 포함 시 일괄 제외하던 조건은 제거했습니다.

입력 텍스처는 카드 숫자에서 규칙으로 분류합니다. Trips/Paired를 먼저 판별하고 A 하이는 ABB/ABx/Axy, A 없는 브로드웨이 세 장은 BBB, 두 장은 2 Broadway, K/Q 하이+낮은 두 장은 K/Q + 2입니다. J/T 및 9 이하 보드는 최고-최저 숫자 차이가 4 이하이면 connected로 분류합니다. 등록 보드 49개의 원문 태그와 모두 일치하는 것을 검증했지만 전체 Google 시트 행과의 대조는 수행하지 않았습니다. 무늬는 텍스처 태그와 별도로 거리 계산에 사용합니다.

텍스처 후보의 거리는 페어 위치 차이 → 카드 사이 무늬 관계 차이 → 최고 숫자 차이 → 인접 숫자 간격 차이 합 → 숫자 차이 합 → 실제 무늬 변경 개수 → 보드 ID 순으로 비교합니다. 이는 이 앱에서 정한 결정적 휴리스틱이며 솔버가 검증한 전략 거리 또는 신뢰도가 아닙니다. 후보의 원문 태그가 입력 분류와 같은 경우에만 추천합니다. Trips처럼 등록 후보가 없는 분류는 미매칭으로 남깁니다.

직접 입력 결과는 기존 목록 검색 및 평균과 분리합니다. 무늬 이름만 달라도 실제 카드가 다르면 `추측 기반`으로 표시합니다. 입력 텍스처는 `규칙 분류`로, 참고 태그는 원본 값으로 구분합니다. 참고 보드/변경 카드/적용 단계와 참고 보드의 빈도·사이즈를 표시하며 입력 보드의 계산값으로 취급하지 않습니다.

예: `ts9h2d` → `Ts7h5d` (J/T + 2), `qs7h2d` → `Qs7h3d` (K/Q + 2), `as9h2d` → `As9h3d` (Axy). `asahad`는 Trips 후보가 없어 미매칭입니다.

분류 참고: 원본 Google 시트와 Gareth James의 [12개 보드 분류를 사용하는 설명](https://www.mttpokerschool.com/single-post/otb-079-should-you-ever-slow-play-a-flopped-set), [무늬 구조를 별도로 비교하는 설명](https://www.mttpokerschool.com/single-post/otb-078-4-strategy-changes-you-need-to-make-when-playing-against-the-small-blind). 이 자료의 베팅 수치는 이 앱에 가져오지 않았습니다.

매핑이 없는 새 체크아웃에서는 `npm run decrypt`를 먼저 실행한다. 변환기는 평문이 없으면 복호화 안내와 함께 중단한다. 테스트는 `--textures`로 합성 매핑을 주입하므로 비밀키나 실제 매핑 없이 실행할 수 있다. PR 브랜치는 평문 매핑 파일을 포함했던 커밋을 대체했다. 이미 공유된 구 커밋·GitHub 캐시·외부 복제본의 삭제까지 보장하지 않는다.
