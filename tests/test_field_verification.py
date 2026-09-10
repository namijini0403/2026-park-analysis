import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec=importlib.util.spec_from_file_location('field',Path(__file__).resolve().parents[1]/'scripts/education/analyze_field_verification.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class RankTests(unittest.TestCase):
    def test_ties_separate_levels_and_missing(self):
        values=np.array([0,0,10,20,np.nan,100,200],dtype=float)
        levels=np.array(['E']*5+['M']*2)
        ranks=m.priority_ranks(values,levels)
        np.testing.assert_allclose(ranks[[0,1,2,3,5,6]],[100/6,100/6,200/3,100,0,100])
        self.assertTrue(np.isnan(ranks[4]))

    def test_loss_increases_shortage_priority(self):
        levels=np.array(['E']*3)
        before=m.priority_ranks(np.array([1,2,3.]),levels)
        after=m.priority_ranks(np.array([1,2,0.]),levels)
        self.assertEqual(before[2]-after[2],100)


if __name__=='__main__':unittest.main()
