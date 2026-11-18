// Bounded opt-in NATIVE sampled-arrival witness for a fully specified,
// independently reviewed conditional source-to-observer planar query.
// The analytical query DOES NOT execute native rays. Only a separate, fully
// authored canonical v5 scene can request actual PhyDemo detector evidence.
// Native PhyDemo owns every encounter; no optical itinerary, source ancestry,
// physical image, human observer or point-spread function is manufactured.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeObserverPointQuery} from '../src/planar-observer-point-query.js';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateObservables} from '../src/observables.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const FORMAT='opticsim-observer-native-witness-v1';
const REPORT_FORMAT='opticsim-observer-native-witness-evidence-v1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const OBSERVATIONS=Object.freeze([
 {id:'emissions',kind:'source-emissions',componentId:'S1'},
 {id:'encounters',kind:'interface-interactions',componentId:'I1'},
 {id:'first',kind:'interface-first-event',componentId:'I1'},
 {id:'crossings',kind:'detector-crossings',componentId:'D1'},
 {id:'hits',kind:'detector-hit-events',componentId:'D1'}
]);
function exactFields(value,keys,required,context){
 if(!isRecord(value)||Object.keys(value).some(k=>!keys.includes(k))||
    required.some(k=>!own(value,k)))throw Error('Invalid '+context+' fields');
}
function boundedNumber(x,label,lo,hi){
 if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)
  throw Error(label+' must be finite within ['+lo+','+hi+']');
 return x;
}
export function nativeObserverWitnessCapabilities(){
 return {format:FORMAT,
  kind:'one-source-one-plane-one-detector-actual-native-arrival',
  inputFields:['format','analyticalQuery','physicalVerification'],
  physicalVerification:{
   fields:['sourceBrightness','partialReflection','runPolicy','detector','arrivalToleranceMm','directionTolerance'],
   runPolicy:['preview-v1','dense-v1'],
   detector:{alignment:'tangent-to-interface',lengthMm:'1 through 200'},
   arrivalToleranceMm:[0.0000001,1],
   directionTolerance:[1e-9,1e-3]
  },
  statuses:['verified-sampled-arrival','measured-miss','native-evidence-unavailable',
   'native-incomplete','native-error','physical-scene-refused',
   'analysis-unqualified','rejected','native-infrastructure-error'],
  limits:['One explicit point source, one infinite planar interface, one finite observer-centered passive detector.',
   'Verified means one actual native detector crossing was measured within the EXPLICITLY requested positional and direction tolerances, on a complete and fresh native trace.',
   'This does not certify all nearby or unsampled trajectories, observer perception, physical image, irradiance, or future source-to-observer accuracy.',
   'The incident heading is analytically proposed and authored as an explicit SingleRay; PhyDemo independently traces the forward ray, not an inverse optical solver.',
   'Fresnel policy and numerical preset must be explicitly selected; incomplete native evidence is always suppressed.',
   'No native interface crossing point is measured; an analytical interface crossing remains predicted only.']};
}
function validatedRequest(request){
 exactFields(request,['format','analyticalQuery','physicalVerification'],
  ['format','analyticalQuery','physicalVerification'],'native witness');
 if(request.format!==FORMAT)throw Error('Unsupported native witness format');
 const p=request.physicalVerification;
 exactFields(p,['sourceBrightness','partialReflection','runPolicy','detector',
  'arrivalToleranceMm','directionTolerance'],
 ['sourceBrightness','partialReflection','runPolicy','detector',
  'arrivalToleranceMm','directionTolerance'],'physical verification');
 boundedNumber(p.sourceBrightness,'sourceBrightness',.01,1);
 if(typeof p.partialReflection!=='boolean')throw Error('Explicit partialReflection boolean is required');
 if(!['preview-v1','dense-v1'].includes(p.runPolicy))
  throw Error('Select an explicit supported runPolicy');
 exactFields(p.detector,['alignment','lengthMm'],
  ['alignment','lengthMm'],'finite detector');
 if(p.detector.alignment!=='tangent-to-interface')
  throw Error('The witness uses an explicitly chosen tangent-to-interface detector');
 boundedNumber(p.detector.lengthMm,'detector.lengthMm',1,200);
 boundedNumber(p.arrivalToleranceMm,'arrivalToleranceMm',1e-7,1);
 boundedNumber(p.directionTolerance,'directionTolerance',1e-9,1e-3);
 return p;
}
function physicalRequest(analyticalQuery,settings,analysis){
 const scale={mm:1,cm:10,m:1000}[analyticalQuery.lengthUnit];
 const p=analyticalQuery.interface,observer=analysis.value.observerMm;
 // A detector tangent to the infinite interface is the declared physical
 // witness convention. Its length and anchoring point are EXPLICITly authored.
 let detectorTangent=p.normalDeg+90;
 if(detectorTangent>180)detectorTangent-=360;
 return {lengthUnit:'mm',runPolicy:settings.runPolicy,
  title:'Native witness for stated single-plane observer-position ray',
  components:[
   {id:'S1',type:'point-source',parameters:{
    x:analysis.value.sourceMm.x,y:analysis.value.sourceMm.y,
    brightness:settings.sourceBrightness},
    emission:{mode:'single-ray',
     directionDeg:analysis.value.predictedInitialDirectionDeg}},
   {id:'I1',type:'planar-interface',parameters:{
    x:p.x*scale,y:p.y*scale,normalDeg:p.normalDeg,
    negativeIndex:p.sourceIndex,positiveIndex:p.observerIndex,
    partialReflection:settings.partialReflection}},
   {id:'D1',type:'ray-detector',parameters:{
    x:observer.x,y:observer.y,length:settings.detector.lengthMm,
    orientationDeg:detectorTangent}}
  ]};
}
function distance(a,b){
 return a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
}
function evidenceResult(analysis,settings,summary,observed){
 const native={status:summary?.native?.status??'failed',
  executionPassed:summary?.executionPassed===true,
  canonicalSha256:summary?.canonicalSha256??null,
  warnings:summary?.native?.warnings??[],
  nativeImageDetected:false};
 const withheld=(status,reason,code)=>({
  status,reason,reasonCode:code,
  native,actualDetectorHit:null,actualIncomingDirection:null,
  arrivalErrorMm:null,arrivalWithinDeclaredTolerance:false,
  nativeImageDetected:false
 });
 if(!['completed','completed-with-warnings'].includes(native.status)||
    !native.executionPassed)
  return withheld(native.status==='incomplete'||native.status==='stopped'?
   'native-incomplete':'native-error',
   'Native execution did not finish successfully; partial measurements are not accepted.',
   'NATIVE_INCOMPLETE_OR_FAILED');
 if(observed?.canonicalSha256!==native.canonicalSha256)
  return withheld('native-evidence-unavailable',
   'Canonical scene digest mismatch; native evidence is stale.',
   'STALE_NATIVE_EVIDENCE');
 const by=Object.fromEntries((observed.results||[]).map(r=>[r.id,r]));
 const emitted=by.emissions,crossings=by.crossings,interactions=by.encounters;
 const first=by.first,hits=by.hits;
 const allPresent=[emitted,crossings,interactions,first,hits].every(x=>
  x&&['available','qualified'].includes(x.status));
 if(!allPresent||first.method!=='native-observation'||
    hits.method!=='native-hit-event-observation')
  return withheld('native-evidence-unavailable',
   'Requested complete native source/interface/hit evidence is absent or withheld.',
   'MISSING_QUALIFIED_NATIVE_EVIDENCE');
 const event=first.value;
 const countMatch=emitted.value===1&&interactions.value===1&&
  crossings.value===1&&Array.isArray(hits.value)&&hits.value.length===1&&
  event?.outcome==='transmission'&&
  event.incidentIndex===analysis.sourceIndex&&
  event.destinationIndex===analysis.observerIndex&&
  event.branches?.filter(b=>b.kind==='transmitted').length===1;
 if(!countMatch)return withheld('native-evidence-unavailable',
  'Native sample counts, medium indices or transmitted branch do not match the bounded single-ray witness.',
  'UNQUALIFIED_NATIVE_SAMPLE');
 const eventDirection=event.branches.find(b=>b.kind==='transmitted').direction;
 const hit=hits.value[0],directionError=distance(hit?.incomingUnit,analysis.value.outgoingUnit);
 const branchError=distance(hit?.incomingUnit,eventDirection);
 const arrivalError=distance(hit?.pointMm,analysis.value.observerMm);
 if(!Number.isFinite(arrivalError)||!Number.isFinite(directionError)||
    !Number.isFinite(branchError))
  return withheld('native-evidence-unavailable',
   'Measured native hit or direction is nonfinite.',
   'NONFINITE_NATIVE_HIT');
 const hitWithin=arrivalError<=settings.arrivalToleranceMm;
 const directionWithin=directionError<=settings.directionTolerance&&
  branchError<=settings.directionTolerance;
 const success=hitWithin&&directionWithin;
 return {status:success?'verified-sampled-arrival':'measured-miss',
  reason:success?
   'One native sampled ray reached the declared observer point within the stated positional and direction tolerances.':
   'A real native detector crossing occurred, but the declared arrival and direction tolerances were not both met.',
  reasonCode:success?null:'DECLARED_TOLERANCE_NOT_MET',
  native,method:'actual-native-single-ray-detector-hit',
  actualDetectorHit:structuredClone(hit.pointMm),
  actualIncomingDirection:structuredClone(hit.incomingUnit),
  arrivalErrorMm:arrivalError,directionError,branchDirectionError:branchError,
  declaredArrivalToleranceMm:settings.arrivalToleranceMm,
  declaredDirectionTolerance:settings.directionTolerance,
  arrivalWithinDeclaredTolerance:hitWithin,
  directionWithinDeclaredTolerance:directionWithin,
  nativeImageDetected:false,
  limitations:'A single sampled detector hit is not a perceived image, a continuous beam, source ancestry or proof of any untested geometry. The analytical interface crossing is not directly observed by the native interface record.',
  warnings:[...(hits.warnings||[])]};
}
async function realNativeExecution(scene,requests){
 // The pinned test core is installed by existing project setup; build it
 // directly, rather than substituting a custom ray tracer or guessed paths.
 execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
  {cwd:root,stdio:['ignore','pipe','pipe']});
 const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
 return evaluateDocument(scene,core,requests).summary;
}
export async function runObserverNativeWitness({requestBytes,outputPath,
 executeNative=realNativeExecution}){
 if(!requestBytes||requestBytes.length===0||requestBytes.length>1024*1024)
  throw Error('The original JSON request must be nonempty and within 1 MB');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A fresh evidence output directory is required');
 writeEvidence(out.input,requestBytes);
 const originalInputSha256=hash(requestBytes);
 const report=(status,extras={})=>({
  format:REPORT_FORMAT,status,originalInputSha256,
  questionSupport:'not-assessed-by-engine',
  interpretation:'not-assessed-by-engine',
  ...extras});
 let request,settings,analysis;
 try{
  request=JSON.parse(Buffer.from(requestBytes).toString('utf8'));
  settings=validatedRequest(request);
  analysis=analyzeObserverPointQuery(request.analyticalQuery);
 }catch(error){
  const result=report('rejected',{
   issues:[{code:'INVALID_NATIVE_WITNESS_INPUT',message:String(error.message)}],
   native:{status:'not-run',observations:null,nativeImageDetected:false}});
  writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');
  return {status:'rejected',exitCode:1,report:result,reportPath:out.report};
 }
 // Persist the conditional result BEFORE any setup, preparation or native
 // invocation. No stopped native run may erase a valid analytical result.
 const a={format:'opticsim-observer-native-witness-analytical-v1',
  originalInputSha256,result:analysis,
  native:{status:'not-run',observations:null,nativeImageDetected:false}};
 writeEvidence(resolve(out.directory,'analytical-result.json'),JSON.stringify(a,null,2)+'\n');
 if(analysis.status!=='conditional'||!analysis.value){
  const result=report('analysis-unqualified',{
    analyticalResult:analysis,
    reason:'The conditional analytical query was not numerically admitted. No native scene was authored.',
    native:{status:'not-run',observations:null,nativeImageDetected:false}});
  writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');
  return {status:'analysis-unqualified',exitCode:0,report:result,reportPath:out.report};
 }
 let scene,preparation,sceneSha256;
 try{
  const prepared=prepareScene(physicalRequest(request.analyticalQuery,settings,analysis));
  scene=prepared.document;
  preparation=prepared.preparation;
  const bytes=serializeSave(scene);
  sceneSha256=hash(bytes);
  writeEvidence(out.scene,bytes);
 }catch(error){
  const result=report('physical-scene-refused',{
   analyticalResult:analysis,
   issues:[{code:'NATIVE_WITNESS_SCENE_REFUSED',message:String(error.message)}],
   native:{status:'not-run',observations:null,nativeImageDetected:false}});
  writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');
  return {status:'physical-scene-refused',exitCode:0,report:result,reportPath:out.report};
 }
 let run,readings;
 try{
  run=await executeNative(scene,OBSERVATIONS);
  readings=await evaluateObservables(scene,OBSERVATIONS,run);
 }catch(error){
  const result=report('native-infrastructure-error',{
    analyticalResult:analysis,sceneSha256,preparation,
    reason:String(error.message),
    native:{status:'failed',observations:null,nativeImageDetected:false}});
  writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');
  return {status:'native-infrastructure-error',exitCode:2,report:result,reportPath:out.report};
 }
 const checked=evidenceResult(analysis,settings,run,readings);
 const result=report(checked.status,{
  analyticalResult:analysis,
  sceneSha256,preparation,
  actualNativeResult:checked,
  native:checked.native,
  actualReadings:readings.results,
  distinction:'Predicted interface crossing and virtual-axis location are analytical; only the actual detector hit and incoming direction are qualified native observations.'});
 writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');
 return {status:checked.status,
  exitCode:checked.status==='verified-sampled-arrival'?0:2,
  report:result,reportPath:out.report};
}
function usage(){
 return 'Usage: node scripts/jee-observer-native-witness.mjs capabilities | <witness-request.json> --out test-artifacts/llm-authoring/<new-directory>';
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  console.log(JSON.stringify(nativeObserverWitnessCapabilities(),null,2));return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage());
 const bytes=readFileSync(resolve(args[0]));
 if(bytes.length>1024*1024)throw Error('Input exceeds 1 MB limit');
 const result=await runObserverNativeWitness({requestBytes:bytes,outputPath:args[2]});
 console.log(JSON.stringify({status:result.status,
  native:result.report.native,
  arrivedWithinDeclaredTolerance:result.report.actualNativeResult?.arrivalWithinDeclaredTolerance??false,
  report:result.reportPath},null,2));
 process.exitCode=result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(error=>{
  console.error(JSON.stringify({status:'infrastructure-error',
   message:String(error.message)}));
  process.exitCode=2;
 });
