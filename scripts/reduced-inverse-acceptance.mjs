// Bounded reduced-facts math integration. Known examples are software controls,
// NOT independent authoring / original-question accuracy evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=resolve(root,'test-artifacts/llm-authoring/reduced-inverse');
mkdirSync(base,{recursive:true});
const cases=JSON.parse(readFileSync(resolve(root,'evaluation/reduced-inverse-v1/controls.json')));
const summary={format:'opticsim-reduced-inverse-acceptance-v1',developmentControl:true,
 independentModel:false,externalModelCalls:0,repairs:0,nativeCalls:0,answers:[]};
for(const c of cases.cases){
 const bytes=Buffer.from(JSON.stringify(c.request,null,2)+'\n');
 let calls=0;
 const run=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(base,c.id),
  execute:()=>{calls++;throw Error('Native execution is forbidden for reduced-only facts');}});
 const report=run.report,r=report.results[0];
 assert.equal(calls,0);assert.equal(run.exitCode,c.exitCode,c.id);
 assert.equal(report.inputSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(readFileSync(resolve(base,c.id,'input.json')),bytes);
 assert.equal(report.dispatch.nativeCalls,0);
 assert.equal(report.dispatch.repairs,0);
 assert.equal(report.dispatch.externalModelCalls,0);
 assert.equal(report.native.status,'not-run');assert.equal(report.portable.status,'not-created');
 assert.equal(r.status,c.status,c.id);
 assert.equal(r.reasonCode,c.reasonCode??null,c.id);
 if(c.focalLength!==undefined)assert.ok(Math.abs(r.value.focalLength-c.focalLength)<1e-8,c.id);
 if(c.x!==undefined)assert.ok(Math.abs(r.value.reflectionPoint.x-c.x)<1e-8,c.id);
 if(c.candidates!==undefined)assert.equal(r.candidates.length,c.candidates,c.id);
 summary.answers.push({id:c.id,status:r.status,reasonCode:r.reasonCode,nativeCalls:0,
  outputSha256:createHash('sha256').update(readFileSync(resolve(base,c.id,'report.json'))).digest('hex')});
}
assert.equal(summary.answers.length,cases.cases.length);
summary.status='passed';
writeFileSync(resolve(base,'acceptance.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log('Reduced-facts inverse acceptance PASS: '+cases.cases.length+' cases, zero native calls.');
