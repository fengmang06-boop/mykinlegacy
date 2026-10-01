"""Focused regression checks for the read-only organic controller."""

import importlib.util
from pathlib import Path
import sys
import unittest


sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("organic_growth", Path(__file__).with_name("mykinlegacy-organic-growth.py"))
growth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(growth)


class GrowthTests(unittest.TestCase):
    def test_classification_requires_meaningful_sample(self):
        self.assertEqual(growth.classify(9, 0, 7, 0), "INSUFFICIENT_SAMPLE")
        self.assertEqual(growth.classify(20, 0, 8, 0), "QUICK_WIN")
        self.assertEqual(growth.classify(30, 0, 8, 0), "CTR_OPPORTUNITY")
        self.assertEqual(growth.classify(40, 0, 30, 0), "EMERGING")

    def test_indexation_does_not_infer_missing_inspection(self):
        self.assertEqual(growth.index_state(None), "UNKNOWN_NOT_INSPECTED")
        self.assertEqual(growth.index_state({"coverage_state": "Crawled - currently not indexed", "verdict": "NEUTRAL"}), "CRAWLED_NOT_INDEXED")

    def test_missing_query_rows_are_not_fabricated(self):
        source = {"report_date": "2026-10-01", "measurement_end_date": "2026-09-30", "source_status": {"gsc": "SUCCESS"},
                  "sitewide": {"trailing_28_complete_days": {"gsc": {"impressions": 100, "clicks": 1, "queries": None,
                      "pages": None, "query_pages": None}, "ga4": {"sessions": 5}},
                      "previous_28_complete_days": {"gsc": {}}, "trailing_7_complete_days": {"gsc": {}},
                      "trailing_90_days": {"gsc": {}}}}
        report = growth.make_report(source)
        self.assertEqual(report["windows"]["last_28_days"]["impressions"], 100)
        self.assertEqual(report["windows"]["last_28_days"]["visible_query_page_pairs"], 0)
        self.assertIsNone(report["dashboard"]["organic_sessions"])
        self.assertEqual(report["dashboard"]["ga4_sitewide_sessions"], 5)
        self.assertEqual(report["first_batch"], [])


if __name__ == "__main__":
    unittest.main()
