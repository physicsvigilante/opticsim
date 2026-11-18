// TEST-ONLY B1b numerical stress -- preregistered #139 BEFORE first new native CI.
// Contains the exact previously reviewed #135 test-only apparatus/measurement
// logic (source blob 1a57c562bdf8eb00ebbc5e21569cc2cd179f9876) as a fixture, PLUS independently audited
// local-coordinate/sensitivity stress below. No new product behavior.
// No imported production capability, native solver modification, virtual ray
// tracing, pupil/eye model, physical-image reconstruction or authoring expansion.
// The independent native runs differ only in explicitly authored ray direction.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {validate,serializeSave,UPSTREAM} from '../src/contract.js';
import {interfaceNormal,signedSide} from '../src/planar-media.js';
import {canonicalJSON} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const RAD=Math.PI/180;
const REQUESTS=[
  {id:'hits',kind:'detector-hit-events',componentId:'D1'},
  {id:'crossings',kind:'detector-crossings',componentId:'D1'},
  {id:'interface',kind:'interface-first-event',componentId:'I1'}
];
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const scale=(v,s)=>({x:v.x*s,y:v.y*s});
const rotate=(v,a)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
const comp=(doc,type)=>doc.physics.components.find(c=>c.type===type);
const wrap=a=>a>180?a-360:a< -180?a+360:a;
const close=(a,b,eps=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
  Math.abs(a-b)<eps,String(a)+' differs from '+String(b)+' by >= '+eps);
const log=(label,payload)=>console.log('[finite-detector-window-research] '+JSON.stringify({label,...payload}));

