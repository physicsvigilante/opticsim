import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {analyzePrismAngleQuery,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {prismNativeFixture,inspectPrismNative,verifyDirectPrismTrace} from './helpers/prism-native-inspection.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const facts=(A,i,n,n0)=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',apexAngleDeg:A,incidenceAngleDeg:i,insideIndex:n,outsideIndex:n0});
const forward=f=>analyzePrismAngleQuery(f,{format:PRISM_QUERY_FORMAT,kind:'prism-transmission-angles'});

test('both motivating investigations agree with 18 actual rotated/scaled native prism traces',()=>{
 let count=0;
 for(const f of [facts(60,50,1.5,1),facts(35,25,1.8,1.33)])for(const rotation of [0,37,-90])for(const scale of [.1,1,10]){
  const r=forward(f);assert.equal(r.status,'conditional');
  const doc=prismNativeFixture(f,{rotation,scale}),trace=inspectPrismNative(doc);
  verifyDirectPrismTrace(doc,trace,r.value);assert.equal(trace.diagnostic.interfacesById.P.interactions,2);
  const input={...f,deviationDeg:r.value.signedDeviationDeg,deviationConvention:'signed'};delete input.insideIndex;
  const inverse=analyzePrismAngleQuery(input,{format:PRISM_QUERY_FORMAT,kind:'prism-index-from-deviation'});
  assert.equal(inverse.status,'conditional');assert.ok(Math.abs(inverse.value.insideIndex-f.insideIndex)<1e-10);count++;
 }
 assert.equal(count,18);
});

test('both magnitude candidates correspond to distinct explicitly authored native materials',()=>{
 const f={...facts(40,30,1.5,1.5),deviationDeg:5,deviationConvention:'magnitude'};delete f.insideIndex;
 const r=analyzePrismAngleQuery(f,{format:PRISM_QUERY_FORMAT,kind:'prism-index-from-deviation'});
 assert.equal(r.status,'multiple-solutions');
 for(const candidate of r.candidates){
  const doc=prismNativeFixture({...f,insideIndex:candidate.insideIndex});
  verifyDirectPrismTrace(doc,inspectPrismNative(doc),candidate);
 }
});

test('TIR is a native outcome while analytical transmission stays unavailable',()=>{
 for(const f of [facts(60,60,1,1.5),facts(60,0,1.5,1)]){
  const r=forward(f),doc=prismNativeFixture(f),e=evaluateDocument(doc,core).summary;
  assert.equal(r.reasonCode,'TOTAL_INTERNAL_REFLECTION');assert.equal(r.value,null);
  assert.ok(['completed','incomplete'].includes(e.native.status));
  if(e.observations)assert.ok(e.observations.interfacesById.P.totalInternalReflections>0);
 }
});

test('finite geometry can change the actual exit face without changing conditional angular facts',()=>{
 const f=facts(60,40,1.5,1),r=forward(f);
 const doc=prismNativeFixture(f,{entryDepth:190}),trace=inspectPrismNative(doc);
 // The same A,i,n do not establish which finite face is reached.
 assert.ok(trace.events.length>0);assert.equal(r.nativePathVerified,false);
 const faces=trace.diagnostic.interfacesById.P.faces;
 assert.ok(faces['face-23'].interactions>0,'Deep launch hits the third/base face');
 assert.throws(()=>verifyDirectPrismTrace(doc,trace,r.value),'A different native route must not verify the conditional branch');
});

test('incomplete full-Fresnel/depth native evidence cannot be qualified by conditional prism mathematics',async()=>{
 const f=facts(60,50,1.5,1),requests=[{id:'faces',kind:'interface-face-events',componentId:'P'}];
 for(const full of [false,true]){
  const doc=prismNativeFixture(f,{partialReflection:full});if(!full)doc.simulation.maxRayDepth=1;
  const e=evaluateDocument(doc,core).summary;assert.equal(e.native.status,'incomplete');assert.equal(e.observations,null);
  const results=await evaluateObservables(doc,requests,e);assert.ok(results.results.every(r=>r.status==='suppressed'&&r.value===null));
  assert.equal(forward(f).status,'conditional');assert.equal(forward(f).native.status,'not-run');
 }
});
