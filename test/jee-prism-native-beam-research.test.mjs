// Test-only native feasibility: one finite native Beam and one true pinned
// Glass triangle. NEVER a canonical authoring expansion, observed image, or
// original JEE solution. Full raw native inputs and callbacks are preserved.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {compileParallelBeam} from '../src/parallel-beam.js';
import {prismEncounter} from '../src/triangular-prism.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const protocolBytes=readFileSync(join(root,'research/jee-prism-beam-native-v1/protocol.json'));
const protocol=JSON.parse(protocolBytes);
const hash=b=>createHash('sha256').update(b).digest('hex');
const artifacts=join(root,'test-artifacts/llm-authoring/jee-native-prism-beam-v1');
mkdirSync(artifacts,{recursive:true});
const output=mkdtempSync(join(artifacts,'attempt-'));
const saved=(name,value)=>{
 const data=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
 const bytes=Buffer.from(data);
 writeFileSync(join(output,name),bytes,{flag:'wx'});
 return {path:name,sha256:hash(bytes),bytes:bytes.length};
};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dir=ray=>{
 const vx=ray.p2.x-ray.p1.x,vy=ray.p1.y-ray.p2.y,l=Math.hypot(vx,vy);
 return l>0&&Number.isFinite(l)?{x:vx/l,y:vy/l}:null;
};
const pos=p=>p?{x:p.x,y:-p.y}:null;
const invariant=(incident,outgoing,n,ni,no)=>{
 if(!incident||!outgoing||!n||![n.x,n.y,ni,no].every(Number.isFinite))return null;
 const projection0=dot(incident,n),projection1=dot(outgoing,n);
 if(!(Math.abs(projection0)>1e-10&&Math.abs(projection1)>1e-10))return null;
 const reflect=Math.sign(projection0)!==Math.sign(projection1);
 return reflect?{branch:'reflection',error:Math.max(
   Math.abs(Math.abs(projection0)-Math.abs(projection1)),
   Math.abs(Math.abs(cross(incident,n))-Math.abs(cross(outgoing,n)))
 )}:{branch:'transmission',error:Math.abs(ni*Math.abs(cross(incident,n))-
   no*Math.abs(cross(outgoing,n)))};
};
const evidence={format:'opticsim-jee-prism-beam-raw-native-report-v1',
  frozenProtocolCommit:'35bb77e3583f67ca9750d8f38bb77a575b230686',
  frozenProtocolSha256:hash(protocolBytes),engineBaseline:protocol.baseline,
  nativePin:protocol.pinnedUpstream,notCanonicalAuthoring:true,
  qualifiedNativeMeasurements:false,sourceQuestionsSolved:false,
  independentPhysicsReview:false,simulatorModified:false,
  cases:[],status:'running'};
