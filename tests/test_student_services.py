import unittest,json,hashlib,csv
from pathlib import Path
from scripts.education.walkin_sports import eligible,notice_is_walkin
ROOT=Path(__file__).resolve().parents[1]
class ObservationTests(unittest.TestCase):
 def test_no_hidden_policy_score(self):
  d=json.loads((ROOT/'data_processed/student_services/priorities.json').read_text(encoding='utf-8'));self.assertEqual(d['schema_version'],2);self.assertEqual(len(d['schools']),272);self.assertEqual(sum(s['separate_track'] for s in d['schools']),30)
  for s in d['schools']:
   for l in s['layers'].values():
    self.assertIsNone(l['shortage']);self.assertIsNone(l['preferred_action']);self.assertNotIn('score_interval',l);self.assertNotIn('components',l);self.assertGreaterEqual(len(l['alternatives']),2)
  for f,h in d['input_hashes'].items():self.assertEqual(hashlib.sha256((ROOT/'data_processed'/f).read_bytes()).hexdigest(),h)
 def test_unverified_candidates_cannot_rank(self):
  d=json.loads((ROOT/'data_processed/student_services/priorities.json').read_text(encoding='utf-8'))
  for c in d['candidates']:
   self.assertEqual(len(c['school_ids']),len(set(c['school_ids'])))
   for l in c['layers'].values():self.assertFalse(l['comparison_eligible']);self.assertNotIn('observed_gap_students',l)
 def test_walkin_contract_and_care_scope(self):
  d=json.loads((ROOT/'data_processed/student_services/priorities.json').read_text(encoding='utf-8'));sports=[f for f in d['facilities'] if f['kind']=='sports'];self.assertEqual(len(sports),25);self.assertTrue(all(eligible(f) for f in sports));self.assertFalse(notice_is_walkin('예약이 없는 경우 사용'))
  excluded={f['id'] for f in d['facilities'] if f['service_scope'] in ['home_visit','enrolled_school']}
  self.assertTrue(all(not excluded.intersection(s['layers']['welfare']['access']['facility_ids']) for s in d['schools']))
 def test_reading_no_operational_shortage(self):
  rows=list(csv.DictReader((ROOT/'data_processed/school_library_access.csv').open(encoding='utf-8-sig')))
  self.assertTrue(all(r['external_shortage']=='' and r['internal_shortage']=='' and r['reading_gap_type']=='추가 확인 필요' for r in rows))
 def test_independent_policy_options(self):
  d=json.loads((ROOT/'data_processed/policy_action_cards.json').read_text(encoding='utf-8'))
  for c in d['schools'].values():self.assertIsNone(c['primary_module']);self.assertIsNone(c['base']['primary_action']);self.assertIsNone(c['stability']);self.assertEqual(len(c['options']),2)
if __name__=='__main__':unittest.main()
