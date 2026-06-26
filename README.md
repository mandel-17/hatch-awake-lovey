# 깨! (KKAE) — 청년부 수련회 실시간 미션 앱

Mario × 에베소서 5:8-10 컨셉의 실시간 멀티기기 미션 게임. 팀이 미션을 깨면 코인을 얻고, 전체 합산 **10,000 코인** 도달 시 관리자가 부화를 트리거하면 전 기기에서 "요시의 알" 깨짐 연출이 동시에 재생된다.

> 상세: [`SPEC.md`](SPEC.md)(기능) · [`DESIGN.md`](DESIGN.md)(디자인) · [`BUILD_PLAN.md`](BUILD_PLAN.md)(작업 순서)

## 현재 상태 — 핵심 MVP (에뮬레이터 우선)

구현 완료:
- **백엔드**: `firestore.rules`(코인 쓰기 서버 전용) + Cloud Functions(`joinTeam`, `submitClear`, `adminAdjust`, `triggerHatch`, `setConfig`, `setAdmin`, `notify`) + 시드
- **클라이언트**: 3역할 화면(관리자/팀리더/팀원) + 실시간 `onSnapshot` 구독 + QR 스캔(`html5-qrcode`) + 부화 연출
- **FCM 푸시**: 관리자 `notify` 콜러블 + `joinTeam` 토픽 구독(`event_all`/`team_*`) + 클라 토큰 발급(`fcm.js`). 로컬/더미 config 에선 자동 비활성, 실제 전송은 실배포에서만(아래 체크리스트).
- **PWA**: `manifest.json` + 단일 서비스워커(`sw.js`: 앱셸 캐시 + FCM 백그라운드 수신) + 설치/오프라인 셸 + 오리지널 알 아이콘(`public/icons/`)
- **오프라인 내성**: 실패한 보고 자동 큐잉·재전송(`public/outbox.js`, clearId 멱등) + Firestore 영속 읽기 캐시
- **프로젝터 송출**: 관리자 → 🖥 풀스크린 송출 뷰(`views/projector.js`, 컨트롤 없이 공동합산+TOP3+부화)
- **테스트**: 단위(8, outbox) + 규칙(11) + 함수(11) — 모두 통과. 동시성 부하 테스트 `scripts/loadtest.js`(무결성·지연)

**잔여**: 실배포 실행(준비·런북은 완료 — `DEPLOY.md`), UI 폴리시(QR 이미지·clear 취소; 프로젝터 송출 뷰는 완료). 부하 테스트로 `events.total` 단일 핫 필드의 동시 버스트 처리량 한계를 발견(무결성은 항상 정확, 아웃박스 재시도로 완화) — handoff §2 D. (FCM 실제 전송 검증은 실 Firebase 프로젝트 필요 — 아래 "실배포" 참조)

## 사전 준비
- Node 20+ (개발은 Node 22에서 확인) · Java(에뮬레이터 필수) · 의존성 설치:
```bash
npm install            # 루트(firebase-tools 등)
npm install --prefix functions   # functions 의존성
```

## 실행 (로컬 에뮬레이터)
```bash
npm run emu            # 에뮬레이터 기동 (Firestore/Auth/Functions/Hosting/UI)
npm run seed           # 다른 터미널에서 시드 주입 (이벤트1·팀12·미션11)
# 앱: http://127.0.0.1:5000   ·   에뮬레이터 UI: http://127.0.0.1:4000
```
- 접속 후 역할 선택:
  - **팀원/팀 리더**: 팀 코드(`TEAM1`~`TEAM12`) + 이름으로 입장
  - **관리자**: PIN `KKAE-ADMIN` (env `ADMIN_BOOTSTRAP` 로 변경 가능)
- 부화 데모: `npm run seed -- --total=10000` 로 합산을 목표까지 올린 뒤 관리자 화면에서 **부화 트리거**.

## 테스트
```bash
npm run test:unit        # 오프라인 아웃박스 단위 테스트 (에뮬레이터 불필요)
npm run test:rules       # firestore.rules 단위 테스트
npm run test:functions   # Cloud Functions 통합 테스트
npm test                 # 셋 다 (test:functions 는 hosting 제외 — macOS 포트 5000 회피)
npm run loadtest         # 동시성 부하 테스트(무결성·지연). 예: N=120 npm run loadtest · CONCURRENCY=10 npm run loadtest
```

## 구조
```
firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
functions/index.js        # 콜러블 — 코인 쓰기의 단일 권한 지점
public/                   # 클라이언트 (Hosting)
  index.html  app.js  firebase-init.js  styles.css
  fcm.js  sw.js  outbox.js  manifest.json  icons/
  views/{shared,admin,leader,member,projector}.js
  vendor/                 # 벤더링된 Firebase SDK ESM(+compat) + html5-qrcode (CDN 차단 대응)
scripts/{seed,grant-admin,gen-prod-seed,loadtest,make-icons}.js
data/seed.json  tests/{rules,functions,outbox}.test.js
DEPLOY.md                 # 실배포 단계별 런북
```

## 실배포 (추후, 사용자 환경에서)
> 📖 **전체 단계별 절차는 [`DEPLOY.md`](DEPLOY.md) 런북 참조** (프로젝트 연결 · FCM/PWA · 관리자 시크릿 · 운영 시드 · 배포 · 스모크 점검).

원격 컨테이너에서는 `firebase login/deploy` 불가. 로컬/실 환경에서:
```bash
firebase login
firebase use <your-project>     # Blaze 플랜 필요(Functions)
firebase deploy --only functions,firestore:rules,hosting
```
배포 시 클라이언트는 자동으로 운영 Firebase에 연결된다(`firebase-init.js` 는 localhost 에서만 에뮬레이터에 붙음). 운영에서는 `public/firebase-init.js` 의 `firebaseConfig` 를 실제 프로젝트 값으로 교체하고, 팀 코드를 랜덤화한다.

### FCM 푸시 + PWA 활성화 체크리스트 (실 프로젝트 필요)
FCM 웹 푸시는 에뮬레이터로 검증 불가하다(실 Blaze 프로젝트·HTTPS·기기 권한·VAPID 필요). 로컬에선 자동 비활성이며, 아래를 채워야 실제 전송된다.

1. **실 config 교체(두 곳)** — `public/firebase-init.js` 의 `firebaseConfig` 를 실값으로 교체(**`messagingSenderId`·`appId` 포함**). 동일 값을 `public/sw.js` 상단 `firebaseConfig` 에도 **똑같이** 넣는다(서비스워커는 모듈 import 불가라 값 복제).
2. **VAPID 키** — Firebase Console → 프로젝트 설정 → 클라우드 메시징 → "웹 푸시 인증서" 생성 → 키를 `public/firebase-init.js` 의 `VAPID_KEY` 에 붙여넣는다.
3. **배포** — `firebase deploy --only functions,firestore:rules,hosting`.
4. **설치 + 권한** — HTTPS 사이트 접속 → PWA 설치(iOS: 공유 → "홈 화면에 추가", iOS 16.4+ 에서만 웹푸시 동작) → 입장 시 알림 권한 허용 → `members/{uid}.fcmToken` 저장 확인.
5. **발송 확인** — 관리자 화면 "📣 푸시 발송"(집결/중간집계/커스텀) → 기기에서 포그라운드(`onMessage`)·백그라운드(서비스워커) 수신 확인.

> 아이콘을 바꾸려면 `public/icons/icon.svg` 수정 후 `node scripts/make-icons.js` 재실행(sharp 필요).
