# 배포 런북 — 깨! (KKAE)

실배포 절차. **원격 컨테이너/에뮬레이터에선 불가** — 실 환경에서 진행한다. 상세 보충: `README.md`, `handoff.md`.

## 0. 사전 요건
- Firebase 프로젝트 (**Blaze 플랜** — Functions 필수)
- `firebase login` (로컬 CLI 인증)
- Node 20+, Java(에뮬레이터 테스트용 — `brew install openjdk`)

## 1. 프로젝트 연결
- `firebase use <project-id>` (또는 `.firebaserc` 의 `default` 교체)

## 2. 클라이언트 설정 — FCM / PWA
- `public/firebase-init.js` 의 `firebaseConfig` 를 실값으로 교체 (**`messagingSenderId`·`appId` 포함**)
- **동일 config** 를 `public/sw.js` 상단 `firebaseConfig` 에도 복제 (SW 는 모듈 import 불가)
- VAPID 키 → `public/firebase-init.js` 의 `VAPID_KEY`
  (Console → 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서)
- 상세: README "FCM 푸시 + PWA 활성화 체크리스트"

## 3. 관리자 코드 시크릿화
```bash
firebase functions:secrets:set ADMIN_BOOTSTRAP   # 강한 임의 값 입력
```
- `setAdmin` 이 이 시크릿을 바인딩한다 → 배포 후 실제 적용.
- 미설정 시 코드 기본값 `KKAE-ADMIN` 으로 동작(에뮬레이터 전용 — **운영에서 그대로 두지 말 것**).

## 4. 운영 시드 생성·주입
팀 코드를 랜덤화한다(예측 가능한 `TEAM1…` 은 타 팀 사칭 위험).
```bash
# 1) 운영 시드 생성 (팀 코드 랜덤 + 행사 시간). 팀별 코드 표를 출력 → 인쇄·배부
START=2026-08-02T13:30:00+09:00 END=2026-08-02T16:30:00+09:00 \
  node scripts/gen-prod-seed.js          # → data/seed.prod.json

# 2) 운영 프로젝트에 주입 (서비스 계정 키 필요)
SEED_FILE=data/seed.prod.json GCLOUD_PROJECT=<project-id> \
  GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> \
  node scripts/seed.js --prod
```
- `data/seed.prod.json` 은 **커밋 금지**(`.gitignore` 등록됨 — 실 코드 노출 방지).

## 5. 배포
```bash
# 신규 프로젝트면 먼저 빌드 SA 권한 부여(아래 함정 ②). functions 디스커버리 타임아웃은 60s로(함정 ①).
FUNCTIONS_DISCOVERY_TIMEOUT=60 \
  firebase deploy --only firestore:rules,functions,hosting
```

## 6. 배포 후 스모크 점검
- 호스팅 URL 접속 → 익명 로그인 → 팀 코드 입장 동작
- **PWA 설치**(iOS: 공유 → "홈 화면에 추가") → 알림 권한 허용 → `members/{uid}.fcmToken` 저장 확인
- **관리자**(시크릿 코드) 입장 → "📣 푸시 발송" → 기기에서 포그라운드/백그라운드 수신
- **리더 보고** → 코인 적립이 1초 내 전 기기 반영
- **오프라인**(기기 비행기모드) 보고 → 좌하단 "미전송 N건" → 복귀 시 자동 전송
- 데모로 `total` 을 10,000 까지 → 관리자 **부화 트리거** → 전 기기 깨! 연출

## 7. 부하 / 리허설
```bash
N=12 npm run loadtest     # 현실적 동시성(팀 수)에서 무결성·지연 점검
```
- 현장 와이파이 점검, **종이 백업 양식**(코드·적립 수기 기록) 병행
- 관리자 "최근 적립 로그" 로 이상치 감사

## 주의
- **events.total 단일 핫 필드**: 동시 버스트가 크면 처리량 한계(handoff §2 D). 보고는 시간에 분산되고 아웃박스가 재시도하므로 보통 문제없으나, 전원이 같은 순간 보고하는 상황이 우려되면 분산 카운터(샤딩) 검토.
- 비용: 1회·90명 규모는 Blaze 무료 한도 내 수준.

## 함정 (2026-06 실배포 기록)
신규 GCP 프로젝트 첫 배포에서 순서대로 겪은 3가지. 다음 배포자 참고.

1. **Functions 디스커버리 10s 타임아웃** — `setAdmin` 의 `secrets:["ADMIN_BOOTSTRAP"]` 선언 경로에서 `"Cannot determine backend specification. Timeout after 10000"`. 모듈 로드는 빠른데(≈0.2s) 디스커버리만 초과. → 배포 시 `FUNCTIONS_DISCOVERY_TIMEOUT=60` 환경변수.
2. **빌드 서비스계정 권한 없음** — 새 프로젝트의 compute 기본 SA(`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`)에 Cloud Build Builder 역할이 자동 부여되지 않아 `"Build failed ... missing permission on the build service account"`. → 콘솔 IAM → 해당 SA에 `roles/cloudbuild.builds.builder`(Cloud Build 서비스 계정) 1회 부여(또는 `gcloud projects add-iam-policy-binding <project> --member=serviceAccount:<num>-compute@developer.gserviceaccount.com --role=roles/cloudbuild.builds.builder`).
3. **callable 함수 Cloud Run invoker 누락** — 함정 ②로 한 함수가 부분 생성된 뒤 다음 배포가 그 함수를 *update* 처리하며 `allUsers` invoker 미설정 → 그 함수만 `401 Unauthorized`(Cloud Run GFE, 함수 코드 도달 전). → 해당 함수 `firebase functions:delete <fn> --force` 후 재배포(fresh create). **IAM 전파에 수분 걸리니 바로 401이어도 잠시 후 재확인.**

> 시드는 서비스계정 키 없이 **로그인된 세션 / Firebase MCP의 Firestore 쓰기**로도 주입 가능(owner 자격 → 보안 규칙 우회). 키 다운로드를 피하려면 이 경로 사용. 운영 데이터로 라이브 스모크를 돌렸다면 `event.total`·팀 `coins`·`memberCount` 0으로, 테스트 `clears/`·`members/` 삭제로 **pristine 복구**할 것.
