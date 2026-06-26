# 스테이션 QR 생성/인쇄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 화면에서 미션별 스테이션 QR(내용 = `${origin}/?scan=<CODE>`)을 생성·인쇄(스테이션당 A4 1장)한다.

**Architecture:** 코드↔URL 변환을 `shared.js`에 순수 함수로 모아 단위 테스트로 round-trip을 잠근다(`scanUrl`/`extractCode`). 의존성-0 단일 파일 QR 생성기(`qrcode-generator`)를 `vendor/`에 추가하고 `<script>`로 UMD 전역(`window.qrcode`)을 노출, admin 화면이 SVG QR을 렌더한다. 인쇄는 한 문서 내 숨김 시트 + `@media print`로 처리(팝업 없음). 코인 쓰기 경로(Functions·rules)는 무변경.

**Tech Stack:** 바닐라 ESM(프레임워크 없음), `qrcode-generator@2.0.4`(MIT, SVG 출력), `node --test`(단위), Firebase 에뮬레이터(브라우저 검증).

**참조 스펙:** `docs/superpowers/specs/2026-06-26-station-qr-print-design.md`

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `public/views/shared.js` | 공용 순수 변환·렌더. `scanUrl`/`extractCode` 추가 | 수정 |
| `public/views/leader.js` | 리더 스캐너. 로컬 `extractCode` 제거 → shared import | 수정 |
| `tests/qr.test.js` | `scanUrl`↔`extractCode` round-trip 단위 테스트 | 신규 |
| `package.json` | `test:unit`에 qr.test.js 추가 | 수정 |
| `public/vendor/qrcode-generator.js` | 벤더링된 QR 생성기(UMD 전역 `qrcode`) | 신규 |
| `public/index.html` | 생성기 `<script>` 로드 | 수정 |
| `public/views/admin.js` | `qrSvg` 헬퍼·미션 카드 썸네일·인쇄 버튼·인쇄 시트 | 수정 |
| `public/styles.css` | `.qr-thumb`/`.qr-sheet`/`.qr-page` + `@media print` | 수정 |

---

## Task 1: `scanUrl` + `extractCode` 공용화 (TDD, 순수 로직)

**Files:**
- Create: `tests/qr.test.js`
- Modify: `public/views/shared.js`, `public/views/leader.js`, `package.json`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/qr.test.js`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { scanUrl, extractCode } from "../public/views/shared.js";

test("scanUrl: origin+code로 ?scan= URL 생성", () => {
  assert.equal(scanUrl("W-OX", "https://kkae.example"), "https://kkae.example/?scan=W-OX");
});

test("extractCode: ?scan= URL에서 코드 추출", () => {
  assert.equal(extractCode("https://kkae.example/?scan=W-OX"), "W-OX");
});

test("scanUrl → extractCode round-trip (시드 코드 전부)", () => {
  const codes = ["W-MEM","W-OX","W-MIX","W-DRAW","W-CROSS","P-LYR","P-INT","A-BODY","A-CURL","A-TONE","PR-CARD"];
  for (const code of codes) {
    assert.equal(extractCode(scanUrl(code, "https://h")), code);
  }
});

test("extractCode: URL이 아니면 원문 그대로(앱 내 코드 입력)", () => {
  assert.equal(extractCode("W-OX"), "W-OX");
});

test("scanUrl: 특수문자 percent-encoding round-trip", () => {
  const u = scanUrl("A B", "https://h");
  assert.equal(u, "https://h/?scan=A%20B");
  assert.equal(extractCode(u), "A B");
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test tests/qr.test.js`
Expected: FAIL — `SyntaxError: The requested module '../public/views/shared.js' does not provide an export named 'scanUrl'`

- [ ] **Step 3: `shared.js`에 두 함수 추가·export**

`public/views/shared.js`의 `fmt` 함수 정의(12번째 줄 `}` 직후)와 `const ROLE_LABEL` 줄 사이에 삽입:

```js
// 스테이션 QR ↔ 스캔 코드 변환 (round-trip 쌍). leader 스캐너·admin QR 생성이 공유한다.
export function scanUrl(code, origin = (typeof location !== "undefined" ? location.origin : "")) {
  return `${origin}/?scan=${encodeURIComponent(code)}`;
}
export function extractCode(text) {
  // ?scan=W-OX 링크면 쿼리 파싱, 아니면 원문.
  try {
    const u = new URL(text);
    const q = u.searchParams.get("scan");
    if (q) return q;
  } catch (_) {}
  return text;
}
```

- [ ] **Step 4: `leader.js` 로컬 `extractCode` 제거 → shared import**

`public/views/leader.js` 2번째 줄을 교체:

