// v26 REAL public JSON authoring -> canonical validation -> pinned native
// Beam/PlaneGlass/Mirror -> qualified sampled event observations.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,inspectAuthoringRequest,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {beamPlanarMirrorSafetyWitness,
 BEAM_PLANAR_MIRROR_VERSION,BEAM_PLANAR_MIRROR_MODEL}
 from '../src/native-beam-planar-mirror-v26.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-parallel-planar-mirror-v26.json',import.meta.url),'utf8'));
const source=()=>structuredClone(fixture.physical);
const component=(p,id)=>p.components.find(x=>x.id===id).parameters;
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
 String(a)+' != '+String(b)+' tolerance '+t);
async function run(p,requests=fixture.requests){
 const doc=prepareScene(p).document;
 const native=evaluateDocument(doc,core,requests);
 const results=(await evaluateObservables(doc,requests,native.summary)).results;
 return {doc,native,results,byId:Object.fromEntries(results.map(x=>[x.id,x]))};
}
test('public v26 selection is a strict new profile and preserves v19 unchanged',()=>{
 const p=source(),snapshot=structuredClone(p);
 const d=prepareScene(p).document;
 assert.deepEqual(p,snapshot);
 assert.equal(d.schemaVersion,BEAM_PLANAR_MIRROR_VERSION);
 assert.equal(d.adapterVersion,BEAM_PLANAR_MIRROR_VERSION);
 assert.equal(d.physics.model,BEAM_PLANAR_MIRROR_MODEL);
 assert.deepEqual(core.compile(d).native.objs.map(x=>x.type),
  ['Beam','PlaneGlass','Mirror','Detector']);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(validate(d),d);
 const a=capabilities();
 assert.equal(a.nativeBeamPlanarMirror.schemaVersion,26);
 assert.equal(a.nativeBeamPlanarMirror.mirrorRimClearanceMm,.1);
 const noMirror=source();noMirror.components=noMirror.components.filter(x=>x.id!=='M1');
 const old=prepareScene(noMirror).document;
 assert.equal(old.schemaVersion,19);
 assert.equal(old.physics.model,'native-parallel-planar-tracing');
 const tamper=structuredClone(old);
 tamper.physics.components.push(structuredClone(p.components.find(x=>x.id==='M1')));
 assert.throws(()=>validate(tamper),'v19 save cannot silently acquire v26 mirror');
});
test('real v26 pinned Beam traces 8 rays across 2 glass contacts and one Mirror per ray',async()=>{
 const {doc,native,results,byId}=await run(source());
 assert.equal(native.summary.executionPassed,true);
 assert.equal(native.summary.native.status,'completed');
 assert.equal(native.summary.native.truncation,0);
 assert.equal(native.summary.native.undefinedBehavior,0);
 assert.ok(results.every(x=>x.status==='qualified'),
  'Explicit Fresnel-off v26 run must distinguish qualified approximation from Fresnel-on');
 assert.equal(byId.emitted.value,8);
 assert.equal(byId['medium-encounters'].value,16);
 assert.equal(byId.mirror.value,8);
 assert.equal(byId.crossings.value,16);
 assert.equal(byId['sample-hits'].value.length,16);
 assert.equal(byId['sample-hits'].method,'native-hit-event-observation');
 assert.ok(byId['sample-hits'].warnings.some(x=>x.includes('transmitted-only')));
 assert.equal(byId['first-refracted'].value.from,'negative');
 assert.equal(byId['first-refracted'].value.incidentIndex,1);
 assert.equal(byId['first-refracted'].value.destinationIndex,1.5);
 near(byId['first-refracted'].value.incidentAngleDeg,30,1e-8);
 near(byId['first-refracted'].value.transmittedAngleDeg,
  Math.asin(Math.sin(Math.PI/6)/1.5)*180/Math.PI,1e-8);
 const nativeHitLocations=byId['sample-hits'].value.map(x=>x.pointMm);
 assert.ok(nativeHitLocations.every(x=>Math.abs(x.x+10)<1e-6&&Number.isFinite(x.y)));
 assert.equal(doc.physics.components.filter(x=>x.type==='plane-mirror').length,1);
});
test('genuine public v26 native counts change with density, index, direction and translation',async()=>{
 for(const c of [
  {name:'translated',dx:120,dy:-50},
  {name:'normal',direction:0},
  {name:'higher-index',n1:1.8},
  {name:'denser',density:0.4},
  {name:'large-density',density:1}
 ]){
  const p=source();
  if(c.dx){
   component(p,'B1').x+=c.dx;component(p,'B1').y+=c.dy;
   for(const id of ['I1','M1','D1']){
    component(p,id).x+=c.dx;component(p,id).y+=c.dy;
   }
  }
  if(c.direction!==undefined)component(p,'B1').directionDeg=c.direction;
  if(c.n1!==undefined)component(p,'I1').positiveIndex=c.n1;
  const d=prepareScene(p).document;
  if(c.density)d.simulation.rayDensity=c.density;
  const native=evaluateDocument(d,core,fixture.requests);
  const out=(await evaluateObservables(d,fixture.requests,native.summary)).results;
  const byId=Object.fromEntries(out.map(x=>[x.id,x]));
  assert.equal(native.summary.native.status,'completed',c.name);
  assert.equal(native.summary.native.truncation,0,c.name);
  const count=(c.density??.2)*40;
  assert.equal(byId.emitted.value,count,c.name);
  assert.equal(byId['medium-encounters'].value,count*2,c.name);
  assert.equal(byId.mirror.value,count,c.name);
  assert.equal(byId.crossings.value,count*2,c.name);
  if(count*2<=32)assert.equal(byId['sample-hits'].status,'qualified',c.name);
  else {
   assert.equal(byId['sample-hits'].status,'unavailable',c.name);
   assert.equal(byId['sample-hits'].value,null);
   assert.match(byId['sample-hits'].reason,/More than 32/);
  }
 }
});
test('v26 rejects missing material, wrong geometry, clipped mirror, foreign objects and full Fresnel',()=>{
 const invalid=[
  p=>delete component(p,'I1').negativeIndex,
  p=>delete component(p,'I1').partialReflection,
  p=>component(p,'I1').partialReflection=true,
  p=>component(p,'I1').normalDeg=45,
  p=>component(p,'I1').positiveIndex=.9,
  p=>component(p,'I1').positiveIndex=1,
  p=>component(p,'I1').negativeIndex=2,
  p=>component(p,'B1').x=0,
  p=>component(p,'B1').directionDeg=-30,
  p=>component(p,'B1').directionDeg=70,
  p=>component(p,'B1').brightness=1,
  p=>component(p,'B1').width=120,
  p=>component(p,'M1').x=0,
  p=>component(p,'M1').x=-1,
  p=>component(p,'M1').orientationDeg=45,
  p=>component(p,'M1').length=72,
  p=>component(p,'D1').x=0,
  p=>component(p,'D1').x=60,
  p=>component(p,'D1').orientationDeg=0,
  p=>component(p,'D1').x=-100,
  p=>p.components.push({...structuredClone(p.components.find(x=>x.id==='M1')),id:'M2'}),
  p=>p.components.push({id:'S2',type:'point-source',parameters:{x:-100,y:0,brightness:.08},
   emission:{mode:'single-ray',directionDeg:0}}),
  p=>p.components.push({...structuredClone(p.components.find(x=>x.id==='I1')),id:'I2',
   parameters:{...component(p,'I1'),x:30,negativeIndex:1.5,positiveIndex:1.8}}),
  p=>p.components.push({id:'L1',type:'ideal-lens',parameters:{x:35,focalLength:100,apertureHeight:50}})
 ];
 for(const edit of invalid){
  const p=source();edit(p);
  if(component(p,'I1').positiveIndex===1&&component(p,'I1').negativeIndex===1){
   // Index equality is intentionally allowed; keep this as a physical control.
   assert.equal(prepareScene(p).document.schemaVersion,26);
  }else assert.throws(()=>prepareScene(p),undefined,JSON.stringify(p));
 }
 const equal=source();component(equal,'I1').positiveIndex=1;
 assert.equal(prepareScene(equal).document.schemaVersion,26);
});
test('exact near-endpoint mirror and detector hazards are refused before native tracing',()=>{
 const p=source();
 const w=beamPlanarMirrorSafetyWitness(p.components,.2);
 const max=Math.max(...w.tracks.map(x=>x.mirrorY));
 component(p,'M1').length=2*max+0.1;
 assert.throws(()=>prepareScene(p));
 const badDetector=source();
 const ray=beamPlanarMirrorSafetyWitness(badDetector.components,.2).tracks[0];
 const yIn=ray.emitted.y+(-10-ray.emitted.x)*Math.tan(Math.PI/6);
 component(badDetector,'D1').y=yIn+component(badDetector,'D1').length/2;
 assert.throws(()=>prepareScene(badDetector),'A predicted sample on the finite detector endpoint must be rejected');
});
test('bounded native truncation and native processing stops suppress every public observable',async()=>{
 for(const [key,value] of [['maxRayDepth',0],['processedRayLimit',1]]){
  const doc=prepareScene(source()).document;
  doc.simulation[key]=value;
  const result=evaluateDocument(doc,core,fixture.requests);
  assert.notEqual(result.summary.native.status,'completed');
  const requested=(await evaluateObservables(doc,fixture.requests,result.summary)).results;
  assert.ok(requested.every(x=>x.status==='suppressed'&&x.value===null));
  assert.equal(result.summary.observations,null);
 }
});
test('native v26 real samples obey necessary specular normal and Snell vector consistency',()=>{
 const doc=prepareScene(source()).document;
 const {scene,idMap}=core.loadDocument(doc),events=[];
 for(const name of ['I1','M1']){
  const obj=scene.objs[idMap.get(name)],fn=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const dir=r=>{const dx=r.p2.x-r.p1.x,dy=r.p1.y-r.p2.y;
    const len=Math.hypot(dx,dy);return {x:dx/len,y:dy/len};};
   const incoming=dir(args[0]),hit={x:args[2].x,y:-args[2].y};
   const res=fn.apply(this,args),out=res?.isAbsorbed?null:dir(args[0]);
   events.push({id:name,hit,incoming,out});
   return res;
  };
 }
 const s=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;
 for(const x of ['simulationComplete','simulationStop'])s.on(x,()=>terminal=x);
 s.updateSimulation();
 assert.equal(terminal,'simulationComplete');
 assert.equal(events.filter(x=>x.id==='I1').length,16);
 assert.equal(events.filter(x=>x.id==='M1').length,8);
 const n0=1,n1=1.5;
 for(const e of events){
  if(e.id==='M1'){
   near(e.out.x,-e.incoming.x,1e-11);near(e.out.y,e.incoming.y,1e-11);
   near(e.hit.x,60,1e-7);
  }else {
   const entering=e.incoming.x>0,nBefore=entering?n0:n1,nAfter=entering?n1:n0;
   near(nBefore*e.incoming.y,nAfter*e.out.y,1e-11);
   near(e.hit.x,0,1e-7);
  }
 }
});
