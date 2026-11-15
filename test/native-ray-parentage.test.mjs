import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {createNativeRayParentage,supportsNativeRayParentage,
  NATIVE_PARENTAGE_LIMIT,NATIVE_PARENTAGE_DETECTOR_LIMIT} from '../src/native-ray-parentage.js';
import {formatRequestedResult} from '../src/result-preview.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const c=(id,type,parameters,emission)=>({id,type,parameters,...(emission?{emission}:{})});
const source=(id,x,y,directionDeg,brightness=1)=>c(id,'point-source',{x,y,brightness},
  {mode:'single-ray',directionDeg});
const face=(partialReflection=true)=>c('AirWater','planar-interface',{
  x:0,y:0,normalDeg:90,negativeIndex:4/3,positiveIndex:1,partialReflection});
const detector=(id,x,y,length=400)=>c(id,'ray-detector',{x,y,orientationDeg:0,length});
const document=(components)=>prepareScene({lengthUnit:'mm',
  title:'Test-only verified actual source-ray parentage',runPolicy:'preview-v1',components}).document;
const fresnel=({two=true,partialReflection=true,brightness=1}={})=>document([
  source('SunRay',-100,100,-45,brightness),
  ...(two?[source('SunRay2',-150,100,-45,brightness)]:[]),
  face(partialReflection),
  detector('LakeBottomDetector',50,-100,400),
  detector('ReflectedDetector',200,200,500)
]);
const requests=(...ids)=>ids.map((componentId,i)=>({id:'p'+i,kind:'detector-ray-provenance',componentId}));
const run=(doc,ids)=>evaluateDocument(doc,core,requests(...ids));
const value=(report,id)=>report.summary.observations?.detectorRayProvenanceById?.[id];
const results=(doc,report,ids)=>evaluateObservables(doc,requests(...ids),report.summary);
const ordinary=(doc)=>evaluateDocument(doc,core);
const matches=(left,right)=>{
  assert.equal(left.summary.native.status,right.summary.native.status);
  assert.equal(left.summary.native.processed,right.summary.native.processed);
  assert.equal(left.summary.native.truncation,right.summary.native.truncation);
  assert.equal(left.summary.native.undefinedBehavior,right.summary.native.undefinedBehavior);
  for(const key of NATIVE_OBSERVATION_KEYS)
    assert.deepEqual(left.summary.observations?.[key],right.summary.observations?.[key],key);
};

test('actual two-source Fresnel native parentage is direct, per-run, opt-in and detector-specific',async()=>{
  const doc=fresnel(),before=serializeSave(doc),base=ordinary(doc);
  const report=run(doc,['LakeBottomDetector','ReflectedDetector']);
  assert.equal(report.summary.executionPassed,true);
  assert.equal(report.summary.native.status,'completed');
  matches(base,report);assert.equal(serializeSave(doc),before);
  assert.deepEqual(Object.keys(base.summary.observations),NATIVE_OBSERVATION_KEYS);
  const a=value(report,'LakeBottomDetector'),b=value(report,'ReflectedDetector');
  assert.equal(a.status,'complete');assert.equal(b.status,'complete');
  assert.equal(a.value.crossings.length,2);assert.equal(b.value.crossings.length,2);
  assert.equal(a.value.nodes.length,2);
  assert.equal(b.value.nodes.length,4);
  assert.deepEqual(b.value.nodes.filter(n=>n.parentToken!==null).map(n=>n.spawnComponentId),
    ['AirWater','AirWater']);
  assert.deepEqual(b.value.nodes.filter(n=>n.parentToken!==null).map(n=>n.sourceId),
    ['SunRay','SunRay2']);
  assert.deepEqual(a.value.nodes.map(n=>n.sourceId),['SunRay','SunRay2']);
  assert.ok(a.value.nodes.every(n=>n.origin==='native-emission'&&n.parentToken===null));
  const roots=new Map(b.value.nodes.filter(n=>n.parentToken===null).map(n=>[n.token,n.sourceId]));
  for(const child of b.value.nodes.filter(n=>n.parentToken!==null))
    assert.equal(child.sourceId,roots.get(child.parentToken));
  assert.deepEqual(new Set(a.value.crossings.map(e=>e.rayToken)),
    new Set(a.value.nodes.map(n=>n.token)));
  const requested=await results(doc,report,['ReflectedDetector']);
  assert.equal(requested.results[0].status,'available');
  assert.equal(requested.results[0].method,'native-observed-object-parentage');
  assert.match(requested.results[0].limitation,/no complete path/);
  assert.match(formatRequestedResult(requested.results[0]),/Direct observed spawn relationships/);
  const re=run(doc,['ReflectedDetector']);
  assert.deepEqual(re.summary.observations.detectorsById,base.summary.observations.detectorsById);
  assert.equal(snapshotNativeObservations(base.report.native.diagnostics).detectorRayProvenanceById,undefined);
  assert.ok(!JSON.stringify(base.report.native.diagnostics).includes('detectorRayProvenanceById'));
});