// Predictions are scalar references ONLY: they NEVER create an optical path
// for PhyDemo. A 5 mm finite segment with +0.5/-0.5 rays was pre-registered.
function reference(thetaDeg,depthMm=120,nObject=1.5,nReceiving=1,detectorAxialMm=40){
  const incident=thetaDeg*RAD;
  const outgoing=Math.asin(nObject/nReceiving*Math.sin(incident));
  const planeTangentMm=depthMm*Math.tan(incident);
  return {planeTangentMm,hitTangentMm:planeTangentMm+detectorAxialMm*Math.tan(outgoing),
    transmittedDeg:outgoing/RAD,
    pairDepthMm:depthMm*Math.tan(incident)/Math.tan(outgoing)};
}
function makeDocument(incidentDeg,{
  depthMm=120,objectIndex=1.5,receivingIndex=1,
  normalDeg=0,sourceSide=-1,originMm={x:0,y:0},detectorAxialMm=40,
  detectorTangentMm=0,detectorLengthMm=5,partialReflection=true,
  lengthUnit='mm',reverseOrder=false
}={}){
  assert.ok([-1,1].includes(sourceSide));
  const unit={mm:1,cm:10,m:1000}[lengthUnit];assert.ok(unit);
  const normal=interfaceNormal({normalDeg}),tangent={x:-normal.y,y:normal.x};
  const travel=-sourceSide,angle=incidentDeg*RAD;
  const heading=add(scale(normal,travel*Math.cos(angle)),scale(tangent,Math.sin(angle)));
  const point=(axial,tang=0)=>({
    x:(originMm.x+normal.x*axial+tangent.x*tang)/unit,
    y:(originMm.y+normal.y*axial+tangent.y*tang)/unit
  });
  const components=[
    {id:'S1',type:'point-source',parameters:{...point(sourceSide*depthMm),brightness:1},
      emission:{mode:'single-ray',directionDeg:Math.atan2(heading.y,heading.x)/RAD}},
    {id:'I1',type:'planar-interface',parameters:{...point(0),normalDeg,
      negativeIndex:sourceSide<0?objectIndex:receivingIndex,
      positiveIndex:sourceSide<0?receivingIndex:objectIndex,partialReflection}},
    {id:'D1',type:'ray-detector',parameters:{
      ...point(travel*detectorAxialMm,detectorTangentMm),
      orientationDeg:wrap(normalDeg+90),length:detectorLengthMm/unit}}
  ];
  if(reverseOrder)components.reverse();
  const request={lengthUnit,title:'Test only: finite detector window is not an eye',components};
  const before=structuredClone(request),doc=prepareScene(request).document;
  assert.deepEqual(request,before);
  assert.equal(doc.schemaVersion,5);assert.equal(doc.upstreamCommit,UPSTREAM);
  validate(doc);return doc;
}
async function nativeRun(label,theta,options={},mutate=null,capture=true){
  const doc=makeDocument(theta,options);
  if(mutate)mutate(doc);
  validate(doc);
  const raw=serializeSave(doc);
  const execution=evaluateDocument(doc,core,capture?REQUESTS:[]);
  assert.equal(serializeSave(doc),raw);
  const readings=(await evaluateObservables(doc,REQUESTS,execution.summary)).results;
  log('native:'+label,{invocationLabel:label,
    canonicalSha256:execution.summary.canonicalSha256,
    source:comp(doc,'point-source'),plane:comp(doc,'planar-interface'),
    detector:comp(doc,'ray-detector'),simulation:doc.simulation,
    native:execution.summary.native,
    emissions:execution.summary.observations?.emissionsById??null,
    interface:execution.summary.observations?.interfacesById??null,
    readings});
  return {label,doc,execution,readings};
}
async function nativePair(label,angles=[-.5,.5],options={}){
  assert.equal(angles.length,2);
  const records=[];
  for(const a of angles)records.push(await nativeRun(label+':'+String(a),a,options));
  const derived=await derivePair(records);
  log('derived:'+label,derived);
  return {records,derived};
}
function scope(doc){
  const components=doc?.physics?.components;
  return doc?.schemaVersion===5&&components?.length===3&&
    ['point-source','planar-interface','ray-detector']
      .every(type=>components.filter(c=>c.type===type).length===1)&&
    comp(doc,'point-source').id==='S1'&&
    comp(doc,'point-source').emission.mode==='single-ray'&&
    comp(doc,'planar-interface').id==='I1'&&comp(doc,'ray-detector').id==='D1';
}
function family(doc){
  const physics=structuredClone(doc.physics);
  physics.components.sort((a,b)=>a.id.localeCompare(b.id));
  delete physics.components.find(c=>c.type==='point-source').emission.directionDeg;
  return canonicalJSON({schemaVersion:doc.schemaVersion,adapterVersion:doc.adapterVersion,
    upstreamCommit:doc.upstreamCommit,physics,simulation:doc.simulation});
}
// Research conditioning choices. These are NOT native precision bounds,
// production admission rules, eye-image accuracy or mathematical theorems.
const MIN_LINE_SINE=1e-4;
const MIN_ENDPOINT_CLEARANCE_MM=.05;
const MAX_EXTENSION_SCENE_RATIO=10;
function linesMeet(a,b){
  const u=a.incomingUnit,v=b.incomingUnit,det=cross(u,v);
  if(!Number.isFinite(det)||Math.abs(det)<=MIN_LINE_SINE)
    return {status:'unavailable',reasonCode:'ILL_CONDITIONED_LINES',value:null};
  const delta=sub(b.pointMm,a.pointMm),sA=cross(delta,v)/det,sB=cross(delta,u)/det;
  const p=add(a.pointMm,scale(u,sA)),q=add(b.pointMm,scale(v,sB));
  if(![sA,sB,p.x,p.y,q.x,q.y].every(Number.isFinite))
    return {status:'unavailable',reasonCode:'NONFINITE_INTERSECTION',value:null};
  return {status:'geometrically-resolved',reasonCode:null,
    value:{pointMm:p,backwardDistancesMm:[-sA,-sB],
      lineSine:Math.abs(det),pairwiseResidualMm:Math.hypot(p.x-q.x,p.y-q.y)}};
}
function provenance(r,values){
  return {invocationLabel:r.label,canonicalSha256:r.execution?.summary?.canonicalSha256??null,
    nativePin:r.doc?.upstreamCommit??null,nativeStatus:r.execution?.summary?.native?.status??null,
    // Incomplete/stale native reads can be suppressed before per-observable
    // warnings are attached. Retain the raw invocation warnings separately.
    rawNativeWarnings:[...(r.execution?.summary?.native?.warnings||[])],
    authoredDirectionDeg:comp(r.doc,'point-source')?.emission?.directionDeg??null,
    readings:values.map(v=>({kind:v.kind,status:v.status,warnings:[...(v.warnings||[])],
      reason:v.reason??null,reasonCode:v.reasonCode??null}))};
}
async function derivePair(records){
  const method='test-only-two-native-runs-finite-window-backprojection';
  const limitation='Derived 2D line point after separate native runs; NOT a native propagated ray, simultaneous pupil observation, physical image, visibility or eye model.';
  const details=[],init={method,limitation};
  // Preserve the distinct run association of each native warning, including
  // when an early failure or genuine finite-window miss withholds the point.
  const warnings=()=>details.flatMap(e=>
    [...new Set([...e.rawNativeWarnings,...e.readings.flatMap(v=>v.warnings)])].map(w=>({
      invocationLabel:e.invocationLabel,canonicalSha256:e.canonicalSha256,warning:w})));
  const fail=(reasonCode,status='unavailable')=>({...init,status,reasonCode,value:null,
    evidence:details,warnings:warnings()});
  if(records.length!==2||records[0]===records[1]||records[0]?.label===records[1]?.label)
    return fail('DISTINCT_INVOCATIONS_REQUIRED');
  if(records.some(r=>!scope(r.doc)))return fail('EXACTLY_ONE_NATIVE_PLANE_SOURCE_DETECTOR');
  if(family(records[0].doc)!==family(records[1].doc))
    return fail('APPARATUS_OR_NUMERICAL_MISMATCH');
  if(comp(records[0].doc,'point-source').emission.directionDeg===
     comp(records[1].doc,'point-source').emission.directionDeg)
    return fail('DISTINCT_DIRECTIONS_REQUIRED');
  if(records[0].execution?.summary?.canonicalSha256===
     records[1].execution?.summary?.canonicalSha256)
    return fail('DISTINCT_NATIVE_SCENE_HASHES_REQUIRED');
  // Audit BOTH separate executions before any path/refusal decision. This
  // avoids silently losing the second run's qualification or hash on a miss.
  const inspected=[];
  for(const r of records){
    const obs=r.execution?.summary?.observations;
    const values=(await evaluateObservables(r.doc,REQUESTS,r.execution?.summary)).results;
    details.push(provenance(r,values));
    inspected.push({r,obs,values});
  }
  const hits=[];
  for(const {r,obs,values} of inspected){
    if(values.some(v=>v.status==='suppressed')||
      !['completed','completed-with-warnings'].includes(r.execution?.summary?.native?.status)||
      r.execution?.summary?.executionPassed!==true)
      return fail('NATIVE_INCOMPLETE_OR_STALE','suppressed');
    if(values.some(v=>!['available','qualified'].includes(v.status)))
      return fail('MISSING_OR_UNQUALIFIED_NATIVE_MEASUREMENT');
    if(obs?.emissionsById?.S1?.emitted!==1||
       obs?.interfacesById?.I1?.interactions!==1)
      return fail('NOT_SINGLE_SOURCE_AND_INTERFACE_INTERACTION');
    const [hitValue,countValue,interfaceValue]=values;
    if(hitValue.value?.length!==1||countValue.value!==1)
      return fail('DETECTOR_WINDOW_DOES_NOT_SELECT_ONE_TRANSMISSION');
    const event=obs.interfacesById.I1.first;
    const trans=event?.branches?.filter(b=>b.kind==='transmitted')??[];
    const plane=comp(r.doc,'planar-interface').parameters;
    const source=comp(r.doc,'point-source').parameters;
    const receiver=comp(r.doc,'ray-detector').parameters;
    const objectSide=Math.sign(signedSide(plane,source));
    const normal=interfaceNormal(plane);
    const hit=hitValue.value[0],u=hit?.incomingUnit;
    if(objectSide===0||signedSide(plane,receiver)*objectSide>=0)
      return fail('DETECTOR_NOT_ON_RECEIVING_SIDE');
    if(event?.outcome!=='transmission'||trans.length!==1||
       event.incidentIndex!==(objectSide<0?plane.negativeIndex:plane.positiveIndex)||
       event.destinationIndex!==(objectSide<0?plane.positiveIndex:plane.negativeIndex))
      return fail('NO_UNAMBIGUOUS_TRANSMITTED_BRANCH');
    if(!u||![u.x,u.y,hit.pointMm?.x,hit.pointMm?.y].every(Number.isFinite)||
       Math.abs(Math.hypot(u.x,u.y)-1)>1e-8||
       dot(u,normal)*objectSide>=0||
       Math.hypot(u.x-trans[0].direction.x,u.y-trans[0].direction.y)>1e-8)
      return fail('HIT_NOT_THE_NATIVE_RECEIVING_TRANSMISSION');
    if(!Number.isFinite(hit.distanceFromP1Mm)||
       hit.distanceFromP1Mm<=MIN_ENDPOINT_CLEARANCE_MM||
       receiver.length-hit.distanceFromP1Mm<=MIN_ENDPOINT_CLEARANCE_MM)
      return fail('FINITE_DETECTOR_ENDPOINT_NOT_PROVEN_CLEAR');
    if(interfaceValue.value?.outcome!=='transmission')
      return fail('NATIVE_INTERFACE_RESULT_CONTRADICTS_BRANCH');
    hits.push(hit);
  }
  const intersection=linesMeet(...hits);
  if(intersection.status!=='geometrically-resolved')
    return fail(intersection.reasonCode);
  const {pointMm,backwardDistancesMm,lineSine,pairwiseResidualMm}=intersection.value;
  const plane=comp(records[0].doc,'planar-interface').parameters;
  const source=comp(records[0].doc,'point-source').parameters;
  const detector=comp(records[0].doc,'ray-detector').parameters;
  const objectDepthMm=Math.abs(signedSide(plane,source));
  const receiverOffsetMm=Math.abs(signedSide(plane,detector));
  const sceneScale=objectDepthMm+receiverOffsetMm;
  if(backwardDistancesMm.some(d=>d<=0||d>MAX_EXTENSION_SCENE_RATIO*sceneScale)||
     signedSide(plane,pointMm)*signedSide(plane,source)<=0)
    return fail('NOT_A_BOUNDED_BACKWARD_SOURCE_SIDE_INTERSECTION');
  // Line self-residual is recorded but NEVER treated as optical accuracy.
  const status=details.some(e=>e.readings.some(v=>v.status==='qualified'))?'qualified':'available';
  return {...init,status,reasonCode:null,
    value:{pointMm,normalDepthMm:Math.abs(signedSide(plane,pointMm)),
      backwardDistancesMm,lineSine,pairwiseResidualMm,
      endpointClearancesMm:hits.map((h,i)=>Math.min(h.distanceFromP1Mm,
        comp(records[i].doc,'ray-detector').parameters.length-h.distanceFromP1Mm)),
      extensionToSceneScale:Math.max(...backwardDistancesMm)/sceneScale},
    evidence:details,warnings:warnings()};
}
function assertNativeComplete(records){
  for(const r of records){
    assert.equal(r.execution.summary.native.status,'completed');
    assert.equal(r.execution.summary.executionPassed,true);
    assert.equal(r.execution.summary.native.truncation,0);
    assert.equal(r.execution.summary.native.undefinedBehavior,0);
  }
}

