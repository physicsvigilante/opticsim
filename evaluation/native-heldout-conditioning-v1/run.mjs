// TEST ONLY, held-out native numerical geometry. The 20-case authored design was
// preregistered at a separate original Git commit BEFORE these trials ran.
// Ordinary OFF and ON have no extra research tap; tapped ON adds one synchronous
// method call on the existing native-calling observer. No observer-neutrality claim.
// Native warnings/failures, including real numeric errors, stay actual outcomes.
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
const designOnlyCommit='f5a2557f06f35896fc9003803a0a329d8d541db4';
const lockedBlob='a3e48bd3efb02ebb263ae86066cb2e74290704a2';
const lockedPath=resolve(root,'evaluation/native-heldout-conditioning-v1/locked-design.json');
const wanted=[{id:'native-finite-risk',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
function inputs(){
 const actualBlob=execFileSync('git',['hash-object',lockedPath],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(actualBlob,lockedBlob,'PREREGISTRATED_INPUT_BLOB_CHANGED');
 const raw=readFileSync(lockedPath,'utf8'),design=JSON.parse(raw);
 assert.equal(design.status,'DESIGN_FROZEN_BEFORE_ANY_NEW_NATIVE_TRIAL');
 assert.equal(design.sourceMainSha,base);assert.equal(design.pinnedNativeSha,UPSTREAM);
 assert.equal(design.expectedTrialCount,120);assert.equal(design.cases.length,20);
 assert.deepEqual(design.profiles,['ordinary-off','ordinary-on','single-owner-tap']);
 assert.equal(design.blocks,2);
 const ids=new Set(design.cases.map(c=>c.id));
 assert.equal(ids.size,20,'distinct frozen heldout scenes');
 const cases=design.cases.map(c=>{
  const document=prepareScene(c.authored).document;
  assert.equal(document.schemaVersion,9);
  const saved=serializeSave(document);
  return {...c,document,sceneSha256:sha(saved)};
 });
 return {design,cases,lockedManifestSha256:sha(raw)};
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
function ordinaryOn(c){
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(sha(before),c.sceneSha256);
 const v=evaluateDocument(c.document,core,wanted);
 assert.equal(serializeSave(c.document),before);
 const data=v.report.native.diagnostics;
 assert.ok(data&&data.finiteHitDiagnostic?.advisory===true);
 const native=project(v.summary.native.status,v.summary.native.error,data);
 return {caseId:c.id,mode:'ordinary-on',sceneSha256:c.sceneSha256,
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
// Shipped native path, without the optional finite-hit numerical diagnostic.
// Normal PhyDemo and Opticsim source/interface observers still execute;
// "ordinary-off" is NOT bare uninstrumented upstream PhyDemo.
function ordinaryOff(c){
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(sha(before),c.sceneSha256);
 const v=evaluateDocument(c.document,core,[]);
 assert.equal(serializeSave(c.document),before);
 const data=v.report.native.diagnostics;
 assert.ok(data,'Native event must be retained even when native fails');
 assert.equal(data.finiteHitDiagnostic??null,null,'OFF unexpectedly installed Stage-1');
 const native=project(v.summary.native.status,v.summary.native.error,data);
 return {caseId:c.id,mode:'ordinary-off',sceneSha256:c.sceneSha256,
  native,nativeFingerprint:sha(JSON.stringify(native)),
  advisory:null,extraCaptureInstalled:false,extraNativeCallingWrapperInstalled:false,
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
 const own=Object.fromEntries(profiles.map(m=>[m,rows.filter(r=>r.mode===m)]));
 assert.equal(profiles.reduce((s,m)=>s+own[m].length,0),rows.length);
 const counts={
  ordinaryOffNativeStates:tally(own['ordinary-off'],x=>x.native.status),
  ordinaryOnNativeStates:tally(own['ordinary-on'],x=>x.native.status),
  singleOwnerTapNativeStates:tally(own['single-owner-tap'],x=>x.native.status),
  allNativeStates:tally(rows,x=>x.native.status)};
 const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
 for(const [mode,key] of [['ordinary-off','ordinaryOffNativeStates'],
                         ['ordinary-on','ordinaryOnNativeStates'],
                         ['single-owner-tap','singleOwnerTapNativeStates']])
  assert.equal(sum(counts[key]),own[mode].length);
 assert.equal(sum(counts.allNativeStates),rows.length);
 return {byMode:Object.fromEntries(profiles.map(m=>[m,own[m].length])),...counts};
}
function run(){
 pin();
 const output=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/native-heldout-conditioning-v1');
 const allowed=resolve(root,'test-artifacts/llm-authoring/');
 if(!output.startsWith(allowed)||output===allowed)
  throw Error('Use a fresh ignored research artifact directory');
 mkdirSync(dirname(output),{recursive:true});
 mkdirSync(output,{recursive:false});
 const {design,cases,lockedManifestSha256}=inputs();
 const prereg={
  format:'opticsim-heldout-native-input-snapshots-v1',
  designOnlyCommit,lockedDesignGitBlob:lockedBlob,lockedManifestSha256,
  nativePin:UPSTREAM,sourceBase:base,node:process.version,
  cases,profileDefinitions:design.profiles,seed:design.seed,blocks:design.blocks
 };
 const preregBytes=JSON.stringify(prereg,null,2)+'\n';
 const savedInput=join(output,'inputs.json');
 writeFileSync(savedInput,preregBytes,{flag:'wx'});
 const random=rand(design.seed);
 const schedule=[];
 for(let block=1;block<=design.blocks;block++){
  const randomizedCases=shuffle(cases,random);
  for(const item of randomizedCases){
   for(const [j,mode] of shuffle([...design.profiles],random).entries())
    schedule.push({caseId:item.id,block,slot:j+1,mode});
  }
 }
 assert.equal(schedule.length,design.expectedTrialCount);
 const rows=[],errors=[];
 for(const [i,test] of schedule.entries()){
  try{
   const out=execFileSync(process.execPath,
    [self,'single',savedInput,test.caseId,test.mode],{
     cwd:root,encoding:'utf8',maxBuffer:3*1024*1024,timeout:20000});
   const marker=out.trim().split('\n').find(x=>x.startsWith('SINGLE_HELDOUT_NATIVE_RECORD '));
   if(!marker)throw Error('Missing completed trial record from fresh OS process');
   const observed=JSON.parse(marker.slice('SINGLE_HELDOUT_NATIVE_RECORD '.length));
   const target=cases.find(c=>c.id===test.caseId);
   assert.equal(observed.sceneSha256,target.sceneSha256);
   assert.equal(observed.mode,test.mode);
   rows.push({...observed,schedule:test,ordinal:i+1,processKind:'fresh Node 24 OS process'});
  }catch(e){errors.push({ordinal:i+1,schedule:test,error:String(e.stack||e)});}
 }
 const counts=labelledCounts(rows);
 const scalarControlDiscrepancies=[];
 for(const r of rows){
  const c=cases.find(x=>x.id===r.caseId),expected=c.expectedFirstForFarControl;
  if(!expected)continue;
  const first=r.native.glass?.first??null;
  if(!first||first.outcome!==expected)scalarControlDiscrepancies.push({
   ordinal:r.ordinal,caseId:r.caseId,mode:r.mode,
   expected,observed:first?.outcome??null,nativeStatus:r.native.status});
 }
 const tapped=rows.filter(r=>r.mode==='single-owner-tap');
 const byCase=cases.map(c=>({id:c.id,shape:c.shape,regime:c.regime,transform:c.transform,
  schemaVersion:c.document.schemaVersion,sceneSha256:c.sceneSha256,
  profiles:Object.fromEntries(design.profiles.map(mode=>{
   const own=rows.filter(r=>r.caseId===c.id&&r.mode===mode);
   return [mode,{attempts:own.length,statuses:tally(own,r=>r.native.status),
    nativeFingerprintCounts:tally(own,r=>r.nativeFingerprint),
    callbackInteractionCounts:tally(own,r=>String(r.native.glass?.interactions??'none')),
    firstOutcomes:tally(own,r=>r.native.glass?.first?.outcome??'missing')}];
  }))}));
 const report={
  format:'opticsim-heldout-finite-glass-native-trials-v1',
  status:errors.length?'trial-infrastructure-failed':'executed-all-frozen-trials',
  provenance:{lockedDesignGitBlob:lockedBlob,designOnlyCommit,lockedManifestSha256,
   sourceBase:base,pinnedNative:UPSTREAM,gitCheckout:process.env.GITHUB_SHA??null,
   githubRunId:process.env.GITHUB_RUN_ID??null,
   node:process.version,inputsSha256:sha(preregBytes)},
  limitations:{
   syntheticHeldoutGeometry:true,
   observerNeutralityProven:false,
   ordinaryOffIsBareUpstream:false,
   ordinaryProfileHasNoResearchMethodTap:true,
   singleOwnerTapAddsSynchronousWork:true,
   nearCriticalIdealBranchCertified:false,
   nativeErrorEnvelopeValidated:false,
   stage2PolicyChanged:false,
   sourceInterpretationTest:false},
  plannedTrials:schedule.length,actualRecordedTrials:rows.length,
  schedule,records:rows,labelledCounts:counts,byCase,
  rawTapHitCount:tapped.reduce((n,r)=>n+r.rawCapturedCount,0),
  scalarControlDiscrepancies,errors
 };
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('HELDOUT_NATIVE_SUMMARY '+JSON.stringify({
  status:report.status,planned:report.plannedTrials,recorded:rows.length,
  labelledCounts:counts,rawTapHits:report.rawTapHitCount,
  scalarControlDiscrepancies:scalarControlDiscrepancies.length,
  infrastructureErrors:errors.length,reportPath:join(output,'report.json')}));
 assert.equal(errors.length,0,'Experiment process/setup errors were recorded; report preserved');
 assert.equal(rows.length,120,'Missing frozen native executions; all outcomes must be retained');
 for(const mode of design.profiles)assert.equal(counts.byMode[mode],40);
}
if(process.argv[2]==='single'){
 pin();
 const {cases}=inputs();
 const saved=JSON.parse(readFileSync(resolve(process.argv[3]),'utf8'));
 assert.equal(saved.lockedDesignGitBlob,lockedBlob);
 const item=saved.cases.find(c=>c.id===process.argv[4]),mode=process.argv[5];
 assert.ok(item&&cases.find(c=>c.id===item.id)?.sceneSha256===item.sceneSha256,
  'Single process must use exactly one frozen original scene');
 if(!['ordinary-off','ordinary-on','single-owner-tap'].includes(mode))
  throw Error('Unknown preregistered native profile');
 const result=mode==='ordinary-off'?ordinaryOff(item):
              mode==='ordinary-on'?ordinaryOn(item):tappedOn(item);
 console.log('SINGLE_HELDOUT_NATIVE_RECORD '+JSON.stringify(result));
}else if(process.argv[1]&&resolve(process.argv[1])===self)run();
