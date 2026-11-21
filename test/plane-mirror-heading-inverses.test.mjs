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
test('heading inverse preserves small positive incidence, stable grazing geometry and the exact cutoff',()=>{
  const request=example('mirror-incidence-a01'),f=request.physical;
  f.incoming={x:1,y:0};f.outgoing={x:-1,y:1e-16};
  const small=result(request).value;
  assert.ok(small.incidenceAngleDeg>0);
  assert.ok(Math.abs(small.incidenceAngleDeg-1e-16*90/Math.PI)<1e-28);
  f.outgoing.y=1e-300;
  assert.ok(Math.abs(result(request).value.incidenceAngleDeg/1e-300-90/Math.PI)<1e-12);
  f.outgoing.y=Number.MIN_VALUE;
  assert.equal(result(request).reasonCode,'DIRECTION_RESOLUTION_EXCEEDED');
  f.incoming={x:1,y:1};f.outgoing={x:1,y:1.00000000201};
  const n=result(request).value.normalLineDirection;
  const factor=2*(n.x+n.y)/Math.sqrt(2),after={x:1/Math.sqrt(2)-factor*n.x,y:1/Math.sqrt(2)-factor*n.y};
  const length=Math.hypot(f.outgoing.x,f.outgoing.y);
  assert.ok(Math.hypot(after.x-f.outgoing.x/length,after.y-f.outgoing.y/length)<1e-14);
  f.incoming={x:-4.858584759550399,y:-6.222875581039037};
  f.outgoing={x:-2.6497192137419563,y:-3.393760496487345};
  assert.equal(result(request).reasonCode,'DIRECTIONS_UNRESOLVED_AT_GRAZING');
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
