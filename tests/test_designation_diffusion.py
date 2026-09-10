import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('diffusion', Path(__file__).resolve().parents[1] / 'scripts/education/analyze_designation_diffusion.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class DiffusionTests(unittest.TestCase):
    def test_chain_rounds_and_isolate(self):
        graph = np.array([[0,1,0,0],[1,0,1,0],[0,1,0,0],[0,0,0,0]], dtype=bool)
        seeds = np.array([1,0,0,0], dtype=bool)
        self.assertEqual(m.cascade(graph, seeds, 1, trials=5, steps=3)['mean_by_round'], [1,2,3,3])
        self.assertEqual(m.cascade(graph, seeds, 0, trials=5, steps=3)['mean_by_round'], [1,1,1,1])

    def test_single_attempt_not_repeated_si(self):
        graph = np.array([[0,1],[1,0]], dtype=bool)
        result = m.cascade(graph, np.array([1,0], dtype=bool), .25, trials=10000, steps=5)
        self.assertAlmostEqual(result['mean_by_round'][1], 1.25, delta=.02)
        self.assertEqual(result['mean_by_round'][1:], [result['mean_by_round'][1]] * 5)

    def test_no_seeds_and_reproducibility(self):
        graph = ~np.eye(4, dtype=bool)
        seeds = np.zeros(4, dtype=bool)
        self.assertEqual(m.cascade(graph, seeds, 1, trials=5)['mean_by_round'], [0] * 7)
        seeds[0] = True
        self.assertEqual(m.cascade(graph,seeds,.15,trials=20), m.cascade(graph,seeds,.15,trials=20))


if __name__ == '__main__':
    unittest.main()
