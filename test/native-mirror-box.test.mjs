import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const fixture=read('../examples/native-mirror-box-v35.json');
const frozen=read('../evaluation/native-mirror-box-v1/frozen.json');
const original=()=>structuredClone(fixture.physical);
const byId=(p,id)=>p.components.find(c=>c.id===id);
const heading=([x,y])=>Math.atan2(y,x)*180/Math.PI;
const run=(doc,runner=core)=>evaluateDocument(doc,runner,fixture.requests).summary;

for(const [tx,ty] of frozen.geometry.manyTranslationsMm)test(`v35 uses native reflection order and absorption at ${tx},${ty}`,async()=>{
  for(const route of frozen.expectedForward)for(const reverse of [false,true]){
    const p=original(),source=byId(p,'S'),target=byId(p,'B');
    const vector=reverse?route.vector.map(v=>-v):route.vector;
    source.emission.directionDeg=heading(vector);
    if(reverse){
      const {x,y}=source.parameters;
      Object.assign(source.parameters,{x:target.parameters.x,y:target.parameters.y});
      Object.assign(target.parameters,{x,y});
      for(const c of p.components.slice(1))
        c.parameters.orientationDeg=c.parameters.orientationDeg===90?-90:180;
    }
    for(const c of p.components){c.parameters.x+=tx;c.parameters.y+=ty;}
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,35);
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['SingleRay','Mirror','Mirror','Mirror','Mirror','Blocker']);
    const actual=[];
    const observing={...core,loadDocument(...args){
      const loaded=core.loadDocument(...args);
      for(const c of p.components.slice(1)){
        const obj=loaded.scene.objs[loaded.idMap.get(c.id)],incident=obj.onRayIncident;
        obj.onRayIncident=function(...a){
          const result=incident.apply(this,a);
          if(c.id==='B')assert.equal(result?.isAbsorbed,true);
          actual.push(c.id);
          return result;
        };
      }
      return loaded;
    }};
    const summary=run(doc,observing);
    const order=reverse?[...route.wallOrder].reverse():route.wallOrder;
    assert.deepEqual(actual,[...order,'B']);
    assert.equal(summary.observations?.v35MirrorBoxVerified,true,summary.native.error??summary.native.errors.join(','));
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.deepEqual(results.map(r=>r.value),[1,1,1,1,1]);
  }
});

test('v35 withholds exact corner escape, a native near-endpoint reflection and early absorption',async()=>{
  const p=original();
  Object.assign(byId(p,'S').parameters,{x:50,y:50});
  Object.assign(byId(p,'B').parameters,{x:150,y:148});
  for(const id of ['left','right'])Object.assign(byId(p,id).parameters,{x:id==='left'?0:200,y:100,length:199.6});
  for(const id of ['bottom','top'])Object.assign(byId(p,id).parameters,{x:100,y:id==='bottom'?0:200,length:199.6});
  byId(p,'S').emission.directionDeg=45;
  const corner=run(prepareScene(p).document);
  assert.equal(corner.observations,null);
  assert.match(corner.native.errors.join(','),/did not complete/);
  byId(p,'S').emission.directionDeg=heading([500,498]);
  const rim=run(prepareScene(p).document);
  assert.equal(rim.observations,null);
  assert.match(rim.native.errors.join(','),/ambiguous finite encounter/);
  const targetRim=original();
  byId(targetRim,'B').parameters.y-=.95;
  const rimAtTarget=run(prepareScene(targetRim).document);
  assert.equal(rimAtTarget.observations,null);
  assert.match(rimAtTarget.native.errors.join(','),/B: ambiguous finite encounter/);
  const early=original();
  byId(early,'S').emission.directionDeg=0;
  byId(early,'B').parameters.y=byId(early,'S').parameters.y;
  const doc=prepareScene(early).document,summary=run(doc);
  assert.equal(summary.observations,null);
  assert.match(summary.native.errors.join(','),/absorption did not follow/);
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.value===null));
});

test('v35 withholds unverified absorption, an explicit stop, and stale audit evidence',async()=>{
  const doc=prepareScene(original()).document,complete=run(doc);
  delete complete.observations.v35MirrorBoxVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,complete)).results.every(r=>r.status==='suppressed'));
  const noAbsorption={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    const target=loaded.scene.objs[loaded.idMap.get('B')];
    const incident=target.onRayIncident;
    target.onRayIncident=function(...a){incident.apply(this,a);return {};};
    return loaded;
  }};
  assert.equal(run(doc,noAbsorption).observations,null);
  doc.simulation.processedRayLimit=1;
  const stopped=run(doc);
  assert.equal(stopped.native.status,'stopped');
  assert.equal(stopped.observations,null);
});

test('only the explicit v35 profile admits a SingleRay mirror box with separated axis-aligned sides',()=>{
  for(const change of [
    p=>delete p.model,
    p=>p.components.pop(),
    p=>byId(p,'left').parameters.orientationDeg=89,
    p=>byId(p,'top').parameters.length=300,
    p=>byId(p,'right').parameters.y=90.1,
    p=>byId(p,'S').parameters.x=0,
    p=>byId(p,'B').parameters.x=300
  ]){
    const p=original();change(p);assert.throws(()=>prepareScene(p));
  }
});

test('v35 withholds a collinear change to the native launch origin before the first wall',()=>{
  const doc=prepareScene(original()).document;
  let changed=false;
  const movingOrigin={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    const mirror=loaded.scene.objs[loaded.idMap.get('left')],intersect=mirror.checkRayIntersects;
    mirror.checkRayIntersects=function(ray,...rest){
      const result=intersect.call(this,ray,...rest);
      if(result&&!changed){
        const dx=ray.p2.x-ray.p1.x,dy=ray.p2.y-ray.p1.y;
        const shift=.02/Math.hypot(dx,dy);
        ray.p1={x:ray.p1.x+dx*shift,y:ray.p1.y+dy*shift};
        ray.p2={x:ray.p2.x+dx*shift,y:ray.p2.y+dy*shift};
        changed=true;
      }
      return result;
    };
    return loaded;
  }};
  const observed=run(doc,movingOrigin);
  assert.equal(changed,true);
  assert.equal(observed.observations,null);
  assert.match(observed.native.errors.join(','),/broken ray continuity/);
});
