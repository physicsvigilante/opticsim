// PRE-REGISTERED HELD-OUT RESEARCH ONLY: ordinary OFF vs Stage-1 ON vs
// separately tapped Stage-1 ON native profiles under new rigid geometry.
// No production optics or native rewrite. TAP is NOT observer-neutral.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {createNativeFiniteHitDiagnostic} from '../../src/native-finite-hit-diagnostic.js';
import {FINITE_HIT_CAP,auditRecordedFiniteHit} from '../../src/finite-hit-exact.js';
import {polygonFaces} from '../../src/polygon-dielectric.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const self=fileURLToPath(import.meta.url);
const sha=s=>createHash('sha256').update(s).digest('hex');
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const base='50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518';
const protocolCommit='3bd989e17ed47932f218a4b339158d59647c9fb2';
const index={inside:1.6,outside:1.3};
const critical=Math.asin(index.outside/index.inside)*180/Math.PI;
const wanted=[{id:'native-finite-risk',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
const geom=[{x:-3000,y:-1000},{x:3000,y:-1000},{x:3000,y:0},{x:-3000,y:0}];
const turn=(p,deg)=>{const a=deg*Math.PI/180;return {
 x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)};};
const place=(p,t={})=>{const q=turn(p,t.deg||0);return {
 x:q.x+(t.dx||0),y:q.y+(t.dy||0)};};
function caseInput(id,theta,t={}){
 const vertices=geom.map(q=>place(q,t)),start=place({x:0,y:-100},t);
 const points=Object.fromEntries(vertices.flatMap((q,i)=>[['x'+(i+1),q.x],['y'+(i+1),q.y]]));
 return {id,regime:'high-to-low-index',angleDeg:theta,authored:{
  title:'Preregistered held-out synthetic native profiles '+id,
  lengthUnit:'mm',runPolicy:'preview-v1',components:[
   {id:'S1',type:'point-source',parameters:{x:start.x,y:start.y,brightness:1},
    emission:{mode:'single-ray',directionDeg:90-theta+(t.deg||0)}},
   {id:'G1',type:'polygon-dielectric',parameters:{...points,
    insideIndex:index.inside,outsideIndex:index.outside,partialReflection:false}}
  ]}};
}
function inputs(){
 const cases=[
  caseInput('subcritical-tilt-m23',critical-7,{deg:-23,dx:-350,dy:220}),
  caseInput('supercritical-tilt-p61',critical+7,{deg:61,dx:130,dy:80}),
  caseInput('critical-shift-neg',critical,{dx:-380,dy:260}),
  caseInput('critical-tilt-m23',critical,{deg:-23}),
  caseInput('critical-tilt-p61-shift',critical,{deg:61,dx:120,dy:-220}),
  caseInput('critical-tilt-p14-shift',critical,{deg:14,dx:-170,dy:330})
 ];
 return cases.map(c=>{const document=prepareScene(c.authored).document;
  assert.equal(document.schemaVersion,9);const saved=serializeSave(document);
  return {...c,document,sceneSha256:sha(saved)};});
}
function pin(){
 assert.ok(process.version.startsWith('v24.'),'Node 24 required');
 const vendor=resolve(root,'vendor/ray-optics');
 assert.equal(execFileSync('git',['-C',vendor,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),UPSTREAM);
 assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],
  {encoding:'utf8'}).trim(),'','Pinned native vendor must remain clean');
}
const complete=s=>['completed','completed-with-warnings'].includes(s);
function project(status,error,d){
 const meter=d?.interfacesById?.G1??null;
 return {status,completed:complete(status),error:error??null,
  errors:d?.errors??[],warnings:d?.warnings??[],
  processed:d?.processed??null,truncation:d?.truncation??null,
  undefinedBehavior:d?.undefinedBehavior??null,
  emitted:d?.emitted??null,emissionsById:d?.emissionsById??null,
  detectorsById:d?.detectorsById??null,
  glass:meter?{interactions:meter.interactions,
   transmitted:meter.transmitted,reflected:meter.reflected,
   totalInternalReflections:meter.totalInternalReflections,
   invalidObservations:meter.invalidObservations,
   first:meter.first?{
    outcome:meter.first.outcome,from:meter.first.from,faceId:meter.first.faceId??null,
    incidentIndex:meter.first.incidentIndex,destinationIndex:meter.first.destinationIndex,
    incidentAngleDeg:meter.first.incidentAngleDeg,transmittedAngleDeg:meter.first.transmittedAngleDeg??null
   }:null,
   faces:Object.fromEntries(Object.entries(meter.faces||{}).map(([k,v])=>[k,{
    interactions:v.interactions}]))
  }:null};
}
const advisoryOf=d=>{
 const x=d?.finiteHitDiagnostic??null;
 return x?{status:x.status,reasonCode:x.reasonCode,observedGlassIncidents:x.observedGlassIncidents,
  analyzedGlassIncidents:x.analyzedGlassIncidents,checked:x.checked,unknown:x.unknown,
  conflicting:x.conflicting,limit:x.limit,advisory:x.advisory,
  nativeMeasurementQualificationUnchanged:x.nativeMeasurementQualificationUnchanged}:null;
};
function ordinary(c,mode){
 assert.ok(['ordinary-off','ordinary-on'].includes(mode));
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(sha(before),c.sceneSha256);
 const v=evaluateDocument(c.document,core,mode==='ordinary-on'?wanted:[]);
 assert.equal(serializeSave(c.document),before);
 const data=v.report.native.diagnostics;
 assert.ok(data,'A genuine native diagnostics result is required');
 if(mode==='ordinary-on') assert.equal(data.finiteHitDiagnostic?.advisory,true);
 else assert.equal(data.finiteHitDiagnostic,undefined,'ordinary OFF must not enable advisory');
 const native=project(v.summary.native.status,v.summary.native.error,data);
 return {caseId:c.id,mode,sceneSha256:c.sceneSha256,
  native,nativeFingerprint:sha(JSON.stringify(native)),
  advisory:advisoryOf(data),
  extraCaptureInstalled:false,extraNativeCallingWrapperInstalled:false,
  elapsedMs:+(performance.now()-started).toFixed(4)};
}
// Tap the Stage-1 diagnostic's existing beforeIncident method: the existing
// single Glass.onRayIncident observer remains the SOLE native-calling wrapper.
// The tap takes its scalar copy BEFORE the ledger captures and native mutates.
// This is an added JavaScript frame and work, NOT an observer-neutral clone.
function tappedOn(c){
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(sha(before),c.sceneSha256);
 let captureCount=0,scope=null;
 const captures=[],captureFaults=[];
 const session=new core.Session(candidate=>{
  const loaded=core.loadDocument(candidate);
  scope=loaded;
  const finite=createNativeFiniteHitDiagnostic(candidate,loaded.scene,loaded.idMap,['G1']);
  assert.ok(finite,'A single existing v9 Stage-1 finite diagnostic is required');
  const original=finite.beforeIncident;
  assert.equal(typeof original,'function');
  finite.beforeIncident=function(id,ray,hit){
   captureCount++;
   try{
    if(captureCount<=FINITE_HIT_CAP){
     const copy=p=>({x:p?.x??null,y:p?.y??null});
     captures.push({p1:copy(ray?.p1),p2:copy(ray?.p2),incident:copy(hit)});
    }
   }catch(e){captureFaults.push(String(e));finite.captureFault();}
   return original.call(this,id,ray,hit); // EXACTLY ONCE; diagnostic only.
  };
  const sources=core.observeSourceSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  const detectors=core.observeDetectorSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  const interfaces=core.observeInterfaceSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  // No second native onRayIncident wrapper is installed by this runner.
  const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,
   candidate.simulation.processedRayLimit);
  return {cancel(){simulator.shouldSimulatorStop=true;},
   run(notify){
    for(const event of ['simulationComplete','simulationStop'])
     simulator.on(event,()=>notify(event,
      core.diagnostics(loaded.scene,simulator,sources,null,detectors,interfaces,null,
       {nativeEvent:event,finiteDiagnostic:finite})));
    simulator.updateSimulation();
   }};
 },()=>{});
 assert.equal(session.apply(c.document),true);
 if(session.state==='running')session.stop();
 assert.equal(serializeSave(c.document),before);
 const data=session.data??null;
 assert.ok(data,'This run must record a real native event, even if native failed');
 const native=project(session.state,session.error,data);
 const metric=data.interfacesById?.G1?.interactions;
 assert.equal(captureCount,metric,'Single-owner capture count must agree with actual interface callback meter');
 assert.equal(captureFaults.length,0,'Capture exceptions must be reported and fail research setup');
 const advisory=advisoryOf(data);
 assert.ok(advisory?.advisory===true&&advisory.nativeMeasurementQualificationUnchanged===true);
 if(complete(session.state))assert.notEqual(advisory.status,'suppressed');
 else assert.equal(advisory.status,'suppressed');
 assert.equal(captures.length,Math.min(captureCount,FINITE_HIT_CAP));
 const face=polygonFaces(c.document.physics.components.find(x=>x.id==='G1').parameters);
 const cutoff=core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED*(scope.scene.lengthScale||1)**2;
 const baselinePredicates=captures.map((x,index)=>{
  const y=auditRecordedFiniteHit(x,face,cutoff);
  return {index,status:y.status,reasonCode:y.reasonCode};
 });
 return {caseId:c.id,mode:'single-owner-tap',sceneSha256:c.sceneSha256,
  native,nativeFingerprint:sha(JSON.stringify(native)),advisory,
  extraCaptureInstalled:true,extraNativeCallingWrapperInstalled:false,
  captureMethod:'existing Stage-1 finiteDiagnostic.beforeIncident function; no other native Glass wrapper',
  capturedCallbackCount:captureCount,rawCapturedCount:captures.length,captureCap:FINITE_HIT_CAP,
  captureFaults,actualNativeHitCoordinates:captures,
  nativeFaceVertices:face.map(f=>({id:f.id,a:f.a,b:f.b})),
  nativeSegmentCutoffSquared:cutoff,existingExactFunctionClassifications:baselinePredicates,
  elapsedMs:+(performance.now()-started).toFixed(4)};
}
function rand(seed){let s=seed>>>0;return()=>{
 s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/2**32;};}
