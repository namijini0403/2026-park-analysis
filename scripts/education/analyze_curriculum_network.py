"""Official advertised course opportunities, not student participation or contact."""
import csv
import hashlib
import json
import re
from pathlib import Path
import fitz
import numpy as np
from pyproj import Transformer
from analyze_designation_diffusion import cascade

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data_processed/education'
PDF=ROOT/'data/context_sources/raw/ice_shared_curriculum_2026_2_courses.pdf'


def name_key(name):
    return re.sub(r'\s+','',name).removeprefix('인천').replace('여자고등학교','여고').replace('고등학교','고')


def main():
    registry=list(csv.DictReader((OUT/'institutions.csv').open(encoding='utf-8-sig')))
    schools=sorted([r for r in registry if r['학교급구분']=='고등학교'],key=lambda r:r['학교ID'])
    lookup={}
    for i,s in enumerate(schools):lookup.setdefault(name_key(s['학교명']),[]).append(i)
    # Official roster uses this conventional abbreviation; preserve it in raw fields.
    special={'인하사대부고':'인하대학교사범대학부속고등학교'}
    def match(name):
        indices=lookup.get(name_key(special.get(name,name)),[])
        return indices[0] if len(indices)==1 else None
    rows=[]
    with fitz.open(PDF) as doc:
        for page_index in range(3,11):
            kind='거점형' if page_index<9 else '온라인형' if page_index==9 else '밴드형'
            tables=doc[page_index].find_tables().tables
            assert len(tables)==1,(page_index,len(tables))
            data=tables[0].extract()
            eligible=None
            for row in data[1:]:
                assert row[0] and row[0].isdigit(),(page_index,row)
                values=[v.replace('\n',' ').strip() if v is not None else None for v in row]
                if kind=='밴드형':
                    # Last column has visually verified merged cells (source PDF p11).
                    if values[11] is not None:eligible=values[11]
                    assert eligible
                host=match(values[2])
                rows.append(dict(kind=kind,number=int(values[0]),page=page_index+1,
                                 source_school_name=values[2],school_id=None if host is None else schools[host]['학교ID'],
                                 source_gu=values[1],subject=values[3],subject_type=values[4],subject_group=values[5],
                                 target_grade=values[6],sessions=int(values[7]),credits=int(values[8]),
                                 weekdays=values[9],advertised_seats=int(values[10]),
                                 eligible_school_names=[] if kind!='밴드형' else [n.strip() for n in eligible.split(',') if n.strip()]))
    for kind,count in [('거점형',313),('온라인형',21),('밴드형',30)]:
        assert sorted(r['number'] for r in rows if r['kind']==kind)==list(range(1,count+1)),kind
    n=len(schools);band=np.zeros((n,n),dtype=bool);edges={};unmatched=[]
    for row in rows:
        if row['kind']!='밴드형':continue
        host=match(row['source_school_name'])
        assert host is not None,row['source_school_name']
        for name in row['eligible_school_names']:
            target=match(name)
            if target is None:
                unmatched.append(dict(course=row['number'],name=name));continue
            if host==target:continue
            band[host,target]=True
            edges.setdefault((host,target),[]).append(row['number'])
    assert not unmatched,unmatched
    designation=json.loads((OUT/'designation_diffusion.json').read_text(encoding='utf-8'))
    designated={s['id'] for s in designation['schools'] if s['designated_2026']}
    seeds=np.array([s['학교ID'] in designated for s in schools])
    transform=Transformer.from_crs(4326,5179,always_xy=True)
    xy=np.array([transform.transform(float(s['경도']),float(s['위도'])) for s in schools])
    distances=np.linalg.norm(xy[:,None]-xy[None,:],axis=2)
    proximity=distances<=3000;np.fill_diagonal(proximity,False)
    simulations=[]
    for name,graph in [('official_band_opportunity',band),('same_level_3km',proximity),('combined',band|proximity)]:
        for p in [.05,.15,.3]:
            result=cascade(graph,seeds,p)
            result.pop('reach_frequency')
            simulations.append(dict(network=name,probability_per_edge=p,edges=int(graph.sum()),**result))
    metrics=[]
    for s in schools:
        offered=[r for r in rows if r['school_id']==s['학교ID']]
        metrics.append(dict(id=s['학교ID'],name=s['학교명'],designated_2026=s['학교ID'] in designated,
                            advertised_courses=len(offered),advertised_seats=sum(r['advertised_seats'] for r in offered),
                            subject_groups=len(set(r['subject_group'] for r in offered)),
                            by_kind={kind:sum(r['kind']==kind for r in offered) for kind in ['거점형','온라인형','밴드형']}))
    result=dict(source_url='https://songdo.icehs.kr/boardCnts/fileDown.do?fileSeq=78129af2ae95790b784247d9dbad3418',
                source_sha256=hashlib.sha256(PDF.read_bytes()).hexdigest(),school_year=2026,semester=2,
                registry_hash=hashlib.sha256((OUT/'institutions.csv').read_bytes()).hexdigest(),
                designation_hash=hashlib.sha256((OUT/'designation_diffusion.json').read_bytes()).hexdigest(),
                courses=rows,schools=metrics,
                edges=[dict(provider_id=schools[a]['학교ID'],eligible_school_id=schools[b]['학교ID'],course_numbers=c,
                            straight_distance_m=round(float(distances[a,b]),1)) for (a,b),c in sorted(edges.items())],
                summary=dict(courses=len(rows),matched_courses=sum(r['school_id'] is not None for r in rows),
                             matched_providers=sum(m['advertised_courses']>0 for m in metrics),
                             band_directed_edges=int(band.sum()),band_edges_over_3km=int((band & (distances>3000)).sum()),
                             high_school_seeds=int(seeds.sum()),unmatched_provider_names=sorted(set(r['source_school_name'] for r in rows if r['school_id'] is None))),
                simulations=simulations,
                limitations=['Advertisement is not confirmed operation, enrollment or student contact.',
                             'Band edges are directed provider-to-eligible-school opportunities, not teacher collaboration.',
                             'Hub/online courses do not identify participant schools; no school-pair edges were invented.',
                             'Seats are per-course opportunities; a person can take multiple courses, so do not count unique students.',
                             'Official program scope does not cover all high schools or all possible collaboration.',
                             'Diffusion rates are hypothetical; no education adoption time series is available.'])
    (OUT/'curriculum_network.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps(result['summary'],ensure_ascii=False))
    print(json.dumps([s for s in simulations if s['probability_per_edge']==.15],ensure_ascii=False))


if __name__=='__main__':main()
