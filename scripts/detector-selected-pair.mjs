// B1a JEE two-native-run finite-detector readouts. No intersections or images.
// Standalone: NEVER change the historical single-run scripts/run-problem.mjs.
import {readFileSync,lstatSync} from 'node:fs';
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
function executeNative(scene,requests){
  if(!testCore){
    execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
      {cwd:root,stdio:['ignore','pipe','pipe']});
    testCore=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  }
  return evaluateDocument(scene,testCore,requests);
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
export async function runDetectorPairEvidence({inputBytes,outputPath,execute=executeNative}){
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
  const requests=REQUESTS(ids);
  let fatal=null;
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
    try{values=(await evaluateObservables(spec.scene,requests,execution.summary)).results;}
    catch(e){fatal={code:'NATIVE_EXECUTOR_FAILURE',message:'Observable integrity/evaluation failed: '+e.message};break;}
    // Preserve raw native evidence even when the summary is stale or native
    // selection is unavailable. A stale hash never authorizes a hit.
    json('native-'+(i?'B':'A')+'.json',execution);
    const record=sanitizeRun(spec.role,spec,execution,values,ids);
    record.inputSha256=inputSha256;record.familySha256=planned.familySha256;
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
export function verifyDetectorPairManifest(directory){
  const filename='manifest.json',base=resolve(directory),mPath=resolve(base,filename);
  if(!lstatSync(mPath).isFile()||lstatSync(mPath).isSymbolicLink())throw Error('Invalid manifest file');
  const manifest=JSON.parse(readFileSync(mPath,'utf8'));
  if(manifest.format!==PAIR_MANIFEST_FORMAT||manifest.status!=='finalized'||
     !Array.isArray(manifest.files)||manifest.files.length<5||manifest.files.length>10||
     !shaPattern.test(manifest.inputSha256)||!shaPattern.test(manifest.planFamilySha256)||
     !Array.isArray(manifest.sceneSha256)||manifest.sceneSha256.length!==2)
    throw Error('Incomplete or invalid B1a final evidence manifest');
  // A finalized B1a two-run attempt ALWAYS has two real summaries and
  // readouts, even when the native selection itself was unavailable/suppressed.
  // A setup/stale/partial failure deliberately has NO final manifest.
  const known=new Set(['input.json','plan.json','scene-A.ray-optics-2d.json',
    'scene-B.ray-optics-2d.json','native-A.json','native-B.json',
    'readouts-A.json','readouts-B.json','report.json']);
  if(manifest.files.length!==known.size||manifest.nativeAttempted!==2)
    throw Error('Finalized B1a evidence must contain both actual run records.');
  const observed=new Set();
  for(const entry of manifest.files){
    if(!known.has(entry.path)||observed.has(entry.path)||!shaPattern.test(entry.sha256))
      throw Error('Unknown or duplicate evidence manifest path');
    observed.add(entry.path);
    const fpath=resolve(base,entry.path),stat=lstatSync(fpath);
    if(stat.isSymbolicLink()||!stat.isFile())throw Error('Evidence is not a regular file');
    const bytes=readFileSync(fpath);
    if(bytes.length!==entry.bytes||SHA(bytes)!==entry.sha256)
      throw Error('Tampered or inconsistent B1a evidence file');
  }
  for(const required of known)
    if(!observed.has(required))throw Error('Missing required B1a evidence file');
  const plan=JSON.parse(readFileSync(resolve(base,'plan.json'),'utf8'));
  const report=JSON.parse(readFileSync(resolve(base,'report.json'),'utf8'));
  const sceneA=readFileSync(resolve(base,'scene-A.ray-optics-2d.json'));
  const sceneB=readFileSync(resolve(base,'scene-B.ray-optics-2d.json'));
  if(SHA(readFileSync(resolve(base,'input.json')))!==manifest.inputSha256||
     manifest.inputSha256!==plan.inputSha256||report.inputSha256!==manifest.inputSha256||
     manifest.planFamilySha256!==plan.familySha256||report.familySha256!==plan.familySha256||
     SHA(sceneA)!==manifest.sceneSha256[0]||SHA(sceneB)!==manifest.sceneSha256[1]||
     plan.runs[0].sceneSha256!==manifest.sceneSha256[0]||
     plan.runs[1].sceneSha256!==manifest.sceneSha256[1]||
     report.nativeAttempted!==manifest.nativeAttempted||
     report.nativeCompleted!==manifest.nativeCompleted||
     report.nativeAttempted!==2||report.runs?.length!==2||
     report.runs[0].role!=='run-A'||report.runs[1].role!=='run-B'||
     report.runs[0].sceneSha256!==manifest.sceneSha256[0]||
     report.runs[1].sceneSha256!==manifest.sceneSha256[1]||
     report.runs.some(row=>row.familySha256!==manifest.planFamilySha256||
       row.inputSha256!==manifest.inputSha256)||
     report.geometry?.status!=='withheld'||report.geometry?.value!==null)
    throw Error('B1a final manifest and scenario identities do not agree');
  return {status:'verified-finalized-evidence',manifest,report};
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
