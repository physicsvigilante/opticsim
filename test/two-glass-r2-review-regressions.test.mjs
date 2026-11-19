// Additional native evidence requested in independent PR #107 R2 review.
// These tests do not change physics, routing, brightness or qualification rules.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/two-separated-glass.json',import.meta.url),'utf8'));
const physical=()=>structuredClone(fixture.physical);
const body=(r,id)=>r.components.find(c=>c.id===id);
const prepare=r=>prepareScene(r).document;
const evaluate=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests).summary;
const near=(actual,expected,eps=1e-6)=>assert.ok(
 Number.isFinite(actual)&&Math.abs(actual-expected)<eps,
 `Native value ${actual} differs from independent reference ${expected}`
);

test('R2 F2: native G2-origin TIR is followed by a distinct top-face transmission',async()=>{
 const r=physical();
 Object.assign(body(r,'S1').parameters,{x:340,y:-50});
 body(r,'S1').emission.directionDeg=60;
 const doc=prepare(r);
 const evidence=inspectNative(doc); // Real pinned native callbacks, not an authored itinerary.
 const glass=evidence.trace.filter(e=>e.type==='polygon-dielectric');
 const g2=evidence.diagnostic.interfacesById.G2;
 assert.equal(g2.first.outcome,'total-internal-reflection');
 assert.equal(g2.first.from,'inside');
 near(g2.first.incidentIndex,1.3);near(g2.first.destinationIndex,1);
 const faces=Object.values(g2.faces);
 const top=faces.find(f=>f.first&&Math.abs(f.first.pointMm.y-100)<1e-5);
 assert.ok(top,'Native G2 top-face callback was recorded');
 assert.equal(top.first.outcome,'transmission');
 near(top.first.transmittedAngleDeg,40.541601874,1e-5);
 assert.equal(evidence.diagnostic.interfacesById.G2.totalInternalReflections,1);
 assert.equal(evidence.diagnostic.interfacesById.G2.interactions,2);
 assert.equal(evidence.diagnostic.interfacesById.G1.interactions,0);
 assert.deepEqual(glass.map(e=>e.id),['G2','G2']);
 near(glass[0].point.x,350);near(glass[0].point.y,-32.679491924);
 near(glass[1].point.x,273.397459622);near(glass[1].point.y,100);
 assert.equal(glass[0].outgoing.length,1,'TIR has one reflected outgoing ray');
 assert.equal(glass[1].outgoing.length,1,'Fresnel-off exit has one transmitted outgoing ray');
 assert.ok(glass[0].outgoing[0].x<0&&glass[0].outgoing[0].y>0);
 assert.ok(glass[1].outgoing[0].x<0&&glass[1].outgoing[0].y>0);
 const requests=[
  {id:'tir',kind:'interface-tir-count',componentId:'G2'},
  {id:'g2',kind:'interface-interactions',componentId:'G2'},
  {id:'g1',kind:'interface-interactions',componentId:'G1'}
 ];
 const summary=evaluate(doc,requests);
 assert.equal(summary.native.status,'completed');
 const qualified=await evaluateObservables(doc,requests,summary);
 assert.deepEqual(qualified.results.map(x=>x.value),[1,2,0]);
 assert.ok(qualified.results.every(x=>x.status==='qualified'));
 console.log('R2_F2_NATIVE_EVIDENCE '+JSON.stringify({
  model:doc.physics.model, status:summary.native.status,
  g2First:{outcome:g2.first.outcome,pointMm:g2.first.pointMm,
   incidentIndex:g2.first.incidentIndex,destinationIndex:g2.first.destinationIndex},
  g2Top:{outcome:top.first.outcome,pointMm:top.first.pointMm,
   transmittedAngleDeg:top.first.transmittedAngleDeg},
  g1Interactions:evidence.diagnostic.interfacesById.G1.interactions,
  requestedStatuses:qualified.results.map(x=>x.status)
 }));
});

