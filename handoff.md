# HANDOFF — 깨! (KKAE) 앱

이 문서는 MVP 이후 이어서 작업할 사람을 위한 인수인계 노트입니다. 기능 상세는 `SPEC.md`, 디자인은 `DESIGN.md`, 단계는 `BUILD_PLAN.md`, 실행은 `README.md` 참조.

---

## 1. 현재 상태 (이번 빌드에서 완료)

**에뮬레이터 우선 / 코드만** 으로 핵심 MVP를 완성하고 전부 검증했다.

- **백엔드** — `firestore.rules`(coins/total/clears/adjustments 클라 쓰기 `if false`), Cloud Functions 7종:
  `joinTeam`(+FCM 토픽 구독) · `submitClear`(결정적 `clearId`·트랜잭션·`increment`·`allowLeaderSubmit` 가드) · `adminAdjust`(+`adjustments` 감사로그) · `triggerHatch`(목표 가드·멱등) · `setConfig` · `setAdmin`(부트스트랩 코드) · `notify`(관리자 토픽 푸시).
- **클라이언트** — 3역할 화면(`public/views/{admin,leader,member}.js`), 공용 렌더(`shared.js`: communal/eggSVG/leaderboard/checklist/playHatch), 실시간 `onSnapshot` 구독(`app.js`), QR 스캔(`html5-qrcode`), 다크→빛 부화 연출.
- **FCM + PWA** (이번 빌드 추가) — `fcm.js`(권한·토큰, 로컬/더미선 자동 비활성) → `joinTeam(fcmToken)`; `notify` + 관리자 "📣 푸시 발송" 패널(집결/중간집계/커스텀). `manifest.json` + 단일 `sw.js`(앱셸 캐시 + compat importScripts FCM 백그라운드) + 오리지널 알 아이콘(`public/icons/`). 메시징 SDK는 `firebase@10.14.1`에서 `public/vendor/firebase/`로 벤더링(모듈러 1 + compat 2).
- **오프라인 큐 + 부하 테스트** (이번 빌드 추가) — `outbox.js`(실패 보고 큐잉·자동 재전송, 단위테스트 8) + Firestore 영속 캐시 → 오프라인 내성. `scripts/loadtest.js` 로 90 동시 부하 측정: **무결성 항상 정확**, 단 `events.total` 단일 핫 필드 경합으로 동시 버스트 처리량 한계 발견(§2 D 참조).
- **테스트** — 단위 8/8(outbox), 규칙 11/11, 함수 11/11 통과(notify 가드 2건). `npm test` 가 macOS에서도 동작(함수 테스트 hosting 제외). 브라우저 검증: SW 등록·활성, manifest 유효, 모듈 로드, FCM 게이트, 푸시 패널·`notify` 호출, 영속캐시 db로 앱 정상 로드·구독. *Playwright 2탭 E2E는 이 빌드에서 재실행 안 함(hosting:5000 = macOS AirPlay).*

검증 명령: `npm test` / `npm run emu` + `npm run seed`.

---

## 2. 보류된 작업 (다음 단계, 우선순위 순)

### ✅ A. FCM 푸시 — 완료 (이번 빌드)
`notify({topic,title,body})`(관리자 전용, `getMessaging().send`) 추가, `joinTeam` 토픽 구독(`subscribeToTopic`, 토큰 있을 때만·try/catch 로 입장 비차단) 활성화, 클라 `fcm.js`(`getToken({vapidKey, serviceWorkerRegistration})`, 로컬/더미선 자동 비활성) + 관리자 "📣 푸시 발송" 패널(집결/중간집계/커스텀). 메시징 SDK 벤더링 완료(모듈러 `firebase-messaging.js` + compat 2종). **실제 전송은 실 프로젝트 필요** — `README.md`의 "FCM 푸시 + PWA 활성화 체크리스트"(실 config 두 곳 + VAPID) 참조.

### ✅ B. PWA — 완료 (이번 빌드)
`manifest.json`(standalone/theme `#14224D`/아이콘 3) + **단일 `sw.js`**(앱셸 stale-while-revalidate 캐시 + compat importScripts FCM 백그라운드) + `index.html` manifest/apple-touch/PWA 메타 + `public/icons/`(오리지널 알, `scripts/make-icons.js`로 생성, sharp). 별도 `firebase-messaging-sw.js` 대신 `sw.js` 하나로 통합(루트 스코프 충돌 회피, `getToken`에 registration 전달).

