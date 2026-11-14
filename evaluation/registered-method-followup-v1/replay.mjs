// Answer-known corrective reauthoring, not a new or independent first attempt.
// Execute only existing registered contracts; never supply an inferred answer
// as apparatus, mutate historical attempts, or invoke an external model.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {reserveAuthoringOutput,writeEvidence} from '../../scripts/authoring-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sourceFile=resolve(root,'evaluation/registered-method-followup-v1/decisions.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
export async function runRegisteredMethodFollowup({outputPath}){
 const input=readFileSync(sourceFile);
 assert.equal(blob(input),'b6c3f268c782775480fee8c4bd32a2b8db5656fe','Follow-up author decisions changed');
 const data=JSON.parse(input);
 assert.equal(data.format,'opticsim-registered-method-followup-v1');
 assert.equal(data.independentEvaluation,false);assert.equal(data.blindEvaluation,false);
 assert.equal(data.newFirstAttemptEvaluation,false);
 assert.deepEqual(data.cases.map(c=>c.id),['F01','F02','F03','F04','F05','F06','F07']);
 const historicalSources={};
 for(const [path,expected] of Object.entries(data.sourceGitBlobs)){
  const bytes=readFileSync(resolve(root,path));assert.equal(blob(bytes),expected,'Historical first attempt changed: '+path);
  historicalSources[path]={gitBlob:blob(bytes),sha256:sha(bytes)};
 }
 const out=reserveAuthoringOutput(outputPath,root);
 assert.ok(out,'A fresh follow-up evidence directory is required');
 writeEvidence(out.input,input);
 const report={format:'opticsim-registered-method-followup-report-v1',
  inputSha256:sha(input),historicalSources,answerKnownFollowup:true,
  independentEvaluation:false,newFirstAttemptEvaluation:false,accuracyScore:null,
  originalFirstAttemptsModified:false,externalModelCalls:0,repairs:0,nativeCalls:0,
  execution:{checkoutSha:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,node:process.version},
  counts:{originalFollowupRequests:0,originalFollowupConditionalResults:0,
   syntheticVariants:0,ambiguousVariants:0,missingFactVariants:0,
   authorScopeDecisionsWithoutExecution:0},cases:[]};
 for(const item of data.cases){
  const base={id:item.id,origin:item.origin,sourceCase:item.sourceCase,
   decision:item.decision,selectionReason:item.reason,nativeCalls:0};
  if(item.decision==='no-direct-registered-method'){
   assert.equal(item.request,null);
   report.counts.authorScopeDecisionsWithoutExecution++;
   report.cases.push({...base,status:'not-submitted',result:null,
    assessment:'same-assistant-scope-judgment-not-engine-result'});
   continue;
  }
  assert.equal(item.decision,'registered-method');assert.ok(item.request);
  const bytes=Buffer.from(JSON.stringify(item.request,null,2)+'\n');let nativeCalls=0;
  const run=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(out.directory,item.id),
   execute:()=>{nativeCalls++;throw Error('This analytical follow-up must not fabricate a native scene');}});
  assert.equal(nativeCalls,0);assert.equal(run.report.dispatch?.nativeCalls,0);
  assert.equal(run.report.dispatch.repairs,0);assert.equal(run.report.dispatch.externalModelCalls,0);
  assert.equal(run.report.native.status,'not-run');assert.equal(run.report.portable.status,'not-created');
  assert.equal(run.report.inputSha256,sha(bytes));
  assert.deepEqual(readFileSync(resolve(run.output,'input.json')),bytes);
  assert.equal(run.report.results.length,1);
  const result=run.report.results[0];
  if(item.origin==='exposed-original'){
   report.counts.originalFollowupRequests++;
   if(result.status==='conditional')report.counts.originalFollowupConditionalResults++;
  }else{
   assert.equal(item.origin,'synthetic-information-loss-variant');report.counts.syntheticVariants++;
   if(result.status==='multiple-solutions')report.counts.ambiguousVariants++;
   if(result.status==='needs-information')report.counts.missingFactVariants++;
  }
  report.cases.push({...base,status:result.status,inputSha256:sha(bytes),exitCode:run.exitCode,
   methodSuitability:run.report.methodSuitability,result,
   assessment:'existing-analytical-method-on-explicit-followup-facts'});
 }
 // The report retains actual outcomes; numerical correctness is separately
 // checked by the regression suite, not fabricated into the replay results.
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {report,output:out.directory};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runRegisteredMethodFollowup({outputPath:resolve(root,'test-artifacts/llm-authoring/registered-method-followup-v1')})
  .then(({report})=>console.log('Registered-method corrective follow-up: '+JSON.stringify(report.counts)))
  .catch(error=>{console.error(error);process.exitCode=1;});
}