function nativeCase(c){
 const seed=protocol.geometry,pin=protocol.nativePolicy;
 const shift=c.offset||{x:0,y:0};
 const vertices=seed.triangularGlassPathYUp.map(v=>({x:v.x+shift.x,y:v.y+shift.y}));
 if(c.kind==='winding')vertices.reverse();
 const params=Object.fromEntries(vertices.flatMap((v,i)=>[
   ['x'+(i+1),v.x],['y'+(i+1),v.y]]));
 Object.assign(params,{insideIndex:c.insideIndex??seed.insideIndex,
  outsideIndex:seed.outsideIndex,partialReflection:c.partialReflect??seed.partialReflect});
 const glass={id:'G1',type:'triangular-prism',parameters:params};
 const detector={id:'D1',type:'ray-detector',parameters:{
   x:seed.detector.x+shift.x,y:seed.detector.y+shift.y,
   orientationDeg:90,length:seed.detector.length}};
 const physical={lengthUnit:'mm',title:'Research only: finite native prism Beam',
  runPolicy:'preview-v1',components:[
  {id:'S1',type:'point-source',parameters:{x:seed.beam.x+shift.x,y:seed.beam.y+shift.y,
    brightness:pin.brightness},
   emission:{mode:'single-ray',directionDeg:seed.beam.directionDeg}},
  glass,detector]};
 const inputJSON=JSON.stringify(physical);
 const validV8=prepareScene(physical).document;
 assert.equal(validV8.schemaVersion,8,'Start from an already canonical Prism+SingleRay');
 assert.equal(validV8.upstreamCommit,protocol.pinnedUpstream);
 const compiled=core.compile(validV8),native=structuredClone(compiled.native);
 const beamParams={x:seed.beam.x+shift.x,y:(c.beamY??seed.beam.y)+shift.y,
   width:c.beamWidth??seed.beam.width,
   directionDeg:seed.beam.directionDeg,brightness:pin.brightness};
 const sourceId=compiled.idMap.get('S1'),glassId=compiled.idMap.get('G1');
 native.objs[sourceId]=compileParallelBeam({id:'B1',type:'parallel-beam',parameters:beamParams});
 if(c.kind==='no-glass')native.objs.splice(glassId,1);
 native.rayModeDensity=c.rayDensity??pin.rayDensity;
 native.maxRayDepth=c.maxRayDepth??pin.maxRayDepth;
 assert.equal(JSON.stringify(physical),inputJSON,'Never rewrite original research physical control');
 return {native,control:{physical,beamParams,indices:{inside:params.insideIndex,
   outside:params.outsideIndex},detector:detector.parameters,
   canonicalBaseSchema:validV8.schemaVersion},glass,
   processedRayLimit:c.processedRayLimit??pin.processedRayLimit};
}
function execute(c){
 const setup=nativeCase(c),storedInput=saved(c.id+'.raw-input.json',setup.native);
 let scene=null,sim=null,terminal=null,error=null;
 const emissions=[],glassEvents=[],detectorEvents=[];
 try{
   scene=core.loadNative(setup.native);
   const src=scene.objs[0],originalStart=src.onSimulationStart;
   src.onSimulationStart=function(...args){
     const result=originalStart.apply(this,args);
     const rays=result?.newRays||[];
     assert.ok(rays.length<=100,'Unbounded native emission evidence is refused');
     for(const ray of rays)emissions.push({p1:pos(ray.p1),direction:dir(ray),
       relativePower:(ray.brightness_s||0)+(ray.brightness_p||0)});
     return result;
   };
   const glass=c.kind==='no-glass'?null:scene.objs[1];
   if(glass){
     assert.equal(glass.constructor.type,'Glass');
     const original=glass.onRayIncident;
     glass.onRayIncident=function(...args){
       assert.ok(glassEvents.length<protocol.nativePolicy.maxEvidenceEvents,
         'Native Glass event capture overflow is not a completed report');
       const point=pos(args[2]),incoming=dir(args[0]);
       const encounter=prismEncounter(setup.glass,args[2],incoming);
       const result=original.apply(this,args);
       const primary=result?.isAbsorbed?null:dir(args[0]);
       const outgoing=[...(!result?.isAbsorbed?[args[0]]:[]),
         ...(result?.newRays||[])].map(dir);
       const n=encounter.normal;
       const physics=invariant(incoming,primary,n,encounter.incidentIndex,
         encounter.destinationIndex);
       glassEvents.push({point,incoming,faceId:encounter.faceId,
         from:encounter.from,incidentIndex:encounter.incidentIndex,
         destinationIndex:encounter.destinationIndex,normal:n,
         invalid:encounter.invalid===true,primary,outgoing,physics,
         nativeReturn:{isAbsorbed:result?.isAbsorbed===true,
           isUndefinedBehavior:result?.isUndefinedBehavior===true,
           isTruncation:result?.isTruncation===true,
           childRays:result?.newRays?.length||0}});
       return result;
     };
   }
   const detector=scene.objs.at(-1),original=detector.onRayIncident;
   detector.onRayIncident=function(...args){
     assert.ok(detectorEvents.length<protocol.nativePolicy.maxEvidenceEvents,
       'Detector event capture overflow is not a completed report');
     detectorEvents.push({point:pos(args[2]),incoming:dir(args[0])});
     return original.apply(this,args);
   };
   sim=new core.Simulator(scene,null,null,null,null,null,false,setup.processedRayLimit);
   sim.on('simulationComplete',()=>terminal='simulationComplete');
   sim.on('simulationStop',()=>terminal='simulationStop');
   sim.updateSimulation();
 }catch(e){error=String(e?.stack||e);}
 const diagnostics={
   terminal,error,sceneError:scene?.error||null,simError:sim?.error||null,
   truncation:sim?.totalTruncation??null,undefinedBehavior:sim?.totalUndefinedBehavior??null,
   processed:sim?.processedRayCount??null,emitted:emissions.length,
   glassIncidents:glassEvents.length,detectorCrossings:detectorEvents.length
 };
 const nativeComplete=terminal==='simulationComplete'&&!error&&!diagnostics.sceneError&&
   !diagnostics.simError&&diagnostics.truncation===0&&diagnostics.undefinedBehavior===0;
 const unclassified=glassEvents.filter(e=>e.invalid||!e.faceId||!e.physics);
 const faceCounts=Object.fromEntries(['face-12','face-23','face-31'].map(face=>[
   face,glassEvents.filter(e=>e.faceId===face).length]));
 const unverified=c.kind==='risk'||unclassified.length>0||
   glassEvents.some(e=>e.physics?.error>1e-6);
 const trustworthy=nativeComplete&&!unverified&&c.kind!=='fresnel';
 const summary={id:c.id,kind:c.kind,assumptions:c,diagnostics,nativeComplete,
   trustworthy,faces:faceCounts,unclassified:unclassified.length,
   transmittedPrimary:glassEvents.filter(e=>e.physics?.branch==='transmission').length,
   reflectedPrimary:glassEvents.filter(e=>e.physics?.branch==='reflection').length,
   nativeUndefinedCallbacks:glassEvents.filter(e=>e.nativeReturn.isUndefinedBehavior).length,
   maxPrimaryInvariantResidual:Math.max(0,...glassEvents.map(e=>e.physics?.error??0)),
   caveat:'Test-only native Glass+Beam; no canonical public scene or JEE solution'};
 const completeReport={...summary,nativeInputSha256:storedInput.sha256,control:setup.control,
   emissions,glassEvents,detectorEvents};
 const storedReport=saved(c.id+'.raw-report.json',completeReport);
 evidence.cases.push({...summary,input:storedInput,report:storedReport});
 console.log('JEE_NATIVE_PRISM_BEAM '+JSON.stringify({id:c.id,
   event:terminal,status:nativeComplete?'native-complete':'native-incomplete',
   trustworthy,emitted:emissions.length,glass:glassEvents.length,
   detector:detectorEvents.length,faces:faceCounts,undefined:diagnostics.undefinedBehavior,
   truncated:diagnostics.truncation,error:!!error}));
 return completeReport;
}
test('frozen JEE prism Beam research does not admit an unqualified public composition',()=>{
 assert.equal(protocol.status,'pre-execution-frozen-protocol');
 assert.equal(protocol.cases.length,14);
 assert.equal(protocol.pinnedUpstream,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(protocol.nativePolicy.maxRayDepth,8);
 const v=protocol.geometry.triangularGlassPathYUp;
 assert.equal(v.length,3);
 const forged={lengthUnit:'mm',runPolicy:'preview-v1',components:[
   {id:'B1',type:'parallel-beam',parameters:{...protocol.geometry.beam,
      brightness:protocol.nativePolicy.brightness}},
   {id:'G1',type:'triangular-prism',parameters:{
      x1:v[0].x,y1:v[0].y,x2:v[1].x,y2:v[1].y,x3:v[2].x,y3:v[2].y,
      insideIndex:1.5,outsideIndex:1,partialReflection:false}}]};
 assert.throws(()=>prepareScene(forged),'new combined Beam/prism model is NOT yet authorable');
});
test('frozen native Glass+Beam matrix preserves raw finite-boundary events and reports all failures',()=>{
 const records=protocol.cases.map(execute);
 assert.equal(records.length,14);
 const baseline=records[0];
 assert.equal(baseline.diagnostics.emitted,4,'20-mm native Beam at density 0.2 emits four rays');
 assert.ok(baseline.diagnostics.glassIncidents>=4,'Real finite native prism intersects at least four rays');
 assert.ok(baseline.diagnostics.terminal==='simulationComplete','baseline must actually finish native execution');
 assert.equal(records.find(x=>x.id==='no-glass').diagnostics.glassIncidents,0);
 for(const r of records){
   assert.equal(r.control.canonicalBaseSchema,8);
   assert.ok(r.diagnostics.error===null||typeof r.diagnostics.error==='string');
   if(r.kind==='limit'&&r.id==='processed-stop')
     assert.equal(r.diagnostics.terminal,'simulationStop');
   if(r.kind==='risk')assert.equal(r.trustworthy,false,'a near-vertex test is never certified by mere completion');
   if(r.trustworthy)assert.ok(r.glassEvents.every(e=>e.physics?.error<=1e-6),
      'A trustworthy event cannot violate the independent Snell or reflection invariant');
 }
 evidence.status='executed-raw-native-test-only';
 evidence.counts={planned:14,attempted:records.length,
   nativeComplete:records.filter(x=>x.nativeComplete).length,
   incompleteOrError:records.filter(x=>!x.nativeComplete).length,
   eventConsistent:records.filter(x=>x.trustworthy).length,
   vertexRiskUncertified:records.filter(x=>x.kind==='risk'&&!x.trustworthy).length};
 saved('report.json',evidence);
});
