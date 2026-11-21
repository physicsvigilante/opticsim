import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/entering-graded-slab-v33.json',import.meta.url)));
const original=()=>structuredClone(fixture.physical);
test('native v33 vouches for finite-angle propagation to an actual detector',async()=>{
  for(const [angle,thickness,x,y] of [[20,.2,0,0],[60,.3,0,0],[80,.4,116,-90]]){
    const p=original(),radians=angle*Math.PI/180;
    Object.assign(p.components[0].parameters,{x:x-.1*Math.tan(radians),y:y-.1});
    p.components[0].emission.directionDeg=90-angle;
    Object.assign(p.components[1].parameters,{axisY:y,leftX:x-.5,upHeight:thickness});
    Object.assign(p.components[2].parameters,{x:x+1.25,y:y+thickness+.2,orientationDeg:angle===80?180:0});
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,33);assert.deepEqual(parseSave(serializeSave(doc)),doc);
    const native=core.compile(doc).native.objs;
    assert.deepEqual(native.map(o=>o.type),['SingleRay','GrinGlass','Detector']);
    assert.equal(native[1].stepSize,.00025);
    const {summary}=evaluateDocument(doc,core,fixture.requests);
    assert.equal(summary.observations?.v33GradedSlabVerified,true);
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    const [hit]=results[0].value;
    const q=Math.sin(radians),normal=Math.cos(radians);
    const predicted=2*q*thickness/(Math.sqrt(normal*normal+thickness)+normal)+.2*q/normal;
    assert.ok(Math.abs(hit.pointMm.x-x-predicted)<.003);
    assert.ok(Math.abs(hit.incomingUnit.x-q)<.003);
  }
});
test('ambiguous placement, failed step evidence and stop withhold v33 measurements',async()=>{
  for(const edit of [
    p=>delete p.model,p=>p.components[0].emission.directionDeg=0,p=>p.components[0].parameters.y=0,
    p=>p.components[1].parameters.indexSquaredAtAxis=1.5,p=>p.components[1].parameters.downHeight=.2,
    p=>p.components[1].parameters.partialReflection=true,p=>p.components[2].parameters.y=.3,p=>p.runPolicy='preview-v1'
  ]){
    const p=original();edit(p);assert.throws(()=>prepareScene(p));
  }
  const doc=prepareScene(original()).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v33GradedSlabVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('D')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  const loaded=core.loadDocument(doc);
  const detectorPrototype=Object.getPrototypeOf(loaded.scene.objs[loaded.idMap.get('D')]);
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
  const stopped={...core,Simulator:class extends core.Simulator{
    constructor(scene,...args){super(scene,...args.slice(0,-1),100);}
  }};
  const run=evaluateDocument(doc,stopped,fixture.requests).summary;
  assert.equal(run.native.status,'stopped');assert.equal(run.observations,null);
});

test('v33 withholds a nonpassive detector even if its signed reading is correct',async()=>{
  const doc=prepareScene(original()).document;
  const loaded=core.loadDocument(doc);
  const detectorPrototype=Object.getPrototypeOf(loaded.scene.objs[loaded.idMap.get('D')]);
  const nativeDetector=detectorPrototype.onRayIncident;
  const mutations=[
    ray=>{ray.brightness_s*=.5;ray.brightness_p*=.5;},
    ray=>{ray.brightness_s*=2;ray.brightness_p*=2;},
    ray=>{ray.brightness_s+=ray.brightness_p;ray.brightness_p=0;},
    (ray,point)=>{point.x+=.01;ray.p1.x=point.x;ray.p2.x+=.01;}
  ];
  for(const mutate of mutations){
    let calls=0;
    detectorPrototype.onRayIncident=function(ray,index,point,...rest){
      const result=nativeDetector.call(this,ray,index,point,...rest);
      mutate(ray,point);
      calls++;
      return result;
    };
    try{
      const {summary}=evaluateDocument(doc,core,fixture.requests);
      assert.equal(calls,1);
      assert.equal(summary.observations,null);
      const {results}=await evaluateObservables(doc,fixture.requests,summary);
      assert.ok(results.every(result=>result.value===null));
    }finally{
      detectorPrototype.onRayIncident=nativeDetector;
    }
  }
});

test('v33 withholds powered rays that disagree with the authored SingleRay across the transparent slab',()=>{
  const doc=prepareScene(original()).document;
  const {scene}=core.loadDocument(doc);
  const hooks=[
    [scene.objs[0],'onSimulationStart',(_args,result)=>{result.newRays[0].brightness_p*=2;return true;}],
    [scene.objs[1],'onRayIncident',([ray,,point])=>{
      if(Math.abs(point.y+.3)>1e-10)return false;
      ray.brightness_s*=2;
      return true;
    }]
  ];
  for(const [object,name,mutate] of hooks){
    const prototype=Object.getPrototypeOf(object),delegate=prototype[name];
    let changed=0;
    prototype[name]=function(...args){
      const result=delegate.apply(this,args);
      if(mutate(args,result))changed++;
      return result;
    };
    try{
      assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
      assert.equal(changed,1);
    }finally{
      prototype[name]=delegate;
    }
  }
});
