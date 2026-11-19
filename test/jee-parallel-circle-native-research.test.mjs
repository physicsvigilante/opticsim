// FROZEN, TEST-ONLY: real pinned PhyDemo Beam + CircleGlass feasibility.
// No canonical public schema, source interpretation or qualified observation
// is changed. We preserve exact raw native input, native events and errors.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {compileParallelBeam} from '../src/parallel-beam.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozenBytes=readFileSync(join(root,'research/jee-parallel-circle-native-v1/protocol.json'));
const frozen=JSON.parse(frozenBytes),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const archive=join(root,'test-artifacts/llm-authoring/jee-parallel-circle-native-v1');
mkdirSync(archive,{recursive:true});
const output=mkdtempSync(join(archive,'attempt-'));
const persist=(filename,obj)=>{
 const bytes=Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj,null,2)+'\n');
 writeFileSync(join(output,filename),bytes,{flag:'wx'});
 return {name:filename,sha256:sha(bytes),bytes:bytes.length};
};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const unit=ray=>{
 if(!ray?.p1||!ray?.p2)return null;
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,len=Math.hypot(dx,dy);
 return Number.isFinite(len)&&len>0?{x:dx/len,y:dy/len}:null;
};
const pos=p=>p?{x:p.x,y:-p.y}:null;
const numbersFinite=o=>o&&Object.values(o).every(Number.isFinite);
const evidence={format:'opticsim-jee-parallel-circle-native-raw-report-v1',
 protocolSha256:sha(frozenBytes),frozenProtocolCommit:'320b88287acd68cd948136b2d8643db636f2a3c4',
 baselineMain:frozen.baselineMain,pinnedPhyDemo:frozen.pinnedPhyDemo,
 canonicalAuthoringAvailable:false,publicQualified:false,
 sourceQuestionsSolved:false,independentReview:false,simulatorModified:false,
 cases:[],status:'running'};
