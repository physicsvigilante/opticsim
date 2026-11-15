import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {validate,mirrorEndpoints,serializeSave} from '../src/contract.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {sceneHash} from '../src/qualified-utils.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {browserExecution,snapshotScenario,compareExplorationSnapshots} from '../src/exploration.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const {observeDetectorSet,loadDocument,DETECTOR_HIT_EVENT_LIMIT}=core;
const load=n=>JSON.parse(readFileSync(new URL('./fixtures/detector-hit-'+n+'.json',import.meta.url)));
const request=(id='Dhit')=>[{id:'hits',kind:'detector-hit-events',componentId:id},
 {id:'crossings',kind:'detector-crossings',componentId:id}];
const run=(d,requests=request())=>evaluateDocument(d,core,requests);
const results=async(d,execution,requests=request())=>
 (await evaluateObservables(d,requests,execution.summary)).results;
const close=(a,b,eps=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<eps,`${a} != ${b}`);
const hit=e=>e.pointMm;
const hasNoFabricatedIds=e=>{assert.deepEqual(Object.keys(e).sort(),['distanceFromP1Mm','incomingUnit','pointMm']);
 assert.ok(!('rayId'in e)&&!('sourceId'in e)&&!('rayIndex'in e));};

test('an opt-in native hit report preserves exact legacy detector counts, source and optical observations',async()=>{
 for(const name of ['plate','lens']){
  const d=load(name),before=serializeSave(d),legacy=evaluateDocument(d,core),current=run(d);
  assert.equal(current.summary.native.status,'completed');assert.equal(legacy.summary.native.status,'completed');
  assert.equal(serializeSave(d),before);
  for(const key of NATIVE_OBSERVATION_KEYS)assert.deepEqual(current.summary.observations[key],legacy.summary.observations[key]);
  assert.deepEqual(snapshotNativeObservations(current.report.native.diagnostics),legacy.summary.observations);
  assert.equal(Object.hasOwn(legacy.summary.observations,'detectorHitEventsById'),false);
  assert.deepEqual(Object.keys(legacy.summary.observations),NATIVE_OBSERVATION_KEYS);
  const count=current.summary.observations.detectorsById.Dhit.crossings;
  const actual=current.summary.observations.detectorHitEventsById.Dhit;
  assert.equal(actual.status,'complete');assert.equal(actual.reasonCode,null);
  assert.equal(actual.events.length,count);assert.equal(actual.observedCount,count);assert.equal(actual.limit,DETECTOR_HIT_EVENT_LIMIT);
  const readings=await results(d,current);assert.equal(readings[0].value.length,count);assert.equal(readings[1].value,count);
  assert.equal(readings[0].method,'native-hit-event-observation');
  assert.equal(Object.hasOwn(readings[0].value[0],'sourceId'),false);
  assert.match(readings[0].limitation,/callback order.*not one ray path/);
 }
});

test('one real single-ray plate/mirror round trip gives two native coordinates matching independent Snell geometry',async()=>{
 const d=load('plate'),actual=run(d),[hits,counts]=await results(d,actual);
 assert.equal(actual.summary.observations.emissionsById.S1.emitted,1);
 assert.equal(actual.summary.observations.interfacesById.I1.interactions,2);
 assert.equal(actual.summary.observations.reflectionsById.M1,1);
 assert.equal(counts.value,2);assert.equal(hits.value.length,2);
 const [a,b]=hits.value;hasNoFabricatedIds(a);hasNoFabricatedIds(b);
 close(hit(a).y,50);close(hit(b).y,50);
 // Unfold the return from the mirror for independently expressed Snell geometry.
 // This predicts detector intersection coordinates; it supplies NO ray to PhyDemo.
 const i=60*Math.PI/180, n=1.8, inner=Math.asin(Math.sin(i)/n);
 const first=-50*Math.tan(i),exit=2*60*Math.tan(inner),second=exit+50*Math.tan(i);
 close(hit(a).x,first,1e-6);close(hit(b).x,second,1e-6);
 close(hit(b).x-hit(a).x,2*50*Math.tan(i)+exit,1e-6);
 close(a.incomingUnit.x,Math.cos(Math.PI/6));close(a.incomingUnit.y,-.5);
 close(b.incomingUnit.x,Math.cos(Math.PI/6));close(b.incomingUnit.y,.5);
 assert.equal(hits.status,'qualified'); // Explicitly omitted Fresnel partial reflections remain disclosed.
 assert.match(formatRequestedResult(hits),/Hit 1.*x=/);
});

test('lens/mirror arrangement reports actual sampled crossing positions, not paired paths or source attribution',async()=>{
 const d=load('lens'),actual=run(d),[hits,count]=await results(d,actual);
 assert.equal(actual.summary.observations.emissionsById['source-1'].emitted,6);
 assert.equal(count.value,11);assert.equal(hits.value.length,11);
 assert.ok(hits.value.slice(0,6).every(e=>e.incomingUnit.x>0));
 assert.ok(hits.value.slice(6).every(e=>e.incomingUnit.x<0));
 for(const e of hits.value){hasNoFabricatedIds(e);close(e.pointMm.x,-120,1e-7);
  assert.ok(e.pointMm.y>-110&&e.pointMm.y<110);close(Math.hypot(e.incomingUnit.x,e.incomingUnit.y),1);}
 assert.equal(hits.status,'available');
});

test('finite detector misses are available empty lists, not absent or guessed ray evidence',async()=>{
 const d=load('plate'),source=d.physics.components.find(c=>c.type==='point-source');source.emission.directionDeg=180;
 validate(d);const r=run(d),[hits,count]=await results(d,r);assert.equal(r.summary.native.status,'completed');
 assert.deepEqual(hits.value,[]);assert.equal(hits.status,'qualified');assert.equal(count.value,0);
});

