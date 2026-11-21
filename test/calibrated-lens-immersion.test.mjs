import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';
import {fromBinary64,toBinary64} from '../src/binary64-rational.js';
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/calibrated-lens-immersion.json',import.meta.url)));
const results=p=>planProblem(p).results;
test('exact admissible distance rounds once to the public ceiling with either focal sign',()=>{
  const p=fixture(), f=p.physical;
  f.lengthUnit='mm';
  f.materialIndex=2.4056204094551505;
  f.reference.exteriorIndex=2.0340446971201906;
  f.media[0].exteriorIndex=2.405617658978879;
  for(const sign of [-1,1]){
    f.reference.signedFocalLength=sign*6258.848979845186;
    assert.equal(results(p)[0].value.signedFocalLength,sign*1e9);
  }
});
test('exact quotient conversion handles halfway rounding, subnormal spacing and exponent carry',()=>{
  const den=1n<<53n;
  assert.equal(toBinary64({n:den+1n,d:den}),1);
  assert.equal(toBinary64({n:den+3n,d:den}),1+2**-51);
  assert.equal(toBinary64({n:2n*den-1n,d:den}),2);
  assert.ok(Object.is(toBinary64({n:-1n,d:1n<<1075n}),-0));
  assert.equal(toBinary64({n:3n,d:1n<<1075n}),2*Number.MIN_VALUE);
  for(const value of [Number.MIN_VALUE,2**-1022,-1.25,Number.MAX_VALUE]){
    assert.equal(toBinary64(fromBinary64(value)),value);
  }
});
test('signed focal transfer through both frozen media preserves units and lens identity',()=>{
  for(const [unit,scale] of [['mm',10],['cm',1],['m',0.01]]){
    const p=fixture();
    p.physical.lengthUnit=unit;
    p.physical.reference.signedFocalLength*=scale;
    for(const [i,r] of results(p).entries()){
      assert.equal(r.status,'conditional');
      assert.equal(r.nativeObservation,false);
      assert.equal(r.value.lensId,'L');
      assert.equal(r.value.mediumId,p.requests[i].mediumId);
      assert.ok(Math.abs(r.value.signedFocalLength/scale-[90,-102][i])<1e-10);
    }
  }
});
test('repeating the reference preserves negative focal length and a matched target is afocal',()=>{
  const p=fixture(), f=p.physical;
  f.reference.signedFocalLength=-11;
  f.media[0].exteriorIndex=f.reference.exteriorIndex;
  f.media[1].exteriorIndex=f.materialIndex;
  const [a,b]=results(p);
  assert.equal(a.value.signedFocalLength,-11);
  assert.equal(a.value.state,'diverging');
  assert.equal(b.value.signedFocalLength,null);
  assert.equal(b.value.state,'afocal');
});
test('near matching withholds the affected target, and invalid finite calibrations block every target',()=>{
  const p=fixture();
  p.physical.media[0].exteriorIndex=1.60000000001;
  assert.deepEqual(results(p).map(r=>r.status),['numerically-indeterminate','conditional']);
  p.physical.reference.exteriorIndex=1.60000000001;
  assert.ok(results(p).every(r=>r.status==='numerically-indeterminate'));
  p.physical.reference.exteriorIndex=1.6;
  assert.ok(results(p).every(r=>r.status==='invalid-input'));
});
test('absent calibration and unknown target are explicit',()=>{
  const p=fixture();
  p.requests[0].mediumId='absent';
  assert.equal(results(p)[0].status,'unavailable');
  delete p.physical.reference.signedFocalLength;
  assert.equal(results(p)[1].status,'needs-information');
});
