// TEST-ONLY cross-branch native measurement integration. No solver or image reconstruction.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-aperture-v18.json',import.meta.url)));
const requested=[
 {id:'foot',kind:'detector-directional-footprint',componentId:'D1'},
 {id:'hits',kind:'detector-hit-events',componentId:'D1'},
 {id:'count',kind:'detector-crossings',componentId:'D1'},
 {id:'stop',kind:'blocker-absorptions',componentId:'A1'}
];
const doc=(change=()=>{})=>{const r=structuredClone(fixture.physical);change(r);return prepareScene(r).document;};
const measure=async(d,requests=requested)=>{
 const run=evaluateDocument(d,core,requests).summary;
 return {run,results:(await evaluateObservables(d,requests,run)).results};
};
test('two actual v18 return crossings have one native sample per detector-normal direction',async()=>{
 const d=doc(),{run,results:r}=await measure(d);
 assert.equal(d.schemaVersion,18);
 assert.equal(run.native.status,'completed');assert.equal(run.executionPassed,true);
 assert.deepEqual(r.map(v=>v.status),Array(4).fill('qualified'));
 assert.equal(r[2].value,2);assert.equal(r[3].value,0);assert.equal(r[1].value.length,2);
 const v=r[0].value;
 assert.equal(v.observedCount,2);
 assert.equal(v.towardPositiveNormal.count,1);
 assert.equal(v.towardNegativeNormal.count,1);
 assert.equal(v.towardPositiveNormal.rmsSpreadMm,0);
 assert.equal(v.towardNegativeNormal.rmsSpreadMm,0);
 assert.match(r[0].limitation,/No physical image/i);
 console.log('INTEGRATION_V18_FOOTPRINT_RETURN '+JSON.stringify({status:run.native.status,footprint:v,absorbed:0}));
});
test('genuine native aperture miss makes both directional spread statistics null',async()=>{
 const d=doc(x=>x.components.find(c=>c.id==='A1').parameters.y=30);
 const {run,results:r}=await measure(d);
 assert.equal(run.native.status,'completed');assert.equal(run.executionPassed,true);
 assert.equal(r[2].value,0);assert.equal(r[3].value,1);assert.deepEqual(r[1].value,[]);
 assert.equal(r[0].value.observedCount,0);
 for(const side of ['towardPositiveNormal','towardNegativeNormal']){
  const g=r[0].value[side];assert.equal(g.count,0);
  assert.equal(g.meanPointMm,null);assert.equal(g.rmsSpreadMm,null);
 }
 console.log('INTEGRATION_V18_FOOTPRINT_BLOCKED '+JSON.stringify({status:run.native.status,footprint:r[0].value,absorbed:1}));
});
test('v18 footprint-only request captures native hits without returning an event-list result',async()=>{
 const d=doc(),only=[{id:'foot',kind:'detector-directional-footprint',componentId:'D1'}];
 const {run,results:r}=await measure(d,only);
 assert.equal(run.native.status,'completed');
 assert.deepEqual(r.map(x=>x.kind),['detector-directional-footprint']);
 assert.equal(r[0].status,'qualified');
 assert.equal(r[0].value.observedCount,2);
 assert.ok(run.observations.detectorHitEventsById.D1);
});
test('depth-8 truncated v18 return suppresses footprint and original measurements',async()=>{
 const d=doc();d.simulation.maxRayDepth=8;
 const {run,results:r}=await measure(d);
 assert.equal(run.native.status,'incomplete');assert.equal(run.executionPassed,false);
 assert.equal(run.observations,null);
 assert.ok(r.every(x=>x.status==='suppressed'&&x.value===null));
});
