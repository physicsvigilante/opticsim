// Opt-in derived geometry from an existing, complete native detector event
// list. No additional ray propagation, image inference, source attribution,
// brightness weighting, frame fitting, or change to legacy default readouts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {mirrorEndpoints,validate} from '../src/contract.js';
import {directionalDetectorFootprint,DIRECTIONAL_FOOTPRINT_METHOD} from '../src/detector-directional-footprint.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {browserExecution} from '../src/exploration.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const load=n=>JSON.parse(readFileSync(new URL('./fixtures/detector-hit-'+n+'.json',import.meta.url),'utf8'));
const requests=(id='Dhit')=>[
 {id:'foot',kind:'detector-directional-footprint',componentId:id},
 {id:'hits',kind:'detector-hit-events',componentId:id},
 {id:'crossings',kind:'detector-crossings',componentId:id}
];
const only=(id='Dhit')=>[{id:'foot',kind:'detector-directional-footprint',componentId:id}];
const run=(d,req=only())=>evaluateDocument(d,core,req);
const read=async(d,r,req=only())=>(await evaluateObservables(d,req,r.summary)).results;
const near=(a,b,eps=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${a} differs from ${b}`);
function directStats(values){
 if(!values.length)return {count:0,mean:null,min:null,max:null,span:null,rms:null};
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 return {count:values.length,mean,min:Math.min(...values),max:Math.max(...values),
  span:Math.max(...values)-Math.min(...values),
  rms:Math.sqrt(values.reduce((v,x)=>v+(x-mean)**2,0)/values.length)};
}
function verifyGroup(g,values){
 const expected=directStats(values);assert.equal(g.count,expected.count);
 if(!values.length){
  for(const key of ['meanDistanceFromP1Mm','meanPointMm','spanMm','rmsSpreadMm',
   'minDistanceFromP1Mm','maxDistanceFromP1Mm'])assert.equal(g[key],null);
 }else{
  near(g.meanDistanceFromP1Mm,expected.mean);
  near(g.minDistanceFromP1Mm,expected.min);
  near(g.maxDistanceFromP1Mm,expected.max);
  near(g.spanMm,expected.span);
  near(g.rmsSpreadMm,expected.rms);
 }
}

test('new opt-in footprint alone captures native events while all legacy results remain untouched',async()=>{
 const d=load('lens'),req=only(),before=JSON.stringify(d);
 const legacy=evaluateDocument(d,core),newRun=run(d,req);
 assert.equal(JSON.stringify(d),before);
 assert.equal(legacy.summary.native.status,'completed');
 assert.equal(newRun.summary.native.status,'completed');
 for(const key of NATIVE_OBSERVATION_KEYS)
  assert.deepEqual(newRun.summary.observations[key],legacy.summary.observations[key]);
 assert.equal(Object.hasOwn(legacy.summary.observations,'detectorHitEventsById'),false);
 assert.ok(newRun.summary.observations.detectorHitEventsById.Dhit);
 const [result]=await read(d,newRun,req);
 assert.equal(result.kind,'detector-directional-footprint');
 assert.equal(result.method,DIRECTIONAL_FOOTPRINT_METHOD);
 assert.equal(result.status,'available');
 assert.equal(result.value.observedCount,11);
 assert.equal(result.value.towardPositiveNormal.count,5);
 assert.equal(result.value.towardNegativeNormal.count,6);
 near(result.value.detectorNormalUnit.x,-1);
 near(result.value.detectorNormalUnit.y,0);
 assert.deepEqual(Object.keys(legacy.summary.observations),NATIVE_OBSERVATION_KEYS);
 assert.match(formatRequestedResult(result),/Toward positive normal/);
 assert.match(result.limitation,/No physical image/);
});

test('lens/mirror return has distinct outgoing/incoming native detector footprint statistics',async()=>{
 const d=load('lens'),req=requests(),r=run(d,req),[fp,hits,cross]=await read(d,r,req);
 assert.equal(cross.value,11);
 assert.equal(fp.value.observedCount,11);
 const values=hits.value;
 const outgoing=values.filter(x=>x.incomingUnit.x>0).map(x=>x.distanceFromP1Mm);
 const returning=values.filter(x=>x.incomingUnit.x<0).map(x=>x.distanceFromP1Mm);
 verifyGroup(fp.value.towardNegativeNormal,outgoing);
 verifyGroup(fp.value.towardPositiveNormal,returning);
 // The two sampled crossing populations are separate; no inferred matching,
 // optical path identity or brightness weighting is created.
 const p=d.physics.components.find(x=>x.id==='Dhit').parameters;
 const [a,b]=mirrorEndpoints(p),L=Math.hypot(b.x-a.x,b.y-a.y);
 near(fp.value.detectorLengthMm,L);
 for(const g of [fp.value.towardPositiveNormal,fp.value.towardNegativeNormal]){
  near(g.meanPointMm.x,p.x);
  assert.ok(g.meanPointMm.y>=a.y&&g.meanPointMm.y<=b.y);
 }
 assert.equal(fp.value.towardPositiveNormal.count+fp.value.towardNegativeNormal.count,cross.value);
 assert.ok(!JSON.stringify(fp.value).includes('sourceId'));
 assert.ok(!JSON.stringify(fp.value).includes('rayToken'));
});

test('planar glass and mirror returns are separated by normal side and independently checked geometry',async()=>{
 const d=load('plate'),req=requests(),r=run(d,req),[fp,hits,cross]=await read(d,r,req);
 assert.equal(cross.value,2);
 assert.equal(fp.status,'qualified'); // Explicit transmitted-only Fresnel approximation.
 assert.equal(fp.value.towardPositiveNormal.count,1);
 assert.equal(fp.value.towardNegativeNormal.count,1);
 near(fp.value.detectorNormalUnit.x,0);
 near(fp.value.detectorNormalUnit.y,1);
 const first=hits.value.find(x=>x.incomingUnit.y<0),
       second=hits.value.find(x=>x.incomingUnit.y>0);
 near(fp.value.towardNegativeNormal.meanPointMm.x,first.pointMm.x);
 near(fp.value.towardPositiveNormal.meanPointMm.x,second.pointMm.x);
 near(fp.value.towardNegativeNormal.meanPointMm.y,50);
 near(fp.value.towardPositiveNormal.meanPointMm.y,50);
 near(fp.value.towardNegativeNormal.rmsSpreadMm,0);
 near(fp.value.towardPositiveNormal.rmsSpreadMm,0);
 const i=60*Math.PI/180,n=1.8,theta=Math.asin(Math.sin(i)/n);
 const firstX=-50*Math.tan(i),secondX=2*60*Math.tan(theta)+50*Math.tan(i);
 near(first.pointMm.x,firstX,1e-6);near(second.pointMm.x,secondX,1e-6);
});

test('true detector miss reports count zero and null centroids/widths, never invented zero beam width',async()=>{
 const d=load('plate');d.physics.components.find(c=>c.type==='point-source').emission.directionDeg=180;
 validate(d);const r=run(d),[fp]=await read(d,r);
 assert.equal(r.summary.native.status,'completed');
 assert.equal(fp.status,'qualified');
 assert.equal(fp.value.observedCount,0);
 verifyGroup(fp.value.towardPositiveNormal,[]);
 verifyGroup(fp.value.towardNegativeNormal,[]);
 assert.match(formatRequestedResult(fp),/No centroid or spread/);
});

test('a bounded oriented detector computes direction-resolved RMS with an independent reference',()=>{
 const parameters={x:15,y:-8,orientationDeg:45,length:100};
 const [p1,p2]=mirrorEndpoints(parameters),length=Math.hypot(p2.x-p1.x,p2.y-p1.y);
 const t={x:(p2.x-p1.x)/length,y:(p2.y-p1.y)/length};
 const n={x:-t.y,y:t.x};
 const samples=[{distance:10,dir:n},{distance:20,dir:n},{distance:30,dir:n},
   {distance:50,dir:{x:-n.x,y:-n.y}},{distance:70,dir:{x:-n.x,y:-n.y}}];
 const events=samples.map(s=>({pointMm:{x:p1.x+t.x*s.distance,y:p1.y+t.y*s.distance},
  distanceFromP1Mm:s.distance,incomingUnit:s.dir}));
 const actual=directionalDetectorFootprint(
  {status:'complete',observedCount:events.length,limit:32,events},parameters);
 assert.equal(actual.status,'complete');
 verifyGroup(actual.value.towardPositiveNormal,[10,20,30]);
 verifyGroup(actual.value.towardNegativeNormal,[50,70]);
 near(actual.value.towardPositiveNormal.meanDistanceFromP1Mm,20);
 near(actual.value.towardPositiveNormal.rmsSpreadMm,Math.sqrt(200/3));
 near(actual.value.towardNegativeNormal.rmsSpreadMm,10);
 near(actual.value.detectorNormalUnit.x,-Math.SQRT1_2);
 near(actual.value.detectorNormalUnit.y,Math.SQRT1_2);
});

test('native overflow, incomplete full Fresnel, stale hash and absent opt-in are fail-closed',async()=>{
 const d=JSON.parse(readFileSync(new URL('../scenes/general-source-detector.json',import.meta.url)));
 d.simulation.rayDensity=1;
 d.physics.components.push({...structuredClone(d.physics.components[0]),id:'S2',
  parameters:{...d.physics.components[0].parameters,y:40}});
 validate(d);
 const r=run(d,requests('D1'));
 const readings=await read(d,r,requests('D1'));
 assert.equal(r.summary.native.status,'completed');
 assert.ok(readings[2].value>32);
 assert.equal(readings[0].value,null);
 assert.equal(readings[0].status,'unavailable');
 assert.equal(r.summary.observations.detectorHitEventsById.D1.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');
 for(const mutate of [
  d=>{d.physics.components.find(c=>c.type==='planar-interface').parameters.partialReflection=true;},
  d=>{d.simulation.maxRayDepth=2;}
 ]){
  const plate=load('plate');mutate(plate);
  const unfinished=run(plate);
  assert.equal(unfinished.summary.native.status,'incomplete');
  assert.equal(unfinished.summary.observations,null);
  const [suppressed]=await read(plate,unfinished);
  assert.equal(suppressed.status,'suppressed');assert.equal(suppressed.value,null);
 }
 const plate=load('plate'),current=run(plate),changed=structuredClone(plate);
 changed.physics.components.find(x=>x.type==='point-source').emission.directionDeg=-31;
 validate(changed);const [stale]=await read(changed,current);
 assert.equal(stale.status,'suppressed');assert.equal(stale.value,null);
 const legacy=evaluateDocument(plate,core),[missing]=await read(plate,legacy);
 assert.equal(missing.status,'unavailable');assert.equal(missing.value,null);
});

test('tampered native positions and grazing directions cannot produce a qualified footprint',async()=>{
 const d=load('plate'),r=run(d);
 const alter=modify=>{
  const copy=structuredClone(r.summary);
  modify(copy.observations.detectorHitEventsById.Dhit.events);
  return copy;
 };
 const offset=alter(events=>{events[0].pointMm.x+=.02;});
 const [badPosition]=(await evaluateObservables(d,only(),offset)).results;
 assert.equal(badPosition.status,'unavailable');
 assert.equal(badPosition.reasonCode,'INCONSISTENT_NATIVE_DETECTOR_EVENT');
 const parallel=alter(events=>{events[0].incomingUnit={x:1,y:0};});
 const [grazing]=(await evaluateObservables(d,only(),parallel)).results;
 assert.equal(grazing.status,'unavailable');
 assert.equal(grazing.reasonCode,'UNRESOLVED_GRAZING_DETECTOR_DIRECTION');
 const mismatch=alter(events=>{events.pop();});
 const [missing]=(await evaluateObservables(d,only(),mismatch)).results;
 assert.equal(missing.status,'unavailable');
});

test('opt-in browser execution and public capability expose the same typed native result without default changes',async()=>{
 const d=load('lens'),req=only(),r=run(d),fromBrowser=await browserExecution(
  d,r.summary.native.status,r.report.native.diagnostics,req);
 assert.deepEqual(fromBrowser.summary.observations,r.summary.observations);
 const [cli]=await read(d,r,req);
 const browser=(await evaluateObservables(d,req,fromBrowser.summary)).results[0];
 assert.deepEqual(browser.value,cli.value);
 const metadata=observableCapabilities();
 assert.equal(metadata.kinds['detector-directional-footprint'].type,'ray-detector');
 assert.equal(snapshotNativeObservations({},[]).detectorHitEventsById,undefined);
 assert.equal(snapshotNativeObservations({},req).detectorHitEventsById,null);
});
