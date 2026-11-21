import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {apparatusPoints} from '../src/result-preview.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const fixture=read('../examples/inside-cap-v32.json');
const freeze=read('../evaluation/finite-circular-cap-v1/frozen.json');
const original=()=>structuredClone(fixture.physical);
test('public v32 uses a real arc and closing chord and qualifies translated native probes',async()=>{
  for(const c of freeze.cases){
    const p=original(),[source,cap,detector]=p.components.map(c=>c.parameters);
    Object.assign(source,{x:20+.0625,y:-30});
    Object.assign(cap,{x:20,y:-30,radius:c.radiusMm,capHeight:c.heightMm,insideIndex:c.insideIndex});
    Object.assign(detector,{x:20+c.observerXmm,y:-30});
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,32);assert.deepEqual(parseSave(serializeSave(doc)),doc);
    const native=core.compile(doc).native.objs;
    assert.deepEqual(native.map(o=>o.type),['AngleSource','Glass','Detector']);
    assert.deepEqual(native[1].path.map(o=>o.arc),[false,true,false]);
    assert.deepEqual(native[1].path.map(o=>o.x),[20,20+c.heightMm,20]);
    const top=-30+Math.sqrt(c.heightMm*(2*c.radiusMm-c.heightMm));
    assert.ok(apparatusPoints(doc).some(p=>p.x===20&&p.y===top));
    const {summary}=evaluateDocument(doc,core,fixture.requests);
    assert.equal(summary.observations?.v32CapVerified,true);
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.equal(results[0].value['face-flat'].interactions,0);
    assert.equal(results[0].value['face-arc'].interactions,3);
    for(const {pointMm,incomingUnit} of results[1].value){
      const estimated=(pointMm.y+30)*incomingUnit.x/incomingUnit.y;
      assert.ok(Math.abs(estimated-c.expectedObserverDistanceMm)<.10);
    }
  }
});
test('v32 refuses facet contact, excessive curvature and unverified measurement',async()=>{
  for(const edit of [
    p=>delete p.model,p=>p.components[0].parameters.x=0,p=>p.components[0].parameters.y=.01,
    p=>p.components[0].emission.directionDeg=1,p=>p.components[1].parameters.capHeight=51,
    p=>p.components[1].parameters.capHeight=9,p=>p.components[1].parameters.partialReflection=true,
    p=>p.components[1].parameters.insideIndex=1.8,p=>p.components[2].parameters.x=30.99,p=>p.runPolicy='preview-v1'
  ]){
    const p=original();edit(p);assert.throws(()=>prepareScene(p));
  }
  const doc=prepareScene(original()).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v32CapVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('D')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  doc.simulation.processedRayLimit=1;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});

test('v32 withholds detector observations if native pass-through state or signed power is inconsistent',()=>{
  const doc=prepareScene(original()).document;
  const loaded=core.loadDocument(doc),detector=loaded.scene.objs[loaded.idMap.get('D')];
  const prototype=Object.getPrototypeOf(detector),nativeIncident=prototype.onRayIncident;
  for(const corrupt of [
    ()=>({isAbsorbed:true}),
    ray=>{ray.p1.x+=1;ray.p2.x+=1;},
    function(){this.power=0;}
  ]){
    prototype.onRayIncident=function(ray,...args){
      const result=nativeIncident.call(this,ray,...args);
      return corrupt.call(this,ray)??result;
    };
    try{
      const {summary}=evaluateDocument(doc,core,fixture.requests);
      assert.equal(summary.observations,null);
      assert.equal(summary.executionPassed,false);
    }finally{
      prototype.onRayIncident=nativeIncident;
    }
  }
});
