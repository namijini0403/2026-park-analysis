"""Official digital-school roster transitions and hypothetical network diffusion.

Run: python -X utf8 scripts/education/analyze_designation_diffusion.py
No fitted transmission rate or observed school-to-school ties are asserted.
"""
from pathlib import Path
import csv
import hashlib
import json
import re

import fitz
import numpy as np
import openpyxl
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/context_sources/raw'
OUT = ROOT / 'data_processed/education'


def normalize():
    records = []
    workbook = openpyxl.load_workbook(RAW / 'ice_digital_leading_2025.xlsx', data_only=True)
    for number, level, name in workbook.active.values:
        if isinstance(number, int):
            records.append(dict(school_name=name.strip(), school_level=level.strip(),
                                designation_type='선도학교', source_file='ice_digital_leading_2025.xlsx',
                                source_url='https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11785&nttSn=3311134'))
    with fitz.open(RAW / 'ice_digital_research_2025.pdf') as doc:
        text = '\n'.join(p.get_text() for p in doc)
    for number, level, name in re.findall(r'(\d+)\s*\n(초등학교|중학교|고등학교)\s*\n([^\n]+)', text):
        records.append(dict(school_name=name.strip(), school_level=level,
                            designation_type='연구학교', source_file='ice_digital_research_2025.pdf',
                            source_url='https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11785&nttSn=3311133'))
    assert len(records) == 54, 'Source layout/count changed; review raw files'
    for row in records:
        row.update(year=2025, program_name='디지털 기반 교육혁신', verification_status='official_roster')
    path = ROOT / 'data/context_sources/school_digital_designations_2025.csv'
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    return records


def cascade(adjacency, seeds, probability, trials=300, steps=6, seed=20260910):
    """Independent cascade: each newly active node gets one attempt per edge.

    Synchronous rounds; activated nodes remain reached but only transmit once.
    These are abstract exchange rounds, not months or school years.
    """
    rng = np.random.default_rng(seed)
    active = np.broadcast_to(seeds, (trials, len(seeds))).copy()
    frontier = active.copy()
    trajectory = [active.sum(axis=1)]
    for _ in range(steps):
        contacts = frontier.astype(np.int32) @ adjacency.astype(np.int32)
        frontier = (~active) & (rng.random(active.shape) < 1 - (1 - probability) ** contacts)
        active |= frontier
        trajectory.append(active.sum(axis=1))
    totals = np.stack(trajectory, axis=1)
    return dict(mean_by_round=totals.mean(axis=0).tolist(),
                final_simulation_interval=np.quantile(totals[:, -1], [.05, .95]).tolist(),
                reach_frequency=active.mean(axis=0).tolist())


def exposure_test(adjacency, previous, current, groups, permutations=1999):
    degree = adjacency.sum(axis=1)
    exposure = np.divide(adjacency @ previous.astype(float), degree,
                         out=np.zeros(len(previous)), where=degree > 0)
    # Isolates have zero adjacent seeds, not a missing exposure observation.
    eligible = ~previous
    outcome = current[eligible]
    x = exposure[eligible]
    if not outcome.any() or outcome.all():
        return dict(status='insufficient_groups')
    observed = float(x[outcome].mean() - x[~outcome].mean())
    strata = np.asarray(groups)[eligible]
    indices = [np.flatnonzero(strata == group) for group in sorted(set(strata))]
    rng = np.random.default_rng(20260910)
    null = []
    for _ in range(permutations):
        labels = outcome.copy()
        for idx in indices:
            labels[idx] = rng.permutation(labels[idx])
        null.append(float(x[labels].mean() - x[~labels].mean()))
    return dict(status='available', eligible=int(eligible.sum()), new_designations=int(outcome.sum()),
                mean_seed_neighbor_share_new=float(x[outcome].mean()),
                mean_seed_neighbor_share_other=float(x[~outcome].mean()), difference=observed,
                permutation_null_mean=float(np.mean(null)),
                permutation_upper_tail_p=(1 + sum(v >= observed for v in null)) / (permutations + 1),
                permutation_count=permutations, strata='school_level × current_gu',
                alternative='new designations have greater prior-seed neighbor share',
                isolated_eligible=int(((degree == 0) & eligible).sum()))


