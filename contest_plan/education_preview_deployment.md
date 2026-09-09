# 학교급 확장 미리보기 배포

- 확인일: 2026-09-09
- 주소: https://education-living-area-preview-production.up.railway.app
- 화면 인증번호: 2026
- 소스 기준: `feat/all-school-levels-academy-public-metrics`, `5e430a5`
- Railway 프로젝트: `819e8af2-e6db-4fbf-bab9-76731a7408d5`
- 서비스: `0959785c-35d7-4734-b4c0-63b2c8e4eeac`
- 환경: `08a322cd-3447-4eef-8a9e-a7a8d8ead656`
- 검증한 배포: `6198e6ea-0a82-49e3-9590-8ac0a09c95e2`, Railway `SUCCESS`

기존 서비스와 별개인 웹 서비스 하나를 생성했다. 로컬 `outputs/education-preview-deploy-20260909`에 실행 파일을 선별해 준비했다. 정적 빌드 1,046개 파일, API, 관리 모듈 및 계약 검사기, package/lockfile을 포함한다. 원자료·캐시·로컬 비밀키는 제외했다. Docker는 Node 22와 `npm ci --omit=dev`를 사용하며, `data_processed`는 `vercel_public/data_processed`로 연결한다. 서버와 도메인 포트는 모두 3000이다. 새 서비스에 OpenAI 키는 설정하지 않았으며 공개자료 기반 대체 응답을 확인했다.

## 확인 결과

- 실제 Playwright 브라우저에서 HTTPS 사이트와 인증 화면이 열린다.
- `index.html`, `assets/education-layers.js`, `data_processed/education/school_analysis.json`, `data_processed/education/academies_map.json` 모두 HTTP 200이며 로컬 빌드와 SHA-256이 일치한다. 학원 지도 자료는 6,839개 시설이다.
- `/api/ai-explainer-v2`에 B000030928 공원 환경 질문을 보내 HTTP 200 및 인천검단가온중학교 고유 근거 응답을 확인했다.
- 새 주소를 Referer로 한 카카오 SDK 응답은 HTTP 401 `domain mismatched`다. 현재 지도 JavaScript 키가 속한 Kakao Developers 앱에 위 HTTPS 도메인 등록이 필요하다. 지도·학원 마커·경로 시각 검증은 미완료다.

## 같은 미리보기 서비스 갱신

빌드 갱신 후 위 배포 전용 폴더에 필요한 파일만 동기화하고 실행한다. `--no-gitignore`는 이미 선별한 이 폴더에서만 사용한다. 저장소 루트에서 실행하면 안 된다.

```powershell
railway up --project 819e8af2-e6db-4fbf-bab9-76731a7408d5 --environment 08a322cd-3447-4eef-8a9e-a7a8d8ead656 --service 0959785c-35d7-4734-b4c0-63b2c8e4eeac --no-gitignore --detach --json --message "Education preview update"
```

업로드 성공만으로 배포 성공을 판단하지 않는다. 반환된 배포 ID의 SUCCESS와 실제 HTTP 파일·API 응답을 확인한다. 첫 배포에서 포트 불일치와 정적 폴더 제외가 발견됐고, 위 검증 배포에서 수정됐다.
