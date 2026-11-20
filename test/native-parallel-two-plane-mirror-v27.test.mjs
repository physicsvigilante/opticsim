// v27 public scene authoring -> real pinned native Beam + two PlaneGlass +
// real finite separated Mirror -> qualified sampled measurements. No custom
// ray steering, no source attribution and no direct slab-mirror contact.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {beamTwoPlaneMirrorSafetyWitness,
 BEAM_TWO_PLANE_MIRROR_VERSION,BEAM_TWO_PLANE_MIRROR_MODEL}
 from '../src/native-beam-two-plane-mirror-v27.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-parallel-two-plane-mirror-v27.json',import.meta.url),'utf8'));
const request=()=>structuredClone(fixture.physical);
const part=(request,id)=>request.components.find(c=>c.id===id).parameters;
const near=(a,b,epsilon=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=epsilon,
 String(a)+' not near '+String(b)+' at '+String(epsilon));
async function perform(p,requests=fixture.requests){
 const doc=prepareScene(p).document;
 const native=evaluateDocument(doc,core,requests);
 const result=(await evaluateObservables(doc,requests,native.summary)).results;
 return {doc,native,byId:Object.fromEntries(result.map(r=>[r.id,r])),results:result};
}
test('v27 explicitly selects one Beam/two glass planes/separated Mirror, while preserving old v19 and v26',()=>{
 const input=request(),before=structuredClone(input);
 const doc=prepareScene(input).document;
 assert.deepEqual(input,before);
 assert.equal(doc.schemaVersion,BEAM_TWO_PLANE_MIRROR_VERSION);
 assert.equal(doc.adapterVersion,BEAM_TWO_PLANE_MIRROR_VERSION);
 assert.equal(doc.physics.model,BEAM_TWO_PLANE_MIRROR_MODEL);
 assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),
  ['Beam','PlaneGlass','PlaneGlass','Mirror','Detector']);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 assert.equal(validate(doc),doc);
 assert.equal(capabilities().nativeBeamTwoPlaneMirror.schemaVersion,27);
 assert.equal(capabilities().nativeBeamTwoPlaneMirror.minimumMirrorGapMm,1);
 const old=request();old.components=old.components.filter(c=>c.id!=='M1');
 const v19=prepareScene(old).document;
 assert.equal(v19.schemaVersion,19);
 assert.equal(v19.physics.model,'native-parallel-planar-tracing');
 const forged=structuredClone(v19);
 forged.physics.components.push(input.components.find(c=>c.id==='M1'));
 assert.throws(()=>validate(forged));
 const previous=JSON.parse(readFileSync(new URL('../examples/native-parallel-planar-mirror-v26.json',import.meta.url),'utf8'));
 assert.equal(prepareScene(previous.physical).document.schemaVersion,26);
});
test('public v27 true pinned Beam completes refraction at both surfaces and finite Mirror return',async()=>{
 const {doc,native,byId,results}=await perform(request());
 assert.equal(native.summary.executionPassed,true);
 assert.equal(native.summary.native.status,'completed');
 assert.equal(native.summary.native.truncation,0);
 assert.equal(native.summary.native.undefinedBehavior,0);
 assert.ok(results.every(x=>x.status==='qualified'),JSON.stringify(results.map(x=>({id:x.id,status:x.status,reason:x.reason}))));
 assert.equal(byId.emissions.value,8);
 assert.equal(byId.front.value,16);
 assert.equal(byId.rear.value,16);
 assert.equal(byId.mirror.value,8);
 assert.equal(byId['detector-count'].value,16);
 assert.equal(byId.positions.value.length,16);
 assert.equal(byId.positions.method,'native-hit-event-observation');
 assert.ok(byId.positions.warnings.some(w=>w.includes('transmitted-only')));
 const first=byId['first-entry'].value;
 assert.equal(first.from,'negative');assert.equal(first.incidentIndex,1);
 assert.equal(first.destinationIndex,1.5);
 near(first.incidentAngleDeg,30);
 near(first.transmittedAngleDeg,Math.asin(Math.sin(Math.PI/6)/1.5)*180/Math.PI);
 assert.equal(doc.physics.components.length,5);
});
test('paired detector positions obey a separate necessary Snell/geometric displacement, not image reconstruction',async()=>{
 const {byId}=await perform(request());
 const hits=byId.positions.value;
 const arriving=hits.filter(h=>h.incomingUnit.x>0).map(h=>h.pointMm.y).sort((a,b)=>a-b);
 const returned=hits.filter(h=>h.incomingUnit.x<0).map(h=>h.pointMm.y).sort((a,b)=>a-b);
 assert.equal(arriving.length,8);
 assert.equal(returned.length,8);
 const angle=Math.PI/6,inner=Math.asin(Math.sin(angle)/1.5);
 const target=2*60*Math.tan(inner)+(2*30+2*10)*Math.tan(angle);
 for(let i=0;i<arriving.length;i++)near(returned[i]-arriving[i],target,1e-7);
 assert.ok(target>80&&target<90);
 // This pairing by ordered y-coordinates is a mathematical cross-check,
 // NOT an inferred native source-to-detector ancestry or image measurement.
 assert.ok(hits.every(h=>Math.abs(h.pointMm.x+10)<1e-8));
});
test('public native v27 remains composable under explicit source width, density, indices and rigid translation',async()=>{
 for(const c of [
  {id:'width20',width:20,expected:4},
  {id:'denser',density:.4,expected:16},
  {id:'normal',angle:0,expected:8},
  {id:'index1point8',index:1.8,expected:8},
  {id:'translated',dx:150,dy:-60,expected:8},
  {id:'density1',density:1,expected:40}
 ]){
  const p=request();
  if(c.width)part(p,'B1').width=c.width;
  if(c.angle!==undefined)part(p,'B1').directionDeg=c.angle;
  if(c.index){
   part(p,'I1').positiveIndex=c.index;
   part(p,'I2').negativeIndex=c.index;
  }
  if(c.dx)for(const x of p.components){x.parameters.x+=c.dx;x.parameters.y+=c.dy;}
  const d=prepareScene(p).document;
  if(c.density)d.simulation.rayDensity=c.density;
  const native=evaluateDocument(d,core,fixture.requests);
  const obs=(await evaluateObservables(d,fixture.requests,native.summary)).results;
  const v=Object.fromEntries(obs.map(x=>[x.id,x]));
  assert.equal(native.summary.native.status,'completed',c.id);
  assert.equal(native.summary.native.truncation,0,c.id);
  assert.equal(v.emissions.value,c.expected,c.id);
  assert.equal(v.front.value,2*c.expected,c.id);
  assert.equal(v.rear.value,2*c.expected,c.id);
  assert.equal(v.mirror.value,c.expected,c.id);
  assert.equal(v['detector-count'].value,2*c.expected,c.id);
  if(c.expected*2<=32)assert.equal(v.positions.value.length,2*c.expected,c.id);
  else{
   assert.equal(v.positions.status,'unavailable',c.id);
   assert.equal(v.positions.value,null);
  }
 }
});
test('public v27 refuses direct mirror contact, near-contact, missing materials and unsupported mixtures',()=>{
 const invalid=[
  p=>part(p,'M1').x=60,
  p=>part(p,'M1').x=60.005,
  p=>part(p,'M1').x=60.99,
  p=>part(p,'I2').x=0.5,
  p=>part(p,'I1').normalDeg=90,
  p=>part(p,'I2').normalDeg=90,
  p=>part(p,'I1').partialReflection=true,
  p=>part(p,'I2').partialReflection=true,
  p=>delete part(p,'I1').negativeIndex,
  p=>delete part(p,'I2').positiveIndex,
  p=>part(p,'I2').negativeIndex=1.4,
  p=>part(p,'I2').positiveIndex=1.1,
  p=>part(p,'I1').positiveIndex=.9,
  p=>part(p,'B1').x=0,
  p=>part(p,'B1').width=120,
  p=>part(p,'B1').directionDeg=-30,
  p=>part(p,'B1').directionDeg=75,
  p=>part(p,'B1').brightness=1,
  p=>part(p,'M1').orientationDeg=45,
  p=>part(p,'M1').length=75,
  p=>part(p,'D1').x=0,
  p=>part(p,'D1').x=60,
  p=>part(p,'D1').orientationDeg=0,
  p=>p.components.push({...structuredClone(p.components.find(x=>x.id==='M1')),id:'M2'}),
  p=>p.components.push({...structuredClone(p.components.find(x=>x.id==='I2')),id:'I3',parameters:{...part(p,'I2'),x:80}}),
  p=>p.components.push({id:'S2',type:'point-source',parameters:{x:-100,y:0,brightness:.1},emission:{mode:'single-ray',directionDeg:0}})
 ];
 for(const edit of invalid){const p=request();edit(p);assert.throws(()=>prepareScene(p),undefined,JSON.stringify(p));}
});
test('v27 native-exact sample emission B1 guard, mirror endpoint clearance and detector rim checks remain effective',()=>{
 const p=request();
 part(p,'B1').width=50;part(p,'B1').directionDeg=1;
 const doc=prepareScene(p).document;doc.simulation.rayDensity=.29;
 assert.throws(()=>validate(doc),/half-integer/);
 const rim=request();
 const witness=beamTwoPlaneMirrorSafetyWitness(rim.components,.2);
 const upper=Math.max(...witness.samples.map(x=>x.mirrorY));
 const mirror=part(rim,'M1');
 mirror.length=120;mirror.y=upper+60-.05;
 assert.throws(()=>prepareScene(rim),/0.1 mm/);
 const det=request(),ref=beamTwoPlaneMirrorSafetyWitness(det.components,.2);
 const y=ref.samples[0].detectorY[0].inbound;
 part(det,'D1').y=y+part(det,'D1').length/2;
 assert.throws(()=>prepareScene(det),/endpoint/);
});
test('native depth truncation and processed-ray stop withhold ALL v27 observations, not a partial return',async()=>{
 for(const [key,value] of [['maxRayDepth',0],['processedRayLimit',1]]){
  const doc=prepareScene(request()).document;doc.simulation[key]=value;
  const r=evaluateDocument(doc,core,fixture.requests);
  assert.notEqual(r.summary.native.status,'completed');
  const observations=(await evaluateObservables(doc,fixture.requests,r.summary)).results;
  assert.ok(observations.every(x=>x.status==='suppressed'&&x.value===null));
  assert.equal(r.summary.observations,null);
 }
});
