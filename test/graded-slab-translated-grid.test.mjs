import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runGradedSlab} from './support/graded-slab-native.mjs';

const {grid}=JSON.parse(readFileSync(new URL('../evaluation/graded-slab-public-qualification-v1/frozen.json',import.meta.url)));
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'graded-slab-translated-'));
for(const [entryX,entryY] of grid.translationsMm)test('translated pinned GRIN slab at '+entryX+', '+entryY,()=>{
  const residuals=[];
  for(const angle of grid.anglesFromNormalDeg)for(const thickness of grid.thicknessMm){
    const observed=runGradedSlab(angle,.00025,{entryX,entryY,thickness});
    assert.equal(observed.terminal,'simulationComplete');assert.equal(observed.status,'completed');
    assert.equal(observed.starts,1);assert.equal(observed.hits.length,1);
    const [entrance]=observed.sampled,exit=observed.sampled.at(-1),hit=observed.hits[0];
    assert.ok(Math.hypot(entrance.x-entryX,entrance.y-entryY)<1e-8);
    assert.ok(Math.abs(exit.y-entryY-thickness)<1e-7&&Math.abs(hit.y-entryY-thickness-.2)<1e-7);
    const q=Math.sin(angle*Math.PI/180),vertical=Math.cos(angle*Math.PI/180);
    const exitX=2*q*thickness/(Math.sqrt(vertical*vertical+thickness)+vertical);
    const expectedDetectorX=exitX+.2*q/vertical;
    const pathError=Math.max(...observed.sampled.map(p=>{
      const dx=p.x-entryX,dy=p.y-entryY;
      return Math.abs(dy-(vertical/q+dx/(4*q*q))*dx);
    }));
    const detectorError=Math.abs(hit.x-entryX-expectedDetectorX);
    assert.ok(pathError<.003&&detectorError<.003&&Math.abs(hit.direction.x-q)<.003,
      JSON.stringify({angle,thickness,pathError,detectorError,actual:hit.direction.x,q}));
    assert.ok(exit.x-entryX>-.4&&exit.x-entryX<2.9&&hit.x-entryX>-.4&&hit.x-entryX<2.9);
    residuals.push({angle,thickness,pathError,detectorError,directionError:Math.abs(hit.direction.x-q)});
  }
  const stopped=runGradedSlab(60,.00025,{entryX,entryY,thickness:.3,limit:2});
  assert.equal(stopped.terminal,'simulationStop');assert.equal(stopped.hits.length,0);
  writeFileSync(join(out,entryX+'.json'),JSON.stringify({entryX,entryY,residuals},null,2),{flag:'wx'});
});
