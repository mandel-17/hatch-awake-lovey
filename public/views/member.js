// 팀원(M) 화면 — 응원 홈 + 미션 지도(읽기 전용). 쓰기 동작 없음.
import { topbarHTML } from "./shared.js";

export function mount(root, ctx) {
  root.innerHTML =
    topbarHTML("member") +
    `<div data-communal></div>
     <div class="panel soft"><span class="lbl">우리 팀</span><div data-teamcard></div></div>
     <div class="panel"><h2>🏆 리더보드</h2><div data-leaderboard></div></div>
     <div class="panel"><h2>🗺️ 미션 지도</h2>
       <div class="note" style="margin-bottom:10px">미션을 깨면 코인이 쌓입니다. 보고는 팀 리더가 합니다.</div>
       <div data-checklist></div>
     </div>`;
  root.querySelector("[data-leave]").addEventListener("click", ctx.leave);
}
