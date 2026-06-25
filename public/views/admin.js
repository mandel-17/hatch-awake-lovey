// 관리자(A) 화면 — 라이브 대시보드 + 코인 입력/가감 + 설정/부화 + 스테이션 코드.
import { topbarHTML, fmt, esc } from "./shared.js";

function timeStr(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "—";
    return d.toLocaleTimeString("ko-KR", { hour12: false });
  } catch (_) { return "—"; }
}

export function mount(root, ctx) {
  root.innerHTML =
    topbarHTML("admin") +
    `<div data-communal></div>

     <div class="panel">
       <h2>⚙️ 설정 · 클라이맥스</h2>
       <div class="row">
         <button class="btn" id="toggle-btn">팀 직접 보고: …</button>
         <button class="btn btn-red btn-lg" id="hatch-btn" disabled>🥚 부화</button>
       </div>
       <div class="note" style="margin-top:10px">부화는 공동 합산이 목표에 도달해야 활성화됩니다.</div>
     </div>

     <div class="panel">
       <h2>📣 푸시 발송</h2>
       <div class="row">
         <button class="btn btn-leaf" id="push-gather">집결 알림</button>
         <button class="btn btn-leaf" id="push-progress">중간 집계</button>
       </div>
       <label class="field" style="margin-top:10px">제목<input id="push-title" placeholder="알림 제목" autocomplete="off" /></label>
       <label class="field">내용<input id="push-body" placeholder="알림 내용" autocomplete="off" /></label>
       <button class="btn btn-ink btn-block" id="push-send">전체에게 보내기</button>
       <div class="note" style="margin-top:8px">전체(event_all) 토픽으로 발송됩니다. 실 배포 환경에서만 실제 전송됩니다.</div>
     </div>

     <div class="panel">
       <h2>🪙 코인 입력 (대리 보고)</h2>
       <label class="field">팀<select id="m-team"></select></label>
       <label class="field">미션<select id="m-mission"></select></label>
       <button class="btn btn-coin btn-block" id="m-report">클리어 적립</button>
       <hr style="border:none;border-top:2px dashed rgba(20,34,77,.15);margin:16px 0" />
       <span class="lbl">수동 가감 (감사 기록됨)</span>
       <div class="row tight">
         <select id="a-team" style="flex:1;min-width:120px"></select>
         <input id="a-amount" type="number" placeholder="±코인" style="width:110px" />
       </div>
       <label class="field" style="margin-top:8px">사유<input id="a-reason" placeholder="예: 보정/취소" /></label>
       <button class="btn btn-ink btn-block" id="a-adjust">가감 적용</button>
     </div>

     <div class="panel"><h2>🏆 리더보드</h2><div data-leaderboard></div></div>
     <div class="panel"><h2>🧾 최근 적립 로그</h2><div class="log" data-log></div></div>
     <div class="panel"><h2>🏁 스테이션 코드</h2>
       <div class="note" style="margin-bottom:10px">각 스테이션에 코드를 게시하세요. (인쇄용 QR 생성은 추후)</div>
       <div data-codes></div>
     </div>`;

  root.querySelector("[data-leave]").addEventListener("click", ctx.leave);

  root.querySelector("#toggle-btn").addEventListener("click", async () => {
    const cur = !!ctx.state.event?.allowLeaderSubmit;
    try { await ctx.call("setConfig", { allowLeaderSubmit: !cur }); ctx.toast("설정을 변경했습니다.", "ok"); }
    catch (e) { ctx.toast(ctx.mapErr(e), "err"); }
  });

  root.querySelector("#hatch-btn").addEventListener("click", async () => {
    try {
      const d = await ctx.call("triggerHatch", {});
      ctx.toast(d.already ? "이미 부화했습니다." : "🐣 부화 트리거!", "ok");
    } catch (e) { ctx.toast(ctx.mapErr(e), "err"); }
  });

  async function sendPush(title, body) {
    if (!title || !body) { ctx.toast("제목과 내용을 입력하세요.", "err"); return; }
    try {
      await ctx.call("notify", { topic: "event_all", title, body });
      ctx.toast("📣 푸시를 발송했습니다.", "ok");
    } catch (e) { ctx.toast(ctx.mapErr(e), "err"); }
  }
  root.querySelector("#push-gather").addEventListener("click", () =>
    sendPush("📣 집결!", "모두 본부로 모여주세요."));
  root.querySelector("#push-progress").addEventListener("click", () => {
    const total = ctx.state.event?.total ?? 0;
    const goal = ctx.state.event?.goal ?? 10000;
    sendPush("📊 중간 집계", `현재 ${fmt(total)} / ${fmt(goal)} 코인! 함께 알을 깨요.`);
  });
  root.querySelector("#push-send").addEventListener("click", () =>
    sendPush(
      root.querySelector("#push-title").value.trim(),
      root.querySelector("#push-body").value.trim()
    ));

  root.querySelector("#m-report").addEventListener("click", async () => {
    const teamId = root.querySelector("#m-team").value;
    const code = root.querySelector("#m-mission").value;
    if (!teamId || !code) { ctx.toast("팀과 미션을 선택하세요.", "err"); return; }
    try { const d = await ctx.call("submitClear", { teamId, missionCode: code }); ctx.toast(`+${d.coins} 코인 적립`, "ok"); }
    catch (e) { ctx.toast(ctx.mapErr(e), "err"); }
  });

  root.querySelector("#a-adjust").addEventListener("click", async () => {
    const teamId = root.querySelector("#a-team").value;
    const amount = Number(root.querySelector("#a-amount").value);
    const reason = root.querySelector("#a-reason").value.trim();
    if (!teamId || !amount) { ctx.toast("팀과 금액을 입력하세요.", "err"); return; }
    try {
      await ctx.call("adminAdjust", { teamId, amount, reason });
      ctx.toast(`${amount > 0 ? "+" : ""}${amount} 적용`, "ok");
      root.querySelector("#a-amount").value = ""; root.querySelector("#a-reason").value = "";
    } catch (e) { ctx.toast(ctx.mapErr(e), "err"); }
  });
}

