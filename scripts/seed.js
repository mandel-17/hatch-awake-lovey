/**
 * Firestore 시드 (에뮬레이터). data/seed.json 을 주입한다.
 *   node scripts/seed.js            # 기본 시드
 *   node scripts/seed.js --total=10000   # events.total 을 직접 세팅(부화 검증용)
 *
 * FIRESTORE_EMULATOR_HOST 가 설정되어 있어야 에뮬레이터로 라우팅된다
 * (firebase emulators:exec 가 자동 설정; 수동 실행 시 아래 기본값 사용).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const PROJECT_ID = "demo-kkae";
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  await readFile(path.join(__dirname, "..", "data", "seed.json"), "utf8")
);

const totalArg = process.argv.find((a) => a.startsWith("--total="));
const overrideTotal = totalArg ? Number(totalArg.split("=")[1]) : null;

const batch = db.batch();

const { id: eventId, ...eventData } = seed.event;
if (overrideTotal !== null && Number.isFinite(overrideTotal)) {
  eventData.total = overrideTotal;
}
batch.set(db.collection("events").doc(eventId), eventData);

for (const t of seed.teams) {
  const { id, ...rest } = t;
  batch.set(db.collection("teams").doc(id), rest);
}
for (const m of seed.missions) {
  const { id, ...rest } = m;
  batch.set(db.collection("missions").doc(id), rest);
}

await batch.commit();
console.log(
  `✔ 시드 완료 — event=${eventId}(total=${eventData.total}), teams=${seed.teams.length}, missions=${seed.missions.length}` +
    (overrideTotal !== null ? `  [total=${eventData.total} 로 override]` : "")
);
process.exit(0);
