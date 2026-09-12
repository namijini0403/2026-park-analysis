import copy
import unittest

from scripts.accessibility.kakao_walk import parse_response
from scripts.accessibility.review_kakao_routes import review_status
from scripts.education.build_method_update import demand, grade_snapshot, cohort_scenario
from scripts.education.enrollment_model_v2 import fit_at


class MethodUpdateTests(unittest.TestCase):
    def test_candidate_deletion_does_not_redistribute_people(self):
        source={'year':2024,'method':'fixture','city_single_ages':{str(a):10 for a in range(20)},
                'census_age_groups':{'A':{f'in_age_{i:03}':100 for i in range(1,5)}},
                'candidate_weights':{key:{'footprint':{'weights':{'A':weight},'observed_total_population':100}}
                                     for key,weight in [('one',.1),('two',.3)]}}
        before=demand(source,{})['candidates']['one']
        reduced=copy.deepcopy(source);del reduced['candidate_weights']['two']
        self.assertEqual(before,demand(reduced,{})['candidates']['one'])
        self.assertEqual(before['footprint']['levels']['초등학교']['estimated_residents'],12)

    def test_missing_parent_is_not_zero(self):
        source={'year':2024,'method':'fixture','city_single_ages':{str(a):10 for a in range(20)},
                'census_age_groups':{},'candidate_weights':{'one':{'footprint':{'weights':{'A':.1},'observed_total_population':100}}}}
        self.assertIsNone(demand(source,{})['candidates']['one']['footprint']['levels']['초등학교']['estimated_residents'])

    def test_route_failure_and_boundary_are_distinct(self):
        self.assertIsNone(parse_response({'status':'ROUTE_RESULT_NOT_FOUND'})['distance_m'])
        self.assertIn('500m_classification_disagreement',review_status(490,510))
        self.assertNotIn('500m_classification_disagreement',review_status(500,500))

    def test_kakao_distance_and_step_geometry(self):
        result=parse_response({'status':'OK','route':{'properties':{'totalDistance':321},
                    'legs':[{'steps':[{'path':{'points':[[126.7,37.4],[126.71,37.41]]}}]}]}})
        self.assertEqual(result['distance_m'],321)
        self.assertEqual(len(result['segments']),1)

    def test_future_training_rows_not_used(self):
        model,weight,year=fit_at([{'year':2030}],2025)
        self.assertIsNone(model);self.assertEqual(weight,0);self.assertIsNone(year)

    def test_grade_cohort_preserves_other_students(self):
        snapshots={2025:{'grades':[10,20,30,40,50,60],'total':215,'other_students':5}}
        result=cohort_scenario(snapshots,2025,2026)
        self.assertEqual(result['forecast'][0]['students'],165)
        self.assertEqual(result['status'],'scenario_not_selected_model')

    def test_class_counts_never_used_as_student_counts(self):
        records=[{'item':'09','year':2025,'source_file':'fixture','values':{'PBAN_EXCP_YN':'N','COL_1':2,'COL_S_SUM':100}}]
        self.assertIsNone(grade_snapshot(records,2025,6))


if __name__=='__main__':unittest.main()
