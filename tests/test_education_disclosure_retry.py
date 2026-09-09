import unittest

import requests

from scripts.education.retry_disclosures import classify


class DisclosureResponseTest(unittest.TestCase):
    def response(self, body, status=200):
        response = requests.Response()
        response.status_code = status
        response._content = body.encode('utf-8')
        return response

    def test_error_or_wrong_contract_never_becomes_empty_data(self):
        for body, code, expected in [('<html>maintenance</html>', 503, 'http_error'),
                                     ('<html>login</html>', 200, 'non_json_response'),
                                     ('{"error":"unavailable"}', 200, 'public_list_unavailable'),
                                     ('{"list":null}', 200, 'public_list_unavailable')]:
            payload, evidence = classify(self.response(body, code))
            self.assertIsNone(payload)
            self.assertEqual(evidence['status'], expected)
            self.assertNotIn('rows', evidence)
            self.assertEqual(len(evidence['response_sha256']), 64)

    def test_explicit_empty_list_is_distinct_from_error_and_valid_rows(self):
        for body, expected in [('{"list":[]}', 'no_rows_in_public_response'),
                                ('{"list":[{"count":0}]}', 'available')]:
            payload, evidence = classify(self.response(body))
            self.assertEqual(evidence['status'], expected)
            self.assertEqual(evidence['rows'], len(payload['list']))

    def test_official_scheduled_release_is_not_no_data(self):
        payload, evidence = classify(self.response('{"resultCode":"fail","resultMsg":"2026년 정보는 2026년 10월 01일 공개됩니다."}'))
        self.assertIsNone(payload)
        self.assertEqual(evidence['status'], 'scheduled_publication')
        self.assertEqual(evidence['publication_date'], '2026-10-01')
        self.assertNotIn('rows', evidence)


if __name__ == '__main__':
    unittest.main()
