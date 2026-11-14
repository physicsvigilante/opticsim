import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {grazingProbeInputs,captureGrazingProbe,assertGrazingProbe} from '../scripts/grazing-intersection-probe.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
test('48 actual native probes localize critical intersections and retain ordinary/nearby controls',()=>{
  const inputs=grazingProbeInputs();assert.equal(inputs.length,24);
  for(const input of inputs)for(const mode of ['default','linear']){
    const doc=prepareScene(input.request).document,original=structuredClone(doc);
    const record={...input,...captureGrazingProbe(doc,core,mode)};
    assertGrazingProbe(record);assert.deepEqual(doc,original);
    if(mode==='default'){
      const canonical=evaluateDocument(doc,core).summary;
      assert.equal(record.status,canonical.native.status);
      assert.equal(record.diagnostic.truncation,canonical.native.truncation);
      assert.equal(record.diagnostic.processed,canonical.native.processed);
      assert.equal(record.trace.totalEvents,Object.values(record.diagnostic.interfacesById).reduce((n,x)=>n+x.interactions,0));
    }
  }
});
