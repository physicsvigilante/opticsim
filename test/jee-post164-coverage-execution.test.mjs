// Developmental coverage evidence, not independent LLM scoring. The original
// first requests and all 20 source dispositions are immutable input records.
// These tests execute current public engine APIs; they change no optics code.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
import {analyzePlaneMirrorAngleQuery} from '../src/mirror-angle-queries.js';
import {analyzeCurvedMirrorQuery} from '../src/curved-mirror-queries.js';
import {analyzePlanarAngleQuery} from '../src/planar-angle-queries.js';
import {analyzeLensTrainQuery} from '../src/lens-train-queries.js';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const home=new URL('../evaluation/jee-post164-coverage-v1/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,home),'utf8'));
const policy=read('policy.json'),sourceReview=read('source-review.json');
const requestBytes=readFileSync(new URL('first-requests.json',home));
const requests=JSON.parse(requestBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const required=['id','sourceFacts','sourceUnknowns','supportedSubset','physicalInputsMissing','authoringDisposition','nativeStatus','analyticalStatus','educationalUse','answerCompleteness','provenanceLimits'];
const numerical=(a,b,tolerance=1e-7)=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const execute={
 'plane-mirror-angle':analyzePlaneMirrorAngleQuery,
 'curved-mirror':analyzeCurvedMirrorQuery,
 'planar-angle':analyzePlanarAngleQuery,
 'lens-train':analyzeLensTrainQuery
};

// Independently written scalar references to source facts; these are ONLY
// checks after public analytical execution, never native ray-generation code.
function referenceCheck(item,result){
 if(result.status!=='conditional'||result.native?.status!=='not-run')return false;
 const v=result.value;
 if(item.caseId==='J03')return numerical(v.incidenceAngleDeg,50);
 if(item.caseId==='J04')return numerical(v.magnification,-2)&&numerical(v.imageHeight,-5)&&v.orientation==='inverted';
 if(item.caseId==='J06')return numerical(v.imageDistance,100)&&numerical(v.velocity.axial,80/Math.sqrt(2))&&numerical(v.velocity.transverse,-20/Math.sqrt(2));
 if(item.caseId==='J10')return numerical(v.initialIncidenceAngleDeg,Math.asin(1.3/1.6)*180/Math.PI)&&numerical(v.criticalIncidenceAngleDeg,Math.asin(1.3/1.8)*180/Math.PI)&&Boolean(v.decreasingInitialIncidence);
 if(item.caseId==='J18')return numerical(v.imageDistance,7.5)&&numerical(v.imageX,37.5)&&v.referenceLensId==='L2';
 if(item.caseId==='J05'){
  if(item.subsetId==='phase-zero')return numerical(v.imageDistanceOverFocalLength,1.5)&&numerical(v.magnification,-0.5);
  if(item.subsetId==='quarter-period')return numerical(v.imageDistanceOverFocalLength,2)&&numerical(v.magnification,-1);
  return v.imageKind==='at-infinity'&&v.imageDistance===null&&v.magnification===null;
 }
 return false;
}

test('post164 developmental trial retains 20 source cases, all initial attempts, and separate native illustration provenance',async()=>{
 assert.equal(sourceReview.solutionsRead,false);
 assert.equal(sourceReview.engineBaseline,policy.engineBaseline);
 assert.equal(requests.engineBaseline,policy.engineBaseline);
 assert.deepEqual(sourceReview.cases.map(x=>x.id),policy.casePaths.map(x=>x[0]));
 assert.equal(sourceReview.cases.length,20);
 assert.equal(requests.analyticalRequests.length,5);
 assert.equal(requests.subsetRequests.length,3);
 for(const c of sourceReview.cases){
  for(const key of required)assert.ok(Object.hasOwn(c,key),c.id+' missing '+key);
  assert.equal(c.nativeStatus,'not-run','The frozen source review must not claim later execution');
 }
 const archive=readFileSync(resolve(root,policy.sourceArchive));
 assert.equal(sha(archive),policy.sourceArchiveSha256);
 const out=resolve(root,'test-artifacts/llm-authoring/jee-post164-coverage-execution-v1');
 assert.equal(existsSync(out),false,'Do not overwrite previous first attempts');
 mkdirSync(out,{recursive:true});
 const save=(path,value)=>writeFileSync(resolve(out,path),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 writeFileSync(resolve(out,'first-requests.json'),requestBytes,{flag:'wx'});
 const sourceBound=sourceReview.cases.map(c=>{
  const selected=policy.casePaths.find(x=>x[0]===c.id);
  const problemPath='08_Ray_Optics_Explanations/'+selected[1]+'/Problems/'+selected[2]+'.png';
  const png=readProblemPng(archive,problemPath);
  return {...c,problemPath,imageSha256:sha(png)};
 });
 save('source-review-bound.json',{...sourceReview,cases:sourceBound});
 const results=[];
 for(const item of [...requests.analyticalRequests,...requests.subsetRequests]){
  const original=JSON.stringify(item);
  let result;
  try{result=execute[item.api](structuredClone(item.facts),structuredClone(item.query));}
  catch(error){result={status:'request-error',value:null,error:{name:error.name,code:error.code??null,message:String(error.message)},native:{status:'not-run',observations:null}};}
  assert.equal(JSON.stringify(item),original);
  assert.equal(result.native?.status,'not-run','No analytical result may become a native measurement');
  const accepted=referenceCheck(item,result);
  const row={caseId:item.caseId,subsetId:item.subsetId??null,api:item.api,scope:item.scope,
   firstRequestSha256:sha(Buffer.from(original)),result,
   independentScalarReferenceAgreement:accepted,
   assessmentProvenance:'Builder-authored scalar comparison, not independent review or source solution access',
   originalQuestionFullySimulated:false,nativeExecutions:0};
  results.push(row);
  save(item.caseId+(item.subsetId?'-'+item.subsetId:'')+'-analytical-result.json',row);
 }
 const illustrations=[];
 const core=createRequire(import.meta.url)('../dist/test-core.cjs');
 for(const item of requests.teachingIllustrations){
  assert.equal(item.originalQuestionFullySpecifiedNativeScene,false);
  assert.equal(item.nativeSuccessCountsAsOriginalQuestionSuccess,false);
  let result;
  try{
   const d=prepareScene(item.physical).document;
   writeFileSync(resolve(out,item.id+'-scene.ray-optics-2d.json'),serializeSave(d),{flag:'wx'});
   const native=evaluateDocument(d,core,item.requests).summary;
   const observed=await evaluateObservables(d,item.requests,native);
   const by=Object.fromEntries(observed.results.map(x=>[x.id,x]));
   const fresh=observed.canonicalSha256===native.canonicalSha256;
   const qualified=x=>x&&['available','qualified'].includes(x.status);
   const complete=native.executionPassed===true&&['completed','completed-with-warnings'].includes(native.native.status);
   const hits=qualified(by.hits)&&Array.isArray(by.hits.value)?by.hits.value:null;
   const valid=complete&&fresh&&qualified(by.emitted)&&qualified(by.crossings)&&by.crossings.value>0&&hits!==null&&hits.length===by.crossings.value;
   const maximumTransverseHitMagnitudeMm=hits?.length?Math.max(...hits.map(x=>Math.abs(x.pointMm.y))):null;
   result={id:item.id,sourceCaseId:item.sourceCaseId,illustrationOnly:true,
    originalQuestionFullySpecifiedNativeScene:false,nativeSuccessCountsAsOriginalQuestionSuccess:false,
    addedPhysicalChoices:item.addedPhysicalChoices,status:valid?'qualified-native-illustration':'native-illustration-not-qualified',
    schemaVersion:d.schemaVersion,nativeStatus:native.native.status,
    executionPassed:native.executionPassed,canonicalSha256:native.canonicalSha256,
    actualReadings:observed.results,maximumTransverseHitMagnitudeMm,
    nativeImageDetected:false,
    limitation:'A sample crossing of a detector placed at a predicted Gaussian image plane is not native physical-image reconstruction, and the added apparatus is not source-stated data.'};
   save(item.id+'-native-summary.json',native);
  }catch(error){result={id:item.id,sourceCaseId:item.sourceCaseId,illustrationOnly:true,
    originalQuestionFullySpecifiedNativeScene:false,nativeSuccessCountsAsOriginalQuestionSuccess:false,
    status:'illustration-error',error:{name:error.name,code:error.code??null,message:String(error.message)},nativeImageDetected:false};}
  illustrations.push(result);save(item.id+'-result.json',result);
 }
 const originalRequests=results.filter(x=>x.subsetId===null);
 const subsets=results.filter(x=>x.subsetId!==null);
 const report={format:'opticsim-jee-post164-development-results-v1',engineBaseline:policy.engineBaseline,
  sourceArchiveSha256:policy.sourceArchiveSha256,firstRequestsFileSha256:sha(requestBytes),
  sourceCases:20,sourceImagesDirectlyInspected:20,solutionsRead:false,
  sameAssistantDevelopmentAudit:true,independentModelBenchmark:false,
  analyticalSourceCasesAttempted:originalRequests.length,
  analyticalSourceCasesReferenceMatched:originalRequests.filter(x=>x.independentScalarReferenceAgreement).length,
  partialCaseIds:[...new Set(subsets.map(x=>x.caseId))],partialAnalyticalExecutions:subsets.length,
  partialExecutionsReferenceMatched:subsets.filter(x=>x.independentScalarReferenceAgreement).length,
  originalProblemNativeSuccesses:0,illustrationNativeRunsAttempted:illustrations.length,
  illustrationsQualified:illustrations.filter(x=>x.status==='qualified-native-illustration').length,
  allOtherSourceDispositionsRetained:sourceBound.filter(c=>!results.some(x=>x.caseId===c.id)).map(c=>({id:c.id,disposition:c.authoringDisposition})),
  analyticalResults:results,teachingIllustrations:illustrations,
  limitations:['Counts are development diagnostics, not solved-question percentage, independent grading or representative JEE coverage.',
   'Five source-derived reduced requests use declared ideal/paraxial assumptions; the remaining 15 cases were not silently discarded.',
   'The three phase probes concern one partially supported symbolic question, not three extra original questions.',
   'The native illustration has added physical choices and must never be counted as an original-source fully specified native success.']};
 save('report.json',report);
 console.log('JEE_POST164_COVERAGE_EXECUTION '+JSON.stringify({
  cases:report.sourceCases,analyticalSourceCasesAttempted:report.analyticalSourceCasesAttempted,
  analyticalSourceCasesReferenceMatched:report.analyticalSourceCasesReferenceMatched,
  partialAnalyticalExecutions:report.partialAnalyticalExecutions,partialReferenceMatches:report.partialExecutionsReferenceMatched,
  originalProblemNativeSuccesses:0,illustrationsQualified:report.illustrationsQualified,
  independentBenchmark:false,solutionsRead:false,
  nativeIllustration:illustrations.map(x=>({id:x.id,status:x.status,nativeStatus:x.nativeStatus,maxAbsYmm:x.maximumTransverseHitMagnitudeMm}))
 }));
 // Check evidence integrity, not a fabricated target accuracy percentage.
 assert.equal(report.sourceCases,20);assert.equal(results.length,8);
 assert.ok(existsSync(resolve(out,'report.json')));
 assert.ok(sourceBound.every(x=>x.imageSha256.length===64&&x.problemPath.includes('/Problems/')));
});
