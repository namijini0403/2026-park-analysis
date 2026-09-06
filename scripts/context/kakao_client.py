# -*- coding: utf-8 -*-
"""Kakao Local API 공통 클라이언트 (stdlib only, 캐시 포함).

원칙
  - API 키는 리포 안 어떤 파일에도 기록하지 않는다. 실행 시 환경변수 KAKAO_REST_KEY 또는
    리포 밖 파일(기본: 워크스페이스 루트 1.env 의 `rest:` 줄)에서 읽는다.
  - 캐시(data/context_sources/geocode_cache/kakao_cache.json)에는 질의와 응답만 저장하고
    키·헤더는 저장하지 않는다. 캐시가 있으면 네트워크 호출을 하지 않으므로 재현 가능하다.
  - 초당 약 5회로 제한(polite). 429/5xx는 지수 백오프 재시도.
  - 좌표를 만들어내지 않는다. 응답이 없거나 인천 밖이면 호출부가 unresolved로 남긴다.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = REPO_ROOT.parent

CACHE_PATH = REPO_ROOT / "data" / "context_sources" / "geocode_cache" / "kakao_cache.json"
DEFAULT_KEY_FILE = WORKSPACE_ROOT / "1.env"

ADDRESS_ENDPOINT = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_ENDPOINT = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 빌더와 동일한 광역 유효 범위 (백령·대청·연평 포함).
VALID_BOUNDS = {"lat_min": 36.0, "lat_max": 39.0, "lng_min": 124.0, "lng_max": 128.0}

MIN_INTERVAL_S = 0.2  # 약 5 req/s
MAX_RETRIES = 4


def load_key(key_file: Path | None = None) -> str:
    """환경변수 우선, 없으면 리포 밖 키 파일의 `rest:` 줄. 리포에 기록하지 않는다."""
    env = (os.environ.get("KAKAO_REST_KEY") or "").strip()
    if env:
        return env
    path = key_file or DEFAULT_KEY_FILE
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            stripped = line.strip()
            if stripped.lower().startswith("rest:"):
                value = stripped.split(":", 1)[1].strip()
                if value:
                    return value
    raise RuntimeError(
        "Kakao REST 키를 찾지 못했습니다. 환경변수 KAKAO_REST_KEY 를 설정하거나 "
        f"{path} 에 'rest: <키>' 줄을 두세요. (키를 리포 안 파일에 쓰지 마세요.)"
    )


def coord_valid(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None:
        return False
    return (VALID_BOUNDS["lat_min"] <= lat <= VALID_BOUNDS["lat_max"]
            and VALID_BOUNDS["lng_min"] <= lng <= VALID_BOUNDS["lng_max"])


class KakaoLocalClient:
    def __init__(self, cache_path: Path = CACHE_PATH, key: str | None = None,
                 offline: bool = False):
        self.cache_path = cache_path
        self.offline = offline
        self._key = key
        self._last_call = 0.0
        self.live_calls = 0
        self.cache_hits = 0
        self.cache: dict[str, dict] = {}
        if cache_path.exists():
            self.cache = json.loads(cache_path.read_text(encoding="utf-8"))
        self._dirty = False

    # ── 내부 ───────────────────────────────────────────────────────────
    @property
    def key(self) -> str:
        if self._key is None:
            self._key = load_key()
        return self._key

    def _throttle(self) -> None:
        wait = MIN_INTERVAL_S - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

    def _request(self, endpoint: str, params: dict) -> dict:
        url = endpoint + "?" + urllib.parse.urlencode(params)
        last_error = None
        for attempt in range(MAX_RETRIES):
            self._throttle()
            req = urllib.request.Request(url, headers={"Authorization": "KakaoAK " + self.key})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    self.live_calls += 1
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code in (429, 500, 502, 503, 504):
                    time.sleep(1.0 * (2 ** attempt))
                    continue
                raise
            except urllib.error.URLError as exc:
                last_error = exc
                time.sleep(1.0 * (2 ** attempt))
        raise RuntimeError(f"Kakao 요청 실패({MAX_RETRIES}회): {last_error}")

    def _cached(self, cache_key: str, endpoint: str, params: dict) -> dict:
        if cache_key in self.cache:
            self.cache_hits += 1
            return self.cache[cache_key]
        if self.offline:
            return {"documents": [], "meta": {"total_count": 0}, "_offline_miss": True}
        payload = self._request(endpoint, params)
        self.cache[cache_key] = payload
        self._dirty = True
        return payload

    # ── 공개 API ───────────────────────────────────────────────────────
    def search_address(self, query: str, size: int = 5) -> dict:
        return self._cached(f"address|{query}", ADDRESS_ENDPOINT,
                            {"query": query, "size": size})

    def search_keyword(self, query: str, x: str | None = None, y: str | None = None,
                       radius: int | None = None, size: int = 5) -> dict:
        params: dict = {"query": query, "size": size}
        cache_key = f"keyword|{query}"
        if x and y:
            params.update({"x": x, "y": y})
            cache_key += f"|{x},{y}"
            if radius:
                params["radius"] = radius
                cache_key += f"|{radius}"
        return self._cached(cache_key, KEYWORD_ENDPOINT, params)

    def save(self) -> None:
        if not self._dirty:
            return
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.cache_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(self.cache, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
        self._dirty = False
