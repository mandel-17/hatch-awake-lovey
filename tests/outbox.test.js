/**
 * 오프라인 아웃박스 단위 테스트 (에뮬레이터 불필요 — 순수 로직).
 * 실행: node --test tests/outbox.test.js  (또는 npm run test:unit)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOutbox, isNetworkError } from "../public/outbox.js";

function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}
function err(code) { const e = new Error(code); e.code = code; return e; }

test("isNetworkError: 오프라인이면 코드와 무관하게 true", () => {
  assert.equal(isNetworkError(err("functions/already-exists"), false), true);
});

test("isNetworkError: unavailable/internal/deadline 은 true, 논리오류는 false", () => {
  assert.equal(isNetworkError(err("functions/unavailable"), true), true);
  assert.equal(isNetworkError(err("functions/internal"), true), true);
  assert.equal(isNetworkError(err("functions/deadline-exceeded"), true), true);
  assert.equal(isNetworkError(err("functions/already-exists"), true), false);
  assert.equal(isNetworkError(err("functions/not-found"), true), false);
});

test("report 성공: call 호출되고 큐는 비어 있음", async () => {
  const store = fakeStore();
  const calls = [];
  const ob = createOutbox({
    call: async (n, d) => { calls.push([n, d]); return { ok: true, coins: 50 }; },
    store, isOnline: () => true,
  });
  const r = await ob.report("t1", "W-OX");
  assert.deepEqual(r, { ok: true, coins: 50 });
  assert.deepEqual(calls[0], ["submitClear", { teamId: "t1", missionCode: "W-OX" }]);
  assert.equal(ob.count(), 0);
});

test("report 네트워크 오류: 큐에 쌓이고 queued 에러를 던짐", async () => {
  const store = fakeStore();
  const ob = createOutbox({ call: async () => { throw err("functions/unavailable"); }, store, isOnline: () => true });
  await assert.rejects(ob.report("t1", "W-OX"), (e) => { assert.equal(e.queued, true); return true; });
  assert.equal(ob.count(), 1);
});

test("report 오프라인(navigator offline): 큐잉", async () => {
  const store = fakeStore();
  const ob = createOutbox({ call: async () => { throw err("functions/whatever"); }, store, isOnline: () => false });
  await assert.rejects(ob.report("t2", "W-MIX"), (e) => e.queued === true);
  assert.equal(ob.count(), 1);
});

test("report 논리 오류(not-found): 큐잉 안 하고 원본 에러 전파", async () => {
  const store = fakeStore();
  const ob = createOutbox({ call: async () => { throw err("functions/not-found"); }, store, isOnline: () => true });
  await assert.rejects(ob.report("t1", "NOPE"), (e) => {
    assert.equal(e.code, "functions/not-found");
    assert.notEqual(e.queued, true);
    return true;
  });
  assert.equal(ob.count(), 0);
});

test("중복 방지: 같은 팀+미션은 한 번만 큐잉", async () => {
  const store = fakeStore();
  const ob = createOutbox({ call: async () => { throw err("functions/unavailable"); }, store, isOnline: () => true });
  await assert.rejects(ob.report("t1", "W-OX"));
  await assert.rejects(ob.report("t1", "W-OX"));
  assert.equal(ob.count(), 1);
});

test("flush: 전송 후 비움 · already-exists=보냄 · 네트워크오류=유지 · 영구오류=버림", async () => {
  const store = fakeStore();
  let mode = "queue";
  const ob = createOutbox({
    call: async (n, d) => {
      if (mode === "queue") throw err("functions/unavailable"); // 처음엔 모두 오프라인으로 큐잉
      if (d.missionCode === "OK1") return { ok: true };
      if (d.missionCode === "DUP") throw err("functions/already-exists");
      if (d.missionCode === "NET") throw err("functions/unavailable");
      if (d.missionCode === "PERM") throw err("functions/not-found");
      return { ok: true };
    },
    store, isOnline: () => true,
  });
  for (const m of ["OK1", "DUP", "NET", "PERM"]) await assert.rejects(ob.report("t1", m));
  assert.equal(ob.count(), 4);

  mode = "flush";
  const r = await ob.flush();
  assert.equal(r.sent, 2, "OK1 + DUP(already-exists) = 2");
  assert.equal(r.kept, 1, "NET 만 유지");
  assert.equal(ob.count(), 1);
});