function shuffle(xs,random){const out=[...xs];for(let i=out.length-1;i>0;i--){
 const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];
 }return out;}
const tally=(xs,key)=>Object.fromEntries([...new Set(xs.map(key))].sort()
 .map(k=>[k,xs.filter(x=>key(x)===k).length]));
function labelledCounts(rows){
 const profiles=['ordinary-off','ordinary-on','single-owner-tap'];
 const byMode=Object.fromEntries(profiles.map(mode=>[mode,rows.filter(x=>x.mode===mode).length]));
 assert.equal(Object.values(byMode).reduce((a,b)=>a+b,0),rows.length);
 const nativeStatesByMode=Object.fromEntries(profiles.map(mode=>[mode,
  tally(rows.filter(x=>x.mode===mode),x=>x.native.status)]));
 for(const mode of profiles)assert.equal(
  Object.values(nativeStatesByMode[mode]).reduce((a,b)=>a+b,0),byMode[mode]);
 return {byMode,nativeStatesByMode,allNativeStates:tally(rows,x=>x.native.status)};
}
function run(){
 pin();
 const out=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/heldout-native-profiles-v1');
 const allowed=resolve(root,'test-artifacts/llm-authoring/');
 if(!out.startsWith(allowed)||out===allowed)throw Error('Must use fresh research artifact directory');
 mkdirSync(dirname(out),{recursive:true});mkdirSync(out,{recursive:false});
 const c=inputs(),seed=0x9500A55,random=rand(seed);
 const prereg={format:'opticsim-heldout-native-profiles-inputs-v1',
  protocolCommit,baseMain:base,nativePin:UPSTREAM,node:process.version,randomSeed:seed,cases:c};
 const bytes=JSON.stringify(prereg,null,2)+'\n',source=join(out,'inputs.json');
 writeFileSync(source,bytes,{flag:'wx'});
 const schedule=[];
 // Frozen 6 x 2 x 3 balanced, randomized profile order; fresh process each.
 for(const item of c)for(let block=1;block<=2;block++)
  for(const [n,mode]of shuffle(['ordinary-off','ordinary-on','single-owner-tap'],random).entries())
   schedule.push({caseId:item.id,block,slot:n+1,mode});
 const rows=[],errors=[];
 for(const [i,test]of schedule.entries()){
  try{
   const text=execFileSync(process.execPath,[self,'single',source,test.caseId,test.mode],
    {cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:20000});
   const marker=text.trim().split('\n').find(x=>x.startsWith('HELDOUT_NATIVE_RECORD '));
   if(!marker)throw Error('No original native record from fresh process');
   const record=JSON.parse(marker.slice('HELDOUT_NATIVE_RECORD '.length));
   const expected=c.find(x=>x.id===test.caseId);
   assert.equal(record.sceneSha256,expected.sceneSha256);
   rows.push({...record,schedule:test,ordinal:i+1,processKind:'fresh Node OS process'});
  }catch(e){errors.push({schedule:test,ordinal:i+1,error:String(e.stack||e)});}
 }
 const separate=labelledCounts(rows);
 const physicalMismatches=[];
 for(const r of rows.filter(r=>['subcritical-tilt-m23','supercritical-tilt-p61'].includes(r.caseId))){
  const want=r.caseId==='subcritical-tilt-m23'?'transmission':'total-internal-reflection';
  const first=r.native.glass?.first;
  if(first&&first.outcome!==want)physicalMismatches.push({ordinal:r.ordinal,
   caseId:r.caseId,observed:first.outcome,expected:want});
 }
 const collected=rows.filter(x=>x.mode==='single-owner-tap');
 const report={format:'opticsim-preregistered-heldout-native-profiles-v1',
  status:errors.length||physicalMismatches.length?'research-invariant-failed':'research-complete',
  provenance:{protocolCommit,baseMain:base,nativePin:UPSTREAM,node:process.version,gitCheckout:process.env.GITHUB_SHA||null,
   githubRunId:process.env.GITHUB_RUN_ID||null,inputsSha256:sha(bytes)},
  boundaries:{randomizedPerCaseBlocks:2,oneNativeCallingGlassObserverOnly:true,ordinaryOffHasNoFiniteDiagnostic:true,
   tapAddsSynchronousDiagnosticMethodWork:true,causeOrNeutralityProven:false,
   originalCriticalMathematicalBranchProven:false,stage2Authorized:false,
   notSourceInterpretationTest:true},
  schedule,records:rows,plannedTrials:schedule.length,actualTrials:rows.length,
  labelledCounts:separate,rawHitEvidenceCount:collected.reduce((n,x)=>n+x.rawCapturedCount,0),
  farScalarMismatches:physicalMismatches,errors,
  byCase:c.map(item=>{const own=rows.filter(x=>x.caseId===item.id);
   return {id:item.id,byProfile:Object.fromEntries(['ordinary-off','ordinary-on','single-owner-tap'].map(mode=>{
    const rs=own.filter(x=>x.mode===mode);
    return [mode,{n:rs.length,statuses:tally(rs,x=>x.native.status),
     incidentCounts:tally(rs,x=>String(x.native.glass?.interactions??'none')),
     nativeFingerprints:tally(rs,x=>x.nativeFingerprint),
     diagnostics:tally(rs,x=>x.advisory?.status??'none')}];
   }))};
  })};
 const path=join(out,'report.json');
 writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 assert.equal(errors.length,0,'Real native setup/capture exceptions; original report retained');
 assert.equal(rows.length,36,'Unexpected missing fresh-process native trials');
 for(const mode of ['ordinary-off','ordinary-on','single-owner-tap'])
  assert.equal(separate.byMode[mode],12);
 assert.equal(physicalMismatches.length,0);
 console.log('HELDOUT_NATIVE_PROFILES '+JSON.stringify({status:report.status,trials:rows.length,
  labelledCounts:separate,rawHitEvidenceCount:report.rawHitEvidenceCount,
  cases:report.byCase,reportPath:path}).slice(0,22000));
}
if(process.argv[2]==='single'){
 pin();
 const frozen=JSON.parse(readFileSync(resolve(process.argv[3]),'utf8'));
 const item=frozen.cases.find(x=>x.id===process.argv[4]),mode=process.argv[5];
 if(!item||!['ordinary-off','ordinary-on','single-owner-tap'].includes(mode))
  throw Error('Missing fixed case or research profile');
 const trial=mode==='single-owner-tap'?tappedOn(item):ordinary(item,mode);
 console.log('HELDOUT_NATIVE_RECORD '+JSON.stringify(trial));
}else if(process.argv[1]&&resolve(process.argv[1])===self)run();