### ✅ C. 오프라인 큐 + 재시도 — 완료 (이번 빌드)
`public/outbox.js`(순수 모듈, 단위테스트 8건 `tests/outbox.test.js`): submitClear 실패가 네트워크/`internal`/`deadline-exceeded` 계열이면 `localStorage`(`kkae.outbox`) 큐잉 + 온라인 복귀·부팅 시 자동 재전송(clearId 멱등 → 중복 안전). 논리 거부(already-exists·not-found·permission-denied)는 큐잉하지 않음. 리더/관리자 보고는 `ctx.reportClear` 경유, 좌하단 "미전송 N건" 뱃지. Firestore 읽기 영속 캐시(`initializeFirestore`+`persistentLocalCache`+멀티탭, IndexedDB 불가 시 자동 폴백).

### ✅ D. 부하 테스트 — 완료 (이번 빌드) · ⚠ 발견
`scripts/loadtest.js`(`npm run loadtest`; 옵션 `N`·`CONCURRENCY`·`CALL_TIMEOUT`). distinct (팀,미션) 동시 submitClear → **무결성**(`events.total == clears 합계`, 팀 coins == 팀 clears 합) + 처리량·지연 측정.
- **무결성은 항상 정확**(원자적 increment·clearId 멱등 → 유실/중복 0). 에뮬레이터 측정값:
  - 버스트 90 동시: 성공 12/90, 지연 p50 15s, 무결성 ✅ (실패는 전부 `deadline-exceeded` — 커밋 안 됨, 코인 오류 아님).
  - 동시 8(현실적): 성공 84/90, 지연 p50 22ms, 무결성 ✅.
- **병목**: `events.total` 단일 핫 필드(+팀 문서)에 트랜잭션이 경합 → 동시 버스트가 크면 일부 `functions/internal`/`deadline-exceeded`. 에뮬레이터는 운영 Firestore보다 훨씬 느리다(운영도 단일 문서 지속 쓰기 ~1/s 한계는 존재).
- **완화**: C 의 아웃박스가 이 실패들을 큐잉·재시도하므로 보고가 결국 모두 적립된다. 현장 보고는 시간에 분산돼 보통 문제없다.
- **선택지(미적용 — 사용자 결정 필요)**: 동기 버스트가 우려되면 `events.total` 을 **분산 카운터(샤딩)** 로 전환. 단 CLAUDE.md "절대 규칙"(단일 `events.total`)과 충돌하므로 설계 변경 결정이 필요하다.

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
- **Java 필요(에뮬레이터)**: 없으면 `java -version` 이 설치 안내만 출력. macOS: `brew install openjdk` 후 PATH 앞에 `/opt/homebrew/opt/openjdk/bin` 추가(keg-only). 예: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH" && npm test`.
- **macOS 포트 5000 = AirPlay**: hosting 에뮬레이터가 `5000` 바인딩 실패하면 ControlCenter(AirPlay 수신기)가 점유 중. 시스템 설정 > 일반 > AirDrop·Handoff > "AirPlay 수신 모드" 끄거나, 함수 테스트는 hosting 없이 `firebase emulators:exec --only auth,functions,firestore "..."` 로 실행(함수 테스트는 hosting 불필요).
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
| FCM 토큰·권한(클라) | `public/fcm.js`, `public/firebase-init.js`(`VAPID_KEY`) |
| 서비스워커(앱셸+FCM 백그라운드) | `public/sw.js` |
| PWA 매니페스트·아이콘 | `public/manifest.json`, `public/icons/`, `scripts/make-icons.js` |
| 오프라인 큐(실패 보고 재시도) | `public/outbox.js` (단위테스트 `tests/outbox.test.js`) |
| 부하 테스트(동시성·무결성) | `scripts/loadtest.js` (`npm run loadtest`) |
| 미션/팀/이벤트 데이터 | `data/seed.json` |
| 에뮬레이터/호스팅 설정 | `firebase.json`, `.firebaserc` |
