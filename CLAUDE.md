# 깨! (KKAE) — 청년부 수련회 실시간 미션 앱

> 이 파일은 Claude Code가 매 세션 읽는 프로젝트 메모리입니다. 짧게 유지하고, 상세는 `SPEC.md`(기능)·`DESIGN.md`(디자인)·`BUILD_PLAN.md`(작업 순서)를 참조합니다.

## 무엇을 만드나
청년부 여름수련회 **2일차 오후(13:30–16:30)** "깨!" 프로그램을 운영하는 **실시간 멀티기기 웹앱**. 팀들이 자유롭게 돌며 미션을 깨면 코인을 얻고, 전체 합산 **10,000 코인** 도달 시 "요시의 알"이 깨지는 부화 연출과 함께 **인당 15,000원**(셀모임비)이 지급된다.

- 주제: Mario × 에베소서 5:8-10. 요시의 알 = 잠든 믿음. 말씀·기도로 함께 알을 깬다(깨!).
- 규모: **10–12팀 × 5–8명 (≈50–90명)**.
- 협력+경쟁: 팀끼리 코인 순위로 경쟁하되, 보상은 **전체 10,000을 함께 채워야 모두가** 받는다.

## 현재 상태 — 새로 만드는 게 아니라 "포트 + 백엔드"
작동하는 **단일기기 프로토타입**이 이미 있다(`/public/prototype.html` 에 둘 것). 3-역할 화면 + 깨지는 알 + 코인 카운터가 바닐라 JS로 구현돼 있다. 이번 작업은 그 **UI/렌더 로직을 재사용**해 Firebase 백엔드에 연결하는 것이지 UI를 새로 만드는 게 아니다. 보존할 핵심 함수: `communal()`, `eggSVG()`, `missionChecklist()`, `adminDash/Entry/Codes`, `leaderHome/Report/Map`, `memberHome/Map`. 바꿀 것: 인메모리 상태 → Firestore 구독, `clearMission()`/`leaderSubmit()` → callable 함수 호출.

## 확정된 결정
- **검증 = 스테이션 QR/코드**: 미션마다 코드 보유. 리더가 스캔/입력 → 서버 검증 후 적립. 부정방지 L1(고정 코드)로 시작, 필요 시 L2(회전 토큰).
- **구현 = Firebase 실시간 멀티기기** (이 저장소).
- **역할 3종**: 관리자(운영본부·송출·입력·통제), 팀리더(폰·QR 보고), 팀원(폰·조회·응원).

## 기술 스택
- Cloud Firestore (실시간 `onSnapshot`)
- Cloud Functions (Node 20, **v2 `onCall`**) — 코인 쓰기는 **여기서만**
- Anonymous Auth + 팀 코드 입장 · 관리자 커스텀 클레임(`admin:true`)
- Firebase Cloud Messaging(FCM) — 토픽 푸시
- `html5-qrcode` — QR 스캔
- Firebase Hosting + **PWA**(iOS 웹푸시·설치 위해)
- **Blaze 플랜 필수**(Functions). 1회·90명 비용은 사실상 무료 수준.

## 절대 규칙 (보안)
코인에 영향 주는 모든 쓰기(`teams.coins`, `events.total`, `clears`)는 **클라이언트 금지**(`firestore.rules`: `write: if false`). 오직 Cloud Functions(Admin SDK)만 적립.
**`clearId = `${teamId}_${missionId}``** 로 결정적 생성 → 팀당 미션 1회 + 재시도 멱등.
공동 합산은 모든 팀을 더하지 말고 `events.total` 한 필드를 `FieldValue.increment()`로 갱신. 트랜잭션으로 동시성 보장.

## 저장소 구조 (목표)
```
/
├─ CLAUDE.md  SPEC.md  DESIGN.md  BUILD_PLAN.md
├─ firebase.json  firestore.rules  firestore.indexes.json
├─ functions/        # index.js: submitClear, joinTeam, adminAdjust, triggerHatch, setConfig, notify
├─ public/           # Firebase Hosting (클라이언트)
│  ├─ index.html  app.js  firebase-init.js
│  ├─ views/        # admin/ leader/ member 렌더 모듈 (프로토타입에서 포트)
│  ├─ manifest.json  sw.js   # PWA + FCM
│  └─ prototype.html         # 기존 프로토타입 (UI 레퍼런스)
├─ scripts/seed.js   # data/seed.json 으로 Firestore 시드
└─ data/seed.json    # 이벤트/팀/미션/코드 시드
```

## 주요 명령
```bash
firebase login
firebase init            # Firestore, Functions(Node20), Hosting, Emulators
firebase emulators:start # 로컬 개발·테스트 우선
node scripts/seed.js     # 시드 (에뮬레이터/운영)
firebase deploy --only functions,firestore:rules,hosting
```

## 작업 방식
- 빌드 순서: **`BUILD_PLAN.md`** 를 위에서부터.
- 상세(스키마·함수 시그니처·역할 화면·미션 데이터): **`SPEC.md`**.
- **시각 디자인 시스템**(팔레트·타이포·컴포넌트·어둠→빛): **`DESIGN.md`**. 프로토타입 색을 DESIGN.md의 CSS 토큰으로 일괄 교체한 뒤 포트. 닌텐도 자산은 사용 금지(색만 차용).
- 클라이언트는 프로토타입의 **바닐라 JS 스타일 유지**(프레임워크 도입 금지). UI 문자열은 **한국어**.
- **에뮬레이터 우선**: 보안 규칙·함수부터 만들고 통과시킨 뒤 클라 배선.
- 잊지 말 것: 오프라인 큐+재시도, 90명 부하 테스트, 현장 와이파이 점검, 종이 백업 병행, 관리자 이상치 감사.
