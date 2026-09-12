"""Expose library facts without turning operational thresholds into shortage."""
import csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
    p=ROOT/'data_processed/school_library_access.csv'
    with p.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
    for col in ['external_shortage','internal_shortage','demand_high','reading_gap_type','reading_gap_reason']:
        if col not in fields:fields.append(col)
    for r in rows:
        for key in ['external_shortage','internal_shortage','demand_high']:r[key]=''
        r['reading_gap_type']='추가 확인 필요'
        r['reading_gap_reason']=f"공공·어린이도서관 관측 {r.get('iso_public_library_count') or '미확보'}곳 · 학생당 장서 {r.get('인당장서수') or '미확보'}권 · 사서 {r.get('사서합계') or '미확보'}명. 장서 구성·이용조건·수요를 확인하기 전 부족과 우선 지원방식을 정하지 않습니다."
    with p.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    print('Reading observations:',len(rows))
if __name__=='__main__':main()
