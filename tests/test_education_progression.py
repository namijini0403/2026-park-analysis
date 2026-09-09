import unittest

from scripts.education.build_school_progression import observation


class ProgressionTests(unittest.TestCase):
    def record(self,year=2025,level='고등학교',graduates=100,advanced=60,rate=60):
        return {'year':year,'school_level':level,'reference_date':f'{year}0401','kedi_code':'A',
                'school_status':'기존(원)교','source_row':18,
                'metrics':{'graduates':graduates,'advanced':advanced,'published_progression_pct':rate,
                           'employed':20,'military':0,'other':20}}

    def test_pending_high_school_values_are_not_real_zeros(self):
        row=self.record(2026,advanced=0,rate=0)
        result=observation(row)
        self.assertEqual(result['status'],'progression_pending_publication')
        self.assertEqual(result['metrics']['graduates'],100)
        self.assertTrue(all(v is None for k,v in result['metrics'].items() if k!='graduates'))
        self.assertEqual(row['metrics']['advanced'],0)

    def test_published_zero_is_preserved_and_zero_denominator_is_not_a_rate(self):
        self.assertEqual(observation(self.record(advanced=0,rate=0))['metrics']['published_progression_pct'],0)
        result=observation(self.record(level='중학교',graduates=0,advanced=0,rate=0))
        self.assertEqual(result['status'],'no_graduates')
        self.assertIsNone(result['metrics']['published_progression_pct'])

    def test_published_rate_mismatch_is_flagged_not_silently_recomputed(self):
        result=observation(self.record(rate=70))
        self.assertEqual(result['status'],'rate_denominator_mismatch')
        self.assertEqual(result['metrics']['published_progression_pct'],70)


if __name__=='__main__':unittest.main()
