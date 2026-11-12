import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {reviseScene} from '../src/authoring.js';
import {LENGTH_PARAMETERS} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,verifyQualifiedBundle} from '../src/qualification.js';
import {loadAttempts,authoringBurden} from '../scripts/supported-authoring-demos.mjs';
import {assertSupportedOutcome} from '../evaluation/supported-demos-v1/check-results.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const {manifest}=loadAttempts();
async function run(doc,requests){
  const execution=evaluateDocument(doc,core).summary;
  assert.equal(execution.executionPassed,true);
  return {...execution,requestedResults:await evaluateObservables(doc,requests,execution)};
}
test('supported demos preserve the sealed requests, with no authored answers or implicit physical choices',()=>{
  for(const c of manifest.cases){
    const copy=structuredClone(c),p=resolveProblemRequest(c.request);
    assert.equal(p.status,'fully-specified');assert.deepEqual(p.appliedChoices,[]);
    assert.deepEqual(c,copy);assert.deepEqual(c.interpretation.derived,[]);
    assert.deepEqual(c.interpretation.assumptions,[]);
    for(const r of c.observables)assert.deepEqual(Object.keys(r).sort(),['componentId','id','kind']);
  }
});
for(const c of manifest.cases)test(c.id+': native first request and one-field revision produce qualified results',async()=>{
  const prepared=resolveProblemRequest(c.request);
  const doc=prepared.prepared.document;
  const first=await run(doc,c.observables);assertSupportedOutcome(c.id,'initial',doc,first);
  const next=reviseScene(doc,{changes:c.revisionChanges}).document;
  const revised=await run(next,c.observables);assertSupportedOutcome(c.id,'revised',next,revised);
  const q=initialQualification(doc,prepared,{inputSha256:createHash('sha256').update(JSON.stringify(c.request)).digest('hex'),interpretation:c.interpretation});
  const history=recordQualifiedEdit(doc,next,q);
  const bundle=await verifyQualifiedBundle(await createQualifiedBundle(next,history,c.observables));
  assert.deepEqual(bundle.qualification.origin,q.origin);
  assert.equal(bundle.qualification.edits[0].changes.length,1);
  assert.deepEqual(next.physics.components.map(x=>x.id),doc.physics.components.map(x=>x.id));
});
test('unit changes and component order preserve supported demo physics and native observations',async()=>{
  for(const c of manifest.cases){
    const a=resolveProblemRequest(c.request).prepared.document;
    const request=structuredClone(c.request);request.lengthUnit='mm';
    for(const component of request.components)for(const key of LENGTH_PARAMETERS)
      if(Object.hasOwn(component.parameters,key))component.parameters[key]*=10;
    request.components.reverse();
    const b=resolveProblemRequest(request).prepared.document;
    assert.deepEqual(evaluateDocument(a,core).summary.observations,evaluateDocument(b,core).summary.observations);
  }
});
test('negative controls separate absent physics from an unavailable requested quantity',async()=>{
  const c=manifest.cases[0],request=structuredClone(c.request);
  delete request.components[1].parameters.focalLength;
  const p=resolveProblemRequest(request);assert.equal(p.status,'needs-information');assert.equal(p.prepared,null);
  const doc=resolveProblemRequest(c.request).prepared.document;
  const result=await run(doc,[{id:'index',kind:'refractive-index',componentId:'L1'}]);
  assert.equal(result.requestedResults.results[0].status,'unavailable');
  assert.equal(result.requestedResults.results[0].value,null);
});
test('burden counts cover physical inputs and exclude engine-generated answer values',()=>{
  const expected=[[7,6,2],[10,9,2],[14,13,4]];
  manifest.cases.forEach((c,i)=>{
    const b=authoringBurden(c,resolveProblemRequest(c.request).prepared.document);
    assert.deepEqual([b.physicalValues,b.numericPhysicalValues,b.requestedResults],expected[i]);
    assert.equal(b.changedFields,1);assert.equal(b.resultValuesAuthored,0);
  });
});
