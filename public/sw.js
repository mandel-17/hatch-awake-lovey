/* 깨! 서비스워커 — PWA 앱셸 캐시 + FCM 백그라운드 수신 (단일 클래식 워커).
 * 백그라운드 메시지는 compat 빌드를 importScripts 로 불러 처리한다
 * (type:module 서비스워커는 Safari/Firefox 미지원이라 호환성 위해 compat 사용).
 * SW 는 모듈 import 불가라 firebaseConfig 를 복제한다.
 * ⚠️ 실 배포 시: firebase-init.js 의 firebaseConfig 와 동일한 실값으로 교체할 것.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAOY4ouNDnbsNXPZhAAxpPd12bhEeXoq1I",
  authDomain: "hatch-awake-lovey.firebaseapp.com",
  projectId: "hatch-awake-lovey",
  storageBucket: "hatch-awake-lovey.firebasestorage.app",
  messagingSenderId: "67931948915",
  appId: "1:67931948915:web:54aed3233e17ea6b2fe706",
};

// --- FCM 백그라운드 수신 (config 가 실값일 때만 동작; 더미/미설정이면 catch 로 무시) ---
try {
  importScripts("/vendor/firebase/firebase-app-compat.js");
  importScripts("/vendor/firebase/firebase-messaging-compat.js");
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    self.registration.showNotification(n.title || "깨!", {
      body: n.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
  });
} catch (e) {
  // 더미 config(로컬) 또는 미설정 → 앱셸 캐시만 동작.
}

// --- PWA 앱셸 캐시 ---
const CACHE = "kkae-shell-v1";
const APP_SHELL = [
  "/", "/index.html", "/app.js", "/styles.css",
  "/firebase-init.js", "/fcm.js",
  "/views/shared.js", "/views/admin.js", "/views/leader.js", "/views/member.js",
  "/vendor/firebase/firebase-app.js",
  "/vendor/firebase/firebase-auth.js",
  "/vendor/firebase/firebase-firestore.js",
  "/vendor/firebase/firebase-functions.js",
  "/vendor/firebase/firebase-messaging.js",
  "/vendor/html5-qrcode.min.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 동일출처 GET 만 stale-while-revalidate. Firestore/Functions/폰트(크로스출처)·비-GET 은 패스스루
// → 실시간 구독·콜러블에 절대 개입하지 않는다.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        event.waitUntil(network); // 캐시 히트여도 백그라운드 갱신 보장
        return (
          cached ||
          network.then(
            (res) =>
              res || (req.mode === "navigate" ? cache.match("/index.html") : Response.error())
          )
        );
      })
    )
  );
});
