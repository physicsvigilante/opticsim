// One-off, read-only native lineage feasibility test. This instrumenter is NOT
// a production API, ray tracer, source-assignment algorithm or native patch.
// It sees original PhyDemo source emissions and actual incident callbacks only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {REQUESTS} from './frozen-inputs.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/source-backed-transfer-v2');
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const unit=(ray)=>{
  if(!ray?.p1||!ray?.p2)return null;
  const dx=ray.p2.x-ray.p1.x,dy=-(ray.p2.y-ray.p1.y),n=Math.hypot(dx,dy);
  return n>0&&Number.isFinite(n)?{x:dx/n,y:dy/n}:null;
};
const short=(x)=>x===null?null:Number(x.toFixed(9));
function recordNative(doc,label){
  const {scene,idMap}=core.loadDocument(doc);
  const provenance=new WeakMap(),sources=[],hits=[];let nextToken=0,unknown=0,duplicate=0;
  for(const c of doc.physics.components.filter(c=>c.type==='point-source')){
    const native=scene.objs[idMap.get(c.id)],original=native.onSimulationStart;
    native.onSimulationStart=function(...args){
      const ret=original.apply(this,args);
      for(const ray of ret?.newRays??[]){
        if(provenance.has(ray))duplicate++;
        const meta={token:++nextToken,sourceId:c.id,parentToken:null};
        provenance.set(ray,meta);sources.push({...meta,startingDirection:unit(ray)});
      }
      return ret;
    };
  }
  for(const c of doc.physics.components.filter(c=>c.type!=='point-source')){
    const native=scene.objs[idMap.get(c.id)],original=native.onRayIncident;
    native.onRayIncident=function(...args){
      const ray=args[0],tag=provenance.get(ray);
      if(!tag)unknown++;
      const pre=unit(ray);
      const ret=original.apply(this,args); // The real engine owns the mutation.
      const post=unit(ray);
      const children=(ret?.newRays??[]).map(child=>{
        if(provenance.has(child))duplicate++;
        const entry={token:++nextToken,sourceId:tag?.sourceId??null,
          parentToken:tag?.token??null,direction:unit(child)};
        provenance.set(child,{token:entry.token,sourceId:entry.sourceId,parentToken:entry.parentToken});
        return entry;
      });
      if(hits.length<64)hits.push({componentId:c.id,type:c.type,rayIndex:args[1],
        token:tag?.token??null,sourceId:tag?.sourceId??null,
        incomingDirection:pre,primaryDirectionAfterNative:post,
        children,absorbed:ret?.isAbsorbed===true,undefinedBehavior:ret?.isUndefinedBehavior===true});
      return ret;
    };
  }
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event=null;
  for(const k of ['simulationComplete','simulationStop'])simulator.on(k,()=>{event=k;});
  simulator.updateSimulation();
  const info={label,event,emissions:sources,hits,unknown,duplicate,processed:simulator.processedRayCount,
    truncation:simulator.totalTruncation,undefinedBehavior:simulator.totalUndefinedBehavior,
    nativeWarning:simulator.warning??null,sceneError:scene.error??null,simulatorError:simulator.error??null};
  assert.equal(event,'simulationComplete',label+' must actually finish native tracing');
  assert.equal(unknown,0,'Unknown ray-object provenance; do not claim trackable lineage');
  assert.equal(duplicate,0,'Duplicate native ray object emitted/spawned; weak identity unsafe');
  assert.equal(info.truncation,0,'Incomplete Fresnel branches cannot qualify lineage');
  assert.equal(info.undefinedBehavior,0,'Native undefined event cannot qualify lineage');
  return info;
}
const close=(a,b,t=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,JSON.stringify({a,b,t}));
const findById=(doc,id)=>(doc.physics?.components??doc.components).find(c=>c.id===id);
async function main(){
  if(process.version!=='v24.19.0')throw Error('Native feasibility requires supported Node 24.19.0: '+process.version);
  mkdirSync(out,{recursive:true});
  const mirror=prepareScene(REQUESTS.C1R2.value.physical).document;
  const mirrorRun=recordNative(mirror,'finite-mirror-bounces');
  const mirrorCalls=mirrorRun.hits.filter(h=>h.type==='plane-mirror');
  assert.equal(mirrorRun.emissions.length,1);
  assert.equal(mirrorCalls.length,4,'Tested finite two-mirror configuration should show four real callbacks');
  assert.equal(new Set(mirrorCalls.map(x=>x.token)).size,1,'Same native ray object persists over four reflections');
  assert.ok(mirrorCalls.every(x=>x.sourceId==='S1'&&x.children.length===0),'No invented mirror child');
  assert.equal(new Set(mirrorCalls.map(x=>x.rayIndex)).size,1,
    'rayIndex is simulator-array position, NOT unique path-event number');
  const baselineMirror=evaluateDocument(mirror,core,[
    {id:'a',kind:'source-emissions',componentId:'S1'},
    {id:'b',kind:'mirror-reflections',componentId:'M1'},
    {id:'c',kind:'mirror-reflections',componentId:'M2'}]);
  assert.equal(baselineMirror.summary.executionPassed,true);
  assert.equal(baselineMirror.summary.native.truncation,0);
  assert.equal(baselineMirror.summary.native.processed,mirrorRun.processed);
  // An intentionally explicit synthetic two-source Fresnel test: all omitted
  // source locations/intensities are authored here, not inferred from T3.
  const fresnelInput=structuredClone(REQUESTS.C2R.value.physical);
  findById(fresnelInput,'SunRay').parameters.brightness=1;
  findById(fresnelInput,'AirWater').parameters.partialReflection=true;
  const second=structuredClone(findById(fresnelInput,'SunRay'));
  second.id='SunRay2';second.parameters.x=-150;
  fresnelInput.components.push(second);
  // A separate fully declared detector in incident air catches ACTUAL reflected
  // secondary rays after PhyDemo spawns them. No inferred path pairing.
  fresnelInput.components.push({id:'ReflectedDetector',type:'ray-detector',
    parameters:{x:200,y:200,orientationDeg:0,length:500}});
  const fresnel=prepareScene(fresnelInput).document;
  const fresnelRun=recordNative(fresnel,'two-source-fresnel-branch');
  assert.equal(fresnelRun.emissions.length,2);
  assert.deepEqual(fresnelRun.emissions.map(x=>x.sourceId),['SunRay','SunRay2']);
  const face=fresnelRun.hits.filter(h=>h.type==='planar-interface');
  const detector=fresnelRun.hits.filter(h=>h.type==='ray-detector');
  const through=detector.filter(h=>h.componentId==='LakeBottomDetector');
  const reflected=detector.filter(h=>h.componentId==='ReflectedDetector');
  assert.equal(face.length,2,'Both emitted native rays must intersect actual interface');
  assert.equal(through.length,2,'Two transmitted primaries must actually cross the lower detector');
  assert.equal(reflected.length,2,'Two spawned reflected children must actually hit the upper detector');
  assert.deepEqual(face.map(x=>x.rayIndex),[0,1],'Current-array indices are not stable source identifiers');
  assert.equal(new Set(face.map(x=>x.token)).size,2);
  assert.ok(face.every(h=>h.children.length===1),'One genuine secondary reflection per incident ray');
  const children=face.flatMap(h=>h.children.map(k=>({...k,spawnedAt:h.componentId})));
  assert.equal(new Set(children.map(c=>c.token)).size,2);
  assert.deepEqual(children.map(c=>c.sourceId),['SunRay','SunRay2'],
    'Child source identity is tracked via observed object parent, NOT rayIndex');
  assert.ok(children.every(c=>c.parentToken!==null&&c.direction&&c.direction.y>0),
    'Reflective Fresnel secondaries should head into the incident medium');
  assert.ok(face.every(h=>h.primaryDirectionAfterNative?.y<0),
    'Transmitted primary remains a distinct same-object lineage');
  assert.deepEqual(through.map(x=>x.token),face.map(x=>x.token),'Actual primary identity persists into lower detector');
  assert.deepEqual(reflected.map(x=>x.token),children.map(x=>x.token),
    'Native reflected SECONDARIES retain observed object identities at later detector events');
  assert.deepEqual(reflected.map(x=>x.sourceId),['SunRay','SunRay2'],
    'Reflection source labels are inherited from return.newRays parent references, NOT array indexes');
  assert.deepEqual(reflected.map(x=>x.rayIndex),[2,3],
    'Reflected children occupy newly appended simulator-array indices, not original source indexes');
  for(const hit of face){
    close(Math.abs(hit.incomingDirection.x),Math.SQRT1_2,1e-8);
    close(Math.abs(hit.incomingDirection.y),Math.SQRT1_2,1e-8);
    close(Math.abs(hit.primaryDirectionAfterNative.x),Math.sin(Math.asin(Math.SQRT1_2/(4/3))),1e-8);
  }
  const baselineFresnel=evaluateDocument(fresnel,core,[{id:'a',kind:'source-emissions',componentId:'SunRay'},
    {id:'b',kind:'source-emissions',componentId:'SunRay2'},
    {id:'c',kind:'interface-interactions',componentId:'AirWater'},
    {id:'d',kind:'detector-crossings',componentId:'LakeBottomDetector'},
    {id:'e',kind:'detector-crossings',componentId:'ReflectedDetector'}]);
  assert.equal(baselineFresnel.summary.executionPassed,true);
  assert.equal(baselineFresnel.summary.native.truncation,0);
  assert.equal(baselineFresnel.summary.native.processed,fresnelRun.processed,
    'Read-only wrapper must not change native segment processing');
  assert.equal(baselineFresnel.summary.observations.emissionsById.SunRay.emitted,1);
  assert.equal(baselineFresnel.summary.observations.emissionsById.SunRay2.emitted,1);
  assert.equal(baselineFresnel.summary.observations.detectorsById.LakeBottomDetector.crossings,2);
  assert.equal(baselineFresnel.summary.observations.detectorsById.ReflectedDetector.crossings,2);
  const report={format:'opticsim-test-only-native-lineage-feasibility-v1',
    checkoutSha:process.env.GITHUB_SHA??null,node:process.version,
    model:'Pinned PhyDemo; per-instance test-only wrappers with WeakMap native ray object identity',
    attempts:[mirrorRun,fresnelRun],crossChecks:{mirrorProcessed:baselineMirror.summary.native.processed,
      fresnelProcessed:baselineFresnel.summary.native.processed,
      detectorCrossings:baselineFresnel.summary.observations.detectorsById.LakeBottomDetector.crossings,
      reflectedCrossings:baselineFresnel.summary.observations.detectorsById.ReflectedDetector.crossings},
    demonstrated:['Native ray object persists across four mirror interactions in this exact scene',
      'Native onRayIncident returned newRays as distinct objects with observable direct parent identity on two Fresnel incident events',
      'Spawned reflected children were later observed at a separate upper detector with the same actual object identity',
      'Read-only wrapper preserved current pinned native counts and processed segments'],
    NOT_PROVEN:['A general public ray-history API','RayIndex as immutable source identity',
      'All surface-merging, TIR, truncated Fresnel, many-ray, grazing/corner or async paths',
      'Physically inferred image/source attribution when an incident callback is absent',
      'A complete source-faithful textbook answer']};
  writeFileSync(resolve(out,'lineage-feasibility.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('NATIVE_LINEAGE_FEASIBILITY '+JSON.stringify({nativeCompleted:true,mirrorInteractions:mirrorCalls.length,
    fresnelIncidentEvents:face.length,spawnedChildren:children.length,transmittedDetectorHits:through.length,reflectedDetectorHits:reflected.length,
    untracked:mirrorRun.unknown+fresnelRun.unknown,truncated:mirrorRun.truncation+fresnelRun.truncation,
    baselineProcessedMatches:true,node:process.version}));
}
main().catch(error=>{console.error('NATIVE_LINEAGE_FEASIBILITY_FAILURE '+(error.stack||error.message));process.exitCode=1});
