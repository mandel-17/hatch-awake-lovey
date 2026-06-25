/**
 * 테스트/로컬 편의: Auth 에뮬레이터의 사용자 uid 에 admin 클레임 부여.
 *   node scripts/grant-admin.js <uid>
 * 실제 플로우는 setAdmin 콜러블(부트스트랩 코드)을 쓴다. 이건 빠른 셋업용.
 */
import admin from "firebase-admin";

const PROJECT_ID = "demo-kkae";
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}

admin.initializeApp({ projectId: PROJECT_ID });

const uid = process.argv[2];
if (!uid) {
  console.error("사용법: node scripts/grant-admin.js <uid>");
  process.exit(1);
}

await admin.auth().setCustomUserClaims(uid, { admin: true });
console.log(`✔ admin 클레임 부여: ${uid}`);
process.exit(0);
