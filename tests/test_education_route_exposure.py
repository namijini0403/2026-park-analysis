import unittest

import networkx as nx

from scripts.education.build_school_routes import road_exposure


class RoadExposureTest(unittest.TestCase):
    def test_selected_parallel_edge_and_multiple_tags(self):
        graph = nx.MultiGraph()
        graph.add_edge(1, 2, length=90, highway='primary')
        graph.add_edge(1, 2, length=20, highway='footway')
        graph.add_edge(2, 3, length=30, highway=['secondary', 'primary_link'])
        graph.add_edge(3, 4, length=15)
        groups = road_exposure(graph, [1, 2, 3, 4])['groups']
        self.assertEqual(groups['other'], {'segments': 1, 'length_m': 20})
        self.assertEqual(groups['primary'], {'segments': 1, 'length_m': 30})
        self.assertEqual(groups['unknown'], {'segments': 1, 'length_m': 15})
        self.assertEqual(sum(v['length_m'] for v in groups.values()), 65)

    def test_same_network_node_has_no_traversed_edges(self):
        groups = road_exposure(nx.MultiGraph(), [1])['groups']
        self.assertTrue(all(v['segments'] == 0 and v['length_m'] == 0 for v in groups.values()))


if __name__ == '__main__':
    unittest.main()