test('actual native transmitted-only approximation has no invented reflected child and is qualified',async()=>{
  const doc=fresnel({two:false,partialReflection:false});
  const report=run(doc,['LakeBottomDetector','ReflectedDetector']);
  assert.equal(report.summary.native.status,'completed');
  assert.equal(value(report,'ReflectedDetector').status,'complete');
  assert.deepEqual(value(report,'ReflectedDetector').value,{nodes:[],crossings:[]});
  const root=value(report,'LakeBottomDetector');
  assert.equal(root.value.nodes.length,1);
  assert.equal(root.value.nodes[0].origin,'native-emission');
  const evaluated=await results(doc,report,['LakeBottomDetector','ReflectedDetector']);
  assert.ok(evaluated.results.every(r=>r.status==='qualified'));
  assert.ok(evaluated.results.every(r=>r.warnings.some(x=>x.includes('transmitted-only'))));
});

test('actual zero-hit ray with complete source start is available empty, not physical darkness',async()=>{
  const doc=document([
    source('Away',-100,100,135),face(false),detector('D',200,-100,200)
  ]);
  assert.equal(supportsNativeRayParentage(doc),true);
  const report=run(doc,['D']),byId=value(report,'D');
  assert.equal(report.summary.native.status,'completed');
  assert.equal(report.summary.observations.emissionsById.Away.emitted,1);
  assert.equal(report.summary.observations.detectorsById.D.crossings,0);
  assert.deepEqual(byId.value,{nodes:[],crossings:[]});
  const reading=(await results(doc,report,['D'])).results[0];
  assert.equal(reading.status,'qualified');
  assert.match(reading.limitation,/continuous illumination/);
});

test('unsupported physical scene returns explicit unavailable, never removes another object',async()=>{
  const doc=fresnel();
  const second={...structuredClone(doc.physics.components.find(c=>c.id==='AirWater')),
    id:'Second',parameters:{...doc.physics.components.find(c=>c.id==='AirWater').parameters,
      y:-200,negativeIndex:1.5,positiveIndex:4/3,partialReflection:false}};
  doc.physics.components.find(c=>c.id==='AirWater').parameters.partialReflection=false;
  doc.physics.components.push(second);
  // This is a legitimate two-interface ordered medium but OUTSIDE the new parentage scope.
  const report=run(doc,['LakeBottomDetector']);
  assert.equal(supportsNativeRayParentage(doc),false);
  assert.ok(!('detectorRayProvenanceById' in report.report.native.diagnostics)||
    report.report.native.diagnostics.detectorRayProvenanceById===undefined);
  const r=(await results(doc,report,['LakeBottomDetector'])).results[0];
  assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,'UNSUPPORTED_PROVENANCE_SCOPE');
});

