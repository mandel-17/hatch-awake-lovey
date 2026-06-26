/**
 * Firestore 시드. 기본은 에뮬레이터, --prod 로 운영 프로젝트에 주입한다.
 *   node scripts/seed.js                         # 에뮬레이터 + data/seed.json
 *   node scripts/seed.js --total=10000           # events.total 직접 세팅(부화 검증용)
 *   SEED_FILE=data/seed.prod.json GCLOUD_PROJECT=<id> \
 *     GOOGLE_APPLICATION_CREDENTIALS=<키.json> node scripts/seed.js --prod   # 운영
 *
 * 에뮬레이터 모드는 FIRESTORE_EMULATOR_HOST 로 라우팅된다(미설정 시 127.0.0.1:8080 기본).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

// --prod (또는 SEED_PROD=1): 운영 프로젝트에 시드. 에뮬레이터 호스트를 강제하지 않고
// GCLOUD_PROJECT + 애플리케이션 기본 자격증명(GOOGLE_APPLICATION_CREDENTIALS)을 사용한다.
const PROD = process.argv.includes("--prod") || process.env.SEED_PROD === "1";
const PROJECT_ID = PROD
  ? process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  : "demo-kkae";
if (PROD && !PROJECT_ID) {
  console.error("✘ --prod 모드는 GCLOUD_PROJECT(또는 GOOGLE_CLOUD_PROJECT) 환경변수가 필요합니다.");
  process.exit(1);
}
if (!PROD && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = process.env.SEED_FILE || "data/seed.json"; // 저장소 루트 기준 상대경로
const seed = JSON.parse(
  await readFile(path.join(__dirname, "..", SEED_FILE), "utf8")
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
  `✔ 시드 완료 [${PROD ? "운영:" + PROJECT_ID : "에뮬레이터"}] ${SEED_FILE} — ` +
    `event=${eventId}(total=${eventData.total}), teams=${seed.teams.length}, missions=${seed.missions.length}` +
    (overrideTotal !== null ? `  [total override]` : "")
);
process.exit(0);
