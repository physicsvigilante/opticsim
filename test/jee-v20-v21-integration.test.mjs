// Cross-version opt-in integration checks. V20 and V21 each select by
// physical apparatus composition, never by a JEE label or an inferred route.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseComponents,capabilities} from '../src/authoring.js';
import {componentParameterNames,parseSave,serializeSave,validate} from '../src/contract.js';
import {compositionModels,selectAuthoringComposition} from '../src/composition-profiles.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const load=f=>JSON.parse(readFileSync(new URL('../examples/'+f,import.meta.url),'utf8'));
const two=load('jee-parallel-two-lens-v20.json');
const half=load('jee-semicircular-beam-v21.json');
const fresh=x=>structuredClone(x.physical);
const prepare=x=>prepareScene(fresh(x)).document;

test('new authoring selector preserves two independent semantic contracts and all old models',()=>{
 const a=prepare(two),b=prepare(half),caps=capabilities();
 assert.deepEqual(compositionModels(19),['native-parallel-lens-tracing','native-parallel-planar-tracing']);
 assert.deepEqual(compositionModels(20),['native-parallel-two-lens-tracing']);
 assert.deepEqual(compositionModels(21),['native-parallel-semicircular-tracing']);
 assert.equal(a.schemaVersion,20);assert.equal(a.adapterVersion,20);
 assert.equal(b.schemaVersion,21);assert.equal(b.adapterVersion,21);
 assert.equal(a.physics.model,'native-parallel-two-lens-tracing');
 assert.equal(b.physics.model,'native-parallel-semicircular-tracing');
 assert.deepEqual(componentParameterNames('ideal-lens',20),['x','y','focalLength','apertureHeight']);
 assert.deepEqual(componentParameterNames('ideal-lens',19),['x','focalLength','apertureHeight']);
 assert.deepEqual(componentParameterNames('semicircular-dielectric',21),
  ['x','y','radius','insideIndex','outsideIndex','partialReflection']);
 assert.equal(caps.nativeTwoLensBeam.schemaVersion,20);
 assert.equal(caps.nativeSemicircularBeam.schemaVersion,21);
 assert.equal(caps.lensParameterVariants.legacy.centreY,0);
 assert.deepEqual(core.compile(a).native.objs.map(x=>x.type),['Beam','IdealLens','IdealLens','Detector','Detector']);
 assert.deepEqual(core.compile(b).native.objs.map(x=>x.type),['Beam','Glass','Detector']);
 assert.deepEqual(parseSave(serializeSave(a)),a);
 assert.deepEqual(parseSave(serializeSave(b)),b);
});
test('cross-family mixtures, stable-ID structural edits and declared-version rewrites fail closed',()=>{
 const a=prepare(two),b=prepare(half);
 const g=structuredClone(half.physical.components.find(c=>c.id==='G1'));
 const l=structuredClone(two.physical.components.find(c=>c.id==='L2'));
 const mixedA=fresh(two);mixedA.components.push(g);
 assert.equal(selectAuthoringComposition(mixedA.components).schemaVersion,21);
 assert.throws(()=>prepareScene(mixedA),'a semicircle cannot silently widen the two-lens model');
 const mixedB=fresh(half);mixedB.components.push(l);
 assert.equal(selectAuthoringComposition(mixedB.components).schemaVersion,21);
 assert.throws(()=>prepareScene(mixedB),'a native ideal lens cannot be added to the semicircle model');
 const add=c=>({format:'opticsim-component-revision-v1',operations:[
  {op:'add',lengthUnit:'mm',component:c}]});
 assert.throws(()=>reviseComponents(a,add(g)));
 assert.throws(()=>reviseComponents(b,add(l)));
 assert.equal(a.physics.components.length,5);assert.equal(b.physics.components.length,3);
 for(const [d,version,model] of [[a,21,'native-parallel-semicircular-tracing'],
   [b,20,'native-parallel-two-lens-tracing'],[a,19,'native-parallel-lens-tracing']]){
  const bogus=structuredClone(d);bogus.schemaVersion=bogus.adapterVersion=version;bogus.physics.model=model;
  assert.throws(()=>validate(bogus),'declared version/model cannot re-interpret the same physical apparatus');
 }
});
test('hash mismatch across two independently completed native apparatuses suppresses all results',async()=>{
 const a=prepare(two),b=prepare(half);
 const nativeA=evaluateDocument(a,core,two.requests);
 const nativeB=evaluateDocument(b,core,half.requests);
 assert.equal(nativeA.summary.native.status,'completed');
 assert.equal(nativeB.summary.native.status,'completed');
 const originalA=(await evaluateObservables(a,two.requests,nativeA.summary)).results;
 const originalB=(await evaluateObservables(b,half.requests,nativeB.summary)).results;
 assert.ok(originalA.every(x=>x.status==='available'));
 assert.ok(originalB.every(x=>x.status==='qualified'),'Fresnel-off approximation stays explicit');
 const mismatchA=(await evaluateObservables(a,two.requests,nativeB.summary)).results;
 const mismatchB=(await evaluateObservables(b,half.requests,nativeA.summary)).results;
 assert.ok(mismatchA.every(x=>x.status==='suppressed'&&x.value===null));
 assert.ok(mismatchB.every(x=>x.status==='suppressed'&&x.value===null));
 assert.notEqual(nativeA.summary.canonicalSha256,nativeB.summary.canonicalSha256);
});
