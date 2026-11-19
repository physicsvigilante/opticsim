// Public v24 authoring/observability acceptance. Pinned PhyDemo alone traces.
// No research-only raw scene is silently converted or historical schema widened.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseScene,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {predict} from '../src/analysis.js';
import {compositionModels,compositionCapabilities} from '../src/composition-profiles.js';
import {CURVED_ENTRY_VERSION,CURVED_ENTRY_MODEL,curvedEntryCapabilities}
 from '../src/native-curved-entry-observation.js';
import {semicircularEncounter} from '../src/semicircular-dielectric.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync(new URL('../examples/jee-curved-entry-v24.json',import.meta.url),'utf8'));
const original=()=>structuredClone(example.physical);
const prepare=req=>prepareScene(req).document;
const params=(p,id)=>p.components.find(c=>c.id===id).parameters;
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t, a+' != '+b);
async function run(p=original()){
 const doc=prepare(p),execution=evaluateDocument(doc,core,example.requests);
 const result=await evaluateObservables(doc,example.requests,execution.summary);
 return {doc,execution,rows:result.results,by:Object.fromEntries(result.results.map(x=>[x.id,x]))};
}

test('public v24 compiles EXACT existing native curved Glass and real internal detectors/absorber',async()=>{
 const p=original(),before=JSON.stringify(p),d=prepare(p),caps=capabilities();
 assert.equal(JSON.stringify(p),before,'authoring never mutates caller request');
 assert.equal(d.schemaVersion,CURVED_ENTRY_VERSION);
 assert.equal(d.adapterVersion,24);
 assert.equal(d.physics.model,CURVED_ENTRY_MODEL);
 assert.equal(caps.nativeCurvedEntryObservation.schemaVersion,24);
 assert.equal(caps.nativeCurvedEntryObservation.model,CURVED_ENTRY_MODEL);
 assert.deepEqual(compositionModels(24),[CURVED_ENTRY_MODEL]);
 assert.equal(compositionCapabilities().profiles.filter(x=>x.schemaVersion<=23).length,24);
 assert.equal(curvedEntryCapabilities().radiusMm[0],50);
 const native=core.compile(d).native;
 assert.deepEqual(native.objs.map(x=>x.type),['SingleRay','Glass','Detector','Detector','Blocker']);
 assert.deepEqual(native.objs[1].path,[
  {x:0,y:-100,arc:false},{x:100,y:-0,arc:true},{x:0,y:100,arc:false}
 ]);
 assert.equal(native.objs[1].refIndex,4/3);
 assert.equal(native.objs[1].partialReflect,false);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(predict(d).kind,'unavailable');
 assert.equal(caps.nativeSemicircularBeam.schemaVersion,21,'v21 Beam remains isolated');
 assert.equal(caps.nativeCircleBeam.schemaVersion,23,'v23 CircleGlass remains isolated');
});

