// 팀 리더(L) 화면 — 우리 팀 홈 + 미션 보고(QR 스캔/코드 입력) + 체크리스트.
import { topbarHTML } from "./shared.js";

let scanner = null;

function setScanButtons(scanning) {
  const start = document.getElementById("scan-start");
  const stop = document.getElementById("scan-stop");
  if (start) start.classList.toggle("hidden", scanning);
  if (stop) stop.classList.toggle("hidden", !scanning);
}

function extractCode(text) {
  // ?scan=W-OX 링크면 쿼리 파싱, 아니면 원문.
  try {
    const u = new URL(text);
    const q = u.searchParams.get("scan");
    if (q) return q;
  } catch (_) {}
  return text;
}

async function report(code, ctx) {
  const c = (code || "").trim().toUpperCase();
  if (!c) { ctx.toast("코드를 입력하세요.", "err"); return; }
  try {
    const d = await ctx.reportClear(ctx.state.myTeamId, c);
    ctx.toast(`✅ ${c} · +${d.coins} 코인!`, "ok");
  } catch (e) {
    if (e?.queued) ctx.toast(`📡 오프라인 — ${c} 저장됨, 연결되면 자동 전송`, "info", 3800);
    else ctx.toast(ctx.mapErr(e), "err");
  }
}

async function startScan(ctx) {
  const Html5Qrcode = window.Html5Qrcode;
  if (!Html5Qrcode) { ctx.toast("스캐너를 불러오지 못했습니다.", "err"); return; }
  scanner = new Html5Qrcode("reader");
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async (decoded) => {
        await stopScan();
        await report(extractCode(decoded), ctx);
      },
      () => {}
    );
    setScanButtons(true);
  } catch (e) {
    scanner = null;
    ctx.toast("카메라를 사용할 수 없습니다. 아래에 코드를 입력해 보고하세요.", "err");
  }
}

async function stopScan() {
  if (scanner) {
    try { await scanner.stop(); scanner.clear(); } catch (_) {}
    scanner = null;
  }
  setScanButtons(false);
}

export function mount(root, ctx) {
  root.innerHTML =
    topbarHTML("leader") +
    `<div data-communal></div>
     <div class="panel soft"><span class="lbl">우리 팀</span><div data-teamcard></div></div>
     <div class="panel">
       <h2>📡 미션 보고</h2>
       <div class="scan-hint">스테이션의 QR을 스캔하거나 코드를 입력하세요.</div>
       <div id="reader"></div>
       <div class="row" style="justify-content:center;margin-bottom:12px">
         <button class="btn btn-leaf" id="scan-start">📷 카메라 스캔</button>
         <button class="btn btn-ink hidden" id="scan-stop">스캔 중지</button>
       </div>
       <label class="field">코드 직접 입력
         <input id="code-in" class="code-input" placeholder="예: W-OX" autocomplete="off" />
       </label>
       <button class="btn btn-coin btn-block btn-lg" id="report-btn">보고하기</button>
     </div>
     <div class="panel"><h2>🗺️ 미션 체크리스트</h2><div data-checklist></div></div>
     <div class="panel"><h2>🏆 리더보드</h2><div data-leaderboard></div></div>`;

  root.querySelector("[data-leave]").addEventListener("click", async () => { await stopScan(); ctx.leave(); });
  root.querySelector("#scan-start").addEventListener("click", () => startScan(ctx));
  root.querySelector("#scan-stop").addEventListener("click", stopScan);
  const input = root.querySelector("#code-in");
  root.querySelector("#report-btn").addEventListener("click", async () => {
    await report(input.value, ctx);
    input.value = "";
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") root.querySelector("#report-btn").click(); });
}