test('B research: two real native rays each cross the SAME 5 mm finite receiving detector',async()=>{
  const {records,derived}=await nativePair('five-mm-window');
  assertNativeComplete(records);
  assert.equal(derived.status,'available');
  assert.equal(derived.evidence.length,2);
  assert.notEqual(derived.evidence[0].canonicalSha256,derived.evidence[1].canonicalSha256);
  for(let i=0;i<records.length;i++){
    const r=records[i],a=[-.5,.5][i],readings=r.readings;
    assert.deepEqual(readings.map(v=>v.status),['available','available','available']);
    assert.equal(readings[0].value.length,1);assert.equal(readings[1].value,1);
    assert.equal(r.execution.summary.observations.interfacesById.I1.transmitted,1);
    assert.equal(r.execution.summary.observations.interfacesById.I1.reflected,1);
    const h=readings[0].value[0],expect=reference(a);
    close(h.pointMm.x,40);close(h.pointMm.y,expect.hitTangentMm,1e-6);
    close(Math.atan2(h.incomingUnit.y,h.incomingUnit.x)/RAD,expect.transmittedDeg,1e-6);
    assert.ok(derived.value.endpointClearancesMm[i]>.9);
    assert.deepEqual(Object.keys(h).sort(),['distanceFromP1Mm','incomingUnit','pointMm']);
  }
  close(derived.value.normalDepthMm,reference(.5).pairDepthMm,1e-6);
  close(derived.value.pointMm.x,-reference(.5).pairDepthMm,1e-6);
  close(derived.value.pointMm.y,0,1e-6);
  assert.ok(derived.value.lineSine>.02);
  assert.ok(derived.value.extensionToSceneScale<1);
});


test('B research: equal-index native continuation selects finite hits and reconstructs real depth',async()=>{
  // Required by preregistration #134, specifically flagged P1 in Chat B R1.
  // Observe PhyDemo interface behavior; never manufacture a reflected branch.
  for(const n of [1,1.5]){
    const {records,derived}=await nativePair('equal-index-'+n,[-.5,.5],
      {objectIndex:n,receivingIndex:n});
    assertNativeComplete(records);
    assert.equal(derived.value!==null,true,'equal-index native selection must yield geometry');
    assert.equal(derived.evidence.length,2);
    assert.ok(['available','qualified'].includes(derived.status));
    const expectedY=160*Math.tan(.5*RAD);
    for(const [i,run] of records.entries()){
      const sign=[-1,1][i],event=run.execution.summary.observations.interfacesById.I1.first;
      const meter=run.execution.summary.observations.interfacesById.I1;
      assert.equal(run.execution.summary.observations.emissionsById.S1.emitted,1);
      assert.equal(meter.interactions,1);
      assert.equal(meter.transmitted,1);
      assert.equal(event.outcome,'transmission');
      assert.equal(event.incidentIndex,n);
      assert.equal(event.destinationIndex,n);
      assert.equal(run.readings[1].value,1);
      assert.equal(run.readings[0].value.length,1);
      assert.ok(run.readings.every(x=>['available','qualified'].includes(x.status)));
      const h=run.readings[0].value[0];
      close(h.pointMm.x,40);
      close(h.pointMm.y,sign*expectedY,1e-6);
      close(h.pointMm.y,reference(sign*.5,120,n,n).hitTangentMm,1e-6);
      close(h.incomingUnit.x,Math.cos(.5*RAD),1e-8);
      close(h.incomingUnit.y,sign*Math.sin(.5*RAD),1e-8);
      close(h.incomingUnit.x,event.branches.find(b=>b.kind==='transmitted').direction.x,1e-8);
      close(h.incomingUnit.y,event.branches.find(b=>b.kind==='transmitted').direction.y,1e-8);
      assert.ok(derived.value.endpointClearancesMm[i]>1,
        'actual same-medium detector crossing must be clear of either endpoint');
    }
    close(derived.value.normalDepthMm,120,1e-6);
    close(derived.value.pointMm.x,-120,1e-6);
    close(derived.value.pointMm.y,0,1e-6);
    assert.ok(derived.value.backwardDistancesMm.every(d=>d>0));
    assert.equal(derived.status,
      derived.evidence.some(e=>e.readings.some(v=>v.status==='qualified'))?'qualified':'available');
    log('equal-index-native-control',{index:n,measuredY:records.map(r=>r.readings[0].value[0].pointMm.y),
      derivedDepthMm:derived.value.normalDepthMm,
      nativeReflections:records.map(r=>r.execution.summary.observations.interfacesById.I1.reflected),
      status:derived.status});
  }
});

