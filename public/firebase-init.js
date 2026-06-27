// Firebase SDK 초기화 + 에뮬레이터 배선.
// SDK 는 public/vendor/firebase/ 로 벤더링한 모듈러 ESM 빌드(번들러 없음).
import { initializeApp } from "./vendor/firebase/firebase-app.js";
import { getAuth, connectAuthEmulator } from "./vendor/firebase/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  connectFirestoreEmulator,
} from "./vendor/firebase/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "./vendor/firebase/firebase-functions.js";

// 실 프로젝트 config (hatch-awake-lovey). 웹 apiKey 는 공개값(시크릿 아님) — 커밋 안전.
// ⚠️ 변경 시 public/sw.js 의 동일 firebaseConfig 도 함께 갱신할 것(SW 는 모듈 import 불가).
export const firebaseConfig = {
  apiKey: "AIzaSyAOY4ouNDnbsNXPZhAAxpPd12bhEeXoq1I",
  authDomain: "hatch-awake-lovey.firebaseapp.com",
  projectId: "hatch-awake-lovey",
  storageBucket: "hatch-awake-lovey.firebasestorage.app",
  messagingSenderId: "67931948915",
  appId: "1:67931948915:web:54aed3233e17ea6b2fe706",
};

// 웹 푸시 VAPID 키. ⚠️ 실 배포 시 Firebase Console > 프로젝트 설정 > 클라우드 메시징 >
// 웹 푸시 인증서(웹 구성)에서 생성한 키를 붙여넣는다. 비어 있으면 FCM 은 자동 비활성(로컬 안전).
export const VAPID_KEY = "";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 오프라인 읽기 캐시(영속) — 네트워크가 끊겨도 최근 리더보드/미션/공동합산이 보인다.
// IndexedDB 불가 환경(사생활 모드 등)은 기본 캐시로 폴백.
function makeDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    return getFirestore(app);
  }
}
export const db = makeDb();
export const functions = getFunctions(app);

// localhost/127.0.0.1 에서 열리면 에뮬레이터에 연결. (IPv6 ::1 회피 위해 hostname 그대로 사용)
export const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if (isLocal) {
  const h = location.hostname;
  connectAuthEmulator(auth, `http://${h}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, h, 8080);
  connectFunctionsEmulator(functions, h, 5001);
}
