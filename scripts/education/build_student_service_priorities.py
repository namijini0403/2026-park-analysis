"""Observed services, without automatic shortage or investment rankings."""
import csv,hashlib,json,math
from pathlib import Path
import numpy as np
from shapely.geometry import Point,shape
from shapely.prepared import prep
from scripts.education.walkin_sports import eligible
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'data_processed';OUT=DATA/'student_services'
INPUTS=['student_services/facilities.json','schools.csv','libraries.csv','school_library_access.csv','school_walkshed_500m_v3.geojson','education/school_statistics.json','education/enrollment_forecasts.json','education/library_access_scenarios.json','school_priority_with_functional_park_layer.csv']
def read(name):return json.loads((DATA/name).read_text(encoding='utf-8'))
def csvrows(name):return list(csv.DictReader((DATA/name).open(encoding='utf-8-sig')))
def number(v):
    try:
        n=float(v);return n if math.isfinite(n) and n>=0 else None
    except (ValueError,TypeError):return None
def distances(lat,lng,points):
    if not points:return np.array([])
    a,b=np.radians(lat),np.radians(lng);p=np.radians(np.array(points,dtype=float));h=np.sin((p[:,0]-a)/2)**2+np.cos(a)*np.cos(p[:,0])*np.sin((p[:,1]-b)/2)**2
    return 6371008.8*2*np.arcsin(np.sqrt(np.clip(h,0,1)))
OPTIONS={
 'library':[('기존 도서관 연계','아동 이용시간·출입구 경로·수용량 확인'),('학교 자원 공유·순회도서','개방 가능 여부·장서 구성·운영인력 확인')],
 'books':[('장서 구성·노후도 점검','자료 유형·연령 적합성·대출·희망도서 확인'),('상호대차·장서 보강 비교','부족한 자료와 연계기관·예산 확인')],
 'sports':[('자유이용 운동공간 연결','무료·무신청 이용조건·출입구 경로·안전 확인'),('학교·공원 운동공간 보완','기존 공간·개방시간·면적·운영 가능 여부 확인')],
 'welfare':[('기존 돌봄기관 연계','학생 자격·운영시간·잔여정원 확인'),('운영시간·정원 보완 검토','실제 대기·미충족 수요·인력·예산 확인')]}
