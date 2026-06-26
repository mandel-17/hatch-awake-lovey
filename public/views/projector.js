// 프로젝터 송출 뷰 — 컨트롤 없는 풀스크린(공동 합산 + 알 + TOP 3). 관리자가 띄운다.
// [data-communal] 은 app.js refresh 가 채우고, 부화 연출(#hatch, z-80)은 전역 playHatch 가
// 이 위로 덮어 프로젝터에서도 함께 보인다. (DOM/textContent 사용 → 별도 이스케이프 불필요)
import { fmt } from "./shared.js";

const MEDAL = ["🥇", "🥈", "🥉"];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function mount(root, ctx) {
  root.replaceChildren();
  const wrap = el("div", "projector");

  const exit = el("button", "proj-exit", "← 관리자");
  exit.setAttribute("data-proj-exit", "");
  exit.addEventListener("click", ctx.exitProjector);

  const communal = el("div");
  communal.setAttribute("data-communal", ""); // app.js refresh 가 communalHTML 로 채움

  const leaders = el("div", "proj-leaders");
  const top = el("div", "proj-top");
  top.setAttribute("data-leaderboard-top", "");
  leaders.append(el("h2", null, "🏆 TOP 3"), top);

  wrap.append(exit, communal, leaders);
  root.append(wrap);
}

export function refresh(ctx) {
  const host = document.querySelector("[data-leaderboard-top]");
  if (!host) return;
  const top = (ctx.state.teams || []).slice(0, 3);
  host.replaceChildren();
  if (!top.length) {
    const n = el("div", "note", "아직 순위가 없습니다.");
    n.style.color = "#cfe0ff";
    host.append(n);
    return;
  }
  top.forEach((t, i) => {
    const row = el("div", "pr");
    row.append(
      el("span", "medal", MEDAL[i] || ""),
      el("span", "pname", t.name || ""),
      el("span", "pcoin", fmt(t.coins))
    );
    host.append(row);
  });
}
