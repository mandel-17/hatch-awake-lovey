# SPEC — 깨! 실시간 미션 앱

채팅 맥락 없이도 구현할 수 있도록 모든 결정을 여기 모았습니다. 충돌 시 이 문서가 단일 출처입니다.

---

## 1. 제품 개요

수련회 한 타임(2일차 오후 13:30–16:30) 동안 진행하는 **자유 탐험형 미션 게임 + 라이브 공동 목표** 앱.

- **컨셉**: 마리오 세계. 쿠파의 저주로 요시가 다시 알 속에 잠듦 = 잠든 믿음. 팀들이 흩어져 미션을 깨고(코인) 마지막에 함께 기도할 때 알이 깨진다(깨!). 주제 "깨!" = 알을 **깨**고 · 잠을 **깨**고 · **깨**(기쁨)가 쏟아지다. 주제말씀 에베소서 5:8-10(어둠→빛, 분별, 빛의 열매).
- **핵심 루프**: 미션 클리어 → 코인 획득(팀별 적립) → 전체 합산. **합산 10,000 코인** 도달 → 관리자가 부화 트리거 → 알 깨짐 연출(전 기기 동시) + **인당 15,000원 셀모임비** 지급.
- **협력+경쟁**: 팀은 코인 순위로 경쟁. 그러나 보상·부화는 한 팀 힘으론 불가, 전체가 함께 10,000을 채워야 모두 받는다.
- **규모**: 10–12팀 × 5–8명(≈50–90명). 미션 수 ≥ 팀 수(줄서기 방지).

---

## 2. 역할 & 화면

세 역할이 **같은 데이터**를 각자 시점으로 본다. 차이는 "무엇을 보여주고 무엇을 쓰게 하는가".

### 관리자 (운영본부) — 노트북/태블릿 + 프로젝터, 관리자 PIN/클레임
- A1 라이브 대시보드: 공동 카운터/10,000 + 깨지는 알 + 전체 리더보드 + 최근 로그
- A2 프로젝터 뷰(풀스크린): 카운터+알+상위3팀, 컨트롤 없음, 부화 연출 송출
- A3 코인 입력: 팀×미션 클리어 입력(B단계 본부 입력 경로) + 수동 가감 + 마지막 취소
- A4 스테이션 코드: 미션별 QR/코드 목록(인쇄용)
- A5 설정/클라이맥스: 목표·보상·시간, **부화 트리거**, **팀 직접 보고 토글(B↔A)**, 알림 발송

### 팀 리더 — 본인 폰, 팀 코드 + 리더
- L1 우리 팀 홈: 우리 팀 코인·순위 + 공동 진행 + (알)
- L2 미션 보고: QR 스캔/코드 입력 → 서버 검증 → 적립. 승인 대기/결과(승인제 시)
- L3 미션 지도·체크리스트: 깬/남은 미션, 줄 적은 곳

### 팀원 — 본인 폰, 팀 코드 + 이름
- M1 응원 홈: 공동 카운터+알 + 우리 팀 현황·순위
- M2 미션 지도: 어디로 갈지, 미션·코인 값, 깬 것 표시

### 권한 매트릭스 (요약)
| 기능 | 관리자 | 리더 | 팀원 |
|---|:--:|:--:|:--:|
| 카운터·알·순위 보기 | ● | ● | ● |
| 미션 클리어 보고 | ●(대리) | ● | △ 정책 |
| 클리어 승인 | ● | — | — |
| 코인 수동 가감/취소 | ● | — | — |
| 미션/코인/설정 편집 | ● | — | — |
| 팀·코드 발급 | ● | — | — |
| 부화 트리거 | ● | — | — |
| 프로젝터 송출 | ● | — | — |

---

## 3. 게임 콘텐츠 (월드 · 미션 · 코인 · 코드)

미션을 테마별 **월드**로 묶어 운영(존). **스테이지 = 개별 미션**(클리어 시 코인). 자유 탐험.

