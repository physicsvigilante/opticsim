// Test-only pinned native lens feasibility for JEE J17.
// These finite rays are explicit ADDITIONAL teaching apparatus, not source facts.
// One source is simulated per witness so detector crossings cannot be falsely
// attributed between sources; the analytical query remains native:not-run.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {analyzeTwoSourceLensCoincidence} from '../src/two-source-lens-coincidence-query.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const original=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const q=JSON.parse(readFileSync(new URL('../examples/jee-two-source-lens-coincidence-v1.json',import.meta.url),'utf8'));
const fixed=analyzeTwoSourceLensCoincidence(q);
function witness({lensXMm,imageXMm,fromSide='left',heightMm=5}){
 const d=240,f=90,sourceX=fromSide==='left'?0:d;
 const template=core.compile(original).native;
 const sourcePrototype=template.objs[0];
 const sourceHeights=[-heightMm,+heightMm];
 const sources=sourceHeights.map(h=>{
  const obj=structuredClone(sourcePrototype);
  obj.p1={x:sourceX,y:0};
  obj.p2={x:lensXMm,y:h};
  obj.brightness=.5;
  return obj;
 });
 const lens={type:'IdealLens',
  p1:{x:lensXMm,y:-50},p2:{x:lensXMm,y:50},focalLength:f};
 const detector=structuredClone(template.objs[2]);
 detector.p1={x:imageXMm,y:-20};
 detector.p2={x:imageXMm,y:20};
 const native={...template,objs:[...sources,lens,detector],
  maxRayDepth:8}; // Processed-ray limit belongs to Simulator, never Scene JSON.
 const scene=core.loadNative(native);
 const actualTypes=scene.objs.map(o=>o.constructor.type);
 assert.deepEqual(actualTypes,['SingleRay','SingleRay','IdealLens','Detector']);
 const lensInstance=scene.objs[2],detectorInstance=scene.objs[3];
 const hitEvents=[],lensEvents=[],emissions=[];
 for(const source of scene.objs.slice(0,2)){
  const prior=source.onSimulationStart;
  source.onSimulationStart=function(...args){
   const out=prior.apply(this,args); // native source unchanged
   emissions.push(out?.newRays?.length??null);
   return out;
  };
 }
 const beforeLens=lensInstance.onRayIncident;
 lensInstance.onRayIncident=function(...args){
  const entry=args[2]?{x:args[2].x,y:args[2].y}:null;
  const ret=beforeLens.apply(this,args); // actual pinned native ideal lens
  const ray=args[0],p1=ray.p1,p2=ray.p2;
  lensEvents.push({entry,post:{p1:{...p1},p2:{...p2}},
   absorbed:ret?.isAbsorbed===true,undefinedBehavior:ret?.isUndefinedBehavior===true});
  return ret;
 };
 const beforeDetector=detectorInstance.onRayIncident;
 detectorInstance.onRayIncident=function(...args){
  hitEvents.push({point:{x:args[2]?.x,y:args[2]?.y}});
  return beforeDetector.apply(this,args);
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;
 for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>terminal=e);
 sim.updateSimulation();
 const diag=core.diagnostics(scene,sim);
 return {terminal,status:core.classifyRun(terminal,diag),diag,
  fromSide,lensXMm,imageXMm,emissions,lensEvents,hitEvents,
  researchOnly:true,originalQuestionSolved:false,nativeImageDetected:false};
}
function assertNative(r,expectedReal){
 assert.equal(r.terminal,'simulationComplete','native must finish');
 assert.equal(r.status,'completed','native must be qualified');
 assert.deepEqual(r.diag.errors,[]);
 assert.equal(r.diag.truncation,0);assert.equal(r.diag.undefinedBehavior,0);
 assert.deepEqual(r.emissions,[1,1]);
 assert.equal(r.lensEvents.length,2,'real rays must each hit genuine native lens once');
 assert.equal(r.hitEvents.length,expectedReal?2:0,
  'virtual source has no actual crossing at the mathematical shared-image coordinate');
 for(const event of r.lensEvents){
  assert.ok(event.entry&&Number.isFinite(event.entry.x)&&Number.isFinite(event.entry.y));
  assert.ok(!event.absorbed&&!event.undefinedBehavior);
  assert.ok(Math.abs(event.entry.x-r.lensXMm)<1e-8);
  const {p1,p2}=event.post,dx=p2.x-p1.x;
  assert.ok(Number.isFinite(dx)&&Math.abs(dx)>1e-8);
  const yImage=p1.y+(r.imageXMm-p1.x)*(p2.y-p1.y)/dx;
  assert.ok(Number.isFinite(yImage)&&Math.abs(yImage)<.05,
   'the measured native outgoing line must agree with the conditional Gaussian conjugate');
  const toImage=r.imageXMm-r.lensXMm;
  assert.equal(Math.sign(toImage*dx),expectedReal?1:-1,
   'virtual image location is BACKWARD extension only, never a forward detector hit');
 }
 if(expectedReal)for(const event of r.hitEvents){
  assert.ok(Math.abs(event.point.x-r.imageXMm)<1e-8);
  assert.ok(Math.abs(event.point.y)<.05);
 }
}
test('J17 frozen two inverse placements each produce true native real-side detector intersections and only virtual backward extensions',()=>{
 assert.equal(fixed.status,'conditional');
 assert.equal(fixed.value.placementCount,2);
 const witnesses=[];
 for(const sol of fixed.value.placements){
  for(const fromSide of ['left','right']){
   const expectedReal=fromSide==='left'?sol.source1Image.kind==='real':
    sol.source2Image.kind==='real';
   const w=witness({lensXMm:sol.lensXMm,imageXMm:sol.sharedImageXMm,fromSide});
   assertNative(w,expectedReal);
   witnesses.push({lensXmm:w.lensXMm,conditionalCommonImageXmm:w.imageXMm,
    source:fromSide,kind:expectedReal?'real':'virtual',
    nativeLensIncidents:w.lensEvents.length,actualNativeDetectorCrossings:w.hitEvents.length,
    nativeImageDetected:false});
  }
 }
 assert.equal(witnesses.filter(x=>x.kind==='real').length,2);
 assert.equal(witnesses.filter(x=>x.kind==='virtual').length,2);
 assert.equal(witnesses.filter(x=>x.kind==='virtual').reduce((acc,x)=>acc+x.actualNativeDetectorCrossings,0),0);
 console.log('JEE_J17_NATIVE_CONJUGATE_WITNESSES '+JSON.stringify({
  witnesses,rawPinnedNativeOnly:true,originalQuestionSolved:false,
  nativePhysicalImageDetection:false,addedTeachingApparatus:true}));
});
test('real native lens misses remain misses: extending source ray above finite lens aperture never manufactures a common image',()=>{
 const r=witness({lensXMm:60,imageXMm:-120,fromSide:'right',heightMm:90});
 assert.equal(r.terminal,'simulationComplete');
 assert.equal(r.status,'completed');
 assert.equal(r.lensEvents.length,0,'both rays pass outside finite native lens');
 assert.equal(r.hitEvents.length,0,
  'finite miss is not treated as Gaussian mathematical image or a detector crossing');
});
test('analytical inverse does NOT append a raw pinned native scene or detections',()=>{
 assert.equal(fixed.native.status,'not-run');
 assert.equal(fixed.native.observations,null);
 assert.equal(fixed.native.nativeImageDetected,false);
 assert.ok(fixed.value.placements.every(p=>p.physicalDetectorCoincidenceCertified===false));
});
