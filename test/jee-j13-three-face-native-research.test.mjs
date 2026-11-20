// FROZEN J13 research: native 3-face equilateral prism with internal TIR.
// We observe actual pinned PhyDemo calls. We neither prescribe ray path nor
// treat a merely completed near-critical native result as safe/qualified.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {prismEncounter} from '../src/triangular-prism.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const protocolBytes=readFileSync(new URL('../research/jee-j13-reflected-prism-native-v1/frozen-protocol.json',import.meta.url));
const frozen=JSON.parse(protocolBytes);
const sha=b=>createHash('sha256').update(b).digest('hex');
const RAD=Math.PI/180,DEG=180/Math.PI;
const near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,
 String(a)+' != '+String(b)+' tol '+tol);
const direction=r=>{const dx=r.p2.x-r.p1.x,dy=r.p1.y-r.p2.y,L=Math.hypot(dx,dy);
 return L>0&&Number.isFinite(L)?{x:dx/L,y:dy/L}:null;};
const cross=(a,b)=>a.x*b.y-a.y*b.x,dot=(a,b)=>a.x*b.x+a.y*b.y;
const angle=(v,n)=>Math.atan2(Math.abs(cross(v,n)),Math.abs(dot(v,n)))*DEG;
const root=resolve('test-artifacts/llm-authoring/jee-j13-reflected-native-v1');
mkdirSync(root,{recursive:true});
const dir=mkdtempSync(resolve(root,'attempt-'));
const save=(name,value)=>{
 const data=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
 const bytes=Buffer.from(data);
 writeFileSync(resolve(dir,name),bytes,{flag:'wx'});
 return {name,sha256:sha(bytes),length:bytes.length};
};
const threshold=Math.sqrt(7/3);
function fixture(c){
 const tr=c.translate||{x:0,y:0},v=frozen.geometry.vertices;
 const g={
  x1:v[0].x+tr.x,y1:v[0].y+tr.y,
  x2:v[1].x+tr.x,y2:v[1].y+tr.y,
  x3:v[2].x+tr.x,y3:v[2].y+tr.y,
  insideIndex:c.m,outsideIndex:1,partialReflection:false
 };
 const beam=frozen.geometry.beam;
 const p={lengthUnit:'mm',title:'J13 test-only native finite equilateral triangle',
  runPolicy:'preview-v1',components:[
  {id:'S',type:'point-source',
   parameters:{x:beam.startX+tr.x,y:beam.sourceY+tr.y,brightness:beam.brightness},
   emission:{mode:'single-ray',directionDeg:beam.directionDeg}},
  {id:'P',type:'triangular-prism',parameters:g}
 ]};
 const doc=prepareScene(p).document;
 assert.equal(doc.schemaVersion,8,'Existing public v8 native prism remains unchanged');
 const copy=structuredClone(doc);
 if(c.maxRayDepth!==undefined)copy.simulation.maxRayDepth=c.maxRayDepth;
 if(c.processedRayLimit!==undefined)copy.simulation.processedRayLimit=c.processedRayLimit;
 // The native limits change only numerical controls, not the physical scene.
 return {doc:copy,physical:p,prism:{type:'triangular-prism',parameters:g}};
}
function execute(c){
 const f=fixture(c),inputBytes=JSON.stringify(f.doc,null,2)+'\n';
 const input=save(c.id+'.input.json',inputBytes);
 const loaded=core.loadDocument(f.doc),scene=loaded.scene;
 const emitter=core.observeSourceSet(f.doc,scene,loaded.idMap);
 const ledger=core.observeInterfaceSet(f.doc,scene,loaded.idMap);
 const glass=scene.objs[loaded.idMap.get('P')],original=glass.onRayIncident;
 const seen=[];
 glass.onRayIncident=function(...args){
  if(seen.length>=64)throw Error('Native hit capture exceeded frozen finite cap');
  const incoming=direction(args[0]),nativePoint=args[2],
   hit=prismEncounter(f.prism,nativePoint,incoming);
  const result=original.apply(this,args);
  const outgoing=[
   ...(!result?.isAbsorbed?[args[0]]:[]),
   ...(result?.newRays||[])
  ].map(direction);
  seen.push({
   faceId:hit.faceId,invalid:hit.invalid===true,from:hit.from,
   nativePointYUp:{x:nativePoint.x,y:-nativePoint.y},
   incoming,outgoing,normal:hit.normal,incidentIndex:hit.incidentIndex,
   destinationIndex:hit.destinationIndex,
   incidenceAngleDeg:hit.normal?angle(incoming,hit.normal):null,
   returnFlags:{absorbed:result?.isAbsorbed===true,
    undefined:result?.isUndefinedBehavior===true,
    truncated:result?.isTruncation===true,children:result?.newRays?.length||0}
  });
  return result;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,
  f.doc.simulation.processedRayLimit);
 let terminal=null;
 for(const kind of ['simulationComplete','simulationStop'])sim.on(kind,()=>{terminal=kind;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(scene,sim,emitter,null,null,ledger,{nativeEvent:terminal});
 const status=core.classifyRun(terminal,diagnostics);
 const r=Math.asin(.5/c.m),margin=c.m*Math.sin(Math.PI/3-r)-1;
 const nativeFaces=ledger.byId.P.faces;
 const outcomes=seen.map(e=>({
  faceId:e.faceId,
  outcome:nativeFaces[e.faceId]?.first?.outcome||null
 }));
 const rawComplete=status==='completed'&&terminal==='simulationComplete'&&
  diagnostics.errors.length===0&&diagnostics.undefinedBehavior===0&&
  diagnostics.truncation===0;
 const thresholdSafe=Math.abs(margin)>1e-5;
 const expectedRoute=['face-12','face-31','face-23'];
 const observedRoute=seen.map(e=>e.faceId);
 const routeMatch=observedRoute.join(',')===expectedRoute.join(',');
 const upperTIR=nativeFaces['face-31']?.first?.outcome==='total-internal-reflection';
 const exitEvent=nativeFaces['face-23']?.first;
 const exitAngle=exitEvent?.transmittedAngleDeg??null;
 const qualifiedResearchWitness=rawComplete&&thresholdSafe&&margin>0&&
  routeMatch&&upperTIR&&Number.isFinite(exitAngle)&&
  Math.abs(exitAngle-30)<=1e-6&&seen.every(e=>e.invalid===false)&&
  seen.every(e=>e.returnFlags.undefined===false);
 const summary={id:c.id,control:c,sourceScenario:'added synthetic finite apparatus',
  derived:{
   criticalRelativeIndex:threshold,
   internalEntryDeg:r*DEG,upperTIRMarginDimensionless:margin,
   upperClass:margin>1e-5?'above-critical':margin< -1e-5?'below-critical':'numerically-uncertain',
   expectedGaussianIncidentDeg:30,expectedTransmittedAngleDeg:30,
   originalExteriorIndexKnown:false,originalIndexNumericallyDetermined:false
  },native:{terminal,status,rawComplete,sourceRayCount:1,
   actualFaceRoute:observedRoute,interfaceOutcomes:outcomes,
   trueUpperTIR:upperTIR,exitAngleFromBCNormalDeg:exitAngle,
   truncation:diagnostics.truncation,
   undefinedBehavior:diagnostics.undefinedBehavior,
   errorCount:diagnostics.errors.length,qualifiedResearchWitness,
   publicAuthoringExtensionAdded:false,originalQuestionSolved:false},
  actualCallbacks:seen,
  inputSha256:input.sha256};
 const report=save(c.id+'.report.json',summary);
 console.log('JEE_J13_THREE_FACE_NATIVE '+JSON.stringify({
  id:c.id,status,route:observedRoute,upperTIR,exitAngle,
  criticalMargin:margin,qualifiedResearchWitness,
  truncation:diagnostics.truncation,undefined:diagnostics.undefinedBehavior,
  sourceIsSynthetic:true
 }));
 return {...summary,input,report};
}
test('J13 research protocol and original source limitations are frozen before feasibility results',()=>{
 assert.equal(frozen.status,'pre-execution-frozen');
 assert.equal(frozen.baselineMain,'c4e436fca34c01b3ce63bd426dc71bd0daf1daa9');
 assert.equal(frozen.source.caseId,'J13');
 assert.equal(frozen.source.solutionsRead,false);
 assert.equal(frozen.studyCases.length,9);
 assert.equal(frozen.geometry.partialReflection,false);
 assert.equal(frozen.independentReference.wordSlightlyHasNoNumericalTolerance,true);
 assert.equal(frozen.independentReference.exteriorIndexUnknownMeansNoAbsoluteGlassIndex,true);
 near(frozen.independentReference.thresholdRelativeIndex,threshold,1e-15);
 assert.ok(threshold>1.5&&threshold<1.6);
});
test('all nine fixed native prism cases preserve real event evidence without creating a new public schema',()=>{
 const results=frozen.studyCases.map(execute);
 const get=id=>results.find(r=>r.id===id);
 assert.equal(results.length,9);
 assert.ok(results.every(r=>r.input.sha256&&r.report.sha256));
 for(const id of ['internal-tir-upper-then-lower',
  'above-critical-near-but-separated','translated-invariant']){
  const r=get(id);
  assert.equal(r.native.rawComplete,true,id);
  assert.equal(r.native.qualifiedResearchWitness,true,id);
  assert.deepEqual(r.native.actualFaceRoute,['face-12','face-31','face-23'],id);
  assert.equal(r.native.trueUpperTIR,true,id);
  near(r.native.exitAngleFromBCNormalDeg,30,1e-6);
 }
 for(const id of ['below-critical-upper-transmission','below-critical-near-but-separated']){
  const r=get(id);
  assert.equal(r.native.qualifiedResearchWitness,false,id);
  assert.equal(r.native.trueUpperTIR,false,id);
  assert.ok(r.derived.upperTIRMarginDimensionless<0);
 }
 for(const id of ['at-critical-ambiguous','near-critical-plus-micro']){
  const r=get(id);
  assert.equal(r.native.qualifiedResearchWitness,false,id);
  assert.equal(r.derived.upperClass,'numerically-uncertain',id);
 }
 for(const id of ['ray-depth-zero','processed-limit-one']){
  const r=get(id);
  assert.equal(r.native.qualifiedResearchWitness,false,id);
  assert.notEqual(r.native.status,'completed',id);
 }
 const report={format:'opticsim-jee-j13-three-face-research-report-v1',
  researchOnly:true,noProductionChanges:true,sourceScore:null,
  frozenProtocolCommit:'6fb6625453eb62c24d9d7b40d929b9cfb75d5596',
  protocolSha256:sha(protocolBytes),
  cases:results.map(x=>({id:x.id,native:x.native,derived:x.derived,input:x.input,report:x.report})),
  counts:{planned:9,attempted:results.length,
   complete:results.filter(x=>x.native.rawComplete).length,
   qualifiedTestOnlyWitness:results.filter(x=>x.native.qualifiedResearchWitness).length,
   unqualified:results.filter(x=>!x.native.qualifiedResearchWitness).length}};
 save('report.json',report);
});
