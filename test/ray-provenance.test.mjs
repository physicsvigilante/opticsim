import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {provenanceScope,createRayProvenanceTracker,PROVENANCE_LIMITATION} from '../src/ray-provenance.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const request=id=>({id:'p-'+id,kind:'detector-ray-provenance',componentId:id});
const run=(doc,req=[])=>evaluateDocument(doc,core,req);
const read=async(doc,execution,req)=> (await evaluateObservables(doc,req,execution.summary)).results;
const src=(id,x,y,directionDeg,brightness=1)=>({id,type:'point-source',
 parameters:{x,y,brightness},emission:{mode:'single-ray',directionDeg}});
const glass=partialReflection=>({id:'AirWater',type:'planar-interface',
 parameters:{x:0,y:0,normalDeg:90,negativeIndex:4/3,positiveIndex:1,partialReflection}});
const detector=(id,x,y,orientationDeg,length)=>({id,type:'ray-detector',parameters:{x,y,orientationDeg,length}});
const scene=(components)=>prepareScene({lengthUnit:'mm',title:'Explicit native ancestry control',
 runPolicy:'preview-v1',components}).document;
const dual=(partialReflection=true)=>scene([
 src('S1',-100,100,-45),
 src('S2',-150,100,-45),
 glass(partialReflection),
 detector('Lower',50,-100,0,400),
 detector('Upper',200,200,0,500)
]);
const cleanMiss=()=>scene([
 src('S1',-100,100,90),
 glass(true),
 detector('Lower',50,-100,0,400)
]);
const byToken=r=>new Map(r.value.nodes.map(n=>[n.token,n]));

test('opt-in two-source Fresnel native identity is real, count-matched and isolated per detector',async()=>{
 const doc=dual(),before=serializeSave(doc),req=[request('Upper'),request('Lower')];
 const ordinary=run(doc),observed=run(doc,req),results=await read(doc,observed,req);
 assert.equal(serializeSave(doc),before);
 assert.equal(observed.summary.executionPassed,true);
 assert.equal(observed.summary.native.status,'completed');
 assert.equal(ordinary.summary.native.status,'completed');
 assert.equal(observed.summary.native.processed,ordinary.summary.native.processed);
 assert.equal(observed.summary.native.truncation,0);
 assert.equal(observed.summary.native.undefinedBehavior,0);
 for(const k of NATIVE_OBSERVATION_KEYS)
  assert.deepEqual(observed.summary.observations[k],ordinary.summary.observations[k],k);
 for(const id of ['Upper','Lower']){
  const r=results.find(x=>x.componentId===id),list=r.value.crossings,by=byToken(r);
  assert.equal(r.status,'available');
  assert.equal(r.method,'native-observed-object-parentage');
  assert.equal(list.length,ordinary.summary.observations.detectorsById[id].crossings);
  assert.equal(list.length,2);
  assert.equal(new Set(list.map(x=>by.get(x.rayToken)?.sourceId)).size,2);
  assert.equal(new Set(list.map(x=>x.rayToken)).size,2);
  assert.match(r.limitation,/Same-object optical interactions are not graph edges/);
  if(id==='Upper'){
    assert.equal(r.value.nodes.length,4);
    assert.ok(list.every(x=>by.get(x.rayToken).origin==='native-spawn'));
    assert.ok(list.every(x=>by.get(by.get(x.rayToken).parentToken).origin==='native-emission'));
    assert.ok(list.every(x=>by.get(x.rayToken).spawnComponentId==='AirWater'));
  }else{
    assert.equal(r.value.nodes.length,2);
    assert.ok(list.every(x=>by.get(x.rayToken).origin==='native-emission'));
  }
  assert.match(formatRequestedResult(r),/observed ray/);
 }
 assert.equal(observed.report.native.diagnostics.detectorRayProvenanceById.Upper.status,'complete');
 assert.equal(Object.hasOwn(ordinary.report.native.diagnostics,'detectorRayProvenanceById'),false);
 assert.deepEqual(Object.keys(ordinary.summary.observations),NATIVE_OBSERVATION_KEYS);
 assert.deepEqual(snapshotNativeObservations(ordinary.report.native.diagnostics),ordinary.summary.observations);
});

