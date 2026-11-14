import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {grazingProbeInputs} from '../scripts/grazing-intersection-probe.mjs';
import {experimentalPlaneCore} from '../scripts/relative-intersection-candidate.mjs';
import {collectRelativeExperiment,assertRelativeExperiment} from '../scripts/relative-intersection-experiment.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
test('paired intersection experiment preserves close hits, native controls, incomplete Fresnel and its known limitation',()=>{
  const report=collectRelativeExperiment(core);assertRelativeExperiment(report);
  assert.equal(report.counts.totalTraceExecutions,131);
});
test('candidate is instance-local, nonserializable and rejected outside planar scope',()=>{
  const doc=prepareScene(grazingProbeInputs()[0].request).document,original=structuredClone(doc);
  const untouched=core.loadDocument(doc),candidate=experimentalPlaneCore(core).loadDocument(doc),fresh=core.loadDocument(doc);
  for(const id of ['I12','I23']){
    const a=untouched.scene.objs[untouched.idMap.get(id)],b=candidate.scene.objs[candidate.idMap.get(id)],c=fresh.scene.objs[fresh.idMap.get(id)];
    assert.equal(a.checkRayIntersects,c.checkRayIntersects);assert.notEqual(b.checkRayIntersects,c.checkRayIntersects);
    assert.equal(a.onRayIncident,b.onRayIncident);assert.equal(Object.getPrototypeOf(a),Object.getPrototypeOf(b));
    assert.deepEqual(a.serialize(),b.serialize());
  }
  assert.deepEqual(doc,original);
  assert.throws(()=>experimentalPlaneCore(core).loadDocument({...doc,schemaVersion:4}),/scoped/);
});