```js
// 변경 전
import { topbarHTML } from "./shared.js";
// 변경 후
import { topbarHTML, extractCode } from "./shared.js";
```

그리고 같은 파일의 로컬 정의(현재 13–21번째 줄) 전체 삭제:

```js
function extractCode(text) {
  // ?scan=W-OX 링크면 쿼리 파싱, 아니면 원문.
  try {
    const u = new URL(text);
    const q = u.searchParams.get("scan");
    if (q) return q;
  } catch (_) {}
  return text;
}
```

- [ ] **Step 5: `package.json` `test:unit`에 qr.test.js 추가**

```json
"test:unit": "node --test tests/outbox.test.js tests/qr.test.js",
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `node --test tests/qr.test.js`
Expected: PASS — 5 tests, 0 fail
Run: `npm run test:unit`
Expected: PASS — outbox 8 + qr 5 = 13 tests

- [ ] **Step 7: 커밋**

```bash
git add public/views/shared.js public/views/leader.js tests/qr.test.js package.json
git commit -m "feat: scanUrl/extractCode 공용화 + round-trip 단위 테스트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: QR 생성기 벤더링 + 로드

**Files:**
- Create: `public/vendor/qrcode-generator.js`
- Modify: `public/index.html`

- [ ] **Step 1: npm에서 받아 단일 파일 복사**

Run (worktree 루트에서):

```bash
WT="$(pwd)"; cd /tmp && rm -rf qrgen && mkdir qrgen && cd qrgen \
  && npm pack qrcode-generator@2.0.4 >/dev/null \
  && tar -xzf qrcode-generator-2.0.4.tgz \
  && cp package/dist/qrcode.js "$WT/public/vendor/qrcode-generator.js" \
  && cd "$WT" && rm -rf /tmp/qrgen
```

- [ ] **Step 2: 자체완결·전역 노출 확인**

Run:
```bash
grep -cE "require\(|^import " public/vendor/qrcode-generator.js   # 0 이어야 함(자체완결)
grep -c "var qrcode = function" public/vendor/qrcode-generator.js  # 1+ (최상위 var → <script> 시 window.qrcode)
```
Expected: 첫 줄 `0`, 둘째 줄 `1` 이상.

- [ ] **Step 3: `index.html`에 `<script>` 추가**

`public/index.html`의 `<script src="vendor/html5-qrcode.min.js"></script>` 줄(현재 25번째 줄) 바로 다음에 삽입:

```html
  <!-- QR 생성 (UMD 전역 qrcode). 벤더링됨. -->
  <script src="vendor/qrcode-generator.js"></script>
```

(반드시 `<script type="module" src="app.js">` 보다 위 — classic script가 module보다 먼저 실행되어 전역이 준비됨)

- [ ] **Step 4: 커밋**

```bash
git add public/vendor/qrcode-generator.js public/index.html
git commit -m "feat: qrcode-generator 벤더링 + index.html 로드(window.qrcode)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 관리자 QR 썸네일 · 인쇄 버튼 · 인쇄 시트

**Files:**
- Modify: `public/views/admin.js`

- [ ] **Step 1: import에 `scanUrl` 추가**

`public/views/admin.js` 2번째 줄 교체:

```js
// 변경 전
import { topbarHTML, fmt, esc } from "./shared.js";
// 변경 후
import { topbarHTML, fmt, esc, scanUrl } from "./shared.js";
```

- [ ] **Step 2: `qrSvg` 헬퍼 + 인쇄 시트 빌더 추가**

`public/views/admin.js`의 `timeStr` 함수 정의 직후(현재 10번째 줄 `}` 다음)에 삽입:

```js
// 코드 → QR SVG 문자열. window.qrcode(UMD, 벤더링) 사용. 미로드 시 빈 문자열(코드 텍스트로 폴백).
function qrSvg(code) {
  const make = (typeof window !== "undefined") && window.qrcode;
  if (!make) return "";
  try {
    const qr = make(0, "M");
    qr.addData(scanUrl(code));
    qr.make();
    // scalable: viewBox만 출력 → 크기는 CSS(.qr-thumb/.qp-qr)가 제어. margin=16(=4모듈 quiet zone).
    return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  } catch (_) { return ""; }
}

// 인쇄 시트: 미션 1개 = .qr-page 1장(월드·미션명·대형 QR·코드·코인·안내).
function printSheetHTML(missions) {
  return missions.map((m) => `<section class="qr-page">
    <div class="qp-world">${esc(m.world)}</div>
    <div class="qp-name">${esc(m.name)}</div>
    <div class="qp-qr">${qrSvg(m.code)}</div>
    <div class="qp-code">${esc(m.code)}</div>
    <div class="qp-coin">${fmt(m.coins)} 코인</div>
    <div class="qp-hint">이 QR을 스캔하거나 코드를 입력해 보고하세요</div>
  </section>`).join("");
}
```

- [ ] **Step 3: "스테이션 코드" 패널 마크업 교체 + 인쇄 시트 컨테이너 추가**

`mount()` 내 innerHTML에서 현재 스테이션 코드 패널(58–61번째 줄):

```js
     <div class="panel"><h2>🏁 스테이션 코드</h2>
       <div class="note" style="margin-bottom:10px">각 스테이션에 코드를 게시하세요. (인쇄용 QR 생성은 추후)</div>
       <div data-codes></div>
     </div>`;
```