| 코드 | 미션 | 코인 | 월드 |
|---|---|--:|---|
| `W-MEM` | 성경 구절 팀 전 외우기 | 200 | 말씀의 땅 |
| `W-OX` | 성경 OX 게임 | 50 | 말씀의 땅 |
| `W-MIX` | 성경 단어 섞기 맞히기(도그수리예스→그리스도 예수) | 150 | 말씀의 땅 |
| `W-DRAW` | 성경 그림 10초 이어그리기(물고기 다섯 마리 등) | 100 | 말씀의 땅 |
| `W-CROSS` | 십자말풀이(정적) | 150 | 말씀의 땅 |
| `P-LYR` | 찬양 가사 읽어주면 제목 맞히기 | 100 | 찬양의 하늘 |
| `P-INT` | 전주 듣고 찬양 맞히기 | 50 | 찬양의 하늘 |
| `A-BODY` | 성경 인물 몸으로 말해요 | 100 | 액션 월드 |
| `A-CURL` | 컬링 — 예수님 품에 가까이 | 100 | 액션 월드 |
| `A-TONE` | 높낮이 말하기(대표 3명) | 50 | 액션 월드 |
| `PR-CARD` | 기도 카드 / 중보 릴레이(참여형) | 30 | 기도의 골방 |

- **요시의 쉼터**(휴식·상점): 수박·간식. 코인 미션 아님(상점 코인 사용은 추후 옵션, 기본은 무료).
- **추가 미션 예정**: 운영팀이 미션을 더 줄 예정 → `missions` 컬렉션/`seed.json`에 추가만 하면 됨. 새 월드 추가 가능.
- **코인 경제**: 목표 10,000. 보정 예시 — 12팀 × 평균 10미션 × ~85코인 ≈ 10,200. 미션이 늘면 값으로 난이도 조정. **리허설로 최종 보정**.

---

## 4. 데이터 스키마 (Firestore)

```
events/{eventId}                // 단일 이벤트 문서 (예: id "main")
  goal: 10000
  reward: 15000
  total: 0                      // 공동 코인 합산 (FieldValue.increment)
  hatched: false
  hatchedAt: null               // serverTimestamp
  allowLeaderSubmit: true       // B(false)↔A(true) 토글
  startsAt, endsAt

teams/{teamId}
  name: "1팀"
  code: "X7Q2"                  // 입장 비밀번호 (운영 시 랜덤 권장)
  memberCount: 0
  coins: 0                      // 비정규화 (increment)

missions/{missionId}
  world, name
  coins: 50
  code: "W-OX"                  // 스테이션 코드 (대문자, 유니크)
  active: true
  // L2 채택 시: stationNonce, nonceExpiresAt

clears/{clearId}                // clearId = `${teamId}_${missionId}`  ← 팀당 1회/멱등
  teamId, missionId, amount
  by: "leader" | "admin"
  byName, ts                    // serverTimestamp

members/{uid}                   // uid = anonymous auth uid
  teamId, name, fcmToken, joinedAt
```

인덱스: `clears` where(`teamId`==) ; `teams` orderBy(`coins` desc).

---

## 5. Cloud Functions (Node 20, v2 onCall)

모든 코인 변경은 함수 안에서만. 시그니처:

```js
joinTeam({ code, name, fcmToken }) -> { teamId, teamName }
  // 익명 인증 필수. code로 팀 조회 → members/{uid} 생성, memberCount++,
  // FCM 토픽 event_all·team_{teamId} 구독. (관리자는 별도 관리자 코드)

submitClear({ teamId, missionCode }) -> { ok, coins }
  // 호출자=그 팀 소속 or 관리자. allowLeaderSubmit=false면 리더 거부(B단계).
  // 미션 존재·active 확인. 트랜잭션:
  //   clears/{teamId_missionId} 이미 있으면 거부(already-cleared)
  //   set clear ; teams.coins += coins ; events.total += coins (모두 increment)

adminAdjust({ teamId, amount, reason }) -> { ok }   // 관리자 전용. 수동 가감 + 로그.

triggerHatch() -> { ok }                            // 관리자 전용. 가드 total>=goal.
                                                    // events.hatched=true, hatchedAt=now.

setConfig({ allowLeaderSubmit?, goal?, reward? }) -> { ok }  // 관리자 전용.

notify({ topic, title, body }) -> { ok }            // 관리자 전용. FCM 토픽 발송.
```

