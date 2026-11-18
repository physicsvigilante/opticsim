// REVIEW-ONLY JEE integration stress: independently reviewed planar queries
// coexist with the held native PhyDemo v19 parallel Beam profile. One scene
// is NEVER silently promoted into another query's native evidence or image.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {analyzeApparentDepth,APPARENT_DEPTH_QUERY_FORMAT}
  from '../src/planar-apparent-depth-query.js';
import {analyzeObserverPointQuery,OBSERVER_QUERY_FORMAT}
  from '../src/planar-observer-point-query.js';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const nearly=(a,b,tolerance=1e-7,label='')=>
 assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,
  label+': '+a+' vs '+b+', tolerance '+tolerance);
const pointNearly=(a,b,tolerance=1e-7)=>{
 nearly(a.x,b.x,tolerance,'x');nearly(a.y,b.y,tolerance,'y');
};
const rotate=(p,deg)=>{
 const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {x:c*p.x-s*p.y,y:s*p.x+c*p.y};
};
const input=(normalDeg,sign,lengthUnit='mm')=>{
 const factor={mm:1,cm:10,m:1000}[lengthUnit];
 const scale=p=>({x:p.x/factor,y:p.y/factor});
 return {
  format:OBSERVER_QUERY_FORMAT,kind:'source-to-observer-transmission',
  lengthUnit,source:scale(rotate({x:-60,y:0},normalDeg)),
  observer:scale(rotate({x:100,y:sign*40},normalDeg)),
  interface:{...scale({x:0,y:0}),normalDeg,sourceIndex:1.5,observerIndex:1}
 };
};
const example=name=>JSON.parse(readFileSync(
 new URL('../examples/jee-parallel-'+name+'-v19.json',import.meta.url),'utf8'));
const row=results=>Object.fromEntries(results.map(x=>[x.id,x]));
test('integration: two independent planar query formats agree across signed rays, normals and units',()=>{
 let comparisons=0;
 for(const normalDeg of [0,90,-90,180,37])
  for(const sign of [-1,1])
   for(const lengthUnit of ['mm','cm','m']){
    const q=input(normalDeg,sign,lengthUnit);
    const before=JSON.stringify(q);
    const observer=analyzeObserverPointQuery(q);
    const label=normalDeg+'/'+sign+'/'+lengthUnit;
    assert.equal(observer.status,'conditional',label+': '+observer.reasonCode);
    const angleQ={
     format:APPARENT_DEPTH_QUERY_FORMAT,lengthUnit,
     source:structuredClone(q.source),
     interface:structuredClone(q.interface),
     observation:{kind:'finite-incidence-angle',
      incidentAngleDeg:observer.value.incidentAngleDeg}
    };
    const explicit=analyzeApparentDepth(angleQ);
    assert.equal(explicit.status,'conditional',label+': '+explicit.reasonCode);
    nearly(observer.value.conditionalApparentDepthMm,explicit.value.apparentDepthMm,1e-7);
    pointNearly(observer.value.conditionalAxisInterceptMm,explicit.value.apparentPointMm,1e-7);
    pointNearly(observer.value.interfaceCrossingMm,explicit.value.interfaceCrossingMm,1e-7);
    nearly(observer.value.refractedAngleDeg,explicit.value.refractedAngleDeg,1e-7);
    assert.equal(observer.native.status,'not-run');
    assert.equal(explicit.native.status,'not-run');
    assert.equal(observer.native.observations,null);
    assert.equal(explicit.native.observations,null);
    assert.equal(observer.value.nativeImageDetected,false);
    assert.equal(explicit.value.nativeImageDetected,false);
    assert.equal(JSON.stringify(q),before,'analytical query must not mutate supplied coordinates');
    comparisons++;
   }
 assert.equal(comparisons,30);
 console.log('JEE_PLANAR_V19_ANALYTIC_CROSS_CONTRACT '+
  JSON.stringify({comparisons,normalDeg:[0,90,-90,180,37],
   tangentSign:[-1,1],lengthUnit:['mm','cm','m'],native:'not-run',
   image:false}));
});
test('integration: genuine native v19 lens/stop beam does not manufacture planar query observations',async()=>{
 const data=example('lens'),original=JSON.stringify(data.physical);
 const d=prepareScene(data.physical).document;
 assert.equal(d.schemaVersion,19);
 assert.equal(d.adapterVersion,19);
 assert.equal(JSON.stringify(data.physical),original);
 const output=evaluateDocument(d,core,data.requests).summary;
 assert.equal(output.native.status,'completed');
 assert.equal(output.executionPassed,true);
 const observations=await evaluateObservables(d,data.requests,output);
 assert.equal(observations.canonicalSha256,output.canonicalSha256);
 const by=row(observations.results);
 assert.equal(by.emitted.value,8);
 assert.equal(by.absorbed.value,6);
 assert.equal(by.detected.value,2);
 assert.equal(by.hits.value.length,2);
 assert.equal(by.hits.method,'native-hit-event-observation');
 assert.ok(by.hits.value.every(h=>Number.isFinite(h.pointMm.x)&&
   Number.isFinite(h.pointMm.y)));
 for(const h of by.hits.value){nearly(h.pointMm.x,100);nearly(h.pointMm.y,0);}
 const analytic=analyzeObserverPointQuery(input(0,1));
 assert.equal(analytic.native.status,'not-run');
 assert.equal(analytic.native.observations,null);
 assert.equal(analytic.value.nativeImageDetected,false);
 assert.equal(output.native.status,'completed');
 assert.equal(output.observations.detectorsById.D1.crossings,2);
 console.log('JEE_PLANAR_V19_NATIVE_COEXISTENCE '+JSON.stringify({
  schemaVersion:d.schemaVersion,emitted:8,absorbed:6,
  detectorCrossings:2,actualHitEvents:2,
  independentAnalyticalNativeStatus:'not-run',nativeImageDetected:false}));
});
test('integration: post-lens finite aperture ambiguity still refuses while source-observer math remains conditional',()=>{
 const a=example('lens').physical;
 const bad=structuredClone(a);
 const stop=bad.components.find(c=>c.id==='A1');
 stop.parameters.x=50;
 stop.parameters.openingLength=17.5;
 assert.throws(()=>prepareScene(bad),/downstream of a forward ideal lens/);
 const b=analyzeObserverPointQuery(input(0,1));
 assert.equal(b.status,'conditional');
 assert.equal(b.native.status,'not-run');
 // That independent ideal single-plane math does not clear the unsupported
 // native post-lens stop, nor assert any transmitted detector image.
 assert.equal(b.value.crossingIsNativeHit,false);
});
