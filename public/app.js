// 깨! 클라이언트 오케스트레이터 — 인증·상태·실시간 구독·콜러블·역할 라우팅.
import { auth, db, functions } from "./firebase-init.js";
import {
  signInAnonymously,
  onAuthStateChanged,
} from "./vendor/firebase/firebase-auth.js";
import {
  doc, collection, query, orderBy, where, limit,
  onSnapshot, getDocs,
} from "./vendor/firebase/firebase-firestore.js";
import { httpsCallable } from "./vendor/firebase/firebase-functions.js";
import { communalHTML, leaderboardHTML, checklistHTML, playHatch, esc, fmt } from "./views/shared.js";
import * as adminView from "./views/admin.js";
import * as leaderView from "./views/leader.js";
import * as memberView from "./views/member.js";
import { setupPush } from "./fcm.js";
import { createOutbox } from "./outbox.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const WORLD_ORDER = ["말씀의 땅", "찬양의 하늘", "액션 월드", "기도의 골방"];
const LS = "kkae.session";
const VIEWS = { admin: adminView, leader: leaderView, member: memberView };

const state = {
  uid: null,
  role: null,          // 'admin' | 'leader' | 'member'
  isAdmin: false,
  myTeamId: null,
  myTeamName: null,
  myName: null,
  event: null,
  teams: [],
  missions: [],
  myClears: new Set(),
  recentClears: [],
  hatchPlayed: false,
};

let activeView = null;
let unsubs = [];
let swRegistration = null;

// 포그라운드 푸시 수신 → 토스트
function onPushForeground(title, body) {
  toast(`📣 ${title || "알림"}${body ? " · " + body : ""}`, "info", 4000);
}
// 입장 시 알림 권한/토큰 시도(로컬·미설정 환경에선 null). 입장을 막지 않도록 항상 안전.
function getPushToken() {
  return setupPush(swRegistration, onPushForeground).catch(() => null);
}

