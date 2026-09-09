"""Cache official Schoolinfo public datasets; preserve exemptions and raw fields."""
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.schoolinfo.go.kr"
SOURCE = BASE + "/ng/go/pnnggo_a01_l2.do"
OUT = ROOT / "data/education_sources/disclosures"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    page = session.get(SOURCE, timeout=40)
    page.raise_for_status()
    soup = BeautifulSoup(page.text, "html.parser")
    items = []
    for a in soup.select("a[onclick]"):
        match = re.search(r"loadOpenData\('[^']+', '([^']+)', '([^']+)'\)", a["onclick"])
        if match:
            items.append(match.groups())
    metadata = session.get(BASE + "/js/new/dev/opendata.js?20231128", timeout=40).text
    (OUT / "official_field_definitions.js").write_text(metadata, encoding="utf-8")
    manifest = []
    for code, title in items:
        item_page = session.post(BASE + "/ng/go/pnnggo_a01_l3.do", data={"GO_NO": code}, timeout=40)
        item_page.raise_for_status()
        depths = sorted(set(re.findall(r'id="depthNm_([^"]+)"', item_page.text)))
        # Use only the public site's own read-only request contract.
        public_key = re.search(r'APIKEY\s*:\s*"([^"]+)"', item_page.text)
        if not public_key:
            manifest.append({"item": code, "title": title, "status": "public_request_contract_unavailable"})
            continue
        for year in (range(2020, 2027) if code == "62" else [2025, 2026]):
            for level in ["02", "03", "04"]:
                if (code == "55" and level == "02") or (code == "04" and level != "03"):
                    continue
                for depth in depths:
                    filename = f"{code}_{year}_{level}_{depth}.json"
                    path = OUT / filename
                    params = {"APIKEY": public_key.group(1), "APITYPE": code, "DEPTHNO": depth,
                              "SCHULKNDCODE": level, "PBANYR": year, "LCTNSCCODE": "04"}
                    try:
                        if not path.exists():
                            response = session.post(BASE + "/openData.do", data=params, timeout=50)
                            response.raise_for_status()
                            payload = response.json()
                            if not isinstance(payload.get("list"), list):
                                raise ValueError("No public list returned")
                            path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                            time.sleep(0.15)
                        data = json.loads(path.read_text(encoding="utf-8"))["list"]
                        manifest.append({"item": code, "title": title, "year": year, "school_level_code": level,
                                         "depth": depth, "file": filename, "rows": len(data), "source_url": SOURCE,
                                         "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                         "status": "available" if data else "no_rows_in_public_response"})
                    except (requests.RequestException, ValueError) as exc:
                        manifest.append({"item": code, "title": title, "year": year, "school_level_code": level,
                                         "depth": depth, "status": "fetch_failed", "error": type(exc).__name__})
        (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{code} {title}: {sum(m.get('rows',0) for m in manifest if m['item']==code)} rows", flush=True)


if __name__ == "__main__":
    main()