test('clean zero detector miss is distinct from missing source-registration with zero downstream calls',async()=>{
 const doc=cleanMiss(),req=[request('Lower')],ok=run(doc,req),r=(await read(doc,ok,req))[0];
 assert.equal(ok.summary.native.status,'completed');
 assert.equal(ok.summary.observations.detectorsById.Lower.crossings,0);
 assert.equal(ok.summary.observations.interfacesById.AirWater.interactions,0);
 assert.equal(r.status,'available');
 assert.deepEqual(r.value,{nodes:[],crossings:[]});
 const {scene,idMap}=core.loadDocument(doc);
 const tracker=core.createRayProvenanceTracker(doc,scene,idMap,['Lower']);
 // The original native SingleRay start is delegated. We deliberately replace
 // only the *observation method* with a no-op, leaving native rays untouched.
 const native=scene.objs[idMap.get('S1')],start=native.onSimulationStart;
 native.onSimulationStart=function(...args){return start.apply(this,args);};
 // Register this wrapper as installed, but deliberately NEVER invoke
 // tracker.sourceStart, unlike a compliant production observer.
 const sourceWrapper=native.onSimulationStart;
 tracker.register('S1',native,'onSimulationStart',sourceWrapper);
 for(const id of ['AirWater','Lower']){
  const target=scene.objs[idMap.get(id)],fn=target.onRayIncident;
  target.onRayIncident=function(...args){const returned=fn.apply(this,args);
   if(id==='AirWater')tracker.interfaceIncident(id,args[0],returned);
   else tracker.detectorIncident(id,args[0],true);
   return returned;};
  tracker.register(id,target,'onRayIncident',target.onRayIncident);
 }
 assert.equal(tracker.assertInstalled(),true);
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event=null;for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>event=e);
 sim.updateSimulation();
 assert.equal(event,'simulationComplete');
 assert.equal(sim.processedRayCount,1);
 const result=tracker.project({event,errors:[],warnings:[],truncation:sim.totalTruncation,
  undefinedBehavior:sim.totalUndefinedBehavior,emissionsById:{S1:{emitted:1}},
  detectorsById:{Lower:{crossings:0,signedPower:0}}});
 assert.equal(result.Lower.status,'unavailable');
 assert.equal(result.Lower.reasonCode,'PROVENANCE_UNKNOWN_OR_INCONSISTENT');
 assert.equal(result.Lower.value,null);
});

test('missing selected and nonselected detector observer records are refused despite actual native hits',()=>{
 for(const missing of ['Upper','Lower']){
  const doc=dual();
  const {scene,idMap}=core.loadDocument(doc);
  const tracker=core.createRayProvenanceTracker(doc,scene,idMap,['Upper','Lower']);
  const sources=core.observeSourceSet(doc,scene,idMap,{provenance:tracker});
  const detectors=core.observeDetectorSet(doc,scene,idMap,{provenance:tracker});
  const interfaces=core.observeInterfaceSet(doc,scene,idMap,{provenance:tracker});
  assert.equal(tracker.assertInstalled(),true);
  const originalIncident=tracker.detectorIncident;
  tracker.detectorIncident=(id,ray,valid)=>{
    if(id!==missing)originalIncident(id,ray,valid);
  };
  const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let nativeEvent=null;
  for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>nativeEvent=name);
  sim.updateSimulation();
  assert.equal(nativeEvent,'simulationComplete');
  assert.equal(sources.emitted,2);
  assert.equal(interfaces.byId.AirWater.interactions,2);
  assert.equal(detectors.byId[missing].crossings,2);
  const projection=tracker.project({event:nativeEvent,errors:[],warnings:[],
   truncation:sim.totalTruncation,undefinedBehavior:sim.totalUndefinedBehavior,
   emissionsById:sources.byId,detectorsById:detectors.byId});
  for(const id of ['Upper','Lower']){
   assert.equal(projection[id].status,'unavailable',id);
   assert.equal(projection[id].reasonCode,'PROVENANCE_UNKNOWN_OR_INCONSISTENT');
   assert.equal(projection[id].value,null);
  }
 }
});

