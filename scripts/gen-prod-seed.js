/**
 * 운영 시드 생성기 — data/seed.json 을 바탕으로 team.code 를 랜덤화한 data/seed.prod.json 을 만든다.
 * 부정방지: 운영에선 팀 코드가 예측 가능(TEAM1…)하면 안 된다(타 팀 사칭 방지).
 *
 *   node scripts/gen-prod-seed.js
 *   CODE_LEN=6 node scripts/gen-prod-seed.js
 *   START=2026-08-02T13:30:00+09:00 END=2026-08-02T16:30:00+09:00 node scripts/gen-prod-seed.js
 *
 * 출력 data/seed.prod.json 은 커밋 금지(.gitignore). 주입은 scripts/seed.js --prod 참조.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomInt } from "node:crypto";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// 혼동 문자(0,O,1,I,L) 제외 — 인쇄·폰 입력 오류 방지.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LEN = Number(process.env.CODE_LEN || 5);

function randCode() {
  let s = "";
  for (let i = 0; i < LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

const seed = JSON.parse(await readFile(path.join(root, "data", "seed.json"), "utf8"));

const used = new Set();
for (const t of seed.teams) {
  let code;
  do { code = randCode(); } while (used.has(code));
  used.add(code);
  t.code = code;
}

if (process.env.START) seed.event.startsAt = process.env.START;
if (process.env.END) seed.event.endsAt = process.env.END;

seed._comment = "운영 시드 (gen-prod-seed.js 생성). team.code 랜덤화됨. 커밋 금지.";

await writeFile(path.join(root, "data", "seed.prod.json"), JSON.stringify(seed, null, 2) + "\n", "utf8");

console.log("✔ data/seed.prod.json 생성 — team.code 랜덤화");
console.log("\n팀 코드 (스테이션 인쇄·배부용):");
for (const t of seed.teams) console.log(`  ${String(t.name).padEnd(5)} → ${t.code}`);
if (seed.event.startsAt || seed.event.endsAt) {
  console.log(`\n행사 시간: ${seed.event.startsAt || "(미설정)"} ~ ${seed.event.endsAt || "(미설정)"}`);
}
console.log(
  "\n운영 주입:\n" +
  "  SEED_FILE=data/seed.prod.json GCLOUD_PROJECT=<프로젝트ID> \\\n" +
  "  GOOGLE_APPLICATION_CREDENTIALS=<서비스계정.json> node scripts/seed.js --prod"
);