(선택) Firestore 트리거: `events` 업데이트 감시 → `total>=goal` 최초 도달 시 `admins` 토픽에 "도달! 트리거 준비" 푸시(자동 부화는 X).

### submitClear 트랜잭션 (핵심 로직)
```js
const m = await findMissionByCode(missionCode);          // active 확인
const clearId = `${teamId}_${m.id}`;
await db.runTransaction(async tx => {
  if ((await tx.get(clearRef(clearId))).exists) throw 'already-cleared';
  tx.set(clearRef(clearId), { teamId, missionId:m.id, amount:m.coins,
    by: isAdmin?'admin':'leader', byName, ts: now });
  tx.update(teamRef(teamId),  { coins: increment(m.coins) });
  tx.update(eventRef(EVENT),  { total: increment(m.coins) });
});
```

---

## 6. 보안 규칙 (firestore.rules)

```
match /events/{e}   { allow read: if signedIn; allow write: if false; }
match /teams/{t}    { allow read: if signedIn; allow write: if false; }
match /missions/{m} { allow read: if signedIn; allow write: if false; }
match /clears/{c}   { allow read: if signedIn; allow write: if false; }
match /members/{u}  { allow read:   if isOwner(u) || isAdmin();
                      allow create: if isOwner(u);
                      allow update: if isOwner(u); }
// coins/total/clears 는 write:false → Cloud Functions(Admin SDK)만 변경
// signedIn = request.auth != null ; isOwner(u)= request.auth.uid==u ; isAdmin()= request.auth.token.admin==true
```

---

## 7. 실시간 구독 (client)

```js
onSnapshot(doc("events", EVENT), d => { renderTotal(d.total, d.goal);
  if (d.hatched) playHatch(d.hatchedAt); });               // 부화 전 기기 동시
onSnapshot(query(col("teams"), orderBy("coins","desc")), renderLeaderboard);
onSnapshot(query(col("clears"), where("teamId","==", myTeamId)), renderChecklist);
```
공동 카운터는 단일 문서라 90명이 들어도 가볍다.

---

## 8. QR / 검증

- QR 내용 = 미션 코드 문자열(예: `W-OX`) 또는 `?scan=W-OX` 링크. 리더 폰이 `html5-qrcode`로 스캔 → 코드 추출 → `submitClear`.
- 부정방지 단계: **L1 고정 코드**(기본) / **L2 회전 토큰**(권장, 코드+토큰 검증) / **L3 스태프 확인**(최강). L1로 시작, 관리자 이상치 감사, 필요 시 L2.

## 9. 푸시 (FCM 토픽)
- `event_all`(전체: 집결/중간집계/부화), `team_{id}`(팀 공지/승인 결과), `admins`(도달 알림).
- 입장 시 토큰 등록·토픽 구독. 웹푸시 권한 안내, **PWA 설치 유도**(iOS는 설치 후에만 동작).

## 10. 부화 트리거 (라이브 동시 연출)
`total>=goal` → admins 알림 → 관리자가 "부화!" → `triggerHatch()` → `events.hatched=true` → 전 기기 구독 발화 → 깨! 연출 동시 재생.

---

## 11. 비기능 요구사항
- **신뢰성**: 오프라인 시 보고 큐+재시도(멱등 `clearId`로 중복 없음). 읽기 오프라인 캐시. **종이 백업 병행**.
- **네트워크**: 전용 와이파이/AP + 셀룰러 폴백. 행사 전 **90명 동시 부하 테스트**.
- **보안**: 코인 쓰기 서버 전용. 관리자 함수 클레임 보호. 부화 가드.
- **운영**: 미션 수 ≥ 팀 수. 관리자 이상치(비현실적 속도) 감시.
- **접근성**: 모바일 우선, 큰 글씨, 키보드 포커스, reduced-motion 존중.

## 12. 시드
`data/seed.json` 참조(이벤트 1, 팀 12+코드, 위 미션 11). `scripts/seed.js`로 주입. **운영 시 팀 코드는 랜덤화**.
