import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {observeSphericalMirror} from './support/spherical-mirror-native.mjs';

const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'axial-mirror-oscillation-native-'));
for(const [phase,distance,expected] of [[0,300,150],[.25,200,200],[.5,100,null]])
  test('A08 independent native configuration at phase '+phase,()=>{
    const measured=observeSphericalMirror({distance,height:0,detectorX:-30,measureIntersections:expected!==null});
    if(expected===null){
      for(const e of measured.returning)assert.ok(Math.abs(e.incomingUnit.y/e.incomingUnit.x)<.000005);
    }else{
      for(const {x,y} of measured.intersections)assert.ok(Math.abs(x+expected)<.15&&Math.abs(y)<.01);
    }
    writeFileSync(join(out,phase+'.json'),JSON.stringify({measured,expected},null,2),{flag:'wx'});
  });
