// Raw pinned-PhyDemo two-branch prism feasibility for the frozen J13/J14 gap.
// Test-only. No v22 authoring contract, public native qualification, or routed ray.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {compileParallelBeam} from '../src/parallel-beam.js';
import {prismEncounter} from '../src/triangular-prism.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const project=fileURLToPath(new URL('../',import.meta.url));
const frozenBytes=readFileSync(join(project,'research/jee-prism-two-branch-native-v1/protocol.json'));
const frozen=JSON.parse(frozenBytes);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const evidenceRoot=join(project,'test-artifacts/llm-authoring/jee-prism-two-branch-native-v1');
mkdirSync(evidenceRoot,{recursive:true});
const output=mkdtempSync(join(evidenceRoot,'attempt-'));
function save(name,value){
 const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 writeFileSync(join(output,name),bytes,{flag:'wx'});
 return {file:name,sha256:sha256(bytes),length:bytes.length};
}
const vec=(ray)=>{
 if(!ray?.p1||!ray?.p2)return null;
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,m=Math.hypot(dx,dy);
 return m>1e-15&&Number.isFinite(m)?{x:dx/m,y:dy/m}:null;
};
const point=p=>p?{x:p.x,y:-p.y}:null;
const power=r=>r?(r.brightness_s||0)+(r.brightness_p||0):null;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
function branchInvariant(incident,outgoing,normal,n1,n2){
 if(!incident||!outgoing||!normal||![n1,n2].every(Number.isFinite))
  return {classification:'unresolved',residual:null};
 const before=dot(incident,normal),after=dot(outgoing,normal);
 if(!Number.isFinite(before)||!Number.isFinite(after)||Math.abs(before)<1e-8||Math.abs(after)<1e-8)
  return {classification:'grazing-or-unresolved',residual:null};
 if(Math.sign(before)!==Math.sign(after))
  return {classification:'reflected',residual:Math.max(
   Math.abs(Math.abs(before)-Math.abs(after)),
   Math.abs(Math.abs(cross(incident,normal))-Math.abs(cross(outgoing,normal))))};
 return {classification:'transmitted',
  residual:Math.abs(n1*Math.abs(cross(incident,normal))-n2*Math.abs(cross(outgoing,normal)))};
}
function sceneInput(c){
 const o=c.offset||{x:0,y:0},g=structuredClone(frozen.geometry.prismYUp);
 const b=structuredClone(frozen.geometry.beamYUp);
 const front=structuredClone(frozen.geometry.directDetector);
 for(const key of ['x1','x2','x3'])g[key]+=o.x;
 for(const key of ['y1','y2','y3'])g[key]+=o.y;
 b.x+=o.x;b.y+=o.y;
 front.x+=o.x;front.y+=o.y;
 // Compile a CURRENTLY VALID v22 scene; Fresnel-on / backward detector and
 // out-of-aperture Beam are only inserted into a distinct RAW native clone.
 const physical={lengthUnit:'mm',runPolicy:'preview-v1',
  components:[
   {id:'B1',type:'parallel-beam',parameters:b},
   {id:'G1',type:'triangular-prism',parameters:g},
   {id:'D1',type:'ray-detector',parameters:front}
  ]};
 const initialText=JSON.stringify(physical);
 const doc=prepareScene(physical).document;
 assert.equal(doc.schemaVersion,22);
 assert.equal(doc.upstreamCommit,frozen.pinnedPhyDemoCommit);
 const compiled=core.compile(doc),raw=structuredClone(compiled.native);
 const indexB=compiled.idMap.get('B1'),indexG=compiled.idMap.get('G1');
 const indexD=compiled.idMap.get('D1');
 assert.deepEqual(raw.objs.map(x=>x.type),['Beam','Glass','Detector']);
 assert.equal(raw.objs[indexG].partialReflect,false);
 const beam={...b,y:c.beamY===undefined?b.y:c.beamY+o.y};
 raw.objs[indexB]=compileParallelBeam({id:'B1',type:'parallel-beam',parameters:beam});
 raw.objs[indexG].partialReflect=c.partialReflection===true;
 raw.objs[indexG].refIndex=(c.insideIndex??g.insideIndex)/g.outsideIndex;
 // A second passive native Detector is a RAW research addition, never a
 // modification to the public v22 compiler or canonical source document.
 const back=structuredClone(raw.objs[indexD]);
 back.p1.x=frozen.geometry.returnDetector.x+o.x;
 back.p2.x=frozen.geometry.returnDetector.x+o.x;
 raw.objs.push(back);
 raw.rayModeDensity=c.rayDensity??frozen.nativePolicy.rayDensity;
 raw.maxRayDepth=c.maxRayDepth??frozen.nativePolicy.maxRayDepth;
 assert.equal(JSON.stringify(physical),initialText,'Cannot rewrite the canonical seed');
 return {raw,physical,beam,glassParameters:{...g,insideIndex:c.insideIndex??g.insideIndex},
  processedRayLimit:c.processedRayLimit??frozen.nativePolicy.processedRayLimit};
}
function execute(c){
 const {raw,physical,beam,glassParameters,processedRayLimit}=sceneInput(c);
 const input=save(c.id+'.raw-input.json',raw);
 const events={emissions:[],glass:[],detectors:{direct:[],return:[]}};
 let scene=null,sim=null,terminal=null,error=null;
 try{
  scene=core.loadNative(raw);
  assert.deepEqual(scene.objs.map(x=>x.constructor.type),['Beam','Glass','Detector','Detector']);
  const emitter=scene.objs[0],onStart=emitter.onSimulationStart;
  emitter.onSimulationStart=function(...args){
   const r=onStart.apply(this,args);
   for(const ray of r?.newRays||[]){
    if(events.emissions.length>=frozen.nativePolicy.maxEvents)throw Error('Native emission evidence overflow');
    events.emissions.push({origin:point(ray.p1),direction:vec(ray),relativePower:power(ray)});
   }
   return r;
  };
  const glass=scene.objs[1],onGlass=glass.onRayIncident;
  glass.onRayIncident=function(...args){
   if(events.glass.length>=frozen.nativePolicy.maxEvents)throw Error('Native Glass evidence overflow');
   const incoming=vec(args[0]),at=point(args[2]);
   const hit=prismEncounter(glassParameters,args[2],incoming);
   const result=onGlass.apply(this,args);
   const outRays=[
    ...(!result?.isAbsorbed?[args[0]]:[]),
    ...(result?.newRays||[])
   ];
   const outgoing=outRays.map(ray=>({
    direction:vec(ray),relativePower:power(ray),
    invariant:branchInvariant(incoming,vec(ray),hit.normal,
      hit.incidentIndex,hit.destinationIndex)
   }));
   events.glass.push({at,incoming,faceId:hit.faceId,from:hit.from,
    incidentIndex:hit.incidentIndex,destinationIndex:hit.destinationIndex,
    normal:hit.normal,invalid:hit.invalid===true,outgoing,
    callback:{absorbed:result?.isAbsorbed===true,
      undefined:result?.isUndefinedBehavior===true,
      truncation:result?.isTruncation===true,
      childRayCount:result?.newRays?.length||0}});
   return result;
  };
  for(const [index,label] of [[2,'direct'],[3,'return']]){
   const detector=scene.objs[index],onIncident=detector.onRayIncident;
   detector.onRayIncident=function(...args){
    if(events.detectors[label].length>=frozen.nativePolicy.maxEvents)
     throw Error('Native detector evidence overflow');
    events.detectors[label].push({at:point(args[2]),incoming:vec(args[0]),
      relativePower:power(args[0])});
    return onIncident.apply(this,args);
   };
  }
  sim=new core.Simulator(scene,null,null,null,null,null,false,processedRayLimit);
  sim.on('simulationComplete',()=>terminal='simulationComplete');
  sim.on('simulationStop',()=>terminal='simulationStop');
  sim.updateSimulation();
 }catch(e){error=String(e?.stack||e);}
 const diagnostics={terminal,error,sceneError:scene?.error||null,
  simulatorError:sim?.error||null,truncation:sim?.totalTruncation??null,
  undefinedBehavior:sim?.totalUndefinedBehavior??null,
  processedRayCount:sim?.processedRayCount??null,
  emitted:events.emissions.length,glassHits:events.glass.length,
  directDetectorHits:events.detectors.direct.length,
  returnDetectorHits:events.detectors.return.length};
 const complete=terminal==='simulationComplete'&&diagnostics.error===null&&
  !diagnostics.sceneError&&!diagnostics.simulatorError&&
  diagnostics.truncation===0&&diagnostics.undefinedBehavior===0;
 const uncertainGlass=events.glass.some(x=>x.invalid||!x.faceId||
  x.outgoing.some(b=>b.invariant.residual===null||b.invariant.residual>1e-6));
 const faces=Object.fromEntries(['face-12','face-23','face-31'].map(k=>[
  k,events.glass.filter(x=>x.faceId===k).length]));
 const result={format:'opticsim-jee-prism-two-branch-native-raw-result-v1',
  id:c.id,kind:c.kind,control:c,physicalCanonicalSeed:physical,
  rawModification:'research-only: Glass.partialReflect, second return Detector, optional Beam/density/depth',
  beam,glassParameters,inputSha256:input.sha256,
  pinnedNativeComplete:complete,qualified:false,
  branchQualifiedForAuthoring:false,originalJeeJ14Solved:false,
  observedNativeImage:false,
  diagnostics,faces,uncertainGlass,events};
 const report=save(c.id+'.raw-report.json',result);
 console.log('JEE_PRISM_TWO_BRANCH_RAW '+JSON.stringify({id:c.id,complete,
  terminal,emitted:diagnostics.emitted,glass:diagnostics.glassHits,
  direct:diagnostics.directDetectorHits,returned:diagnostics.returnDetectorHits,
  truncation:diagnostics.truncation,undefined:diagnostics.undefinedBehavior,
  rawOnly:true}));
 return {id:c.id,input,report,diagnostics,complete,uncertainGlass,
  front:diagnostics.directDetectorHits,back:diagnostics.returnDetectorHits};
}
test('the frozen J13/J14 research protocol is distinct from rejected public Fresnel authoring',()=>{
 assert.equal(frozen.status,'pre-execution-frozen-protocol');
 assert.equal(frozen.baselineCommit,'bcf0151c004c94e179adb5ccc47e8d5f9851f23f');
 assert.equal(frozen.pinnedPhyDemoCommit,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(frozen.cases.length,10);
 assert.equal(frozen.sourceProvenance.solutionsRead,false);
 assert.equal(frozen.geometry.prismYUp.partialReflection,false);
 assert.equal(frozen.geometry.returnDetector.rawResearchOnly,true);
 const canonical=sceneInput(frozen.cases[0]).physical;
 assert.equal(prepareScene(canonical).document.schemaVersion,22);
 const fresnel=structuredClone(canonical);
 fresnel.components.find(x=>x.id==='G1').parameters.partialReflection=true;
 assert.throws(()=>prepareScene(fresnel),'Do not accidentally admit unqualified Fresnel branching to v22');
 const back=structuredClone(canonical);
 back.components.push({id:'D2',type:'ray-detector',
  parameters:structuredClone(frozen.geometry.returnDetector)});
 assert.throws(()=>prepareScene(back),'Backward detector is outside public v22 contract');
});
test('fixed raw Fresnel study runs every pinned native control and preserves all failure evidence',()=>{
 const evidence={format:'opticsim-jee-prism-two-branch-native-evidence-v1',
  protocolCommit:'b7db4ee0edf4b40098c0e4e44786baa178ccefbb',
  protocolSha256:sha256(frozenBytes),baselineCommit:frozen.baselineCommit,
  pin:frozen.pinnedPhyDemoCommit,
  nativeQualification:'RAW RESEARCH ONLY; all public results withheld',
  sourceAnswerCompleteness:false,sourceInterpretationIndependentlyGraded:false,
  cases:[],counts:null};
 for(const c of frozen.cases)evidence.cases.push(execute(c));
 evidence.counts={planned:frozen.cases.length,attempted:evidence.cases.length,
  genuinelyNativeComplete:evidence.cases.filter(x=>x.complete).length,
  incomplete:evidence.cases.filter(x=>!x.complete).length,
  directDetectorEvents:evidence.cases.reduce((n,x)=>n+x.front,0),
  returnDetectorEvents:evidence.cases.reduce((n,x)=>n+x.back,0)};
 assert.equal(evidence.counts.attempted,10);
 assert.ok(evidence.cases.every(x=>x.input.sha256&&x.report.sha256));
 assert.ok(evidence.cases.every(x=>x.diagnostics.terminal||x.diagnostics.error),
  'Every raw native control must terminate or record an actual error');
 assert.ok(evidence.cases.find(x=>x.id==='fresnel-off-baseline').diagnostics.emitted>=1,
  'Pin must emit the genuine finite Beam; empty evidence is not a positive feasibility check');
 assert.equal(evidence.cases.find(x=>x.id==='fresnel-off-miss').diagnostics.glassHits,0,
  'Outside-source miss cannot turn into a virtual prism collision');
 assert.equal(evidence.cases.find(x=>x.id==='fresnel-on-processed-stop').diagnostics.terminal,
  'simulationStop','Processed-ray limit is a native stop, never successful completion');
 save('report.json',evidence);
});
