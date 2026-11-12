// Verify only the prespecified Problems images. No solution, model call or score.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const dir='evaluation/broader-capability-review-v1';
const selection=JSON.parse(readFileSync(dir+'/selection.json','utf8'));
const review=JSON.parse(readFileSync(dir+'/review.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const archive=readFileSync(selection.archiveName);
assert.equal(hash(archive),selection.archiveSha256);
assert.equal(selection.solutionsRead,false);
assert.equal(selection.cases.length,10);
assert.equal(new Set(selection.cases.map(c=>c.problemPath.split('/Problems/')[0])).size,5);
assert.deepEqual(review.cases.map(c=>c.id),selection.cases.map(c=>c.id));
const cases=selection.cases.map(c=>{
  assert.ok(c.problemPath.includes('/Problems/')&&!c.problemPath.includes('/Solutions/'));
  const bytes=readProblemPng(archive,c.problemPath);assert.equal(hash(bytes),c.imageSha256);
  return {id:c.id,problemPath:c.problemPath,imageSha256:c.imageSha256,bytes:bytes.length};
});
const out=resolve('test-artifacts/qualified-workflow');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'broader-review-input-verification.json'),JSON.stringify({
  status:'verified',archiveSha256:selection.archiveSha256,
  selectionSha256:hash(readFileSync(dir+'/selection.json')),reviewSha256:hash(readFileSync(dir+'/review.json')),
  solutionsRead:false,independentModelEvaluation:false,scopeDecisionsIndependentlyAdjudicated:false,cases
},null,2)+'\n',{flag:'wx'});
console.log('Broader review input verification PASS: 10 prespecified Problems images, 5 sections; no Solutions or accuracy scoring.');
