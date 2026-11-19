// Strict v18-only native output proximity withholding: genuine PhyDemo
// optical trajectories remain unchanged; only qualification is withheld.
// Actual native runs and explicitly test-injected observer calls are separate.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {V18_CORNER_GUARD_METHOD} from '../src/native-v18-aperture-corner-guard.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=file=>JSON.parse(readFileSync(new URL('../examples/'+file,import.meta.url),'utf8'));
const by=(p,id)=>p.components.find(c=>c.id===id).parameters;

async function refractedReferenceY(){
 const v17=structuredClone(example('native-two-thick-lens-mirror-v17.json').physical);
 by(v17,'S1').y=10;
 by(v17,'D1').x=50;by(v17,'D1').length=240;
 const d=prepareScene(v17).document;
 const request=[{id:'nativePositions',kind:'detector-hit-events',componentId:'D1'}];
 const res=evaluateDocument(d,core,request);
 assert.equal(res.summary.native.status,'completed');
 const r=(await evaluateObservables(d,request,res.summary)).results[0];
 assert.ok(r.status==='available'||r.status==='qualified');
 const actual=r.value.find(h=>h.incomingUnit.x>0);
 assert.ok(actual,'real native refracted sample required, not calculated ray route');
 assert.ok(Math.abs(actual.pointMm.y-10)>.2);
 return actual.pointMm.y;
}

test('v18 near-endpoint after-refraction samples fail closed without changing pinned native propagation',async()=>{
 const y=await refractedReferenceY();
 // A mock core override is for a CONTRAST test only: production never gets
 // this bypass. It independently shows the ONLY delta is evidence qualification,
 // not the native mirror/lens/aperture/detector result.
 const unsafeTestOracle={...core,observeNativeV18ApertureCorner:()=>null};
 const requests=example('native-thick-lens-aperture-v18.json').requests;
 const variants=[];
 for(const delta of [-.03,-.005,0,.005,.03]){
  const p=structuredClone(example('native-thick-lens-aperture-v18.json').physical);
  by(p,'S1').y=10;
  by(p,'A1').x=50;
  by(p,'A1').y=y-10+delta;
  const doc=prepareScene(p).document;
  assert.equal(doc.schemaVersion,18);
  const checked=evaluateDocument(doc,core,requests);
  const bypass=evaluateDocument(doc,unsafeTestOracle,requests);
  assert.equal(bypass.summary.native.status,'completed');
  const A=checked.report.native.diagnostics,B=bypass.report.native.diagnostics;
  // The method wraps exactly one native call. Its scalar inspection must
  // neither affect native emitted rays nor absorption, mirror, lens or depth.
  for(const key of ['processed','emitted','truncation','undefinedBehavior'])
   assert.equal(A[key],B[key],'native result must be observer-invariant: '+key);
  assert.deepEqual(A.interfacesById,B.interfacesById);
  assert.deepEqual(A.blockersById,B.blockersById);
  assert.deepEqual(A.detectorsById,B.detectorsById);
  assert.deepEqual(A.reflectionsById,B.reflectionsById);
  const guard=A.apertureCornerGuard;
  assert.equal(guard.method,V18_CORNER_GUARD_METHOD);
  assert.equal(guard.nativeRayModified,false);
  assert.equal(guard.tracedOrInferredImpact,false);
  if(Math.abs(delta)<=.005){
   assert.equal(guard.status,'withheld-uncertain','v18 near secondary aperture joint must be fail closed');
   assert.ok(guard.nearApertureEndpointRayStates>0);
   assert.equal(guard.auditFaults,0,'do not mistake a real boundary observation for an auditor failure');
   assert.equal(checked.summary.native.status,'failed');
   assert.equal(checked.summary.executionPassed,false);
   assert.equal(checked.summary.observations,null,'no qualified native readings after uncertain endpoint');
   const measured=(await evaluateObservables(doc,requests,checked.summary)).results;
   assert.ok(measured.every(r=>r.status==='suppressed'&&r.value===null));
  }else{
   assert.equal(guard.status,'no-proximity-observed');
   assert.equal(checked.summary.native.status,'completed');
   assert.equal(checked.summary.executionPassed,true);
  }
  variants.push({deltaMm:delta,qualifiedStatus:checked.summary.native.status,
    actualNativeStopAbsorptions:A.blockersById.A1.absorptions,
    actualNativeMirrorReflections:A.reflectionsById.M1,
    guardStatus:guard.status,guardDistanceMm:guard.guardDistanceMm});
 }
 console.log('NATIVE_V18_CORNER_FAIL_CLOSED '+JSON.stringify({method:V18_CORNER_GUARD_METHOD,
   status:'strict-observer-no-ray-repair',variants,independentNativeExecution:false}));
});

test('scope isolation: only schema v18 attaches the corner withholding observer',()=>{
 for(const name of [
  'two-separated-glass.json','native-thick-lens-train.json',
  'native-thick-lens-mirror-v16.json','native-two-thick-lens-mirror-v17.json',
  'jee-parallel-lens-v19.json','jee-parallel-two-lens-v20.json',
  'jee-semicircular-beam-v21.json'
 ]){
  const d=prepareScene(example(name).physical).document;
  const loaded=core.loadDocument(d);
  assert.equal(core.observeNativeV18ApertureCorner(d,loaded.scene,loaded.idMap),null,
   'must not widen other native/saved versions: '+name);
 }
});

test('test-injected native callback delegates once, preserves ray and detects potential geometry, not an actual hit',()=>{
 const p=structuredClone(example('native-thick-lens-aperture-v18.json').physical);
 by(p,'A1').x=50;
 const d=prepareScene(p).document,loaded=core.loadDocument(d);
 const lens=loaded.scene.objs[loaded.idMap.get('L1')],
  aperture=loaded.scene.objs[loaded.idMap.get('A1')];
 let called=0;
 lens.onRayIncident=function(){called++;return {newRays:[]};};
 const guard=core.observeNativeV18ApertureCorner(d,loaded.scene,loaded.idMap);
 const endpoint=aperture.p3;
 const ray={p1:{x:endpoint.x-50,y:endpoint.y},p2:{x:endpoint.x,y:endpoint.y},
  brightness_s:.04,brightness_p:.04};
 const saved=structuredClone(ray);
 const answer=lens.onRayIncident(ray,0,{x:0,y:0},[]);
 assert.equal(called,1);
 assert.deepEqual(answer,{newRays:[]});
 assert.deepEqual(ray,saved,'audit must not mutate native ray object');
 assert.equal(guard.observation.status,'withheld-uncertain');
 assert.ok(guard.errors.length);
 assert.equal(core.classifyRun('simulationComplete',{
  errors:guard.errors,warnings:[],truncation:0,undefinedBehavior:0
 }), 'failed','actual native completion does not override unqualified numerical corner');
 // This mock is NOT a native propagated hit and cannot certify any physical
 // path; the genuine cases above are distinct and traced by pinned PhyDemo.
});