def main():
    old = normalize()
    with (ROOT / 'data/context_sources/school_designations_2026.csv').open(encoding='utf-8-sig') as f:
        new = list(csv.DictReader(f))
    with (OUT / 'institutions.csv').open(encoding='utf-8-sig') as f:
        schools = sorted([r for r in csv.DictReader(f) if r['학교급구분'] in ['초등학교', '중학교', '고등학교']], key=lambda r: r['학교ID'])
    lookup = {}
    for i, row in enumerate(schools):
        lookup.setdefault((row['학교명'], row['학교급구분']), []).append(i)
    aliases_path = OUT / 'schoolinfo_verified_aliases.json'
    aliases = json.loads(aliases_path.read_text(encoding='utf-8'))
    by_id = {row['학교ID']: i for i, row in enumerate(schools)}
    for alias in aliases.values():
        if alias['school_id'] in by_id:
            lookup.setdefault((alias['disclosure_name'], alias['school_level']), [by_id[alias['school_id']]])
    def match(records):
        mask = np.zeros(len(schools), dtype=bool)
        excluded = []
        for row in records:
            candidates = lookup.get((row['school_name'], row['school_level']), [])
            if len(candidates) == 1:
                mask[candidates[0]] = True
            else:
                excluded.append(dict(name=row['school_name'], level=row['school_level'], reason='not_unique_in_current_registry'))
        return mask, excluded
    previous, old_excluded = match(old)
    current, new_excluded = match(new)
    transformer = Transformer.from_crs(4326, 5179, always_xy=True)
    xy = np.array([transformer.transform(float(r['경도']), float(r['위도'])) for r in schools])
    assert np.isfinite(xy).all(), 'Missing coordinates must be handled explicitly'
    distance = np.linalg.norm(xy[:, None] - xy[None, :], axis=2)
    levels = np.array([r['학교급구분'] for r in schools])
    groups = [r['학교급구분'] + '|' + r['gu'] for r in schools]
    scenarios = []
    for radius in [1000, 3000, 5000]:
        adjacency = (distance <= radius) & (levels[:, None] == levels[None, :])
        np.fill_diagonal(adjacency, False)
        empirical = exposure_test(adjacency, previous, current, groups)
        for probability in [.05, .15, .30]:
            simulation = cascade(adjacency, current, probability)
            frequencies = simulation.pop('reach_frequency')
            scenarios.append(dict(radius_m=radius, probability_per_edge=probability,
                                  undirected_edges=int(adjacency.sum() // 2), isolates=int((adjacency.sum(axis=1) == 0).sum()),
                                  empirical_transition=empirical, simulation=simulation,
                                  school_reach_frequency=dict(zip([s['학교ID'] for s in schools], frequencies))))
    inputs = [OUT / 'institutions.csv', ROOT / 'data/context_sources/school_designations_2026.csv',
              RAW / 'ice_digital_leading_2025.xlsx', RAW / 'ice_digital_research_2025.pdf', aliases_path]
    result = dict(method='same-level geographic proxy graph; independent cascade scenarios',
                  seed=20260910, trials=300, rounds=6, registry_n=len(schools),
                  roster_2025_n=len(old), roster_2026_n=len(new), matched_2025=int(previous.sum()), matched_2026=int(current.sum()),
                  retained=int((previous & current).sum()), new_in_2026=int((~previous & current).sum()),
                  absent_from_2026=int((previous & ~current).sum()), excluded_2025=old_excluded, excluded_2026=new_excluded,
                  limitations=['Distance edges are hypothetical opportunities, not observed collaboration.',
                               '2025 and 2026 program names and selection rules may differ; designation is not adoption.',
                               'Current registry is not a verified 2025 eligible-school roster.',
                               'Transmission probabilities are sensitivity assumptions, not estimates.',
                               'Simulation intervals describe random scenarios, not predictive confidence.',
                               'Stratified permutations do not establish causal diffusion; three radius tests are exploratory.'],
                  source_hashes={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
                  schools=[dict(id=s['학교ID'], name=s['학교명'], level=s['학교급구분'], gu=s['gu'], designated_2025=bool(previous[i]), designated_2026=bool(current[i])) for i,s in enumerate(schools)],
                  scenarios=scenarios)
    (OUT / 'designation_diffusion.json').write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ['scenarios','schools','source_hashes']}, ensure_ascii=False))
    for scenario in scenarios:
        print(scenario['radius_m'], scenario['probability_per_edge'], scenario['empirical_transition'], scenario['simulation'])


if __name__ == '__main__':
    main()
