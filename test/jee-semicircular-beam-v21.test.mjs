// v21 production acceptance on exact pinned PhyDemo Glass arc + Beam.
// All face coordinates and ray events come from the real native simulator.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {predict} from '../src/analysis.js';
import {semicircularEncounter,SEMICIRCULAR_TYPE,SEMICIRCULAR_MODEL,SEMICIRCULAR_VERSION} from '../src/semicircular-dielectric.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-semicircular-beam-v21.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const by=(r,id)=>r.components.find(c=>c.id===id).parameters;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t, a+' != '+b);
const prepare=r=>prepareScene(r).document;
async function run(request,observations=fixture.requests){
 const document=prepare(request),native=evaluateDocument(document,core,observations);
 const results=(await evaluateObservables(document,observations,native.summary)).results;
 return {document,native,results};
}
test('strict public v21 admits exact right half-circle native Glass and preserves raw physical request',()=>{
 const p=fresh(),original=JSON.stringify(p),d=prepare(p);
 assert.equal(JSON.stringify(p),original);
 assert.equal(d.schemaVersion,SEMICIRCULAR_VERSION);
 assert.equal(d.adapterVersion,SEMICIRCULAR_VERSION);
 assert.equal(d.physics.model,SEMICIRCULAR_MODEL);
 assert.deepEqual(core.compile(d).native.objs.map(x=>x.type),['Beam','Glass','Detector']);
 const shape=core.compile(d).native.objs[1];
 assert.equal(shape.refIndex,Math.SQRT2);
 assert.equal(shape.partialReflect,false);
 assert.deepEqual(shape.path,[
  {x:0,y:-100,arc:false},{x:100,y:-0,arc:true},{x:0,y:100,arc:false}]);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const s=capabilities();
 assert.equal(s.nativeSemicircularBeam.schemaVersion,21);
 assert.equal(s.componentTypes[SEMICIRCULAR_TYPE].nativeType,'Glass');
 assert.deepEqual(s.semicircularDielectric.faces,['face-flat','face-arc']);
 assert.equal(predict(d).kind,'unavailable');
});
test('real native Beam refraction enters flat face and exits curved arc; normal/Snell angles match',async()=>{
 const r=await run(fresh());
 assert.equal(r.native.summary.native.status,'completed');
 assert.equal(r.native.summary.native.truncation,0);
 assert.equal(r.native.summary.native.undefinedBehavior,0);
 assert.deepEqual(r.results.map(x=>x.kind),fixture.requests.map(x=>x.kind));
 assert.deepEqual(r.results.map(x=>x.status),Array(7).fill('qualified'),'Fresnel-off is disclosed');
 assert.equal(r.results[0].value,4);
 assert.equal(r.results[1].value,8);
 assert.equal(r.results[2].value['face-flat'].interactions,4);
 assert.equal(r.results[2].value['face-arc'].interactions,4);
 const first=r.results[3].value;
 assert.equal(first.from,'outside');
 assert.equal(first.faceId,'face-flat');
 near(first.incidentAngleDeg,45,1e-6);
 near(first.transmittedAngleDeg,30,1e-6);
 near(first.incidentIndex,1);
 near(first.destinationIndex,Math.SQRT2);
 assert.equal(first.outcome,'transmission');
 assert.equal(r.results[4].value,0);
 assert.equal(r.results[5].value,4);
 assert.equal(r.results[6].value.length,4);
 assert.ok(r.results[6].value.every(h=>h.incomingUnit.x>0));
 const actual=r.native.summary.observations.interfacesById.G1;
 assert.equal(actual.invalidObservations,0);
 assert.equal(actual.faces['face-arc'].first.from,'inside');
 assert.equal(actual.faces['face-arc'].first.outcome,'transmission');
 console.log('JEE_V21_SEMICIRCLE_NATIVE '+JSON.stringify({status:'completed',
  flat:actual.faces['face-flat'].interactions,arc:actual.faces['face-arc'].interactions,
  emitted:r.results[0].value,crossings:r.results[5].value,nativeImageDetected:false}));
});
test('signed beam slopes, translated glass/beam/detector, radius and changed index retrace native refraction',async()=>{
 for(const sign of [1,-1]){
  const p=fresh();by(p,'B1').directionDeg=45*sign;by(p,'B1').y=-150*sign;
  const r=await run(p);
  assert.equal(r.native.summary.native.status,'completed');
  assert.equal(r.results[2].value['face-flat'].interactions,4);
  assert.equal(r.results[2].value['face-arc'].interactions,4);
  near(r.results[3].value.incidentAngleDeg,45);
 }
 const p=fresh();
 for(const c of p.components){c.parameters.x+=25;if('y' in c.parameters)c.parameters.y-=30;}
 const trans=await run(p);
 assert.equal(trans.native.summary.native.status,'completed');
 assert.equal(trans.results[1].value,8);
 near(trans.results[3].value.transmittedAngleDeg,30);
 const extended=fresh();by(extended,'G1').radius=120;
 assert.equal((await run(extended)).native.summary.native.status,'completed');
 for(const n of [1.3,1.8]){
  const r=fresh();by(r,'G1').insideIndex=n;
  const observed=await run(r);
  assert.equal(observed.native.summary.native.status,'completed');
  near(Math.sin(observed.results[3].value.transmittedAngleDeg*Math.PI/180)*n,Math.SQRT1_2);
 }
});
test('native true curved-boundary TIR is observed, not silently replaced with transmission',async()=>{
 const p=fresh();by(p,'B1').y=-58;by(p,'B1').width=10;
 const r=await run(p);
 assert.equal(r.native.summary.native.status,'completed');
 assert.ok(r.results[4].value>0,'real TIR events at native Glass curved surface');
 assert.equal(r.results[2].value['face-flat'].interactions>=2,true);
 assert.equal(r.results[5].value,0,'no detector hits in this finite TIR control');
 assert.equal(r.native.summary.native.truncation,0);
});
test('runtime geometry reports near-seam and tangential events invalid without inventing branches',()=>{
 const d=prepare(fresh()),c=d.physics.components.find(x=>x.id==='G1');
 for(const native of [{x:0,y:-100},{x:.00001,y:-99.99999},{x:0,y:100}]){
  const e=semicircularEncounter(c,native,{x:Math.SQRT1_2,y:Math.SQRT1_2});
  assert.equal(e.invalid,true);
  assert.equal(e.faceId,null);
  assert.ok(Number.isNaN(e.normal.x));
 }
 const valid=semicircularEncounter(c,{x:0,y:0},{x:Math.SQRT1_2,y:Math.SQRT1_2});
 assert.equal(valid.invalid,false);assert.equal(valid.faceId,'face-flat');
 const nearTangent=semicircularEncounter(c,{x:100,y:0},{x:0,y:1});
 assert.equal(nearTangent.invalid,true);
});
test('v21 qualified physical revisions preserve y, radius, indices and fail-closed invalid edits',async()=>{
 const first=prepare(fresh()),edit=reviseScene(first,{changes:[
  {id:'G1',section:'parameters',key:'radius',value:120},
  {id:'G1',section:'parameters',key:'insideIndex',value:1.5}
 ]}).document;
 assert.equal(first.physics.components.find(x=>x.id==='G1').parameters.radius,100);
 assert.equal(edit.physics.components.find(x=>x.id==='G1').parameters.radius,120);
 assert.deepEqual(parseSave(serializeSave(edit)),edit);
 const native=evaluateDocument(edit,core,fixture.requests);
 assert.equal(native.summary.native.status,'completed');
 const bad=structuredClone(edit);bad.physics.components.find(c=>c.id==='G1').parameters.radius=4;
 assert.throws(()=>validate(bad));
 assert.throws(()=>reviseScene(first,{changes:[{id:'G1',section:'parameters',key:'partialReflection',value:true}]}));
});
test('v21 strict contract rejects missing materials, seam crossings, overlapping optics and unsupported beams before native',()=>{
 const forbidden=[
  ['missing radius',p=>delete by(p,'G1').radius],
  ['missing outside index',p=>delete by(p,'G1').outsideIndex],
  ['missing Fresnel policy',p=>delete by(p,'G1').partialReflection],
  ['Fresnel on',p=>by(p,'G1').partialReflection=true],
  ['equal indices',p=>by(p,'G1').insideIndex=1],
  ['radius too small',p=>by(p,'G1').radius=4.9],
  ['beam after flat plane',p=>by(p,'B1').x=10],
  ['vertical beam',p=>by(p,'B1').directionDeg=90],
  ['incorrect 45 incidence',p=>by(p,'B1').directionDeg=0],
  ['seam start',p=>by(p,'B1').y=-50],
  ['sample outside flat face',p=>by(p,'B1').y=20],
  ['detector inside glass',p=>by(p,'D1').x=50],
  ['tilted detector',p=>by(p,'D1').orientationDeg=45],
  ['native saturation',p=>by(p,'B1').brightness=.9],
  ['second glass region',p=>p.components.push({...p.components.find(c=>c.id==='G1'),id:'G2'})],
  ['extra lens',p=>p.components.push({id:'L1',type:'ideal-lens',parameters:{x:-20,focalLength:100,apertureHeight:80}})],
  ['another source',p=>p.components.push({id:'S2',type:'point-source',parameters:{x:-200,y:0,brightness:.08},emission:{mode:'single-ray',directionDeg:0,angleDeg:30}})]
 ];
 for(const [label,mutate] of forbidden){const p=fresh();mutate(p);assert.throws(()=>prepare(p),undefined,label);}
 const missing=fresh();delete by(missing,'G1').radius;
 assert.ok(inspectAuthoringRequest(missing).some(x=>x.path.endsWith('.parameters.radius')));
});
test('historical v19 Beam and v7 full-circle glass never acquire a half-circle model or migrate',()=>{
 const legacy=JSON.parse(readFileSync(new URL('../examples/jee-parallel-lens-v19.json',import.meta.url),'utf8'));
 const old=prepare(legacy.physical);assert.equal(old.schemaVersion,19);
 assert.equal(core.compile(old).native.objs[0].type,'Beam');
 assert.deepEqual(parseSave(serializeSave(old)),old);
 const forged=structuredClone(old);forged.physics.components.push({
  id:'G1',type:SEMICIRCULAR_TYPE,parameters:by(fresh(),'G1')});
 assert.throws(()=>validate(forged));
 const p=fresh();p.components[1].type='circular-dielectric';
 assert.throws(()=>prepare(p),'Cannot replace half-circle with full circle without new physical facts');
 const converted=fresh();converted.lengthUnit='cm';
 const keys=new Set(['x','y','radius','width','length']);
 for(const c of converted.components)for(const k of keys)if(k in c.parameters)c.parameters[k]/=10;
 assert.deepEqual(prepare(converted).physics.components,prepare(fresh()).physics.components);
});
test('partial, stopped, stale and over-capacity detector evidence never become qualified native observations',async()=>{
 const d=prepare(fresh());
 for(const [k,value] of [['maxRayDepth',0],['processedRayLimit',1]]){
  const low=structuredClone(d);low.simulation[k]=value;validate(low);
  const n=evaluateDocument(low,core,fixture.requests);
  assert.notEqual(n.summary.native.status,'completed');
  const obs=(await evaluateObservables(low,fixture.requests,n.summary)).results;
  assert.ok(obs.every(x=>x.status==='suppressed'&&x.value===null),k);
 }
 const completed=evaluateDocument(d,core,fixture.requests);
 const tampered=structuredClone(d);tampered.physics.components.find(c=>c.id==='G1').parameters.insideIndex=1.4;validate(tampered);
 const stale=(await evaluateObservables(tampered,fixture.requests,completed.summary)).results;
 assert.ok(stale.every(x=>x.status==='suppressed'));
 const dense=fresh();dense.runPolicy='dense-v1';dense.components[0].parameters.width=40;
 const testDense=await run(dense);
 assert.equal(testDense.native.summary.native.status,'completed');
 assert.equal(testDense.results[0].value,40);
 assert.equal(testDense.results[5].value,40);
 assert.equal(testDense.results[6].value,null,'unclipped hit event list is withheld');
 assert.equal(testDense.results[6].status,'unavailable');
});

