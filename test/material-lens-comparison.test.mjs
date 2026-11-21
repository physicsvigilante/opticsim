import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';

const read=file=>JSON.parse(readFileSync(new URL(file,import.meta.url)));
const example=()=>read('../examples/material-lens-a34.json');
const run=p=>planProblem(p).results[0];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,JSON.stringify({a,b}));

test('A34 common curvature cancels without assigning radii',()=>{
  const frozen=read('../evaluation/immersed-material-lens-v1/frozen-protocol.json');
  const atlas=read('../evaluation/optical-systems-atlas-v1/review.json');
  assert.equal(atlas.cases.find(c=>c.id==='A34').imageSha256,frozen.source.sha256);
  const p=example(),r=run(p);
  assert.equal(r.status,'conditional');assert.equal(r.nativePathVerified,false);
  const [air,liquid]=r.value.comparisons;
  near(air.firstOverSecondFocalLength,1.4);near(liquid.firstOverSecondFocalLength,-1);
  assert.deepEqual(liquid.lenses,[{id:'glass1',action:'diverging'},{id:'glass2',action:'converging'}]);
  p.physical.shape.kind='negative-curvature-factor';
  assert.deepEqual(run(p).value.comparisons[1].lenses.map(l=>l.action),['converging','diverging']);
});

test('measured curvature gives power and medium-specific focal length',()=>{
  const p=example();p.physical.shape={kind:'signed-radii-metres',front:.2,rear:-.2};
  const [air,liquid]=run(p).value.comparisons;
  near(air.lenses[0].powerD,5);near(air.lenses[1].powerD,7);
  near(liquid.lenses[0].signedFocalLengthM,-1.6);near(liquid.lenses[1].signedFocalLengthM,1.6);
  p.physical.media[1].index=1.5;
  const matched=run(p).value.comparisons[1];
  assert.equal(matched.lenses[0].action,'afocal');assert.equal(matched.ratioState,'unavailable-afocal');
  p.physical.shape.rear=.2;assert.ok(run(p).value.comparisons.every(c=>c.lenses.every(l=>l.powerD===0)));
  p.physical.shape.rear+=1e-15;assert.equal(run(p).status,'numerically-indeterminate');
  p.physical.shape.rear=-.2;p.physical.media[1].index+=Number.EPSILON;
  assert.equal(run(p).status,'numerically-indeterminate');
});

test('missing media, incompatible model and invalid comparison operands withhold results',()=>{
  const p=example();delete p.physical.media;assert.equal(run(p).status,'needs-information');
  for(const change of [f=>f.shape={kind:'separate-shapes'},f=>f.model='thick-lens',f=>f.materials.pop(),
    f=>f.media.push(f.media[0]),f=>f.materials[0].index=4.01,f=>f.shape={kind:'signed-radii-metres',front:0,rear:-1}]){
    const bad=example();change(bad.physical);assert.equal(run(bad).value,null);
  }
});
