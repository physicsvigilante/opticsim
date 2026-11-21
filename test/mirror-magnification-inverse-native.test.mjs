import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {observeSphericalMirror} from './support/spherical-mirror-native.mjs';

const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'mirror-magnification-native-'));
for(const [distance,imageX,magnification] of [[75,300,4],[125,-500,-4]])for(const height of [0,.1])
  test('A07 pinned mirror placement '+distance+' and source height '+height,()=>{
    const measured=observeSphericalMirror({distance,height,detectorX:-30});
    for(const {x,y} of measured.intersections){
      assert.ok(Math.abs(x-imageX)<.7 && Math.abs(y-magnification*height)<.012,
        JSON.stringify({distance,height,x,y}));
      assert.equal(Math.sign(x),Math.sign(imageX));
      if(height>0)assert.equal(Math.sign(y),Math.sign(magnification));
    }
    writeFileSync(join(out,distance+'-'+height+'.json'),JSON.stringify({measured,imageX,magnification},null,2),{flag:'wx'});
  });
