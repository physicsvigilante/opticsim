// Sealed same-assistant developmental authoring evaluation.
// NO independent model API, no textbook images, no repairs or reruns.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';
import {LENGTH_PARAMETERS} from '../../src/contract.js';
import {planProblem} from '../../src/problem-workflow.js';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {observableCapabilities} from '../../src/observables.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const here=fileURLToPath(new URL('.',import.meta.url));
const require=createRequire(import.meta.url);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const shaBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
export const pinnedBlobs=Object.freeze({
 'policy.json':'de7303959628f9b0149ae57b793d5aa68fc00fdc',
 'prompts.json':'68de0b6a85f979c1c07bbae984ef27306e540d78',
 'first-attempts.json':'1b9676e93fc801a371e6e8d987c82ad0781db923',
 'reference.json':'50c8d9599aa4b642f14870acfdb8cc32fcd1b2d7'
});
const exact=(name)=>{
 const bytes=readFileSync(resolve(here,name));
 assert.equal(shaBlob(bytes),pinnedBlobs[name],name+': sealed Git blob changed');
 return {bytes,data:JSON.parse(bytes.toString('utf8')),sha256:sha256(bytes)};
};
const kindTypes=observableCapabilities().kinds;
// Use the live physical registry: later vertex coordinates must not silently
// escape unit conversion in invalid/missing-fact controls or stable-ID scoring.
const lengthKeys=new Set(LENGTH_PARAMETERS);
const scale={mm:1,cm:10,m:1000};
const sortObject=obj=>Object.fromEntries(Object.entries(obj).sort(([a],[b])=>a.localeCompare(b)));
const signature=(component,units,includeId)=>{
 if(!component||typeof component.type!=='string'||!component.parameters)return null;
 const params=Object.fromEntries(Object.entries(component.parameters).map(([k,v])=>
  [k,typeof v==='number'&&lengthKeys.has(k)?Number((v*units).toFixed(7)):v]));
 const emission=component.type==='point-source'&&component.emission?component.emission.mode==='full-circle'?
  {mode:'full-circle'}:component.emission.mode==='single-ray'?
  {mode:'single-ray',directionDeg:component.emission.directionDeg}:
  {mode:'directional',directionDeg:component.emission.directionDeg,angleDeg:component.emission.angleDeg}:null;
 return JSON.stringify(sortObject({...(includeId?{id:component.id}:{}),type:component.type,
  parameters:sortObject(params),...(emission?{emission:sortObject(emission)}:{})}));
};
export function physicalSignatures(physical,{includeIds=false,validateSupported=false}={}){
 if(physical===null)return null;
 if(!physical||!scale[physical.lengthUnit]||!Array.isArray(physical.components))return null;
 try{
  const doc=validateSupported?prepareScene(physical).document:null;
  const components=doc?doc.physics.components:physical.components;
  const unit=doc?1:scale[physical.lengthUnit];
  const result=components.map(c=>signature(c,unit,includeIds));
  return result.includes(null)?null:result.sort();
 }catch{return null;}
}
const sortedKinds=request=>Array.isArray(request?.requests)?
 request.requests.map(r=>r.kind).sort():[];
const equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const statusOf=(r)=>['available','qualified','conditional'].includes(r.status)?'available':r.status;
export function scoreAuthoring(reference,attempt,preflight,run){
 const expected=reference,request=attempt.response,results=run.report.results||[];
 const supported=expected.classification==='supported';
 const oraclePhysical=physicalSignatures(expected.expectedPhysical,{
  validateSupported:supported||expected.id==='N03'});
 const authoredPhysical=physicalSignatures(request.physical,{
  validateSupported:supported||expected.id==='N03'});
 const physicalFidelity=equivalent(oraclePhysical,authoredPhysical)&&oraclePhysical!==null||
  expected.expectedPhysical===null&&request.physical===null;
 const idsFaithful=equivalent(physicalSignatures(expected.expectedPhysical,{includeIds:true}),
  physicalSignatures(request.physical,{includeIds:true}));
 const kindFidelity=equivalent(sortedKinds(request),[...expected.requestKinds].sort());
 const preflightStatus=preflight.status;
 const preflightCorrect=preflightStatus===expected.expectedPreflight;
 const resultStatuses=results.map(r=>statusOf(r));
 const resultCorrect=supported?results.length===expected.requestKinds.length&&
  results.every(r=>statusOf(r)==='available'):
  results.length===1&&results[0].status===expected.expectedFirstStatus&&
  (!expected.reasonCode||results[0].reasonCode===expected.reasonCode);
 const noNativeForNegative=!supported?run.report.dispatch.nativeCalls===0:null;
 const negativeDiscipline=supported?null:
  preflightCorrect&&resultCorrect&&noNativeForNegative&&physicalFidelity&&kindFidelity;
 const targets=run.report.targetBindings||[];
 const nativeComplete=run.report.dispatch.nativeCalls===1&&
  ['completed','completed-with-warnings'].includes(run.report.native.status);
 const nativeReady=preflight.native?.canRun===true;
 return {id:expected.id,classification:expected.classification,
  physicalFidelity,idsFaithful,kindFidelity,preflightCorrect,
  preflightStatus,preflightIssues:preflight.results?.map(x=>x.reasonCode).filter(Boolean)||[],
  resultCorrect,resultStatuses,resultReasonCodes:results.map(x=>x.reasonCode||null),
  nativeReady,nativeAttempted:run.report.dispatch.nativeCalls===1,nativeComplete,
  nativeStatus:run.report.native.status,
  resultsAvailable:run.report.coverage?.available??0,resultsRequested:run.report.coverage?.requested??0,
  targetIdsSaved:targets.length,targetBindings:targets,
  negativeDiscipline,repairs:run.report.dispatch.repairs,
  externalModelCalls:run.report.dispatch.externalModelCalls,
  interpretation:'not-assessed-by-engine'};
}
function readManifests(){
 const values=Object.fromEntries(Object.keys(pinnedBlobs).map(name=>[name,exact(name)]));
 const policy=values['policy.json'].data,prompts=values['prompts.json'].data,
  attempts=values['first-attempts.json'].data,reference=values['reference.json'].data;
 assert.equal(policy.baselineCommit,'2fe40f33dd9e5189bef6d34352d8b3aa6463c510');
 assert.equal(attempts.promptFreezeCommit,'08518e49cea9a27e9e73965a9954618ac9517b26');
 assert.equal(reference.firstAttemptsFreezeCommit,'ab792a3923da13f956eded1fa364d8089875bb21');
 assert.equal(attempts.independentModel,false);assert.equal(attempts.externalModelCalls,0);
 assert.equal(attempts.repairs,0);
 assert.equal(prompts.cases.length,12);assert.equal(attempts.attempts.length,12);
 assert.equal(reference.cases.length,12);
 for(let i=0;i<12;i++){
  assert.equal(prompts.cases[i].id,attempts.attempts[i].id);
  assert.equal(prompts.cases[i].id,reference.cases[i].id);
  assert.equal(prompts.cases[i].class,reference.cases[i].classification);
 }
 return {policy,prompts,attempts,reference,
  frozenHashes:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v.sha256]))};
}
export const manifestSnapshot=()=>readManifests();
const safeOutput=(relative)=>{
 const out=resolve(root,relative),base=resolve(root,'test-artifacts/llm-evaluation')+sep;
 if(!out.startsWith(base)||out===base.slice(0,-1))
  throw Error('Output must be a fresh child of test-artifacts/llm-evaluation');
 if(existsSync(out))throw Error('Existing evaluation evidence is immutable; choose a fresh path');
 return out;
};
export async function replay({output='test-artifacts/llm-evaluation/cross-family-v3'}={}){
 const data=readManifests(),out=safeOutput(output),prefix=out.slice(resolve(root,'test-artifacts/llm-evaluation').length+1);
 const nativeRoot=resolve(root,'test-artifacts/llm-authoring/cross-family-v3-'+prefix.replace(/[^a-zA-Z0-9_-]/g,'_'));
 if(existsSync(nativeRoot))throw Error('Existing native first-run evidence; use a fresh output name');
 mkdirSync(out,{recursive:true});
 const core=require(resolve(root,'dist/test-core.cjs'));
 const rows=[],inputs=[],executionDetails=[];
 const array=data.attempts.attempts;
 for(let i=0;i<array.length;i++){
  const id=array[i].id,reference=data.reference.cases[i];
  const sourceBytes=Buffer.from(JSON.stringify(array[i].response,null,2)+'\n');
  const inputFile=resolve(out,id+'.input.json');
  writeFileSync(inputFile,sourceBytes,{flag:'wx'});
  inputs.push({id,sha256:sha256(sourceBytes)});
  // Run exact existing no-native preflight CLI BEFORE any physics execution.
  const proc=spawnSync(process.execPath,[resolve(root,'scripts/preflight-problem.mjs'),inputFile],
   {encoding:'utf8',cwd:root,timeout:10000,maxBuffer:1024*1024});
  if(proc.error)throw proc.error;
  if(![0,2].includes(proc.status))throw Error(id+': preflight infrastructure failure: '+proc.stderr);
  const preflight=JSON.parse(proc.stdout);
  assert.equal(preflight.inputSha256,sha256(sourceBytes));
  assert.equal(preflight.native.status,'not-run');assert.equal(preflight.native.calls,0);
  writeFileSync(resolve(out,id+'.preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
  let actualExecutorCalls=0;
  const run=await runProblemEvidence({inputBytes:sourceBytes,
   outputPath:resolve(nativeRoot,id),
   execute:async scene=>{actualExecutorCalls++;return evaluateDocument(scene,core);}});
  assert.equal(actualExecutorCalls,run.report.dispatch.nativeCalls,id+': executor call count diverged');
  assert.equal(run.report.dispatch.repairs,0);
  assert.equal(run.report.dispatch.externalModelCalls,0);
  assert.equal(run.report.inputSha256,sha256(sourceBytes));
  const row=scoreAuthoring(reference,array[i],preflight,run);
  rows.push(row);
  executionDetails.push({id,inputSha256:sha256(sourceBytes),preflight:preflight.status,
   native:run.report.native.status,exitCode:run.exitCode,reportedStatus:run.report.status,
   outputPath:resolve(nativeRoot,id).slice(root.length+1)});
 }
 const supported=rows.filter(r=>r.classification==='supported');
 const negative=rows.filter(r=>r.classification!=='supported');
 const totals={
  total:rows.length,supported:supported.length,negative:negative.length,
  physicalFidelity:rows.filter(r=>r.physicalFidelity).length,
  idsFaithful:rows.filter(r=>r.idsFaithful).length,
  requestedKindsFaithful:rows.filter(r=>r.kindFidelity).length,
  preflightClassificationCorrect:rows.filter(r=>r.preflightCorrect).length,
  fullySpecifiedAndNativeReady:supported.filter(r=>r.nativeReady).length,
  supportedExecuted:supported.filter(r=>r.nativeAttempted).length,
  supportedNativeComplete:supported.filter(r=>r.nativeComplete).length,
  supportedAllRequestedAvailable:supported.filter(r=>r.resultCorrect).length,
  negativeCorrectRejection:negative.filter(r=>r.negativeDiscipline).length,
  nativeExecutorCalls:rows.filter(r=>r.nativeAttempted).length,
  externalModelCalls:0,repairs:0,
  uniqueTargetIdsAvoided:rows.reduce((n,r)=>n+r.targetIdsSaved,0),
  independentModelAccuracy:null,
  originalTextbookQuestionsSolved:null
 };
 const report={format:'opticsim-cross-family-prospective-review-v1',
  evaluationType:'same-assistant synthetic authoring development control; NOT independent-model benchmark',
  baseline:data.policy.baselineCommit,
  promptFreezeCommit:'08518e49cea9a27e9e73965a9954618ac9517b26',
  firstAttemptFreezeCommit:'ab792a3923da13f956eded1fa364d8089875bb21',
  referenceWrittenAfterAttempt:true,
  pinnedUnmodifiedUpstream:data.policy.pinnedUpstream,
  frozenManifestSha256:data.frozenHashes,
  sample:'Eight fully specified synthetic positives and four hard negatives; deliberately selected, not representative or unbiased.',
  counts:totals,inputs,rows,executionDetails,
  limitations:['Question/fact prompts, attempts and reference were created by the same assistant; no independent model ran.',
    'Reference checks textual facts and bounded requested quantities, not independent image interpretation or exact numeric textbook answer.',
    'Native software completion and validation cannot establish fidelity to a different original problem.',
    'No source-specific ray-route attribution, full Fresnel completion guarantee or answer substitution.',
    'The first-attempt objects are preserved in one sealed file; per-case input byte serialization is deterministic for replay.']};
 writeFileSync(resolve(out,'review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'completed',counts:totals,report:resolve(out,'review.json')},null,2));
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length&&!(args.length===2&&args[0]==='--out')){
  console.error('Usage: node evaluation/cross-family-prospective-v3/replay.mjs [--out test-artifacts/llm-evaluation/<fresh>]');
  process.exitCode=1;
 }else replay({...(args.length?{output:args[1]}:{})}).catch(e=>{
  console.error('Cross-family first-attempt replay failed: '+e.stack);process.exitCode=1;
 });
}
