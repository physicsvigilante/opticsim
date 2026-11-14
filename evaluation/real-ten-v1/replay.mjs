// Replay fixed first submissions and record unavailable results honestly.
// Ordinary CI reads Problems PNGs only, not Solutions images or new model calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadTrial,summarizeTrial,ROOT,DIR,FIRST_FREEZE,FIRST_BLOB,sha256} from './protocol.mjs';
import {readProblemPng} from '../llm-pilot-v1/independent-inference.mjs';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {reserveAuthoringOutput} from '../../scripts/authoring-evidence.mjs';
const require=createRequire(import.meta.url);
export async function replayRealTen({output=resolve(ROOT,'test-artifacts/llm-authoring/real-ten-v1')}={}){
 const data=loadTrial(),{selection,first,review}=data;
 const archive=readFileSync(resolve(ROOT,selection.archiveFile));
 assert.equal(sha256(archive),selection.archiveSha256);
 const out=reserveAuthoringOutput(output,ROOT).directory;
 const save=(name,bytes)=>writeFileSync(resolve(out,name),bytes,{flag:'wx'});
 const saveJSON=(name,x)=>save(name,JSON.stringify(x,null,2)+'\n');
 save('selection.json',data.selectionBytes);save('first-attempts.json',data.firstBytes);save('post-solution-review.json',data.reviewBytes);
 const records=[],derivedChecks=[];
 let totalExecutorCalls=0,core;
 const execute=scene=>{totalExecutorCalls++;core??=require(resolve(ROOT,'dist/test-core.cjs'));return evaluateDocument(scene,core);};
 for(let i=0;i<first.cases.length;i++){
  const c=first.cases[i],pick=selection.cases[i];
  const png=readProblemPng(archive,pick.problemPath);
  assert.equal(sha256(png),c.problemSha256,c.id+': original problem image changed');
  save(c.id+'.problem.png',png);
  const inputBytes=Buffer.from(JSON.stringify(c.engineRequest,null,2)+'\n');
  const callsBefore=totalExecutorCalls;
  const run=await runProblemEvidence({inputBytes,outputPath:resolve(out,c.id),execute});
  assert.equal(run.report.inputSha256,sha256(inputBytes));
  assert.deepEqual(readFileSync(resolve(out,c.id,'input.json')),inputBytes);
  assert.equal(totalExecutorCalls-callsBefore,run.report.dispatch.nativeCalls);
  assert.equal(run.report.dispatch.repairs,0);assert.equal(run.report.dispatch.externalModelCalls,0);
  records.push({id:c.id,problemPath:pick.problemPath,problemSha256:c.problemSha256,
    manualAnswer:c.manualAnswer,nativeAuthoringDecision:c.nativeAuthoring,
    sourceSolutionAssessment:review.cases[i].assessment,exitCode:run.exitCode,report:run.report});
  if(c.derivedVerification){
   const checkBytes=Buffer.from(JSON.stringify(c.derivedVerification.request,null,2)+'\n');
   const derived=await runProblemEvidence({inputBytes:checkBytes,outputPath:resolve(out,c.id+'-derived-check'),execute});
   assert.equal(derived.report.inputSha256,sha256(checkBytes));
   assert.equal(derived.report.dispatch.repairs,0);assert.equal(derived.report.dispatch.externalModelCalls,0);
   derivedChecks.push({id:c.id,purpose:c.derivedVerification.purpose,excludedFromOriginalCoverage:true,
     exitCode:derived.exitCode,report:derived.report});
  }
 }
 const counts=summarizeTrial(records,derivedChecks,review);
 assert.equal(totalExecutorCalls,counts.originalNativeCalls+counts.derivedNativeCalls);
 const sourceFiles=['src/problem-workflow.js','src/contract.js','src/observables.js','src/curved-mirror-queries.js',
   'scripts/run-problem.mjs','evaluation/real-ten-v1/replay.mjs','evaluation/real-ten-v1/protocol.mjs','upstream-pin.json'];
 const report={format:'opticsim-real-ten-replay-report-v1',status:'evidence-recorded',
  firstAttemptFreezeCommit:FIRST_FREEZE,firstAttemptGitBlob:FIRST_BLOB,
  selectionSha256:sha256(data.selectionBytes),firstAttemptsSha256:sha256(data.firstBytes),reviewSha256:sha256(data.reviewBytes),
  archiveSha256:sha256(archive),executionCommit:process.env.GITHUB_SHA||'local-unverified',runId:process.env.GITHUB_RUN_ID||null,
  sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,sha256(readFileSync(resolve(ROOT,p)))])),
  externalModelCalls:0,repairs:0,independentReview:false,replayReadsSolutionImages:false,
  reviewReadSolutionsAfterCapture:true,counts,records,derivedChecks,
  limitations:[
   'Zero availability measures these submitted original-question requests, not a proof that no alternative supported analytical reduction exists.',
   'Unregistered descriptive request kinds were selected by the author; refusal alone is not a certified correct answer.',
   'Manual textbook-style mathematics and source-key comparison are separate from simulator-provided results.',
   'Derived forward checks already contain manually obtained parameters; they are never credited as original inverse solutions.',
   'Deterministic ten-case selection is small, purposive and not independent or representative. Atlas not-reviewed does not establish unseen model exposure.',
   'The source solution is not infallible: preserve the R05 height discrepancy and R06/R10 convention caveats.'
  ]};
 saveJSON('report.json',report);
 const lines=['# Ten original optics problems — evidence report','',
   'This is a same-assistant development trial, not an independent accuracy benchmark.','',
   '| Case | Supplied-solution review | Original engine results | Native status |',
   '|---|---|---|---|',...records.map(r=>`| ${r.id} | ${r.sourceSolutionAssessment} | ${r.report.coverage.available}/${r.report.coverage.requested} | ${r.report.native.status} |`),
   '',`Original questions: ${counts.originalQuestions}. Original requested results available: ${counts.originalResultsAvailable}/${counts.originalResultRequests}. Native calls: ${counts.originalNativeCalls}.`,
   `Separate derived analytical checks: ${counts.derivedAnalyticalChecks}; these do not change original-question coverage.`,
   '',...report.limitations.map(s=>s+'\n')];
 save('summary.md',lines.join('\n')+'\n');
 assert.equal(sha256(readFileSync(resolve(DIR,'first-attempts.json'))),sha256(data.firstBytes));
 console.log('Real-ten replay: '+JSON.stringify(counts));
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 replayRealTen().catch(e=>{console.error('Real-ten evidence failure: '+e.message);process.exitCode=1;});