test('B research: actual shifted/shortened finite windows produce misses, not observer claims',async()=>{
  const shifted=await nativePair('shift-window',[-.5,.5],{detectorTangentMm:2.5});
  assertNativeComplete(shifted.records);
  assert.deepEqual(shifted.records.map(x=>x.readings[1].value),[0,1]);
  assert.deepEqual(shifted.records[0].readings[0].value,[]);
  assert.equal(shifted.derived.status,'unavailable');
  assert.equal(shifted.derived.evidence.length,2,
    'even on a first-run detector miss the second independent run is retained');
  assert.equal(shifted.derived.reasonCode,'DETECTOR_WINDOW_DOES_NOT_SELECT_ONE_TRANSMISSION');
  const short=await nativePair('shorten-window',[-.5,.5],{detectorLengthMm:2});
  assertNativeComplete(short.records);
  assert.deepEqual(short.records.map(x=>x.readings[1].value),[0,0]);
  assert.equal(short.derived.status,'unavailable');
  const away=await nativePair('move-away',[-.5,.5],{detectorTangentMm:10});
  assertNativeComplete(away.records);
  assert.deepEqual(away.records.map(x=>x.readings[0].value),[[],[]]);
  assert.equal(away.derived.value,null);
});

test('B research: reverse travel, rotated planes, translated window, units and input order',async()=>{
  const cases=[
    {sourceSide:1},
    {normalDeg:180},
    {normalDeg:-180,sourceSide:1},
    {normalDeg:90},
    {normalDeg:37,originMm:{x:247,y:-83}},
    {normalDeg:-37,sourceSide:1,originMm:{x:-153,y:71}},
    {lengthUnit:'cm',reverseOrder:true},
    {lengthUnit:'m'}
  ];
  for(const [i,options] of cases.entries()){
    const p=await nativePair('coordinate-'+i,[-.5,.5],options);
    assertNativeComplete(p.records);assert.equal(p.derived.status,'available');
    close(p.derived.value.normalDepthMm,reference(.5).pairDepthMm,1e-6);
    const normal=interfaceNormal({normalDeg:options.normalDeg??0});
    const origin=options.originMm??{x:0,y:0},side=options.sourceSide??-1;
    close(p.derived.value.pointMm.x,origin.x+side*normal.x*reference(.5).pairDepthMm,1e-6);
    close(p.derived.value.pointMm.y,origin.y+side*normal.y*reference(.5).pairDepthMm,1e-6);
    assert.ok(p.derived.value.endpointClearancesMm.every(x=>x>.9));
  }
});


test('B research: cross-run component ordering may differ while every physical field is identical',async()=>{
  const first=await nativeRun('mixed-order-first',-.5);
  const second=await nativeRun('mixed-order-second',.5,{reverseOrder:true});
  assertNativeComplete([first,second]);
  assert.deepEqual(first.doc.physics.components.map(c=>c.id),['S1','I1','D1']);
  assert.deepEqual(second.doc.physics.components.map(c=>c.id),['D1','I1','S1']);
  assert.equal(family(first.doc),family(second.doc),
    'only explicit emission heading and serialization ordering may differ');
  assert.notEqual(first.execution.summary.canonicalSha256,second.execution.summary.canonicalSha256);
  const derived=await derivePair([first,second]);
  assert.equal(derived.status,'available');
  assert.equal(derived.evidence.length,2);
  assert.ok(derived.value.endpointClearancesMm.every(d=>d>.9));
  close(derived.value.normalDepthMm,reference(.5).pairDepthMm,1e-6);
  close(derived.value.pointMm.x,-reference(.5).pairDepthMm,1e-6);
  close(derived.value.pointMm.y,0,1e-6);
});

test('B research: qualified transmitted-only native readings stay qualified in derived geometry',async()=>{
  const pair=await nativePair('transmitted-only',[-.5,.5],{partialReflection:false});
  assertNativeComplete(pair.records);
  assert.equal(pair.derived.status,'qualified');
  assert.equal(pair.derived.evidence.length,2);
  assert.equal(pair.derived.evidence[0].readings[0].status,'qualified');
  assert.equal(pair.derived.evidence[1].readings[2].status,'qualified');
  assert.equal(pair.derived.warnings.length,2,
    'native approximation warnings retain both separate run identities');
  assert.ok(pair.derived.warnings.every(w=>/omits Fresnel/.test(w.warning)&&
    w.canonicalSha256&&w.invocationLabel));
  for(const run of pair.records){
    assert.equal(run.execution.summary.observations.interfacesById.I1.reflected,0);
    assert.equal(run.execution.summary.observations.interfacesById.I1.transmitted,1);
    assert.ok(run.readings.every(x=>x.status==='qualified'));
  }
  close(pair.derived.value.normalDepthMm,reference(.5).pairDepthMm,1e-6);
  const missed=await nativePair('qualified-miss',[-.5,.5],
    {partialReflection:false,detectorTangentMm:2.5});
  assertNativeComplete(missed.records);
  assert.equal(missed.derived.status,'unavailable');
  assert.equal(missed.derived.value,null);
  assert.equal(missed.derived.evidence.length,2);
  assert.equal(missed.derived.warnings.length,2);
  assert.ok(missed.derived.evidence.every(e=>
    e.readings.every(v=>v.status==='qualified')));
});

