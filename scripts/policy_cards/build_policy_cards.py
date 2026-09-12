"""Independent resource observations; never compare unlike need grades."""
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'data_processed'
def rows(name):return {r['학교ID']:r for r in csv.DictReader((DATA/name).open(encoding='utf-8-sig'))}
def main():
    parks=rows('school_priority_with_functional_park_layer.csv');libs=rows('school_library_access.csv');schools={}
    for sid,p in parks.items():
        r=libs.get(sid,{})
        observations=[f"도보권 녹지비율: {p.get('display_green_ratio') or '미확보'}%",f"최근접 활동규모 공원 거리: {p.get('nearest_functional_park_dist_m') or '미확보'}m",f"학생당 장서: {r.get('인당장서수') or '미확보'}권",f"사서: {r.get('사서합계') or '미확보'}명"]
        schools[sid]={'학교명':p['학교명'],'separate_track':p.get('is_separate_bundle_tag')=='1','status':'pending','primary_module':None,'base':{'primary_action':None,'alternative':None},'stability':None,'scenarios':{},'evidence':observations,'options':[{'module':'park','label':'공원·학교 활동공간 검토','condition':'활동면적·출입구 경로·안전·개방조건 확인'},{'module':'reading','label':'도서관 연계·학교 장서 보완 검토','condition':'장서 구성·아동 이용시간·운영인력·수요 확인'}],'note':'자원 간 부족도 숫자를 비교하지 않습니다. 실행조건 확인 전 우선안은 정하지 않습니다.'}
    (DATA/'policy_action_cards.json').write_text(json.dumps({'schema_version':2,'generated_note':'관측 사실과 조건부 대안을 병렬 제시','schools':schools},ensure_ascii=False),encoding='utf-8')
    print('Observation policy cards:',len(schools))
if __name__=='__main__':main()
