"""Retry only failed public requests, retaining an auditable response classification."""
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

from scripts.education.fetch_disclosures import BASE, OUT


def classify(response):
    evidence = {'http_status': response.status_code,
                'response_sha256': hashlib.sha256(response.content).hexdigest(),
                'response_bytes': len(response.content)}
    if not response.ok:
        return None, dict(evidence, status='http_error')
    try:
        payload = response.json()
    except ValueError:
        return None, dict(evidence, status='non_json_response')
    if not isinstance(payload, dict) or not isinstance(payload.get('list'), list):
        if isinstance(payload, dict):
            evidence['response_keys'] = sorted(payload)
            message = str(payload.get('resultMsg', ''))
            scheduled = re.fullmatch(r'\d{4}년 정보는 (\d{4})년 (\d{2})월 (\d{2})일 공개됩니다\.', message)
            if scheduled:
                evidence['publication_date'] = '-'.join(scheduled.groups())
                return None, dict(evidence, status='scheduled_publication')
        return None, dict(evidence, status='public_list_unavailable')
    return payload, dict(evidence, status='available' if payload['list'] else 'no_rows_in_public_response', rows=len(payload['list']))


def main():
    path = OUT/'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    failed = [r for r in manifest if r['status']=='fetch_failed']
    contracts = {}
    for item in sorted({r['item'] for r in failed}):
        response = requests.post(BASE+'/ng/go/pnnggo_a01_l3.do', data={'GO_NO': item}, timeout=40)
        response.raise_for_status()
        match = re.search(r'APIKEY\s*:\s*"([^"]+)"', response.text)
        contracts[item] = match.group(1) if match else None

    def retry(row):
        key = contracts[row['item']]
        if not key:
            return row, None, {'status': 'public_request_contract_unavailable'}
        try:
            response = requests.post(BASE+'/openData.do', data={
                'APIKEY': key, 'APITYPE': row['item'], 'DEPTHNO': row['depth'],
                'SCHULKNDCODE': row['school_level_code'], 'PBANYR': row['year'], 'LCTNSCCODE': '04'}, timeout=50)
            payload, result = classify(response)
            return row, payload, result
        except requests.RequestException as exc:
            return row, None, {'status': 'transport_error', 'error_type': type(exc).__name__}

    audit = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for row, payload, result in pool.map(retry, failed):
            audit.append({'item': row['item'], 'title': row['title'], 'year': row['year'],
                          'school_level_code': row['school_level_code'], 'depth': row['depth'], **result})
            if payload is not None:
                filename = f"{row['item']}_{row['year']}_{row['school_level_code']}_{row['depth']}.json"
                target = OUT/filename
                target.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
                row.update(file=filename, rows=len(payload['list']), status=result['status'],
                           source_url=BASE+'/ng/go/pnnggo_a01_l2.do', sha256=hashlib.sha256(target.read_bytes()).hexdigest())
                row.pop('error', None)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    output = {'checked_at': datetime.now(timezone.utc).isoformat(), 'requests': audit,
              'scope': 'Retry of prior failed public requests only. Missing public lists are not zero observations or proof of data nonexistence.'}
    (OUT/'retry_audit.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    from collections import Counter
    print(json.dumps(dict(Counter(r['status'] for r in audit)), ensure_ascii=False))


if __name__=='__main__':
    main()