test('actual weak Fresnel truncation suppresses parentage and never leaks raw nodes',async()=>{
  const doc=fresnel({two:false,brightness:.01}),report=run(doc,['ReflectedDetector']);
  assert.equal(report.summary.native.status,'incomplete');
  assert.ok(report.summary.native.truncation>0);
  assert.equal(report.summary.observations,null);
  assert.equal(report.report.native.diagnostics.detectorRayProvenanceById,null);
  const r=(await results(doc,report,['ReflectedDetector'])).results[0];
  assert.equal(r.status,'suppressed');assert.equal(r.value,null);
  assert.equal(r.reasonCode,'NATIVE_PROVENANCE_INCOMPLETE');
  assert.ok(!JSON.stringify(report.report.native.diagnostics).includes('"nodes"'));
});
test('actual native processed-ray stop suppresses both requested parentage and raw map',async()=>{
  const doc=fresnel();doc.simulation.processedRayLimit=1;
  const report=run(doc,['ReflectedDetector']);
  assert.equal(report.summary.native.status,'stopped');
  assert.equal(report.report.native.diagnostics.detectorRayProvenanceById,null);
  const suppressed=(await results(doc,report,['ReflectedDetector'])).results[0];
  assert.equal(suppressed.status,'suppressed');
  assert.equal(suppressed.reasonCode,'NATIVE_PROVENANCE_INCOMPLETE');
});
test('qualified hash revision prevents stale detector parentage promotion',async()=>{
  const doc=fresnel(),report=run(doc,['ReflectedDetector']);
  const revised=structuredClone(doc);revised.physics.components.find(c=>c.id==='SunRay').parameters.x=-101;
  const old=(await results(revised,report,['ReflectedDetector'])).results[0];
  assert.equal(old.status,'suppressed');assert.equal(old.value,null);
  assert.equal(old.reasonCode,'STALE_PROVENANCE_EXECUTION');
  const fresh=run(revised,['ReflectedDetector']);
  assert.equal((await results(revised,fresh,['ReflectedDetector'])).results[0].status,'available');
});

