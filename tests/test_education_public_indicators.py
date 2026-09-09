import json
import unittest
from pathlib import Path

from scripts.education.build_public_indicators import GRADE_FIELDS,number,paps,summarize

ROOT=Path(__file__).resolve().parents[1]


def fixture(counts,sex='남자'):
    return {'item':'90','year':2026,'source_file':'fixture.json','source_url':'https://example.org',
            'values':{**dict(zip(GRADE_FIELDS,counts)),'RATE_SUM':sum(counts),'GRADE':'1학년','SXDS_CODE':sex,'PBAN_EXCP_YN':'N'}}


class PublicIndicatorTests(unittest.TestCase):
    def test_counts_weighted_percentage_and_zero_not_missing(self):
        data=paps([fixture([50,0,0,0,0]),fixture([0,0,0,5,5],'여자')],2026)
        self.assertEqual(data['status'],'available')
        self.assertAlmostEqual(data['metrics'][-1]['value'],100/6)
        self.assertEqual(number('0'),0)
        for missing in [None,'','-','비공개','NaN','-1']:self.assertIsNone(number(missing))
        self.assertIsNone(paps([fixture([0]*5)],2026)['metrics'][-1]['value'])

    def test_exempt_duplicate_inconsistent_rows_not_aggregated(self):
        first=fixture([1]*5)
        self.assertEqual(paps([first,first],2026)['status'],'duplicate_strata')
        first['values']['RATE_SUM']=100
        self.assertEqual(paps([first],2026)['status'],'inconsistent_counts')
        first['values']['PBAN_EXCP_YN']='Y'
        self.assertEqual(paps([first],2026)['metrics'],[])
        self.assertTrue(all(g['status']=='no_records' for g in summarize([])))

    def test_saved_metrics_match_disclosed_fields(self):
        data=ROOT/'data_processed/education'
        output=json.loads((data/'school_public_indicators.json').read_text(encoding='utf-8'))['schools']
        self.assertEqual(len(output),920)
        for sid,groups in output.items():
            path=data/'disclosures'/f'{sid}.json'
            raw=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
            for g in groups:
                for obs in g['observations']:
                    rows=[r for r in raw if r['item']==g['item'] and r['year']==obs['publication_year']]
                    if obs['status']!='available':continue
                    if g['item']=='90':
                        denominator=sum(r['values']['RATE_SUM'] for r in rows)
                        numerator=sum(r['values']['FOGRD_STDNT_FGR']+r['values']['FIGRD_STDNT_FGR'] for r in rows)
                        self.assertAlmostEqual(obs['metrics'][-1]['value'],100*numerator/denominator)
                    else:
                        for metric in obs['metrics']:self.assertEqual(metric['value'],number(rows[0]['values'][metric['field']]))


if __name__=='__main__':unittest.main()