test('B research: provenance requires distinct invocations and same whole apparatus except emission heading',async()=>{
  const base=await nativeRun('provenance-A',-.5);
  const mate=await nativeRun('provenance-B',.5);
  assert.equal((await derivePair([base])).reasonCode,'DISTINCT_INVOCATIONS_REQUIRED');
  assert.equal((await derivePair([base,base])).reasonCode,'DISTINCT_INVOCATIONS_REQUIRED');
  const duplicate=await nativeRun('same-heading',-.5);
  assert.equal((await derivePair([base,duplicate])).reasonCode,'DISTINCT_DIRECTIONS_REQUIRED');
  for(const [name,options] of [
    ['source-depth',{depthMm:121}],['media',{objectIndex:1.6}],
    ['detector-width',{detectorLengthMm:6}],['window-shift',{detectorTangentMm:1}],
    ['detector-axial',{detectorAxialMm:42}],['fresnel-policy',{partialReflection:false}]
  ]){
    const wrong=await nativeRun('different-'+name,.5,options);
    const result=await derivePair([base,wrong]);
    assert.equal(result.status,'unavailable');assert.equal(result.reasonCode,'APPARATUS_OR_NUMERICAL_MISMATCH');
    assert.equal(result.value,null);
  }
  const otherLimit=await nativeRun('different-depth-limit',.5,{},doc=>{doc.simulation.maxRayDepth=7;});
  assert.equal((await derivePair([base,otherLimit])).reasonCode,'APPARATUS_OR_NUMERICAL_MISMATCH');
  const otherShape=makeDocument(.5);
  otherShape.physics.components.push({id:'I2',type:'planar-interface',
    parameters:{x:80,y:0,normalDeg:0,negativeIndex:1,positiveIndex:1.5,partialReflection:true}});
  validate(otherShape);
  assert.equal((await derivePair([base,{label:'extra-plane',doc:otherShape,execution:null}])).reasonCode,
    'EXACTLY_ONE_NATIVE_PLANE_SOURCE_DETECTOR');
});

test('B research: native TIR, near critical, missing capture and ray-depth-budget zero do not create a point',async()=>{
  const tir=await nativePair('tir',[-50,50]);
  assertNativeComplete(tir.records);
  assert.equal(tir.derived.status,'unavailable');
  for(const r of tir.records){
    const meter=r.execution.summary.observations.interfacesById.I1;
    assert.equal(meter.totalInternalReflections,1);
    assert.equal(meter.transmitted,0);
    assert.deepEqual(r.readings[0].value,[]);
    assert.equal(r.readings[1].value,0);
  }
  const critical=Math.asin(1/1.5)/RAD;
  const near=await nativePair('just-below-critical',[-(critical-1e-5),critical-1e-5]);
  assertNativeComplete(near.records);
  assert.ok(near.records.every(r=>r.execution.summary.observations.interfacesById.I1.transmitted===1));
  assert.equal(near.derived.status,'unavailable');
  assert.deepEqual(near.records.map(r=>r.readings[1].value),[0,0]);
  const shallow=await nativePair('ray-depth-budget-zero',[-.5,.5],
    { },);
  // Re-evaluate the same declared apparatus under explicit incomplete budgets
  // without ever calling the postprocessor with fabricated native readings.
  const incomplete=[];
  for(const angle of [-.5,.5])
    incomplete.push(await nativeRun('incomplete:'+angle,angle,{},d=>{d.simulation.maxRayDepth=0;}));
  assert.ok(incomplete.every(r=>r.execution.summary.native.status==='incomplete'));
  const withhold=await derivePair(incomplete);
  assert.equal(withhold.status,'suppressed');
  assert.equal(withhold.value,null);
  assert.equal(withhold.evidence.length,2);
  assert.ok(withhold.evidence.every(e=>e.readings.every(v=>v.status==='suppressed')));
  assert.ok(shallow.derived.status==='available');
  const noCapture={label:'no-opt-in',doc:shallow.records[0].doc,
    execution:evaluateDocument(shallow.records[0].doc,core)};
  const missing=await derivePair([noCapture,shallow.records[1]]);
  assert.equal(missing.status,'unavailable');assert.equal(missing.value,null);
  assert.equal(missing.evidence.length,2);
  const stale={...shallow.records[0],doc:structuredClone(shallow.records[0].doc)};
  comp(stale.doc,'point-source').emission.directionDeg=-.6;
  validate(stale.doc);
  const old=await derivePair([stale,shallow.records[1]]);
  assert.equal(old.status,'suppressed');assert.equal(old.value,null);
  assert.equal(old.evidence.length,2);
});


test('B research: a suppressed run retains its original native warning identity',async()=>{
  const failed=await nativeRun('suppressed-original',-.5,{},d=>{d.simulation.maxRayDepth=0;});
  const second=await nativeRun('complete-other',.5,{},d=>{d.simulation.maxRayDepth=0;});
  assert.equal(failed.execution.summary.native.status,'incomplete');
  // Artificial source-warning injection tests the evidence pipeline only;
  // it is NEVER claimed to be a native warning actually emitted by PhyDemo.
  const injected=structuredClone(failed);
  injected.label='suppressed-with-synthetic-warning';
  injected.execution.summary.native.warnings=[
    ...(failed.execution.summary.native.warnings||[]),
    'SYNTHETIC_RESEARCH_WARNING_PROVENANCE_CONTROL'
  ];
  const output=await derivePair([injected,second]);
  assert.equal(output.status,'suppressed');
  assert.equal(output.value,null);
  assert.equal(output.evidence.length,2);
  assert.deepEqual(output.evidence[0].rawNativeWarnings,
    injected.execution.summary.native.warnings);
  assert.ok(output.evidence.every(e=>e.readings.every(v=>v.status==='suppressed')));
  assert.ok(output.warnings.some(w=>w.invocationLabel===injected.label&&
    w.canonicalSha256===injected.execution.summary.canonicalSha256&&
    w.warning==='SYNTHETIC_RESEARCH_WARNING_PROVENANCE_CONTROL'));
  assert.ok(!output.warnings.some(w=>w.invocationLabel===second.label&&
    w.warning==='SYNTHETIC_RESEARCH_WARNING_PROVENANCE_CONTROL'));
});

