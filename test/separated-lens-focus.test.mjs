import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {planProblem} from '../src/problem-workflow.js';
const read=name=>readFileSync(new URL(name,import.meta.url));
const problem=id=>JSON.parse(read('../examples/angular-focus-a'+id+'.json'));
const run=p=>planProblem(p).results[0];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,JSON.stringify({a,b}));
test('public CLI: frozen source cases and qualified reference conventions',async()=>{
  const atlas=JSON.parse(read('../evaluation/optical-systems-atlas-v1/review.json'));
  const protocol=JSON.parse(read('../evaluation/separated-lens-angular-focus-v1/frozen-protocol.json'));
  const base='test-artifacts/llm-authoring';mkdirSync(base,{recursive:true});
  const dir=mkdtempSync(join(base,'angular-focus-'));
  for(const {id,sourceImageSha256} of protocol.cases){
    assert.equal(atlas.cases.find(c=>c.id===id).imageSha256,sourceImageSha256);
    const {report}=await runProblemEvidence({inputBytes:read('../examples/angular-focus-'+id.toLowerCase()+'.json'),outputPath:join(dir,id)});
    assert.equal(report.native.status,'not-run');assert.equal(report.portable.status,'not-created');
    assert.equal(report.results[0].status,'conditional');const v=report.results[0].value;
    close(v.signedAngularGain,id==='A39'?-327.5:-200/19);
    if(id==='A40'){close(v.farFocusSeparation,.55);close(v.eyepieceShiftFromFarFocus,1/38);}
  }
  const microscope=problem(39);microscope.physical.given.kind='focal-plane-interval';
  close(run(microscope).value.signedAngularGain,-400);close(run(microscope).value.lensPlaneSeparation,189);
  const telescope=problem(40);telescope.physical.angleReference.kind='eyepiece-plane';
  close(run(telescope).value.signedAngularGain,-200/19*(1+(10/19+.05)/10));
  telescope.physical.given.value='infinity';close(run(telescope).value.signedAngularGain,-10);
  assert.equal(run(telescope).value.eyepieceShiftFromFarFocus,0);
});
test('source unit, branch and conditioning guards',()=>{
  const p=problem(40),f=p.physical;
  f.lengthUnit='mm';f.objective.focalLength*=1000;f.eyepiece.focalLength*=1000;f.given.value*=1000;
  close(run(p).value.eyepieceShiftFromFarFocus,1000/38);close(run(p).value.signedAngularGain,-200/19);
  f.given.value=500+1e-9;assert.equal(run(p).status,'numerically-indeterminate');
  f.given.value=450;assert.equal(run(p).status,'unavailable');
  f.given={kind:'lens-plane-separation',value:400};assert.equal(run(p).status,'unavailable');
  f.given.value=550+1e-9;assert.equal(run(p).status,'numerically-indeterminate');
  for(const mutate of [f=>delete f.output,f=>delete f.angleReference,f=>delete f.given.kind,
    f=>f.eyepiece.id=f.objective.id,f=>f.objective.focalLength=-4,f=>f.given.unit='cm',
    f=>f.angleReference.kind='unspecified',f=>f.given={kind:'object-distance-from-objective',value:'infinity'}]){
    const m=problem(39);mutate(m.physical);assert.equal(run(m).value,null);
  }
});
