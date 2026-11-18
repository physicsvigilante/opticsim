// B1a JEE two-native-run finite-detector readouts. No intersections or images.
// Standalone: NEVER change the historical single-run scripts/run-problem.mjs.
import {readFileSync,lstatSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePairJSON,PairInputError} from '../src/detector-pair-json.js';
import {planDetectorSelectedPair,pairCapabilities,PAIR_GEOMETRY,
  PAIR_MANIFEST_FORMAT,PAIR_REPORT_FORMAT} from '../src/detector-pair-plan.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
import {evaluateObservables} from '../src/observables.js';
import {interfaceNormal,signedSide} from '../src/planar-media.js';
import {sceneHash,canonicalJSON} from '../src/qualified-utils.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const SHA=x=>createHash('sha256').update(x).digest('hex');
const shaPattern=/^[a-f0-9]{64}$/;
const REQUESTS=(ids)=>[
  {id:'source',kind:'source-emissions',componentId:ids.sourceId},
  {id:'interface',kind:'interface-first-event',componentId:ids.interfaceId},
  {id:'crossings',kind:'detector-crossings',componentId:ids.detectorId},
  {id:'hits',kind:'detector-hit-events',componentId:ids.detectorId}
];
const NULL_GEOMETRY=()=>({...PAIR_GEOMETRY});
const response=(status,inputSha256,reasonCode=null,reason=null)=>({
  format:PAIR_REPORT_FORMAT,status,inputSha256,reasonCode,reason,
  nativeAttempted:0,nativeCompleted:0,nativeSelection:{status:'unavailable',reasonCode},
  runs:[],geometry:NULL_GEOMETRY(),
  observerAssessment:'not-assessed',imageAssessment:'not-assessed',
  interpretationAssessment:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'
});
let testCore=null;
function prepareNativeCore(){
  if(testCore)return;
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
    {cwd:root,stdio:['ignore','pipe','pipe']});
  testCore=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
}
function executeNative(scene,requests){
  if(!testCore)throw Error('Pinned native core was not prepared.');
  return evaluateDocument(scene,testCore,requests);
}
// Do not revise baseline evaluateObservables() outputs for historical users.
// B1a materializes every required per-readout warning/reason field locally.
function normalizeReadouts(results){
  return results.map(r=>({...r,warnings:Array.isArray(r.warnings)?[...r.warnings]:[],
    reason:r.reason??null,
    reasonCode:r.reasonCode??(
      r.status==='suppressed'?'NATIVE_OBSERVATION_SUPPRESSED':
      r.status==='unavailable'?'NATIVE_OBSERVATION_UNAVAILABLE':null),
    method:r.method??null}));
}
function classify(run,doc,ids){
  const values=run.observableResults;
  if(run.sceneHashMatches!==true||run.nativePinMatches!==true)
    return {status:'suppressed',reasonCode:'STALE_EXECUTION_SHA'};
  const native=run.nativeSummary||{};
  if(!run.executionPassed||!['completed','completed-with-warnings'].includes(run.nativeStatus)||
    native.truncation!==0||native.undefinedBehavior!==0||
    (native.errors||[]).length)
    return {status:'suppressed',reasonCode:'NATIVE_EXECUTION_INCOMPLETE'};
  if((native.warnings||[]).length)
    return {status:'suppressed',reasonCode:'UNQUALIFIED_NATIVE_WARNING'};
  if(values.length!==4||values.some(v=>v.status==='suppressed'))
    return {status:'suppressed',reasonCode:'NATIVE_EXECUTION_INCOMPLETE'};
  const by=Object.fromEntries(values.map(v=>[v.kind,v]));
  const source=by['source-emissions'],first=by['interface-first-event'];
  const crosses=by['detector-crossings'],hits=by['detector-hit-events'];
  if(!source||!first||!crosses||!hits||
    values.some(v=>!['available','qualified'].includes(v.status))){
    // A source aimed away may have a *measured zero* detector crossing, but
    // without a native plane encounter that is NOT a transmitted ray missing
    // the finite detector. Keep those distinct refusal reasons.
    if(!first?.value||!['available','qualified'].includes(first.status))
      return {status:'unavailable',reasonCode:'NO_TRANSMITTED_BRANCH'};
    if(hits?.status==='unavailable')
      return {status:'unavailable',reasonCode:
        /No complete, count-matched/.test(hits.reason||'')?
          'MISSING_NATIVE_HIT_CAPTURE':'AMBIGUOUS_NATIVE_HIT'};
    if(crosses?.status==='available'&&crosses.value===0&&
       hits?.status==='available'&&Array.isArray(hits.value)&&hits.value.length===0&&
       first.value.outcome==='transmission')
      return {status:'unavailable',reasonCode:'FINITE_DETECTOR_MISS'};
    return {status:'unavailable',reasonCode:'INCONSISTENT_NATIVE_BRANCH'};
  }
  const firstValue=first.value;
  const observations=run.nativeObservations||{};
  const iface=observations.interfacesById?.[ids.interfaceId];
  if(source.value!==1||observations.emissionsById?.[ids.sourceId]?.emitted!==1||
     iface?.interactions!==1)
    return {status:'unavailable',reasonCode:'INCONSISTENT_NATIVE_BRANCH'};
  if(firstValue?.outcome!=='transmission')
    return {status:'unavailable',reasonCode:'NO_TRANSMITTED_BRANCH'};
  if(crosses.value===0&&hits.value?.length===0)
    return {status:'unavailable',reasonCode:'FINITE_DETECTOR_MISS'};
  if(crosses.value!==1||hits.value?.length!==1)
    return {status:'unavailable',reasonCode:'INCONSISTENT_NATIVE_BRANCH'};
  const sourceComp=doc.physics.components.find(c=>c.id===ids.sourceId);
  const plane=doc.physics.components.find(c=>c.id===ids.interfaceId);
  const detector=doc.physics.components.find(c=>c.id===ids.detectorId);
  const normal=interfaceNormal(plane.parameters),side=Math.sign(signedSide(plane.parameters,sourceComp.parameters));
  const expectedFrom=side<0?plane.parameters.negativeIndex:plane.parameters.positiveIndex;
  const expectedTo=side<0?plane.parameters.positiveIndex:plane.parameters.negativeIndex;
  const transmitted=firstValue.branches?.filter(b=>b.kind==='transmitted')||[];
  if(firstValue.incidentIndex!==expectedFrom||firstValue.destinationIndex!==expectedTo||
    transmitted.length!==1||iface.transmitted!==1)
    return {status:'unavailable',reasonCode:'INCONSISTENT_NATIVE_BRANCH'};
  const hit=hits.value[0],u=hit?.incomingUnit,v=transmitted[0]?.direction;
  // 1e-8 is an explicit *same-native-branch agreement* tolerance in unit
  // directions, NOT a calibration of native physical angular accuracy.
  if(!u||!v||![hit.pointMm?.x,hit.pointMm?.y,u.x,u.y,v.x,v.y,
    hit.distanceFromP1Mm].every(Number.isFinite)||
     Math.abs(Math.hypot(u.x,u.y)-1)>1e-8||
     Math.abs(Math.hypot(v.x,v.y)-1)>1e-8||
     Math.hypot(u.x-v.x,u.y-v.y)>1e-8||
     (u.x*normal.x+u.y*normal.y)*side>=0||
     hit.distanceFromP1Mm<=0||hit.distanceFromP1Mm>=detector.parameters.length)
    return {status:'unavailable',reasonCode:'INCONSISTENT_NATIVE_BRANCH'};
  const qualified=values.some(v=>v.status==='qualified');
  return {status:qualified?'qualified':'available',reasonCode:null};
}
function aggregate(runs){
  if(runs.length!==2)return {status:'unavailable',reasonCode:'NATIVE_EXECUTION_INCOMPLETE'};
  const statuses=runs.map(r=>r.selection.status);
  if(statuses.includes('suppressed'))return {status:'suppressed',
    reasonCode:runs.find(r=>r.selection.status==='suppressed').selection.reasonCode};
  if(statuses.includes('unavailable'))return {status:'unavailable',
    reasonCode:runs.find(r=>r.selection.status==='unavailable').selection.reasonCode};
  if(statuses.includes('qualified'))return {status:'qualified',reasonCode:null};
  return {status:'available',reasonCode:null};
}
function sanitizeRun(role,spec,execution,reads,ids){
  const summary=execution.summary;
  const native=summary.native||{};
  const match=summary.canonicalSha256===spec.sceneSha256;
  const pin=spec.scene.upstreamCommit;
  const record={role,sceneSha256:spec.sceneSha256,familySha256:null,
    authoredDirectionDeg:spec.scene.physics.components.find(c=>c.id===ids.sourceId).emission.directionDeg,
    nativePin:pin,attempted:true,nativeStatus:native.status||'unknown',
    executionPassed:summary.executionPassed===true,
    sceneHashMatches:match,nativePinMatches:pin===execution.scenePin&&pin===spec.scene.upstreamCommit,
    nativeSummary:structuredClone(native),
    nativeObservations:structuredClone(summary.observations),
    rawNativeWarnings:[...(native.warnings||[])],rawNativeErrors:[...(native.errors||[])],
    observableResults:structuredClone(reads)};
  record.selection=classify(record,spec.scene,ids);
  return record;
}
// The executor/prepare overrides are TEST INJECTION SEAMS, never accepted by
// the public standalone CLI or a request JSON. Mark them non-authoritative.
export async function runDetectorPairEvidence({
  inputBytes,outputPath,execute=executeNative,prepareNative=prepareNativeCore
}){
  if(!(inputBytes instanceof Uint8Array)||inputBytes.length>1024*1024)
    throw new PairInputError('invalid-input','INVALID_ENVELOPE','Expected at most 1 MiB request bytes.');
  // Snapshot before calling asynchronous code. Output paths are fresh/guarded.
  const raw=Buffer.from(inputBytes),inputSha256=SHA(raw);
  const reserved=reserveAuthoringOutput(outputPath,root);
  if(!reserved)throw Error('An explicit fresh evidence directory is required.');
  const directory=reserved.directory,files=[];
  const file=(name,bytes)=>{
    const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
    writeEvidence(resolve(directory,name),data);
    files.push({path:name,sha256:SHA(data),bytes:data.length});
  };
  const json=(name,data)=>file(name,JSON.stringify(data,null,2)+'\n');
  file('input.json',raw);
  let input,planned;
  try{input=parsePairJSON(raw);planned=await planDetectorSelectedPair(input);}
  catch(e){
    const report=response(e instanceof PairInputError?e.status:'infrastructure-error',
      inputSha256,e.reasonCode||'PAIR_PREPARATION_FAILED',e.message);
    json('report.json',report);
    return {exitCode:report.status==='needs-information'||report.status==='unavailable'?2:1,
      report,output:directory};
  }
  const ids={sourceId:planned.sourceId,interfaceId:planned.interfaceId,detectorId:planned.detectorId};
  const plan={format:planned.format,inputSha256,sourceId:planned.sourceId,
    interfaceId:planned.interfaceId,detectorId:planned.detectorId,
    firstDirectionDeg:planned.firstDirectionDeg,secondDirectionDeg:planned.secondDirectionDeg,
    runPolicy:planned.runPolicy,familySha256:planned.familySha256,
    runs:planned.scenes.map(s=>({role:s.role,sceneSha256:s.sceneSha256,
      nativePin:s.scene.upstreamCommit,
      sourceDirectionDeg:s.scene.physics.components.find(c=>c.id===ids.sourceId).emission.directionDeg}))};
  json('plan.json',plan);
  for(const [i,s] of planned.scenes.entries())file('scene-'+(i?'B':'A')+'.ray-optics-2d.json',s.serialized);
  const report=response('native-selection-unavailable',inputSha256);
  report.familySha256=planned.familySha256;
  report.executorProvenance=execute===executeNative&&prepareNative===prepareNativeCore?
    'built-in-pinned-native':'test-injected-untrusted';
  const requests=REQUESTS(ids);
  let fatal=null;
  // Setup/build is not a native invocation. A failed build or missing core
  // yields zero nativeAttempted, no fabricated run summary and no manifest.
  if(execute===executeNative){
    try{await prepareNative();}
    catch(e){fatal={code:'NATIVE_SETUP_FAILED',message:e.message};}
  }
  if(fatal){
    report.status='infrastructure-error';
    report.reasonCode=fatal.code;report.reason=fatal.message;
    report.nativeSelection={status:'unavailable',reasonCode:fatal.code};
    report.geometry={status:'withheld',value:null,reasonCode:fatal.code};
    json('report.json',report);
    return {exitCode:2,report,output:directory};
  }
  for(const [i,spec] of planned.scenes.entries()){
    // A real invocation is attempted only at this boundary. No detector
    // reading, scene identity or run-local token can be borrowed from its peer.
    report.nativeAttempted++;
    let execution;
    try{execution=await execute(structuredClone(spec.scene),structuredClone(requests));}
    catch(e){fatal={code:'NATIVE_EXECUTOR_FAILURE',message:e.message};break;}
    if(!execution?.summary||!execution.summary.native){
      fatal={code:'NATIVE_EXECUTOR_FAILURE',message:'Native executor returned no trustworthy summary.'};break;
    }
    const observedPin=execution.scenePin??spec.scene.upstreamCommit;
    // Native reported pin is unavailable in the usual summary: rely on the
    // fully validated canonical scene's pinned upstreamCommit and on the
    // trusted built-in executor. Test doubles may expose a pin for checking.
    execution.scenePin=observedPin;
    let values;
    try{values=normalizeReadouts((await evaluateObservables(spec.scene,requests,execution.summary)).results);}
    catch(e){fatal={code:'NATIVE_EXECUTOR_FAILURE',message:'Observable integrity/evaluation failed: '+e.message};break;}
    // Preserve raw native evidence even when the summary is stale or native
    // selection is unavailable. A stale hash never authorizes a hit.
    json('native-'+(i?'B':'A')+'.json',execution);
    const record=sanitizeRun(spec.role,spec,execution,values,ids);
    record.inputSha256=inputSha256;record.familySha256=planned.familySha256;
    record.executorProvenance=report.executorProvenance;
    record.schemaVersion=spec.scene.schemaVersion;
    json('readouts-'+(i?'B':'A')+'.json',record);
    report.runs.push(record);
    if(record.sceneHashMatches&&record.nativePinMatches&&record.executionPassed&&
       ['completed','completed-with-warnings'].includes(record.nativeStatus))
      report.nativeCompleted++;
    // A scene/evidence integrity failure is not a normal detector miss; stop
    // rather than pairing a second run with a compromised first snapshot.
    if(!record.sceneHashMatches||!record.nativePinMatches){
      fatal={code:'STALE_EXECUTION_SHA',message:'A returned native execution does not match its saved canonical scene identity.'};break;
    }
  }
  if(fatal){
    report.status=fatal.code==='STALE_EXECUTION_SHA'?'native-suppressed':'infrastructure-error';
    report.reasonCode=fatal.code;report.reason=fatal.message;
    report.nativeSelection={status:report.status==='native-suppressed'?'suppressed':'unavailable',
      reasonCode:fatal.code};
    report.geometry={status:'withheld',value:null,reasonCode:fatal.code};
    json('report.json',report); // Incomplete evidence never gets a final manifest.
    return {exitCode:2,report,output:directory};
  }
  report.nativeSelection=aggregate(report.runs);
  report.status=['available','qualified'].includes(report.nativeSelection.status)?
    'native-hits-reported':report.nativeSelection.status==='suppressed'?
      'native-suppressed':'native-selection-unavailable';
  report.reasonCode=report.nativeSelection.reasonCode;
  report.geometry={status:'withheld',value:null,
    reasonCode:report.status==='native-hits-reported'?
      'B1B_NUMERICAL_GATE_NOT_RELEASED':report.reasonCode};
  json('report.json',report);
  const manifest={format:PAIR_MANIFEST_FORMAT,status:'finalized',
    inputSha256,planFamilySha256:planned.familySha256,
    sceneSha256:planned.scenes.map(s=>s.sceneSha256),
    nativeAttempted:report.nativeAttempted,nativeCompleted:report.nativeCompleted,
    files:structuredClone(files)};
  json('manifest.json',manifest); // Must be the last file written.
  return {exitCode:report.status==='native-hits-reported'?0:2,report,output:directory};
}
// Verify BOTH byte-level digests and semantic association to immutable authored
// scenes and the actual native/readout artifacts. A rewritten manifest is NOT
// an independent signature or proof of optical truth. No native rerun occurs.
export async function verifyDetectorPairManifest(directory){
  const base=resolve(directory),mPath=resolve(base,'manifest.json');
  const check=(ok,reason)=>{
    if(!ok)throw Error('B1a evidence identity mismatch: '+reason);
  };
  const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
  const statManifest=lstatSync(mPath);
  check(statManifest.isFile()&&!statManifest.isSymbolicLink(),'invalid final manifest path');
  const manifest=JSON.parse(readFileSync(mPath,'utf8'));
  check(manifest.format===PAIR_MANIFEST_FORMAT&&manifest.status==='finalized'&&
    shaPattern.test(manifest.inputSha256)&&shaPattern.test(manifest.planFamilySha256)&&
    Array.isArray(manifest.sceneSha256)&&manifest.sceneSha256.length===2&&
    manifest.sceneSha256.every(v=>typeof v==='string'&&shaPattern.test(v))&&
    manifest.sceneSha256[0]!==manifest.sceneSha256[1]&&
    manifest.nativeAttempted===2&&Number.isInteger(manifest.nativeCompleted)&&
    manifest.nativeCompleted>=0&&manifest.nativeCompleted<=2,
    'invalid final two-run header');

  // Finalized evidence MUST contain exactly the original request, plan, two
  // actual independently attempted native summaries/readouts, and report.
  const known=new Set(['input.json','plan.json','scene-A.ray-optics-2d.json',
    'scene-B.ray-optics-2d.json','native-A.json','native-B.json',
    'readouts-A.json','readouts-B.json','report.json']);
  check(Array.isArray(manifest.files)&&manifest.files.length===known.size,
    'finalized B1a evidence must contain both actual run records');
  const observed=new Map();
  for(const entry of manifest.files){
    check(entry&&known.has(entry.path)&&!observed.has(entry.path)&&
      typeof entry.sha256==='string'&&shaPattern.test(entry.sha256)&&
      Number.isInteger(entry.bytes)&&entry.bytes>=0,
      'unknown or duplicate evidence manifest path');
    const fpath=resolve(base,entry.path),stat=lstatSync(fpath);
    check(stat.isFile()&&!stat.isSymbolicLink(),'evidence file must be regular');
    const bytes=readFileSync(fpath);
    check(bytes.length===entry.bytes&&SHA(bytes)===entry.sha256,
      'tampered or inconsistent B1a evidence file '+entry.path);
    observed.set(entry.path,bytes);
  }
  for(const required of known)check(observed.has(required),'missing '+required);
  const getJSON=path=>JSON.parse(observed.get(path).toString('utf8'));
  const inputBytes=observed.get('input.json');
  check(SHA(inputBytes)===manifest.inputSha256,'original input SHA');
  // Re-author BOTH canonical scenes from the original unmodified request. This
  // is planning/validation only: no PhyDemo or fake geometry is run.
  const expected=await planDetectorSelectedPair(parsePairJSON(inputBytes));
  const ids={sourceId:expected.sourceId,interfaceId:expected.interfaceId,
    detectorId:expected.detectorId};
  const plan=getJSON('plan.json'),report=getJSON('report.json');
  const expectedPlan={format:expected.format,inputSha256:manifest.inputSha256,
    sourceId:ids.sourceId,interfaceId:ids.interfaceId,detectorId:ids.detectorId,
    firstDirectionDeg:expected.firstDirectionDeg,
    secondDirectionDeg:expected.secondDirectionDeg,
    runPolicy:expected.runPolicy,familySha256:expected.familySha256,
    runs:expected.scenes.map(spec=>({
      role:spec.role,sceneSha256:spec.sceneSha256,
      nativePin:spec.scene.upstreamCommit,
      sourceDirectionDeg:spec.scene.physics.components
        .find(c=>c.id===ids.sourceId).emission.directionDeg
    }))};
  check(same(plan,expectedPlan),'plan differs from original authoring facts');
  check(manifest.planFamilySha256===expected.familySha256&&
    report.familySha256===expected.familySha256&&
    manifest.inputSha256===report.inputSha256,
    'full-scene family/input identity');

  check(report.format===PAIR_REPORT_FORMAT&&report.nativeAttempted===2&&
    Array.isArray(report.runs)&&report.runs.length===2&&
    report.observerAssessment==='not-assessed'&&
    report.imageAssessment==='not-assessed'&&
    report.interpretationAssessment==='not-assessed-by-engine'&&
    report.questionSupport==='not-assessed-by-engine'&&
    report.geometry?.status==='withheld'&&report.geometry?.value===null,
    'complete public two-run/non-image report');

  let completed=0;
  let provenance=null;
  for(const [i,spec] of expected.scenes.entries()){
    const letter=i===0?'A':'B';
    const sceneBytes=observed.get('scene-'+letter+'.ray-optics-2d.json');
    const native=getJSON('native-'+letter+'.json');
    const readout=getJSON('readouts-'+letter+'.json');
    const row=report.runs[i];
    // These two checks disallow a rewritten digest entry for swapped scene-A
    // even if the manifest's own hashes were recomputed.
    check(sceneBytes.toString('utf8')===spec.serialized&&
      SHA(sceneBytes)===spec.sceneSha256&&
      spec.sceneSha256===manifest.sceneSha256[i],
      'scene-'+letter+' not the independently authored immutable scene');
    check(readout.role===spec.role&&row.role===spec.role&&
      readout.inputSha256===manifest.inputSha256&&
      readout.sceneSha256===spec.sceneSha256&&
      readout.familySha256===expected.familySha256&&
      readout.nativePin===spec.scene.upstreamCommit&&
      readout.schemaVersion===spec.scene.schemaVersion&&
      readout.authoredDirectionDeg===spec.scene.physics.components
        .find(c=>c.id===ids.sourceId).emission.directionDeg&&
      readout.attempted===true&&same(readout,row),
      'readouts-'+letter+' do not belong to their role and source scene');
    check(native?.sceneText===spec.serialized&&
      native?.scenePin===spec.scene.upstreamCommit&&
      native?.summary?.canonicalSha256===spec.sceneSha256,
      'native-'+letter+' execution belongs to a different scene/role/pin');
    check(same(native.summary.native,row.nativeSummary)&&
      same(native.summary.observations,row.nativeObservations)&&
      native.summary.executionPassed===row.executionPassed&&
      native.summary.native.status===row.nativeStatus&&
      same(native.summary.native.warnings||[],row.rawNativeWarnings)&&
      same(native.summary.native.errors||[],row.rawNativeErrors)&&
      row.sceneHashMatches===true&&row.nativePinMatches===true,
      'native-'+letter+' raw execution disagrees with readouts and report');
    // Re-evaluate existing read-only observable logic against SAVED native
    // summary and its own authored v5 scene; no solver run or invented events.
    const values=normalizeReadouts((await evaluateObservables(
      spec.scene,REQUESTS(ids),native.summary)).results);
    check(same(values,readout.observableResults)&&
      same(classify(row,spec.scene,ids),row.selection),
      'readouts-'+letter+' not derivable from this native scene observation');
    if(row.executionPassed&&row.sceneHashMatches&&row.nativePinMatches&&
       ['completed','completed-with-warnings'].includes(row.nativeStatus))completed++;
    if(provenance===null)provenance=row.executorProvenance;
    check(row.executorProvenance===provenance&&
      ['built-in-pinned-native','test-injected-untrusted'].includes(provenance),
      'executor trust boundary not consistently labelled');
  }
  const selection=aggregate(report.runs);
  const expectedStatus=['available','qualified'].includes(selection.status)?
    'native-hits-reported':selection.status==='suppressed'?
      'native-suppressed':'native-selection-unavailable';
  const expectedGeometry={status:'withheld',value:null,
    reasonCode:expectedStatus==='native-hits-reported'?
      'B1B_NUMERICAL_GATE_NOT_RELEASED':selection.reasonCode};
  check(report.nativeCompleted===completed&&manifest.nativeCompleted===completed&&
    same(report.nativeSelection,selection)&&report.status===expectedStatus&&
    report.reasonCode===selection.reasonCode&&
    same(report.geometry,expectedGeometry)&&
    report.executorProvenance===provenance,
    'native aggregate/qualification or withheld geometry inconsistent');
  // Integrity within this directory only. Malicious full-bundle rewriting,
  // untrusted injected test executors and native physical accuracy are NOT
  // cryptographically authenticated by SHA-256 file bookkeeping.
  return {status:'verified-finalized-evidence',
    authority:provenance==='built-in-pinned-native'?
      'built-in-pinned-native':'test-injected-non-authoritative',
    manifest,report};
}
async function main(args){
  if(args.length===1&&args[0]==='capabilities'){
    console.log(JSON.stringify(pairCapabilities(),null,2));return 0;
  }
  if(args.length!==3||args[1]!=='--out')
    throw Error('Usage: node scripts/detector-selected-pair.mjs capabilities | <request.json> --out test-artifacts/llm-authoring/<fresh>');
  const r=await runDetectorPairEvidence({inputBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
  console.log(JSON.stringify({status:r.report.status,
    nativeAttempted:r.report.nativeAttempted,nativeCompleted:r.report.nativeCompleted,
    geometry:r.report.geometry,output:r.output},null,2));
  return r.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(e=>{
    console.error(JSON.stringify({status:'infrastructure-error',message:e.message}));
    process.exitCode=1;
  });
