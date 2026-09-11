"""Official Kakao walking API; bounded calls, explicit failures, no key in output."""
import json
import math
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from scripts.context.kakao_client import load_key

ENDPOINT = 'https://dapi.kakao.com/v2/routing/walk'


def parse_response(body):
    status = body.get('status')
    if status != 'OK':
        return {'status': str(status or 'invalid_response'), 'distance_m': None, 'coordinates': []}
    route = body['route']
    distance = route['properties']['totalDistance']
    if not isinstance(distance, (int, float)) or not math.isfinite(distance) or distance < 0:
        raise ValueError('Invalid route distance')
    segments = []
    for leg in route.get('legs', []):
        for step in leg.get('steps', []):
            points = step.get('path', {}).get('points', [])
            if points:
                if not all(len(p) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in p) for p in points):
                    raise ValueError('Invalid route coordinates')
                segments.append(points)
    # Preserve separate steps; do not fabricate links across missing geometry.
    return {'status': 'available', 'distance_m': distance,
            'duration_s': route['properties'].get('totalTime'), 'segments': segments,
            'coordinates': [p for segment in segments for p in segment],
            'provider': 'kakao', 'route_mode': 'SHORTEST',
            'endpoint_basis': 'requested_coordinates_not_verified_entrances'}


class KakaoWalkClient:
    def __init__(self, max_calls=1):
        self.max_calls = max_calls
        self.calls = 0
        self.last_call = 0
        self.disabled = False

    def route(self, start, end):
        if self.disabled or self.calls >= self.max_calls:
            return {'status': 'call_budget_or_provider_unavailable', 'distance_m': None}
        for lon, lat in [start, end]:
            if not (math.isfinite(lon) and math.isfinite(lat) and 124 <= lon <= 132 and 33 <= lat <= 39):
                raise ValueError('Expected Korean WGS84 coordinates')
        query = urlencode(dict(start_x=start[0], start_y=start[1], end_x=end[0], end_y=end[1],
                               input_coord='WGS84', output_coord='WGS84', route_mode='SHORTEST'))
        request = Request(ENDPOINT + '?' + query, headers={'Authorization': 'KakaoAK ' + load_key()})
        time.sleep(max(0, .25 - (time.monotonic() - self.last_call)))
        self.calls += 1
        self.last_call = time.monotonic()
        try:
            with urlopen(request, timeout=20) as response:
                return parse_response(json.load(response))
        except HTTPError as error:
            # Never echo server body/request headers, which may contain credentials.
            self.disabled = error.code in (401, 403, 404, 429)
            return {'status': 'http_error', 'http_status': error.code, 'distance_m': None}
        except (URLError, TimeoutError):
            return {'status': 'network_error', 'distance_m': None}


if __name__ == '__main__':
    result = KakaoWalkClient().route((127.11119669891646, 37.394776627382875), (127.12629039752096, 37.4199323570413))
    print(json.dumps({k: v for k, v in result.items() if k not in ('coordinates', 'segments')}, ensure_ascii=False))
