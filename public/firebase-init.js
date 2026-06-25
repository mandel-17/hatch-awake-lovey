// Firebase SDK 초기화 + 에뮬레이터 배선.
// SDK 는 public/vendor/firebase/ 로 벤더링한 모듈러 ESM 빌드(번들러 없음).
import { initializeApp } from "./vendor/firebase/firebase-app.js";
import { getAuth, connectAuthEmulator } from "./vendor/firebase/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "./vendor/firebase/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "./vendor/firebase/firebase-functions.js";

// 에뮬레이터/데모 프로젝트라 실 키는 필요 없다(값은 더미).
const firebaseConfig = {
  projectId: "demo-kkae",
  apiKey: "demo-key",
  authDomain: "demo-kkae.firebaseapp.com",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// localhost/127.0.0.1 에서 열리면 에뮬레이터에 연결. (IPv6 ::1 회피 위해 hostname 그대로 사용)
export const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if (isLocal) {
  const h = location.hostname;
  connectAuthEmulator(auth, `http://${h}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, h, 8080);
  connectFunctionsEmulator(functions, h, 5001);
}
