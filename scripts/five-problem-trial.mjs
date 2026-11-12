// Re-execute the sealed SAME-ASSISTANT development attempt. This does not ask a
// model new questions, read Solutions images, or produce an independent score.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readProblemPng,sha256} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const firstPath=resolve(root,'evaluation/qualified-workflow-v1/first-attempt.json');
const bytes=readFileSync(firstPath);
const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
assert.equal(blob,'619ff812a498db2f0e9c3ba6d37d8c3b9551c715','Sealed first interpretation must not be edited; add a review instead');
const trial=JSON.parse(bytes),archive=readFileSync(resolve(root,trial.protocol.archive));
assert.equal(sha256(archive),trial.protocol.archiveSha256);
const parent=resolve(root,'test-artifacts/llm-authoring');mkdirSync(parent,{recursive:true});
const dir=mkdtempSync(resolve(parent,'five-problem-'));
const results=[];
const expected={'H1-real':{x:480,m:-3},'H1-virtual':{x:-240,m:3},'H4-empty-only':{x:360,m:-.8}};
for(const c of trial.cases){
  const png=readProblemPng(archive,trial.protocol.problemRoot+c.file);
  assert.equal(sha256(png),c.imageSha256);
  const caseDir=resolve(dir,c.id);mkdirSync(caseDir);
  writeFileSync(resolve(caseDir,'original-problem.png'),png);
  const attempts=[];
  for(const a of c.attempts){
    const file=(name,data)=>{const path=resolve(caseDir,a.id+'-'+name+'.json');writeFileSync(path,JSON.stringify(data,null,2)+'\n');return path;};
    const input=file('request',a.request),queries=file('observables',a.observables);
    const notes=file('interpretation',{source:{caseId:c.id,path:trial.protocol.problemRoot+c.file,sha256:c.imageSha256},
      requestedResult:c.requestedResult,stated:c.stated,derived:c.derived,
      assumptions:c.authorAssumptions||[],unknowns:c.unknowns});
    const result=JSON.parse(execFileSync(process.execPath,['scripts/qualified-scene.mjs','create',input,
      '--illustrate','--observables',queries,'--interpretation',notes,'--out',resolve(caseDir,a.id)],
      {cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
    assert.equal(result.executionPassed,true);assert.equal(result.problem.status,'illustrative');
    const image=result.requestedResults.results[0];assert.equal(image.status,'conditional');
    assert.ok(Math.abs(image.value.x-expected[a.id].x)<1e-8);
    assert.ok(Math.abs(image.value.magnification-expected[a.id].m)<1e-8);
    attempts.push({id:a.id,outputs:result.outputs,sceneSha256:result.canonicalSha256,
      native:result.native,conditionalResult:image,policyAssumptions:result.qualification.assumptions});
  }
  results.push({id:c.id,file:c.file,imageSha256:c.imageSha256,decision:c.decision,reason:c.reason,
    originalQuestionAnsweredByEngine:false,scopeAssessment:'same-assistant-not-independently-adjudicated',attempts});
}
assert.equal(results.length,5);assert.equal(results.flatMap(r=>r.attempts).length,3);
const report={format:'opticsim-five-problem-review-v1',firstAttemptCommit:'ab875e46c0d3a02efc743cfa77fca79b6e1d0564',
  firstAttemptSha256:sha256(bytes),archiveSha256:sha256(archive),solutionsRead:false,independentModelCall:false,
  result:'Five interpretations retained; three explicitly illustrative native configurations from two cases. No full-question independent success rate.',
  cases:results};
const out=resolve(root,'test-artifacts/qualified-workflow');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'five-problem-review.json'),JSON.stringify(report,null,2)+'\n');
console.log('Five-problem development trial PASS: input hashes and sealed attempts verified; 3 conditional native traces; no independent accuracy claim.');
