/**
 * Cloud Functions 통합 테스트 (에뮬레이터). 콜러블을 클라이언트 SDK로 호출한다.
 * 검증: ①중복 보고 거부·합산 1회 ②동시 보고 합산 정확/멱등 ③비관리자 거부
 *       ④allowLeaderSubmit 가드 ⑤triggerHatch 가드.
 * 실행: npm run test:functions  (firebase emulators:exec ...)
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";

const PROJECT_ID = "demo-kkae";
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FUNCTIONS_PORT = 5001;

// --- Admin SDK (시드 + 클레임; 규칙 우회) ---
admin.initializeApp({ projectId: PROJECT_ID });
const adb = admin.firestore();
const aauth = admin.auth();

// --- Client SDK (콜러블 호출) ---
const app = initializeApp({ projectId: PROJECT_ID, apiKey: "demo-key" });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
const functions = getFunctions(app);
connectFunctionsEmulator(functions, "127.0.0.1", FUNCTIONS_PORT);

const call = (name, data) => httpsCallable(functions, name)(data);

let seedDoc;
before(async () => {
  seedDoc = JSON.parse(await readFile(new URL("../data/seed.json", import.meta.url), "utf8"));
});
after(async () => {
  await deleteApp(app);
  await admin.app().delete();
});

async function clearAll() {
  await fetch(
    `http://${FS_HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE",
  });
}

async function seedData(total = 0) {
  const batch = adb.batch();
  const { id, ...ev } = seedDoc.event;
  ev.total = total;
  batch.set(adb.collection("events").doc(id), ev);
  for (const t of seedDoc.teams) {
    const { id, ...rest } = t;
    batch.set(adb.collection("teams").doc(id), rest);
  }
  for (const m of seedDoc.missions) {
    const { id, ...rest } = m;
    batch.set(adb.collection("missions").doc(id), rest);
  }
  await batch.commit();
}

async function signInMember(teamId, name = "테스터") {
  await signOut(auth).catch(() => {});
  const cred = await signInAnonymously(auth);
  await adb.collection("members").doc(cred.user.uid).set({ teamId, name });
  await cred.user.getIdToken(true);
  return cred.user.uid;
}

async function signInAdmin() {
  await signOut(auth).catch(() => {});
  const cred = await signInAnonymously(auth);
  await aauth.setCustomUserClaims(cred.user.uid, { admin: true });
  await cred.user.getIdToken(true); // 클레임 반영 위해 토큰 강제 갱신
  return cred.user.uid;
}

const eventTotal = async () => (await adb.collection("events").doc("main").get()).get("total");
const teamCoins = async (id) => (await adb.collection("teams").doc(id).get()).get("coins");

async function expectError(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.equal(e.code, `functions/${code}`, `expected functions/${code}, got ${e.code}: ${e.message}`);
    return true;
  });
}

beforeEach(async () => {
  await clearAll();
});

test("① 정상 보고 후 중복 보고는 거부되고 합산은 1회만", async () => {
  await seedData(0);
  await signInMember("t1", "리더");

  const res = await call("submitClear", { teamId: "t1", missionCode: "W-OX" });
  assert.equal(res.data.ok, true);
  assert.equal(res.data.coins, 50);
  assert.equal(await teamCoins("t1"), 50);
  assert.equal(await eventTotal(), 50);

  await expectError(call("submitClear", { teamId: "t1", missionCode: "W-OX" }), "already-exists");
  assert.equal(await teamCoins("t1"), 50, "중복 보고로 코인이 더 늘면 안 된다");
  assert.equal(await eventTotal(), 50);
});

test("② 서로 다른 미션 동시 보고 → total 정확 합산", async () => {
  await seedData(0);
  await signInAdmin();

  const results = await Promise.all([
    call("submitClear", { teamId: "t1", missionCode: "W-OX" }),   // 50
    call("submitClear", { teamId: "t1", missionCode: "W-MIX" }),  // 150
    call("submitClear", { teamId: "t1", missionCode: "W-DRAW" }), // 100
  ]);
  assert.deepEqual(results.map((r) => r.data.coins).sort((a, b) => a - b), [50, 100, 150]);
  assert.equal(await eventTotal(), 300);
  assert.equal(await teamCoins("t1"), 300);
});

test("② 같은 미션 동시 보고 경합 → 정확히 1회만 적립(멱등)", async () => {
  await seedData(0);
  await signInAdmin();

  const settled = await Promise.allSettled([
    call("submitClear", { teamId: "t2", missionCode: "W-OX" }),
    call("submitClear", { teamId: "t2", missionCode: "W-OX" }),
  ]);
  const ok = settled.filter((s) => s.status === "fulfilled");
  const failed = settled.filter((s) => s.status === "rejected");
  assert.equal(ok.length, 1, "정확히 하나만 성공해야 한다");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].reason.code, "functions/already-exists");
  assert.equal(await eventTotal(), 50);
  assert.equal(await teamCoins("t2"), 50);
});

test("③ 비관리자는 adminAdjust/triggerHatch/setConfig 거부", async () => {
  await seedData(10000);
  await signInMember("t1");

  await expectError(call("adminAdjust", { teamId: "t1", amount: 500 }), "permission-denied");
  await expectError(call("triggerHatch", {}), "permission-denied");
  await expectError(call("setConfig", { allowLeaderSubmit: false }), "permission-denied");
});

test("④ allowLeaderSubmit=false 면 리더 거부, 관리자는 허용", async () => {
  await seedData(0);

  await signInAdmin();
  await call("setConfig", { allowLeaderSubmit: false });

  await signInMember("t1", "리더");
  await expectError(
    call("submitClear", { teamId: "t1", missionCode: "W-OX" }),
    "permission-denied"
  );

  await signInAdmin();
  const res = await call("submitClear", { teamId: "t1", missionCode: "W-OX" });
  assert.equal(res.data.ok, true);
  assert.equal(await eventTotal(), 50);
});

test("⑤ triggerHatch 가드: 목표 미달 거부, 도달 시 성공", async () => {
  await seedData(0);
  await signInAdmin();
  await expectError(call("triggerHatch", {}), "failed-precondition");

  await clearAll();
  await seedData(10000);
  await signInAdmin();
  const res = await call("triggerHatch", {});
  assert.equal(res.data.ok, true);
  const ev = await adb.collection("events").doc("main").get();
  assert.equal(ev.get("hatched"), true);
  assert.ok(ev.get("hatchedAt"), "hatchedAt 이 기록되어야 한다");
});

test("멤버가 아닌 팀의 미션은 보고 불가", async () => {
  await seedData(0);
  await signInMember("t1");
  await expectError(
    call("submitClear", { teamId: "t2", missionCode: "W-OX" }),
    "permission-denied"
  );
});

test("잘못된 미션 코드는 not-found", async () => {
  await seedData(0);
  await signInMember("t1");
  await expectError(
    call("submitClear", { teamId: "t1", missionCode: "NOPE-123" }),
    "not-found"
  );
});

test("joinTeam: 팀 코드로 입장, 잘못된 코드는 거부", async () => {
  await seedData(0);
  await signOut(auth).catch(() => {});
  await signInAnonymously(auth);

  const res = await call("joinTeam", { code: "TEAM3", name: "홍길동" });
  assert.equal(res.data.teamId, "t3");
  assert.equal(res.data.teamName, "3팀");
  assert.equal(await teamCoins("t3"), 0);
  const tc = (await adb.collection("teams").doc("t3").get()).get("memberCount");
  assert.equal(tc, 1);

  await expectError(call("joinTeam", { code: "BADCODE", name: "x" }), "not-found");
});
