import test from 'node:test';
import assert from 'node:assert/strict';
import {observeSphericalMirror} from './support/spherical-mirror-native.mjs';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'mirror-image-outline-'));
for(const [id,distance,height] of [['A',330,0],['B',330,1],['E',280,2],['D',280,0]])
  test('A09 independent native source at vertex '+id,()=>{
    const {doc,summary,intersections}=observeSphericalMirror({distance,height,detectorX:-100});
    const expected={x:-100*distance/(distance-100),y:-100*height/(distance-100)};
    for(const {x,y} of intersections)assert.ok(Math.abs(x-expected.x)<.15&&Math.abs(y-expected.y)<.025);
    writeFileSync(join(out,id+'.json'),JSON.stringify({doc,summary,expected,intersections},null,2),{flag:'wx'});
  });
