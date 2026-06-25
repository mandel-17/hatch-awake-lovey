/**
 * firestore.rules 단위 테스트 (@firebase/rules-unit-testing).
 * 핵심 불변식: 어떤 클라이언트도 coins/total/clears/adjustments 를 쓸 수 없다.
 * 실행: npm run test:rules  (firebase emulators:exec --only firestore ...)
 */
import { test, before, after, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv;

before(async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-kkae",
    firestore: { rules, host, port: Number(port) },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "events", "main"), { total: 0, goal: 10000 });
    await setDoc(doc(db, "teams", "t1"), { name: "1팀", coins: 0 });
    await setDoc(doc(db, "missions", "m2"), { code: "W-OX", coins: 50, active: true });
    await setDoc(doc(db, "clears", "t1_m2"), { teamId: "t1", amount: 50 });
    await setDoc(doc(db, "members", "alice"), { teamId: "t1", name: "Alice" });
  });
});

test("로그인 사용자는 events/teams/missions/clears 를 읽을 수 있다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(getDoc(doc(db, "events", "main")));
  await assertSucceeds(getDoc(doc(db, "teams", "t1")));
  await assertSucceeds(getDoc(doc(db, "missions", "m2")));
});

test("미인증 사용자는 읽을 수 없다", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "events", "main")));
});

test("클라이언트는 teams.coins 를 쓸 수 없다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(db, "teams", "t1"), { coins: 999 }, { merge: true }));
});

test("클라이언트는 events.total 을 쓸 수 없다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(db, "events", "main"), { total: 99999 }, { merge: true }));
});

test("클라이언트는 clears 를 쓸 수 없다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(db, "clears", "t1_m3"), { teamId: "t1", amount: 150 }));
});

test("클라이언트는 adjustments 를 쓸 수 없다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(db, "adjustments", "x"), { amount: 100 }));
});

test("비관리자는 adjustments 를 읽을 수 없다", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertFails(getDoc(doc(db, "adjustments", "x")));
});

test("본인은 자기 members 문서를 만들 수 있다", async () => {
  const db = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(setDoc(doc(db, "members", "bob"), { teamId: "t1", name: "Bob" }));
});

test("남의 members 문서는 만들 수 없다", async () => {
  const db = testEnv.authenticatedContext("bob").firestore();
  await assertFails(setDoc(doc(db, "members", "alice"), { teamId: "t1", name: "Hacker" }));
});

test("본인 members 읽기 가능, 남의 것은 불가", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(getDoc(doc(db, "members", "alice")));
  await assertFails(getDoc(doc(db, "members", "someone-else")));
});

test("관리자는 임의 members 를 읽을 수 있다", async () => {
  const db = testEnv.authenticatedContext("admin1", { admin: true }).firestore();
  await assertSucceeds(getDoc(doc(db, "members", "alice")));
  await assertSucceeds(getDoc(doc(db, "adjustments", "x")));
});