test('real native curved entrance, two internal hits and actual absorption qualify, without detecting an image',async()=>{
 const {doc,execution,rows,by}=await run();
 assert.equal(execution.summary.native.status,'completed');
 assert.equal(execution.summary.native.truncation,0);
 assert.equal(execution.summary.native.undefinedBehavior,0);
 assert.deepEqual(execution.summary.native.errors,[]);
 assert.deepEqual(rows.map(x=>x.status),Array(example.requests.length).fill('qualified'));
 assert.equal(by.emitted.value,1);
 assert.equal(by.interfaces.value,1,'one actual material encounter, NOT an assumed route');
 assert.equal(by.faces.value['face-arc'].interactions,1);
 assert.equal(by.faces.value['face-flat'].interactions,0,'second real Glass boundary is physically retained, not hit');
 assert.equal(by.first.value.faceId,'face-arc');
 assert.equal(by.first.value.from,'outside');
 assert.equal(by.first.value.outcome,'transmission');
 near(by.first.value.incidentIndex,1);
 near(by.first.value.destinationIndex,4/3);
 assert.ok(by.first.value.incidentAngleDeg>0,'Real small-angle off-axis incident ray');
 assert.ok(by.first.value.transmittedAngleDeg>0);
 assert.equal(by.tir.value,0);
 for(const id of ['near-count','far-count'])assert.equal(by[id].value,1);
 for(const id of ['near-hits','far-hits'])assert.equal(by[id].value.length,1);
 assert.equal(by.absorptions.value,1);
 const nearHit=by['near-hits'].value[0],farHit=by['far-hits'].value[0];
 near(nearHit.pointMm.x,80);near(farHit.pointMm.x,60);
 assert.ok(nearHit.incomingUnit.x<0&&farHit.incomingUnit.x<0);
 near(nearHit.incomingUnit.x,farHit.incomingUnit.x,1e-12);
 near(nearHit.incomingUnit.y,farHit.incomingUnit.y,1e-12);
 const ax=nearHit.pointMm.x-nearHit.pointMm.y*(farHit.pointMm.x-nearHit.pointMm.x)/
   (farHit.pointMm.y-nearHit.pointMm.y);
 near(ax,-300,.05);
 assert.notEqual(ax,-300,'Finite-height native refraction differs from Gaussian approximation');
 assert.equal(by.first.value.partialReflection,false);
 assert.equal(by.first.value.nativeImageDetected,undefined);
 assert.equal(execution.summary.observations.blockersById.A1.absorptions,1);
 const raw=execution.summary.observations.interfacesById.G1;
 assert.equal(raw.invalidObservations,0);
 assert.equal(raw.interactions,1);
 const surface=doc.physics.components.find(x=>x.id==='G1');
 const hit=by.first.value.pointMm,incoming=by.first.value.incidentDirection;
 const e=semicircularEncounter(surface,{x:hit.x,y:-hit.y},incoming);
 assert.equal(e.invalid,false);
 assert.equal(e.faceId,'face-arc');
 assert.equal(raw.faces['face-flat'].interactions,0);
 console.log('JEE_V24_CURVED_ENTRY_NATIVE '+JSON.stringify({completed:true,emitted:by.emitted.value,
  curvedBoundary:raw.faces['face-arc'].interactions,flatBoundary:raw.faces['face-flat'].interactions,
  nearDetector:by['near-count'].value,farDetector:by['far-count'].value,
  absorbed:by.absorptions.value,mathematicalInterceptMm:ax,nativeImageDetected:false,
  originalQuestionSolved:false}));
});

test('signed off-axis height, translation and explicitly rescaled apparatus retrace native Glass',async()=>{
 const baseline=await run();
 const negatives=original();params(negatives,'S1').y=-1;
 const opposite=await run(negatives);
 assert.deepEqual(opposite.rows.map(x=>x.status),baseline.rows.map(x=>x.status));
 near(opposite.by['near-hits'].value[0].pointMm.y,
  -baseline.by['near-hits'].value[0].pointMm.y,1e-9);
 const translated=original();
 for(const c of translated.components){
  c.parameters.x+=137;
  if('y' in c.parameters)c.parameters.y-=55;
 }
 const shifted=await run(translated);
 assert.equal(shifted.by.absorptions.value,1);
 near(shifted.by.first.value.pointMm.x,baseline.by.first.value.pointMm.x+137,1e-8);
 near(shifted.by.first.value.pointMm.y,baseline.by.first.value.pointMm.y-55,1e-8);
 const scaled=original();
 for(const c of scaled.components)for(const k of ['x','y','radius','length'])
  if(Object.hasOwn(c.parameters,k))c.parameters[k]*=1.2;
 const scaledRun=await run(scaled);
 assert.equal(scaledRun.execution.summary.native.status,'completed');
 assert.equal(scaledRun.by.absorptions.value,1);
 assert.equal(scaledRun.by.first.value.faceId,'face-arc');
});

