// Chat B B1 regression: v26 admission must match the PINNED native Beam
// midpoint sample loop, not width*rayDensity near floating half-integers.
// Neither this test nor the admission helper steers, edits or invents rays.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities} from '../src/authoring.js';
import {validate} from '../src/contract.js';
import {compileParallelBeam,parallelBeamSamples} from '../src/parallel-beam.js';
import {
 v26PinnedBeamAdmissionSamples,beamPlanarMirrorSafetyWitness,
 BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD
} from '../src/native-beam-planar-mirror-v26.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-parallel-planar-mirror-v26.json',import.meta.url),'utf8'));
const initial=prepareScene(fixture.physical).document;
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol,
 String(a)+' is not '+String(b)+' within '+String(tol));
function candidate({x=-100,y=0,width=50,directionDeg=1,density=.29,
 mirrorY=4,mirrorLength=48,shiftAll=false}={}){
 const doc=structuredClone(initial);
 const get=id=>doc.physics.components.find(c=>c.id===id).parameters;
 Object.assign(get('B1'),{x,y,width,directionDeg});
 Object.assign(get('M1'),{y:mirrorY,length:mirrorLength});
 if(shiftAll){
  const dx=x+100,dy=y;
  for(const id of ['I1','M1','D1']){
   get(id).x+=dx;get(id).y+=dy;
  }
  get('M1').y=mirrorY+dy;
 }
 doc.simulation.rayDensity=density;
 return doc;
}
function actualPinnedEmission(doc){
 const raw=structuredClone(core.compile(initial).native);
 const p=doc.physics.components.find(c=>c.id==='B1').parameters;
 raw.objs[0]=compileParallelBeam({id:'B1',type:'parallel-beam',parameters:p});
 raw.rayModeDensity=doc.simulation.rayDensity;
 assert.equal(raw.lengthScale,1,'v26 exact enumerator assumes the actual fixed native lengthScale');
 const scene=core.loadNative(raw);
 assert.equal(scene.lengthScale,1);
 const rays=scene.objs[0].onSimulationStart().newRays;
 return {raw,points:rays.map(r=>({x:r.p1.x,y:-r.p1.y}))};
}
function assertNativeMatch(doc){
 const p=doc.physics.components.find(x=>x.id==='B1').parameters;
 const admitted=v26PinnedBeamAdmissionSamples(p,doc.simulation.rayDensity);
 const actual=actualPinnedEmission(doc).points;
 assert.equal(admitted.samples.length,actual.length);
 for(let i=0;i<actual.length;i++){
  near(admitted.samples[i].x,actual[i].x,1e-12);
  near(admitted.samples[i].y,actual[i].y,1e-12);
 }
 return {admitted,actual};
}
test('B1 exact 50-mm +1-degree density-.29 discrepancy has 15 pinned rays, never 14 admission checks',()=>{
 const doc=candidate();
 const p=doc.physics.components.find(x=>x.id==='B1').parameters;
 assert.equal(parallelBeamSamples(p,.29).length,14,'Legacy reviewed v19 approximation is unchanged');
 const {admitted,actual}=assertNativeMatch(doc);
 assert.equal(actual.length,15,'Pinned Beam actually emits the fifteenth sample');
 assert.equal(admitted.samples.length,15,'All actual native samples must be represented in v26 witness');
 near(admitted.computedNativeLengthMm,50.00000000000001,1e-14);
 near(admitted.nativeSampleFactor,14.500000000000002,1e-14);
 assert.equal(admitted.nearHalfInteger,true);
 assert.equal(BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD,1e-10);
 assert.equal(capabilities().nativeBeamPlanarMirror.nativeHalfIntegerSampleGuard,1e-10);
 assert.match(capabilities().nativeBeamPlanarMirror.numerical,/half-integer native threshold/);
 const safe=beamPlanarMirrorSafetyWitness(doc.physics.components,.29);
 assert.equal(safe.tracks.length,15);
 assert.ok(safe.tracks.slice(0,14).every(x=>x.mirrorY>-20.1&&x.mirrorY<28.1));
 assert.ok(safe.tracks[14].mirrorY < -20,
  'The native-only extra sample would miss the mirror entirely');
 near(safe.tracks[14].mirrorY,-22.560158194722447,1e-8);
 assert.throws(()=>validate(doc),/half-integer threshold/,
  'The exact review counterexample must be refused BEFORE executing native optics');
});
test('B1 near-rim variants also fail closed, including an unseen fifteenth sample within 0.1 mm of edge',()=>{
 for(const edgeGap of [-.05,.05]){
  const doc=candidate({mirrorLength:51});
  const m=doc.physics.components.find(x=>x.id==='M1').parameters;
  const first=beamPlanarMirrorSafetyWitness(doc.physics.components,.29);
  const last=first.tracks[14].mirrorY;
  m.y=last+edgeGap+51/2;
  const witness=beamPlanarMirrorSafetyWitness(doc.physics.components,.29);
  assert.equal(witness.tracks.length,15);
  near(witness.tracks[14].mirrorY-witness.mirrorBottom,-edgeGap,1e-9);
  assert.throws(()=>validate(doc),/half-integer threshold/);
 }
 // Independent of sample-count ambiguity, ordinary v26 endpoint clearance
 // still refuses a precisely near-rim native-sample encounter.
 const reliable=candidate({density:.289,mirrorLength:80,mirrorY:0});
 const w=beamPlanarMirrorSafetyWitness(reliable.physics.components,reliable.simulation.rayDensity);
 assert.equal(w.nearHalfInteger,false);
 const min=Math.min(...w.tracks.map(x=>x.mirrorY));
 const m=reliable.physics.components.find(x=>x.id==='M1').parameters;
 m.length=60;
 m.y=min-.05+30; // lower endpoint 0.05mm below a real predicted mirror hit
 assert.throws(()=>validate(reliable),/0.1 mm/);
});
test('actual pinned native emissions match v26 exact witness on both sides of half-integers and translated/oblique cases',()=>{
 const parameters=[
  {directionDeg:1,density:.29-1e-5,width:50},
  {directionDeg:1,density:.29+1e-5,width:50},
  {directionDeg:1,density:.29,width:50,x:-240,y:71},
  {directionDeg:0,density:.289,width:50},
  {directionDeg:30,density:.289,width:50},
  {directionDeg:35,density:.291,width:50,x:-150,y:-35},
  {directionDeg:10,density:.29,width:48},
  {directionDeg:59,density:.11,width:40},
  {directionDeg:0,density:.2,width:40},
  {directionDeg:30,density:1,width:40}
 ];
 let checked=0,admitted=0,guarded=0;
 for(const options of parameters){
  const doc=candidate({...options,mirrorLength:420,mirrorY:0,shiftAll:!!options.x});
  const {admitted:sampled,actual}=assertNativeMatch(doc);
  assert.ok(actual.length>=1&&actual.length<=100);
  checked+=actual.length;
  if(sampled.nearHalfInteger){
   assert.throws(()=>validate(doc),/half-integer threshold/);
   guarded++;
  }else if(options.directionDeg<=35){
   assert.doesNotThrow(()=>validate(doc),JSON.stringify(options));
   admitted++;
  }
 }
 assert.ok(checked>140,'Meaningful native across-angle and translated sample matrix');
 assert.ok(admitted>=5);
 assert.ok(guarded>=1);
});
test('v26 stable off-threshold 14/15 sampled profiles match pinned Beam counts and actual full native return events',()=>{
 for(const [density,wanted] of [[.29-1e-5,14],[.29+1e-5,15]]){
  const doc=candidate({density,mirrorLength:420,mirrorY:0});
  assert.doesNotThrow(()=>validate(doc));
  const model=beamPlanarMirrorSafetyWitness(doc.physics.components,density);
  assert.equal(model.tracks.length,wanted);
  assert.equal(actualPinnedEmission(doc).points.length,wanted);
  const {scene,idMap}=core.loadDocument(doc);
  const counters={glass:0,mirror:0,detector:0,source:0};
  const beam=scene.objs[idMap.get('B1')],onStart=beam.onSimulationStart;
  beam.onSimulationStart=function(...args){
   const result=onStart.apply(this,args);counters.source+=result.newRays.length;return result;
  };
  for(const [id,name] of [['I1','glass'],['M1','mirror'],['D1','detector']]){
   const obj=scene.objs[idMap.get(id)],original=obj.onRayIncident;
   obj.onRayIncident=function(...args){counters[name]++;return original.apply(this,args);};
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
  let terminal=null;
  sim.on('simulationComplete',()=>terminal='complete');
  sim.on('simulationStop',()=>terminal='stopped');
  sim.updateSimulation();
  assert.equal(terminal,'complete');
  assert.equal(sim.totalTruncation,0);
  assert.equal(sim.totalUndefinedBehavior,0);
  assert.deepEqual(counters,{glass:2*wanted,mirror:wanted,detector:2*wanted,source:wanted});
 }
});
