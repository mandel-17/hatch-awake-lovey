/**
 * 깨! Cloud Functions (Node 20+, v2 onCall)
 *
 * 절대 규칙: 코인에 영향 주는 모든 쓰기(teams.coins, events.total, clears, adjustments)는
 * 오직 여기(Admin SDK)에서만 일어난다. 클라이언트는 firestore.rules 로 차단(write: false).
 * clearId = `${teamId}_${missionId}` 결정적 생성 → 팀당 미션 1회 + 재시도 멱등.
 * 공동 합산은 events.total 단일 필드를 FieldValue.increment 로 트랜잭션 갱신.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

const EVENT_ID = "main";
const eventRef = () => db.collection("events").doc(EVENT_ID);
const teamRef = (id) => db.collection("teams").doc(id);
const memberRef = (uid) => db.collection("members").doc(uid);
const clearRef = (id) => db.collection("clears").doc(id);

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  return request.auth;
}

function requireAdmin(request) {
  const auth = requireAuth(request);
  if (auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
  return auth;
}

/**
 * joinTeam({ code, name, fcmToken }) -> { teamId, teamName }
 * 팀 코드로 입장. members/{uid} 생성(신규일 때만 memberCount++). 익명 인증 필수.
 */
exports.joinTeam = onCall(async (request) => {
  const auth = requireAuth(request);
  const { code, name, fcmToken } = request.data || {};
  if (!code || !name) {
    throw new HttpsError("invalid-argument", "팀 코드와 이름이 필요합니다.");
  }

  const snap = await db
    .collection("teams")
    .where("code", "==", String(code).trim())
    .limit(1)
    .get();
  if (snap.empty) {
    throw new HttpsError("not-found", "팀 코드를 찾을 수 없습니다.");
  }
  const team = snap.docs[0];
  const teamId = team.id;
  const teamName = team.get("name");

  await db.runTransaction(async (tx) => {
    const mref = memberRef(auth.uid);
    const mdoc = await tx.get(mref);
    const isNew = !mdoc.exists;
    const base = { teamId, name: String(name).trim(), fcmToken: fcmToken || null };
    if (isNew) base.joinedAt = FieldValue.serverTimestamp();
    tx.set(mref, base, { merge: true });
    if (isNew) tx.update(teamRef(teamId), { memberCount: FieldValue.increment(1) });
  });

  // FCM 토픽 구독: 토큰이 있을 때만. 에뮬레이터엔 FCM 백엔드가 없어 throw 하므로
  // try/catch 로 감싸 입장(joinTeam)을 절대 막지 않는다.
  if (fcmToken) {
    try {
      await getMessaging().subscribeToTopic(fcmToken, ["event_all", "team_" + teamId]);
    } catch (e) {
      console.warn("FCM subscribeToTopic skipped:", e?.message || e);
    }
  }
  return { teamId, teamName };
});

/**
 * submitClear({ teamId, missionCode }) -> { ok, coins }
 * 미션 클리어 보고. 트랜잭션 + 결정적 clearId 로 멱등. 코인은 여기서만 적립.
 */
exports.submitClear = onCall(async (request) => {
  const auth = requireAuth(request);
  const { teamId, missionCode } = request.data || {};
  if (!teamId || !missionCode) {
    throw new HttpsError("invalid-argument", "팀과 미션 코드가 필요합니다.");
  }

  const isAdmin = auth.token.admin === true;

  // 권한: 관리자(대리 보고) 또는 본인이 해당 팀 소속이어야 한다.
  let byName = "관리자";
  if (!isAdmin) {
    const mdoc = await memberRef(auth.uid).get();
    if (!mdoc.exists || mdoc.get("teamId") !== teamId) {
      throw new HttpsError("permission-denied", "본인 팀의 미션만 보고할 수 있습니다.");
    }
    byName = mdoc.get("name") || "팀원";
  }

  // B단계 토글: allowLeaderSubmit=false 면 리더 직접 보고 차단(관리자는 허용).
  const ev = await eventRef().get();
  if (!isAdmin && ev.get("allowLeaderSubmit") === false) {
    throw new HttpsError("permission-denied", "지금은 본부 입력만 가능합니다.");
  }

  // 미션 조회: 코드 → 미션. active 확인.
  const code = String(missionCode).trim().toUpperCase();
  const msnap = await db
    .collection("missions")
    .where("code", "==", code)
    .limit(1)
    .get();
  if (msnap.empty) {
    throw new HttpsError("not-found", "미션 코드를 찾을 수 없습니다.");
  }
  const mission = msnap.docs[0];
  if (mission.get("active") === false) {
    throw new HttpsError("failed-precondition", "지금은 보고할 수 없는 미션입니다.");
  }
  const missionId = mission.id;
  const amount = mission.get("coins");

  const clearId = `${teamId}_${missionId}`;
  await db.runTransaction(async (tx) => {
    const [cdoc, tdoc] = await Promise.all([
      tx.get(clearRef(clearId)),
      tx.get(teamRef(teamId)),
    ]);
    if (!tdoc.exists) throw new HttpsError("not-found", "팀을 찾을 수 없습니다.");
    if (cdoc.exists) throw new HttpsError("already-exists", "이미 깬 미션입니다.");
    tx.set(clearRef(clearId), {
      teamId,
      missionId,
      amount,
      by: isAdmin ? "admin" : "leader",
      byName,
      ts: FieldValue.serverTimestamp(),
    });
    tx.update(teamRef(teamId), { coins: FieldValue.increment(amount) });
    tx.update(eventRef(), { total: FieldValue.increment(amount) });
  });

  return { ok: true, coins: amount };
});

