import sys
from pathlib import Path
from math import isclose
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/education'))
from compare_school_boundaries import measures
from shapely.geometry import box, Polygon, MultiPolygon

a = box(0, 0, 10, 10)
assert measures(a, a)['mismatch'] == 0
assert measures(a, box(20, 0, 30, 10))['mismatch'] == 100
b = box(5, 0, 15, 10)
r = measures(a, b)
assert r['intersection_m2'] == 50
assert isclose(r['mismatch'], 100 * 2 / 3)
assert r['zone_outside'] == r['walk_outside'] == 50
hole = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)], [[(2, 2), (8, 2), (8, 8), (2, 8)]])
assert measures(hole, a)['intersection_m2'] == 64
assert measures(MultiPolygon([a, box(20, 0, 30, 10)]), a)['zone_outside'] == 50
try:
    measures(Polygon(), a)
    raise AssertionError('empty must defer')
except ValueError:
    pass
print('PASS polygon intersection: identical, disjoint, partial overlap, hole, multipolygon, empty')