// ---- 콜러블 / 토스트 / 에러 ----
const ERR = {
  "functions/already-exists": "이미 깬 미션입니다.",
  "functions/permission-denied": "권한이 없습니다. (본부 입력만 가능한 단계일 수 있어요)",
  "functions/not-found": "코드를 찾을 수 없습니다.",
  "functions/failed-precondition": "아직 조건이 충족되지 않았습니다.",
  "functions/unauthenticated": "로그인이 필요합니다.",
  "functions/invalid-argument": "입력값을 확인하세요.",
};
function mapErr(e) {
  return ERR[e?.code] || e?.message || "오류가 발생했습니다.";
}
async function call(name, data) {
  const res = await httpsCallable(functions, name)(data || {});
  return res.data;
}
function toast(msg, kind = "info", ms = 2600) {
  const wrap = $("#toasts");
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---- 오프라인 아웃박스 (submitClear 재시도) ----
const outbox = createOutbox({ call, onChange: (n) => updateOutboxBadge(n) });
function reportClear(teamId, missionCode) { return outbox.report(teamId, missionCode); }
function updateOutboxBadge(n) {
  const count = typeof n === "number" ? n : outbox.count();
  let el = document.getElementById("outbox-badge");
  if (!el) {
    el = document.createElement("div");
    el.id = "outbox-badge";
    el.style.cssText =
      "position:fixed;left:12px;bottom:12px;z-index:50;background:var(--mario,#E5392C);color:#fff;font-weight:800;padding:8px 12px;border:3px solid var(--space,#14224D);border-radius:10px;box-shadow:4px 4px 0 rgba(20,34,77,1);font-size:13px;max-width:72vw";
    document.body.appendChild(el);
  }
  el.textContent = count > 0 ? `📡 미전송 ${count}건 · 연결되면 자동 전송` : "";
  el.style.display = count > 0 ? "block" : "none";
}
async function flushOutbox() {
  const r = await outbox.flush();
  if (r.sent) toast(`오프라인 보고 ${r.sent}건 자동 전송됨`, "ok");
  return r;
}
window.addEventListener("online", flushOutbox);

function teamCardHTML() {
  const idx = state.teams.findIndex((t) => t.id === state.myTeamId);
  const team = idx >= 0 ? state.teams[idx] : null;
  const rank = idx >= 0 ? idx + 1 : "-";
  return `<div class="teamcard">
    <div class="rank">${rank}위</div>
    <div>
      <div style="font-weight:800">${esc(state.myTeamName || team?.name || "우리 팀")}</div>
      <div class="big">${fmt(team?.coins || 0)} <span style="font-size:14px;color:var(--ink-soft)">코인</span></div>
    </div>
  </div>`;
}

const ctx = { state, call, reportClear, toast, mapErr, leave, teamCardHTML, WORLD_ORDER };

// ---- 렌더 갱신 (스냅샷마다 호출; 정적 구조는 건드리지 않음) ----
function refresh() {
  $$("[data-communal]").forEach((el) => (el.innerHTML = communalHTML(state.event)));
  $$("[data-leaderboard]").forEach((el) => (el.innerHTML = leaderboardHTML(state.teams, state.myTeamId)));
  $$("[data-checklist]").forEach((el) => (el.innerHTML = checklistHTML(state.missions, state.myClears)));
  $$("[data-teamcard]").forEach((el) => (el.innerHTML = teamCardHTML()));
  if (activeView?.refresh) activeView.refresh(ctx);
  if (state.event?.hatched && !state.hatchPlayed) {
    state.hatchPlayed = true;
    playHatch();
  }
}

// ---- 구독 ----
function clearSubs() {
  unsubs.forEach((u) => u());
  unsubs = [];
}
function startSubs() {
  clearSubs();
  unsubs.push(onSnapshot(doc(db, "events", "main"), (s) => {
    state.event = s.data() || null;
    refresh();
  }));
  unsubs.push(onSnapshot(query(collection(db, "teams"), orderBy("coins", "desc")), (s) => {
    state.teams = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    refresh();
  }));
  if (state.myTeamId) {
    unsubs.push(onSnapshot(query(collection(db, "clears"), where("teamId", "==", state.myTeamId)), (s) => {
      state.myClears = new Set(s.docs.map((d) => d.data().missionId));
      refresh();
    }));
  }
  if (state.isAdmin) {
    unsubs.push(onSnapshot(query(collection(db, "clears"), orderBy("ts", "desc"), limit(20)), (s) => {
      state.recentClears = s.docs.map((d) => d.data());
      refresh();
    }));
  }
}

async function loadMissions() {
  const snap = await getDocs(collection(db, "missions"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const wa = WORLD_ORDER.indexOf(a.world), wb = WORLD_ORDER.indexOf(b.world);
    if (wa !== wb) return (wa < 0 ? 99 : wa) - (wb < 0 ? 99 : wb);
    return (b.coins || 0) - (a.coins || 0);
  });
  state.missions = list;
}

// ---- 역할 시작 ----
async function startRole() {
  await loadMissions();
  const view = VIEWS[state.role];
  activeView = view;
  view.mount($("#app"), ctx);
  startSubs();
  refresh();
}

// ---- 입장(엔트리) 화면 ----
function entryScreen() {
  activeView = null;
  clearSubs();
  const root = $("#app");
  root.innerHTML = `
    <div class="entry">
      <div class="hero">
        <span class="star" style="top:18px;left:14%"></span><span class="star" style="top:40px;left:42%"></span><span class="star" style="top:24px;left:74%"></span>
        <h1 class="do">깨<b>!</b></h1>
        <p>잠든 믿음을 깨워라 · 함께 10,000 코인을 모으면 알이 깨집니다</p>
      </div>
      <div id="entry-step"></div>
    </div>`;
  pickRole();
}

function pickRole() {
  $("#entry-step").innerHTML = `
    <div class="panel">
      <span class="lbl">ROLE · 역할 선택</span>
      <div class="role-pick">
        <button class="rb member" data-role="member"><span class="ico">🙌</span>팀원</button>
        <button class="rb leader" data-role="leader"><span class="ico">🚩</span>팀 리더</button>
        <button class="rb admin"  data-role="admin"><span class="ico">🛠</span>관리자</button>
      </div>
    </div>`;
  $$(".rb").forEach((b) => b.addEventListener("click", () => {
    const role = b.dataset.role;
    if (role === "admin") adminForm();
    else joinForm(role);
  }));
}

function joinForm(role) {
  const color = role === "leader" ? "leaf" : "blue";
  $("#entry-step").innerHTML = `
    <div class="panel">
      <span class="lbl">${role === "leader" ? "팀 리더 입장" : "팀원 입장"}</span>
      <label class="field">팀 코드
        <input id="f-code" class="code-input" placeholder="예: TEAM1" autocomplete="off" />
      </label>
      <label class="field">이름
        <input id="f-name" placeholder="이름을 입력하세요" autocomplete="off" />
      </label>
      <div class="row">
        <button class="btn btn-${color} btn-lg" id="f-go">입장하기</button>
        <button class="btn" id="f-back">뒤로</button>
      </div>
    </div>`;
  $("#f-back").addEventListener("click", pickRole);
  $("#f-go").addEventListener("click", async () => {
    const code = $("#f-code").value.trim();
    const name = $("#f-name").value.trim();
    if (!code || !name) { toast("팀 코드와 이름을 입력하세요.", "err"); return; }
    $("#f-go").disabled = true;
    try {
      const fcmToken = await getPushToken();
      const d = await call("joinTeam", { code, name, fcmToken });
      saveSession({ role, teamId: d.teamId, teamName: d.teamName, name, code });
      state.role = role; state.myTeamId = d.teamId; state.myTeamName = d.teamName; state.myName = name;
      toast(`${d.teamName} 입장 완료!`, "ok");
      await startRole();
    } catch (e) {
      $("#f-go").disabled = false;
      toast(mapErr(e), "err");
    }
  });
}

function adminForm() {
  $("#entry-step").innerHTML = `
    <div class="panel">
      <span class="lbl">관리자 입장</span>
      <label class="field">관리자 코드(PIN)
        <input id="a-pin" type="password" placeholder="관리자 코드" autocomplete="off" />
      </label>
      <div class="note" style="margin-bottom:10px">에뮬레이터 기본 코드는 <b class="mono">KKAE-ADMIN</b> 입니다.</div>
      <div class="row">
        <button class="btn btn-red btn-lg" id="a-go">관리자로 시작</button>
        <button class="btn" id="a-back">뒤로</button>
      </div>
    </div>`;
  $("#a-back").addEventListener("click", pickRole);
  $("#a-go").addEventListener("click", async () => {
    const pin = $("#a-pin").value.trim();
    if (!pin) { toast("관리자 코드를 입력하세요.", "err"); return; }
    $("#a-go").disabled = true;
    try {
      await call("setAdmin", { bootstrapCode: pin });
      await auth.currentUser.getIdToken(true); // 클레임 반영
      state.role = "admin"; state.isAdmin = true;
      saveSession({ role: "admin" });
      toast("관리자로 입장했습니다.", "ok");
      await startRole();
    } catch (e) {
      $("#a-go").disabled = false;
      toast(mapErr(e), "err");
    }
  });
}

// ---- 세션 저장/복구 ----
function saveSession(s) { localStorage.setItem(LS, JSON.stringify(s)); }
function loadSession() {
  try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; }
}
function leave() {
  localStorage.removeItem(LS);
  state.role = null; state.isAdmin = false; state.myTeamId = null; state.myTeamName = null;
  state.myClears = new Set(); state.hatchPlayed = false;
  entryScreen();
}