/**
 * adminAdjust({ teamId, amount, reason }) -> { ok }
 * 관리자 수동 가감(+감사 로그). amount 는 음수 허용.
 */
exports.adminAdjust = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { teamId, amount, reason } = request.data || {};
  const amt = Number(amount);
  if (!teamId) throw new HttpsError("invalid-argument", "팀이 필요합니다.");
  if (!Number.isFinite(amt) || amt === 0) {
    throw new HttpsError("invalid-argument", "유효한 금액이 필요합니다.");
  }

  await db.runTransaction(async (tx) => {
    const tdoc = await tx.get(teamRef(teamId));
    if (!tdoc.exists) throw new HttpsError("not-found", "팀을 찾을 수 없습니다.");
    tx.update(teamRef(teamId), { coins: FieldValue.increment(amt) });
    tx.update(eventRef(), { total: FieldValue.increment(amt) });
    tx.set(db.collection("adjustments").doc(), {
      teamId,
      amount: amt,
      reason: reason || null,
      byUid: auth.uid,
      ts: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

/**
 * triggerHatch() -> { ok, already }
 * 관리자 전용. 가드 total>=goal. events.hatched=true, hatchedAt=now. 멱등.
 */
exports.triggerHatch = onCall(async (request) => {
  requireAdmin(request);
  let already = false;
  await db.runTransaction(async (tx) => {
    const ev = await tx.get(eventRef());
    if (!ev.exists) throw new HttpsError("not-found", "이벤트가 없습니다.");
    if (ev.get("hatched") === true) {
      already = true;
      return;
    }
    const total = ev.get("total") || 0;
    const goal = ev.get("goal") || 0;
    if (total < goal) {
      throw new HttpsError("failed-precondition", `아직 목표 미달입니다 (${total}/${goal}).`);
    }
    tx.update(eventRef(), {
      hatched: true,
      hatchedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, already };
});

/**
 * setConfig({ allowLeaderSubmit?, goal?, reward? }) -> { ok, patch }
 * 관리자 전용. 화이트리스트 필드만 갱신.
 */
exports.setConfig = onCall(async (request) => {
  requireAdmin(request);
  const { allowLeaderSubmit, goal, reward } = request.data || {};
  const patch = {};
  if (typeof allowLeaderSubmit === "boolean") patch.allowLeaderSubmit = allowLeaderSubmit;
  if (goal !== undefined && Number.isFinite(Number(goal))) patch.goal = Number(goal);
  if (reward !== undefined && Number.isFinite(Number(reward))) patch.reward = Number(reward);
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "변경할 설정이 없습니다.");
  }
  await eventRef().update(patch);
  return { ok: true, patch };
});

/**
 * notify({ topic?, title, body }) -> { ok, id }
 * 관리자 전용. 토픽 푸시 발송(기본 event_all). title/body 필수.
 * 주의: 에뮬레이터엔 FCM 백엔드가 없어 send 가 실패한다 → 실 배포에서만 실제 전송된다.
 * (인증·인자 가드는 send 이전이라 에뮬레이터 테스트로 검증 가능.)
 */
exports.notify = onCall(async (request) => {
  requireAdmin(request);
  const { topic, title, body } = request.data || {};
  if (!title || !body) {
    throw new HttpsError("invalid-argument", "제목과 내용이 필요합니다.");
  }
  const t = String(topic || "event_all").trim();
  try {
    const id = await getMessaging().send({
      topic: t,
      notification: { title: String(title), body: String(body) },
    });
    return { ok: true, id };
  } catch (e) {
    throw new HttpsError("internal", "푸시 전송 실패: " + (e?.message || "알 수 없는 오류"));
  }
});

/**
 * setAdmin({ bootstrapCode, targetUid? }) -> { ok, uid }
 * 부트스트랩 코드(env ADMIN_BOOTSTRAP, 기본 'KKAE-ADMIN')로 관리자 클레임 부여.
 * 클레임 부여 후 클라는 getIdToken(true) 로 토큰 강제 갱신해야 한다.
 */
// 운영에서만 Secret Manager 의 ADMIN_BOOTSTRAP 을 바인딩한다. 에뮬레이터에서 secrets 를 선언하면
// 함수 디스커버리가 시크릿을 못 찾아 "Cannot determine backend specification" 타임아웃이 나므로,
// FUNCTIONS_EMULATOR 환경에선 선언하지 않고 아래 기본값으로 폴백한다(운영 배포 시에만 시크릿 주입).
const setAdminOpts = process.env.FUNCTIONS_EMULATOR ? {} : { secrets: ["ADMIN_BOOTSTRAP"] };
exports.setAdmin = onCall(setAdminOpts, async (request) => {
  const auth = requireAuth(request);
  const { bootstrapCode, targetUid } = request.data || {};
  // 운영: 시크릿 주입값. 에뮬레이터/미설정: 기본값 폴백.
  const expected = process.env.ADMIN_BOOTSTRAP || "KKAE-ADMIN";
  if (!bootstrapCode || String(bootstrapCode) !== expected) {
    throw new HttpsError("permission-denied", "관리자 코드가 올바르지 않습니다.");
  }
  const uid = targetUid || auth.uid;
  await getAuth().setCustomUserClaims(uid, { admin: true });
  return { ok: true, uid };
});
