// 깨! 오프라인 아웃박스 — submitClear 실패를 큐잉하고 온라인 복귀 시 재전송.
// submitClear 는 서버에서 clearId(`${teamId}_${missionId}`) 로 멱등이라 재시도가 안전하다
// (중복 재전송은 already-exists 로 흡수되어 코인이 두 번 적립되지 않는다).
//
// 순수 모듈(DOM/SDK 직접 의존 없음): localStorage·navigator·call 을 주입받아 단위 테스트한다.
const KEY = "kkae.outbox";

function read(store) {
  try { return JSON.parse(store.getItem(KEY) || "[]"); } catch (_) { return []; }
}
function write(store, items) {
  store.setItem(KEY, JSON.stringify(items));
}

// 네트워크/오프라인 계열 오류만 큐잉한다. 논리적 거부(already-exists·not-found·permission-denied 등)는 큐잉하지 않는다.
export function isNetworkError(e, online = true) {
  if (!online) return true;
  const c = e && e.code;
  return c === "functions/unavailable" || c === "functions/internal" || c === "functions/deadline-exceeded";
}

/**
 * createOutbox({ call, store?, isOnline?, onChange? })
 * - call(name, data): 콜러블 호출기 (앱의 call 헬퍼)
 * - store: localStorage 호환(getItem/setItem)
 * - isOnline(): 현재 온라인 여부
 * - onChange(count): 큐 길이 변동 콜백(뱃지 갱신용)
 */
export function createOutbox({
  call,
  store = globalThis.localStorage,
  isOnline = () => (globalThis.navigator ? globalThis.navigator.onLine !== false : true),
  onChange = () => {},
}) {
  const count = () => read(store).length;

  function add(item) {
    const items = read(store);
    // 같은 팀+미션은 한 번만(중복 방지).
    if (!items.some((q) => q.teamId === item.teamId && q.missionCode === item.missionCode)) {
      items.push(item);
      write(store, items);
      onChange(items.length);
    }
  }

  // 보고 시도. 네트워크 오류면 큐에 넣고 queued 플래그가 달린 에러를 던진다(호출부가 안내 토스트).
  async function report(teamId, missionCode) {
    try {
      return await call("submitClear", { teamId, missionCode });
    } catch (e) {
      if (isNetworkError(e, isOnline())) {
        add({ teamId, missionCode });
        const q = new Error("offline-queued");
        q.queued = true;
        throw q;
      }
      throw e;
    }
  }

  let flushing = false;
  // 큐 비우기(온라인 복귀/부팅 시). 보낸 건수와 남은 건수를 반환.
  async function flush() {
    if (flushing) return { sent: 0, kept: count() };
    flushing = true;
    try {
      const items = read(store);
      if (!items.length) return { sent: 0, kept: 0 };
      const kept = [];
      let sent = 0;
      for (const it of items) {
        try {
          await call("submitClear", { teamId: it.teamId, missionCode: it.missionCode });
          sent++;
        } catch (e) {
          if (e && e.code === "functions/already-exists") sent++; // 이미 적립됨 → 큐에서 제거
          else if (isNetworkError(e, isOnline())) kept.push(it);   // 아직 오프라인 → 유지
          // 그 외 영구 오류(not-found·permission-denied 등) → 버림
        }
      }
      write(store, kept);
      onChange(kept.length);
      return { sent, kept: kept.length };
    } finally {
      flushing = false;
    }
  }

  return { count, add, report, flush };
}