def build():
    OUT.mkdir(parents=True,exist_ok=True);inv=read(INPUTS[0]);fac=[f for f in inv['facilities'] if f['kind']!='sports' or eligible(f)]
    for i,r in enumerate(csvrows('libraries.csv')):
        if r['유형'] in ['공공','어린이','작은']:
            fac.append(dict(id='library-'+str(i),name=r['도서관명'],kind='library',subtype=r['유형'],latitude=number(r['위도']),longitude=number(r['경도']),service_scope='community',child_access='unknown',source_url='https://www.data.go.kr/data/15013109/standard.do',evidence_date=r['기준일'],eligibility_note='아동 이용시간·개방조건 확인 필요'))
    by={k:[f for f in fac if f['kind']==k and f['service_scope']=='community' and f['latitude'] is not None and f['longitude'] is not None] for k in ['library','sports','welfare']}
    coords={k:[(f['latitude'],f['longitude']) for f in fs] for k,fs in by.items()}
    iso={f['properties']['학교ID']:prep(shape(f['geometry'])) for f in read('school_walkshed_500m_v3.geojson')['features'] if f['geometry']}
    separate={r['학교ID'] for r in csvrows('school_priority_with_functional_park_layer.csv') if r.get('is_separate_bundle_tag')=='1'}
    stats=read('education/school_statistics.json')['schools'];fc=read('education/enrollment_forecasts.json');books={r['학교ID']:r for r in csvrows('school_library_access.csv')};schools=[]
    for r in csvrows('schools.csv'):
        sid=r['학교ID'];lat,lng=float(r['위도']),float(r['경도']);versions=stats.get(sid,{});years=sorted([y for y,v in versions.items() if number(v.get('students')) is not None],reverse=True);year=years[0] if years else None;br=books.get(sid,{})
        s=dict(id=sid,name=r['학교명'],latitude=lat,longitude=lng,separate_track=sid in separate,students=number(versions[year]['students']) if year else None,student_year=year,
          books={'per_student':number(br.get('인당장서수')) if str(br.get('matched'))=='1' else None,'staff':number(br.get('사서합계')),'year':br.get('기준일')},
          future={'year':2029,'students':next((v['students'] for v in fc.get(sid,{}).get('forecast',[]) if v['year']==2029),None),'note':'재학생 예측입니다. 실제 시설 이용수요나 투자 우선순위가 아닙니다.'},layers={})
        for k in ['library','books','sports','welfare']:
            access={}
            if k!='books':
                fs=by[k];ds=distances(lat,lng,coords[k]);net=iso.get(sid);inside=[f['id'] for f in fs if net is not None and net.covers(Point(f['longitude'],f['latitude']))]
                access=dict(network_count=len(inside) if net is not None else None,facility_ids=inside,straight_count=int(sum(ds<=500)),measurement='v3_display_polygon_point_inclusion',route_verified=False)
            n=access.get('network_count');reason='학교 내부 자료를 확인했습니다. 장서 구성·노후도·이용수요는 추가 확인이 필요합니다.' if k=='books' else '수집 목록에서 주변 시설을 찾았습니다. 실제 출입구 경로와 이용조건은 추가 확인이 필요합니다.' if n else '수집 목록에서 주변 시설을 확인하지 못했습니다. 시설이 없다는 뜻은 아닙니다.'
            reasons=[reason]
            if k=='sports':reasons.append('25곳 모두 부평구 소재이며 부평구를 포함해 전수 조사한 지역은 없습니다.')
            if sid in separate:reasons.append('도서지역은 도시형 500m 기준과 분리해 검토합니다.')
            s['layers'][k]=dict(status='pending',status_label='판단 보류',shortage=None,preferred_action=None,access=access,reasons=reasons,observation='내부 자료 확인' if k=='books' and s['books']['per_student'] is not None else '주변 시설 관측' if n else '추가 확인 필요',alternatives=[{'name':name,'condition':condition} for name,condition in OPTIONS[k]])
        schools.append(s)
    candidates=[];points=[(s['latitude'],s['longitude']) for s in schools]
    for c in read('education/library_access_scenarios.json')['candidates']:
        ds=distances(c['lat'],c['lng'],points);covered=[schools[i] for i,d in enumerate(ds) if d<=500]
        if not covered:continue
        known=[s['students'] for s in covered if s['students'] is not None]
        candidate=dict(id=c['id'],latitude=c['lat'],longitude=c['lng'],school_ids=[s['id'] for s in covered],layers={})
        for k in by:
            candidate['layers'][k]=dict(observed_school_students=sum(known) if known else None,missing_student_schools=sum(s['students'] is None for s in covered),nearby_facilities=int(sum(distances(c['lat'],c['lng'],coords[k])<=500)),verification={v:'unknown' for v in ['use','safety','execution','route']},verified_metrics={},comparison_eligible=False,status='판단 보류')
        candidates.append(candidate)
    result=dict(schema_version=2,defaults={'radius_m':500,'policy':'observations_first_no_default_ranking'},schools=schools,candidates=candidates,facilities=fac,sources=inv['sources'],coverage=inv['coverage'],limitations=['종합점수·학교 전체 순위는 산출하지 않습니다.','미관측은 부족 확정이 아닙니다. 자료·이용조건이 충분하지 않으면 판단을 보류합니다.','v3 도달권 폴리곤의 대표점 포함은 실제 출입구 경로 검증이 아닙니다.','조사 지점은 직선 500m 기준입니다. 재학생 합계는 실제 신규 수혜자가 아닙니다.','조건부 비교는 이용·안전·실행·경로 근거가 확인된 대안에만 허용합니다.','도서지역은 별도 검토하며 미래 예측은 현재 관측과 분리합니다.'],input_hashes={f:hashlib.sha256((DATA/f).read_bytes()).hexdigest() for f in INPUTS})
    (OUT/'priorities.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    with (OUT/'school_priorities.csv').open('w',encoding='utf-8-sig',newline='') as stream:
        w=csv.writer(stream);w.writerow(['학교ID','학교명','사업','검토상태','관측시설수','판단근거'])
        for s in schools:
            for k,v in s['layers'].items():w.writerow([s['id'],s['name'],k,v['status_label'],v['access'].get('network_count'),'; '.join(v['reasons'])])
    print(json.dumps({'schools':len(schools),'candidates':len(candidates),'facilities':len(fac)}))
if __name__=='__main__':build()
