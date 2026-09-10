"""Prioritize park access verification by decision sensitivity, without probabilities."""
from pathlib import Path
import hashlib
import json
import numpy as np
from scipy.stats import rankdata

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data_processed/education'


def priority_ranks(values,levels):
    """High rank = less shortage; removing supply lowers the rank. Ties averaged."""
    ranks=np.full(len(values),np.nan)
    for level in set(levels):
        mask=(levels==level)&np.isfinite(values)
        if mask.sum()>1:ranks[mask]=(rankdata(values[mask],method='average')-1)/(mask.sum()-1)*100
    return ranks


def main():
    source=OUT/'shared_parks.json';data=json.loads(source.read_text(encoding='utf-8'))
    schools=data['schools'];ids=[s['id'] for s in schools]
    values=np.array([s['shared_area_per_student'] for s in schools],dtype=float)
    levels=np.array([s['level'] for s in schools]);before=priority_ranks(values,levels)
    output=[]
    for park in data['parks']:
        if not park['linked_schools']:continue
        linked=np.array([sid in park['school_ids'] for sid in ids])
        if park['area_m2'] is None or park['missing_demand_schools'] or park['known_linked_students']<=0:
            output.append(dict(park_id=park['id'],park_name=park['name'],status='source_resolution_needed',
                               linked_schools=park['linked_schools'],school_ids=park['school_ids']))
            continue
        contribution=park['area_m2']/park['known_linked_students']
        after_values=np.maximum(0,values-linked*contribution)
        after=priority_ranks(after_values,levels)
        valid=linked&np.isfinite(before)&np.isfinite(after)
        changes=np.maximum(0,before-after)
        affected=[dict(id=ids[i],name=schools[i]['name'],level=schools[i]['level'],
                       before_supply=float(values[i]),after_supply=float(after_values[i]),
                       shortage_priority_rise_pp=round(float(changes[i]),4)) for i in np.flatnonzero(valid)]
        output.append(dict(park_id=park['id'],park_name=park['name'],status='available',
                           linked_schools=int(linked.sum()),analyzed_schools=int(valid.sum()),
                           priority_change_sum_pp=round(float(changes[valid].sum()),4),
                           max_priority_change_pp=round(float(changes[valid].max()),4) if valid.any() else None,
                           schools_rising_10pp=int((changes[valid]>=10).sum()),schools=affected))
    output.sort(key=lambda r:(r['status']!='available',-r.get('priority_change_sum_pp',0),r['park_id']))
    result=dict(method='one-park-unavailable scenario; within-level supply percentile rank change',
                source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),parks=output,
                limitations=['No probability or expected monetary value is assigned.',
                             'Priority is sensitivity to verification, not evidence that the park is inaccessible.',
                             'Remaining park allocations stay fixed; no travel rerouting or demand redistribution.',
                             'Rank is resource-shortage support priority, not school quality.',
                             'Separate single-park results are not additive for a multi-park investigation budget.',
                             'Unresolved source data is shown separately, not assigned a zero benefit.'])
    (OUT/'field_verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps([dict(name=r['park_name'],score=r.get('priority_change_sum_pp'),max=r.get('max_priority_change_pp'),schools=r['linked_schools']) for r in output[:5]],ensure_ascii=False))


if __name__=='__main__':main()
