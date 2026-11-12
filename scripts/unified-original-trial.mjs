// Replay sealed first attempts only. This runner neither opens solutions nor
// repairs requests nor upgrades own interpretation into independent ground truth.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {canonicalJSON} from '../src/qualified-utils.js';
import {reserveAuthoringOutput} from './authoring-evidence.mjs';
import {readProblemPng,sha256} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const dir='evaluation/unified-workflow-v1';
const selection=JSON.parse(readFileSync(dir+'/selection.json'));
const originalBytes=readFileSync(dir+'/first-attempt.json'),first=JSON.parse(originalBytes);
const seal=sha256(Buffer.from(canonicalJSON(first)));
assert.equal(seal,'9e43d4300832d543ecb9cca3610f3756ecbbc3a74667f3116e84db9ad828b4d6');
const archive=readFileSync(selection.archiveName);assert.equal(sha256(archive),selection.archiveSha256);
const out=reserveAuthoringOutput('test-artifacts/llm-authoring/unified-original-trial',resolve('.')).directory;
const save=(name,data)=>writeFileSync(resolve(out,name),Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
save('first-attempt.json',originalBytes);save('selection.json',selection);
const records=[];
for(const c of first.cases){
 const pick=selection.cases.find(x=>x.id===c.id),image=readProblemPng(archive,pick.problemPath);
 assert.equal(sha256(image),pick.imageSha256);save(c.id+'.png',image);
 const requestPath=resolve(out,c.id+'.request.json');save(c.id+'.request.json',c.request);
 const result=spawnSync(process.execPath,['scripts/run-problem.mjs',requestPath,'--out',resolve(out,c.id)],{encoding:'utf8',timeout:90000});
 if(result.error||result.signal||![0,1,2].includes(result.status))throw Error('Infrastructure failure '+(result.error?.message||result.signal||result.stderr));
 save(c.id+'.process.json',{exitCode:result.status,stdout:result.stdout,stderr:result.stderr});
 const report=JSON.parse(readFileSync(resolve(out,c.id,'report.json')));
 records.push({id:c.id,inputSha256:report.inputSha256,exitCode:result.status,status:report.status,
  coverage:report.coverage,results:report.results,dispatch:report.dispatch,native:report.native,
  authorAssumptionCount:c.request.interpretation.assumptions.length,
  physicalNumericValues:countNumbers(c.request.physical),review:'not-independently-adjudicated'});
}
function countNumbers(x){return typeof x==='number'?1:Array.isArray(x)?x.reduce((n,y)=>n+countNumbers(y),0):x&&typeof x==='object'?Object.values(x).reduce((n,y)=>n+countNumbers(y),0):0;}
const report={format:'opticsim-unified-original-trial-v1',firstAttemptCanonicalSha256:seal,
 originalProblems:records.length,solutionsRead:false,modelCalls:0,automaticRepairs:0,
 independentAccuracyScore:null,claim:'Same-assistant prospective development trial; capability coverage is not interpretation accuracy. No case replaced after viewing.',records};
save('report.json',report);
assert.equal(sha256(Buffer.from(canonicalJSON(JSON.parse(readFileSync(dir+'/first-attempt.json'))))),seal);
console.log(JSON.stringify({status:'recorded',cases:records.map(r=>({id:r.id,status:r.status,available:r.coverage.available,requested:r.coverage.requested,native:r.native.status})),output:out},null,2));
