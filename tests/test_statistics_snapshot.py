"""Detect stale UI statistics without overwriting application data."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read_snapshot(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text.split("export const cityStatisticsPreviewDataSafe: CityStatisticsData = ", 1)[1].strip().rstrip(";"))


class StatisticsSnapshotTest(unittest.TestCase):
    def test_ui_snapshot_matches_source_calculation(self):
        spec = importlib.util.spec_from_file_location("statistics_generator", ROOT / "scripts/export/generate_statistics_preview_data_safe.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "statistics.ts"
            generator.OUT_PATHS = [target]
            with contextlib.redirect_stdout(io.StringIO()):
                generator.main()
            self.assertEqual(read_snapshot(target), read_snapshot(ROOT / "ui-preview/src/statisticsPreviewDataSafe.ts"))


if __name__ == "__main__":
    unittest.main()
