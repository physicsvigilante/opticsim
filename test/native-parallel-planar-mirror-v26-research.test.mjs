// Test-only raw native Beam + PlaneGlass + Mirror feasibility for a versioned
// JEE-first return system. Public v19 canonical seed has NO Mirror. We append
// only a pinned native Mirror to a cloned native scene, never count that as
// qualified public authoring or create/redirect any ray.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {parallelBeamSamples} from '../src/parallel-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const protocolBytes=readFileSync(new URL('../evaluation/native-parallel-planar-mirror-v26/frozen-protocol.json',import.meta.url));
const frozen=JSON.parse(protocolBytes),origin=frozen.syntheticScene;
const root=resolve('test-artifacts/llm-authoring/native-parallel-mirror-v26');
mkdirSync(root,{recursive:true});
const out=mkdtempSync(resolve(root,'attempt-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const write=(name,value)=>{
 const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 writeFileSync(resolve(out,name),bytes,{flag:'wx'});
 return {name,sha256:sha(bytes),size:bytes.length};
};
const vec=r=>{
 const x=r.p2.x-r.p1.x,y=r.p1.y-r.p2.y,L=Math.hypot(x,y);
 return L>0&&Number.isFinite(L)?{x:x/L,y:y/L}:null;
};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const near=(x,y,t=1e-7)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=t,String(x)+' vs '+String(y));
function input(c){
 const dx=c.shiftX??0,dy=c.shiftY??0;
 const physical={lengthUnit:'mm',runPolicy:'preview-v1',components:[
  {id:'B',type:'parallel-beam',parameters:{
   x:origin.beam.x+dx,y:origin.beam.y+dy,width:origin.beam.width,
   directionDeg:c.beamDirectionDeg??origin.beam.directionDeg,
   brightness:origin.beam.brightness}},
  {id:'I',type:'planar-interface',parameters:{
   ...origin.interface,x:origin.interface.x+dx,y:origin.interface.y+dy,
   positiveIndex:c.insideIndex??origin.interface.positiveIndex,
   partialReflection:false}},
  {id:'D',type:'ray-detector',parameters:{
   ...origin.detector,x:origin.detector.x+dx,y:origin.detector.y+dy}}
 ]};
 const doc=prepareScene(physical).document;
 assert.equal(doc.schemaVersion,19,'Only reviewed old v19 seed may be canonically compiled');
 const prepared=core.compile(doc),raw=structuredClone(prepared.native);
 const beamIndex=prepared.idMap.get('B'),glassIndex=prepared.idMap.get('I'),
  detectorIndex=prepared.idMap.get('D');
 assert.deepEqual(raw.objs.map(x=>x.type),['Beam','PlaneGlass','Detector']);
 if(c.partialReflection===true)raw.objs[glassIndex].partialReflect=true;
 if(c.mirror){
  const x=origin.mirror.x+dx,y=origin.mirror.y+dy,
   half=(c.mirrorLength??origin.mirror.length)/2;
  raw.objs.push({type:'Mirror',p1:{x,y:-(y-half)},p2:{x,y:-(y+half)},filter:false});
 }
 raw.rayModeDensity=c.rayDensity??origin.numerical.rayDensity;
 raw.maxRayDepth=c.maxRayDepth??origin.numerical.maxRayDepth;
 return {doc,physical,raw,ids:{beamIndex,glassIndex,detectorIndex},
  processedRayLimit:c.processedRayLimit??origin.numerical.processedRayLimit};
}
function execute(c){
 const f=input(c),savedInput=write(c.id+'.raw-input.json',f.raw);
 const scene=core.loadNative(f.raw),events=[],emitted=[],mirrorIndex=f.raw.objs.length-1;
 const source=scene.objs[f.ids.beamIndex],start=source.onSimulationStart;
 source.onSimulationStart=function(...args){
  const r=start.apply(this,args);
  for(const ray of r?.newRays??[]){
   if(emitted.length>=128)throw Error('Emission research cap; no silent clipping');
   emitted.push({point:{x:ray.p1.x,y:-ray.p1.y},direction:vec(ray),
    brightness:(ray.brightness_s??0)+(ray.brightness_p??0)});
  }
  return r;
 };
 const observe=(index,id)=>{
  const optic=scene.objs[index],original=optic.onRayIncident;
  optic.onRayIncident=function(...args){
   if(events.length>=256)throw Error('Native research observer overflow; cannot qualify');
   const incoming=vec(args[0]),at={x:args[2].x,y:-args[2].y};
   const value=original.apply(this,args);
   const outgoing=value?.isAbsorbed?null:vec(args[0]);
   const children=(value?.newRays??[]).length;
   events.push({id,at,incoming,outgoing,children,
    absorbed:value?.isAbsorbed===true,undefined:value?.isUndefinedBehavior===true,
    truncation:value?.truncation??0,brightnessAfter:value?.isAbsorbed?null:
     (args[0].brightness_s??0)+(args[0].brightness_p??0)});
   return value;
  };
 };
 observe(f.ids.glassIndex,'I');observe(f.ids.detectorIndex,'D');
 if(c.mirror)observe(mirrorIndex,'M');
 const sim=new core.Simulator(scene,null,null,null,null,null,false,f.processedRayLimit);
 let terminal=null,error=null;
 try{sim.on('simulationComplete',()=>terminal='simulationComplete');
   sim.on('simulationStop',()=>terminal='simulationStop');
   sim.updateSimulation();
 }catch(e){error=String(e?.stack??e)}
 const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
 const classified=error?'failed':core.classifyRun(terminal,diagnostics);
 const complete=classified==='completed'&&terminal==='simulationComplete'&&
  diagnostics.truncation===0&&diagnostics.undefinedBehavior===0&&
  diagnostics.errors.length===0&&!error;
 const byId=id=>events.filter(e=>e.id===id);
 const mirrorResidual=byId('M').map(e=>{
  if(!e.incoming||!e.outgoing)return null;
  return Math.hypot(e.outgoing.x+e.incoming.x,e.outgoing.y-e.incoming.y);
 });
 const r={format:'opticsim-native-v26-raw-probe-v1',id:c.id,
  status:classified,terminal,complete,error,control:c,
  actualEmitted:emitted.length,actualInterfaces:byId('I').length,
  actualMirror:byId('M').length,actualDetectors:byId('D').length,
  diagnostics:{truncation:diagnostics.truncation,
   undefinedBehavior:diagnostics.undefinedBehavior,errors:diagnostics.errors,
   warnings:diagnostics.warnings},
  sampleInputs:parallelBeamSamples(f.physical.components[0].parameters,f.raw.rayModeDensity),
  trueNativeEmissions:emitted,
  mirrorReflectionResidual:mirrorResidual,events,
  inputSha256:savedInput.sha256,sourceIsSynthetic:true,
  canonicalPublicVersion:19,rawNativeResearchOnly:true,
  qualifiedPublicResults:false,originalQuestionSolved:false,nativeImageDetected:false};
 const report=write(c.id+'.raw-report.json',r);
 console.log('NATIVE_PARALLEL_PLANAR_MIRROR_V26_PROBE '+JSON.stringify({
  id:c.id,status:classified,terminal,emitted:r.actualEmitted,interfaces:r.actualInterfaces,
  mirror:r.actualMirror,detector:r.actualDetectors,
  truncation:r.diagnostics.truncation,undefined:r.diagnostics.undefinedBehavior,
  publicQualified:false
 }));
 return {report:r,input:savedInput,artifact:report};
}
test('v26 source and positive/negative controls were frozen before raw native execution',()=>{
 assert.equal(frozen.status,'frozen-before-code');
 assert.equal(frozen.productionBaseline,'34a85e21985d13b4663473c20d7adc1d93fc4953');
 assert.equal(frozen.testMatrix.length,10);
 assert.equal(frozen.proposedPublicProfile.schemaVersion,26);
 assert.equal(frozen.pinnedNative,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(frozen.firstOrderIndependentReference.expectedEmittedSamples,8);
});
test('all ten frozen raw PhyDemo controls observe real endpoints and retain incomplete numerical evidence',()=>{
 const runs=frozen.testMatrix.map(execute);
 assert.equal(runs.length,10);
 const id=v=>runs.find(r=>r.report.id===v).report;
 for(const label of ['baseline','translated','normal','higher-index','denser']){
  const r=id(label),density=r.control.rayDensity??.2,expected=density===.4?16:8;
  assert.equal(r.complete,true,JSON.stringify({label,error:r.error,diagnostics:r.diagnostics}));
  assert.equal(r.actualEmitted,expected);
  assert.equal(r.actualInterfaces,2*expected);
  assert.equal(r.actualMirror,expected);
  assert.equal(r.actualDetectors,2*expected);
  assert.ok(r.mirrorReflectionResidual.every(v=>v!==null&&v<1e-10));
  assert.equal(r.trueNativeEmissions.length,r.sampleInputs.length);
  for(const [i,v] of r.trueNativeEmissions.entries()){
   near(v.point.x,r.sampleInputs[i].x,1e-7);
   near(v.point.y,r.sampleInputs[i].y,1e-7);
  }
 }
 const no=id('mirror-absent');
 assert.equal(no.complete,true);
 assert.equal(no.actualMirror,0);
 assert.equal(no.actualInterfaces,no.actualEmitted);
 assert.equal(no.actualDetectors,no.actualEmitted);
 const clipped=id('near-mirror-corner');
 assert.equal(clipped.actualEmitted,8);
 assert.ok(clipped.actualMirror<8);
 assert.equal(clipped.qualifiedPublicResults,false);
 const rawFresnel=id('fresnel-on-raw');
 assert.equal(rawFresnel.qualifiedPublicResults,false);
 assert.ok(rawFresnel.actualEmitted>0);
 const depth=id('depth-zero');
 assert.equal(depth.complete,false);
 assert.ok(depth.diagnostics.truncation>0);
 const limit=id('processed-stop');
 assert.equal(limit.complete,false);
 assert.equal(limit.terminal,'simulationStop');
 const summary={format:'opticsim-native-parallel-planar-mirror-v26-evidence-v1',
  frozenProtocolCommit:'9c539084a56d5c533b3e8e93916315528222bb39',
  protocolSha256:sha(protocolBytes),sourceBaseline:frozen.productionBaseline,
  researchOnly:true,qualifiedPublicV26:false,
  cases:runs.map(x=>({id:x.report.id,complete:x.report.complete,
   nativeStatus:x.report.status,events:{
    emitted:x.report.actualEmitted,interfaces:x.report.actualInterfaces,
    mirror:x.report.actualMirror,detectors:x.report.actualDetectors},
   input:x.input,report:x.artifact})),
  counts:{planned:10,attempted:runs.length,
   complete:runs.filter(x=>x.report.complete).length,
   incomplete:runs.filter(x=>!x.report.complete).length}};
 write('report.json',summary);
});