test('strict v24 facts and full-boundary geometry refuse before native execution',()=>{
 const bad=[
  ['missing index',p=>delete params(p,'G1').outsideIndex],
  ['missing inside index',p=>delete params(p,'G1').insideIndex],
  ['missing Fresnel policy',p=>delete params(p,'G1').partialReflection],
  ['Fresnel full branching',p=>params(p,'G1').partialReflection=true],
  ['index equality',p=>params(p,'G1').insideIndex=1],
  ['index inversion',p=>params(p,'G1').insideIndex=.9],
  ['radius too small',p=>params(p,'G1').radius=49],
  ['source wrong side',p=>params(p,'S1').x=-200],
  ['source starts in material',p=>params(p,'S1').x=90],
  ['source near rim',p=>params(p,'S1').y=10],
  ['source wrong direction',p=>p.components.find(c=>c.id==='S1').emission.directionDeg=0],
  ['cone instead of single-ray',p=>p.components.find(c=>c.id==='S1').emission.mode='directional'],
  ['detector outside circle',p=>params(p,'D1').x=110],
  ['detector moved on flat boundary',p=>params(p,'D1').x=0],
  ['detector too long',p=>params(p,'D1').length=180],
  ['detector too short',p=>params(p,'D1').length=10],
  ['detector tilted',p=>params(p,'D1').orientationDeg=65],
  ['detector order collided',p=>params(p,'D2').x=80],
  ['screen after detectors',p=>params(p,'A1').x=90],
  ['screen missing',p=>p.components=p.components.filter(c=>c.id!=='A1')],
  ['detector missing',p=>p.components=p.components.filter(c=>c.id!=='D1')],
  ['secondary blocker',p=>p.components.push({...p.components.find(c=>c.id==='A1'),id:'A2'})],
  ['second glass',p=>p.components.push({...p.components.find(c=>c.id==='G1'),id:'G2'})],
  ['extra lens',p=>p.components.push({id:'L1',type:'ideal-lens',parameters:{x:140,focalLength:100,apertureHeight:60}})],
  ['Beam instead of SingleRay',p=>p.components[0]={id:'B1',type:'parallel-beam',parameters:{x:200,y:1,width:10,directionDeg:180,brightness:.08}}],
  ['full circle substitution',p=>p.components[1]={id:'G1',type:'circular-dielectric',parameters:{...params(p,'G1')}}],
 ];
 for(const [name,change] of bad){const p=original();change(p);
  assert.throws(()=>prepare(p),undefined,name);
 }
 const missing=original();delete params(missing,'G1').outsideIndex;
 assert.ok(inspectAuthoringRequest(missing).some(x=>x.path.endsWith('outsideIndex')));
});

test('legacy v21 and v23 cannot be relabelled to v24 or gain an internal screen',()=>{
 const old21=JSON.parse(readFileSync(new URL('../examples/jee-semicircular-beam-v21.json',import.meta.url),'utf8'));
 const old23=JSON.parse(readFileSync(new URL('../examples/jee-circle-beam-v23.json',import.meta.url),'utf8'));
 for(const e of [old21,old23]){
  const d=prepare(e.physical);
  assert.equal(d.schemaVersion,e===old21?21:23);
  assert.deepEqual(parseSave(serializeSave(d)),d);
  const forgery=structuredClone(d);
  forgery.schemaVersion=forgery.adapterVersion=24;
  forgery.physics.model=CURVED_ENTRY_MODEL;
  assert.throws(()=>validate(forgery));
 }
 const d=prepare(old21.physical);
 const withBlocker=structuredClone(d);
 withBlocker.physics.components.push(prepare(original()).physics.components.find(x=>x.id==='A1'));
 assert.throws(()=>validate(withBlocker),'existing v21 cannot silently expand to internal absorber');
});

test('stale revisions and stopped/depth-exhausted runs withhold ALL measurements',async()=>{
 const d=prepare(original()),run=evaluateDocument(d,core,example.requests);
 assert.equal(run.summary.native.status,'completed');
 const revised=structuredClone(d);
 revised.physics.components.find(c=>c.id==='G1').parameters.insideIndex=1.5;
 validate(revised);
 let stale=(await evaluateObservables(revised,example.requests,run.summary)).results;
 assert.ok(stale.every(x=>x.status==='suppressed'&&x.value===null));
 for(const [field,v] of [['maxRayDepth',0],['processedRayLimit',1]]){
  const limited=structuredClone(d);
  limited.simulation[field]=v;validate(limited);
  const incomplete=evaluateDocument(limited,core,example.requests);
  assert.notEqual(incomplete.summary.native.status,'completed');
  const res=(await evaluateObservables(limited,example.requests,incomplete.summary)).results;
  assert.ok(res.every(x=>x.status==='suppressed'&&x.value===null),field);
 }
 const changed=reviseScene(d,{changes:[{id:'S1',section:'parameters',key:'y',value:-1}]}).document;
 assert.equal(changed.schemaVersion,24);
 assert.equal(d.physics.components.find(c=>c.id==='S1').parameters.y,1);
 const newRun=evaluateDocument(changed,core,example.requests);
 assert.equal(newRun.summary.native.status,'completed');
});
