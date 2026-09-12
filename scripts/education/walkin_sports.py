"""Only publicly operated, free, explicitly reservation-free student sports.

Official facility-specific use notices take precedence over the portal's generic
reservation UI. Free price, park location, or a blank booking field alone never
qualifies. Unknowns are excluded from the serving inventory and all scores.
"""
import re

SEARCH='https://www.eshare.go.kr/UserPortal/adv/unifdSearch/ConditionsSearch.do'
DETAIL='https://www.eshare.go.kr/UserPortal/Upv/UprResrcFacl/index.do?rsrc_no='
POLICY='public_free_walkin_students_v1'


def notice_is_walkin(section):
    explicit=bool(re.search(r'예약\s*불필요|예약\s*없이\s*사용|별도\s*신청\s*없이',section))
    if re.search(r'경우|예약\s*우선|예약\s*필수|사전\s*신청|회원\s*전용|성인\s*전용',section):return False
    return explicit


def eligible(row):
    a=row.get('walkin_access',{})
    return (row.get('kind')=='sports' and a.get('policy')==POLICY and
            a.get('public_operator') is True and a.get('free') is True and
            a.get('reservation_required') is False and a.get('application_required') is False and
            a.get('student_access') is True and notice_is_walkin(a.get('specific_notice','')) and
            bool(a.get('source_url')))


def fields(page):
    result={}
    for th in page.select('th'):
        td=th.find_next_sibling('td')
        if td:result[re.sub(r'\s+','',th.get_text())]=td.get_text(' ',strip=True)
    return result


def collect(fetch,record,refresh=False):
    identifiers=set();sources={};review=[]
    for term in ['농구장','배드민턴장','족구장','풋살장']:
        total=None;seen=set();received=0
        for p in range(1,21):
            key=f'walkin-search-{term}-{p}'
            soup,meta=fetch(SEARCH,key,refresh,post={
                'searchWrd':'인천 '+term,'collection':'resource_cate1','viewType':'UnitPage',
                'pageIndex':p,'sort':'RANK','order':'DESC'})
            sources[key]=meta
            match=re.search(r'총\s*([\d,]+)\s*건',soup.get_text(' ',strip=True))
            if not match:raise ValueError('Shared resource search contract changed')
            if total is None:total=int(match[1].replace(',',''))
            found=set()
            for a in soup.select('a.sbj_txt[onclick]'):
                m=re.search(r"fnNewPageResourceDetail\('[^']+',\s*'([^']+)'",a['onclick'])
                if m:found.add(m[1])
                else:review.append({'id':key+':'+a.get_text(strip=True),'name':a.get_text(' ',strip=True),
                    'source_url':SEARCH,'included':False,'reasons':['외부 예약 페이지 연결; 무신청 이용 근거 미확보']})
            if not soup.select('a.sbj_txt[onclick]') and total:raise ValueError('Missing resource search page')
            if found and found.issubset(seen):raise ValueError('Repeated search page')
            seen.update(found);identifiers.update(found)
            received+=len(soup.select('a.sbj_txt[onclick]'))
            if received>=total:break
        else:raise ValueError('Search exceeds 20-page bound')
    rows=[]
    for identifier in sorted(identifiers):
        key='walkin-'+identifier;url=DETAIL+identifier
        page,meta=fetch(url,key,refresh);sources[key]=meta;f=fields(page)
        name=f.get('자원명칭','');address=f.get('장소/위치','').replace('지도보기','').strip()
        operator=f.get('제공기관','');audience=f.get('이용대상','');fee=f.get('이용요금','')
        # Specific resource notices, not search snippets or generic help text.
        text=page.get_text(' ',strip=True)
        section=text.split('주의사항',1)[-1].split('이용후기',1)[0] if '주의사항' in text else ''
        explicit=notice_is_walkin(section)
        public=any(token in operator for token in ['인천광역시','인천시설공단','시설관리공단','시설안전관리공단'])
        student=audience=='전체' or '청소년' in audience or '어린이' in audience
        accepted=explicit and public and student and fee=='무료' and address.startswith('인천')
        reasons=[]
        if not explicit:reasons.append('시설별 예약·신청 불필요 근거 미확보')
        if not public:reasons.append('공공 운영 확인 불가')
        if not student:reasons.append('학생 이용대상 확인 불가')
        if fee!='무료':reasons.append('무료 확인 불가')
        if not address.startswith('인천'):reasons.append('인천 외/주소 미확보')
        review.append({'id':key,'name':name,'source_url':url,'included':accepted,'reasons':reasons,
                       'specific_notice':section[:800],'provider':operator})
        if not accepted:continue
        # The address field includes the facility name; remove only that exact suffix.
        address=address.removesuffix(name).strip()
        row=record(key,name,'sports',address,url,key)
        row.update(subtype=next((t for t in ['농구장','배드민턴장','족구장','풋살장'] if t in name),'야외운동시설'),
            service_scope='community',child_access='walkin_verified',fee=0,
            eligibility_note='공식 시설별 주의사항: 예약 없이 사용·이용료 없음. 전체 대상. 현장 이용 순서·안전수칙 준수',
            walkin_access={'policy':POLICY,'public_operator':True,'free':True,'student_access':True,
                'reservation_required':False,'application_required':False,'specific_notice':section[:800],
                'source_url':url,'checked_at':meta['retrieved_at'],
                'interpretation':'시설별 주의사항을 적용. 공유누리 공통 예약·심사 안내 문구는 해당 시설의 예약 의무로 사용하지 않음',
                'hours':'상시운영; 시간대 세부 정보 미제공. 야간 이용을 권장하지 않음'})
        assert eligible(row)
        rows.append(row)
    if not rows:raise ValueError('No verified walk-in sports facilities; review source before publishing')
    return rows,sources,review
