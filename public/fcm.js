// 깨! FCM 웹 푸시 — 토큰 발급 + 포그라운드 수신.
// 로컬(에뮬레이터)·VAPID 미설정·미지원 브라우저에선 완전 비활성(입장 흐름을 막지 않는다).
import { app, isLocal, VAPID_KEY } from "./firebase-init.js";
import {
  isSupported,
  getMessaging,
  getToken,
  onMessage,
} from "./vendor/firebase/firebase-messaging.js";

let messaging = null;
let foregroundBound = false;

// FCM 을 시도할 수 있는 환경인지. 로컬(에뮬레이터)이거나 VAPID 미설정이면 비활성.
function fcmEnabled() {
  return !isLocal && !!VAPID_KEY && "Notification" in window;
}

/**
 * setupPush(swRegistration, onForeground?) -> Promise<string|null>
 * 알림 권한 요청 → FCM 토큰 발급. 비활성/실패/거부 시 null 반환(절대 throw 안 함).
 * 반환된 토큰은 joinTeam 으로 넘겨 서버에서 토픽 구독에 사용한다.
 */
export async function setupPush(swRegistration, onForeground) {
  try {
    if (!fcmEnabled()) return null;
    if (!(await isSupported())) return null;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    if (!messaging) messaging = getMessaging(app);

    // 포그라운드 수신은 한 번만 바인딩.
    if (!foregroundBound) {
      foregroundBound = true;
      onMessage(messaging, (payload) => {
        const n = payload?.notification || {};
        if (typeof onForeground === "function") onForeground(n.title, n.body);
      });
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration || undefined,
    });
    return token || null;
  } catch (e) {
    console.warn("FCM setup skipped:", e?.message || e);
    return null;
  }
}
