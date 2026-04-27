"""Build a sanitized competition submission package.

The public GitHub Pages app currently runs from the repository root with
`index.html + data_processed/ + ui-preview/dist/`. The competition package is a
separate reproducibility bundle that uses `index.html + data/processed/ +
app/dist/`. Keep those two path contracts separate when updating this script.
"""

from __future__ import annotations

import os
import shutil
import stat
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "submission_package"

INCLUDE_NAMES = {
    "README.md",
    "CONTEXT.md",
    "OPERATING_PATHS.md",
    "SUBMISSION_CHECKLIST.md",
    "index.html",
    ".gitignore",
    "data",
    "scripts",
    "app",
    "models",
    "outputs",
}

EXCLUDE_DIR_NAMES = {
    ".git",
    ".claude",
    "__pycache__",
    "node_modules",
    ".cache",
    "cache",
    "notebooks",
    "output",
    "submission_package",
}

EXCLUDE_FILE_NAMES = {
    ".env",
    "index_head_snapshot.html",
    "CONTEXT_backup_20260410.md",
    "프로젝트_구조_정리_20260422.docx",
}

EXCLUDE_SUFFIXES = {
    ".log",
    ".pyc",
    ".pyo",
    ".tsbuildinfo",
}


def should_copy(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIR_NAMES:
        return False
    if path.name in EXCLUDE_FILE_NAMES:
        return False
    if path.name.startswith("tmp_"):
        return False
    if ".tmp." in path.name or ".backup." in path.name:
        return False
    if path.name.startswith("_run_") and path.suffix.lower() == ".py":
        return False
    if path.suffix.lower() in EXCLUDE_SUFFIXES:
        return False
    if path.name == ".env.example":
        return True
    if path.name.startswith(".env"):
        return False
    return True


def copy_tree(src: Path, dst: Path) -> None:
    for item in src.iterdir():
        if not should_copy(item):
            continue
        target = dst / item.name
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            copy_tree(item, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def write_manifest(dest: Path) -> None:
    manifest = dest / "SUBMISSION_NOTES.md"
    manifest.write_text(
        "\n".join(
            [
                "# 제출 패키지 안내",
                "",
                "- 이 폴더는 공모전 제출용으로 정리된 패키지입니다.",
                "- 제외 항목: `.env`, `app/node_modules`, 캐시, 로그, 임시 파일, 내부 백업/스냅샷 문서",
                "- 메인 웹앱: `index.html`",
                "- React 앱 소스/빌드: `app/`",
                "- 분석 스크립트: `scripts/`",
                "- 데이터: `data/`",
                "- 공개 운영 경로와 제출 패키지 경로의 차이는 `OPERATING_PATHS.md` 참고",
                "",
                "## 실행 메모",
                "",
                "- `index.html`은 로컬 HTTP 서버에서 열어야 합니다.",
                "- 카카오맵 키는 제출본에 포함하지 않았습니다.",
                "- 실행 시 `?key=발급키`를 URL에 붙이거나 브라우저 localStorage의 `KAKAO_MAP_KEY`를 사용하세요.",
                "",
                "## 제외된 대표 파일",
                "",
                "- 루트 `.env`",
                "- `app/.env`",
                "- `app/node_modules/`",
                "- `index_head_snapshot.html`",
                "- `CONTEXT_backup_20260410.md`",
            ]
        ),
        encoding="utf-8",
    )


def handle_remove_readonly(func, path, exc_info) -> None:
    os.chmod(path, stat.S_IWRITE)
    func(path)


def prepare_destination() -> Path:
    if not DEST.exists():
        DEST.mkdir(parents=True, exist_ok=True)
        return DEST

    try:
        shutil.rmtree(DEST, onerror=handle_remove_readonly)
        DEST.mkdir(parents=True, exist_ok=True)
        return DEST
    except PermissionError:
        for idx in range(2, 100):
            alt = ROOT / f"submission_package_{idx}"
            if alt.exists():
                continue
            alt.mkdir(parents=True, exist_ok=True)
            return alt
        raise SystemExit("Unable to prepare submission package directory.")


def main() -> None:
    dest = prepare_destination()

    for name in INCLUDE_NAMES:
        src = ROOT / name
        if not src.exists():
            continue
        dst = dest / name
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            copy_tree(src, dst)
        else:
            if should_copy(src):
                shutil.copy2(src, dst)

    write_manifest(dest)
    print(f"Submission package created: {dest}")


if __name__ == "__main__":
    main()
