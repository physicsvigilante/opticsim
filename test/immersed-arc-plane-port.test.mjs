import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/immersed-arc-plane-port-v34.json',import.meta.url)));
const original=()=>structuredClone(fixture.physical);
test('v34 composes actual direct and reflected trips to the same exterior detector',async()=>{
  for(const [depth,expectedX] of [[25,-100/3],[50,null],[75,100]])for(const heading of [0,180,-180]){
    const p=original();
    p.components[0].parameters.x=depth;
    p.components[0].emission.directionDeg=heading;
    const reflected=heading===0;
    for(const c of p.components){c.parameters.x+=120;c.parameters.y-=75;}
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,34);assert.deepEqual(parseSave(serializeSave(doc)),doc);
    assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['AngleSource','PlaneGlass','ArcMirror','Detector']);
    const {summary}=evaluateDocument(doc,core,fixture.requests);
    assert.equal(summary.observations?.v34ImmersedArcVerified,true);
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.deepEqual(results.slice(0,2).map(r=>r.value),[reflected?3:0,3]);
    for(const {pointMm,incomingUnit} of results[2].value){
      assert.ok(incomingUnit.x<0);
      const slope=incomingUnit.y/incomingUnit.x;
      if(reflected&&expectedX===null)assert.ok(Math.abs(slope)<.00002);
      else{
        const intercept=pointMm.x-120-(pointMm.y+75)/slope;
        assert.ok(Math.abs(intercept-(reflected?expectedX:depth/1.5))<.20);
      }
    }
  }
});
test('v34 rejects ambiguous spaces, incomplete callback paths and absent evidence',async()=>{
  for(const change of [
    p=>delete p.model,p=>p.components[0].parameters.x=0,p=>p.components[0].parameters.x=100,
    p=>p.components[0].emission.directionDeg=90,p=>p.components[1].parameters.positiveIndex=1.61,
    p=>p.components[1].parameters.partialReflection=true,p=>p.components[2].parameters.normalDeg=0,
    p=>p.components[3].parameters.x=0,p=>p.runPolicy='preview-v1'
  ]){
    const p=original();change(p);assert.throws(()=>prepareScene(p));
  }
  const doc=prepareScene(original()).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v34ImmersedArcVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disappeared={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('M')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disappeared,fixture.requests).summary.observations,null);
  doc.simulation.processedRayLimit=1;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});
