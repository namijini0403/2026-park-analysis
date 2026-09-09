"""Apply explicitly evidenced registry corrections, refusing changed source identities."""
import math


def apply_corrections(records, corrections):
    records=[dict(r) for r in records]
    by_id={r['학교ID']:r for r in records}
    for correction in corrections:
        row=by_id[correction['school_id']]
        if any(str(row.get(key))!=str(value) for key,value in correction['expected'].items()):
            raise ValueError('Registry correction source changed; reverify identity')
        replacement=correction['replacement']
        lat,lon,newlat,newlon=map(float,[row['위도'],row['경도'],replacement['위도'],replacement['경도']])
        a,b=map(math.radians,[lat,newlat])
        h=math.sin((b-a)/2)**2+math.cos(a)*math.cos(b)*math.sin(math.radians(newlon-lon)/2)**2
        distance=6371000*2*math.asin(min(1,math.sqrt(h)))
        neis=correction['sources'][0]['fields']
        if distance>50 or not math.isfinite(distance) or neis['FOND_YMD']!=row['설립일자'].replace('-',''):
            raise ValueError('Registry correction location/foundation evidence mismatch')
        if neis['SCHUL_NM']!=replacement['학교명'] or neis['SCHUL_KND_SC_NM']!=replacement['학교급구분'] or neis['ORG_RDNMA']!=replacement['소재지도로명주소']:
            raise ValueError('Registry correction differs from official school fields')
        row.update(replacement)
        row['registry_correction']=f"{correction['expected']['학교명']} / {correction['expected']['학교급구분']} → {replacement['학교명']} / {replacement['학교급구분']}; 공식 좌표 차이 {distance:.2f}m; school_registry_corrections.json"
    return records
