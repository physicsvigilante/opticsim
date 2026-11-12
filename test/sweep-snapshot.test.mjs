import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {formatRequestedResult} from '../src/result-preview.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
test('sweep snapshots its baseline and specification before asynchronous verification',async()=>{
  const c=JSON.parse(readFileSync(new URL('../evaluation/supported-demos-v1/first-attempt.json',import.meta.url))).cases[0];
  const d=prepareScene(c.request).document;
  const b=await createQualifiedBundle(d,initialQualification(d,null,{inputSha256:'a'.repeat(64)}),c.observables);
  const spec={format:'opticsim-parameter-sweep-v1',expectedSceneSha256:b.sceneSha256,
    parameter:{id:'L1',section:'parameters',key:'focalLength',unit:'cm'},values:[12,18]};
  const pending=runParameterSweep(b,spec,{execute:doc=>evaluateDocument(doc,core)});
  spec.values[0]=0;b.scene.physics.components[1].parameters.focalLength=0;
  const result=await pending;
  assert.deepEqual(result.samples.map(x=>x.value),[12,18]);
  assert.equal(result.completedSamples,2);
});
test('unavailable result text labels absence of a method without inventing a value',()=>{
  const r={id:'image',kind:'ideal-image',status:'unavailable',method:null,value:null,reason:'No applicable model'};
  const text=formatRequestedResult(r);
  assert.equal(text.split('\n')[0],'image — unavailable; no method');
  assert.match(text,/No applicable model/);assert.doesNotMatch(text,/x =|0 mm/);
});