test('adversarial synthetic seam callback delegates exactly once and fails native qualification',()=>{
 // Fault injection tests an observer error path, not a native optical ray.
 // No simulation result is claimed from these deliberately fabricated inputs.
 const d=prepare(fresh()),loaded=core.loadDocument(d),optic=loaded.scene.objs[loaded.idMap.get('G1')];
 let delegations=0;
 optic.onRayIncident=function(...args){
  delegations++;
  return {isAbsorbed:true,isUndefinedBehavior:true};
 };
 const observer=core.observeInterfaceSet(d,loaded.scene,loaded.idMap);
 const ray={p1:{x:-1,y:-100},p2:{x:1,y:-100},brightness_s:.04,brightness_p:.04};
 const nativePoint={x:0,y:-100};
 const originalRay=structuredClone(ray),originalPoint=structuredClone(nativePoint);
 const returned=optic.onRayIncident(ray,0,nativePoint,[]);
 assert.equal(delegations,1,'recording cannot replace or double-invoke the native delegate');
 assert.deepEqual(returned,{isAbsorbed:true,isUndefinedBehavior:true});
 assert.deepEqual(ray,originalRay);
 assert.deepEqual(nativePoint,originalPoint);
 const report=observer.byId.G1;
 assert.equal(report.interactions,1);
 assert.equal(report.invalidObservations,1);
 assert.equal(report.faces['face-flat'].interactions,0);
 assert.equal(report.faces['face-arc'].interactions,0);
 assert.equal(observer.errors.length,1);
 assert.equal(core.classifyRun('simulationComplete',{
   errors:observer.errors,warnings:[],truncation:0,undefinedBehavior:0
 }), 'failed','a completion callback never overrides invalid seam observation');
});
test('two-detector plane clearance, radial bounds and native density policy remain strict',()=>{
 const r=fresh();
 r.components.push({id:'D2',type:'ray-detector',parameters:{x:300,y:0,orientationDeg:90,length:1200}});
 const d=prepare(r);
 assert.equal(d.schemaVersion,21);
 assert.equal(core.compile(d).native.objs.length,4);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const tooClose=structuredClone(r);
 by(tooClose,'D2').x=250.005;
 assert.throws(()=>prepare(tooClose),'nearly coincident passive detector planes');
 const outOfWorld=structuredClone(r);
 by(outOfWorld,'G1').x=9999;
 assert.throws(()=>prepare(outOfWorld),'complete arc must lie within world bounds');
 const density=structuredClone(d);
 density.simulation.rayDensity=.048;
 assert.throws(()=>validate(density),'beam would be overbright relative to density');
});