test('overflow with two sampled sources withholds ENTIRE hit list while preserving complete native counters',async()=>{
 const d=JSON.parse(readFileSync(new URL('../scenes/general-source-detector.json',import.meta.url)));
 d.simulation.rayDensity=1;d.physics.components.push({...structuredClone(d.physics.components[0]),id:'S2',
   parameters:{...d.physics.components[0].parameters,y:40}});
 validate(d);const req=request('D1'),r=run(d,req),[hits,count]=await results(d,r,req);
 assert.equal(r.summary.native.status,'completed');assert.ok(count.value>DETECTOR_HIT_EVENT_LIMIT);
 assert.equal(hits.status,'unavailable');assert.equal(hits.value,null);assert.match(hits.reason,/withheld, not clipped/);
 const data=r.summary.observations.detectorHitEventsById.D1;
 assert.equal(data.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');assert.equal(data.events,null);
 assert.equal(data.observedCount,count.value);
 assert.ok(!JSON.stringify(data).includes('sourceId'));
});

test('invalid endpoint and contradictory callback coordinates do not become accepted physical measurements',()=>{
 const d=load('plate'),loaded=loadDocument(d),meter=observeDetectorSet(d,loaded.scene,loaded.idMap,{captureHitEvents:true});
 const detector=loaded.scene.objs[loaded.idMap.get('Dhit')],p1=detector.p1;
 const ray={p1:{x:p1.x,y:p1.y+10},p2:{x:p1.x,y:p1.y-10},brightness_s:1,brightness_p:0};
 detector.onSimulationStart();detector.onRayIncident(ray,0,{x:p1.x,y:p1.y});
 assert.equal(meter.byId.Dhit.crossings,1);
 assert.equal(meter.hitEventsById.Dhit.status,'unavailable');
 assert.equal(meter.hitEventsById.Dhit.events,null);
 assert.equal(meter.hitEventsById.Dhit.reasonCode,'AMBIGUOUS_DETECTOR_HIT');
});

test('incomplete Fresnel and depth-limited traces suppress both new events and old registered native readouts',async()=>{
 for(const mutate of [d=>{d.physics.components.find(c=>c.type==='planar-interface').parameters.partialReflection=true;},
  d=>{d.simulation.maxRayDepth=2;}]){
  const d=load('plate');mutate(d);const r=run(d),values=await results(d,r);
  assert.equal(r.summary.native.status,'incomplete');assert.equal(r.summary.observations,null);
  assert.equal(r.report.native.diagnostics.detectorHitEventsById,null);
  assert.ok(values.every(v=>v.status==='suppressed'&&v.value===null));
 }
});

test('stale scene hash and missing opt-in provenance never promote hit positions into verified results',async()=>{
 const d=load('plate'),r=run(d),changed=structuredClone(d);
 changed.physics.components.find(c=>c.type==='point-source').emission.directionDeg=-31;validate(changed);
 const stale=await results(changed,r);assert.ok(stale.every(v=>v.status==='suppressed'&&v.value===null));
 const legacy=evaluateDocument(d,core);const [noCapture]=await results(d,legacy);
 assert.equal(noCapture.status,'unavailable');assert.equal(noCapture.value,null);
 const bad=structuredClone(r.summary);bad.observations.detectorHitEventsById.Dhit.events.pop();
 const [inconsistent]=(await evaluateObservables(d,request(),bad)).results;
 assert.equal(inconsistent.status,'unavailable');assert.equal(inconsistent.value,null);
});

test('browser projection reuses actual captured diagnostics and qualified package can reopen without inherited events',async()=>{
 const d=load('plate'),req=request(),r=run(d),fromBrowser=await browserExecution(d,r.summary.native.status,r.report.native.diagnostics,req);
 assert.deepEqual(fromBrowser.summary.observations,r.summary.observations);
 const q=initialQualification(d,null,{inputSha256:'e'.repeat(64),interpretation:{assumptions:['Synthetic plate/mirror teaching trial; Fresnel partial reflections explicitly omitted.'],unknowns:[]}});
 const bundle=await createQualifiedBundle(d,q,req),roundtrip=await parseQualifiedBundle(JSON.stringify(bundle));
 assert.deepEqual(roundtrip.observables,req);assert.equal(roundtrip.sceneSha256,await sceneHash(d));
 assert.equal(Object.hasOwn(roundtrip,'execution'),false);
 const saved=await snapshotScenario(bundle,fromBrowser,'native baseline');
 assert.equal(saved.results.results[0].value.length,2);
 const next=structuredClone(saved);next.execution.summary.observations.detectorHitEventsById.Dhit.events[0].pointMm.x=123;
 const comparison=await compareExplorationSnapshots(saved,next);
 assert.equal(comparison.evidenceChecks.scenario.accepted,false);
 assert.ok(comparison.entries.every(x=>x.comparison==='not-comparable'));
});

test('the public contract keeps old native keys, and displayed event positions remain literal measurements',()=>{
 assert.equal(DETECTOR_HIT_EVENT_LIMIT,32);
 assert.deepEqual(NATIVE_OBSERVATION_KEYS,['emissionsById','reflectionsById','detectorsById','interfacesById','blockersById']);
 const c=observableCapabilities();assert.equal(c.kinds['detector-hit-events'].type,'ray-detector');
 const old=snapshotNativeObservations({});assert.deepEqual(Object.keys(old),NATIVE_OBSERVATION_KEYS);
 assert.equal(Object.hasOwn(old,'detectorHitEventsById'),false);
 const selected=snapshotNativeObservations({},request());assert.equal(selected.detectorHitEventsById,null);
});
