import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {planProblem} from '../src/problem-workflow.js';
import {prepareScene} from '../src/authoring.js';
import {inspectPrismNative,checkNativeSnell,bisectedPrismIndex} from './helpers/prism-angular-reference.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/prism-angular-transfer.json',import.meta.url))),core=createRequire(import.meta.url)('../dist/test-core.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('reserved immersed scalene inverse and reversed native entry/exit transfer need no production extension',()=>{
 const input={format:'opticsim-problem-v1',physical:structuredClone(fixture.facts),requests:[{id:'material',kind:'prism-direct-index'}]},before=structuredClone(input);
 const plan=planProblem(input),answer=plan.results[0];assert.equal(answer.status,'conditional');assert.deepEqual(input,before);assert.equal(plan.scene,null);
 const f=input.physical,n=bisectedPrismIndex(f.prismAngleDeg,f.incidenceAngleDeg,f.deviationDeg,f.outsideIndex);close(answer.value.insideIndex,n);
 const g=fixture.nativeGeometry,i=f.incidenceAngleDeg*Math.PI/180;
 // Separate test apparatus: geometry/illumination is synthetic; n is DERIVED
 // by the trusted inverse query, not retrospectively inserted into its facts.
 const r={lengthUnit:'mm',components:[{id:'S',type:'point-source',parameters:{x:g.sourceX,y:g.entryY+g.sourceX*Math.tan(i),brightness:1},emission:{mode:'single-ray',directionDeg:f.incidenceAngleDeg}},
  {id:'P',type:'triangular-prism',parameters:{...Object.fromEntries(g.vertices.flatMap(([x,y],j)=>[['x'+(j+1),x],['y'+(j+1),y]])),insideIndex:answer.value.insideIndex,outsideIndex:f.outsideIndex,partialReflection:g.partialReflection}}]};
 const d=prepareScene(r).document,out=inspectPrismNative(d,core);assert.equal(out.status,'completed');checkNativeSnell(d,out.trace);assert.deepEqual(out.trace.map(e=>e.face),[0,2]);
 const first=out.trace[0].incoming,last=out.trace.at(-1).outgoing;
 close(-Math.atan2(first.x*last.y-first.y*last.x,first.x*last.x+first.y*last.y)*180/Math.PI,f.deviationDeg);
 const reversed=structuredClone(r),exit=out.trace.at(-1);Object.assign(reversed.components[0].parameters,{x:exit.point.x+20*last.x,y:exit.point.y+20*last.y});
 reversed.components[0].emission.directionDeg=Math.atan2(-last.y,-last.x)*180/Math.PI;
 const backDoc=prepareScene(reversed).document,back=inspectPrismNative(backDoc,core);assert.equal(back.status,'completed');checkNativeSnell(backDoc,back.trace);assert.deepEqual(back.trace.map(e=>e.face),[2,0]);
 close(back.trace.at(-1).outgoing.x,-first.x);close(back.trace.at(-1).outgoing.y,-first.y);
 const reciprocal=structuredClone(input);reciprocal.physical.incidenceAngleDeg=answer.value.emergenceAngleDeg;
 const reciprocalResult=planProblem(reciprocal).results[0];assert.equal(reciprocalResult.status,'conditional');close(reciprocalResult.value.insideIndex,n);close(reciprocalResult.value.emergenceAngleDeg,f.incidenceAngleDeg);
});