test('B research: measured near-parallel native exits are withheld; synthetic antiparallel algebra also refused',async()=>{
  const almost=await nativePair('near-parallel',[-1e-6,1e-6]);
  assertNativeComplete(almost.records);
  assert.deepEqual(almost.records.map(r=>r.readings[1].value),[1,1]);
  assert.equal(almost.derived.status,'unavailable');
  assert.equal(almost.derived.reasonCode,'ILL_CONDITIONED_LINES');
  const s1={pointMm:{x:40,y:-1},incomingUnit:{x:1,y:0}};
  const s2={pointMm:{x:40,y:1},incomingUnit:{x:-1,y:1e-12}};
  assert.equal(linesMeet(s1,s2).reasonCode,'ILL_CONDITIONED_LINES');
});

test('B research: numerical perturbations probe only extrapolation sensitivity, not physical error',async()=>{
  const p=await nativePair('sensitivity',[-.5,.5]);
  assert.equal(p.derived.status,'available');
  const h=p.records.map(r=>r.readings[0].value[0]);
  const base=p.derived.value.pointMm;
  const offsets=[];
  for(const sign of [-1,1]){
    const a={pointMm:add(h[0].pointMm,{x:0,y:sign*1e-4}),
      incomingUnit:rotate(h[0].incomingUnit,sign*1e-6)};
    const b={pointMm:add(h[1].pointMm,{x:0,y:-sign*1e-4}),
      incomingUnit:rotate(h[1].incomingUnit,-sign*1e-6)};
    const q=linesMeet(a,b);
    assert.equal(q.status,'geometrically-resolved');
    offsets.push(Math.hypot(q.value.pointMm.x-base.x,q.value.pointMm.y-base.y));
  }
  log('conditioning-sensitivity',{testedInputPerturbations:{
    positionMm:1e-4,directionRad:1e-6},
    maxDerivedPointShiftMm:Math.max(...offsets),
    source:'PERTURBED_POST_NATIVE_LINES_ONLY',nativeErrorEstimate:false,
    note:'This synthetic perturbation cannot bound PhyDemo or real physical image error'});
  assert.ok(Math.max(...offsets)<.1);
});

test('B research: opt-in recording leaves canonical scene and existing native meters unchanged',async()=>{
  const doc=makeDocument(.5),original=serializeSave(doc);
  const full=evaluateDocument(doc,core,REQUESTS);
  const basic=evaluateDocument(doc,core);
  assert.equal(serializeSave(doc),original);
  assert.equal(full.summary.canonicalSha256,basic.summary.canonicalSha256);
  assert.equal(full.summary.native.status,basic.summary.native.status);
  for(const key of NATIVE_OBSERVATION_KEYS)
    assert.deepEqual(full.summary.observations[key],basic.summary.observations[key]);
  assert.deepEqual(Object.keys(basic.summary.observations).sort(),[...NATIVE_OBSERVATION_KEYS].sort());
  const readings=(await evaluateObservables(doc,REQUESTS,basic.summary)).results;
  assert.equal(readings[0].status,'unavailable');
  assert.equal(readings[0].value,null);
  log('capture-invariance',{canonicalSha256:full.summary.canonicalSha256,
    sameNativeMeters:true,oldNativeKeys:[...NATIVE_OBSERVATION_KEYS]});
});