test('single native approximation is qualified, while unsupported scopes are unavailable',async()=>{
 const doc=dual(false),req=[request('Lower'),request('Upper')],r=run(doc,req),out=await read(doc,r,req);
 assert.equal(r.summary.native.status,'completed');
 assert.equal(out[0].status,'qualified');
 assert.equal(out[0].value.crossings.length,2);
 assert.equal(out[1].status,'qualified');
 assert.deepEqual(out[1].value,{nodes:[],crossings:[]});
 assert.match(out[0].warnings.join(' '),/transmitted-only approximation/);
 const other=structuredClone(doc);
 other.physics.components.push({id:'Extra',type:'planar-interface',
   parameters:{x:0,y:50,normalDeg:90,negativeIndex:1,positiveIndex:1.25,partialReflection:false}});
 const invalid=run(other,req);
 assert.equal(invalid.summary.accepted,true); // Still a valid v5 medium stack.
 const unknown=(await read(other,invalid,req))[0];
 assert.equal(unknown.status,'unavailable');
 assert.equal(unknown.reasonCode,'UNSUPPORTED_PROVENANCE_SCOPE');
 assert.equal(invalid.summary.observations?.detectorRayProvenanceById??null,null);
});

test('truncation, stop, stale hash and native warnings never yield accepted graphs',async()=>{
 const req=[request('Upper')],weak=dual();weak.physics.components.find(c=>c.id==='S1').parameters.brightness=.01;
 weak.physics.components.find(c=>c.id==='S2').parameters.brightness=.01;
 const truncated=run(weak,req);
 assert.equal(truncated.summary.native.status,'incomplete');
 assert.ok(truncated.summary.native.truncation>0);
 assert.equal(truncated.summary.observations,null);
 assert.equal(Object.hasOwn(truncated.report.native.diagnostics||{},'detectorRayProvenanceById'),false);
 const denied=(await read(weak,truncated,req))[0];
 assert.equal(denied.status,'suppressed');
 assert.equal(denied.reasonCode,'NATIVE_PROVENANCE_INCOMPLETE');
 const limited=dual();limited.simulation.processedRayLimit=1;
 const stopped=run(limited,req);
 assert.equal(stopped.summary.native.status,'stopped');
 assert.equal(Object.hasOwn(stopped.report.native.diagnostics||{},'detectorRayProvenanceById'),false);
 assert.equal((await read(limited,stopped,req))[0].status,'suppressed');
 const doc=dual(),ok=run(doc,req);
 const changed=structuredClone(doc);changed.physics.components[0].parameters.x-=1;
 const stale=(await read(changed,ok,req))[0];
 assert.equal(stale.status,'suppressed');
 assert.equal(stale.reasonCode,'STALE_PROVENANCE_EXECUTION');
 const warned=structuredClone(ok);
 warned.summary.native.status='completed-with-warnings';
 warned.summary.native.warnings=['INJECTED_NATIVE_WARNING'];
 const no=(await read(doc,warned,req))[0];
 assert.equal(no.status,'unavailable');
 assert.equal(no.reasonCode,'NATIVE_PROVENANCE_UNQUALIFIED');
});

