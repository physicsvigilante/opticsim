// Actual pinned PhyDemo native Beam+Glass v22 authorable acceptance.
// The triangle's encounter order is NEVER prescribed by this test or adapter.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {predict} from '../src/analysis.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {PRISM_BEAM_VERSION,PRISM_BEAM_MODEL,PRISM_BEAM_VERTEX_CLEARANCE_MM} from '../src/native-prism-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-prism-beam-v22.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const by=(p,id)=>p.components.find(c=>c.id===id).parameters;
const prepared=p=>prepareScene(p).document;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
 String(a)+' != '+String(b));
async function run(input){
 const doc=prepared(input),native=evaluateDocument(doc,core,fixture.requests);
 const results=(await evaluateObservables(doc,fixture.requests,native.summary)).results;
 return {doc,native,results};
}
test('v22 strict authoring is a separate native Glass+Beam contract with exact explicit indices',()=>{
 const p=fresh(),original=JSON.stringify(p),doc=prepared(p);
 assert.equal(JSON.stringify(p),original);
 assert.equal(doc.schemaVersion,PRISM_BEAM_VERSION);
 assert.equal(doc.adapterVersion,PRISM_BEAM_VERSION);
 assert.equal(doc.physics.model,PRISM_BEAM_MODEL);
 assert.deepEqual(core.compile(doc).native.objs.map(c=>c.type),['Beam','Glass','Detector']);
 const glass=core.compile(doc).native.objs[1];
 assert.equal(glass.refIndex,1.5);assert.equal(glass.partialReflect,false);
 assert.deepEqual(glass.path,[
  {x:0,y:70,arc:false},{x:0,y:-70,arc:false},{x:100,y:-0,arc:false}
 ]);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 assert.equal(capabilities().nativePrismBeam.schemaVersion,22);
 assert.equal(capabilities().nativePrismBeam.vertexClearanceMm,PRISM_BEAM_VERTEX_CLEARANCE_MM);
 assert.equal(predict(doc).kind,'unavailable');
});
test('real multi-face native prism shows genuine sampled detector zero, not an absent measurement',async()=>{
 const r=await run(fresh());
 assert.equal(r.native.summary.native.status,'completed');
 assert.equal(r.native.summary.native.truncation,0);
 assert.equal(r.native.summary.native.undefinedBehavior,0);
 assert.deepEqual(r.results.map(x=>x.status),Array(7).fill('qualified'),
  'Explicit Fresnel-off approximation is qualified and documented');
 assert.equal(r.results[0].value,4);
 assert.equal(r.results[1].value,12,'4 entry and 8 more real native Glass incidents');
 for(const face of ['face-12','face-23','face-31'])
  assert.equal(r.results[2].value[face].interactions,4);
 const first=r.results[3].value;
 assert.equal(first.faceId,'face-12');
 assert.equal(first.from,'outside');
 assert.equal(first.outcome,'transmission');
 near(first.incidentAngleDeg,0);
 near(first.transmittedAngleDeg,0);
 assert.equal(first.incidentIndex,1);
 assert.equal(first.destinationIndex,1.5);
 assert.equal(r.results[4].value,4,'four actual native internal total reflections, not inferred path turns');
 assert.equal(r.results[5].value,0);
 assert.deepEqual(r.results[6].value,[]);
 assert.equal(r.results[6].status,'qualified');
 assert.match(formatRequestedResult(r.results[6]),/No sampled detector hits/);
 assert.equal(r.native.summary.observations.interfacesById.G1.invalidObservations,0);
 console.log('JEE_V22_NATIVE_PRISM '+JSON.stringify({status:'completed',emitted:4,
   faceEvents:12,detectorCrossings:0,detectedImage:false,
   genuineNativeZero:true}));
});
test('different finite apex width produces real downstream refracted crossings rather than invented hits',async()=>{
 const p=fresh();by(p,'G1').x3=20;
 const r=await run(p);
 assert.equal(r.native.summary.native.status,'completed');
 assert.equal(r.results[0].value,4);
 assert.equal(r.results[2].value['face-12'].interactions,4);
 assert.equal(r.results[4].value,0,'short prism genuinely transmits without native TIR in this control');
 assert.ok(r.results[5].value>0,'real native refracted rays reach downstream detector');
 assert.equal(r.results[5].value,r.results[6].value.length);
 assert.ok(r.results[6].value.every(x=>Math.abs(x.pointMm.x-200)<1e-6));
 console.log('JEE_V22_SHORT_PRISM_NATIVE '+JSON.stringify({
  status:r.native.summary.native.status,
  hits:r.results[5].value,nativeImageDetected:false}));
});
test('real native index, translation, width and sampling policies retrace actual faces',async()=>{
 for(const n of [1.3,1.8]){
  const p=fresh();by(p,'G1').insideIndex=n;
  const r=await run(p);
  assert.equal(r.native.summary.native.status,'completed');
  assert.equal(r.results[0].value,4);
  assert.equal(r.results[1].value,12);
  assert.equal(r.results[3].value.incidentIndex,1);
  assert.equal(r.results[3].value.destinationIndex,n);
 }
 const shifted=fresh();
 for(const c of shifted.components){
  if(c.type==='triangular-prism')for(const i of [1,2,3]){
   c.parameters['x'+i]+=120;c.parameters['y'+i]+=80;
  }else{c.parameters.x+=120;c.parameters.y+=80;}
 }
 const r=await run(shifted);
 assert.equal(r.native.summary.native.status,'completed');
 assert.equal(r.results[1].value,12);
 const width=fresh();by(width,'B1').width=40;
 const widened=await run(width);
 assert.equal(widened.native.summary.native.status,'completed');
 assert.equal(widened.results[0].value,8);
 assert.equal(widened.results[1].value,24);
});
test('v22 admits exactly two distinct downstream detector planes, not an optical route',()=>{
 const p=fresh();p.components.push({id:'D2',type:'ray-detector',parameters:{
  x:300,y:0,length:600,orientationDeg:90}});
 const doc=prepared(p);
 assert.equal(core.compile(doc).native.objs.length,4);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
});
test('v22 refuses unspecified material, vertex coincidences, Fresnel branching and mixed models',()=>{
 const invalid=[
 ['missing refraction index',p=>delete by(p,'G1').outsideIndex],
 ['missing prism vertex',p=>delete by(p,'G1').x3],
 ['missing Fresnel policy',p=>delete by(p,'G1').partialReflection],
 ['Fresnel on',p=>by(p,'G1').partialReflection=true],
 ['material outside >=inside',p=>by(p,'G1').outsideIndex=1.5],
 ['apex behind flat face',p=>by(p,'G1').x3=-10],
 ['inclined flat entrance',p=>by(p,'G1').x2=1],
 ['reversed base order',p=>{const g=by(p,'G1');[g.y1,g.y2]=[g.y2,g.y1];}],
 ['apex outside vertical base',p=>by(p,'G1').y3=100],
 ['apex too near vertex',p=>by(p,'G1').y3=69.5],
 ['beam source inside prism',p=>by(p,'B1').x=1],
 ['beam below flat face',p=>by(p,'B1').y=100],
 ['oblique Beam',p=>by(p,'B1').directionDeg=45],
 ['reversed Beam',p=>by(p,'B1').directionDeg=180],
 ['forward initial ray at apex',p=>by(p,'G1').y3=2.5],
 ['forward initial ray within vertex guard',p=>by(p,'G1').y3=2.55],
 ['flat endpoint close to Beam',p=>{by(p,'G1').y1=-10.02;by(p,'G1').y2=10.02;}],
 ['downstream detector inside triangle',p=>by(p,'D1').x=50],
 ['tilted downstream detector',p=>by(p,'D1').orientationDeg=45],
 ['source brightness saturation',p=>by(p,'B1').brightness=.9],
 ['extra native ideal lens',p=>p.components.push({id:'L1',type:'ideal-lens',parameters:{
    x:150,focalLength:100,apertureHeight:100}})],
 ['second prism',p=>p.components.push({...p.components.find(c=>c.id==='G1'),id:'G2'})],
 ['point source mixed with Beam',p=>p.components.push({id:'S2',type:'point-source',
   parameters:{x:-150,y:0,brightness:.08},emission:{mode:'single-ray',directionDeg:0}})]
 ];
 for(const [why,edit] of invalid){const p=fresh();edit(p);
  assert.throws(()=>prepared(p),undefined,'Unsafe composition accepted: '+why);}
 const missing=fresh();delete by(missing,'G1').outsideIndex;
 assert.ok(inspectAuthoringRequest(missing).length>0);
});
test('legacy v8 single-ray prism and v19 native Beam remain separate and save identically',()=>{
 const old=prepared({lengthUnit:'mm',runPolicy:'preview-v1',components:[
  {id:'S1',type:'point-source',parameters:{x:-100,y:20,brightness:.08},
    emission:{mode:'single-ray',directionDeg:0}},
  {id:'G1',type:'triangular-prism',parameters:{...by(fresh(),'G1')}},
  {id:'D1',type:'ray-detector',parameters:{x:200,y:0,length:100,orientationDeg:90}}
 ]});
 assert.equal(old.schemaVersion,8);
 assert.deepEqual(core.compile(old).native.objs.map(x=>x.type),['SingleRay','Glass','Detector']);
 assert.deepEqual(parseSave(serializeSave(old)),old);
 const oldBeam=JSON.parse(readFileSync(new URL('../examples/jee-parallel-lens-v19.json',import.meta.url),'utf8'));
 const v19=prepared(oldBeam.physical);
 assert.equal(v19.schemaVersion,19);
 assert.deepEqual(parseSave(serializeSave(v19)),v19);
 const forged=structuredClone(old);forged.physics.components[0].type='parallel-beam';
 assert.throws(()=>validate(forged));
});
test('stopped, truncated and stale v22 native observations are always withheld',async()=>{
 const d=prepared(fresh());
 for(const [key,value] of [['processedRayLimit',1],['maxRayDepth',0]]){
  const changed=structuredClone(d);changed.simulation[key]=value;validate(changed);
  const exec=evaluateDocument(changed,core,fixture.requests);
  assert.notEqual(exec.summary.native.status,'completed');
  const obs=(await evaluateObservables(changed,fixture.requests,exec.summary)).results;
  assert.ok(obs.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const original=evaluateDocument(d,core,fixture.requests);
 const altered=structuredClone(d);altered.physics.components.find(x=>x.id==='G1').parameters.insideIndex=1.3;validate(altered);
 const stale=(await evaluateObservables(altered,fixture.requests,original.summary)).results;
 assert.ok(stale.every(r=>r.status==='suppressed'));
});
test('test-only true native vertex callback ambiguity cannot qualify normal/count measurements',()=>{
 const d=prepared(fresh()),loaded=core.loadDocument(d),prism=loaded.scene.objs[loaded.idMap.get('G1')];
 let delegated=0;
 prism.onRayIncident=function(...args){delegated++;return {isAbsorbed:true,isUndefinedBehavior:true};};
 const meter=core.observeInterfaceSet(d,loaded.scene,loaded.idMap);
 const ray={p1:{x:-1,y:0},p2:{x:1,y:0},brightness_s:.04,brightness_p:.04};
 const result=prism.onRayIncident(ray,0,{x:100,y:-0},[]);
 assert.equal(delegated,1);
 assert.equal(result.isUndefinedBehavior,true);
 assert.equal(meter.byId.G1.invalidObservations,1);
 assert.equal(meter.byId.G1.first.faceId,null);
 assert.equal(meter.errors.length,1);
 assert.equal(core.classifyRun('simulationComplete',{errors:meter.errors,warnings:[],
   truncation:0,undefinedBehavior:0}),'failed');
});

test('v22 dense native detector overflow retains counted crossings but withholds entire position list',async()=>{
 const physical=fresh();by(physical,'G1').x3=20;by(physical,'B1').width=80;
 const doc=prepared(physical);
 doc.simulation.rayDensity=.8;
 validate(doc);
 const native=evaluateDocument(doc,core,fixture.requests);
 assert.equal(native.summary.native.status,'completed');
 assert.equal(native.summary.native.truncation,0);
 assert.equal(native.summary.native.undefinedBehavior,0);
 const results=(await evaluateObservables(doc,fixture.requests,native.summary)).results;
 assert.equal(results[0].value,64);
 assert.equal(results[5].value,64,'all counted native downstream detector events remain observed');
 assert.equal(results[6].status,'unavailable','never clip 64 native positions to a pseudo-complete 32');
 assert.equal(results[6].value,null);
 assert.match(results[6].reason,/More than 32 actual detector hits/);
 const ledger=native.summary.observations.detectorHitEventsById.D1;
 assert.equal(ledger.observedCount,64);
 assert.equal(ledger.status,'unavailable');
 assert.equal(ledger.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');
 console.log('JEE_V22_OVERFLOW_NATIVE '+JSON.stringify({
  emitted:64,crossings:64,hitPositions:'withheld',continuousIrradianceClaim:false}));
});
