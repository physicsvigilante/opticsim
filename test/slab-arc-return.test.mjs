import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/slab-arc-return-v31.json',import.meta.url)));
const original=()=>structuredClone(fixture.physical);
const byId=(p,id)=>p.components.find(c=>c.id===id);

test('v31 validates the actual native return through both distinct plane interfaces',async()=>{
  for(const shift of [0,10]){
    const p=original();
    for(const id of ['I1','I2'])byId(p,id).parameters.x+=shift;
    p.components.reverse();
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,31);
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['ArcMirror','Detector','PlaneGlass','PlaneGlass','AngleSource']);
    const {summary}=evaluateDocument(doc,core,fixture.requests);
    assert.equal(summary.observations?.v31SlabArcVerified,true);
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.deepEqual(results.slice(0,3).map(r=>r.value),[3,6,6]);
    const returning=results[3].value.filter(h=>h.incomingUnit.x<0);
    assert.equal(returning.length,3);
    for(const {pointMm,incomingUnit} of returning){
      const y=pointMm.y+(-1400/9-pointMm.x)*incomingUnit.y/incomingUnit.x;
      assert.ok(Math.abs(y+5/9)<.025);
    }
  }
});

test('v31 rejects unsupported layouts and withholds a missed or unverified return',async()=>{
  for(const edit of [
    p=>delete p.model,p=>byId(p,'I2').parameters.x=-285,
    p=>byId(p,'I2').parameters.positiveIndex=1.1,p=>byId(p,'I1').parameters.partialReflection=true,
    p=>byId(p,'M').parameters.normalDeg=0,p=>byId(p,'M').parameters.radius=-200,
    p=>byId(p,'D').parameters.x=0,p=>p.runPolicy='preview-v1',
    p=>byId(p,'S').emission.angleDeg=3,p=>p.components.pop()
  ]){
    const p=original();edit(p);assert.throws(()=>prepareScene(p));
  }
  const doc=prepareScene(original()).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v31SlabArcVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('M')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  doc.simulation.processedRayLimit=4;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});
