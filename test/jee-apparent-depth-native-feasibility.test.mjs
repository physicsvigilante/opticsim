// TEST-ONLY, UNRELEASED JEE apparent-depth feasibility (native v5 components).
// Pinned PhyDemo alone propagates actual rays and emits detector crossings.
// Read-only derived reverse extensions are conditional mathematical geometry,
// NEVER traced physical rays, a native image, source provenance or PSF.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const template=JSON.parse(readFileSync(
  new URL('../evaluation/planar-refraction-v1/first-request.json',import.meta.url),'utf8')).request;
const requests=[
  {id:'event',kind:'interface-first-event',componentId:'I1'},
  {id:'hits',kind:'detector-hit-events',componentId:'D1'},
  {id:'crossings',kind:'detector-crossings',componentId:'D1'},
  {id:'emitted',kind:'source-emissions',componentId:'S1'}
];
const deg=Math.PI/180;
const close=(actual,expected,tolerance=1e-6)=>{
  assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&
    Math.abs(actual-expected)<=tolerance,
    'expected '+expected+', actual '+actual+' (allowed '+tolerance+')');
};
const byId=(p,id)=>p.components.find(c=>c.id===id);

function apparatus(incidenceDeg,{sourceIndex=1.5,observerIndex=1}={}){
  const p=structuredClone(template);
  p.title='Test-only: ray evidence for conditional apparent depth';
  p.lengthUnit='mm';
  const source=byId(p,'S1'),plane=byId(p,'I1');
  Object.assign(source.parameters,{x:-60,y:0,brightness:1});
  Object.assign(source.emission,{mode:'single-ray',directionDeg:incidenceDeg});
  Object.assign(plane.parameters,{
    x:0,y:0,normalDeg:0,negativeIndex:sourceIndex,
    positiveIndex:observerIndex,partialReflection:false
  });
  p.components.push({id:'D1',type:'ray-detector',parameters:{
    x:100,y:0,length:400,orientationDeg:90
  }});
  return p;
}
async function nativeTrial(p){
  const d=prepareScene(p).document;
  assert.equal(d.schemaVersion,5);
  assert.equal(d.physics.model,'planar-media-tracing');
  const native=evaluateDocument(d,core,requests).summary;
  const qualified=(await evaluateObservables(d,requests,native)).results;
  assert.equal(qualified.length,requests.length);
  return {d,native,by:Object.fromEntries(qualified.map(x=>[x.id,x]))};
}
function conditionalAxisIntercept(hit){
  // This is the intersection of the *backward extension* of one measured
  // forward ray with the authored source axis y=0. It is not a native hit
  // and no physical backward ray is inserted into the scene.
  if(!hit||!Number.isFinite(hit.incomingUnit?.x)||
     !Number.isFinite(hit.incomingUnit?.y)||
     Math.abs(hit.incomingUnit.y)<=1e-10)return null;
  return hit.pointMm.x-hit.pointMm.y*hit.incomingUnit.x/hit.incomingUnit.y;
}
function checkTransmitted(r,angle,sourceIndex=1.5,observerIndex=1){
  assert.equal(r.native.native.status,'completed');
  assert.equal(r.native.executionPassed,true);
  assert.equal(r.by.emitted.value,1);
  assert.equal(r.by.crossings.value,1);
  assert.equal(r.by.hits.value.length,1);
  assert.ok(['qualified','available'].includes(r.by.hits.status));
  const event=r.by.event.value;
  assert.equal(event.outcome,'transmission');
  close(event.incidentAngleDeg,Math.abs(angle),1e-7);
  assert.equal(event.incidentIndex,sourceIndex);
  assert.equal(event.destinationIndex,observerIndex);
  const transmitted=event.branches.filter(x=>x.kind==='transmitted');
  assert.equal(transmitted.length,1);
  const hit=r.by.hits.value[0];
  close(hit.pointMm.x,100,1e-7);
  close(hit.incomingUnit.x,transmitted[0].direction.x,1e-8);
  close(hit.incomingUnit.y,transmitted[0].direction.y,1e-8);
  const alpha=Math.asin(sourceIndex/observerIndex*Math.sin(Math.abs(angle)*deg));
  close(transmitted[0].angleDeg,alpha/deg,1e-6);
  const xVirtual=conditionalAxisIntercept(hit);
  assert.ok(xVirtual!==null&&xVirtual<0);
  const expected=-60*Math.tan(Math.abs(angle)*deg)/Math.tan(alpha);
  close(xVirtual,expected,1e-5);
  return {angleDeg:angle,virtualAxisDepthMm:-xVirtual,
    idealFiniteAngleDepthMm:-expected,paraxialLimitMm:60*observerIndex/sourceIndex,
    nativeHitYmm:hit.pointMm.y};
}

