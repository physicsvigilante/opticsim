import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';

const example=name=>JSON.parse(readFileSync(new URL('../examples/'+name+'.json',import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,JSON.stringify({actual:a,expected:b}));
const result=request=>planProblem(request).results[0];
test('A01 heading inverse returns incidence from normal and preserves directed inputs',async()=>{
  const request=example('mirror-incidence-a01'),r=await result(request);
  assert.equal(r.status,'conditional');
  close(r.value.incidenceAngleDeg,30);
  close(r.value.principalDeviationMagnitudeDeg,120);
  close(Math.abs(r.value.normalLineDirection.y),1);
  request.physical.outgoing={x:-0.5,y:-Math.sqrt(3)/2};
  close((await result(request)).value.incidenceAngleDeg,0);
  request.physical.outgoing={...request.physical.incoming,y:request.physical.incoming.y+1e-12};
  assert.equal((await result(request)).reasonCode,'DIRECTIONS_UNRESOLVED_AT_GRAZING');
  request.physical.outgoing={x:0,y:0};
  assert.equal((await result(request)).status,'invalid-input');
});
test('A02 enumerates both inclined orientations and both input headings',async()=>{
  const request=example('two-mirror-inclination-a02'),r=await result(request);
  assert.equal(r.status,'conditional');
  assert.equal(r.value.angleBetweenMirrorsDeg,60);
  assert.equal(r.value.principalDeviationMagnitudeDeg,120);
  assert.equal(r.value.sumOfTurnMagnitudesDeg,240);
  assert.deepEqual(r.value.candidates.map(c=>c.headingSequenceDeg),[[300,60,180],[120,240,0],[60,300,180],[240,120,0]]);
  assert.deepEqual(r.value.candidates.map(c=>c.signedPrincipalDeviationDeg),[-120,-120,120,120]);
});
test('crossed parallel/perpendicular constraints exclude the grazing branch',async()=>{
  for(const [p,q] of [['parallel','perpendicular'],['perpendicular','parallel'],['perpendicular','perpendicular']]){
    const request=example('two-mirror-inclination-a02');
    request.physical.incomingToSecond=p;
    request.physical.outgoingToFirst=q;
    const r=await result(request),both=p===q;
    assert.equal(r.status,'conditional');
    assert.equal(r.value.angleBetweenMirrorsDeg,both?60:30);
    assert.equal(r.value.principalDeviationMagnitudeDeg,both?120:60);
    assert.equal(r.value.sumOfTurnMagnitudesDeg,both?120:180);
    for(const c of r.value.candidates)assert.ok(c.incidenceFromNormalDeg.every(a=>a<90));
  }
  assert.equal(problemWorkflowCapabilities().requestKinds['two-mirror-inclination-and-deviation'].route,'conditional-analytical');
});
