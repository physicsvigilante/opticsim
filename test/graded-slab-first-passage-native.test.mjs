import test from 'node:test';
import assert from 'node:assert/strict';
import {runGradedSlab} from './support/graded-slab-native.mjs';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'graded-slab-first-passage-'));
const rad=Math.PI/180;
const thickness=.3;

for(const i of [20,60,80])test('A15 non-grazing native first passage at '+i+' degrees',()=>{
  const q=Math.sin(i*rad),b=Math.cos(i*rad);
  const expected=2*q*thickness/(Math.sqrt(b*b+thickness)+b);
  const deviations=[];
  for(const stepSize of [.001,.00025]){
    const observed=runGradedSlab(i,stepSize);
    writeFileSync(join(out,i+'-'+stepSize+'.json'),JSON.stringify({observed,expected},null,2),{flag:'wx'});
    assert.equal(observed.terminal,'simulationComplete');assert.equal(observed.status,'completed');
    assert.equal(observed.starts,1);assert.equal(observed.hits.length,1);
    const [entrance]=observed.sampled,exit=observed.sampled.at(-1);
    assert.ok(Math.hypot(entrance.x,entrance.y)<1e-7);
    assert.ok(Math.abs(exit.y-thickness)<1e-7&&Math.abs(exit.x-expected)<.003,JSON.stringify({exit,expected,i,stepSize}));
    assert.ok(observed.hits[0].direction.y>0 && Math.abs(observed.hits[0].direction.x-q)<.003);
    const residual=Math.max(...observed.sampled.map(p=>Math.abs(p.y-b*p.x/q-p.x*p.x/(4*q*q))));
    assert.ok(residual<.003);
    deviations.push(residual);
  }
  assert.ok(deviations[1]<=deviations[0],JSON.stringify(deviations));
});
