import unittest
from scripts.education.refresh_public_data import validate_source_rows

class PublicSourceContracts(unittest.TestCase):
    def test_removed_observation_field_rejected(self):
        with self.assertRaisesRegex(ValueError,'columns removed'):
            validate_source_rows([{'school':'A'}],{'school','students'},1,'sample')
    def test_partial_download_rejected(self):
        with self.assertRaisesRegex(ValueError,'record loss'):
            validate_source_rows([{'school':'A'}],{'school'},10,'sample')
    def test_explicit_missing_value_preserved(self):
        validate_source_rows([{'school':'A','students':None}],{'school','students'},1,'sample')
    def test_not_yet_published_period(self):
        validate_source_rows([],{'school','students'},0,'new period')

if __name__=='__main__':unittest.main()
