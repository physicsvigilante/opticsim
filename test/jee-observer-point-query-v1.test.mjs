import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {analyzeObserverPointQuery,observerPointCapabilities,
 OBSERVER_QUERY_FORMAT} from '../src/planar-observer-point-query.js';
import {runObserverPointEvidence} from '../scripts/planar-observer-point-query.mjs';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const near=(a,b,e=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=e,`Expected ${b}, got ${a}, tolerance ${e}`);
const nearPoint=(a,b,e=1e-7)=>{near(a.x,b.x,e);near(a.y,b.y,e);};
const base=()=>({format:OBSERVER_QUERY_FORMAT,kind:'source-to-observer-transmission',
 lengthUnit:'mm',source:{x:-60,y:0},observer:{x:100,y:40},
 interface:{x:0,y:0,normalDeg:0,sourceIndex:1.5,observerIndex:1}});
const solve=analyzeObserverPointQuery;
const out=()=>resolve('test-artifacts/llm-authoring/observer-point-typed-'+randomUUID());
const raw=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const obsRequests=[
 {id:'source',kind:'source-emissions',componentId:'S1'},
 {id:'interface',kind:'interface-first-event',componentId:'I1'},
 {id:'detected',kind:'detector-crossings',componentId:'D1'},
 {id:'hit',kind:'detector-hit-events',componentId:'D1'}
];
const sceneInput=(q,analysis)=>{
 const physical={
  lengthUnit:'mm',title:'Fully specified, test-only native observer arrival',
  components:[
   {id:'S1',type:'point-source',parameters:{
     x:analysis.value.sourceMm.x,y:analysis.value.sourceMm.y,brightness:1},
    emission:{mode:'single-ray',directionDeg:analysis.value.predictedInitialDirectionDeg}},
   {id:'I1',type:'planar-interface',parameters:{
     x:q.interface.x,y:q.interface.y,normalDeg:q.interface.normalDeg,
     negativeIndex:q.interface.sourceIndex,
     positiveIndex:q.interface.observerIndex,partialReflection:false}},
   {id:'D1',type:'ray-detector',parameters:{
     x:analysis.value.observerMm.x,y:analysis.value.observerMm.y,
     orientationDeg:((q.interface.normalDeg+90+180)%360)-180,length:20}}
  ]};
 return prepareScene(physical).document;
};
test('typed source-observer query returns correct Snell ray, crossing and conditional virtual-axis depth',()=>{
 const q=base(),snapshot=structuredClone(q),r=solve(q);
 assert.deepEqual(q,snapshot);
 assert.equal(r.status,'conditional');
 assert.equal(r.method,'analytical-stationary-optical-path-and-snells-law');
 assert.equal(r.format,'opticsim-planar-observer-point-result-v1');
 assert.equal(r.native.status,'not-run');
 assert.equal(r.native.observations,null);
 assert.equal(r.value.nativeImageDetected,false);
 assert.equal(r.value.crossingIsNativeHit,false);
 assert.equal(r.value.apparentPointIsNativeHit,false);
 nearPoint(r.value.interfaceCrossingMm,{x:0,y:11.24615577120923},1e-7);
 near(r.value.predictedInitialDirectionDeg,10.616108941304955,1e-8);
 near(r.value.incidentAngleDeg,10.616108941304955,1e-8);
 near(r.value.refractedAngleDeg,16.041977708350927,1e-8);
 near(r.value.conditionalApparentDepthMm,39.11183381854949,1e-7);
 near(r.value.paraxialLimitMm,40);
 nearPoint(r.value.conditionalAxisInterceptMm,{x:-39.11183381854949,y:0},1e-6);
 assert.equal(r.value.axisInterceptStatus,'conditional');
 near(r.value.outgoingUnit.x,Math.cos(16.041977708350927*Math.PI/180),1e-8);
});
test('opposite tangent signs, index equality, and increased observer index retain independent controls',()=>{
 const q=base(),plus=solve(q),minus=base();
 minus.observer.y=-40;
 const b=solve(minus);
 assert.equal(b.status,'conditional');
 near(b.value.interfaceCrossingMm.y,-plus.value.interfaceCrossingMm.y);
 near(b.value.predictedInitialDirectionDeg,-plus.value.predictedInitialDirectionDeg);
 near(b.value.conditionalApparentDepthMm,plus.value.conditionalApparentDepthMm);
 const equal=base();equal.interface.sourceIndex=equal.interface.observerIndex=1;
 const er=solve(equal);assert.equal(er.status,'conditional');
 near(er.value.conditionalApparentDepthMm,60);
 const reversed=base();reversed.interface.sourceIndex=1;reversed.interface.observerIndex=1.5;
 const rev=solve(reversed);
 assert.equal(rev.status,'conditional');
 near(rev.value.conditionalApparentDepthMm,92.53084858,1e-5);
 assert.ok(rev.value.conditionalApparentDepthMm>60);
});
test('translation, normal rotation 90/180, lateral plane point shift, and units preserve geometry',()=>{
 const q=base(),ref=solve(q),rotate=(p,a)=>a===90?{x:-p.y,y:p.x}:{x:-p.x,y:-p.y};
 for(const a of [90,180]){
  const r=structuredClone(q);r.source=rotate(q.source,a);r.observer=rotate(q.observer,a);
  Object.assign(r.interface,rotate({x:q.interface.x,y:q.interface.y}));
  r.interface.normalDeg=a;
  const x=solve(r);
  assert.equal(x.status,'conditional');
  near(x.value.conditionalApparentDepthMm,ref.value.conditionalApparentDepthMm);
  nearPoint(x.value.interfaceCrossingMm,rotate(ref.value.interfaceCrossingMm,a),1e-6);
  nearPoint(x.value.conditionalAxisInterceptMm,rotate(ref.value.conditionalAxisInterceptMm,a),1e-6);
 }
 const translated=base();
 translated.source.x+=13;translated.source.y+=11;
 translated.observer.x+=13;translated.observer.y+=11;
 translated.interface.x+=13;translated.interface.y-=9; // lateral point on same infinite plane
 const t=solve(translated);
 assert.equal(t.status,'conditional');
 near(t.value.conditionalApparentDepthMm,ref.value.conditionalApparentDepthMm);
 nearPoint(t.value.interfaceCrossingMm,{x:ref.value.interfaceCrossingMm.x+13,
   y:ref.value.interfaceCrossingMm.y+11});
 for(const [unit,div] of [['cm',10],['m',1000]]){
  const u=structuredClone(q);u.lengthUnit=unit;
  for(const p of [u.source,u.observer,u.interface]){p.x/=div;p.y/=div;}
  const v=solve(u);
  assert.equal(v.status,'conditional');
  nearPoint(v.value.interfaceCrossingMm,ref.value.interfaceCrossingMm);
  near(v.value.conditionalApparentDepthMm,ref.value.conditionalApparentDepthMm);
 }
});
test('exact axial ray remains determinate, but one ray cannot identify virtual depth',()=>{
 const q=base();q.observer.y=0;
 const r=solve(q);
 assert.equal(r.status,'conditional');
 near(r.value.predictedInitialDirectionDeg,0);
 nearPoint(r.value.interfaceCrossingMm,{x:0,y:0});
 assert.equal(r.value.axisInterceptStatus,'not-identifiable');
 assert.equal(r.value.conditionalApparentDepthMm,null);
 assert.equal(r.value.conditionalAxisInterceptMm,null);
 near(r.value.paraxialLimitMm,40);
 const nearAxial=base();nearAxial.observer.y=1e-11;
 const n=solve(nearAxial);
 assert.equal(n.status,'numerically-unstable');
 assert.equal(n.reasonCode,'NEAR_AXIAL_INFERENCE');
 assert.equal(n.value,null);
});
test('large world coordinate cancellation and near-critical exit refuse, never invent a source heading',()=>{
 const q=base();
 q.source={x:-.02,y:9000};q.observer={x:.02,y:9000.01};
 const cancellation=solve(q);
 assert.equal(cancellation.status,'numerically-unstable');
 assert.equal(cancellation.reasonCode,'WORLD_COORDINATE_ROUNDING');
 assert.equal(cancellation.value,null);
 assert.ok(Math.abs(cancellation.numericalDiagnostics.localSnellResidual)<=1e-12);
 assert.ok(Math.abs(cancellation.numericalDiagnostics.representedWorldSnellResidual)>1e-12);
 const grazing=base();grazing.observer.y=9000;
 const g=solve(grazing);
 assert.equal(g.status,'numerically-unstable');
 assert.equal(g.reasonCode,'NEAR_GRAZING_EXIT');assert.equal(g.value,null);
});
test('independent R2 grazing-INGRESS counterexample and mirrored negative span both withhold',()=>{
 const q=base();
 Object.assign(q.interface,{normalDeg:135,sourceIndex:1,observerIndex:2});
 q.source={x:9758.080722152847,y:9758.066438595866};
 q.observer={x:-9616.652224137046,y:-9475.230867899736};
 const n={x:Math.cos(135*Math.PI/180),y:Math.sin(135*Math.PI/180)};
 const reflected=p=>{const v=2*(p.x*n.x+p.y*n.y);return {x:n.x*v-p.x,y:n.y*v-p.y};};
 for(const model of [q,{...q,source:reflected(q.source),observer:reflected(q.observer)}]){
  const r=solve(model);
  assert.equal(r.status,'numerically-unstable');
  assert.equal(r.reasonCode,'NEAR_GRAZING_INGRESS');
  assert.equal(r.value,null);
  assert.equal(r.native.status,'not-run');
  assert.ok(Math.abs(r.numericalDiagnostics.localSnellResidual)<=1e-12);
  assert.ok(Math.abs(r.numericalDiagnostics.representedWorldSnellResidual)<=1e-12);
 }
});
test('closed JSON input rejects wrong medium side, unknown fields, coordinates, index and units',()=>{
 const edits=[
  q=>delete q.source.x, q=>delete q.interface.sourceIndex,
  q=>q.interface.sourceIndex=.5,q=>q.interface.observerIndex=4.1,
  q=>q.interface.normalDeg=181,q=>q.interface.normalDeg='0',
  q=>q.source.x=20,q=>q.observer.x=-20,
  q=>q.source.x=-.009,q=>q.observer.x=.009,
  q=>q.source.x=-10001,q=>q.observer.y=10001,
  q=>q.observer.x=Infinity,q=>q.source.y=null,
  q=>q.source.expression='source.y=5',q=>q.interface.radius=25,
  q=>q.kind='general-ray-inversion',q=>q.format='unknown',
  q=>q.lengthUnit='unknown',q=>q.simulation={rayDensity:.2},
  q=>q.observer.mode='reconstruct-image'
 ];
 for(const mutate of edits){const q=base();mutate(q);assert.throws(()=>solve(q));}
 const at=base();at.source.x=-.01;at.observer.x=.01;at.observer.y=0;
 // Inclusive exact source/observer clearance is admissible when the ray
 // is truly axial, rather than accidentally demanding a grazing shot.
 assert.equal(solve(at).status,'conditional');
});
test('actual independently authored native scene confirms one single ray reaches observer; analytical query never invokes native',async()=>{
 for(const y of [40,-40]){
  const q=base();q.observer.y=y;
  const result=solve(q);assert.equal(result.status,'conditional');
  const scene=sceneInput(q,result);
  assert.equal(scene.schemaVersion,5);
  const native=evaluateDocument(scene,core,obsRequests).summary;
  assert.equal(native.native.status,'completed');assert.equal(native.executionPassed,true);
  const observation=await evaluateObservables(scene,obsRequests,native);
  assert.equal(observation.canonicalSha256,native.canonicalSha256);
  const by=Object.fromEntries(observation.results.map(x=>[x.id,x]));
  assert.equal(by.source.value,1);assert.equal(by.detected.value,1);
  assert.equal(by.interface.method,'native-observation');
  assert.equal(by.hit.method,'native-hit-event-observation');
  assert.equal(by.hit.status,'qualified');
  assert.ok(by.hit.warnings.some(x=>/omits Fresnel/.test(x)));
  assert.equal(native.observations.detectorHitEventsById.D1.observedCount,1);
  assert.equal(by.hit.value.length,1);
  nearPoint(by.hit.value[0].pointMm,result.value.observerMm,1e-5);
  nearPoint(by.hit.value[0].incomingUnit,result.value.outgoingUnit,1e-7);
  assert.equal(by.interface.value.outcome,'transmission');
  near(by.interface.value.incidentAngleDeg,Math.abs(result.value.incidentAngleDeg),1e-6);
  near(by.interface.value.transmittedAngleDeg,Math.abs(result.value.refractedAngleDeg),1e-6);
  // This independent test uses a separately fully authored physical scene.
  // No native hit exists in the public analytical query result itself.
  assert.equal(result.native.status,'not-run');
  assert.equal(result.value.crossingIsNativeHit,false);
 }
});
test('native stale/hash-mismatch and incomplete execution withhold all hit evidence',async()=>{
 const q=base(),r=solve(q),scene=sceneInput(q,r),run=evaluateDocument(scene,core,obsRequests).summary;
 const stale=structuredClone(scene);
 stale.physics.components.find(x=>x.id==='S1').emission.directionDeg+=1;
 assert.ok((await evaluateObservables(stale,obsRequests,run)).results.every(
  x=>x.status==='suppressed'&&x.value===null));
 const shallow=structuredClone(scene);shallow.simulation.maxRayDepth=0;
 const incomplete=evaluateDocument(shallow,core,obsRequests).summary;
 assert.equal(incomplete.native.status,'incomplete');
 assert.equal(incomplete.observations,null);
 assert.ok((await evaluateObservables(shallow,obsRequests,incomplete)).results.every(
  x=>x.status==='suppressed'&&x.value===null));
});
test('CLI preserves original bytes/hash, refuses overwrite and invalid JSON, never packages a native scene',()=>{
 const data=raw(base()),directory=out();
 const r=runObserverPointEvidence({queryBytes:data,outputPath:directory});
 assert.equal(r.status,'conditional');assert.equal(r.exitCode,0);
 assert.deepEqual(readFileSync(resolve(directory,'input.json')),data);
 assert.equal(r.report.originalInputSha256,createHash('sha256').update(data).digest('hex'));
 const analysis=JSON.parse(readFileSync(resolve(directory,'analytical-result.json')));
 assert.equal(analysis.originalInputSha256,r.report.originalInputSha256);
 assert.equal(analysis.results.native.status,'not-run');
 assert.equal(analysis.results.value.nativeImageDetected,false);
 assert.equal(existsSync(resolve(directory,'scene.ray-optics-2d.json')),false);
 assert.throws(()=>runObserverPointEvidence({queryBytes:data,outputPath:directory}),/exists|already/);
 const invalid=Buffer.from('{"kind": }'),badDir=out();
 const bad=runObserverPointEvidence({queryBytes:invalid,outputPath:badDir});
 assert.equal(bad.status,'rejected');assert.equal(bad.exitCode,1);
 assert.equal(bad.report.native.status,'not-run');
 assert.deepEqual(readFileSync(resolve(badDir,'input.json')),invalid);
 assert.equal(existsSync(resolve(badDir,'analytical-result.json')),false);
 assert.equal(observerPointCapabilities().format,OBSERVER_QUERY_FORMAT);
 assert.deepEqual(observerPointCapabilities().statuses,['conditional','numerically-unstable']);
});
