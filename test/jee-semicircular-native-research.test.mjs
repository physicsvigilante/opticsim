// Frozen research-only native feasibility for J12's semicircular glass gap.
// No production scene is claimed to admit Glass arcs with a native Beam.
// Native PhyDemo owns emission, intersections and every outgoing ray.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {compileParallelBeam} from '../src/parallel-beam.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const protocolBytes=readFileSync(join(root,'research/jee-semicircular-native-v1/protocol.json'));
const frozen=JSON.parse(protocolBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const evidenceRoot=join(root,'test-artifacts/llm-authoring/jee-semicircular-native-v1');
mkdirSync(evidenceRoot,{recursive:true});
const outDir=mkdtempSync(join(evidenceRoot,'attempt-'));
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
  String(a)+' differs from '+String(b));
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const direction=ray=>{
  if(!ray?.p1||!ray?.p2)return null;
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,len=Math.hypot(dx,dy);
  return Number.isFinite(len)&&len>0?{x:dx/len,y:dy/len}:null;
};
const point=p=>p?{x:p.x,y:-p.y}:null;
const eventBudget=frozen.evidencePolicy?.maxEventCapture??256;
const output={format:'opticsim-jee-semicircular-native-evidence-v1',
  protocolSha256:sha(protocolBytes),protocolCommit:'3b9a08bbb01ae5db51fbdc0dea4aef5b64572d7e',
  nativePin:frozen.pinnedUpstream,baseline:frozen.engineBaseline,
  source:"synthetic research controls motivated by J12; no original-source numeric radius/aperture assumed",
  admittedCanonicalScene:false,observationsArePublicQualified:false,independentPhysicsReview:false,
  cases:[],status:'running'};