function fillTeamSelect(sel, teams) {
  if (!sel || sel.options.length === teams.length || !teams.length) return;
  sel.innerHTML = teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
}

export function refresh(ctx) {
  const ev = ctx.state.event || {};
  const goal = ev.goal ?? 10000;
  const total = ev.total ?? 0;

  // 설정 버튼
  const toggle = document.getElementById("toggle-btn");
  if (toggle) toggle.textContent = ev.allowLeaderSubmit
    ? "팀 직접 보고: 켜짐(A) → 끄기"
    : "팀 직접 보고: 꺼짐(B) → 켜기";

  const hatch = document.getElementById("hatch-btn");
  if (hatch) {
    const can = total >= goal && !ev.hatched;
    hatch.disabled = !can;
    hatch.textContent = ev.hatched ? "✨ 부화 완료" : can ? "🥚 부화 트리거!" : `🥚 부화 (남은 ${fmt(goal - total)})`;
  }

  // 셀렉트 채우기 (팀 순서는 coins desc지만 이름으로 표시)
  const teamsById = [...ctx.state.teams].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  fillTeamSelect(document.getElementById("m-team"), teamsById);
  fillTeamSelect(document.getElementById("a-team"), teamsById);

  const mSel = document.getElementById("m-mission");
  if (mSel && mSel.options.length === 0 && ctx.state.missions.length) {
    mSel.innerHTML = ctx.state.missions
      .map((m) => `<option value="${esc(m.code)}">${esc(m.name)} (${fmt(m.coins)})</option>`)
      .join("");
  }

  // 로그
  const log = document.querySelector("[data-log]");
  if (log) {
    const tName = new Map(ctx.state.teams.map((t) => [t.id, t.name]));
    const mName = new Map(ctx.state.missions.map((m) => [m.id, m.name]));
    const rows = ctx.state.recentClears;
    log.innerHTML = rows && rows.length
      ? rows.map((c) => {
          const neg = (c.amount || 0) < 0;
          const label = c.missionId ? (mName.get(c.missionId) || c.missionId) : (c.reason || "수동 가감");
          return `<div class="li">
            <span class="t">${timeStr(c.ts)}</span>
            <span>${esc(tName.get(c.teamId) || c.teamId)} · ${esc(label)} <span style="color:var(--ink-soft)">(${esc(c.byName || c.by || "")})</span></span>
            <span class="amt ${neg ? "neg" : ""}">${neg ? "" : "+"}${fmt(c.amount)}</span>
          </div>`;
        }).join("")
      : `<div class="note">아직 적립 기록이 없습니다.</div>`;
  }

  // 스테이션 코드
  const codes = document.querySelector("[data-codes]");
  if (codes && codes.children.length === 0 && ctx.state.missions.length) {
    codes.innerHTML = ctx.state.missions.map((m) => `<div class="mission">
      <div class="mn">${esc(m.name)}</div>
      <div class="mc" style="font-size:14px;font-weight:800;color:var(--space)">${esc(m.code)}</div>
      <div class="coin">${fmt(m.coins)}</div>
    </div>`).join("");
  }
}