function observedRun(doc,{skipSource=false,skipDetector=false,skipInterface=false}={}){
  const {scene,idMap}=core.loadDocument(doc),ids=['D'];
  const ledger=createNativeRayParentage(doc,scene,idMap,ids);
  if(skipSource)ledger.sourceStarted=()=>{};
  if(skipDetector)ledger.detector=()=>{};
  if(skipInterface)ledger.incident=()=>{};
  const sourceSet=core.observeSourceSet(doc,scene,idMap,{parentage:ledger});
  const detectorSet=core.observeDetectorSet(doc,scene,idMap,{parentage:ledger});
  const interfaceSet=core.observeInterfaceSet(doc,scene,idMap,{parentage:ledger});
  const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let data,event;
  for(const e of ['simulationComplete','simulationStop'])
    sim.on(e,()=>{event=e;data=core.diagnostics(scene,sim,sourceSet,null,detectorSet,interfaceSet,null,
      {nativeEvent:e,parentage:ledger});});
  sim.updateSimulation();
  return {event,data,sim,ledger,scene,idMap};
}
test('F-01 actual zero-downstream native miss with silently unrecorded source is never accepted',()=>{
  const doc=document([source('S',-100,100,135),face(false),detector('D',200,-100,200)]);
  const good=observedRun(doc),missing=observedRun(doc,{skipSource:true});
  assert.equal(good.event,'simulationComplete');assert.equal(missing.event,'simulationComplete');
  assert.equal(good.data.detectorsById.D.crossings,0);
  assert.equal(good.data.detectorRayProvenanceById.D.status,'complete');
  assert.deepEqual(good.data.detectorRayProvenanceById.D.value,{nodes:[],crossings:[]});
  assert.deepEqual(missing.data.detectorRayProvenanceById.D,
    {status:'unavailable',reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',value:null});
  assert.equal(good.data.processed,missing.data.processed);
});
test('A-01 actually detected crossing with silently nonrecording detector observer must refuse',()=>{
  const doc=document([source('S',-100,100,-45),face(false),detector('D',0,-100,400)]);
  const good=observedRun(doc),missing=observedRun(doc,{skipDetector:true});
  assert.equal(good.event,'simulationComplete');assert.equal(missing.event,'simulationComplete');
  assert.ok(good.data.detectorsById.D.crossings>0);
  assert.deepEqual(good.data.detectorsById,missing.data.detectorsById);
  assert.equal(good.data.detectorRayProvenanceById.D.status,'complete');
  assert.equal(missing.data.detectorRayProvenanceById.D.status,'unavailable');
  assert.equal(missing.data.detectorRayProvenanceById.D.value,null);
});
test('F-02 missing interface incident accounting is refused even if detector sees primary',()=>{
  const doc=document([source('S',-100,100,-45),face(false),detector('D',0,-100,400)]);
  const missing=observedRun(doc,{skipInterface:true});
  assert.equal(missing.event,'simulationComplete');
  assert.equal(missing.data.detectorRayProvenanceById.D.status,'unavailable');
  assert.equal(missing.data.detectorRayProvenanceById.D.reasonCode,'PROVENANCE_UNKNOWN_OR_INCONSISTENT');
});

function fakeLedger(components){
  const doc={schemaVersion:5,physics:{model:'planar-media-tracing',components}};
  const scene={objs:components.map(()=>({onSimulationStart(){},onRayIncident(){}}))};
  const idMap=new Map(components.map((c,i)=>[c.id,i]));
  const ledger=createNativeRayParentage(doc,scene,idMap,['D']);
  for(const c of components){
    const obj=scene.objs[idMap.get(c.id)],method=c.type==='point-source'?'onSimulationStart':'onRayIncident';
    ledger.register(c.id,c.type,obj,obj[method],method);
  }
  return {ledger,scene};
}
test('direct-child duplicates, self-links and missing native source starts fail closed',()=>{
  const components=[source('S',0,10,-45),face(),detector('D',200,100,400)];
  for(const kind of ['duplicate','self','missing-start']){
    const {ledger,scene}=fakeLedger(components);
    const ray={p1:{x:0,y:0},p2:{x:10,y:0}},child={p1:{x:0,y:0},p2:{x:1,y:0}};
    if(kind!=='missing-start')ledger.sourceStarted('S',{newRays:[ray]});
    if(kind==='duplicate')ledger.incident('AirWater',ray,{newRays:[child,child]});
    if(kind==='self')ledger.incident('AirWater',ray,{newRays:[ray]});
    const result=ledger.finish({event:'simulationComplete',simulator:{totalTruncation:0,totalUndefinedBehavior:0},
      errors:[],warnings:[],sources:{byId:{S:{emitted:1}}},
      detectors:{byId:{D:{crossings:0,signedPower:0}}},
      interfaces:{byId:{AirWater:{interactions:kind==='missing-start'?0:1}}}});
    assert.equal(result.D.status,'unavailable',kind);
    assert.equal(result.D.value,null);
  }
});
test('64/65 identities and 32/33 crossings are defensive injected callback guards, not ordinary scene coverage',()=>{
  assert.equal(NATIVE_PARENTAGE_LIMIT,64);assert.equal(NATIVE_PARENTAGE_DETECTOR_LIMIT,32);
  const components=[source('S',0,10,-45),face(),detector('D',200,100,400)];
  const sim={totalTruncation:0,totalUndefinedBehavior:0};
  for(const [identityOverflow,hitOverflow] of [[true,false],[false,true]]){
    const {ledger}=fakeLedger(components),ray={p1:{x:0,y:0},p2:{x:1,y:0}};
    ledger.sourceStarted('S',{newRays:[ray]});
    let latest=ray;
    if(identityOverflow)for(let i=0;i<64;i++){
      const child={p1:{x:i,y:0},p2:{x:i+1,y:0}};
      ledger.incident('AirWater',latest,{newRays:[child]});latest=child;
    }
    if(hitOverflow)for(let i=0;i<33;i++)ledger.detector('D',ray);
    const result=ledger.finish({event:'simulationComplete',simulator:sim,errors:[],warnings:[],
      sources:{byId:{S:{emitted:1}}},
      detectors:{byId:{D:{crossings:hitOverflow?33:0,signedPower:0}}},
      interfaces:{byId:{AirWater:{interactions:identityOverflow?64:0}}}});
    assert.equal(result.D.status,'unavailable');
    assert.equal(result.D.value,null);
  }
});
test('capabilities and no-request snapshots preserve all prior keys',()=>{
  const c=observableCapabilities();
  assert.ok(c.kinds['detector-ray-provenance']);
  const snap=snapshotNativeObservations({},[]);
  assert.deepEqual(Object.keys(snap),NATIVE_OBSERVATION_KEYS);
  assert.equal(snap.detectorRayProvenanceById,undefined);
});

test('A-01 nonselected detector losing actual callback identity makes selected graph unavailable',()=>{
  const doc=document([
    source('S',-100,100,-45),face(false),detector('D',0,-100,400),
    detector('Other',0,-200,400)
  ]);
  const {scene,idMap}=core.loadDocument(doc);
  const ledger=createNativeRayParentage(doc,scene,idMap,['D']);
  const real=ledger.detector.bind(ledger);
  ledger.detector=(id,ray)=>{if(id!=='Other')real(id,ray);};
  const src=core.observeSourceSet(doc,scene,idMap,{parentage:ledger});
  const det=core.observeDetectorSet(doc,scene,idMap,{parentage:ledger});
  const glass=core.observeInterfaceSet(doc,scene,idMap,{parentage:ledger});
  const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let diagnostics;
  sim.on('simulationComplete',()=>{diagnostics=core.diagnostics(scene,sim,src,null,det,glass,null,
    {nativeEvent:'simulationComplete',parentage:ledger});});
  sim.updateSimulation();
  assert.ok(diagnostics,'Actual pinned PhyDemo must complete');
  assert.ok(diagnostics.detectorsById.D.crossings>0);
  assert.ok(diagnostics.detectorsById.Other.crossings>0);
  assert.deepEqual(diagnostics.detectorRayProvenanceById.D,
    {status:'unavailable',reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',value:null});
  assert.equal(sim.totalTruncation,0);
});

test('run revision A→B→A never adopts delayed earlier A provenance despite equal scene hashes',()=>{
  const docA=fresnel(),docB=fresnel();
  docB.physics.components.find(c=>c.id==='SunRay').parameters.x-=10;
  const callbacks=[];
  const session=new core.Session(()=>({cancel(){},run(notify){callbacks.push(notify);}}),
    ()=>{},()=>({kind:'unavailable'}));
  assert.equal(session.apply(docA),true);
  assert.equal(session.apply(docB),true);
  assert.equal(session.apply(docA),true);
  const fake=(token)=>({errors:[],warnings:[],truncation:0,undefinedBehavior:0,
    detectorRayProvenanceById:{ReflectedDetector:{status:'complete',
      value:{nodes:[{token,sourceId:'SunRay',origin:'native-emission',parentToken:null,
        spawnComponentId:null}],crossings:[{rayToken:token}]}}}});
  callbacks[0]('simulationComplete',fake('old-A'));
  assert.equal(session.state,'running');assert.equal(session.data,null);
  callbacks[1]('simulationComplete',fake('B'));
  assert.equal(session.state,'running');assert.equal(session.data,null);
  callbacks[2]('simulationComplete',fake('fresh-A'));
  assert.equal(session.state,'completed');
  assert.equal(session.data.detectorRayProvenanceById.ReflectedDetector.value.crossings[0].rayToken,'fresh-A');
  assert.equal(session.revision,3);
});

test('native total-internal reflection keeps one root object and creates no fictitious Fresnel child',async()=>{
  const high=4/3,low=1,critical=Math.asin(low/high)*180/Math.PI;
  const incidence=critical+5;
  const doc=document([
    source('FromWater',-100,-100,90-incidence),
    face(true),
    detector('WaterDetector',0,-200,800),
    detector('AirDetector',0,200,800)
  ]);
  const out=run(doc,['WaterDetector','AirDetector']);
  assert.equal(out.summary.native.status,'completed');
  assert.equal(out.summary.native.truncation,0);
  assert.ok(out.summary.observations.interfacesById.AirWater.totalInternalReflections>=1);
  assert.equal(out.summary.observations.interfacesById.AirWater.first.outcome,'total-internal-reflection');
  const lower=value(out,'WaterDetector'),upper=value(out,'AirDetector');
  assert.equal(lower.status,'complete');assert.equal(upper.status,'complete');
  assert.equal(lower.value.crossings.length,1);
  assert.equal(upper.value.crossings.length,0);
  assert.equal(lower.value.nodes.length,1);
  assert.equal(lower.value.nodes[0].origin,'native-emission');
  assert.equal(lower.value.nodes[0].parentToken,null);
  assert.equal(lower.value.nodes[0].sourceId,'FromWater');
  assert.deepEqual(upper.value,{nodes:[],crossings:[]});
  // This is an independent scalar reference to TIR, not a claim about the
  // numerical accuracy of every native exact-critical ray trajectory.
  assert.ok(incidence>critical&&critical>45&&critical<50);
});