test('R2 F1: two-body full-Fresnel mode retains native branching and refuses to certify incomplete runs',async()=>{
 const r=physical();
 for(const id of ['G1','G2'])body(r,id).parameters.partialReflection=true;
 const doc=prepare(r);
 const requests=[
  {id:'g1',kind:'interface-interactions',componentId:'G1'},
  {id:'g2',kind:'interface-interactions',componentId:'G2'},
  {id:'d1',kind:'detector-crossings',componentId:'D1'}
 ];
 const run=evaluateDocument(doc,core,requests),summary=run.summary;
 // Raw native diagnostic is test evidence even when public observations are
 // properly withheld. Never mistake it for a qualified user measurement.
 const raw=run.report.native.diagnostics;
 assert.equal(summary.accepted,true);
 const firstG1=raw.interfacesById.G1.first,firstG2=raw.interfacesById.G2.first;
 assert.ok(firstG1&&firstG2,'Both bodies have actual native incident callbacks');
 assert.equal(firstG1.partialReflection,true);
 assert.equal(firstG2.partialReflection,true);
 assert.equal(firstG1.incidentIndex,1);
 assert.equal(firstG1.destinationIndex,1.5);
 assert.equal(firstG2.incidentIndex,1);
 assert.equal(firstG2.destinationIndex,1.3);
 // Independent unpolarized Fresnel reference, NOT used for native ray tracing.
 const theta=firstG1.incidentAngleDeg*Math.PI/180;
 const trans=Math.asin(Math.sin(theta)/1.5);
 const rs=((Math.cos(theta)-1.5*Math.cos(trans))/
   (Math.cos(theta)+1.5*Math.cos(trans)))**2;
 const rp=((1.5*Math.cos(theta)-Math.cos(trans))/
   (1.5*Math.cos(theta)+Math.cos(trans)))**2;
 const referenceR=(rs+rp)/2;
 const reflected=firstG1.branches.find(x=>x.kind==='reflected');
 const transmitted=firstG1.branches.find(x=>x.kind==='transmitted');
 assert.ok(reflected&&transmitted,
  'The first sufficiently bright G1 incident ray must yield real native Fresnel branches');
 near(reflected.relativePower/firstG1.incidentRelativePower,referenceR,1e-6);
 near(transmitted.relativePower/firstG1.incidentRelativePower,1-referenceR,1e-6);
 near(reflected.angleDeg,firstG1.incidentAngleDeg,1e-6);
 // G2 may omit weak branches under the unchanged native cutoff. A missing
 // reflected ray is never interpreted as zero physical reflectance.
 assert.ok(firstG2.branches.some(x=>x.kind==='transmitted'));
 assert.equal(firstG2.branches.some(x=>x.kind==='reflected'),false,
  'Weak G2 Fresnel reflection was omitted by the pinned native threshold');
 assert.ok(firstG2.nativeTruncation>0,
  'The omitted branch must be recorded as native truncation, not physical zero');
 near(firstG2.branches.reduce((n,b)=>n+b.relativePower,0)+firstG2.nativeTruncation,
  firstG2.incidentRelativePower,1e-8);
 assert.ok(summary.native.truncation>=firstG2.nativeTruncation);
 assert.equal(summary.native.status,'incomplete',
  'Pinned weak Fresnel cutoff must prevent a qualified complete result');
 if(['completed','completed-with-warnings'].includes(summary.native.status)){
  const g1=summary.observations.interfacesById.G1;
  const g2=summary.observations.interfacesById.G2;
  assert.ok(g1.interactions>=2&&g2.interactions>=2);
  assert.equal(g1.first.partialReflection,true);
  assert.equal(g2.first.partialReflection,true);
  // First entry angles must obey Snell; do not assert that weak branches survived.
  for(const [meter,n] of [[g1,1.5],[g2,1.3]]){
   const e=meter.first;
   near(Math.sin(e.incidentAngleDeg*Math.PI/180),
      n*Math.sin(e.transmittedAngleDeg*Math.PI/180),1e-8);
  }
 }else{
  assert.equal(summary.executionPassed,false);
 }
 const results=await evaluateObservables(doc,requests,summary);
 assert.ok(results.results.every(x=>summary.executionPassed?
  ['available','qualified'].includes(x.status):x.status==='suppressed'));
 // An intentionally inadequate ray depth must never yield a qualified power
 // or detector claim from a truncated Fresnel branching tree.
 const limited=structuredClone(doc);
 limited.simulation.maxRayDepth=2;
 const short=evaluate(limited,requests);
 assert.equal(short.native.status,'incomplete');
 assert.equal(short.executionPassed,false);
 const withheld=await evaluateObservables(limited,requests,short);
 assert.ok(withheld.results.every(x=>x.status==='suppressed'&&x.value===null));
 console.log('R2_F1_NATIVE_EVIDENCE '+JSON.stringify({
  model:doc.physics.model,status:summary.native.status,
  truncation:summary.native.truncation,undefinedBehavior:summary.native.undefinedBehavior,
  g1:{interactions:raw.interfacesById.G1.interactions,first:firstG1},
  g2:{interactions:raw.interfacesById.G2.interactions,first:firstG2},
  referenceFirstG1Reflectance:referenceR,
  requestedStatuses:results.results.map(x=>x.status),
  limited:{status:short.native.status,truncation:short.native.truncation,
   requestedStatuses:withheld.results.map(x=>x.status)}
 }));
});

test('R2 F3: diagonally disjoint glass is conservatively refused without a full face certificate',()=>{
 const r=physical();
 const assignSquare=(id,cx,cy)=>{
  const p=body(r,id).parameters;
  Object.assign(p,{x1:cx-10,y1:cy-10,x2:cx-10,y2:cy+10,
   x3:cx+10,y3:cy+10,x4:cx+10,y4:cy-10});
 };
 assignSquare('G1',0,0);
 assignSquare('G2',20.008,20.008);
 // Independent Euclidean corner distance is >0.01 mm, but each supporting
 // face projection is only 0.008 mm. This is an intentional safe refusal.
 assert.ok(Math.hypot(.008,.008)>.01);
 assert.throws(()=>prepare(r),/separation|disjoint|supporting|unsupported/i);
 assignSquare('G2',20.011,20.011);
 assert.equal(prepare(r).schemaVersion,14,'Full-face 0.011 mm clearance is admitted');
});
