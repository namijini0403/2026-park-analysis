# Attic 2026-08: Phase 1 정리 보관

이 디렉토리는 2026-08 코드 정리(Phase 1)에서 제거된 미사용 코드를 보관합니다.

## 보관 항목 및 제거 사유

| 항목 | 이동처 | 제거 사유 |
|-----|------|---------|
| `app/` | `_attic/2026-08/app/` | 운영 미참조: index.html·vercel.json·build_vercel_static.mjs 참조 0건, OPERATING_PATHS.md도 미사용. ui-preview와 소스 중복. |
| `root_src/` (원본: `src/`) | `_attic/2026-08/root_src/` | 어디서도 import되지 않음: index.html/ui-preview/app/scripts 전체 grep 0건. |
| `api/ai-explainer.js` | `_attic/2026-08/api/ai-explainer.js` | 프런트는 v2만 호출. Vercel 자동 라우트 해제(의도된 정리). |
| `ui-preview/src/PreviewWorkspace.tsx` | `_attic/2026-08/ui-preview-src/` | main.tsx→PreviewWorkspaceSafe 경로에서 import 안 됨. 깨진 코드. |
| `ui-preview/src/SchoolDetailReportPage.tsx` | `_attic/2026-08/ui-preview-src/` | main.tsx→PreviewWorkspaceSafe 경로에서 import 안 됨. |
| `ui-preview/src/App.tsx` | `_attic/2026-08/ui-preview-src/` | main.tsx→PreviewWorkspaceSafe 경로에서 import 안 됨. |
| `ui-preview/src/schoolDataMapper.ts` | `_attic/2026-08/ui-preview-src/` | main.tsx→PreviewWorkspaceSafe 경로에서 import 안 됨. |
| `ui-preview/src/schoolDataMapperSafe.ts` | `_attic/2026-08/ui-preview-src/` | main.tsx→PreviewWorkspaceSafe 경로에서 import 안 됨. |
| `ui-preview/vite.config.ts` | `_attic/2026-08/ui-preview-src/vite.config.ts` | vite.config.js와 내용 동일. Vite는 .js를 우선 채택하므로 죽은 설정. |

## 정리 배경

- **조사 리포트 기준**: code_cleanup_handover 리포트의 운영 경로 분석 결과.
- **목표**: 미사용 코드 제거로 리포지토리 복잡도 감소 및 유지보수성 향상.
- **복구**: 향후 필요시 `git log --diff-filter=D --summary | grep delete` 또는 이 디렉토리에서 복구 가능.
