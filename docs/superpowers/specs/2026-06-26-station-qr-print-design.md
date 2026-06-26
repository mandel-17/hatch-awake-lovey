# 설계 — 스테이션 QR 이미지 생성/인쇄

> 깨!(KKAE) 앱의 F 잔여 #1. 미션별 스테이션 코드를 QR로 생성해 A4로 인쇄, 각 스테이션에 게시한다. handoff.md §2 F · SPEC.md §8 참조.

작성일: 2026-06-26

## 1. 목적 · 배경

각 미션 스테이션에 게시할 **QR 코드**를 관리자 화면에서 생성·인쇄한다. 리더가 폰으로 스캔하면 미션 코드가 자동 입력되어 보고가 빨라진다.

현재 상태:
- 관리자 "🏁 스테이션 코드" 패널([admin.js:58](../../../public/views/admin.js))은 미션명·코드(문자열)·코인만 표시. `(인쇄용 QR 생성은 추후)` 노트가 있다.
- 리더 스캐너([leader.js:13](../../../public/views/leader.js) `extractCode`)는 `?scan=W-OX` URL이면 쿼리를 파싱하고, 아니면 원문을 코드로 쓴다. → QR에 URL을 담아도, 코드만 담아도 앱 내 스캔은 동작.
- QR **생성** 라이브러리는 없다(스캔용 `html5-qrcode`만 vendor에 있음). CDN 차단 환경이라 vendor에 단일 파일로 추가해야 한다(handoff §3).

## 2. 확정된 결정

1. **QR 내용 = 전체 URL** `` `${location.origin}/?scan=<CODE>` ``. 앱 내 스캐너(extractCode가 파싱)와 추후 딥링크 양쪽 지원. origin이 운영 도메인이면 자동 반영.
2. **인쇄 레이아웃 = 스테이션당 풀페이지**. 미션 1개 = A4 1장(월드·미션명·대형 QR·코드·코인·안내). 멀리서 스캔, 벽 게시 최적. 총 11장.
3. **폰 기본 카메라 딥링크 자동보고 = 이번 스코프 제외**. 주 사용은 앱 내 카메라 스캔. URL을 QR에 담아두므로 추후 `boot()`에 `?scan=` 처리만 추가하면 확장 가능(YAGNI).
4. **QR 생성 라이브러리 = 의존성 0 단일 파일 생성기**(예: `qrcode-generator`, MIT). `public/vendor/qrcode.min.js`로 벤더링, **SVG 출력**(인쇄 시 벡터=선명). UMD 전역으로 노출(`html5-qrcode`와 동일 패턴).

## 3. 설계

변경 범위를 최소화하고 코인 쓰기 경로(함수·규칙·보안)는 건드리지 않는다.

### 3.1 QR 생성 라이브러리 벤더링
- `public/vendor/qrcode.min.js` 신규. npm 패키지에서 단일 파일 복사(의존성 0). 구현 시 npm 가용성 확인 후 `qrcode-generator`(권장) 또는 node-qrcode 브라우저 빌드 선택.
- `index.html`에 `<script src="vendor/qrcode.min.js"></script>` 추가(`html5-qrcode` 옆, app.js 모듈 로드 전).
- API 사용 예(qrcode-generator): `qrcode(0,'M')` 생성 → `addData(url)` → `make()` → `createSvgTag({cellSize, margin})`가 SVG 문자열 반환 → 컨테이너에 삽입. 삽입값은 라이브러리 출력 SVG(신뢰), 미션명 등 데이터 문자열은 기존 `esc()` 경유.

### 3.2 코드↔URL 변환을 `shared.js`로 일원화 (테스트 가능성)
- `extractCode()`를 [leader.js](../../../public/views/leader.js)에서 **`public/views/shared.js`로 이동·export**. leader.js는 shared에서 import.
- `shared.js`에 **`scanUrl(code, origin)`** 추가·export: `` `${origin}/?scan=${encodeURIComponent(code)}` ``. `origin` 기본값은 `location?.origin`(Node 테스트에선 인자로 주입).
- 근거: 두 함수가 round-trip 쌍이고 순수 변환이라 공용 모듈에 두면 단위 테스트로 회귀를 잠근다. leader.js의 스캐너 로직은 그대로.

