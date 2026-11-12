import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {fitRequestedView,apparatusPoints,formatRequestedResult} from '../src/result-preview.js';
import {validateSweep,runParameterSweep,plotSamples} from '../src/parameter-sweep.js';
import {sweepHTML} from '../scripts/sweep-report.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const demos=JSON.parse(readFileSync(new URL('../evaluation/supported-demos-v1/first-attempt.json',import.meta.url)));
const execute=doc=>evaluateDocument(doc,core);
async function base(index=0){
  const c=demos.cases[index],doc=prepareScene(c.request).document;
  return createQualifiedBundle(doc,initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:c.interpretation}),c.observables);
}
const specification=b=>({format:'opticsim-parameter-sweep-v1',expectedSceneSha256:b.sceneSha256,
  parameter:{id:'L1',section:'parameters',key:'focalLength',unit:'cm'},values:[8,12,18,30,31,0],plot:{observableId:'image',field:'x'}});
for(let index=0;index<2;index++)test('fit initial/revised lens demo '+index+' within viewport without changing physics or results',async()=>{
  const b=await base(index);
  for(const doc of [b.scene,reviseScene(b.scene,{changes:demos.cases[index].revisionChanges}).document]){
    const before=await evaluateObservables(doc,b.observables,execute(doc).summary),copy=structuredClone(doc);
    for(const [width,height] of [[1055,500],[400,240]]){
      const fit=await fitRequestedView(doc,before,width,height);
      assert.deepEqual(fit.document.physics,doc.physics);assert.deepEqual(fit.document.simulation,doc.simulation);
      assert.deepEqual(doc,copy);assert.equal(fit.included.length,1);
      const p=before.results.find(r=>r.kind==='ideal-image').value,v=fit.document.presentation.view;
      for(const point of [...apparatusPoints(doc),p]){
        assert.ok(Math.abs((point.x-v.x)*v.zoom)<=width/2-fit.padding+1e-7);
        assert.ok(Math.abs((point.y-v.y)*v.zoom)<=height/2-fit.padding+1e-7);
      }
      const after=await evaluateObservables(fit.document,b.observables,execute(fit.document).summary);
      assert.deepEqual(after.results,before.results);
      const q=recordQualifiedEdit(doc,fit.document,b.qualification);
      assert.equal(q.edits.at(-1).kind,'presentation');assert.deepEqual(q.assumptions,b.qualification.assumptions);
    }
  }
});
test('fit withholds stale, infinite, unavailable and out-of-camera coordinates',async()=>{
  const b=await base(),doc=b.scene;
  const report=await evaluateObservables(doc,b.observables,execute(doc).summary);
  const stale=await fitRequestedView(doc,{...report,canonicalSha256:'b'.repeat(64)},800,500);
  assert.equal(stale.included.length,0);assert.match(stale.note,/stale/);
  for(const value of [{kind:'at-infinity'},{kind:'finite-real',x:1e12,y:0}]){
    const testReport=structuredClone(report);testReport.results[0].value=value;
    const fit=await fitRequestedView(doc,testReport,800,500);
    assert.equal(fit.included.length,0);assert.ok(fit.excluded.length);
  }
  const infinity=reviseScene(doc,{changes:[{id:'L1',section:'parameters',key:'focalLength',value:30,unit:'cm'}]}).document;
  const result=await evaluateObservables(infinity,b.observables,execute(infinity).summary);
  assert.match(formatRequestedResult(result.results[0]),/at infinity/);
  const zero={id:'zero',kind:'detector-crossings',status:'available',method:'native-observation',value:0,unit:'sampled crossings'};
  assert.match(formatRequestedResult(zero),/0 sampled crossings/);
});
test('sweep uses one immutable baseline, retains failed samples and preserves infinity separately',async()=>{
  const b=await base(),copy=structuredClone(b),spec=specification(b),written=[];
  const report=await runParameterSweep(b,spec,{execute,onSample:async(s,e)=>written.push({s,e})});
  assert.deepEqual(b,copy);assert.equal(report.samples.length,6);assert.equal(written.length,6);
  assert.equal(report.completedSamples,5);assert.equal(report.failedSamples,1);
  assert.equal(report.samples.at(-1).status,'invalid-input');assert.equal(report.samples.at(-1).native.status,'not-run');
  assert.equal(written.at(-1).e.bundle,null);
  for(const row of written.slice(0,-1)){
    const next=row.e.bundle;assert.equal(row.s.baselineSceneSha256,b.sceneSha256);
    assert.deepEqual(next.qualification.origin,b.qualification.origin);assert.deepEqual(next.qualification.assumptions,b.qualification.assumptions);
    assert.deepEqual(next.scene.simulation,b.scene.simulation);assert.equal(next.qualification.edits.length,row.s.value===12?0:1);
    if(row.s.value!==12)assert.equal(next.qualification.edits[0].changes[0].before,120);
  }
  const inf=report.samples[3].requestedResults.results[0];assert.equal(inf.value.kind,'at-infinity');
  const plot=plotSamples(report);assert.equal(plot[3].y,null);assert.equal(plot[5].y,null);
  assert.ok(plot[4].y<0); // virtual side of the singularity, not a fabricated positive coordinate
  const html=sweepHTML(report);assert.doesNotMatch(html,/<polyline|<script/);assert.match(html,/Discrete samples only/);
});
test('sweep rejects stale baselines, unknown fields, bad units and excessive budgets before native execution',async()=>{
  const b=await base(),s=specification(b);
  for(const spec of [{...s,expectedSceneSha256:'b'.repeat(64)},{...s,values:Array.from({length:26},(_,i)=>i)},
    {...s,values:[12,12]},{...s,values:['12']},{...s,values:[Infinity]},
    {...s,parameter:{...s.parameter,unit:undefined}},{...s,parameter:{...s.parameter,key:'__proto__'}},
    {...s,script:'arbitrary code'},{...s,plot:{observableId:'image',field:'eval'}}])assert.throws(()=>validateSweep(spec,b));
  const high=structuredClone(b);high.scene.simulation.maxRayDepth=20;
  assert.throws(()=>validateSweep(s,high),/budget/);
  await assert.rejects(createQualifiedBundle(high.scene,high.qualification,high.observables),/maxRayDepth/);
  const tampered=structuredClone(b);tampered.qualification.interpretation.assumptions=['tampered'];
  await assert.rejects(runParameterSweep(tampered,s,{execute}),/integrity/);
});
test('execution failures, incomplete runs and unavailable quantities remain visible; zero remains available',async()=>{
  const b=await base(),s={...specification(b),values:[12,18,20],observables:[...b.observables,{id:'index',kind:'refractive-index',componentId:'L1'}]};
  let calls=0;
  const r=await runParameterSweep(b,s,{execute:doc=>{
    calls++;if(calls===1)throw Error('native failure fixture');
    const e=execute(doc);if(calls===2){e.summary.executionPassed=false;e.summary.native.status='incomplete';}return e;
  }});
  assert.deepEqual(r.samples.map(s=>s.status),['execution-failed','incomplete','completed']);
  assert.equal(r.samples[1].requestedResults.results[0].status,'suppressed');
  assert.equal(r.samples[2].requestedResults.results.at(-1).status,'unavailable');
  const m=await base(2),ms={format:s.format,expectedSceneSha256:m.sceneSha256,parameter:{id:'D1',section:'parameters',key:'x',unit:'cm'},values:[0,20],plot:{observableId:'crossings',field:'value'}};
  const mr=await runParameterSweep(m,ms,{execute});assert.equal(plotSamples(mr)[1].y,0);
});
test('HTML escapes untrusted labels and evidence-write errors abort rather than masquerade as physics failures',async()=>{
  const b=await base(),s={...specification(b),values:[12],observables:[{id:'<script>alert(1)</script>',kind:'not-supported'}]};delete s.plot;
  const r=await runParameterSweep(b,s,{execute});const html=sweepHTML(r);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
  await assert.rejects(runParameterSweep(b,s,{execute,onSample:async()=>{throw Error('evidence disk failure');}}),/evidence disk/);
});
