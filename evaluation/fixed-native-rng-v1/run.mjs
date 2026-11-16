// PRE-REGISTERED TEST ONLY: PR98 fixed native PhyDemo randomSeed ONE-CASE study.
// Reuses exact original PR96 authored physical document; test-only native config.
// The four seeded profiles share original source/native observer pathways.
// No causal observer/physics inference from native status frequencies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {createNativeFiniteHitDiagnostic} from '../../src/native-finite-hit-diagnostic.js';
import {FINITE_HIT_CAP,auditRecordedFiniteHit} from '../../src/finite-hit-exact.js';
import {polygonFaces} from '../../src/polygon-dielectric.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const self=fileURLToPath(import.meta.url);
const sha=s=>createHash('sha256').update(s).digest('hex');
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const base='50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518';
const protocolCommit='6e6d3a7ed66b04473b0c1e0fceac557a99468168'; // frozen prior to trial
const sourcePr96Head='2f705f5167666b2fc2c7cd4de9572e8baded119f';
const originalInputsSha256='caa07af040d0a71b50ea6b69470aa55a545b04d52195994913123a902b434df3';
const originalInputBytes=19205;
const originalSceneSha256='4389fecfe80ad01fa7cb160f22319327ccf9e30bb35c211012cc15599ff422c6';
const NATIVE_SEED='opticsim-fixed-native-seed-v1-20261116';
const chosen=['critical-shift-neg'];
const profiles=['seeded-off','seeded-on','seeded-tap-blackhole','seeded-tap-archive'];
const wanted=[{id:'native-finite-risk',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
function loadOriginal(bytes){
 assert.equal(bytes.byteLength,originalInputBytes,'Original PR96 input byte count changed');
 assert.equal(sha(bytes),originalInputsSha256,'Original PR96 input SHA256 changed');
 const all=JSON.parse(bytes);
 assert.equal(all.protocolCommit,'3bd989e17ed47932f218a4b339158d59647c9fb2');
 assert.equal(all.baseMain,base);
 assert.equal(all.nativePin,UPSTREAM);
 assert.equal(all.cases.length,6);
 const c=all.cases.find(x=>x.id===chosen[0]);
 assert.ok(c,'Missing frozen source case');
 assert.equal(c.document.schemaVersion,9);
 assert.equal(sha(serializeSave(c.document)),originalSceneSha256);
 assert.equal(c.sceneSha256,originalSceneSha256);
 return {all,cases:[c]};
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
// Shared test-only fixed native seed path for EVERY profile. This invokes
// existing compiled Scene.loadJSON with its supported randomSeed property;
// no physical source-document or production adapter edits.
function seededTrial(c,mode){
 assert.ok(profiles.includes(mode));
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(sha(before),originalSceneSha256);
 const advisoryEnabled=mode!=='seeded-off';
 const tapEnabled=mode.startsWith('seeded-tap-');
 const retain=mode==='seeded-tap-archive';
 const captures=[],captureFaults=[];
 let captureCount=0,scope=null,config=null;
 const session=new core.Session(candidate=>{
  assert.equal(serializeSave(candidate),before);
  const compiled=core.compile(candidate);
  assert.ok(!Object.hasOwn(compiled.native,'randomSeed'),
   'Production compile must not implicitly set a seed');
  const seededNative={...compiled.native,randomSeed:NATIVE_SEED};
  const compiledNativeSha256=sha(JSON.stringify(compiled.native));
  const seededNativeConfigSha256=sha(JSON.stringify(seededNative));
  const scene=core.loadNative(seededNative,seededNative.width,seededNative.height);
  assert.equal(scene.randomSeed,NATIVE_SEED,
   'Pinned native loadJSON did not apply the fixed research seed');
  assert.equal(typeof scene.rng,'function','Pinned native RNG is absent');
  // DO NOT sample scene.rng here: advance it only during native simulation.
  const loaded={...compiled,scene};
  scope=loaded;
  config={compiledNativeSha256,seededNativeConfigSha256,
   nativeRandomSeed:NATIVE_SEED,observedNativeSceneSeed:scene.randomSeed,
   sourceDocumentSha256:originalSceneSha256,
   testOnlySeedInjectedAtNativeLoad:true,productionCompileChanged:false};
  const finite=advisoryEnabled?createNativeFiniteHitDiagnostic(
   candidate,loaded.scene,loaded.idMap,['G1']):null;
  if(advisoryEnabled)assert.ok(finite,'Stage-1 advisory must be available');
  if(tapEnabled){
   const original=finite.beforeIncident;
   assert.equal(typeof original,'function');
   finite.beforeIncident=function(id,ray,hit){
    captureCount++;
    try{
     if(captureCount<=FINITE_HIT_CAP){
      const copy=p=>({x:p?.x??null,y:p?.y??null});
      // Identical hot-path copies and array push in both TAP variants.
      captures.push({p1:copy(ray?.p1),p2:copy(ray?.p2),incident:copy(hit)});
     }
    }catch(e){captureFaults.push(String(e));finite.captureFault();}
    return original.call(this,id,ray,hit); // Original diagnostic ONCE.
   };
  }
  const sources=core.observeSourceSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  const mirrors=core.observeMirrorSet(candidate,loaded.scene,loaded.idMap);
  const detectors=core.observeDetectorSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  const interfaces=core.observeInterfaceSet(candidate,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
  const blockers=core.observeBlockerSet(candidate,loaded.scene,loaded.idMap);
  // Same original native Simulator and observer/terminal pathways in all profiles.
  const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,
   candidate.simulation.processedRayLimit);
  return {cancel(){simulator.shouldSimulatorStop=true;},
   run(notify){
    for(const event of ['simulationComplete','simulationStop'])
     simulator.on(event,()=>notify(event,core.diagnostics(
      loaded.scene,simulator,sources,mirrors,detectors,interfaces,blockers,
      {nativeEvent:event,finiteDiagnostic:finite})));
    simulator.updateSimulation();
   }};
 },()=>{});
 assert.equal(session.apply(c.document),true,'Test-only seeded native load failed');
 if(session.state==='running')session.stop();
 assert.equal(serializeSave(c.document),before);
 const data=session.data??null;
 assert.ok(data,'Missing actual native terminal diagnostics; retain setup failure');
 const native=project(session.state,session.error,data);
 const advisory=advisoryOf(data);
 if(advisoryEnabled){
  assert.equal(advisory?.advisory,true,'ON must have native Stage-1 advisory');
  assert.equal(advisory.nativeMeasurementQualificationUnchanged,true);
  if(complete(session.state))assert.notEqual(advisory.status,'suppressed');
  else assert.equal(advisory.status,'suppressed');
 }else assert.equal(data.finiteHitDiagnostic,undefined,'OFF incorrectly enabled advisory');
 assert.ok(config);
 assert.equal(config.nativeRandomSeed,NATIVE_SEED);
 const common={caseId:c.id,mode,sceneSha256:c.sceneSha256,nativeConfig:config,
  native,nativeFingerprint:sha(JSON.stringify(native)),advisory,
  extraCaptureInstalled:tapEnabled,extraNativeCallingWrapperInstalled:false};
 if(!tapEnabled){
  assert.equal(captureCount,0);
  assert.equal(captures.length,0);
  return {...common,elapsedMs:+(performance.now()-started).toFixed(4)};
 }
 const metric=data.interfacesById?.G1?.interactions;
 assert.equal(captureCount,metric,'Native callback meter disagrees with added TAP');
 assert.equal(captureFaults.length,0,'Capture fault; cannot interpret TAP');
 assert.equal(captures.length,Math.min(captureCount,FINITE_HIT_CAP));
 const faces=polygonFaces(c.document.physics.components.find(x=>x.id==='G1').parameters);
 const cutoff=core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED*(scope.scene.lengthScale||1)**2;
 // Both TAP profiles do identical postterminal classifications; only archive retains scalars.
 const existingExactFunctionClassifications=captures.map((x,index)=>{
  const y=auditRecordedFiniteHit(x,faces,cutoff);
  return {index,status:y.status,reasonCode:y.reasonCode};
 });
 return {...common,
  captureMethod:'same research-only finiteDiagnostic.beforeIncident scalar-copy hook for both TAP modes',
  capturedCallbackCount:captureCount,captureBufferCount:captures.length,
  rawCapturedCount:retain?captures.length:0,captureCap:FINITE_HIT_CAP,
  captureFaults,postTerminalRawCaptureRetained:retain,
  ...(retain?{actualNativeHitCoordinates:captures,
    nativeFaceVertices:faces.map(f=>({id:f.id,a:f.a,b:f.b})),
    nativeSegmentCutoffSquared:cutoff,existingExactFunctionClassifications}:{}),
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
 const originalPath=resolve(process.argv[2]||'test-artifacts/source-pr96-original/inputs.json');
 const out=resolve(root,process.argv[3]||'test-artifacts/llm-authoring/fixed-native-rng-v1');
 const allowed=resolve(root,'test-artifacts/llm-authoring/');
 if(!out.startsWith(allowed)||out===allowed)throw Error('Must use fresh research artifact directory');
 mkdirSync(dirname(out),{recursive:true});mkdirSync(out,{recursive:false});
 const originalBytes=readFileSync(originalPath);
 const {cases:c}=loadOriginal(originalBytes);
 const seed=0x9800A55,random=rand(seed);
 const bytes=originalBytes,source=join(out,'inputs.json');
 writeFileSync(source,bytes,{flag:'wx'}); // byte-identical original PR96 source
 const precommitted={protocolCommit,sourcePr96Head,originalInputsSha256,
  originalSceneSha256,chosenCases:chosen,profiles,
  scheduleRandomSeed:seed,nativeRandomSeed:NATIVE_SEED,blocksPerCase:6};
 const schedule=[];
 // Frozen ONE case x SIX blocks x FOUR profiles = 24 OS processes.
 for(const item of c)for(let block=1;block<=6;block++)
  for(const [n,mode]of shuffle(profiles,random).entries())
   schedule.push({caseId:item.id,block,slot:n+1,mode});
 assert.equal(schedule.length,24);
 const rows=[],errors=[];
 for(const [i,test]of schedule.entries()){
  try{
   const text=execFileSync(process.execPath,[self,'single',source,test.caseId,test.mode],
    {cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:20000});
   const marker=text.trim().split('\n').find(x=>x.startsWith('FIXED_NATIVE_RNG_RECORD '));
   if(!marker)throw Error('No original native record from fresh process');
   const record=JSON.parse(marker.slice('FIXED_NATIVE_RNG_RECORD '.length));
   const expected=c.find(x=>x.id===test.caseId);
   assert.equal(record.sceneSha256,expected.sceneSha256);
   rows.push({...record,schedule:test,ordinal:i+1,processKind:'fresh Node OS process'});
  }catch(e){errors.push({schedule:test,ordinal:i+1,error:String(e.stack||e)});}
 }
 const separate=labelledCounts(rows);
 // This protocol has ONLY nominal-critical cases: no ideal branch oracle.
 const physicalMismatches=[];
 const collected=rows.filter(x=>x.mode==='seeded-tap-archive');
 const report={format:'opticsim-fixed-native-seed-onecase-v1',
  status:errors.length||physicalMismatches.length?'research-invariant-failed':'research-complete',
  provenance:{...precommitted,baseMain:base,nativePin:UPSTREAM,node:process.version,gitCheckout:process.env.GITHUB_SHA||null,
   githubRunId:process.env.GITHUB_RUN_ID||null,inputsSha256:sha(bytes)},
  boundaries:{randomizedPerCaseBlocks:6,oneNativeCallingGlassObserverOnly:true,seedInjectedInTestOnlyNativeConfig:true,ordinaryModesShareTestOnlySeededSessionPath:true,ordinaryOffHasNoFiniteDiagnostic:true,hotPathMatchedTapsNotWallClockMatched:true,
   tapAddsSynchronousDiagnosticMethodWork:true,causeOrNeutralityProven:false,
   originalCriticalMathematicalBranchProven:false,stage2Authorized:false,
   notSourceInterpretationTest:true},
  schedule,records:rows,plannedTrials:schedule.length,actualTrials:rows.length,
  labelledCounts:separate,rawHitEvidenceCount:collected.reduce((n,x)=>n+x.rawCapturedCount,0),
  farScalarMismatches:physicalMismatches,errors,
  byCase:c.map(item=>{const own=rows.filter(x=>x.caseId===item.id);
   return {id:item.id,byProfile:Object.fromEntries(profiles.map(mode=>{
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
 assert.equal(rows.length,24,'Unexpected missing fresh-process native trials');
 assert.equal(new Set(rows.map(x=>x.nativeConfig?.compiledNativeSha256)).size,1,
  'Unseeded compile config drift across fixed source document');
 assert.equal(new Set(rows.map(x=>x.nativeConfig?.seededNativeConfigSha256)).size,1,
  'Seeded native config drift across trial profiles');
 assert.equal(new Set(rows.map(x=>x.nativeConfig?.nativeRandomSeed)).size,1,
  'Native seed mismatch in original process records');
 for(const mode of profiles) assert.equal(separate.byMode[mode],12);
 assert.equal(physicalMismatches.length,0);
 console.log('FIXED_NATIVE_RNG_PROFILE_TRIAL '+JSON.stringify({status:report.status,trials:rows.length,
  labelledCounts:separate,rawHitEvidenceCount:report.rawHitEvidenceCount,
  cases:report.byCase,reportPath:path}).slice(0,22000));
}
if(process.argv[2]==='single'){
 pin();
 const {cases:originalCases}=loadOriginal(readFileSync(resolve(process.argv[3])));
 const item=originalCases.find(x=>x.id===process.argv[4]),mode=process.argv[5];
 if(!item||!profiles.includes(mode))
  throw Error('Missing fixed case or research profile');
 const trial=seededTrial(item,mode);
 console.log('REPEATED_CRITICAL_RECORD '+JSON.stringify(trial));
}else if(process.argv[1]&&resolve(process.argv[1])===self)run();
