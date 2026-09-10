import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec=importlib.util.spec_from_file_location('shared',Path(__file__).resolve().parents[1]/'scripts/education/analyze_shared_parks.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SharedParkTests(unittest.TestCase):
    def test_resource_conservation_and_loss(self):
        # 1000 m2 shared by 100+300 students; another 600 m2 by the latter school.
        total,loss,_,_,_=m.allocate([[1,0],[1,1]],[1000,600],[100,300])
        np.testing.assert_allclose(total,[2.5,4.5])
        self.assertAlmostEqual(float(np.dot(total,[100,300])),1600)
        np.testing.assert_allclose(loss,[1,2.5/4.5])

    def test_missing_is_local_not_zero(self):
        total,*_=m.allocate([[1,0],[1,0],[0,1]],[1000,500],[100,np.nan,50])
        self.assertTrue(np.isnan(total[:2]).all())
        self.assertEqual(total[2],10)

    def test_no_access_and_zero_demand(self):
        total,loss,*_=m.allocate([[0],[1]],[100],[10,0])
        self.assertEqual(total[0],0)
        self.assertTrue(np.isnan(total[1]))
        self.assertTrue(np.isnan(loss).all())

    def test_missing_area_does_not_poison_unlinked_school(self):
        total,*_=m.allocate([[1,0],[0,1]],[np.nan,200],[100,100])
        self.assertTrue(np.isnan(total[0]))
        self.assertEqual(total[1],2)


if __name__=='__main__': unittest.main()
