// One fixed, synthetic model-authoring test matrix through the exact unified
// problem workflow. No external LLM, repairs, retries or sealed exam answers.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/general-composition-v1');
mkdirSync(out,{recursive:true});
const matrixBytes=readFileSync(resolve(root,'evaluation/general-composition-v1/cases.json'));
const matrix=JSON.parse(matrixBytes.toString('utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const report={format:'opticsim-composition-matrix-evidence-v1',source:'fixed synthetic control cases, not independent LLM inference',
 matrixSha256:hash(matrixBytes),sourceProblemsOpened:0,solutionKeysOpened:0,
 externalModelCalls:0,repairs:0,assertedResults:[],counts:{available:0,refused:0}};
const records=new Map();
for(const item of matrix.cases){
 const bytes=Buffer.from(JSON.stringify(item.input,null,2)+'\n');
 const response=await runProblemEvidence({inputBytes:bytes,
  outputPath:resolve(out,item.id),
  execute:scene=>evaluateDocument(scene,core)});
 const actual=response.report,e=item.expected;
 assert.equal(response.exitCode,e.exitCode,item.id+': '+JSON.stringify(actual));
 assert.equal(actual.inputSha256,hash(bytes),item.id);
 assert.deepEqual(readFileSync(resolve(out,item.id,'input.json')),bytes,item.id);
 assert.equal(actual.dispatch.nativeCalls,e.nativeCalls,item.id);
 assert.equal(actual.dispatch.externalModelCalls,0,item.id);
 assert.equal(actual.dispatch.repairs,0,item.id);
 assert.equal(actual.questionSupport,'not-assessed-by-engine',item.id);
 assert.ok(actual.results.every(r=>r.method!=='invented'),item.id);
 if(e.coverage)assert.equal(actual.coverage.status,e.coverage,item.id);
 if(e.reasonCode)assert.equal(actual.results[0].reasonCode,e.reasonCode,item.id);
 if(e.resultStatus)assert.equal(actual.results[0].status,e.resultStatus,item.id);
 if(e.emitted!==undefined)assert.equal(actual.native.emitted,e.emitted,item.id);
 if(e.absorbed!==undefined)assert.equal(actual.results.find(r=>r.id==='absorbed')?.value,e.absorbed,item.id);
 if(e.crossings!==undefined)assert.equal(actual.results.find(r=>r.id==='crossings')?.value,e.crossings,item.id);
 if(e.partiallyAbsorbed){
  const v=actual.results.find(r=>r.id==='absorbed')?.value;
  assert.ok(v>0&&v<actual.native.emitted,item.id);
 }
 if(e.bindings!==undefined)assert.equal(actual.targetBindings.length,e.bindings,item.id);
 if(e.nativeCalls===1){
  assert.ok(['completed','completed-with-warnings'].includes(actual.native.status),item.id);
 }else assert.equal(actual.native.status,'not-run',item.id);
 if(actual.portable.status==='created'){
  const qualified=await parseQualifiedBundle(readFileSync(resolve(out,item.id,'qualified-scene.json'),'utf8'));
  assert.deepEqual(qualified.qualification.interpretation,item.input.interpretation,item.id);
  assert.equal(qualified.scene.schemaVersion,4,item.id);
  assert.equal(qualified.scene.upstreamCommit,matrix.pinnedPhyDemoCommit,item.id);
 }
 records.set(item.id,{report:actual,scenePath:resolve(out,item.id,'plan.json')});
 report.assertedResults.push({id:item.id,status:actual.status,nativeStatus:actual.native.status,exitCode:response.exitCode,
  nativeCalls:actual.dispatch.nativeCalls,coverage:actual.coverage.status,requested:actual.results.length});
 report.counts[e.exitCode===0?'available':'refused']++;
}
for(const item of matrix.cases){
 const ref=item.expected.equivalentTo||item.expected.equivalentCountsTo;
 if(!ref)continue;
 const base=records.get(ref).report,test=records.get(item.id).report;
 const val=r=>[r.native.emitted,r.results.find(x=>x.id==='absorbed')?.value,r.results.find(x=>x.id==='crossings')?.value];
 assert.deepEqual(val(test),val(base),item.id+': physically equivalent scene not equivalent in native results');
}
assert.equal(report.assertedResults.length,matrix.cases.length);
assert.equal(report.counts.available,12);
assert.equal(report.counts.refused,9);
report.status='passed';
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('General composition synthetic workflow PASS: '+report.assertedResults.length+
 ' authored attempts, '+report.counts.available+' completed, '+report.counts.refused+' explicit non-success outcomes; no LLM score claimed.');
