import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-parallel-two-lens-v20.json',import.meta.url)));
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const evidence=mkdtempSync(join(root,'offset-focus-native-'));
for(const [label,gap,f2,xFocus,yFocus] of [
  ['upstream',600,-200,200*7/3,2*2/3],['collimated',300,100,null,null],['at-rear',200,200,200,0]
])test('A35 native v20 output '+label,()=>{
  const p=structuredClone(fixture.physical);
  Object.assign(p.components.find(c=>c.id==='L2').parameters,{x:gap,focalLength:f2});
  for(const detector of p.components.filter(c=>c.type==='ray-detector'))detector.parameters.length=400;
  const doc=prepareScene(p).document;
  const pathCounts=new Map();
  const observed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    for(const id of ['L1','L2']){
      const lens=loaded.scene.objs[loaded.idMap.get(id)],incident=lens.onRayIncident;
      lens.onRayIncident=function(ray,...rest){
        pathCounts.set(ray,[...(pathCounts.get(ray)??[]),id]);
        return incident.call(this,ray,...rest);
      };
    }
    return loaded;
  }};
  const {summary}=evaluateDocument(doc,observed,fixture.requests);
  assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
  assert.equal(pathCounts.size,8);
  for(const path of pathCounts.values())assert.deepEqual(path,['L1','L2']);
  for(const id of ['D1','D2']){
    const section=summary.observations.detectorHitEventsById[id];
    assert.equal(section.status,'complete');assert.equal(section.events.length,8);
    for(const {pointMm,incomingUnit} of section.events){
      assert.ok(incomingUnit.x>0);
      const slope=incomingUnit.y/incomingUnit.x;
      if(label==='collimated')assert.ok(Math.abs(slope-2/f2)<1e-9);
      else assert.ok(Math.abs(pointMm.y+(xFocus-pointMm.x)*slope-yFocus)<1e-6);
    }
  }
  writeFileSync(join(evidence,label+'.json'),JSON.stringify({doc,summary,lensEncounters:[...pathCounts.values()]},null,2),{flag:'wx'});
});
