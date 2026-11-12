import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {nativeNumericalReplay,NATIVE_REPLAY_MODES} from '../src/numerical-reliability.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const first=JSON.parse(readFileSync(new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url)));
const b06=()=>structuredClone(first.cases.find(c=>c.id==='B06'));
const b05=()=>structuredClone(first.cases.find(c=>c.id==='B05'));
const doc=request=>prepareScene(request).document;
test('diagnostic default matches canonical B06 native run and never mutates scene',()=>{
  const scene=doc(b06().request),original=structuredClone(scene);
  const base=evaluateDocument(scene,core),replay=nativeNumericalReplay(scene,core,'default');
  assert.equal(base.summary.native.status,'incomplete');
  assert.equal(replay.status,base.summary.native.status);
  assert.equal(replay.diagnostic.truncation,base.summary.native.truncation);
  assert.equal(replay.nativeSceneColorMode,'default');
  assert.equal(replay.nativeWeakBranchThreshold,0.01);
  assert.equal(replay.observations,null);
  assert.equal(replay.diagnostic.interfacesById.I1A.interactions,0);
  assert.deepEqual(scene,original);
  const trace=replay.diagnostic.interactionTrace;
  assert.equal(trace.coordinateConvention,'x-right-y-up');
  assert.equal(trace.totalEvents,Object.values(replay.diagnostic.interfacesById).reduce((n,m)=>n+m.interactions,0));
  assert.ok(trace.entries.length<=32);
  assert.ok(trace.entries.every(e=>e.incidentDistanceMm>=0&&e.incomingDirection));
});
test('supported non-default native mode retains B06 required weak reflection as diagnostic evidence',()=>{
  const scene=doc(b06().request);
  const defaultMode=nativeNumericalReplay(scene,core,'default');
  const linear=nativeNumericalReplay(scene,core,'linear');
  assert.equal(linear.nativeWeakBranchThreshold,0.000001);
  assert.equal(linear.nativeSceneColorMode,'linear');
  assert.equal(defaultMode.diagnostic.interfacesById.I12.reflected,0);
  assert.ok(linear.diagnostic.interfacesById.I12.reflected>0);
  assert.ok(linear.diagnostic.interfacesById.I1A.interactions>0);
  if(!linear.complete)assert.equal(linear.observations,null);
  assert.equal(linear.questionSupport,'not-assessed-by-engine');
});
test('replay rejects unsupported numerical modes and historical optical schemas',()=>{
  const current=doc(b06().request);
  for(const mode of ['extended','reinhard',null,0,''])assert.throws(()=>nativeNumericalReplay(current,core,mode),/Unsupported/);
  const old=JSON.parse(readFileSync(new URL('../scenes/general-source-only.json',import.meta.url)));
  assert.throws(()=>nativeNumericalReplay(old,core,'linear'),/scoped to v5/);
  assert.deepEqual(Object.keys(NATIVE_REPLAY_MODES),['default','linear']);
});
test('exact-critical diagnostic never silently promotes a partial run into accepted observations',()=>{
  const c=b05(),critical=Math.asin(1.3/1.6)*180/Math.PI;
  c.request.components[0].emission.directionDeg=90-critical;
  for(const component of c.request.components)if(component.type==='planar-interface')component.parameters.partialReflection=false;
  const scene=doc(c.request);
  for(const mode of ['default','linear']){
    const r=nativeNumericalReplay(scene,core,mode);
    assert.ok(['completed','completed-with-warnings','incomplete','failed','stopped'].includes(r.status));
    if(!r.complete)assert.equal(r.observations,null);
    assert.equal(r.nativeSceneColorMode,mode);
    assert.ok(r.diagnostic.interactionTrace.entries.some(e=>e.interfaceId==='I23'));
    assert.ok(r.diagnostic.interactionTrace.entries.length<=32);
    assert.ok(r.numericalFindings.some(x=>x.code==='NEAR_TANGENT_SAME_INTERFACE_REHIT'));
    assert.ok(r.numericalFindings.some(x=>x.code==='EXTREME_GRAZING_TRAVEL'));
    // These assertions pin observed numerical defects, not correct physics.
  }
  const off=structuredClone(scene);
  const source=off.physics.components.find(x=>x.id==='S1');
  source.emission.directionDeg+=0.001;
  const stable=nativeNumericalReplay(off,core,'default');
  assert.equal(stable.status,'completed');
  assert.ok(!stable.numericalFindings.some(x=>x.code==='NEAR_TANGENT_SAME_INTERFACE_REHIT'));
});