function make(c){
 const o=frozen.circle,b=frozen.beam,d=frozen.detector,p=frozen.numerics;
 const shift=c.shift||{x:0,y:0};
 // The *only* public Opticsim contract used here is a separately valid v7
 // single-ray CircleGlass seed, which is never submitted as Beam evidence.
 // Any risky source/detector edits happen ONLY to raw native JSON.
 const seed={lengthUnit:'mm',runPolicy:'preview-v1',
   title:'Safe canonical v7 seed for separate unqualified circle Beam research',
   components:[
     {id:'S1',type:'point-source',parameters:{x:b.x,y:b.y,brightness:p.sourceBrightness},
       emission:{mode:'single-ray',directionDeg:0}},
     {id:'G1',type:'circular-dielectric',parameters:{...o}},
     {id:'D1',type:'ray-detector',parameters:{...d}}
   ]};
 const doc=prepareScene(seed).document;
 assert.equal(doc.schemaVersion,7);
 assert.equal(doc.upstreamCommit,frozen.pinnedPhyDemo);
 const compiled=core.compile(doc),raw=structuredClone(compiled.native);
 const nativeCircleIndex=compiled.idMap.get('G1');
 const source=compiled.idMap.get('S1'),detector=compiled.idMap.get('D1');
 const beam={x:(c.beamX??b.x)+shift.x,y:(c.beamY??b.y)+shift.y,
   width:c.beamWidth??b.width,directionDeg:c.directionDeg??b.directionDeg,
   brightness:p.sourceBrightness};
 raw.objs[source]=compileParallelBeam({type:'parallel-beam',parameters:beam});
 const circle={x:o.x+shift.x,y:o.y+shift.y,radius:c.radius??o.radius,
   insideIndex:c.insideIndex??o.insideIndex,outsideIndex:c.outsideIndex??o.outsideIndex,
   partialReflection:c.partialReflection??o.partialReflection};
 raw.objs[nativeCircleIndex]={
   type:'CircleGlass',p1:{x:circle.x,y:-circle.y},
   p2:{x:circle.x+circle.radius,y:-circle.y},
   refIndex:circle.insideIndex/circle.outsideIndex,partialReflect:circle.partialReflection
 };
 const screenX=(c.detectorX??d.x)+shift.x,screenY=(c.detectorY??d.y)+shift.y;
 raw.objs[detector].p1={x:screenX,y:-screenY-d.length/2};
 raw.objs[detector].p2={x:screenX,y:-screenY+d.length/2};
 if(c.family==='no-glass')raw.objs.splice(nativeCircleIndex,1);
 raw.rayModeDensity=c.rayDensity??p.rayDensity;
 raw.maxRayDepth=c.maxRayDepth??p.maxRayDepth;
 return {raw,metadata:{beam,circle,detector:{x:screenX,y:screenY,length:d.length},
   density:raw.rayModeDensity,processedRayLimit:c.processedRayLimit??p.processedRayLimit,
   sourceSchemaForSeed:doc.schemaVersion}};
}
function nativeExperiment(c){
 const {raw,metadata}=make(c);
 const input=persist(c.id+'.native-input.json',raw),emissions=[],interfaces=[],hits=[];
 let terminal=null,scene=null,sim=null,error=null;
 try{
   scene=core.loadNative(raw);
   const emitter=scene.objs[0],start=emitter.onSimulationStart;
   assert.equal(emitter.constructor.type,'Beam');
   emitter.onSimulationStart=function(...args){
     const result=start.apply(this,args),rays=result?.newRays||[];
     assert.ok(emissions.length+rays.length<=100,'Native sampled-source evidence exceeds cap');
     for(const r of rays)emissions.push({point:pos(r.p1),direction:unit(r),
       relativeBrightness:(r.brightness_s??0)+(r.brightness_p??0)});
     return result;
   };
   const circle=c.family==='no-glass'?null:scene.objs[1];
   if(circle){
     assert.equal(circle.constructor.type,'CircleGlass');
     const original=circle.onRayIncident;
     circle.onRayIncident=function(...args){
       assert.ok(interfaces.length<frozen.numerics.maxEvidenceEvents,
         'Raw native interface event evidence over capture cap');
       const point=pos(args[2]),incoming=unit(args[0]);
       const delta={x:point.x-metadata.circle.x,y:point.y-metadata.circle.y};
       const radius=Math.hypot(delta.x,delta.y),normal={
         x:delta.x/radius,y:delta.y/radius
       };
       const projected=incoming?dot(incoming,normal):null;
       const departing=projected>0;
       const incidentIndex=departing?metadata.circle.insideIndex:metadata.circle.outsideIndex;
       const destinationIndex=departing?metadata.circle.outsideIndex:metadata.circle.insideIndex;
       const result=original.apply(this,args);
       const primary=result?.isAbsorbed?null:unit(args[0]);
       const outgoing=[...(!result?.isAbsorbed?[args[0]]:[]),
         ...(result?.newRays||[])].map(unit);
       const outputDot=primary?dot(primary,normal):null;
       const reflected=primary&&projected*outputDot<0;
       const tir=result===undefined&&reflected;
       const snellResidual=incoming&&primary&&numbersFinite(normal)&&
         [incidentIndex,destinationIndex].every(Number.isFinite)?
         reflected?
          Math.max(Math.abs(Math.abs(dot(incoming,normal))-Math.abs(outputDot)),
            Math.abs(cross(incoming,normal)-cross(primary,normal))):
          Math.abs(incidentIndex*cross(incoming,normal)-
            destinationIndex*cross(primary,normal)):null;
       const event={point,incoming,normal,primary,outgoing,
         outsideSurfaceResidualMm:radius-metadata.circle.radius,
         incidenceCosine:projected,departing,incidentIndex,destinationIndex,
         nativeReturnedUndefined:result===undefined,
         nativeFlags:{absorbed:result?.isAbsorbed===true,
           undefinedBehavior:result?.isUndefinedBehavior===true,
           truncation:result?.isTruncation===true,childRays:result?.newRays?.length||0},
         reflected:!!reflected,tir:!!tir,snellResidual};
       interfaces.push(event);
       return result;
     };
   }
   const det=scene.objs.at(-1),nativeDetector=det.onRayIncident;
   assert.equal(det.constructor.type,'Detector');
   det.onRayIncident=function(...args){
     assert.ok(hits.length<frozen.numerics.maxEvidenceEvents,
       'Raw native detector event evidence over capture cap');
     hits.push({point:pos(args[2]),incoming:unit(args[0])});
     return nativeDetector.apply(this,args);
   };
   sim=new core.Simulator(scene,null,null,null,null,null,false,metadata.processedRayLimit);
   sim.on('simulationComplete',()=>terminal='simulationComplete');
   sim.on('simulationStop',()=>terminal='simulationStop');
   sim.updateSimulation();
 }catch(e){error=String(e?.stack||e);}
 const diag={
   terminal,error,sceneError:scene?.error||null,
   truncation:sim?.totalTruncation??null,
   undefinedBehavior:sim?.totalUndefinedBehavior??null,
   emitted:emissions.length,circleIncidents:interfaces.length,detectorHits:hits.length
 };
 const nativeComplete=terminal==='simulationComplete'&&!error&&!diag.sceneError&&
   diag.truncation===0&&diag.undefinedBehavior===0;
 const maxSurfaceResidualMm=Math.max(0,...interfaces.map(e=>
   Number.isFinite(e.outsideSurfaceResidualMm)?Math.abs(e.outsideSurfaceResidualMm):Infinity));
 const maxSnellResidual=Math.max(0,...interfaces.map(e=>
   Number.isFinite(e.snellResidual)?e.snellResidual:Infinity));
 const unclassified=interfaces.some(e=>!numbersFinite(e.point)||!numbersFinite(e.normal)||
   !Number.isFinite(e.incidenceCosine)||Math.abs(e.incidenceCosine)<frozen.numerics.normalIncidenceDotFloor||
   Math.abs(e.outsideSurfaceResidualMm)>1e-5||!Number.isFinite(e.snellResidual)||
   e.snellResidual>1e-6);
 const numericalRisk=['numerical-risk','inside-tir','fresnel','limit'].includes(c.family);
 const testedTrustworthy=nativeComplete&&!unclassified&&!numericalRisk;
 const aggregate={
   id:c.id,family:c.family,caseData:c,diagnostics:diag,nativeComplete,
   trustedResearchObservation:testedTrustworthy,
   numericalRisk,unclassified,maxSurfaceResidualMm,maxSnellResidual,
   actualNativeTIR:interfaces.filter(e=>e.tir).length,
   totalNativeReflections:interfaces.filter(e=>e.reflected).length,
   nativeTransmissions:interfaces.filter(e=>e.primary&&!e.reflected).length,
   caveat:'Raw research scene only; not canonical, qualified or original textbook solution'
 };
 const report=persist(c.id+'.native-report.json',{
   ...aggregate,inputSha256:input.sha256,metadata,emissions,interfaces,hits});
 evidence.cases.push({...aggregate,input,report});
 console.log('JEE_NATIVE_CIRCLE_BEAM '+JSON.stringify({
   id:c.id,status:nativeComplete?'completed':'not-complete',
   trust:testedTrustworthy,emitted:diag.emitted,circleIncidents:diag.circleIncidents,
   detectorHits:diag.detectorHits,nativeTIR:aggregate.actualNativeTIR,
   truncation:diag.truncation,undefined:diag.undefinedBehavior,error:!!error
 }));
 return {...aggregate,raw:{emissions,interfaces,hits}};
}
test('frozen v23 circle Beam feasibility does not change canonical public v7 or v19 admission',()=>{
 assert.equal(frozen.status,'pre-execution-frozen-test-only-protocol');
 assert.equal(frozen.cases.length,17);
 assert.equal(frozen.pinnedPhyDemo,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(frozen.numerics.maxRayDepth,8);
 const one=make(frozen.cases[0]);
 assert.deepEqual(one.raw.objs.map(x=>x.type),['Beam','CircleGlass','Detector']);
 const requested={lengthUnit:'mm',runPolicy:'preview-v1',components:[
  {id:'B1',type:'parallel-beam',parameters:{...frozen.beam,
    brightness:frozen.numerics.sourceBrightness}},
  {id:'G1',type:'circular-dielectric',parameters:{...frozen.circle}},
  {id:'D1',type:'ray-detector',parameters:{...frozen.detector}}
 ]};
 assert.throws(()=>prepareScene(requested),
  'The research substitution must not become a canonical Beam+CircleGlass scene');
});
test('pinned native CircleGlass matrix records real two-surface refraction, TIR and missed samples',()=>{
 const results=frozen.cases.map(nativeExperiment),by=id=>results.find(x=>x.id===id);
 assert.equal(results.length,17);
 assert.equal(by('baseline').diagnostics.emitted,4);
 assert.equal(by('baseline').diagnostics.circleIncidents,8,
   'Four actual rays should enter and leave the real circular boundary');
 assert.equal(by('baseline').nativeComplete,true);
 assert.equal(by('baseline').actualNativeTIR,0);
 for(const id of ['translated','right-to-left','radius80','index13','index20',
   'density04','width40','circle-miss','interior-source']){
  assert.equal(by(id).nativeComplete,true,id+' must be native-complete');
 }
 assert.equal(by('circle-miss').diagnostics.circleIncidents,0,
   'A missed transparent circle is not an opaque blocker');
 assert.equal(by('circle-miss').diagnostics.detectorHits,4);
 assert.equal(by('free-space').diagnostics.circleIncidents,0);
 assert.equal(by('free-space').diagnostics.detectorHits,4);
 assert.equal(by('density04').diagnostics.emitted,8);
 assert.equal(by('width40').diagnostics.emitted,8);
 assert.ok(by('interior-tir').actualNativeTIR>0,
   'At least one real inside-origin native ray must undergo TIR');
 assert.equal(by('processed-stop').diagnostics.terminal,'simulationStop');
 assert.equal(by('processed-stop').nativeComplete,false);
 assert.equal(by('depth-zero').nativeComplete,false);
 for(const id of ['near-tangent','exact-tangent']){
  assert.equal(by(id).trustedResearchObservation,false,
    'Tangent-risk native data cannot qualify despite terminal callbacks');
 }
 evidence.counts={planned:frozen.cases.length,executed:results.length,
   nativeComplete:results.filter(x=>x.nativeComplete).length,
   nativeIncomplete:results.filter(x=>!x.nativeComplete).length,
   consistentTrustedResearchCases:results.filter(x=>x.trustedResearchObservation).length,
   deliberatelyUntrusted:results.filter(x=>!x.trustedResearchObservation).length,
   actualTIRCases:results.filter(x=>x.actualNativeTIR>0).length};
 evidence.status='completed-raw-native-research';
 persist('report.json',evidence);
});
