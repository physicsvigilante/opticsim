import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {runAngleQueryEvidence} from '../scripts/planar-angle-query.mjs';
import {parseQualifiedBundle,createQualifiedBundle,qualificationSummary,recordQualifiedEdit} from '../src/qualification.js';
import {reviseScene} from '../src/authoring.js';
const input=JSON.parse(readFileSync(new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url)));
const cases=JSON.parse(readFileSync(new URL('../evaluation/planar-angular-v1/cases.json',import.meta.url)));
const facts=JSON.parse(readFileSync(new URL('../evaluation/planar-angular-v1/reduced-facts.json',import.meta.url)));
const encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const path=()=>resolve('test-artifacts/llm-authoring/pr24-corrections-'+randomUUID());
const obj=id=>structuredClone(input.cases.find(c=>c.id===id).request);
const query=id=>structuredClone(cases.original[id]);
test('native setup failure retains B05 valid analytic report and portable qualified derivation',async()=>{
 const out=path();
 const res=await runAngleQueryEvidence({requestBytes:encode(obj('B05')),
   queryBytes:encode(query('B05')),outputPath:out,runNative:true,
   executeNative:()=>{throw Error('Injected native setup failure for regression');}});
 assert.equal(res.exitCode,2);
 const report=JSON.parse(readFileSync(resolve(out,'report.json')));
 assert.equal(report.status,'analysed-with-infrastructure-limitation');
 assert.equal(report.results.status,'conditional');
 assert.equal(report.forwardNativeCheck.status,'failed');
 assert.match(report.forwardNativeCheck.reason,/Injected native setup/);
 assert.equal(report.forwardNativeCheck.actualObservations,null);
 assert.ok(existsSync(resolve(out,'analytical-result.json')));
 assert.equal(report.portableQualifiedScene.status,'created');
 const bundle=await parseQualifiedBundle(readFileSync(resolve(out,'derived-forward-scene.qualified.json'),'utf8'));
 assert.equal(bundle.qualification.origin.inputSha256,report.originalInputSha256);
 assert.equal(bundle.qualification.calculations[0].querySha256,report.queryInputSha256);
 assert.equal(bundle.qualification.calculations[0].kind,'critical-input-angle');
 assert.deepEqual(bundle.qualification.calculations[0].query,query('B05'));
 assert.deepEqual(bundle.qualification.calculations[0].sourceRequest,obj('B05'));
 const field=bundle.qualification.calculations[0].computedFields[0];
 assert.equal(field.key,'directionDeg');
 assert.equal(field.unit,'degrees');
 const initial=qualificationSummary(bundle.scene,bundle.qualification);
 assert.equal(initial.status,'calculated');
 assert.equal(initial.calculated[0].computedFields[0].changed,false);
 const next=reviseScene(bundle.scene,{changes:[{id:'S1',section:'emission',
    key:'directionDeg',value:field.value+0.5}]}).document;
 const updated=recordQualifiedEdit(bundle.scene,next,bundle.qualification);
 const reopened=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(next,updated,[])));
 const summary=qualificationSummary(reopened.scene,reopened.qualification);
 assert.equal(summary.status,'revised');
 assert.equal(summary.calculated[0].computedFields[0].changed,true);
 assert.equal(reopened.qualification.calculations[0].querySha256,report.queryInputSha256);
});
test('two-branch B06 analytical provenance survives a portable qualified roundtrip',async()=>{
 const out=path();
 const res=await runAngleQueryEvidence({requestBytes:encode(obj('B06')),
   queryBytes:encode(query('B06')),outputPath:out});
 assert.equal(res.exitCode,0);
 const bundle=await parseQualifiedBundle(readFileSync(resolve(out,'derived-forward-scene.qualified.json'),'utf8'));
 const calculation=bundle.qualification.calculations[0];
 assert.equal(calculation.kind,'branch-angles');
 assert.equal(calculation.computedFields.length,0);
 assert.equal(calculation.resultValue.branches.length,2);
 assert.ok(calculation.resultValue.branches.every(x=>x.status==='conditional'));
 assert.equal(bundle.qualification.origin.inputSha256,res.report.originalInputSha256);
});
test('angular-only facts preserve a valid calculation when native scene preparation is impossible',async()=>{
 const c=facts.cases[0],out=path();
 const res=await runAngleQueryEvidence({requestBytes:encode(c.input),
   queryBytes:encode(c.query),outputPath:out,runNative:true});
 assert.equal(res.exitCode,2);
 assert.equal(res.status,'conditional');
 assert.equal(res.report.forwardNativeCheck.status,'not-run');
 assert.equal(res.report.forwardNativeCheck.stage,'scene-preparation');
 assert.equal(res.report.portableQualifiedScene.status,'not-applicable');
 assert.ok(existsSync(resolve(out,'analytical-result.json')));
 assert.ok(!existsSync(resolve(out,'derived-forward-scene.qualified.json')));
});
test('rejected analytical input leaves structured original evidence and never starts native work',async()=>{
 const out=path(),requestBytes=encode(obj('B05')),queryBytes=Buffer.from('{"kind": }');
 let nativeCalled=false;
 const res=await runAngleQueryEvidence({requestBytes,queryBytes,outputPath:out,
   runNative:true,executeNative:()=>{nativeCalled=true;}});
 assert.equal(res.exitCode,1);assert.equal(res.status,'rejected');
 assert.equal(nativeCalled,false);
 const report=JSON.parse(readFileSync(resolve(out,'report.json')));
 assert.equal(report.status,'rejected');
 assert.equal(report.native.status,'not-run');
 assert.ok(report.issues.length>0);
 assert.deepEqual(readFileSync(resolve(out,'input.json')),requestBytes);
 assert.deepEqual(readFileSync(resolve(out,'angle-query.json')),queryBytes);
 assert.ok(!existsSync(resolve(out,'analytical-result.json')));
});
test('tampering with derivation provenance is detected by qualified bundle integrity',async()=>{
 const out=path();
 await runAngleQueryEvidence({requestBytes:encode(obj('B05')),
   queryBytes:encode(query('B05')),outputPath:out});
 const bundle=JSON.parse(readFileSync(resolve(out,'derived-forward-scene.qualified.json')));
 bundle.qualification.calculations[0].computedFields[0].value=10;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(bundle)),/integrity mismatch/);
});