test('injected duplicate child, parent-equal-child and caps withhold complete graph without simulating fake paths',()=>{
 const doc=cleanMiss(),input=doc.physics.components;
 const objects=input.map(c=>c.type==='point-source'?{onSimulationStart(){}}:{onRayIncident(){}});
 const scene={objs:objects},idMap=new Map(input.map((c,i)=>[c.id,i]));
 const runFault=fault=>{
  const t=createRayProvenanceTracker(doc,scene,idMap,['Lower']);
  for(let i=0;i<input.length;i++){
   const c=input[i],obj=objects[i],method=c.type==='point-source'?'onSimulationStart':'onRayIncident';
   t.register(c.id,obj,method,obj[method]);
  }
  assert.equal(t.assertInstalled(),true);
  const ray=n=>({p1:{x:n,y:0},p2:{x:n+1,y:1}});
  const root=ray(0);
  t.sourceStart('S1',{newRays:[root]});
  if(fault==='reused')t.interfaceIncident('AirWater',root,{newRays:[root]});
  if(fault==='duplicate'){
   const child=ray(2);
   t.interfaceIncident('AirWater',root,{newRays:[child,child]});
  }
  if(fault==='identity-overflow'){
   let parent=root;
   for(let i=0;i<65;i++){
    const child=ray(i+4);
    t.interfaceIncident('AirWater',parent,{newRays:[child]});
    parent=child;
   }
  }
  if(fault==='hit-overflow')for(let i=0;i<33;i++)t.detectorIncident('Lower',root,true);
  const seen=fault==='hit-overflow'?33:0;
  return t.project({event:'simulationComplete',errors:[],warnings:[],truncation:0,undefinedBehavior:0,
   emissionsById:{S1:{emitted:1}},detectorsById:{Lower:{crossings:seen}}}).Lower;
 };
 for(const fault of ['reused','duplicate','identity-overflow','hit-overflow']){
  const r=runFault(fault);
  assert.equal(r.status,'unavailable');
  assert.equal(r.value,null);
  assert.equal(r.reasonCode,fault.includes('overflow')?'PROVENANCE_LIMIT_EXCEEDED':'PROVENANCE_UNKNOWN_OR_INCONSISTENT');
 }
});


test('native high-to-low Snell and TIR keep distinct spawned-child versus same-object semantics',async()=>{
 const expectedCritical=Math.asin(1/1.5)*180/Math.PI;
 assert.ok(Math.abs(expectedCritical-41.8103148957786)<1e-11);
 const testDoc=incidence=>scene([
  src('S1',100,0,180-incidence),
  {id:'Surface',type:'planar-interface',parameters:{x:0,y:0,normalDeg:0,
    negativeIndex:1,positiveIndex:1.5,partialReflection:true}},
  detector('Left',-150,100,90,600),
  detector('Right',150,100,90,600)
 ]);
 for(const [angle,tir] of [[30,false],[50,true]]){
  const doc=testDoc(angle),req=[request('Left'),request('Right')];
  const before=run(doc),current=run(doc,req),res=await read(doc,current,req);
  assert.equal(current.summary.native.status,'completed');
  assert.equal(current.summary.native.truncation,0);
  assert.equal(current.summary.native.processed,before.summary.native.processed);
  assert.deepEqual(current.summary.observations.detectorsById,before.summary.observations.detectorsById);
  const interfaceEvent=current.summary.observations.interfacesById.Surface.first;
  assert.ok(Math.abs(interfaceEvent.incidentAngleDeg-angle)<1e-8);
  const left=res.find(r=>r.componentId==='Left'),right=res.find(r=>r.componentId==='Right');
  assert.equal(left.status,'available');assert.equal(right.status,'available');
  assert.equal(right.value.crossings.length,1);
  const rightNode=byToken(right).get(right.value.crossings[0].rayToken);
  if(tir){
   assert.equal(interfaceEvent.outcome,'total-internal-reflection');
   assert.equal(interfaceEvent.transmittedAngleDeg,null);
   assert.equal(rightNode.origin,'native-emission',
    'Native total internal reflection mutates the actual primary object in place');
   assert.deepEqual(left.value,{nodes:[],crossings:[]});
  }else{
   const snell=Math.asin(1.5*Math.sin(Math.PI*angle/180))*180/Math.PI;
   assert.ok(Math.abs(snell-48.5903778907291)<1e-11);
   assert.ok(Math.abs(interfaceEvent.transmittedAngleDeg-snell)<1e-7);
   assert.equal(rightNode.origin,'native-spawn');
   assert.equal(rightNode.spawnComponentId,'Surface');
   assert.equal(left.value.crossings.length,1);
   assert.equal(byToken(left).get(left.value.crossings[0].rayToken).origin,'native-emission');
  }
 }
});