// ---------------------------------------------------------------------------
// B1b numerical stress extension, preregistered in issue #139.
// All values below are TEST-LOCAL diagnostics of post-native measured rays.
// No numerical result is written into PhyDemo or exposed as a public image.
// ---------------------------------------------------------------------------
function localFrameIntersection(records){
  if(records.length!==2||records.some(r=>r.readings[0].value?.length!==1))
    return {status:'withheld',reason:'NATIVE_FINITE_HIT_PAIR_REQUIRED',value:null};
  const doc=records[0].doc,plane=comp(doc,'planar-interface').parameters;
  const source=comp(doc,'point-source').parameters;
  const detector=comp(doc,'ray-detector').parameters;
  const origin={x:plane.x,y:plane.y};
  const n=interfaceNormal(plane),t={x:-n.y,y:n.x};
  const hits=records.map(r=>r.readings[0].value[0]);
  const localPoint=p=>({axial:dot(sub(p,origin),n),tangent:dot(sub(p,origin),t)});
  const localDirection=u=>({axial:dot(u,n),tangent:dot(u,t)});
  const pA=localPoint(hits[0].pointMm),pB=localPoint(hits[1].pointMm);
  const uA=localDirection(hits[0].incomingUnit),uB=localDirection(hits[1].incomingUnit);
  const det=uA.axial*uB.tangent-uA.tangent*uB.axial;
  if(!Number.isFinite(det)||Math.abs(det)<=MIN_LINE_SINE)
    return {status:'withheld',reason:'RESEARCH_CONDITIONING_ALARM',value:null,
      observedLineSine:Math.abs(det)};
  const delta={axial:pB.axial-pA.axial,tangent:pB.tangent-pA.tangent};
  const crossLocal=(a,b)=>a.axial*b.tangent-a.tangent*b.axial;
  const sA=crossLocal(delta,uB)/det,sB=crossLocal(delta,uA)/det;
  const meet={axial:pA.axial+sA*uA.axial,tangent:pA.tangent+sA*uA.tangent};
  const world=add(origin,add(scale(n,meet.axial),scale(t,meet.tangent)));
  const scaleMm=Math.abs(signedSide(plane,source))+
    Math.abs(signedSide(plane,detector));
  const normA=Math.hypot(hits[0].incomingUnit.x,hits[0].incomingUnit.y);
  const normB=Math.hypot(hits[1].incomingUnit.x,hits[1].incomingUnit.y);
  const endpointClearance=hits.map(h=>Math.min(h.distanceFromP1Mm,
    detector.length-h.distanceFromP1Mm));
  const evidence={planeCenterMm:origin,localPointMm:meet,worldPointMm:world,
    normalDepthMm:Math.abs(meet.axial),sideSign:Math.sign(meet.axial),
    sourceSideSign:Math.sign(signedSide(plane,source)),directionSine:Math.abs(det),
    incomingUnitLengths:[normA,normB],
    signedExtensionMm:[sA,sB],backwardDistancesMm:[-sA,-sB],
    endpointClearancesMm:endpointClearance,
    sceneScaleMm:scaleMm,extensionToSceneScale:Math.max(-sA,-sB)/scaleMm,
    nativeSceneShas:records.map(r=>r.execution.summary.canonicalSha256),
    originalNativeWarnings:records.map(r=>r.execution.summary.native.warnings),
    nativeRunStatuses:records.map(r=>r.execution.summary.native.status),
    localPositionResidualMm:Math.hypot(
      (pA.axial+sA*uA.axial)-(pB.axial+sB*uB.axial),
      (pA.tangent+sA*uA.tangent)-(pB.tangent+sB*uB.tangent))};
  if(![meet.axial,meet.tangent,world.x,world.y,sA,sB,scaleMm].every(Number.isFinite)||
    scaleMm<=0||sA>=0||sB>=0||meet.axial*evidence.sourceSideSign<=0||
    endpointClearance.some(x=>x<=0)||
    [normA,normB].some(v=>Math.abs(v-1)>1e-8))
    return {status:'withheld',reason:'UNQUALIFIED_RESEARCH_GEOMETRY',value:null,
      diagnostic:evidence};
  return {status:'test-only-resolved',reason:null,value:evidence};
}
function researchStressSummary(label,pair,expectedDepthMm,alarmMm){
  const local=localFrameIntersection(pair.records);
  assertNativeComplete(pair.records);
  assert.equal(pair.derived.status,'available',label);
  assert.equal(local.status,'test-only-resolved',label+': '+local.reason);
  assert.equal(local.value.nativeSceneShas.length,2);
  assert.notEqual(...local.value.nativeSceneShas);
  assert.deepEqual(local.value.nativeRunStatuses,['completed','completed']);
  assert.equal(local.value.originalNativeWarnings.every(w=>w.length===0),true);
  assert.equal(local.value.directionSine>MIN_LINE_SINE,true);
  assert.equal(local.value.signedExtensionMm.every(v=>v<0),true);
  assert.equal(local.value.sourceSideSign,local.value.sideSign);
  assert.equal(local.value.endpointClearancesMm.every(v=>v>0),true);
  const delta=Math.abs(local.value.normalDepthMm-expectedDepthMm);
  assert.ok(delta<=alarmMm,
    label+': native-based local depth differs from conditional Snell reference by '+delta+' mm');
  const oldPoint=pair.derived.value.pointMm;
  const worldDelta=Math.hypot(oldPoint.x-local.value.worldPointMm.x,
    oldPoint.y-local.value.worldPointMm.y);
  assert.ok(worldDelta<=.02,label+': world-coordinate line method mismatch '+worldDelta);
  log('B1B_TEST_ONLY_STRESS',{label,source:'ACTUAL_PINNED_NATIVE_EXIT_HITS',
    expectedConditionalSnellDepthMm:expectedDepthMm,
    observedLocalDepthMm:local.value.normalDepthMm,depthVsReferenceMm:delta,
    worldLineAlgorithmDifferenceMm:worldDelta,
    diagnostic:local.value,
    nativeCertifiedPositionError:false,physicalImage:false,
    note:'Sample-only algebraic and metamorphic checks, NOT a native accuracy budget'});
  return local;
}

test('B1b prereg A–G: index and finite-window width stress on actual native sampled hits',async()=>{
  const fixtures=[
    {label:'A-1p5-to-1-baseline',objectIndex:1.5,receivingIndex:1,
      theta:.5,width:5,depth:120,offset:40},
    {label:'B-equal-1',objectIndex:1,receivingIndex:1,
      theta:.5,width:5,depth:120,offset:40},
    {label:'B-equal-1p5',objectIndex:1.5,receivingIndex:1.5,
      theta:.5,width:5,depth:120,offset:40},
    {label:'C-1-to-1p5',objectIndex:1,receivingIndex:1.5,
      theta:.5,width:5,depth:120,offset:40},
    {label:'C-1-to-4',objectIndex:1,receivingIndex:4,
      theta:.5,width:5,depth:120,offset:40},
    {label:'D-4-to-1-near-normal',objectIndex:4,receivingIndex:1,
      theta:.2,width:5,depth:120,offset:40},
    {label:'E-2mm-window',objectIndex:1.5,receivingIndex:1,
      theta:.2,width:2,depth:120,offset:40},
    {label:'F-10mm-window',objectIndex:1.5,receivingIndex:1,
      theta:1,width:10,depth:120,offset:40},
    {label:'G-long-window-small-angle',objectIndex:1.5,receivingIndex:1,
      theta:.05,width:5,depth:1000,offset:500}
  ];
  for(const x of fixtures){
    const options={objectIndex:x.objectIndex,receivingIndex:x.receivingIndex,
      depthMm:x.depth,detectorAxialMm:x.offset,detectorLengthMm:x.width};
    const pair=await nativePair('b1b-stress:'+x.label,[-x.theta,x.theta],options);
    const conditional=reference(x.theta,x.depth,x.objectIndex,x.receivingIndex,x.offset);
    const local=researchStressSummary(x.label,pair,conditional.pairDepthMm,
      x.label.startsWith('G-')?.1:.02);
    for(const [k,r] of pair.records.entries()){
      const hit=r.readings[0].value[0];
      assert.equal(r.readings[1].value,1,x.label);
      assert.equal(r.execution.summary.observations.interfacesById.I1.interactions,1);
      close(hit.pointMm.y,[-1,1][k]*conditional.hitTangentMm, x.label.startsWith('G-')?.1:.02);
      assert.ok(local.value.endpointClearancesMm[k]>.01,
        x.label+' produced a finite detector endpoint ambiguity');
    }
  }
});

