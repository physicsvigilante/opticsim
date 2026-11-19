// Research ONLY: pinned PhyDemo's native GrinGlass Euler integrator.
// Tests the possibility of real continuously varying index, not a public
// authoring contract, a new tracer, a JEE source solution or a certified error.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const saved=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const PIN='811f508d2b070898c241a568b0c167dcb8645251';
const gradientFn='\\sqrt{1-y}'; // native y-down -> physical y-up; 1/mm unit scale is explicit.
const limits=Object.freeze({maxNativeCallbacks:4096,maxAbsCoordinate:10000});
function finitePoint(point){return !!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)
 &&Math.abs(point.x)<=limits.maxAbsCoordinate&&Math.abs(point.y)<=limits.maxAbsCoordinate;}

// Research creates raw native objects based on existing compiled SingleRay and
// Detector. It does not retype a canonical public polygon as GRIN glass.
function nativeProbe({stepSize=.02,indexFunction=gradientFn,sourceX=.1}={}){
 const reference=core.compile(saved);
 assert.equal(reference.native.objs[0].type,'SingleRay');
 assert.equal(reference.native.objs[2].type,'Detector');
 const source=structuredClone(reference.native.objs[0]);
 source.p1={x:sourceX,y:0};source.p2={x:sourceX+20,y:0};
 const grin={
  type:'GrinGlass',
  path:[{x:0,y:-.9},{x:1,y:-.9},{x:1,y:.4},{x:0,y:.4}],
  notDone:false,refIndexFn:indexFunction,absorptionFn:'0',
  plotFns:false,origin:{x:0,y:0},stepSize,intersectTol:1e-5,
  partialReflect:false
 };
 const detector=structuredClone(reference.native.objs[2]);
 detector.p1={x:1.2,y:-1};detector.p2={x:1.2,y:1};
 const native={...reference.native,objs:[source,grin,detector],maxRayDepth:4096};
 // Processed-ray cap belongs to core.Simulator below, not native Scene data.
 const scene=core.loadNative(native);
 assert.deepEqual(scene.objs.map(o=>o.constructor.type),['SingleRay','GrinGlass','Detector']);
 const body=scene.objs[1],target=scene.objs[2];
 const hits=[],internal=[],unexpected=[],limit=limits.maxNativeCallbacks;
 const prev=body.onRayIncident;
 body.onRayIncident=function(...args){
  const at={x:args[2]?.x,y:args[2]?.y};
  const ret=prev.apply(this,args); // unmodified pinned native decision
  if(internal.length<limit)internal.push({x:at.x,y:at.y,
    next:ret?.isAbsorbed?null:{x:args[0].p2.x,y:args[0].p2.y},
    absorbed:ret?.isAbsorbed===true,undefinedBehavior:ret?.isUndefinedBehavior===true});
  else unexpected.push('callback-audit-limit');
  return ret;
 };
 const before=target.onRayIncident;
 target.onRayIncident=function(...args){
  if(hits.length<20)hits.push({x:args[2]?.x,y:args[2]?.y});
  else unexpected.push('detector-audit-limit');
  return before.apply(this,args);
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;
 for(const key of ['simulationComplete','simulationStop'])sim.on(key,()=>{terminal=key});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(scene,sim);
 return {terminal,diagnostics,nativeStatus:core.classifyRun(terminal,diagnostics),
  hits,internal,unexpected,stepSize,indexFunction,sourceX,
  evidenceScope:'raw-pinned-native-research-only',
  originalJeeQuestionSolved:false,nativeImageDetected:false,
  publicAuthoringSupported:false,pinnedPhyDemo:PIN};
}
function qualifiedResearch(r,label){
 if(r.nativeStatus!=='completed')console.log('JEE_GRIN_NATIVE_UNQUALIFIED '+JSON.stringify({label,terminal:r.terminal,status:r.nativeStatus,errors:r.diagnostics.errors,warnings:r.diagnostics.warnings,truncation:r.diagnostics.truncation,undefinedBehavior:r.diagnostics.undefinedBehavior,processed:r.diagnostics.processed,internalCallbacks:r.internal.length,first:r.internal.slice(0,2),last:r.internal.slice(-2),detector:r.hits,stepSize:r.stepSize,indexFunction:r.indexFunction}));
 assert.equal(r.terminal,'simulationComplete',label+' terminal callback');
 assert.equal(r.nativeStatus,'completed',label+' qualified run status');
 assert.equal(r.diagnostics.errors.length,0,label+' native runtime errors');
 assert.equal(r.diagnostics.truncation,0,label+' native truncation');
 assert.equal(r.diagnostics.undefinedBehavior,0,label+' undefined ray');
 assert.deepEqual(r.unexpected,[],label+' audit state bounded');
 assert.ok(r.internal.length>=10&&r.internal.length<limits.maxNativeCallbacks,label+' real native stepping callbacks');
 assert.ok(r.internal.every(k=>finitePoint(k)&&(!k.next||finitePoint(k.next))&&!k.undefinedBehavior),label+' finite native steps');
 assert.equal(r.hits.length,1,label+' exactly one recorded real detector crossing');
 assert.ok(r.hits.every(finitePoint),label+' detector coordinates finite');
}
test('pinned native GrinGlass loads a finite internal source and one passive detector without public schema admission',()=>{
 const r=nativeProbe();
 qualifiedResearch(r,'normalized sqrt-gradient');
 assert.ok(r.internal.some(e=>e.y < -.005),'ray must bend toward higher index in native y-down');
 assert.ok(r.hits[0].y < -.02,'detector crossing should respond to positive physical gradient');
 assert.equal(r.publicAuthoringSupported,false);
 const forged=structuredClone(saved);forged.physics.components[1].type='grin-dielectric';
 assert.throws(()=>core.compile(forged),/scope|support|type|invalid|expected/i);
 console.log('JEE_GRIN_NATIVE_RESEARCH '+JSON.stringify({status:r.nativeStatus,
  step:r.stepSize,steps:r.internal.length,nativeDetector:r.hits[0],
  firstNative:r.internal[0],lastNative:r.internal.at(-1),
  nativeImageDetected:false,originalQuestionSolved:false}));
});
test('constant-index native GRIN control stays straight and distinguishes the native gradient',()=>{
 const flat=nativeProbe({indexFunction:'1'}),grad=nativeProbe({indexFunction:gradientFn});
 qualifiedResearch(flat,'constant index');
 qualifiedResearch(grad,'gradient index');
 assert.ok(Math.abs(flat.hits[0].y)<1e-7,'constant-index ray should remain horizontal');
 assert.ok(grad.hits[0].y<flat.hits[0].y-.02,'real native gradients must affect the path');
 console.log('JEE_GRIN_CONST_CONTROL '+JSON.stringify({straight:flat.hits[0],graded:grad.hits[0],
  neitherIsNativeImage:true}));
});
test('Euler step-size sensitivity is measured, not mistaken for a converged solution',()=>{
 const steps=[.04,.02,.01],cases=steps.map(stepSize=>nativeProbe({stepSize}));
 for(const r of cases)qualifiedResearch(r,'step '+r.stepSize);
 const values=cases.map(r=>r.hits[0].y);
 assert.ok(values.every(Number.isFinite),'never emit undefined trajectory');
 assert.ok(Math.max(...values)-Math.min(...values)>.00001,
  'step-sensitive numerical position must not be relabelled exact/independent');
 console.log('JEE_GRIN_STEP_SWEEP '+JSON.stringify({stepSizes:steps,
  nativeDetectorY:values,nativeIncidentCallbacks:cases.map(r=>r.internal.length),
  referenceAnalyticalImage:null,certifiedErrorBound:null,
  model:'synthetic normalized 2D n(y)=sqrt(1+y/(1 mm))',
  originalSourceGeometryUnknown:true,solver:'pinned PhyDemo GrinGlass Euler'}));
});