const stored=(name,content)=>{
  const filename=join(outDir,name),bytes=Buffer.from(content);
  writeFileSync(filename,bytes,{flag:'wx'});
  return {filename:name,sha256:sha(bytes),bytes:bytes.length};
};
function nativeInput(c){
  // Build only a *valid* v19 beam/detector canonical control. Construct
  // a separate raw, unqualified native research input thereafter.
  const request={lengthUnit:'mm',title:'Research native half-disc Glass',runPolicy:'preview-v1',
    components:[
      {id:'B1',type:'parallel-beam',parameters:{
        x:-150,y:0,width:20,directionDeg:0,brightness:frozen.numeric.beamBrightness}},
      {id:'D1',type:'ray-detector',parameters:{
        x:250,y:0,length:1200,orientationDeg:90}}
    ]};
  const baseline=prepareScene(request).document;
  assert.equal(baseline.schemaVersion,19);
  assert.equal(baseline.upstreamCommit,frozen.pinnedUpstream);
  const compiled=core.compile(baseline),raw=structuredClone(compiled.native);
  const translation=c.translate||{x:0,y:0},reflection=c.reflectX===true?-1:1;
  const beam={...c.beam,x:reflection*c.beam.x+translation.x,
    y:c.beam.y+translation.y,directionDeg:c.reflectX?180-c.beam.directionDeg:c.beam.directionDeg,
    brightness:frozen.numeric.beamBrightness};
  const emitter=compileParallelBeam({type:'parallel-beam',parameters:beam});
  const nativeDetector=structuredClone(raw.objs[compiled.idMap.get('D1')]);
  nativeDetector.p1.x=reflection*nativeDetector.p1.x+translation.x;
  nativeDetector.p2.x=reflection*nativeDetector.p2.x+translation.x;
  nativeDetector.p1.y-=translation.y;nativeDetector.p2.y-=translation.y;
  const original=frozen.nativeComponent.pathYUp;
  const glass={
    type:'Glass',path:original.map(v=>({x:reflection*v.x+translation.x,
      y:-(v.y+translation.y),arc:v.arc})),
    notDone:false,refIndex:(c.insideIndex??frozen.numeric.insideIndex)/frozen.numeric.outsideIndex,
    partialReflect:false};
  raw.objs=c.glass===false?[emitter,nativeDetector]:[emitter,glass,nativeDetector];
  raw.rayModeDensity=c.density??frozen.numeric.beamDensity;
  raw.maxRayDepth=c.maxRayDepth??frozen.numeric.maxRayDepth;
  return {raw,meta:{beam,glass:c.glass===false?null:glass,
    radiusMm:frozen.numeric.radiusMm,centreMm:{x:translation.x,y:translation.y},
    reflectX:c.reflectX===true,indices:{inside:c.insideIndex??frozen.numeric.insideIndex,
      outside:frozen.numeric.outsideIndex},
    density:raw.rayModeDensity,maxRayDepth:raw.maxRayDepth,
    processedRayLimit:c.processedRayLimit??frozen.numeric.processedRayLimit}};
}
function geometry(p,meta){
  const centre=meta.centreMm,r=meta.radiusMm;
  const seam=Math.min(Math.hypot(p.x-centre.x,p.y-centre.y-r),
    Math.hypot(p.x-centre.x,p.y-centre.y+r));
  if(seam<=.01)return {face:'joint-or-near-joint',normal:null,seamDistanceMm:seam};
  if(Math.abs(p.x-centre.x)<=1e-6)
    return {face:'flat',normal:{x:meta.reflectX?1:-1,y:0},seamDistanceMm:seam};
  const dr=Math.hypot(p.x-centre.x,p.y-centre.y);
  if(Math.abs(dr-r)<=1e-5)
    return {face:'curved',normal:{x:(p.x-centre.x)/dr,y:(p.y-centre.y)/dr},
      seamDistanceMm:seam};
  return {face:'unclassified',normal:null,seamDistanceMm:seam};
}
function evaluateIncident(e,meta){
  if(!e.incoming||!e.after||!e.geometry.normal||
      e.returnFlags.isUndefinedBehavior||e.returnFlags.isAbsorbed)
    return {kind:'unverified',deviation:null};
  const n=e.geometry.normal,inside=meta.indices.inside,outside=meta.indices.outside;
  const exit=dot(e.incoming,n)>0,n1=exit?inside:outside,n2=exit?outside:inside;
  const d1=dot(e.incoming,n),d2=dot(e.after,n);
  if(d1*d2<0){
    return {kind:n1*Math.abs(cross(e.incoming,n))>n2+1e-8?'total-internal-reflection':'native-reflection',
      deviation:Math.max(Math.abs(d1+d2),Math.abs(cross(e.incoming,n)-cross(e.after,n)))};
  }
  return {kind:'transmission',deviation:Math.abs(n1*Math.abs(cross(e.incoming,n))-
    n2*Math.abs(cross(e.after,n)))};
}
function run(c){
  const {raw,meta}=nativeInput(c),rawFile=stored(c.id+'.native-input.json',JSON.stringify(raw,null,2)+'\n');
  const emitted=[],incidents=[],detected=[];
  let event=null,error=null,sim=null,scene=null;
  try{
    scene=core.loadNative(raw);
    assert.equal(scene.objs.length,c.glass===false?2:3);
    const source=scene.objs[0],realStart=source.onSimulationStart;
    source.onSimulationStart=function(...args){
      const result=realStart.apply(this,args);
      const rays=result?.newRays??[];
      assert.ok(rays.length<=100,'Unbounded native Beam emission');
      for(const ray of rays)emitted.push({pointMm:point(ray.p1),direction:direction(ray),
        relativePower:(ray.brightness_s??0)+(ray.brightness_p??0)});
      return result;
    };
    if(c.glass!==false){
      const glass=scene.objs[1],original=glass.onRayIncident;
      assert.equal(glass.constructor.type,'Glass');
      glass.onRayIncident=function(...args){
        assert.ok(incidents.length<eventBudget,'Native Glass callback capture overflow');
        const p=point(args[2]),before=direction(args[0]),geom=geometry(p,meta);
        const ret=original.apply(this,args);
        const after=ret?.isAbsorbed?null:direction(args[0]);
        const flags={isAbsorbed:ret?.isAbsorbed===true,
          isUndefinedBehavior:ret?.isUndefinedBehavior===true,
          isTruncation:ret?.isTruncation===true,newRayCount:ret?.newRays?.length??0};
        const e={pointMm:p,incoming:before,after,geometry:geom,returnFlags:flags,
          reflectedBranches:(ret?.newRays||[]).map(direction)};
        e.physics=evaluateIncident(e,meta);
        incidents.push(e);
        return ret;
      };
    }
    const detector=scene.objs.at(-1),original=detector.onRayIncident;
    detector.onRayIncident=function(...args){
      assert.ok(detected.length<eventBudget,'Native detector capture overflow');
      detected.push({pointMm:point(args[2]),incoming:direction(args[0])});
      return original.apply(this,args);
    };
    sim=new core.Simulator(scene,null,null,null,null,null,false,meta.processedRayLimit);
    sim.on('simulationComplete',()=>event='simulationComplete');
    sim.on('simulationStop',()=>event='simulationStop');
    sim.updateSimulation();
  }catch(e){error=String(e?.stack||e?.message||e);}
  const diagnostics={event,error,sceneError:scene?.error??null,
    totalTruncation:sim?.totalTruncation??null,
    totalUndefinedBehavior:sim?.totalUndefinedBehavior??null,
    emitted:emitted.length,glassIncidents:incidents.length,detectorHits:detected.length};
  const validNative=event==='simulationComplete'&&!error&&!diagnostics.sceneError&&
    diagnostics.totalTruncation===0&&diagnostics.totalUndefinedBehavior===0;
  const trustworthy=validNative&&!incidents.some(e=>['joint-or-near-joint','unclassified'].includes(e.geometry.face)||
    e.physics.kind==='unverified'||e.physics.deviation>1e-5);
  const observed={flat:incidents.filter(e=>e.geometry.face==='flat').length,
    curved:incidents.filter(e=>e.geometry.face==='curved').length,
    joints:incidents.filter(e=>e.geometry.face==='joint-or-near-joint').length,
    unclassified:incidents.filter(e=>e.geometry.face==='unclassified').length,
    transmissions:incidents.filter(e=>e.physics.kind==='transmission').length,
    totalInternalReflections:incidents.filter(e=>e.physics.kind==='total-internal-reflection').length,
    otherReflections:incidents.filter(e=>e.physics.kind==='native-reflection').length,
    unverified:incidents.filter(e=>e.physics.kind==='unverified').length,
    maxInvariantDeviation:Math.max(0,...incidents.map(e=>e.physics.deviation??0))};
  const record={caseId:c.id,family:c.family,syntheticCase:c,
    nativeFile:rawFile,nativeMeta:meta,diagnostics,observed,validNative,trustworthy,
    researchWarning:'Not a canonical authorable/qualified opticsim model; no original J12 solved claim',
    emissions:emitted,glassEvents:incidents,detectorEvents:detected};
  const resultFile=stored(c.id+'.native-report.json',JSON.stringify(record,null,2)+'\n');
  output.cases.push({id:c.id,family:c.family,nativeFile:rawFile,reportFile:resultFile,
    ...diagnostics,observed,validNative,trustworthy});
  writeFileSync(join(outDir,'index-live.json'),JSON.stringify(output,null,2)+'\n');
  console.log('JEE_SEMICIRCLE_NATIVE '+JSON.stringify({id:c.id,event,
    emitted:emitted.length,glass:incidents.length,detector:detected.length,
    ...observed,truncation:diagnostics.totalTruncation,undefined:diagnostics.totalUndefinedBehavior,
    validNative,trustworthy,exception:!!error}));
  return record;
}
test('frozen test-only arc experiment never expands canonical v19 authoring',()=>{
  assert.equal(frozen.format,'opticsim-jee-semicircle-native-feasibility-v1');
  assert.equal(frozen.status,'frozen-test-only-protocol');
  assert.equal(frozen.cases.length,15);
  assert.equal(frozen.nativeComponent.type,'Glass');
  assert.equal(frozen.nativeComponent.pathYUp[1].arc,true);
  assert.equal(frozen.numeric.maxRayDepth,8);
  assert.equal(frozen.numeric.processedRayLimit,10000);
  const baseline=prepareScene({lengthUnit:'mm',components:[
    {id:'B1',type:'parallel-beam',parameters:{x:-150,y:0,width:20,directionDeg:0,brightness:.08}},
    {id:'D1',type:'ray-detector',parameters:{x:250,y:0,orientationDeg:90,length:1200}}
  ]}).document;
  assert.equal(baseline.schemaVersion,19);
  const forged=structuredClone(baseline);
  forged.physics.components.push({id:'G1',type:'Glass',parameters:{}});
  assert.throws(()=>core.compile(forged),'Glass must never become public authorable by this study');
});
test('pinned native Beam + half-disk Glass feasibility preserves actual event order and Snell constraints',()=>{
  for(const c of frozen.cases){
    const r=run(c),n=r.diagnostics.emitted;
    if(c.family==='core'||c.family==='index-control'||c.family==='sampling-control'||c.family==='geometry-control'||c.family==='off-axis-control'){
      assert.equal(r.diagnostics.event,'simulationComplete',c.id);
      assert.equal(r.validNative,true,c.id);
      assert.equal(r.trustworthy,true,c.id);
      assert.equal(r.observed.flat,n,c.id+' must actually enter finite flat diameter');
      assert.equal(r.observed.curved,n,c.id+' must actually exit through true arc');
      assert.equal(r.observed.transmissions,n*2,c.id+' transmitted through two real faces');
      assert.equal(r.diagnostics.detectorHits,n,c.id);
      assert.ok(r.observed.maxInvariantDeviation<1e-6,c.id+' native Snell mismatch');
    }else if(c.family==='no-hit-control'||c.family==='free-space-control'){
      assert.equal(r.diagnostics.event,'simulationComplete',c.id);
      assert.equal(r.validNative,true,c.id);
      assert.equal(r.diagnostics.glassIncidents,0,c.id);
      assert.equal(r.diagnostics.detectorHits,n,c.id);
    }else if(c.family==='tir-probe'){
      assert.ok(r.observed.totalInternalReflections>0,c.id+' needs actual reflected native rays');
      assert.ok(!r.diagnostics.error,c.id+' native runtime error');
      // Completion/truncation is reported as observed, never silently fixed.
    }else if(c.id==='processed-stop'){
      assert.equal(r.diagnostics.event,'simulationStop');
      assert.equal(r.validNative,false);
    }else if(c.id==='depth-zero'){
      assert.equal(r.validNative,false,'Depth-exhausted rays must not be reported complete');
    }else if(c.family==='seam-risk'){
      // Existing public scopes have no proven arc/diameter join clearance.
      // Preserve raw evidence and do not certify the outcome by mere completion.
      assert.ok(r.diagnostics.event||r.diagnostics.error);
    }else throw Error('Unknown frozen research case: '+c.id);
  }
  output.status='executed-native-research';
  output.counts={planned:frozen.cases.length,executed:output.cases.length,
    nativeCompleted:output.cases.filter(c=>c.validNative).length,
    incompleteOrError:output.cases.filter(c=>!c.validNative).length};
  assert.equal(output.cases.length,frozen.cases.length);
  stored('report.json',JSON.stringify(output,null,2)+'\n');
});
