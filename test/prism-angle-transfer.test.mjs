import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {analyzePrismAngleQuery,PRISM_QUERY_FORMAT,PRISM_FACTS_FORMAT} from '../src/prism-angle-queries.js';
import {prismNativeFixture,inspectPrismNative,verifyDirectPrismTrace} from './helpers/prism-native-inspection.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/prism-angle-transfer.json',import.meta.url)));
const task=fixture.task;
const physical=()=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',...task.physical});
const analyze=(facts,kind)=>analyzePrismAngleQuery(facts,{format:PRISM_QUERY_FORMAT,kind});
const inverseFacts=()=>{const f=physical();delete f.insideIndex;return {...f,deviationDeg:task.signedDeviationDeg,deviationConvention:'signed'};};
test('retained obtuse immersed transfer records the original freeze and the failed uniqueness expectation',()=>{
 assert.equal(fixture.baselineCommit,'8f8edc905348d7cac8babe55f823740556fa8027');
 // Freeze hashes describe the original experiment, not a permanent ban on
 // later source changes. Keep the record; qualify later changes prospectively.
 assert.equal(Object.keys(fixture.firstFreeze.sourceSha256).length,6);
 for(const h of Object.values(fixture.firstFreeze.sourceSha256))assert.match(h,/^[a-f0-9]{64}$/);
 assert.equal(fixture.provenance.productionChangesAfterFreeze,0);assert.match(fixture.provenance.firstRun,/incorrectly expected/);
});
test('lower-index obtuse-prism forward and signed inverse transfer without apparatus-specific code',()=>{
 const f=physical(),r=analyze(f,'prism-transmission-angles'),inverse=analyze(inverseFacts(),'prism-index-from-deviation');
 assert.equal(r.status,'conditional');assert.ok(Math.abs(r.value.entryRefractionAngleDeg-53)<1e-8);
 assert.ok(Math.abs(r.value.exitIncidenceAngleDeg-47)<1e-8);assert.equal(inverse.status,'conditional');
 assert.ok(Math.abs(inverse.value.insideIndex-fixture.expected.signedIndex)<1e-10);
 const doc=prismNativeFixture(f,{rotation:23,scale:.7});verifyDirectPrismTrace(doc,inspectPrismNative(doc),r.value);
});
test('reserved magnitude transfer retains two actual native materials rather than the initial mistaken uniqueness expectation',()=>{
 const f={...inverseFacts(),deviationDeg:Math.abs(task.signedDeviationDeg),deviationConvention:'magnitude'},r=analyze(f,'prism-index-from-deviation');
 assert.equal(r.status,'multiple-solutions');assert.equal(r.value,null);assert.equal(r.candidates.length,2);
 r.candidates.forEach((c,i)=>{assert.ok(Math.abs(c.insideIndex-fixture.expected.magnitudeIndices[i])<1e-10);
  const doc=prismNativeFixture({...physical(),insideIndex:c.insideIndex},{rotation:-17,scale:1.1});verifyDirectPrismTrace(doc,inspectPrismNative(doc),c);});
});
