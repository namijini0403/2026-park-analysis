import importlib.util
from pathlib import Path
import unittest
import networkx as nx

spec=importlib.util.spec_from_file_location('road',Path(__file__).resolve().parents[1]/'scripts/education/analyze_road_resilience.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class RoadTests(unittest.TestCase):
    def test_alternative_park_not_only_original_destination(self):
        graph=nx.Graph();graph.add_weighted_edges_from([(1,2,100),(1,3,200)],weight='length')
        self.assertEqual(m.park_distance(graph,1,{2:10,3:20},500,frozenset((1,2))),220)
        self.assertIsNone(m.park_distance(graph,1,{2:10,3:20},210,frozenset((1,2))))

    def test_undirected_removal_and_detour(self):
        graph=nx.Graph();graph.add_weighted_edges_from([(1,2,100),(1,3,120),(3,2,130)],weight='length')
        self.assertEqual(m.park_distance(graph,1,{2:0},500,frozenset((2,1))),250)


if __name__=='__main__':unittest.main()
