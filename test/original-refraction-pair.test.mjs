// These tests preserve observed limitations of the pinned engine. A passing test
// does NOT mean either original problem was fully solved by native simulation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const path=new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url);
const bytes=readFileSync(path),first=JSON.parse(bytes);
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const copy=id=>structuredClone(first.cases.find(c=>c.id===id));
const execute=r=>{const d=prepareScene(r).document;return {d,run:evaluateDocument(d,core)};};
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const theta=()=>Math.asin(1.3/1.6)*180/Math.PI;

test('original pair: previously exposed Problems and sealed first records are retained without repair',()=>{
 assert.equal(blob(bytes),'6507989a0074b68ac0e465c0982335e88fe4767f');
 assert.equal(blob(readFileSync(new URL('../authoring/original-refraction-pair/interpretation.md',import.meta.url))),'ca2a12c5f7cc78e7a000b918475d4d958e1b960d');
 assert.deepEqual(first.cases.map(c=>c.id),['B05','B06']);
 for(const c of first.cases){assert.ok(c.problemPath.includes('/Problems/'));assert.ok(!c.problemPath.includes('/Solutions/'));
  assert.equal(c.request.components.filter(c=>c.type==='point-source').length,1);
  assert.ok(c.request.components.every(c=>c.type!=='plane-mirror'));
  assert.ok(c.request.components.filter(c=>c.type==='planar-interface').every(c=>c.parameters.partialReflection));}
 assert.match(first.context,/not independent or blind/);
});

test('original B05: requested unknown direction remains missing even under illustration opt-in',()=>{
 const c=copy('B05');assert.equal(Object.hasOwn(c.request.components[0].emission,'directionDeg'),false);
 for(const illustration of [false,true]){
  const r=resolveProblemRequest(c.request,{illustration});assert.equal(r.status,'needs-information');assert.equal(r.prepared,null);
  assert.ok(r.issues.some(i=>i.path.endsWith('directionDeg')&&i.code==='MISSING_VALUE'));assert.deepEqual(r.appliedChoices,[]);
 }
});

test('original B06: native weak-branch loss is recorded and incomplete results are never published',async()=>{
 const c=copy('B06'),{d,run}=execute(c.request),diag=run.report.native.diagnostics.interfacesById;
 assert.equal(run.summary.native.status,'incomplete');assert.equal(run.summary.observations,null);
 close(diag.I12.first.incidentAngleDeg,30);close(diag.I12.first.nativeTruncation,0.001497015509734628,1e-12);
 assert.equal(diag.I12.reflected,0);assert.equal(diag.I1A.interactions,0);assert.equal(diag.I1A.first,null);
 const r=await evaluateObservables(d,c.observables,run.summary);assert.ok(r.results.every(x=>x.status==='suppressed'&&x.value===null));
});

test('original B05 companion: bracket confirms transition but exact-critical failure and missing inverse result persist',async()=>{
 const original=copy('B05'),c=copy('B05');
 for(const i of c.request.components)if(i.type==='planar-interface')i.parameters.partialReflection=false;
 for(const delta of [-.001,0,.001]){
  c.request.components[0].emission.directionDeg=90-theta()+delta;
  const {d,run}=execute(c.request),r=(await evaluateObservables(d,c.observables,run.summary)).results;
  assert.equal(r.find(x=>x.id==='criticalInput').status,'unavailable');
  if(delta===0){
   // Recorded pinned numerical limitation, NOT a physical prediction at the pole.
   assert.equal(run.summary.native.status,'incomplete');assert.equal(r.find(x=>x.id==='event23').status,'suppressed');
  }else{
   assert.equal(run.summary.executionPassed,true);
   const e=r.find(x=>x.id==='event23');assert.equal(e.status,'qualified');
   assert.equal(e.value.outcome,delta<0?'total-internal-reflection':'transmission');
   assert.equal(r.find(x=>x.id==='transmission23').status,delta<0?'unavailable':'qualified');
  }
 }
 assert.equal(Object.hasOwn(original.request.components[0].emission,'directionDeg'),false);
});

test('original B06 companions: preserving the required split still truncates; downward-only cannot answer theta5',async()=>{
 const c=copy('B06');
 for(const i of c.request.components)if(i.type==='planar-interface'&&i.id!=='I12')i.parameters.partialReflection=false;
 const keep=execute(c.request);assert.equal(keep.run.summary.native.status,'incomplete');
 assert.equal(keep.run.report.native.diagnostics.interfacesById.I1A.interactions,0);
 c.request.components.find(i=>i.id==='I12').parameters.partialReflection=false;
 const {d,run}=execute(c.request);assert.equal(run.summary.executionPassed,true);
 const r=(await evaluateObservables(d,c.observables,run.summary)).results;
 const angle=r.find(x=>x.id==='theta4');assert.equal(angle.status,'qualified');
 close(angle.value,Math.asin(1.3/1.45*Math.sin(Math.PI/6))*180/Math.PI);
 assert.ok(angle.warnings.some(x=>x.includes('approximation')));
 assert.equal(r.find(x=>x.id==='theta5').status,'unavailable');assert.equal(r.find(x=>x.id==='theta5').value,null);
 assert.equal(c.request.components.filter(c=>c.type==='point-source').length,1);
 assert.equal(c.request.components[0].parameters.brightness,1);
});

test('original B06 partial angular result does not depend on the arbitrary drawing scale',async()=>{
 const c=copy('B06');for(const i of c.request.components)if(i.type==='planar-interface')i.parameters.partialReflection=false;
 let reference;
 for(const scale of [.1,1,2]){
  const request=structuredClone(c.request);for(const i of request.components){i.parameters.x*=scale;i.parameters.y*=scale;}
  request.components.reverse();const {d,run}=execute(request);assert.equal(run.summary.executionPassed,true);
  const r=(await evaluateObservables(d,c.observables,run.summary)).results;
  if(reference===undefined)reference=r[0].value;else close(r[0].value,reference);
  assert.equal(r[1].status,'unavailable');
 }
});
