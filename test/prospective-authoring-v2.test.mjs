import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const dir=new URL('../evaluation/prospective-authoring-v2/',import.meta.url);
const bytes=name=>readFileSync(new URL(name,dir));
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const selection=JSON.parse(bytes('selection.json'));
const attempts=JSON.parse(bytes('first-attempt.json'));
const manifest=JSON.parse(bytes('image-manifest.json'));

test('previously committed original-question selection and first-attempt records remain byte-for-byte sealed',()=>{
 assert.equal(blob(bytes('selection.json')),'ebe40ee88b393ec76d92ed4d601cbda8af83a72b');
 assert.equal(blob(bytes('exposure-register.json')),'a6aad038b7f59b9394f50df49d6a2fe0697c4092');
 assert.equal(blob(bytes('first-attempt.json')),'e517a81398522bfc9a8b99cc7839f4a963432c04');
 assert.equal(blob(bytes('image-manifest.json')),'d932c567105e918f34261204ffcc12954c4914a3');
 assert.equal(sha(bytes('selection.json')),attempts.selectionSha256);
 assert.equal(sha(bytes('selection.json')),manifest.selectionSha256);
 assert.equal(sha(bytes('first-attempt.json')),'4cb95af1de38c1e60c3828dd3f917b9af65155e7297c25ed6c4d4a3aa4b68984');
 assert.equal(attempts.frozenEngineCommit,'954662c4e0a8c189492da91410a020e646ca2cd0');
 assert.equal(attempts.independentEvaluator,false);
 assert.equal(attempts.externalModelCalls,0);
 assert.equal(attempts.referenceAnswersRead,false);
 assert.equal(attempts.solutionsRead,false);
 assert.equal(attempts.automaticRepairs,0);
 assert.deepEqual(attempts.cases.map(c=>c.id),selection.cases.map(c=>c.id));
 assert.deepEqual(manifest.records.map(c=>c.id),selection.cases.map(c=>c.id));
 assert.equal(attempts.cases.reduce((n,c)=>n+c.request.requests.length,0),9);
 for(let i=0;i<attempts.cases.length;i++){
  const c=attempts.cases[i],p=selection.cases[i],m=manifest.records[i];
  assert.equal(c.request.interpretation.source.path,p.problemPath);
  assert.equal(c.request.interpretation.source.sha256,m.pngSha256);
  assert.equal(c.request.physical,null);
  assert.equal(c.request.illustration,false);
  assert.equal(c.request.verifyNative,false);
  assert.equal(c.solutionsRead,false);
  assert.ok(c.request.interpretation.source.path.includes('/Problems/'));
  assert.ok(!c.request.interpretation.source.path.includes('/Solutions/'));
 }
});
test('each frozen image hash matches the selected original Problems-only ZIP member',()=>{
 const archive=readFileSync(new URL('../../08_Ray_Optics_Explanations.zip',dir));
 assert.equal(sha(archive),selection.archiveSha256);
 for(const row of manifest.records){
  const image=readProblemPng(archive,row.problemPath);
  assert.equal(image.length,row.bytes);
  assert.equal(sha(image),row.pngSha256);
 }
});
