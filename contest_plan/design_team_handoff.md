# 디자인팀 작업·배포 기준

## 사용할 저장소와 브랜치

- 저장소: https://github.com/namijini0403/2026-park-analysis
- 협업 기준 브랜치: `feat/all-school-levels-academy-public-metrics`
- 앱 루트는 이 저장소의 루트다. 로컬 폴더 이름만 `park-railway-deploy`이며, GitHub 안에 같은 이름의 하위 폴더가 있는 것이 아니다.
- 로컬 경로: `C:\Users\Mijin\Desktop\공공데이터공모전\park-railway-deploy`
- 2026-09-15: 배포된 사진·통계·챗봇 변경(`d966d5c`)과 디자인팀 커밋(`9ef75f1`)을 병합했다. 이후 작업은 이 브랜치 최신 커밋에서 시작한다.

```powershell
git clone --branch feat/all-school-levels-academy-public-metrics https://github.com/namijini0403/2026-park-analysis.git
cd 2026-park-analysis
```

기존 checkout은 로컬 변경을 먼저 보존하고 해당 브랜치에서 `git pull --ff-only`로 갱신한다. `main`, `railway-deploy`, 과거 outputs 스냅샷을 최신 작업 기준으로 사용하지 않는다.

## 주요 파일

| 대상 | 파일 |
| --- | --- |
| 화면 구조·CSS/JS 연결 | `index.html` |
| 디자인팀 표지·테마·레이아웃 | `assets/manager-*.css`, `assets/manager-*.js`, 관련 이미지·영상 |
| 기본 공통 스타일 | `assets/simple-app.css` |
| 학교 프로필·사진 | `assets/school-profile.js`, `assets/school-photos.js`, `assets/school-photos.css` |
| 전체 통계·차트 | `assets/domain-stats.js`, `assets/domain-stats.css`, `assets/statistical-charts.js`, `assets/statistical-charts.css` |
| 챗봇·대화·지도 | `assets/chat-agent.js`, `assets/chat-conversation.css`, `assets/chat-workspace.js`, `assets/chat-map.js` |

`index.html` 교체 시 새 파일 전체로 덮어쓰기보다 기존 DOM ID·이벤트 연결·스크립트 로딩 순서를 보존한다. `api/`와 `data_processed/`는 분석·공공데이터 코드다. `vercel_public/`는 생성물이므로 직접 수정하지 않는다.

## 로컬 실행과 검증

Node 20 이상(운영 Node 22)을 사용한다. 이 프로젝트의 정적 빌드는 기존 분석 데이터도 필요하므로 새 clone에서 데이터가 없다는 오류가 나면 기존 데이터 준비 절차를 확인한다. 파일을 임의의 빈 데이터로 대체하지 않는다.

```powershell
npm ci
npm run test:agent
npm run test:statistics
npm run test:profile
npm run test:simple
node tests/test_school_photos.cjs
npm run build:vercel
npm start
```

`http://localhost:3000`에서 서버와 함께 확인한다. Google 사진은 `GOOGLE_MAPS_BROWSER_KEY` 환경변수 또는 로컬 `map.env`를 사용한다. 키 파일을 Git/정적 빌드/배포 스냅샷에 넣지 않는다. 운영 변수는 이미 설정돼 있다.

## Railway 배포 경로

공개 사이트: https://education-living-area-preview-production.up.railway.app

GitHub push만으로 이 미리보기 서비스가 갱신되지 않는다. 저장소 루트에서는 빌드와 스냅샷 생성까지만 실행하고, `railway up`은 새로 생성한 배포 전용 폴더 안에서만 실행한다.

```powershell
npm run build:vercel
node scripts/deploy/prepare_hitl_release.cjs
if ($LASTEXITCODE -ne 0) { throw '스냅샷 생성 실패 — 배포 중단' }
$releasePath = (Get-Content -LiteralPath 'outputs/hitl-release-path.txt' -Raw).Trim()
Set-Location -LiteralPath $releasePath
railway up --project 819e8af2-e6db-4fbf-bab9-76731a7408d5 --environment 08a322cd-3447-4eef-8a9e-a7a8d8ead656 --service 0959785c-35d7-4734-b4c0-63b2c8e4eeac --no-gitignore --detach --json --message '웹 디자인 업데이트'
```

업로드로 받은 **해당 배포 ID**의 `SUCCESS`를 확인하고 공개 파일 해시와 실제 화면을 검증한다. 과거 스냅샷을 재사용하면 최신 변경을 되돌릴 수 있다. 세부 규칙은 [미리보기 배포 문서](education_preview_deployment.md)를 따른다.

이번 GitHub 동기화는 코드 인수인계다. 디자인 병합본의 Railway 재배포는 별도이며, 기존 사진 배포 ID는 `26009cfc-347b-4e01-a785-7caf38909b82`다.
