import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {fitRequestedView,apparatusPoints} from '../src/result-preview.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const demo=JSON.parse(readFileSync(new URL('../evaluation/supported-demos-v1/first-attempt.json',import.meta.url))).cases[1];
for(const [width,height] of [[1055,451],[593,376],[1200,700]])test('actual native camera preserves fitted coordinates at '+width+'x'+height,async()=>{
  const doc=prepareScene(demo.request).document;
  const results=await evaluateObservables(doc,demo.observables,evaluateDocument(doc,core).summary);
  const fitted=await fitRequestedView(doc,results,width,height);
  const before=structuredClone(fitted.document);
  const loaded=core.loadDocument(fitted.document,width,height);
  assert.equal(loaded.scene.width,width);assert.equal(loaded.scene.height,height);
  assert.equal(loaded.scene.scale,fitted.document.presentation.view.zoom);
  const v=fitted.document.presentation.view;
  assert.deepEqual(loaded.scene.origin,{x:width/2-v.x*v.zoom,y:height/2+v.y*v.zoom});
  const image=results.results.find(r=>r.kind==='ideal-image').value;
  for(const point of [...apparatusPoints(doc),image]){
    // The actual pinned native Scene transform, not the requested camera alone.
    const pixel={x:loaded.scene.origin.x+point.x*loaded.scene.scale,
      y:loaded.scene.origin.y-point.y*loaded.scene.scale};
    assert.ok(pixel.x>=fitted.padding-1e-7&&pixel.x<=width-fitted.padding+1e-7);
    assert.ok(pixel.y>=fitted.padding-1e-7&&pixel.y<=height-fitted.padding+1e-7);
  }
  assert.deepEqual(fitted.document,before);
  const roundTrip=core.loadNative(JSON.parse(loaded.scene.toJSON()),width,height);
  assert.equal(roundTrip.scale,loaded.scene.scale);assert.deepEqual(roundTrip.origin,loaded.scene.origin);
});