### 3.3 관리자 "스테이션 코드" 패널 ([admin.js](../../../public/views/admin.js))
- `mount()` 마크업: 패널 상단 노트를 **"🖨 인쇄용 QR 시트" 버튼**으로 교체. 문서 끝에 `<div class="qr-sheet" data-print-sheet></div>` 추가(화면에선 CSS `.qr-sheet{display:none}`로 숨김 — `hidden` 속성보다 specificity 함정 없음). 인쇄 핸들러는 `replaceChildren()`+`insertAdjacentHTML`로 주입(보안 훅의 `innerHTML` 토큰 차단 회피, 기능 동일).
- `refresh()`의 `data-codes` 렌더(미션 카드): 각 카드에 **작은 QR 썸네일(~64px)** 인라인 추가 — 화면에서 즉시 확인·테스트용. 기존 1회 렌더 가드(`children.length === 0`) 유지.
- 버튼 핸들러: `state.missions`로 `.qr-page` 페이지들 생성 → `data-print-sheet`에 주입 → `window.print()`.

### 3.4 인쇄 시트 (스테이션당 A4 1장)
- 각 미션 = `<section class="qr-page">`: 월드 라벨 · 미션명(대형) · **대형 QR(~7–8cm)** · 코드 문자열(모노, 크게) · 코인 · 안내문("이 QR을 스캔하거나 코드를 입력해 보고하세요").
- `.qr-page { page-break-after: always }`로 1미션=1장.
- 한 문서 내 처리(팝업 새 창 없음 → 팝업 차단·이중 SDK 회피).

### 3.5 인쇄 스타일 ([styles.css](../../../public/styles.css))
- `@media print`: 화면 UI 숨기고 `.qr-sheet`만 표시(`.app`·토스트·아웃박스 뱃지 `display:none`, `.qr-sheet{display:block}`).
- 화면 기본: `.qr-sheet{display:none}`으로 숨김(`@media print`에서 `display:block`).
- QR은 흑백(검정 모듈/흰 배경) 고정 → 흑백 프린터에서도 스캔 보장. 카드 장식은 기존 토큰(`--space` 테두리, Do Hyeon, `--star` 코인색) 재사용. 색 인쇄가 필요한 요소엔 `print-color-adjust: exact`.

## 4. 검증

- **단위 테스트** `tests/qr.test.js`(node --test): `scanUrl(code, origin)` → `extractCode()` **round-trip**으로 원래 코드 복원. 코드에 특수문자/공백이 없어도 `encodeURIComponent` 경로 확인. `package.json` `test:unit`에 파일 추가(`node --test tests/outbox.test.js tests/qr.test.js`).
- **브라우저 검증**: 관리자 화면에서 (a) 미션 카드 QR 썸네일 렌더, (b) "인쇄용 QR 시트" → 인쇄 미리보기에 11장·페이지 분리 확인, (c) **생성된 QR을 리더 스캐너(html5-qrcode)로 스캔 → 정확한 코드가 보고되는지**(핵심 round-trip 회귀).
- **회귀**: `npm test`(단위+규칙+함수) 그대로 통과. 함수·규칙 무변경.

## 5. 변경 파일

| 파일 | 변경 |
|---|---|
| `public/vendor/qrcode.min.js` | 신규(벤더링) |
| `public/index.html` | `<script>` 1줄 |
| `public/views/shared.js` | `scanUrl`·`extractCode` 추가·export |
| `public/views/leader.js` | `extractCode` 내부 정의 제거 → shared import |
| `public/views/admin.js` | 인쇄 버튼·QR 썸네일·인쇄 시트 생성 |
| `public/styles.css` | `.qr-sheet`/`.qr-page` + `@media print` |
| `tests/qr.test.js` | 신규(round-trip 단위 테스트) |
| `package.json` | `test:unit`에 qr.test.js 추가 |

## 6. 스코프 밖 (이번 작업 아님)

- 폰 기본 카메라 딥링크 자동보고(`boot()`의 `?scan=` 처리) — 결정 3.
- clear 진짜 취소 — F 잔여 #2, 별도.
- 실 배포 — DEPLOY.md, 별도.

## 7. 리스크 · 미해결

- **npm registry 가용성**: vendor 라이브러리 1파일을 받아야 함. 막히면 동등한 의존성-0 생성기로 대체.
- **`location.origin`**: 호스팅 서빙이라 `http(s)://host` 형태 보장. 운영 도메인에서 인쇄해야 QR에 운영 주소가 박힘(에뮬레이터에서 인쇄하면 `127.0.0.1:5000`이 박히니, **인쇄는 배포 후** 권장 — 런북 메모).
- **흑백 인쇄**: QR 자체는 항상 흑백이라 스캔 무관. 장식색만 회색조로 나올 수 있음(기능 영향 없음).
