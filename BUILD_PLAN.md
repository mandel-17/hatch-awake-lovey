# BUILD PLAN — 깨! 앱

Claude Code는 이 순서대로 진행합니다. 각 단계는 **에뮬레이터에서 통과** 후 다음으로. 상세는 `SPEC.md`.

원칙: 백엔드(스키마·규칙·함수)를 먼저 세우고 통과시킨 뒤 클라이언트를 배선한다. 코인 쓰기는 함수에서만. 항상 멱등·트랜잭션·가드.

---

## Phase 0 — 프로젝트 셋업
- [ ] `firebase init` (Firestore, Functions[Node 20], Hosting, Emulators)
- [ ] `firebase.json`, `.firebaserc`, `firestore.indexes.json` 생성
- [ ] `functions/` 의존성(firebase-admin, firebase-functions v2)
- [ ] 기존 `prototype.html` 을 `public/prototype.html` 로 복사(UI 레퍼런스)
- [ ] 에뮬레이터 기동 확인
- 완료 기준: `firebase emulators:start` 정상, 빈 Firestore/Functions 동작.

## Phase 1 — 스키마 & 시드 & 규칙
- [ ] `data/seed.json` 작성(이벤트 1, 팀 12+코드, 미션 11 — SPEC §3·§12)
- [ ] `scripts/seed.js` (에뮬레이터/운영 시드)
- [ ] `firestore.rules` 작성(SPEC §6): coins/total/clears `write:false`, members 본인만
- [ ] 규칙 단위 테스트(rules-unit-testing): 클라가 coins/total/clears 못 쓰는지 검증
- 완료 기준: 시드 주입 성공, 규칙 테스트 통과(클라 코인 쓰기 차단 확인).

## Phase 2 — 인증 & 입장
- [ ] Anonymous Auth 활성화
- [ ] `joinTeam({code,name,fcmToken})` 함수(SPEC §5): 팀 조회→members 생성→memberCount++→토픽 구독
- [ ] 관리자 클레임 부여 경로(관리자 코드→`admin:true`)
- 완료 기준: 팀 코드로 입장 시 members/{uid} 생성, 잘못된 코드 거부.

## Phase 3 — 핵심 함수
- [ ] `submitClear({teamId,missionCode})` — 트랜잭션, 결정적 clearId, increment, allowLeaderSubmit 가드(SPEC §5)
- [ ] `adminAdjust`, `triggerHatch`(가드 total>=goal), `setConfig`(토글) — 관리자 전용
- [ ] (선택) events 트리거: total>=goal 최초 도달 시 admins 알림
- [ ] 함수 단위/통합 테스트: 중복 보고 거부, 동시 보고 합산 정확, 비관리자 거부
- 완료 기준: 에뮬레이터에서 두 팀 동시 submitClear 해도 total 정확, 같은 미션 2회 거부.

## Phase 4 — 클라이언트 배선 (프로토타입 포트)
- [ ] `public/firebase-init.js`(SDK 초기화), `public/app.js`(구독+호출)
- [ ] 인메모리 상태 → Firestore 구독으로 교체(SPEC §7): events/total, teams(순위), 내 팀 clears
- [ ] `clearMission()`/`leaderSubmit()` → `submitClear` 호출 ; 관리자 입력 → `adminAdjust`/`submitClear`
- [ ] 토글·부화 → `setConfig`/`triggerHatch` ; 부화 연출은 events.hatched 구독으로
- [ ] 역할 화면(`views/admin|leader|member`)을 프로토타입 렌더 함수에서 분리·재사용
- 완료 기준: 두 브라우저(리더/관리자)에서 한쪽 적립이 다른 쪽 카운터·순위에 1초 내 반영.

## Phase 5 — QR 스캔
- [ ] `html5-qrcode` 연동(리더 L2 미션 보고): 카메라→코드 추출→submitClear
- [ ] 코드 입력 폴백(수동 타이핑) 유지
- [ ] 관리자 A4: 미션별 코드/QR 목록(인쇄용) — QR 이미지 생성
- 완료 기준: QR 스캔으로 적립 성공, 잘못된 코드 안내.

## Phase 6 — 푸시(FCM) & PWA
- [ ] `public/manifest.json`, `sw.js`(FCM 백그라운드)
- [ ] 입장 시 토큰 등록·토픽 구독, 권한 안내, iOS 설치 유도 문구
- [ ] `notify({topic,title,body})` 관리자 발송 + 관리자 UI 버튼(집결/중간집계)
- 완료 기준: 토픽 발송 → 구독 기기 알림 수신.

## Phase 7 — 하드닝 & 리허설
- [ ] 오프라인 큐+재시도(멱등 확인), Firestore 오프라인 캐시
- [ ] 관리자 이상치 표시(팀별 속도/로그)
- [ ] **부하 테스트(≈90 동시 시뮬)** — 지연·유실 점검
- [ ] 코인 값 보정(10,000 도달 시뮬), 종이 백업 양식 준비
- [ ] 배포 `firebase deploy --only functions,firestore:rules,hosting`
- 완료 기준: 90 동시에서 카운터 정확·지연 허용범위, 리허설 1회 완주.

---

## 빠른 검증 시나리오(언제든)
1. 리더로 입장(팀 코드) → `W-OX` 보고 → 우리 팀 +50, 공동 total +50.
2. 같은 미션 재보고 → 거부(already-cleared).
3. 관리자 화면에서 즉시 반영 확인.
4. 데모/시드로 total을 10,000까지 → 관리자 부화 트리거 → 전 기기 깨! 연출.
