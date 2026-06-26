// 공용 렌더 함수 (상태의 순수 함수 → HTML 문자열). 3역할이 함께 쓴다.
// kkae-style-tile.html 의 .sig/.egg/.lb 마크업을 재사용한다.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function fmt(n) {
  return (n ?? 0).toLocaleString("ko-KR");
}

// 스테이션 QR ↔ 스캔 코드 변환 (round-trip 쌍). leader 스캐너·admin QR 생성이 공유한다.
export function scanUrl(code, origin = (typeof location !== "undefined" ? location.origin : "")) {
  return `${origin}/?scan=${encodeURIComponent(code)}`;
}

export function extractCode(text) {
  // ?scan=W-OX 링크면 쿼리 파싱, 아니면 원문.
  try {
    const u = new URL(text);
    const q = u.searchParams.get("scan");
    if (q !== null) return q;
  } catch (_) {}
  return text;
}

const ROLE_LABEL = { admin: "관리자", leader: "팀 리더", member: "팀원" };
// 공통 상단바. data-leave 버튼은 각 뷰의 mount 에서 ctx.leave 로 배선한다.
export function topbarHTML(role) {
  return `<div class="topbar">
    <span class="brand do">깨<b>!</b></span>
    <span class="role-chip ${role}">${ROLE_LABEL[role] || ""}</span>
    <span class="spacer"></span>
    <button class="linkbtn" data-leave>역할 변경</button>
  </div>`;
}

const STARS = [
  [16, 14], [40, 40], [24, 72], [54, 86], [30, 58], [18, 90],
];
function starDots() {
  return STARS.map(([t, l]) => `<span class="star" style="top:${t}px;left:${l}%"></span>`).join("");
}

// 알 SVG: 금(crack)이 진행률에 연동(dashoffset). progress 0~1.
export function eggSVG(progress) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const offset = Math.round(200 * (1 - p));
  return `<svg viewBox="0 0 120 150" aria-hidden="true"><path d="M60 5 L54 30 L66 44 L52 66 L64 85 L55 108 L66 130 L61 144" fill="none" stroke="#14224D" stroke-width="3" stroke-linejoin="round" stroke-dasharray="200" stroke-dashoffset="${offset}"/></svg>`;
}

// 공동 카운터 + 알 (다크). 전 역할 공통 시그니처.
export function communalHTML(event) {
  const total = event?.total ?? 0;
  const goal = event?.goal ?? 10000;
  const p = goal > 0 ? total / goal : 0;
  const pct = Math.min(100, Math.round(p * 100));
  const remain = Math.max(0, goal - total);
  const near = p >= 0.85 && p < 1;
  return `
    <div class="sig">
      ${starDots()}
      <div class="l">함께 모은 코인</div>
      <div class="tot">${fmt(total)}<span class="g"> / ${fmt(goal)}</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <div class="sub">${remain > 0 ? `목표까지 ${fmt(remain)} 코인 · ${pct}%` : `목표 달성! 부화를 기다립니다 ✨`}</div>
      <div class="egg ${near ? "near" : ""}">
        <span class="sp s1"></span><span class="sp s2"></span>
        ${eggSVG(p)}
      </div>
    </div>`;
}

// 리더보드 (teams 는 coins desc 정렬 전제)
export function leaderboardHTML(teams, myTeamId) {
  if (!teams || !teams.length) return `<div class="note">아직 순위가 없습니다.</div>`;
  const top = teams[0]?.coins || 1;
  return `<div class="lb">` + teams.map((t, i) => {
    const w = Math.round(((t.coins || 0) / (top || 1)) * 100);
    const me = t.id === myTeamId;
    return `<div class="r ${me ? "me" : ""}">
      <div class="rk">${i + 1}</div>
      <div class="info">
        <div class="nm">${esc(t.name)}${me ? `<span class="tag">우리 팀</span>` : ""}</div>
        <div class="bar"><div class="bf" style="width:${w}%"></div></div>
      </div>
      <div class="cn">${fmt(t.coins)}</div>
    </div>`;
  }).join("") + `</div>`;
}

const BADGE = {
  comp: ["b-comp", "경쟁"],
  quiet: ["b-quiet", "정적"],
  part: ["b-part", "참여"],
};
function badge(type) {
  const [cls, label] = BADGE[type] || BADGE.comp;
  return `<span class="badge ${cls}">${label}</span>`;
}

// 미션 체크리스트 (월드별 그룹). myClears = Set<missionId>.
export function checklistHTML(missions, myClears) {
  if (!missions || !missions.length) return `<div class="note">미션을 불러오는 중…</div>`;
  const worlds = [];
  const byWorld = new Map();
  for (const m of missions) {
    if (!byWorld.has(m.world)) { byWorld.set(m.world, []); worlds.push(m.world); }
    byWorld.get(m.world).push(m);
  }
  return worlds.map((w) => {
    const rows = byWorld.get(w).map((m) => {
      const done = myClears && myClears.has(m.id);
      return `<div class="mission ${done ? "cleared" : ""}">
        <div class="check">${done ? "✔" : ""}</div>
        <div class="mn">${esc(m.name)} <span class="mc">${esc(m.code)}</span></div>
        ${badge(m.type)}
        <div class="coin">${fmt(m.coins)}</div>
      </div>`;
    }).join("");
    return `<div class="world"><div class="wname">${esc(w)}</div>${rows}</div>`;
  }).join("");
}

// 깨! 부화 연출 (다크→빛). events.hatched 구독으로 전 기기 동시 발화.
export function playHatch() {
  if (document.getElementById("hatch")) return;
  const el = document.createElement("div");
  el.id = "hatch";
  el.innerHTML =
    `<div class="yolk">🐣</div>` +
    `<div class="htxt do">깨<b style="color:var(--mario)">!</b></div>` +
    `<div class="hsub">잠든 믿음이 깨어났습니다 · 어둠에서 빛으로 (엡 5:8)</div>`;
  document.body.appendChild(el);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    el.classList.add("flood");
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("flood")));
    spawnConfetti();
  }
  el.title = "탭하여 닫기";
  el.addEventListener("click", () => el.remove());
}

function spawnConfetti() {
  const colors = ["#F6C92E", "#2E9E3F", "#E5392C", "#3ABCE4", "#FFFFFF"];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    c.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}
