# 깨! (KKAE) — 청년부 수련회 실시간 미션 앱

Mario × 에베소서 5:8-10 컨셉의 실시간 멀티기기 미션 게임. 팀이 미션을 깨면 코인을 얻고, 전체 합산 **10,000 코인** 도달 시 관리자가 부화를 트리거하면 전 기기에서 "요시의 알" 깨짐 연출이 동시에 재생된다.

> 상세: [`SPEC.md`](SPEC.md)(기능) · [`DESIGN.md`](DESIGN.md)(디자인) · [`BUILD_PLAN.md`](BUILD_PLAN.md)(작업 순서)

## 현재 상태 — 핵심 MVP (에뮬레이터 우선)

구현 완료:
- **백엔드**: `firestore.rules`(코인 쓰기 서버 전용) + Cloud Functions(`joinTeam`, `submitClear`, `adminAdjust`, `triggerHatch`, `setConfig`, `setAdmin`) + 시드
- **클라이언트**: 3역할 화면(관리자/팀리더/팀원) + 실시간 `onSnapshot` 구독 + QR 스캔(`html5-qrcode`) + 부화 연출
- **테스트**: 규칙 단위 테스트(11) + 함수 통합 테스트(9) — 모두 에뮬레이터에서 통과

이번 범위에서 **보류**: FCM 푸시(`notify`), PWA/서비스워커, 오프라인 큐, 90명 부하 테스트, 실배포. (`joinTeam`의 FCM 구독은 시그니처 유지용 no-op 스텁)

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
npm run test:rules       # firestore.rules 단위 테스트
npm run test:functions   # Cloud Functions 통합 테스트
npm test                 # 둘 다
```

## 구조
```
firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
functions/index.js        # 콜러블 — 코인 쓰기의 단일 권한 지점
public/                   # 클라이언트 (Hosting)
  index.html  app.js  firebase-init.js  styles.css
  views/{shared,admin,leader,member}.js
  vendor/                 # 벤더링된 Firebase SDK ESM + html5-qrcode (CDN 차단 대응)
scripts/seed.js  scripts/grant-admin.js
data/seed.json  tests/{rules,functions}.test.js
```

## 실배포 (추후, 사용자 환경에서)
원격 컨테이너에서는 `firebase login/deploy` 불가. 로컬/실 환경에서:
```bash
firebase login
firebase use <your-project>     # Blaze 플랜 필요(Functions)
firebase deploy --only functions,firestore:rules,hosting
```
배포 시 클라이언트는 자동으로 운영 Firebase에 연결된다(`firebase-init.js` 는 localhost 에서만 에뮬레이터에 붙음). 운영에서는 `public/firebase-init.js` 의 `firebaseConfig` 를 실제 프로젝트 값으로 교체하고, 팀 코드를 랜덤화한다.
