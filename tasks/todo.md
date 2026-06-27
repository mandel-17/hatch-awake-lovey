# 깨! 실배포 — 실행 체크리스트

승인된 계획: **기존 Firebase 프로젝트 · 이 맥에서 진행 · 있는 그대로 배포.** 상세 런북: `DEPLOY.md`.
담당: 🤖 = Claude(이 맥에서 실행) · 🧑 = 사용자(로그인·결제·콘솔·현장).

## Phase 0 — 사전 점검 (게이트 없음) ✅
- [x] 유닛 테스트 14/14 통과 (outbox+qr, 에뮬 불필요). ⚠️ Java 미설치 → rules/functions 에뮬 테스트는 로컬 재실행 불가(handoff 기록 green + 배포 후 스모크로 대체)
- [x] 플레이스홀더 확인: `firebase-init.js`+`sw.js` = `demo-kkae`/`demo-key`, `VAPID_KEY=""` → Phase 2 교체
- [x] 시드 인증 = `GCLOUD_PROJECT` + `GOOGLE_APPLICATION_CREDENTIALS`(서비스계정 키) ; 또는 MCP 직접 쓰기 폴백
- [x] `.gitignore` 보강: 서비스계정 키 패턴(`*firebase-adminsdk*.json` 등) 추가
- [x] functions engines `node:22` = 로컬 node v22.22.0 일치
- [x] deps 설치: functions ✅ + root(firebase-tools 13.35.1) ✅ — CLI 동작 확인, 미로그인 상태 확인

## Phase 1 — 연결 (🧑 로그인·결제)
- [x] 🧑 `firebase login` ✅ (lsyo6171@gmail.com)
- [x] 🤖 타깃 = `hatch-awake-lovey` → `.firebaserc` default 전환, `emu=demo-kkae` alias 보존
- [x] 🧑 **Blaze 결제** ✅ 확인됨 (Secret Manager 동작으로 입증; MCP "No"는 캐시 지연)
- [ ] 🧑 **Authentication 초기화 + 익명 ON** — REST 체크=`CONFIGURATION_NOT_FOUND`(미초기화). 콘솔 Authentication → 시작하기 → Sign-in method → 익명 사용 설정

## Phase 2 — 클라 config (🤖, VAPID는 🧑)
- [x] 🤖 웹앱 생성 + 실 config → `firebase-init.js` + `sw.js` 주입 ✅
- [x] 🤖 Firestore DB 생성(서울 asia-northeast3) + rules/indexes 배포 ✅
- [ ] 🧑 VAPID 키 발급(콘솔 Cloud Messaging) → 🤖 `VAPID_KEY` 주입 [푸시용, 선택]

## Phase 3 — 시크릿 + 시드 (🧑 행사 날짜)
- [x] 🤖 `ADMIN_BOOTSTRAP` 시크릿 설정 ✅ (관리자 PIN — 채팅으로 전달) · billing 입증
- [x] 🧑 행사 날짜 **2026-07-17 13:00–18:00 KST** → 🤖 운영 시드 생성(`seed.prod.json`, 팀코드 랜덤화) ✅
- [x] 🤖 시드 주입 ✅ — MCP 직접 쓰기로 event(main)+teams(12)+missions(11)=**24 docs** (서비스계정 키 불필요)

## Phase 4 — 배포 (🤖) ✅
- [x] 🤖 firestore:rules,indexes 배포 ✅
- [x] 🤖 functions 배포 ✅ — 7종(joinTeam·submitClear·adminAdjust·triggerHatch·setConfig·notify·setAdmin) @us-central1. (디스커버리 타임아웃→`FUNCTIONS_DISCOVERY_TIMEOUT=60` + 빌드 SA IAM 부여 후 성공)
- [x] 🤖 hosting 배포 ✅ → https://hatch-awake-lovey.web.app

> 배포 gotcha: ① 첫 functions 배포는 secret 선언 경로에서 디스커버리 10s 타임아웃 → `FUNCTIONS_DISCOVERY_TIMEOUT=60` 으로 해결. ② 새 GCP 프로젝트는 compute 기본 SA에 Cloud Build Builder 역할이 없어 빌드 실패 → IAM 1회 부여. (DEPLOY.md 반영 예정)

## Phase 5 — 스모크 점검
- [x] 🤖 익명로그인 ✅(REST) · joinTeam 팀입장 ✅(라이브 API) → {teamId:t1, 1팀}
- [x] 🤖 submitClear 코인 적립 ✅(+50) · 멱등 거부 ✅(ALREADY_EXISTS) · event.total·팀coins 증가 확인 → **pristine 복구**
- [x] 🤖 관리자 가드 ✅ (admin 4종 PERMISSION_DENIED, setAdmin 시크릿 검증)
- [x] 🤖 배포 자산 검증 ✅ (firebase-init.js·sw.js 실 config, demo-kkae 0건, 전 자산 HTTP 200)
- [ ] 🧑 폰: 관리자 PIN 입장 · 실시간 반영 · 오프라인 큐 · PWA 설치(iOS) · 부화 연출
- [ ] (선택) VAPID → 푸시 수신

## Phase 6 — 리허설·백업
- [ ] `N=12 npm run loadtest`
- [ ] 실 도메인에서 스테이션 QR 시트 인쇄
- [ ] 팀코드표·종이백업 양식 인쇄
- [ ] 🧑 현장 와이파이 점검

## 진행 로그
- 2026-06-26: 계획 승인, Phase 0 착수.
- 2026-06-26: Phase 0 완료 — 유닛 14/14, 플레이스홀더·시드인증·engines 확인, gitignore 보강, deps 설치, CLI 13.35.1. Phase 1(로그인·결제) 사용자 대기.
- 2026-06-27: 로그인 완료(lsyo6171). 타깃 `hatch-awake-lovey` 연결. 프로젝트 새것(웹앱·DB·결제 모두 없음). **Blaze 결제 미설정 → 사용자 대기.**
- 2026-06-27: 웹앱·config·`ADMIN_BOOTSTRAP` 시크릿·Firestore(서울)·rules/indexes·**functions(7)**·**hosting** 배포 완료 → https://hatch-awake-lovey.web.app . 남은 게이트: ① Authentication 초기화+익명 ON(REST=`CONFIGURATION_NOT_FOUND`) ② 행사 날짜(시드).
- 2026-06-27: 익명로그인 ON 확인 ✅. 시드 24 docs 주입(MCP) ✅. 라이브 스모크: **6/7 함수 도달·가드 정상**(setAdmin 시크릿 검증됨), `joinTeam`만 Cloud Run invoker 누락(deploy#2 부분생성 잔재) → delete+재배포로 수정 중. 스모크는 **데이터 미오염**(전부 가드 단계에서 거부, 쓰기 없음).
- 2026-06-27: joinTeam delete+재배포로 invoker 해결(IAM 전파 지연이었음). **풀 라이브 스모크 PASS**: joinTeam→submitClear(+50)→멱등(ALREADY_EXISTS), event.total·팀coins 증가 확인 후 **pristine 복구**(total=0). 배포 자산 검증(실 config·전 자산 200). ✅ **백엔드 배포·검증 완료.**
