// Control-only CLI acceptance and retained benchmark evidence.
// This does NOT call an LLM or claim any independent interpretation accuracy.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=resolve(root,'test-artifacts/llm-evaluation/control');
mkdirSync(dir,{recursive:true});
const read=x=>JSON.parse(readFileSync(resolve(root,'evaluation/llm-pilot-v1/'+x+'.json')));
const gold=read('authoring-reference'),scope=read('corpus-reference');
const submission={
  format:'opticsim-pilot-submission-v1',
  authoring:gold.cases.map(x=>({id:x.id,request:x.request})),
  scope:scope.cases.map(x=>({id:x.id,scope:x.scope,reason:x.reviewerNote}))
};
const path=resolve(dir,'control-submission.json'),
  reportPath=resolve(dir,'control-report.json');
writeFileSync(path,JSON.stringify(submission,null,2)+'\n');
const cli=spawnSync(process.execPath,['evaluation/llm-pilot-v1/score.mjs',
  path,'--report',reportPath],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
assert.equal(cli.status,0,cli.stderr);
const report=JSON.parse(readFileSync(reportPath));
assert.equal(report.counts.totalAuthoring,10);
assert.equal(report.counts.physicallyFaithful,10);
assert.equal(report.counts.nativeExecutionPassed,10);
assert.equal(report.counts.scopeLabelsCorrect,9);
assert.equal(report.corpusExplanations,'not-independently-graded');
const wrong=structuredClone(submission);
wrong.authoring.find(x=>x.id==='C04').request.components.find(
  c=>c.id==='L1').parameters.focalLength+=5;
const wrongPath=resolve(dir,'wrong-physics.json');
writeFileSync(wrongPath,JSON.stringify(wrong,null,2)+'\n');
const changed=spawnSync(process.execPath,['evaluation/llm-pilot-v1/score.mjs',
  wrongPath],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
assert.equal(changed.status,0,changed.stderr);
const mismatched=JSON.parse(changed.stdout);
assert.equal(mismatched.counts.physicallyFaithful,9);
assert.equal(mismatched.counts.nativeExecutionPassed,10);
console.log('LLM pilot scorer acceptance PASS: 10 real native control runs, 9 reference labels, wrong-yet-runnable physics rejected.');
