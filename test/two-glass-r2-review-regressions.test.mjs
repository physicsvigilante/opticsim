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
 const summary=evaluate(doc,requests);
 assert.equal(summary.accepted,true);
 assert.ok(['completed','completed-with-warnings','incomplete'].includes(summary.native.status),
  'Record unexpected native status instead of assuming a complete Fresnel tree');
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
});
