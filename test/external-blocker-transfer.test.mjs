import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {inspectExternalSurfaceScene} from './helpers/external-surface-inspection.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/external-blocker-transfer.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const make=()=>prepareScene(fixture.physical).document;

test('reserved two-source nonrectangular transfer uses the frozen shared production path',async()=>{
 const d=make(),s=evaluateDocument(d,core).summary,checked=inspectExternalSurfaceScene(d);
 assert.equal(d.schemaVersion,13);assert.equal(s.executionPassed,true);assert.equal(checked.checked,6);
 assert.equal(s.observations.blockersById.B.absorptions,2);assert.equal(s.observations.interfacesById.G.interactions,2);
 for(const id of ['D_west','D_east'])assert.equal(s.observations.detectorsById[id].crossings,1);
 for(const id of ['S_west','S_east'])assert.equal(s.observations.emissionsById[id].emitted,1);
 const results=await evaluateObservables(d,fixture.requests,s);assert.ok(results.results.every(r=>r.status==='qualified'));
 // Both directed sides of the same native absorber are actually encountered.
 assert.deepEqual(checked.trace.filter(e=>e.type==='line-blocker').map(e=>Math.sign(e.incoming.x)).sort(),[-1,1]);
});

test('reserved physical revision changes only blocker height; both unabsorbed sources traverse the glass',()=>{
 const d=make(),before=structuredClone(d),revised=reviseScene(d,{changes:[{id:'B',section:'parameters',key:'y',value:100,unit:'mm'}]}).document;
 assert.deepEqual(d,before);for(const c of d.physics.components.filter(c=>c.id!=='B'))assert.deepEqual(revised.physics.components.find(x=>x.id===c.id),c);
 assert.deepEqual(revised.simulation,d.simulation);const s=evaluateDocument(revised,core).summary,checked=inspectExternalSurfaceScene(revised);
 assert.equal(s.executionPassed,true);assert.equal(checked.checked,8);assert.equal(s.observations.blockersById.B.absorptions,0);
 assert.equal(s.observations.interfacesById.G.interactions,4);
 for(const id of ['D_west','D_east'])assert.equal(s.observations.detectorsById[id].crossings,2);
});

test('retained first-attempt policy-key mistake remains rejected, not silently repaired by the engine',()=>{
 const r=structuredClone(fixture.physical);r.policy=r.runPolicy;delete r.runPolicy;
 assert.throws(()=>prepareScene(r),e=>e.issues?.some(i=>i.path==='$.policy'&&i.code==='UNSUPPORTED_FIELD'));
 assert.equal(r.policy,'preview-v1');assert.equal(r.runPolicy,undefined);
});
