import unittest

import networkx as nx

from scripts.education.build_school_routes import road_exposure
from scripts.education.build_school_routes import path_geometry_points
from shapely.geometry import LineString


class RoadExposureTest(unittest.TestCase):
    def test_route_preserves_curved_geometry_and_orients_reversed_edges(self):
        graph=nx.MultiGraph()
        for node,x in [(1,0),(2,10),(3,20)]:graph.add_node(node,x=x,y=0)
        graph.add_edge(1,2,length=15,geometry=LineString([(10,0),(5,5),(0,0)]))
        graph.add_edge(2,3,length=10)
        points=path_geometry_points(graph,[1,2,3])
        self.assertEqual([(p.x,p.y) for p in points],[(0,0),(5,5),(10,0),(20,0)])

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
