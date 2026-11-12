import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const first=JSON.parse(readFileSync(new URL('../evaluation/llm-pilot-v1/prospective-eight/first-attempt.json',import.meta.url)));
const key=JSON.parse(readFileSync(new URL('../evaluation/llm-pilot-v1/prospective-eight/post-solution-review.json',import.meta.url)));
test('prospective model attempt is sealed before any selected solution comparison',()=>{
  assert.equal(first.conditions.solutionsOpened,false);
  assert.equal(first.cases.length,8);
  assert.equal(first.cases.filter(x=>x.scope==='illustration-only').length,3);
  assert.equal(first.cases.filter(x=>x.scope==='unsupported').length,5);
  assert.equal(key.firstAttemptCommit,'af6fc5dd1ad2fbb2aa8260dc0c283df3a9abdf05');
  assert.equal(key.keyOpenedAfterSealingOnly.length,3);
});
test('two-plane reflection solution is geometric; net and accumulated deviations are distinct',()=>{
  const x=20*5/(5+20);
  assert.equal(x,4);
  const theta=180/3;
  assert.equal(theta,60);
  const deflectionCcw=4*theta;
  assert.equal(deflectionCcw,240);
  const equivalentCw=((deflectionCcw+180)%360)-180;
  assert.equal(equivalentCw,-120);
});
test('parallel-mirror virtual image orbit counts repeated distances for distinct images',()=>{
  const original=10,wall1=0,wall2=40;
  const virtual=new Set(),frontier=[original],seen=new Set([original]);
  for(let depth=0;depth<8;depth++){
    const next=[];
    for(const position of frontier){
      for(const wall of [wall1,wall2]){
        const image=2*wall-position;
        if(!seen.has(image)){seen.add(image);next.push(image);virtual.add(image);}
      }
    }
    frontier.splice(0,frontier.length,...next);
  }
  const ordered=[...virtual].map(x=>({x,distance:Math.abs(x-original)}))
    .sort((a,b)=>a.distance-b.distance||a.x-b.x);
  assert.deepEqual(ordered.slice(0,5).map(x=>x.distance),[20,60,80,80,100]);
  assert.deepEqual([...new Set(ordered.map(x=>x.distance))].slice(0,5),
    [20,60,80,100,140]);
  assert.equal(ordered.filter(x=>x.distance===80).length,2);
  assert.ok(key.findings.find(x=>x.id==='F04').assessment==='answer-key-ambiguity');
});
