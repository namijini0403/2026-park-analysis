import unittest
from unittest.mock import patch
import networkx as nx
import osmnx as ox
from shapely.geometry import Point, LineString
from shapely.strtree import STRtree
from scripts.accessibility import build_walkshed_500m_v3 as v3


class HybridGeometryTests(unittest.TestCase):
    def graph(self):
        graph=nx.MultiGraph(crs='EPSG:5179')
        graph.add_node(0,x=0.,y=0.)
        graph.add_node(1,x=1000.,y=0.)
        graph.add_edge(0,1,length=1000.,geometry=LineString([(0,0),(1000,0)]))
        return graph

    def test_partial_long_edge_includes_origin_offset_cost(self):
        graph=self.graph()
        with patch.multiple(v3,BUFFER_M=10.,HOLE_FILL_M2=0.,SIMPLIFY_M=0.):
            polygon,stats=v3.build_walkshed(graph,ox.graph_to_gdfs(graph,nodes=False),Point(400,20),(0,1,0))
        self.assertEqual(stats['method'],'exact_edge_trim_v3')
        self.assertEqual(stats['offset_m'],20.)
        self.assertTrue(polygon.contains(Point(870,0)))
        self.assertFalse(polygon.contains(Point(950,0)))
        self.assertAlmostEqual(polygon.bounds[2],890.,places=4)
        self.assertEqual(len(graph.nodes),2,'Temporary search origin must be removed')

    def test_shared_spatial_index_selects_same_non_tied_edges(self):
        graph=self.graph()
        graph.add_node(2,x=1000.,y=1000.)
        graph.add_edge(1,2,length=1000.,geometry=LineString([(1000,0),(1000,1000)]))
        edges=ox.graph_to_gdfs(graph,nodes=False)
        points=[Point(300,10),Point(990,700)]
        reused=[list(edges.index)[int(i)] for i in STRtree(list(edges.geometry)).nearest(points)]
        original=[tuple(i) for i in ox.distance.nearest_edges(graph,X=[p.x for p in points],Y=[p.y for p in points])]
        self.assertEqual(reused,original)


if __name__=='__main__':
    unittest.main()
