import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {reviseScene} from '../src/authoring.js';
import {validate} from '../src/contract.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const bytes=read('evaluation/teaching-fidelity-v1/plan.json'),plan=JSON.parse(bytes);
const sourceBytes=read(plan.source.path),source=JSON.parse(sourceBytes);
const prepare=()=>resolveProblemRequest(structuredClone(plan.initialRequest),{illustration:false});
test('teaching pilot plan and existing source are frozen before new execution',()=>{
 assert.equal(blob(bytes),'17814c4b17134fa73f35ed153481b383a2576376');
 assert.equal(blob(sourceBytes),'3dcdb0e8c01d1c950ee9bdbe2583b1892f6fc651');
 assert.equal(plan.baselineCommit,'740b847d977e557c31e43139987a589341424d18');
 assert.equal(plan.independentReviewers,0);assert.equal(plan.externalModelCalls,0);
 assert.equal(plan.evaluationDimensions.length,5);
 assert.match(plan.source.classification,/not a textbook, unseen problem/);
});
test('existing authoring alone preserves every fixture component and numerical policy',()=>{
 const before=JSON.stringify(plan.initialRequest),prepared=prepare();
 assert.ok(prepared.prepared);
 assert.deepEqual(prepared.prepared.document.physics.components,source.physics.components);
 assert.deepEqual(prepared.prepared.document.simulation,source.simulation);
 assert.equal(JSON.stringify(plan.initialRequest),before);
 assert.deepEqual(plan.experiments.find(x=>x.id==='scene-only').observables,[]);
});
test('classroom focal change uses existing revision contract and changes one source-backed physical field',()=>{
 const doc=prepare().prepared.document;
 const revised=reviseScene(doc,{changes:plan.experiments.find(x=>x.id==='focal-150').changes}).document;
 const expected=structuredClone(doc);expected.physics.components.find(x=>x.id==='lens-1').parameters.focalLength=150;
 assert.deepEqual(revised,expected);
 assert.equal(doc.physics.components.find(x=>x.id==='lens-1').parameters.focalLength,100);
});
test('sampling-only intervention never changes the apparatus, and missing f never prepares',()=>{
 const doc=prepare().prepared.document,coarse=structuredClone(doc);
 coarse.simulation.rayDensity=plan.experiments.find(x=>x.id==='coarse-sampling').rayDensity;
 validate(coarse);assert.deepEqual(coarse.physics,doc.physics);
 const missing=structuredClone(plan.initialRequest);
 delete missing.components.find(c=>c.id==='lens-1').parameters.focalLength;
 const result=resolveProblemRequest(missing,{illustration:false});
 assert.equal(result.status,'needs-information');assert.ok(!result.prepared);
 assert.equal(Object.hasOwn(missing.components[1].parameters,'focalLength'),false);
});