test('research: actual native refraction + detector positions give angle-dependent virtual axis intercepts, NOT one real image',async()=>{
  const samples=[];
  for(const angle of [2,5,12,25,30]){
    const r=await nativeTrial(apparatus(angle));
    samples.push(checkTransmitted(r,angle));
  }
  // The textbook ratio d_obs ~= d*n_observer/n_source holds only in the
  // paraxial limit; finite-angle backward extensions need not coincide.
  close(samples[0].virtualAxisDepthMm,40,0.05);
  for(let i=1;i<samples.length;i++)
    assert.ok(samples[i].virtualAxisDepthMm<samples[i-1].virtualAxisDepthMm);
  assert.ok(samples.at(-1).virtualAxisDepthMm<samples[0].virtualAxisDepthMm-5);
  console.log('JEE_APPARENT_DEPTH_NATIVE_FINITE_ANGLE '+JSON.stringify({
    native:'completed',sourceIndex:1.5,observerIndex:1,
    realDepthMm:60,nativeImageDetected:false,conditionalAxisIntercepts:samples
  }));
});

test('research: symmetric incoming directions give symmetric native detector hits but matching virtual depth',async()=>{
  const a=await nativeTrial(apparatus(5)),b=await nativeTrial(apparatus(-5));
  const plus=checkTransmitted(a,5),minus=checkTransmitted(b,-5);
  close(plus.virtualAxisDepthMm,minus.virtualAxisDepthMm,1e-6);
  close(plus.nativeHitYmm,-minus.nativeHitYmm,1e-6);
});

test('research: medium ratios 1:1 and 1:1.5 change conditional virtual depth without any fabricated ray',async()=>{
  const equal=checkTransmitted(await nativeTrial(apparatus(5,{
    sourceIndex:1,observerIndex:1
  })),5,1,1);
  close(equal.virtualAxisDepthMm,60,1e-6);
  const deeper=checkTransmitted(await nativeTrial(apparatus(5,{
    sourceIndex:1,observerIndex:1.5
  })),5,1,1.5);
  assert.ok(deeper.virtualAxisDepthMm>60);
  console.log('JEE_APPARENT_DEPTH_NATIVE_INDEX_CONTROL '+JSON.stringify({
    equalIndicesDepthMm:equal.virtualAxisDepthMm,
    observerDenserDepthMm:deeper.virtualAxisDepthMm,
    nativeImageDetected:false
  }));
});

test('research: native TIR has no transmitted detector hit or apparent-depth reconstruction',async()=>{
  const r=await nativeTrial(apparatus(50));
  assert.equal(r.native.native.status,'completed');
  assert.equal(r.native.executionPassed,true);
  assert.equal(r.by.emitted.value,1);
  assert.equal(r.by.event.value.outcome,'total-internal-reflection');
  assert.equal(r.by.event.value.branches.some(x=>x.kind==='transmitted'),false);
  assert.equal(r.by.crossings.value,0);
  assert.deepEqual(r.by.hits.value,[]);
  assert.equal(conditionalAxisIntercept(r.by.hits.value[0]),null);
});

test('research: normal incidence gives one real native hit but no unique finite-angle virtual intercept',async()=>{
  const r=await nativeTrial(apparatus(0));
  assert.equal(r.native.native.status,'completed');
  assert.equal(r.by.crossings.value,1);
  assert.equal(conditionalAxisIntercept(r.by.hits.value[0]),null);
});

test('research: incomplete native execution suppresses interface and detector measurements',async()=>{
  const d=prepareScene(apparatus(5)).document;
  d.simulation.maxRayDepth=0;
  const out=evaluateDocument(d,core,requests).summary;
  const qualified=(await evaluateObservables(d,requests,out)).results;
  assert.equal(out.native.status,'incomplete');
  assert.equal(out.executionPassed,false);
  assert.equal(out.observations,null);
  assert.ok(qualified.every(x=>x.status==='suppressed'&&x.value===null));
  console.log('JEE_APPARENT_DEPTH_NATIVE_INCOMPLETE '+JSON.stringify({
    status:out.native.status,allMeasurementsSuppressed:true
  }));
});
