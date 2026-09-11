import unittest
from datetime import date, timedelta
from scripts.accessibility.build_hybrid_walk_review import verified_endpoint, compare, priority, request_hash


class HybridReviewTests(unittest.TestCase):
    def valid(self):
        return dict(status='verified', coordinates=[126.7, 37.5], checked_on=date.today().isoformat(),
                    evidence_kind='field', evidence='field-record-1', reviewer='reviewer-1',
                    pedestrian_access='open', entity_identity_confirmed=True)

    def test_evidence_required_even_when_status_verified(self):
        for key in ('evidence', 'reviewer', 'checked_on', 'coordinates', 'pedestrian_access', 'entity_identity_confirmed'):
            row=self.valid();row.pop(key)
            self.assertFalse(verified_endpoint(row), key)
        self.assertTrue(verified_endpoint(self.valid()))

    def test_old_future_and_closed_evidence_cannot_pass(self):
        for days in (-366, 1):
            row=self.valid();row['checked_on']=(date.today()+timedelta(days=days)).isoformat()
            self.assertFalse(verified_endpoint(row))
        row=self.valid();row['pedestrian_access']='closed';self.assertFalse(verified_endpoint(row))
        row=self.valid();row['evidence_kind']='osm_candidate';self.assertFalse(verified_endpoint(row))

    def test_missing_is_not_zero_and_boundary_is_inclusive(self):
        self.assertEqual(compare(None, 400), 'unavailable')
        self.assertEqual(compare(500, 501), '500m_disagreement')
        self.assertEqual(compare(500, 499), '500m_agreement')

    def test_corrected_endpoints_invalidate_route_cache(self):
        self.assertNotEqual(request_hash([126.7,37.5],[126.8,37.5]),request_hash([126.7001,37.5],[126.8,37.5]))

    def test_priority_puts_policy_boundary_before_distance(self):
        rows=[{'school_id':'A','flags':['distance_disagreement']},
              {'school_id':'B','flags':['500m_classification_disagreement']}]
        self.assertEqual(sorted(rows,key=priority)[0]['school_id'],'B')


if __name__ == '__main__':
    unittest.main()