test('B1b prereg H/I: local depth is invariant under reversed normals and large translations',async()=>{
  const variants=[
    {label:'reverse-object-side',options:{sourceSide:1}},
    {label:'normal-pos90',options:{normalDeg:90}},
    {label:'normal-neg90',options:{normalDeg:-90}},
    {label:'normal-pos180',options:{normalDeg:180}},
    {label:'normal-neg180',options:{normalDeg:-180,sourceSide:1}},
    {label:'normal-pos37',options:{normalDeg:37}},
    {label:'normal-neg37',options:{normalDeg:-37,sourceSide:1}},
    {label:'large-plane-centered-translation',options:{
      normalDeg:37,originMm:{x:6500,y:-5200}}},
    {label:'m-units-order',options:{normalDeg:-37,sourceSide:1,
      originMm:{x:-6000,y:4900},lengthUnit:'m',reverseOrder:true}},
    {label:'cm-units-order',options:{normalDeg:90,
      originMm:{x:7000,y:-5000},lengthUnit:'cm',reverseOrder:true}}
  ];
  const expected=reference(.5).pairDepthMm;
  for(const {label,options} of variants){
    const pair=await nativePair('b1b-transform:'+label,[-.5,.5],options);
    const local=researchStressSummary(label,pair,expected,.02);
    assert.equal(local.value.endpointClearancesMm.every(v=>v>.8),true);
    const p=local.value.worldPointMm;
    const origin=options.originMm??{x:0,y:0};
    const n=interfaceNormal({normalDeg:options.normalDeg??0});
    const side=options.sourceSide??-1;
    const predicted=add(origin,scale(n,side*expected));
    assert.ok(Math.hypot(p.x-predicted.x,p.y-predicted.y)<.02,
      label+' unexpectedly changed the oriented virtual supporting-line construction');
  }
});

test('B1b prereg negative matrix: measured finite misses, TIR and near-parallel produce no accepted point',async()=>{
  const cases=[
    {label:'one-mm-window-miss',angles:[-.5,.5],options:{detectorLengthMm:1},
      expectedCounts:[0,0]},
    {label:'two-mm-baseline-miss',angles:[-.5,.5],options:{detectorLengthMm:2},
      expectedCounts:[0,0]},
    {label:'shifted-window-one-miss',angles:[-.5,.5],
      options:{detectorTangentMm:2.5},expectedCounts:[0,1]},
    {label:'native-total-internal-reflection',angles:[-50,50],
      options:{},expectedCounts:[0,0]},
    {label:'near-critical-window-miss',
      angles:[-(Math.asin(1/1.5)/RAD-1e-5),Math.asin(1/1.5)/RAD-1e-5],
      options:{},expectedCounts:[0,0]},
    {label:'near-parallel-small-separation',angles:[-1e-6,1e-6],
      options:{},expectedCounts:[1,1]}
  ];
  for(const x of cases){
    const p=await nativePair('b1b-negative:'+x.label,x.angles,x.options);
    assertNativeComplete(p.records);
    assert.deepEqual(p.records.map(r=>r.readings[1].value),x.expectedCounts,x.label);
    assert.equal(p.derived.value,null,x.label);
    const local=localFrameIntersection(p.records);
    assert.equal(local.value,null,x.label);
    log('B1B_TEST_ONLY_NEGATIVE',{label:x.label,reason:p.derived.reasonCode,
      nativeCrossings:x.expectedCounts,
      localReason:local.reason,sceneHashes:p.records.map(r=>r.execution.summary.canonicalSha256),
      noPhysicalImageClaim:true});
  }
});

test('B1b prereg J: native transmitted-only warnings are retained and no public coordinates exist',async()=>{
  const p=await nativePair('b1b-fresnel-approx',[-.5,.5],{partialReflection:false});
  assertNativeComplete(p.records);
  assert.equal(p.derived.status,'qualified');
  assert.equal(p.derived.evidence.length,2);
  assert.equal(p.derived.warnings.length,2);
  assert.ok(p.derived.warnings.every(w=>/omits Fresnel/.test(w.warning)&&w.canonicalSha256));
  const local=localFrameIntersection(p.records);
  assert.equal(local.status,'test-only-resolved');
  log('B1B_TEST_ONLY_FRESNEL',{status:p.derived.status,
    nativeIndividualWarnings:p.derived.warnings,
    independentlyObservedSceneSha:p.records.map(r=>r.execution.summary.canonicalSha256),
    derivedOnlyTestLocal:true,nativeAccuracyCertified:false});
});

test('B1b prereg post-native sensitivity: single-ray and paired-ray hypothetical perturbations',async()=>{
  for(const x of [
    {label:'baseline',angles:[-.5,.5],options:{}},
    {label:'long-small-angle',angles:[-.05,.05],options:{depthMm:1000,detectorAxialMm:500}}
  ]){
    const pair=await nativePair('b1b-perturb:'+x.label,x.angles,x.options);
    const measured=pair.records.map(r=>r.readings[0].value[0]);
    const original=linesMeet(...measured);
    assert.equal(original.status,'geometrically-resolved');
    let maxSingle=0,maxPaired=0;
    for(const sign of [-1,1]){
      const pA={pointMm:add(measured[0].pointMm,{x:0,y:sign*1e-4}),
        incomingUnit:rotate(measured[0].incomingUnit,sign*1e-6)};
      const single=linesMeet(pA,measured[1]);
      assert.equal(single.status,'geometrically-resolved');
      maxSingle=Math.max(maxSingle,Math.hypot(
        single.value.pointMm.x-original.value.pointMm.x,
        single.value.pointMm.y-original.value.pointMm.y));
      const pB={pointMm:add(measured[1].pointMm,{x:0,y:-sign*1e-4}),
        incomingUnit:rotate(measured[1].incomingUnit,-sign*1e-6)};
      const paired=linesMeet(pA,pB);
      assert.equal(paired.status,'geometrically-resolved');
      maxPaired=Math.max(maxPaired,Math.hypot(
        paired.value.pointMm.x-original.value.pointMm.x,
        paired.value.pointMm.y-original.value.pointMm.y));
    }
    assert.ok(Number.isFinite(maxSingle)&&Number.isFinite(maxPaired));
    log('B1B_TEST_ONLY_SENSITIVITY',{label:x.label,
      hypotheticalPositionPerturbationMm:1e-4,
      hypotheticalDirectionPerturbationRad:1e-6,
      singleRayResultShiftMm:maxSingle,pairedRayResultShiftMm:maxPaired,
      source:'PERTURBED_POST_NATIVE_MEASURED_LINES_ONLY',
      nativeErrorCalibration:false,physicalImageAccuracy:false});
  }
});
