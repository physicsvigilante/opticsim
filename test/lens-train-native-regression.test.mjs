import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {analyzeLensTrainQuery,LENS_FACTS_FORMAT,LENS_QUERY_FORMAT} from '../src/lens-train-queries.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const close=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const facts=(x,lenses)=>({format:LENS_FACTS_FORMAT,model:'coaxial-ideal-thin-lenses',signConvention:'x-increasing',lengthUnit:'mm',objectX:x,objectHeight:3,lenses:lenses.map((l,i)=>({id:'L'+i,x:l[0],focalLength:l[1]}))});
function declaredScene(f){
 // Explicit synthetic illumination choices, not defaults applied to reduced facts.
 return prepareScene({lengthUnit:'mm',components:[{id:'S',type:'point-source',parameters:{x:f.objectX,y:f.objectHeight,brightness:.08},
  emission:{mode:'directional',directionDeg:0,angleDeg:8}},...f.lenses.map(l=>({id:l.id,type:'ideal-lens',parameters:{x:l.x,focalLength:l.focalLength,apertureHeight:200}}))]}).document;
}
const analytical=f=>analyzeLensTrainQuery(f,{format:LENS_QUERY_FORMAT,kind:'lens-train-image-height'});

test('separately declared native examples retain old conditional images and agree after actual tracing',async()=>{
 for(const f of [facts(-300,[[0,100]]),facts(-50,[[0,100]]),facts(-300,[[0,200],[300,100]]),facts(-100,[[0,100],[150,60]])]){
  const d=declaredScene(f),result=analytical(f),execution=evaluateDocument(d,core);
  assert.equal(execution.summary.executionPassed,true);
  const old=(await evaluateObservables(d,[{id:'legacy',kind:'ideal-image',componentId:'S'}],execution.summary)).results[0];
  assert.equal(old.status,'conditional');close(old.value.x,result.value.imageX);close(old.value.y,result.value.imageHeight);
  close(old.value.distance,result.value.imageDistance);close(old.value.magnification,result.value.magnification);
  const {scene,idMap}=core.loadDocument(d),paths=new WeakMap();let checked=0;
  for(const l of f.lenses){
   const obj=scene.objs[idMap.get(l.id)],original=obj.onRayIncident;
   obj.onRayIncident=function(...args){
    const ray=args[0],path=paths.get(ray)||[];path.push(l.id);paths.set(ray,path);
    const returned=original.apply(this,args); // Exactly one call; never alter native rays.
    if(l.id===f.lenses.at(-1).id&&path.length===f.lenses.length&&!returned?.isAbsorbed){
     assert.deepEqual(path,f.lenses.map(x=>x.id));
     const slope=-(ray.p2.y-ray.p1.y)/(ray.p2.x-ray.p1.x);
     close(-ray.p1.y+slope*(result.value.imageX-ray.p1.x),result.value.imageHeight);checked++;
    }
    return returned;
   };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,d.simulation.processedRayLimit);let end;
  sim.on('simulationComplete',()=>end='completed');sim.updateSimulation();assert.equal(end,'completed');
  const diag=core.diagnostics(scene,sim);assert.equal(diag.truncation,0);assert.equal(diag.undefinedBehavior,0);assert.deepEqual(diag.errors,[]);
  assert.ok(checked>=2,'At least two actual full-train sampled rays checked; not a continuous-coverage claim');
 }
});

test('legacy native gates still suppress incomplete and stale images despite available separate mathematics',async()=>{
 const f=facts(-300,[[0,100]]),d=declaredScene(f),requests=[{id:'image',kind:'ideal-image',componentId:'S'}];
 const baseline=evaluateDocument(d,core);
 const low=structuredClone(d);low.simulation.maxRayDepth=0;
 const incomplete=evaluateDocument(low,core);assert.equal(incomplete.summary.native.status,'incomplete');
 const suppressed=(await evaluateObservables(low,requests,incomplete.summary)).results[0];assert.equal(suppressed.status,'suppressed');assert.equal(suppressed.value,null);
 const revised=reviseScene(d,{changes:[{id:'L0',section:'parameters',key:'focalLength',value:120,unit:'mm'}]}).document;
 const stale=(await evaluateObservables(revised,requests,baseline.summary)).results[0];assert.equal(stale.status,'suppressed');
 assert.equal(analytical(f).status,'conditional');assert.equal(analytical(f).native.status,'not-run');
});

test('a native aperture miss does not change reduced-facts mathematics into a detection claim',()=>{
 const f=facts(-300,[[0,100]]),d=declaredScene(f);d.physics.components[1].parameters.apertureHeight=1;
 // The synthetic point at y=3 and narrow source cone can miss a small lens.
 const e=evaluateDocument(d,core);assert.equal(e.summary.executionPassed,true);
 const r=analytical(f);assert.equal(r.nativeImageDetected,false);assert.equal(r.native.status,'not-run');
 assert.ok(r.assumptions.some(s=>s.includes('finite-aperture illumination is not established')));
});