test('native hit positions and observed source parentage remain two separate opt-in measurements',async()=>{
 const doc=dual(),requests=[request('Upper'),
  {id:'positions',kind:'detector-hit-events',componentId:'Upper'},
  {id:'crossings',kind:'detector-crossings',componentId:'Upper'}];
 const combined=run(doc,requests),legacy=run(doc,requests.slice(1));
 const [ancestry,positions,crossings]=await read(doc,combined,requests);
 assert.equal(ancestry.status,'available');
 assert.equal(ancestry.value.crossings.length,2);
 assert.equal(positions.status,'available');
 assert.equal(positions.value.length,2);
 assert.equal(crossings.value,2);
 assert.deepEqual(combined.summary.observations.detectorHitEventsById,
  legacy.summary.observations.detectorHitEventsById);
 assert.deepEqual(combined.summary.observations.detectorsById,legacy.summary.observations.detectorsById);
 assert.ok(positions.value.every(p=>!('rayToken'in p)&&!('sourceId'in p)),
  'No synthetic pairing from array position or rayIndex');
});

test('A-01 actual native detector keeps tracing after an installed provenance handler is removed',()=>{
 const doc=dual(),baseline=run(doc);
 const {scene,idMap}=core.loadDocument(doc);
 const upper=scene.objs[idMap.get('Upper')],originalNativeIncident=upper.onRayIncident;
 const t=core.createRayProvenanceTracker(doc,scene,idMap,['Lower']);
 const source=core.observeSourceSet(doc,scene,idMap,{provenance:t});
 const detectors=core.observeDetectorSet(doc,scene,idMap,{provenance:t});
 core.observeInterfaceSet(doc,scene,idMap,{provenance:t});
 assert.equal(t.assertInstalled(),true);
 // Fault injection: native PhyDemo receives the reflected crossings, but the
 // installed upper detector observation handler is silently bypassed.
 upper.onRayIncident=originalNativeIncident;
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event=null;for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>event=e);
 sim.updateSimulation();
 assert.equal(event,'simulationComplete');
 assert.equal(sim.processedRayCount,baseline.summary.native.processed);
 assert.equal(baseline.summary.observations.detectorsById.Upper.crossings,2);
 assert.equal(detectors.byId.Upper.crossings,0,
  'The meter itself cannot know native callbacks happened after its handler was removed');
 assert.equal(Number.isFinite(upper.power),true);
 const projected=t.project({event,errors:[],warnings:[],
  truncation:sim.totalTruncation,undefinedBehavior:sim.totalUndefinedBehavior,
  emissionsById:source.byId,detectorsById:detectors.byId});
 assert.equal(projected.Lower.status,'unavailable',
  'Even a separately selected detector must withhold on an uninstalled native observer');
 assert.equal(projected.Lower.reasonCode,'PROVENANCE_UNKNOWN_OR_INCONSISTENT');
 assert.equal(projected.Lower.value,null);
});

test('injected per-detector overflow is isolated while global identity remains complete',()=>{
 const doc=dual(),{scene,idMap}=core.loadDocument(doc);
 const t=createRayProvenanceTracker(doc,scene,idMap,['Upper','Lower']);
 for(const c of doc.physics.components){
  const obj=scene.objs[idMap.get(c.id)],method=c.type==='point-source'?'onSimulationStart':'onRayIncident';
  t.register(c.id,obj,method,obj[method]);
 }
 assert.equal(t.assertInstalled(),true);
 const ray=i=>({p1:{x:i,y:0},p2:{x:i+1,y:1}});
 const a=ray(0),b=ray(2);
 t.sourceStart('S1',{newRays:[a]});t.sourceStart('S2',{newRays:[b]});
 for(let i=0;i<33;i++)t.detectorIncident('Upper',a,true);
 t.detectorIncident('Lower',b,true);
 const data=t.project({event:'simulationComplete',errors:[],warnings:[],truncation:0,undefinedBehavior:0,
  emissionsById:{S1:{emitted:1},S2:{emitted:1}},
  detectorsById:{Upper:{crossings:33},Lower:{crossings:1}}});
 assert.equal(data.Upper.status,'unavailable');
 assert.equal(data.Upper.reasonCode,'PROVENANCE_LIMIT_EXCEEDED');
 assert.equal(data.Upper.value,null);
 assert.equal(data.Lower.status,'complete');
 assert.equal(data.Lower.value.crossings.length,1);
 assert.equal(data.Lower.value.nodes.length,1);
 assert.equal(data.Lower.value.nodes[0].sourceId,'S2');
});