// ---- 부팅 ----
async function resume(session) {
  if (session.role === "admin") {
    // 클레임 확인 (에뮬레이터 재시작 등으로 사라졌으면 재인증 요구)
    const tok = await auth.currentUser.getIdTokenResult(true);
    if (tok.claims.admin === true) {
      state.role = "admin"; state.isAdmin = true;
      await startRole();
      return true;
    }
    return false;
  }
  if ((session.role === "leader" || session.role === "member") && session.code && session.name) {
    // 멱등 재입장으로 members/{uid} 보장 (에뮬레이터 데이터 리셋 대비)
    try {
      const fcmToken = await getPushToken();
      const d = await call("joinTeam", { code: session.code, name: session.name, fcmToken });
      state.role = session.role; state.myTeamId = d.teamId; state.myTeamName = d.teamName; state.myName = session.name;
      await startRole();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function boot() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { signInAnonymously(auth).catch((e) => toast("인증 실패: " + e.message, "err")); return; }
    state.uid = user.uid;
    flushOutbox().catch(() => {}); // 이전 세션에서 큐에 남은 오프라인 보고 재전송
    updateOutboxBadge();
    const session = loadSession();
    if (session?.role) {
      const ok = await resume(session).catch(() => false);
      if (ok) return;
      localStorage.removeItem(LS);
    }
    entryScreen();
  });
}

// 서비스워커 등록(PWA 앱셸 + FCM 백그라운드). 127.0.0.1 에서도 동작하므로 로컬 포함 등록.
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => { swRegistration = reg; })
    .catch(() => {});
}

registerSW();
boot();
