import unittest
from shapely.geometry import box
from scripts.education.build_residential_scenario import added_zone


class ResidentialScenarioTest(unittest.TestCase):
    def test_connection_threshold_and_no_recursive_connection(self):
        walk = box(0, 0, 100, 100)
        circle = box(-500, -500, 500, 500)
        first = box(110, 0, 140, 100)
        second = box(140, 0, 170, 100)
        tiny = box(100, 120, 110, 130)
        added = added_zone(walk, circle, [first, second, tiny])
        self.assertAlmostEqual(added.area, 3000)
        self.assertEqual(added.intersection(walk).area, 0)
        self.assertEqual(walk.area, 10000)

    def test_overlaps_are_not_counted_twice_and_circle_clips(self):
        walk = box(0, 0, 100, 100)
        polygon = box(90, 0, 200, 100)
        added = added_zone(walk, box(0, 0, 150, 100), [polygon, polygon])
        self.assertEqual(added.area, 5000)


if __name__ == '__main__':
    unittest.main()
