# HANDOFF — 깨! (KKAE) 앱

이 문서는 MVP 이후 이어서 작업할 사람을 위한 인수인계 노트입니다. 기능 상세는 `SPEC.md`, 디자인은 `DESIGN.md`, 단계는 `BUILD_PLAN.md`, 실행은 `README.md` 참조.

---

## 1. 현재 상태 (이번 빌드에서 완료)

**에뮬레이터 우선 / 코드만** 으로 핵심 MVP를 완성하고 전부 검증했다.

- **백엔드** — `firestore.rules`(coins/total/clears/adjustments 클라 쓰기 `if false`), Cloud Functions 6종:
  `joinTeam` · `submitClear`(결정적 `clearId`·트랜잭션·`increment`·`allowLeaderSubmit` 가드) · `adminAdjust`(+`adjustments` 감사로그) · `triggerHatch`(목표 가드·멱등) · `setConfig` · `setAdmin`(부트스트랩 코드).
- **클라이언트** — 3역할 화면(`public/views/{admin,leader,member}.js`), 공용 렌더(`shared.js`: communal/eggSVG/leaderboard/checklist/playHatch), 실시간 `onSnapshot` 구독(`app.js`), QR 스캔(`html5-qrcode`), 다크→빛 부화 연출.
- **테스트** — 규칙 11/11, 함수 9/9 통과. Playwright 2탭 E2E(보고→교차탭 반영→중복 거부→부화 동시 연출) 통과.

검증 명령: `npm test` / `npm run emu` + `npm run seed`.

---

## 2. 보류된 작업 (다음 단계, 우선순위 순)

### A. FCM 푸시 (`notify` + 토픽 구독) — SPEC §9
- `functions/index.js` 에 `notify({topic,title,body})`(관리자 전용) 추가 → `admin.messaging().send({topic,...})`.
- `joinTeam` 의 `// TODO FCM` 자리에서 `admin.messaging().subscribeToTopic(fcmToken, ['event_all', 'team_'+teamId])` 활성화. (지금은 fcmToken 을 members 에 저장만 함.)
- 클라: `firebase-messaging.js`(벤더 추가 필요 — `node_modules/firebase/firebase-messaging.js` 를 `public/vendor/firebase/` 로 복사 후 gstatic 절대 import 를 `./firebase-app.js` 로 치환, 기존 벤더링과 동일 방식), `getToken(messaging,{vapidKey})` 로 토큰 받아 `joinTeam` 에 전달.
- **주의**: 웹푸시는 PWA 설치 + HTTPS + 사용자 권한 필요. iOS 는 홈화면 설치 후에만 동작. 에뮬레이터로는 실제 푸시 검증 불가 → 실 프로젝트에서 테스트.
- 관리자 UI(A5)에 발송 버튼(집결/중간집계) 추가.

### B. PWA (설치 + 오프라인 셸) — SPEC §9
- `public/manifest.json`(name/icons/display:standalone/theme_color `#14224D`), `public/sw.js`(앱 셸 + 벤더 캐시), `index.html` 에 `<link rel="manifest">` + 서비스워커 등록.
- 아이콘은 팔레트 기반 오리지널 도형(닌텐도 자산 금지). 알 이모지 파비콘은 이미 인라인으로 있음.
- FCM 백그라운드 수신은 `firebase-messaging-sw.js` 필요.

### C. 오프라인 큐 + 재시도 — SPEC §11
- `submitClear` 는 이미 `clearId` 로 멱등이라 재시도 안전. 클라에서 실패한 보고를 `localStorage` 큐에 넣고 온라인 복귀 시 재전송.
- Firestore 읽기 오프라인 캐시: `initializeFirestore(app,{localCache: persistentLocalCache()})` 로 전환 고려(현재 `getFirestore` 기본).

### D. 부하 테스트 (≈90 동시) — SPEC §11 / BUILD_PLAN Phase 7
- `scripts/` 에 N개 익명 유저 동시 `submitClear` 부하 스크립트 작성(emulator + 실 프로젝트). `events.total` 정확성·지연 측정. (함수 테스트의 동시성 케이스를 90 스케일로 확장.)

### E. 실배포 — README "실배포" 절 참조
- 원격 컨테이너에선 불가. 실 환경에서 `firebase login` → Blaze 프로젝트 → `public/firebase-init.js` 의 `firebaseConfig` 를 실값으로 교체 → `firebase deploy`.
- 운영 시: 팀 코드 랜덤화(`data/seed.json`), `ADMIN_BOOTSTRAP` 를 시크릿으로 설정, `seed.json` 의 `startsAt/endsAt` 실제 일시 입력.

