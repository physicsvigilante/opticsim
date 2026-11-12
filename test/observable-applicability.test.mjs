import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const scene=name=>JSON.parse(readFileSync(new URL('../scenes/'+name+'.json',import.meta.url)));
async function image(doc){
  const id=doc.physics.components.find(c=>c.type==='point-source').id;
  return (await evaluateObservables(doc,[{id:'image',kind:'ideal-image',componentId:id}],evaluateDocument(doc,core).summary)).results[0];
}
test('image applicability reuses mirror and return analysis without changing general native scenes',async()=>{
  for(const [name,expected] of [['plane-mirror','plane-mirror-geometric'],['lens-mirror-finite','lens-mirror-return-geometric']]){
    const doc=scene(name);doc.physics.model='general-component-tracing';
    const original=structuredClone(doc),r=await image(doc);
    assert.equal(r.status,'conditional');assert.equal(r.analysisModel,expected);
    assert.equal(r.nativeImageDetected,false);assert.ok(r.assumptions.length);
    assert.deepEqual(doc,original);
  }
});
test('rotated mirror return cannot inherit the perpendicular-return analytical formula',async()=>{
  const doc=scene('lens-mirror-finite');doc.physics.model='general-component-tracing';
  doc.physics.components.find(c=>c.type==='plane-mirror').parameters.orientationDeg=80;
  const run=evaluateDocument(doc,core);assert.equal(run.summary.executionPassed,true);
  const r=await image(doc);assert.equal(r.status,'unavailable');assert.equal(r.value,null);
});