를 다음으로 교체(마지막 패널이므로 닫는 백틱 위치 유지, 시트 컨테이너를 패널 뒤에 추가):

```js
     <div class="panel"><h2>🏁 스테이션 코드</h2>
       <div class="row" style="margin-bottom:10px">
         <button class="btn btn-ink" id="print-qr">🖨 인쇄용 QR 시트</button>
       </div>
       <div class="note" style="margin-bottom:10px">각 스테이션에 게시하세요. QR을 스캔하거나 코드를 입력해 보고합니다.</div>
       <div data-codes></div>
     </div>
     <div class="qr-sheet" data-print-sheet></div>`;
```

- [ ] **Step 4: 인쇄 버튼 핸들러 배선**

`mount()` 내 핸들러 배선부에 추가(예: `#projector-btn` 핸들러 다음 줄, 현재 78번째 줄 뒤):

```js
  root.querySelector("#print-qr").addEventListener("click", () => {
    const sheet = root.querySelector("[data-print-sheet]");
    sheet.innerHTML = printSheetHTML(ctx.state.missions);
    window.print();
  });
```

- [ ] **Step 5: 미션 카드에 QR 썸네일 추가**

`refresh()`의 `data-codes` 렌더(현재 177–183번째 줄):

```js
  if (codes && codes.children.length === 0 && ctx.state.missions.length) {
    codes.innerHTML = ctx.state.missions.map((m) => `<div class="mission">
      <div class="mn">${esc(m.name)}</div>
      <div class="mc" style="font-size:14px;font-weight:800;color:var(--space)">${esc(m.code)}</div>
      <div class="coin">${fmt(m.coins)}</div>
    </div>`).join("");
  }
```

를 다음으로 교체(첫 자식으로 `.qr-thumb` 추가):

```js
  if (codes && codes.children.length === 0 && ctx.state.missions.length) {
    codes.innerHTML = ctx.state.missions.map((m) => `<div class="mission">
      <div class="qr-thumb">${qrSvg(m.code)}</div>
      <div class="mn">${esc(m.name)}</div>
      <div class="mc" style="font-size:14px;font-weight:800;color:var(--space)">${esc(m.code)}</div>
      <div class="coin">${fmt(m.coins)}</div>
    </div>`).join("");
  }
```

- [ ] **Step 6: 구문 점검(로드 확인)**

Run: `node --check public/views/admin.js`
Expected: 에러 없음(종료코드 0). (ESM `import`로 `node --check`가 거부하면 이 단계는 생략하고 Step 7의 브라우저 로드로 확인)

- [ ] **Step 7: 커밋**