### F. 잔여 UI 폴리시 (선택)
- 관리자 A2 **프로젝터 풀스크린 뷰**(컨트롤 없이 communal+상위3팀, 부화 송출) — 현재 미구현.
- A4 스테이션 **QR 이미지 생성/인쇄**(현재 코드 텍스트만). 오프라인 QR 생성 라이브러리 벤더링 필요.
- "마지막 취소"(clear 되돌리기) — 현재는 `adminAdjust` 음수 가감으로 보정. 진짜 undo 는 clear 삭제+감액 트랜잭션 추가 필요.

---

## 3. 핵심 결정 · 발견

- **기능 프로토타입 부재**: 문서가 전제한 `prototype.html`(렌더 함수 포팅 대상)은 저장소에 없었음. 정적 `kkae-style-tile.html`(디자인 타일)만 존재 → 클라이언트를 **신규 구현**. 타일 CSS 는 `public/styles.css` 로 이관, 타일은 `public/prototype.html` 로 보존.
- **CDN 차단**: 프록시가 `www.gstatic.com`·`cdn.jsdelivr.net` 차단. 그래서 Firebase SDK ESM 과 html5-qrcode 를 **`public/vendor/` 로 벤더링**(npm 패키지에서 복사). 벤더된 firebase 모듈의 gstatic 절대 import 는 `./firebase-app.js` 상대경로로 치환함. **새 SDK 모듈 추가 시 같은 치환 필요.** (Google Fonts 의 `fonts.googleapis.com`/`fonts.gstatic.com` 은 허용됨.)
- **Node 22**: functions 런타임을 22 로 고정(컨테이너 일치). `firebase-functions` 버전이 "outdated" 경고를 내지만 v2 API 정상 동작.
- **admin 인증**: `setAdmin({bootstrapCode})` 콜러블(env `ADMIN_BOOTSTRAP`, 기본 `KKAE-ADMIN`). 클레임 부여 후 클라가 `getIdToken(true)` 로 갱신해야 반영됨. 테스트/로컬용 `scripts/grant-admin.js <uid>` 도 있음.
- **`adjustments` 컬렉션**: SPEC §4 엔 없던 추가 스키마(수동 가감 감사·취소용). read 는 관리자만, write 는 함수만.
- **`members` 쓰기**: 규칙은 SPEC 대로 owner 허용이지만, MVP 는 `joinTeam` 함수 경로로 일원화(재입장 멱등, memberCount 정확).

---

## 4. 알아둘 함정 (Gotchas)

- **FieldValue 모듈러 import 필수**: Functions 에뮬레이터가 `admin.firestore` 네임스페이스를 래핑해 `admin.firestore.FieldValue` 가 런타임에 `undefined` 가 됨. 반드시 `const { getFirestore, FieldValue } = require("firebase-admin/firestore")` 모듈러 import 사용(이미 적용). standalone 스크립트(seed 등)에선 네임스페이스 접근도 동작함.
- **IPv6 `::1` 경고**: 에뮬레이터가 `::1` 바인딩 실패 경고를 내지만 `127.0.0.1` 은 정상. 클라(`firebase-init.js`)·스크립트는 `127.0.0.1` 사용으로 회피. `localhost` 가 `::1` 로 풀리는 환경 주의.
- **작업 디렉터리**: `npm run test:*` 와 `emulators:exec` 는 repo 루트(`firebase.json` 위치)에서 실행해야 함.
- **샌드박스 폰트**: 헤드리스 브라우저가 외부 폰트를 못 받아 스크린샷이 시스템 폰트로 보임. 실기기에선 Do Hyeon 등 웹폰트 정상.
- **테스트 격리**: 함수 테스트는 매 케이스마다 Firestore+Auth 를 REST 로 클리어(`/emulator/v1/...`). 규칙·함수 테스트를 별도 emulator 인스턴스로 실행(`npm test` 가 순차 실행).

---

## 5. 빠른 검증 (회귀 확인용)

```bash
npm test                       # 규칙 11 + 함수 9
npm run emu                    # 에뮬레이터
npm run seed                   # 시드 (또는 --total=10000 로 부화 데모)
# http://127.0.0.1:5000  · 관리자 PIN KKAE-ADMIN · 팀 TEAM1~12
```
2탭(관리자+리더)으로: 리더 `W-OX` 보고 → 관리자 +50 반영 → 재보고 거부 → total 10000 → 부화 트리거 → 동시 연출.

---

## 6. 파일 지도 (어디를 고치나)

| 하려는 것 | 파일 |
|---|---|
| 코인 적립 규칙/권한 | `functions/index.js` |
| 클라 쓰기 차단 규칙 | `firestore.rules` |
| 실시간 구독·상태·라우팅 | `public/app.js` |
| 공용 렌더(알·게이지·리더보드·체크리스트·부화) | `public/views/shared.js` |
| 역할 화면 | `public/views/{admin,leader,member}.js` |
| 디자인 토큰·컴포넌트 | `public/styles.css` |
| 미션/팀/이벤트 데이터 | `data/seed.json` |
| 에뮬레이터/호스팅 설정 | `firebase.json`, `.firebaserc` |
