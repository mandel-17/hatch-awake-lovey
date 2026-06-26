/**
 * 깨! 부하 테스트 — 동시 submitClear 시 ①정확성(무결성) ②처리량/지연 측정.
 * (SPEC §11 / BUILD_PLAN Phase 7)
 *
 * 실행:  npm run loadtest                  # 기본 N=90 동시(버스트)
 *        N=120 npm run loadtest            # 동시 수 조절
 *        CONCURRENCY=10 npm run loadtest   # 동시 상한(현실적 분산 부하 모사)
 *
 * ① 정확성(pass 기준): events.total == clears 컬렉션 합계, 각 팀 coins == 팀 clears 합계.
 *    submitClear 는 원자적 increment + clearId 멱등이라, 성공/타임아웃 여부와 무관하게
 *    "실제 커밋된 clears 의 합"과 total 이 정확히 일치해야 한다(유실·중복 0).
 * ② 처리량(정보): 성공률·지연. events.total 단일 핫 필드에 다수 트랜잭션이 경합하면
 *    버스트가 클수록 일부가 functions/internal(트랜잭션 재시도 소진)로 실패할 수 있다.
 * 한계: 에뮬레이터는 운영 Firestore보다 훨씬 느리고 경합에 약하다. 실제 90대 부하는 실 프로젝트 검증(handoff E).
 */
import { readFile } from "node:fs/promises";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const PROJECT_ID = "demo-kkae";
const N = Number(process.env.N || process.argv[2] || 90);
const CONCURRENCY = Number(process.env.CONCURRENCY || N); // 기본 = 전부 동시(버스트)
const CALL_TIMEOUT = Number(process.env.CALL_TIMEOUT || 20000);
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FUNCTIONS_PORT = 5001;

admin.initializeApp({ projectId: PROJECT_ID });
const adb = admin.firestore();
const aauth = admin.auth();

const app = initializeApp({ projectId: PROJECT_ID, apiKey: "demo-key" });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
const functions = getFunctions(app);
connectFunctionsEmulator(functions, "127.0.0.1", FUNCTIONS_PORT);
const submit = (data) => httpsCallable(functions, "submitClear", { timeout: CALL_TIMEOUT })(data);

async function clearAll() {
  await fetch(
    `http://${FS_HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
}

async function seed(seedDoc) {
  const batch = adb.batch();
  const { id, ...ev } = seedDoc.event;
  ev.total = 0;
  batch.set(adb.collection("events").doc(id), ev);
  for (const t of seedDoc.teams) {
    const { id, ...rest } = t;
    rest.coins = 0;
    batch.set(adb.collection("teams").doc(id), rest);
  }
  for (const m of seedDoc.missions) {
    const { id, ...rest } = m;
    batch.set(adb.collection("missions").doc(id), rest);
  }
  await batch.commit();
}

// 동시 상한 풀
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function lane() {
    while (i < items.length) {
      const idx = i++;
      const s = performance.now();
      try {
        await worker(items[idx]);
        results[idx] = { ok: true, ms: performance.now() - s };
      } catch (e) {
        results[idx] = { ok: false, ms: performance.now() - s, code: e?.code || e?.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);
const r0 = (x) => (x == null ? "—" : x.toFixed(0));

async function main() {
  const seedDoc = JSON.parse(await readFile(new URL("../data/seed.json", import.meta.url), "utf8"));
  await clearAll();
  await seed(seedDoc);

  const cred = await signInAnonymously(auth);
  await aauth.setCustomUserClaims(cred.user.uid, { admin: true });
  await cred.user.getIdToken(true);

  // distinct (팀,미션) 쌍 N개
  const teams = seedDoc.teams.map((t) => t.id);
  const missions = seedDoc.missions.map((m) => m.code);
  const pairs = [];
  for (const t of teams) for (const code of missions) { if (pairs.length < N) pairs.push({ teamId: t, code }); }
  if (pairs.length < N) console.warn(`주의: 가능한 쌍 ${pairs.length} < N(${N}) → ${pairs.length} 로 축소`);

  console.log(`▶ submitClear ${pairs.length}건 (동시 상한 ${CONCURRENCY}, 타임아웃 ${CALL_TIMEOUT}ms)...`);
  const t0 = performance.now();
  const results = await runPool(pairs, CONCURRENCY, (p) => submit({ teamId: p.teamId, missionCode: p.code }));
  const wall = performance.now() - t0;

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const lat = ok.map((r) => r.ms).sort((a, b) => a - b);
  const failCodes = {};
  for (const f of fail) failCodes[f.code] = (failCodes[f.code] || 0) + 1;

  // ── 무결성: 서버 진실(clears) 과 대조 ──
  const clearsSnap = await adb.collection("clears").get();
  const clearsSum = clearsSnap.docs.reduce((s, d) => s + (d.get("amount") || 0), 0);
  const total = (await adb.collection("events").doc("main").get()).get("total") || 0;
  const perTeam = {};
  clearsSnap.docs.forEach((d) => { const t = d.get("teamId"); perTeam[t] = (perTeam[t] || 0) + (d.get("amount") || 0); });
  let teamMismatch = 0;
  for (const t of teams) {
    const coins = (await adb.collection("teams").doc(t).get()).get("coins") || 0;
    if (coins !== (perTeam[t] || 0)) teamMismatch++;
  }
  const integrity = total === clearsSum && teamMismatch === 0;

  console.log("──────── 결과 ────────");
  console.log(`처리량: 성공 ${ok.length}/${pairs.length} (${((ok.length / pairs.length) * 100).toFixed(0)}%) · 실패 ${fail.length}`);
  if (fail.length) console.log("  실패 코드:", failCodes);
  console.log(`지연(성공) ms: min ${r0(lat[0])} · p50 ${r0(pct(lat, 50))} · p95 ${r0(pct(lat, 95))} · max ${r0(lat[lat.length - 1])}`);
  console.log(`전체 ${wall.toFixed(0)}ms · ${(pairs.length / (wall / 1000)).toFixed(1)} req/s`);
  console.log(`무결성: events.total=${total} == clears합계=${clearsSum} ${total === clearsSum ? "✅" : "❌"} · 팀 불일치 ${teamMismatch} ${teamMismatch === 0 ? "✅" : "❌"}`);
  if (fail.length) {
    console.log(
      "⚠ 일부 실패(functions/internal)는 events.total 단일 핫 필드 경합(트랜잭션 재시도 소진)이다.\n" +
      "  코인은 정확하다(커밋된 것만 1회 집계). 운영 Firestore는 더 빠르나 단일 문서엔 지속 쓰기 한계가 있다.\n" +
      "  현장은 보고가 시간에 분산돼 보통 문제없다. 동기 버스트가 우려되면 분산 카운터(샤딩) 검토(handoff)."
    );
  }

  await deleteApp(app);
  await admin.app().delete();

  console.log(integrity ? "✔ 부하 테스트 통과 (무결성: 코인 합산 정확)" : "✘ 부하 테스트 실패 (무결성 깨짐!)");
  process.exit(integrity ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