```bash
git add public/views/admin.js
git commit -m "feat: 관리자 QR 썸네일·인쇄 버튼·스테이션당 인쇄 시트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 인쇄 스타일 (`@media print` + 시트 레이아웃)

**Files:**
- Modify: `public/styles.css`

- [ ] **Step 1: 썸네일 + 인쇄 시트 + print 미디어쿼리 추가**

`public/styles.css` 맨 끝에 추가:

```css
/* ---- 스테이션 QR (관리자 썸네일) ---- */
.qr-thumb{ width:54px; height:54px; flex:0 0 auto; border:var(--bd) solid var(--space); border-radius:var(--r-sm); background:#fff; padding:3px; }
.qr-thumb svg{ display:block; width:100%; height:100%; }

/* ---- 인쇄용 QR 시트 (스테이션당 A4 1장) ---- */
.qr-sheet{ display:none; }              /* 화면에선 숨김 */
.qr-page{ box-sizing:border-box; }
.qp-world{ font-family:"Press Start 2P",monospace; font-size:14px; color:var(--mario); letter-spacing:1px; }
.qp-name{ font-family:"Do Hyeon",system-ui; font-size:34px; margin:6px 0 14px; }
.qp-qr{ width:80mm; height:80mm; margin:0 auto; }
.qp-qr svg{ display:block; width:100%; height:100%; }
.qp-code{ font-family:"JetBrains Mono",monospace; font-size:40px; font-weight:800; letter-spacing:2px; margin-top:14px; }
.qp-coin{ font-family:"Do Hyeon",system-ui; font-size:24px; color:var(--star-deep); margin-top:4px; }
.qp-hint{ font-size:14px; color:var(--ink-soft); margin-top:18px; }

@media print{
  /* 화면 UI·오버레이 숨기고 인쇄 시트만 */
  .app, #toasts, #outbox-badge, #hatch{ display:none !important; }
  .qr-sheet{ display:block; }
  .qr-page{
    width:100%; min-height:100vh;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; padding:24mm 16mm;
    page-break-after:always; break-after:page;
  }
  .qr-page:last-child{ page-break-after:auto; break-after:auto; }
  /* QR은 흑백 고정이라 무관하지만, 장식색 보존 */
  .qp-world, .qp-coin{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
@page{ size:A4 portrait; margin:0; }
```

- [ ] **Step 2: 커밋**

```bash
git add public/styles.css
git commit -m "feat: QR 썸네일·인쇄 시트 스타일 + @media print(A4 스테이션당 1장)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 검증 (단위 + 브라우저 round-trip + 회귀)

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: 단위 테스트(Task 1에서 통과) 재확인**

Run: `npm run test:unit`
Expected: PASS — 13 tests (outbox 8 + qr 5)

- [ ] **Step 2: 에뮬레이터 + 시드 기동**

Run (별도 터미널, Java 필요 — handoff §4):
```bash
npm run emu      # 에뮬레이터
npm run seed     # 다른 터미널에서 시드
```
Expected: hosting `http://127.0.0.1:5000` 가용. (포트 5000이 AirPlay와 충돌 시 handoff §4 참조)

- [ ] **Step 3: 관리자 화면 — 썸네일 렌더 확인**

브라우저로 `http://127.0.0.1:5000` → 관리자(PIN `KKAE-ADMIN`) 입장 → "🏁 스테이션 코드" 패널.
Expected: 미션 11개 각 카드 좌측에 작은 QR 썸네일 표시. 콘솔에 `typeof window.qrcode` → `"function"`.

- [ ] **Step 4: 인쇄 미리보기 — 스테이션당 1장 확인**

"🖨 인쇄용 QR 시트" 클릭 → 인쇄 미리보기.
Expected: 총 11페이지, 각 페이지에 월드·미션명·대형 QR·코드·코인·안내. 페이지마다 미션 1개로 분리.

- [ ] **Step 5: round-trip 스캔 확인 (핵심)**

화면/미리보기의 QR(예: `W-OX`)을 다른 기기 또는 리더 화면의 "📷 카메라 스캔"으로 스캔.
Expected: `extractCode`가 `W-OX` 추출 → 보고 성공 토스트 `✅ W-OX · +50 코인!`.
(카메라 미가용 시: scanUrl→extractCode 단위 테스트가 문자열 round-trip을 이미 보장 — Step 1.)

- [ ] **Step 6: 회귀 — 전체 테스트**

Run: `npm test`
Expected: PASS — 단위 13 + 규칙 11 + 함수 11. (함수·규칙 무변경이므로 그대로 통과)

- [ ] **Step 7: 문서 갱신 (handoff F 잔여 #1 완료 반영)**

`handoff.md` §2 F의 `A4 스테이션 QR 이미지 생성/인쇄 — 미구현` 항목을 완료로 갱신. 커밋:
```bash
git add handoff.md
git commit -m "docs: handoff F 잔여 #1(스테이션 QR 인쇄) 완료 반영

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (스펙 대조)

- **스펙 커버리지:** 결정1(URL)→Task1 `scanUrl`+Task3 `qrSvg`. 결정2(스테이션당 풀페이지)→Task3 `printSheetHTML`+Task4 `.qr-page`. 결정3(딥링크 제외)→스코프 밖, 미포함. 결정4(의존성0 SVG 생성기)→Task2. §3.2(shared 이동)→Task1. §3.3(썸네일·버튼)→Task3. §3.4(시트)→Task3. §3.5(print CSS)→Task4. §4(검증)→Task1·Task5. 누락 없음.
- **Placeholder:** 없음. 라이브러리·API·경로·줄번호·명령 모두 구체.
- **타입/이름 일관성:** `scanUrl(code, origin)`·`extractCode(text)`·`qrSvg(code)`·`printSheetHTML(missions)`·`[data-print-sheet]`·`.qr-thumb`/`.qr-sheet`/`.qr-page`/`.qp-*`·`#print-qr` — Task 전반 일치. `createSvgTag({cellSize,margin,scalable})`는 v2.0.4에서 검증됨.
- **주의:** 에뮬레이터에서 인쇄하면 QR origin이 `127.0.0.1:5000` — 실 현장 인쇄는 배포 도메인에서(스펙 §7). 앱 내 스캔은 origin 무관.
