"""Remove each segment on the nearest-park route and test any park within 500m."""
from pathlib import Path
import hashlib
import json
import networkx as nx
import numpy as np
import pandas as pd
import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data_processed/education'


def park_distance(graph,origin,park_offsets,budget,blocked):
    def weight(u,v,data):
        return None if frozenset((u,v))==blocked else data['length']
    distances=nx.single_source_dijkstra_path_length(graph,origin,cutoff=budget,weight=weight)
    options=[distance+park_offsets[node] for node,distance in distances.items() if node in park_offsets and distance+park_offsets[node]<=budget]
    return min(options) if options else None


def main():
    source=ROOT.parent/'_cache/incheon_walk_graph_v3.graphml'
    raw=ox.convert.to_undirected(ox.project_graph(ox.load_graphml(source),to_crs=5179))
    graph=nx.Graph();graph.add_nodes_from(raw.nodes(data=True))
    for u,v,data in raw.edges(data=True):
        length=float(data['length'])
        if not graph.has_edge(u,v) or graph[u][v]['length']>length:graph.add_edge(u,v,length=length)
    keep=set().union(*(c for c in nx.connected_components(graph) if len(c)>=30))
    graph=graph.subgraph(keep).copy();graph.graph['crs']=raw.graph['crs'];del raw
    registry=pd.read_csv(OUT/'institutions.csv').set_index('학교ID')
    shared=json.loads((OUT/'shared_parks.json').read_text(encoding='utf-8'))
    schools=registry.loc[[s['id'] for s in shared['schools']]].reset_index()
    parks=pd.read_csv(ROOT/'data_processed/parks_with_function_class.csv')
    parks=parks[parks['시설유형']!='놀이터'].dropna(subset=['위도','경도']).reset_index(drop=True)
    def snap(frame):
        points=gpd.GeoSeries(gpd.points_from_xy(frame['경도'],frame['위도']),crs=4326).to_crs(5179)
        nodes=ox.distance.nearest_nodes(graph,X=points.x,Y=points.y)
        offsets=[p.distance(Point(graph.nodes[n]['x'],graph.nodes[n]['y'])) for p,n in zip(points,nodes)]
        return nodes,offsets
    pn,po=snap(parks);sn,so=snap(schools);park_offsets={}
    for node,offset in zip(pn,po):
        if offset<=150:park_offsets[node]=min(offset,park_offsets.get(node,float('inf')))
    virtual='__park_source__';graph.add_node(virtual)
    for node,offset in park_offsets.items():graph.add_edge(virtual,node,length=offset)
    distances,paths=nx.single_source_dijkstra(graph,virtual,cutoff=500,weight='length')
    graph.remove_node(virtual)
    output=[]
    for i,school in schools.iterrows():
        node=sn[i];offset=so[i]
        row=dict(id=school['학교ID'],name=school['학교명'],level=school['학교급구분'],origin_snap_m=round(offset,2))
        if offset>150:row['status']='origin_snap_exceeds_150m'
        elif node not in distances or distances[node]+offset>500:row['status']='no_baseline_park_within_500m'
        else:
            route=list(reversed(paths[node][1:]));baseline=distances[node]+offset;tested=[]
            for u,v in zip(route,route[1:]):
                alternative=park_distance(graph,node,park_offsets,500-offset,frozenset((u,v)))
                tested.append(dict(u=int(u),v=int(v),distance_after_m=None if alternative is None else round(alternative+offset,2)))
            failures=[r for r in tested if r['distance_after_m'] is None]
            valid=[r['distance_after_m'] for r in tested if r['distance_after_m'] is not None]
            row.update(status='available',baseline_distance_m=round(baseline,2),tested_segments=len(tested),
                       segments_losing_500m_access=len(failures),max_extra_distance_m=round(max(valid)-baseline,2) if valid else 0 if not tested else None,
                       segment_results=tested)
        output.append(row)
        if (i+1)%200==0:print(f'Checked {i+1}/{len(schools)}',flush=True)
    result=dict(method='single undirected node-pair segment removal on baseline nearest-park route; any valid park alternative within 500m',schools=output,
                graph_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                source_hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [OUT/'institutions.csv',OUT/'shared_parks.json',ROOT/'data_processed/parks_with_function_class.csv']},
                limitations=['OSM node-pair segment is not a verified physical closure unit; parallel edges removed together.',
                             'School and park representative points snap to nearest node within 150m; connecting lines are not verified paths.',
                             'Only baseline routes already within 500m are tested; missing baseline is not zero resilience.',
                             'Removing a segment outside the chosen shortest route cannot break that existing route, so only its segments need testing.',
                             'No failure probability, observed closure or road safety claim is made.',
                             'No park within 500m after removal is not proof of whole-network disconnection.'])
    (OUT/'road_resilience.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    valid=[r for r in output if r['status']=='available']
    print(json.dumps(dict(schools=len(output),baseline_available=len(valid),losing_access_under_some_segment_removal=sum(r['segments_losing_500m_access']>0 for r in valid)),ensure_ascii=False))


if __name__=='__main__':main()
