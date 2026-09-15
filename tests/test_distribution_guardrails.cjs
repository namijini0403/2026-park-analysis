const assert=require('node:assert/strict');
const table=require('../api/_school_table');
const tools=require('../api/_agent_tools');
const originalBuild=table.build,originalSource=table.sourceFor;
function distribution(values,selected=0){
 const rows=values.map((students,i)=>({id:`s${i}`,name:`학교${i}`,level:'초등학교',gu:'중구',students}));
 table.build=()=>({rows,byId:new Map(rows.map(r=>[r.id,r]))});
 table.sourceFor=()=>({key:'fixture',title:'검증 자료',path:'fixture.json',sha256:'fixture'});
 return tools.run('distribution',{level:'초등학교',school_id:`s${selected}`},{column:'students'});
}
try{
 let r=distribution([7,7,7]);
 assert.equal(r.llm.histogram.length,1);
 assert.deepEqual(r.llm.histogram,[['7',3]]);
 assert.equal(r.llm.selected_school.percentile,50);
 assert.equal(r.llm.min,7);assert.equal(r.llm.max,7);
 r=distribution([null,undefined,NaN,Infinity,-Infinity,0,2,2,4],6);
 assert.equal(r.llm.total,9);assert.equal(r.llm.n,4);assert.equal(r.llm.missing,5);
 assert.equal(r.llm.mean,2);assert.equal(r.llm.median,2);
 assert.equal(r.llm.selected_school.percentile,50);
 assert.equal(r.llm.histogram.reduce((n,b)=>n+b[1],0),4);
 assert.equal(r.visual.chart.points.filter(p=>p.selected).length,1);
 r=distribution([3]);
 assert.equal(r.llm.histogram.length,1);assert.equal(r.llm.selected_school.percentile,50);
 assert.deepEqual([r.llm.q1,r.llm.median,r.llm.q3],[3,3,3]);
 assert(r.visual.notes.some(n=>n.includes('10개 미만')));
 r=distribution([-10,-5,0,5,10],4);
 assert.equal(r.llm.histogram.reduce((n,b)=>n+b[1],0),5);
 assert.equal(r.llm.histogram.at(-1)[1],1,'maximum belongs to final interval');
 assert.equal(r.llm.selected_school.percentile,90);
 r=distribution([0.001,0.002,0.003]);
 assert.equal(new Set(r.llm.histogram.map(b=>b[0])).size,8,'narrow bins retain distinct actual boundaries');
 r=distribution([null,1],0);assert.equal(r.llm.selected_school,null);
 assert.throws(()=>distribution([null,undefined,NaN,Infinity]),/값이 있는 학교가 없습니다/);
 console.log('PASS distribution: finite values, missing denominator, equal/single/negative values, actual bins, midrank and sparse sample notice');
}finally{table.build=originalBuild;table.sourceFor=originalSource;}
