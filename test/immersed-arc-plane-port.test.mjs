import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/immersed-arc-plane-port-v34.json',import.meta.url)));
const original=()=>structuredClone(fixture.physical);
test('v34 composes actual direct and reflected trips to the same exterior detector',async()=>{
  for(const [depth,expectedX] of [[25,-100/3],[50,null],[75,100]])for(const heading of [0,180,-180]){
    const p=original();
    p.components[0].parameters.x=depth;
    p.components[0].emission.directionDeg=heading;
    if(heading===-180)p.components.at(-1).parameters.orientationDeg=-90;
    const reflected=heading===0;
    for(const c of p.components){c.parameters.x+=120;c.parameters.y-=75;}
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,34);assert.deepEqual(parseSave(serializeSave(doc)),doc);
    assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['AngleSource','PlaneGlass','ArcMirror','Detector']);
    const {summary}=evaluateDocument(doc,core,fixture.requests);
    assert.equal(summary.observations?.v34ImmersedArcVerified,true);
    assert.equal(Math.sign(summary.observations.detectorsById.D.signedPower),heading===-180?-1:1);
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.deepEqual(results.slice(0,2).map(r=>r.value),[reflected?3:0,3]);
    for(const {pointMm,incomingUnit} of results[2].value){
      assert.ok(incomingUnit.x<0);
      const slope=incomingUnit.y/incomingUnit.x;
      if(reflected&&expectedX===null)assert.ok(Math.abs(slope)<.00002);
      else{
        const intercept=pointMm.x-120-(pointMm.y+75)/slope;
        assert.ok(Math.abs(intercept-(reflected?expectedX:depth/1.5))<.20);
      }
    }
  }
});
test('v34 rejects ambiguous spaces, incomplete callback paths and absent evidence',async()=>{
  for(const change of [
    p=>delete p.model,p=>p.components[0].parameters.x=0,p=>p.components[0].parameters.x=100,
    p=>p.components[0].emission.directionDeg=90,p=>p.components[1].parameters.positiveIndex=1.61,
    p=>p.components[1].parameters.partialReflection=true,p=>p.components[2].parameters.normalDeg=0,
    p=>p.components[3].parameters.x=0,p=>p.runPolicy='preview-v1'
  ]){
    const p=original();change(p);assert.throws(()=>prepareScene(p));
  }
  const doc=prepareScene(original()).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v34ImmersedArcVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disappeared={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('M')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disappeared,fixture.requests).summary.observations,null);
  const loaded=core.loadDocument(doc),detectorPrototype=Object.getPrototypeOf(loaded.scene.objs[loaded.idMap.get('D')]);
  const nativeDetector=detectorPrototype.onRayIncident;
  detectorPrototype.onRayIncident=function(...args){
    const result=nativeDetector.apply(this,args);
    this.power=0;
    return result;
  };
  try{
    assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
  }finally{
    detectorPrototype.onRayIncident=nativeDetector;
  }
  doc.simulation.processedRayLimit=1;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});

test('v34 withholds altered brightness at emission, reflection, refraction or detection',()=>{
  const doc=prepareScene(original()).document;
  const {scene}=core.loadDocument(doc);
  for(const [i,obj] of scene.objs.entries()){
    const name=i===0?'onSimulationStart':'onRayIncident';
    const prototype=Object.getPrototypeOf(obj),delegate=prototype[name];
    let changed=0;
    prototype[name]=function(...args){
      const result=delegate.apply(this,args);
      const ray=i===0?result.newRays[0]:args[0];
      ray.brightness_s*=.5;
      changed++;
      return result;
    };
    try{
      assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
      assert.ok(changed>0);
    }finally{
      prototype[name]=delegate;
    }
  }
});

test('v34 withholds offset native detector power before or after its complete fan',()=>{
  const doc=prepareScene(original()).document;
  const {scene,idMap}=core.loadDocument(doc);
  const index=idMap.get('D'),prototype=Object.getPrototypeOf(scene.objs[index]);
  const start=prototype.onSimulationStart;
  prototype.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    this.power+=10;
    return result;
  };
  try{
    assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
  }finally{
    prototype.onSimulationStart=start;
  }
  let changed=false;
  const offsetAtCompletion={...core,Simulator:class extends core.Simulator{
    emit(event,...args){
      if(event==='simulationComplete'){
        this.scene.objs[index].power+=10;
        changed=true;
      }
      return super.emit(event,...args);
    }
  }};
  assert.equal(evaluateDocument(doc,offsetAtCompletion,fixture.requests).summary.observations,null);
  assert.equal(changed,true);
});
