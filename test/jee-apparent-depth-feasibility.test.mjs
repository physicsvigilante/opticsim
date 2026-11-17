// RESEARCH ONLY -- issue #130. No production import or new scene admission.
// Frozen native probe inputs, not a blind model evaluation or an eye model.
// Pinned PhyDemo alone produces ray paths. All line extensions below operate
// AFTER native completion, on existing opt-in detector-hit-events values.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {validate,serializeSave,UPSTREAM} from '../src/contract.js';
import {interfaceNormal,signedSide} from '../src/planar-media.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const RAD=Math.PI/180;
const REQUESTS=[{id:'hits',kind:'detector-hit-events',componentId:'D1'},
  {id:'count',kind:'detector-crossings',componentId:'D1'}];
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const close=(a,b,tolerance=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
  Math.abs(a-b)<tolerance,`${a} != ${b}; tolerance ${tolerance}`);
const wrap=a=>a>180?a-360:a< -180?a+360:a;
const component=(doc,type)=>doc.physics.components.find(c=>c.type===type);
const usable=r=>['available','qualified'].includes(r?.status);
function log(label,data){console.log('[apparent-depth-feasibility] '+JSON.stringify({label,...data}));}

// All quantities are explicit fixture choices in mm. Unit conversion changes
// the authoring representation, not the physical geometry or source sampling.
function makeDocument(incidenceDeg,{depthMm=120,objectIndex=1.5,observerIndex=1,
  normalDeg=0,sourceSide=-1,originMm={x:0,y:0},observerDistanceMm=100,
  detectorLengthMm=2000,detectorTangentMm=0,partialReflection=true,lengthUnit='mm',
  reverseOrder=false}={}){
  assert.ok([-1,1].includes(sourceSide));
  const n=interfaceNormal({normalDeg}),t={x:-n.y,y:n.x},a=incidenceDeg*RAD;
  const toward=-sourceSide;
  const direction={x:toward*Math.cos(a)*n.x+Math.sin(a)*t.x,
    y:toward*Math.cos(a)*n.y+Math.sin(a)*t.y};
  const scale={mm:1,cm:10,m:1000}[lengthUnit];assert.ok(scale);
  const point=(normalDistance,tangentDistance=0)=>({
    x:(originMm.x+normalDistance*n.x+tangentDistance*t.x)/scale,
    y:(originMm.y+normalDistance*n.y+tangentDistance*t.y)/scale});
  const components=[
    {id:'S1',type:'point-source',parameters:{...point(sourceSide*depthMm),brightness:1},
      emission:{mode:'single-ray',directionDeg:Math.atan2(direction.y,direction.x)/RAD}},
    {id:'I1',type:'planar-interface',parameters:{...point(0),normalDeg,
      negativeIndex:sourceSide<0?objectIndex:observerIndex,
      positiveIndex:sourceSide<0?observerIndex:objectIndex,partialReflection}},
    {id:'D1',type:'ray-detector',parameters:{...point(toward*observerDistanceMm,detectorTangentMm),
      length:detectorLengthMm/scale,orientationDeg:wrap(normalDeg+90)}}
  ];
  if(reverseOrder)components.reverse();
  const request={lengthUnit,title:'Research only: one-plane apparent-depth ray pair',components};
  const original=structuredClone(request),doc=prepareScene(request).document;
  assert.deepEqual(request,original);assert.equal(doc.schemaVersion,5);
  assert.equal(doc.upstreamCommit,UPSTREAM);validate(doc);return doc;
}
async function run(label,incidenceDeg,options={},mutate=null){
  const doc=makeDocument(incidenceDeg,options);if(mutate)mutate(doc);validate(doc);
  const before=serializeSave(doc),execution=evaluateDocument(doc,core,REQUESTS);
  assert.equal(serializeSave(doc),before);
  const readings=(await evaluateObservables(doc,REQUESTS,execution.summary)).results;
  log(label,{canonicalSha256:execution.summary.canonicalSha256,
    source:component(doc,'point-source'),boundary:component(doc,'planar-interface'),
    detector:component(doc,'ray-detector'),simulation:doc.simulation,native:execution.summary.native,
    sourceEvidence:execution.summary.observations?.emissionsById??null,
    interfaceEvidence:execution.summary.observations?.interfacesById??null,readings});
  return {doc,execution};
}
function scoped(doc){
  const c=doc?.physics?.components;
  return doc?.schemaVersion===5&&c?.length===3&&
    ['point-source','planar-interface','ray-detector'].every(t=>c.filter(x=>x.type===t).length===1)&&
    component(doc,'point-source').id==='S1'&&component(doc,'point-source').emission.mode==='single-ray'&&
    component(doc,'planar-interface').id==='I1'&&component(doc,'ray-detector').id==='D1';
}
function family(doc){
  const physics=structuredClone(doc.physics);
  physics.components.sort((a,b)=>a.id.localeCompare(b.id));
  delete physics.components.find(c=>c.type==='point-source').emission.directionDeg;
  return JSON.stringify({physics,simulation:doc.simulation,upstream:doc.upstreamCommit});
}
// These cutoffs are deliberately visible TEST-HARNESS heuristics, not a
// certified uncertainty bound, a native solver tolerance or a product policy.
const MIN_LINE_SINE=1e-6;
const LINE_RESIDUAL_MM=1e-6;
async function backprojectPair(records){
  const base={method:'test-only-native-exit-line-backprojection',
    interpretation:'pairwise 2D backward intersection; not a physical image, eye or pupil model'};
  const unavailable=reason=>({...base,status:'unavailable',reason,value:null});
  if(records.length!==2)return unavailable('EXACTLY_TWO_EXPLICIT_RUNS_REQUIRED');
  if(records.some(r=>!scoped(r.doc)))return unavailable('OUTSIDE_ONE_PLANE_RESEARCH_SCOPE');
  if(family(records[0].doc)!==family(records[1].doc))return unavailable('INCOMPATIBLE_EXPERIMENTS');
  if(component(records[0].doc,'point-source').emission.directionDeg===
    component(records[1].doc,'point-source').emission.directionDeg)
    return unavailable('DUPLICATE_AUTHORED_DIRECTION');
  const hits=[];
  for(const r of records){
    if(r.execution?.summary?.native?.status!=='completed'||!r.execution.summary.executionPassed)
      return unavailable('NATIVE_NOT_COMPLETE');
    // Re-evaluate against the actual document hash. Never accept cached values
    // from a different scene or manufacture a source ID on a hit event.
    const values=(await evaluateObservables(r.doc,REQUESTS,r.execution.summary)).results;
    if(values.some(v=>!usable(v)))return unavailable('UNQUALIFIED_OR_STALE_HIT_EVIDENCE');
    const obs=r.execution.summary.observations;
    if(obs.emissionsById?.S1?.emitted!==1||obs.interfacesById?.I1?.interactions!==1)
      return unavailable('NOT_ONE_SOURCE_ONE_BOUNDARY_ENCOUNTER');
    if(values[0].value.length!==1||values[1].value!==1)
      return unavailable('NO_SINGLE_TRANSMITTED_DETECTOR_PATH');
    const h=values[0].value[0],event=obs.interfacesById.I1.first;
    const transmitted=event?.branches?.filter(b=>b.kind==='transmitted')??[];
    if(event?.outcome!=='transmission'||transmitted.length!==1)
      return unavailable('NO_UNAMBIGUOUS_TRANSMITTED_BRANCH');
    const normal=interfaceNormal(component(r.doc,'planar-interface').parameters);
    const side=Math.sign(signedSide(component(r.doc,'planar-interface').parameters,
      component(r.doc,'point-source').parameters));
    if(dot(h.incomingUnit,normal)*side>=0||
      Math.hypot(h.incomingUnit.x-transmitted[0].direction.x,
        h.incomingUnit.y-transmitted[0].direction.y)>1e-8)
      return unavailable('DETECTOR_DIRECTION_NOT_OUTGOING_TRANSMISSION');
    hits.push(h);
  }
  const [a,b]=hits,d1=a.incomingUnit,d2=b.incomingUnit,det=cross(d1,d2);
  if(!Number.isFinite(det)||Math.abs(det)<=MIN_LINE_SINE)
    return unavailable('NEAR_PARALLEL_BACKPROJECTIONS');
  const delta=subtract(b.pointMm,a.pointMm);
  const alongA=cross(delta,d2)/det,alongB=cross(delta,d1)/det;
  const point={x:a.pointMm.x+alongA*d1.x,y:a.pointMm.y+alongA*d1.y};
  const other={x:b.pointMm.x+alongB*d2.x,y:b.pointMm.y+alongB*d2.y};
  if(![point.x,point.y,alongA,alongB].every(Number.isFinite)||
    Math.hypot(point.x-other.x,point.y-other.y)>LINE_RESIDUAL_MM)
    return unavailable('NONFINITE_OR_INCONSISTENT_LINE_INTERSECTION');
  const plane=component(records[0].doc,'planar-interface').parameters;
  const source=component(records[0].doc,'point-source').parameters;
  if(alongA>=0||alongB>=0||signedSide(plane,point)*signedSide(plane,source)<=0)
    return unavailable('NOT_A_BACKWARD_OBJECT_SIDE_INTERSECTION');
  return {...base,status:'available',reason:null,value:{pointMm:point,
    normalDepthMm:Math.abs(signedSide(plane,point)),lineSine:Math.abs(det),
    backwardDistancesMm:[-alongA,-alongB]},
    canonicalSha256:records.map(r=>r.execution.summary.canonicalSha256)};
}
async function pair(label,angles,options={}){
  const records=[];for(const a of angles)records.push(await run(label+':'+a,a,options));
  const value=await backprojectPair(records);log(label+':backprojection',value);
  return {records,result:value};
}
// Independent scalar reference for a symmetric +-theta pair at x=0. This is
// never an input to native propagation. At theta=0 a single collinear path
// cannot determine depth; only the separately stated paraxial limit exists.
function symmetricReference(theta,depth=120,nObject=1.5,nObserver=1){
  const a=theta*RAD,b=Math.asin(nObject/nObserver*Math.sin(a));
  return depth*Math.tan(a)/Math.tan(b);
}
function requireComplete(records){
  for(const r of records){assert.equal(r.execution.summary.native.status,'completed');
    assert.equal(r.execution.summary.executionPassed,true);
    assert.equal(r.execution.summary.native.truncation,0);
    assert.equal(r.execution.summary.native.undefinedBehavior,0);}
}

test('research: actual native paired exits converge toward, not identically to, the paraxial depth',async()=>{
  let previous=Infinity;
  for(const theta of [5,1,.1]){
    const {records,result}=await pair('near-normal-'+theta,[-theta,theta]);requireComplete(records);
    assert.equal(result.status,'available');close(result.value.normalDepthMm,symmetricReference(theta));
    close(result.value.pointMm.y,0);close(result.value.pointMm.x,-result.value.normalDepthMm);
    const error=Math.abs(result.value.normalDepthMm-80);assert.ok(error<previous);previous=error;
  }
  assert.ok(previous<.001&&previous>1e-6);
});

test('research: finite-angle and neighboring oblique pairs do not define one stigmatic image',async()=>{
  const symmetric=await pair('finite-angle-30',[-30,30]);requireComplete(symmetric.records);
  assert.equal(symmetric.result.status,'available');
  close(symmetric.result.value.normalDepthMm,symmetricReference(30));
  assert.ok(Math.abs(symmetric.result.value.normalDepthMm-80)>10);
  const records=[];for(const a of [20,21,22])records.push(await run('oblique-'+a,a));
  requireComplete(records);
  const intersections=[];
  for(const [i,j] of [[0,1],[1,2],[0,2]]){
    const result=await backprojectPair([records[i],records[j]]);assert.equal(result.status,'available');
    const angles=[20,21,22],a=angles[i]*RAD,b=angles[j]*RAD;
    const mA=Math.tan(Math.asin(1.5*Math.sin(a))),mB=Math.tan(Math.asin(1.5*Math.sin(b)));
    const x=120*(Math.tan(b)-Math.tan(a))/(mA-mB),y=120*Math.tan(a)+mA*x;
    close(result.value.pointMm.x,x);close(result.value.pointMm.y,y);
    intersections.push(result.value.pointMm);log('oblique-pair-'+i+'-'+j,result);
  }
  const spread=Math.hypot(intersections[0].x-intersections[1].x,intersections[0].y-intersections[1].y);
  assert.ok(spread>1);log('three-rays-not-one-image',{pairwiseSpreadMm:spread,
    singleImage:{status:'unavailable',value:null,reason:'NONCONCURRENT_NATIVE_EXIT_LINES'}});
});

test('research: mirrored travel, rotated normals, translations, units and component order preserve depth',async()=>{
  const options=[{sourceSide:1},{normalDeg:180},{normalDeg:-180},
    {normalDeg:90},{normalDeg:37,originMm:{x:247,y:-83}},
    {normalDeg:-37,sourceSide:1,originMm:{x:-153,y:71}},
    {lengthUnit:'cm',reverseOrder:true},{lengthUnit:'m'}];
  for(const [i,o] of options.entries()){
    const {records,result}=await pair('coordinate-control-'+i,[-5,5],o);requireComplete(records);
    assert.equal(result.status,'available');const depth=symmetricReference(5);
    close(result.value.normalDepthMm,depth);
    const n=interfaceNormal({normalDeg:o.normalDeg??0}),origin=o.originMm??{x:0,y:0},side=o.sourceSide??-1;
    close(result.value.pointMm.x,origin.x+side*depth*n.x);
    close(result.value.pointMm.y,origin.y+side*depth*n.y);
  }
});

test('research: equal indices return the real source; low-to-high-index viewing reverses the depth shift',async()=>{
  for(const [nObject,nObserver] of [[1,1],[1.5,1.5],[1,1.5],[2,1.33]]){
    const {records,result}=await pair('indices-'+nObject+'-'+nObserver,[-10,10],
      {objectIndex:nObject,observerIndex:nObserver});requireComplete(records);
    assert.equal(result.status,'available');close(result.value.normalDepthMm,symmetricReference(10,120,nObject,nObserver));
    if(nObject===nObserver)close(result.value.normalDepthMm,120);
    if(nObject<nObserver)assert.ok(result.value.normalDepthMm>120);
  }
});

test('research: detector distance and explicit Fresnel policy do not manufacture the virtual intersection',async()=>{
  const results=[];
  for(const o of [{observerDistanceMm:50},{observerDistanceMm:150},{partialReflection:false}]){
    const p=await pair('detector-policy-'+JSON.stringify(o),[-10,10],o);requireComplete(p.records);
    assert.equal(p.result.status,'available');results.push(p.result.value.pointMm);
    const r=p.records[0],readings=(await evaluateObservables(r.doc,REQUESTS,r.execution.summary)).results;
    assert.equal(readings[0].status,o.partialReflection===false?'qualified':'available');
  }
  for(const p of results){close(p.x,-symmetricReference(10));close(p.y,0);}
});

test('research: TIR and a finite detector miss preserve empty measured events, not an apparent point',async()=>{
  for(const [label,angles,o,outcome] of [
    ['TIR',[-50,50],{},'total-internal-reflection'],
    ['finite-detector-miss',[-30,30],{detectorLengthMm:10},'transmission']]){
    const {records,result}=await pair(label,angles,o);requireComplete(records);
    assert.equal(result.status,'unavailable');assert.equal(result.value,null);
    assert.equal(result.reason,'NO_SINGLE_TRANSMITTED_DETECTOR_PATH');
    for(const r of records){const values=(await evaluateObservables(r.doc,REQUESTS,r.execution.summary)).results;
      assert.deepEqual(values[0].value,[]);assert.equal(values[1].value,0);
      assert.equal(r.execution.summary.observations.interfacesById.I1.first.outcome,outcome);}
  }
});

test('research: native just-below/above-critical decisions are retained without exact-critical certification',async()=>{
  const critical=Math.asin(1/1.5)/RAD;
  for(const delta of [-1e-5,1e-5]){
    const theta=critical+delta;
    const {records,result}=await pair('critical-offset-'+delta,[-theta,theta],
      {observerDistanceMm:1,detectorLengthMm:8000});requireComplete(records);
    if(delta<0){assert.equal(result.status,'available');close(result.value.normalDepthMm,symmetricReference(theta),1e-5);}
    else {assert.equal(result.status,'unavailable');assert.equal(result.value,null);
      assert.ok(records.every(r=>r.execution.summary.observations.interfacesById.I1.first.outcome==='total-internal-reflection'));}
  }
});

test('research: missing, duplicate and nearly parallel paths are not converted into finite depth',async()=>{
  const one=await run('single-normal-path',0);requireComplete([one]);
  assert.equal((await backprojectPair([one])).reason,'EXACTLY_TWO_EXPLICIT_RUNS_REQUIRED');
  assert.equal((await backprojectPair([one,one])).reason,'DUPLICATE_AUTHORED_DIRECTION');
  const {records,result}=await pair('near-parallel',[-1e-6,1e-6]);requireComplete(records);
  assert.equal(result.reason,'NEAR_PARALLEL_BACKPROJECTIONS');assert.equal(result.value,null);
});

test('research: incomplete execution and stale/missing opt-in evidence cannot authorize backprojections',async()=>{
  const shallow=[];for(const angle of [-5,5])shallow.push(await run('depth-zero-'+angle,angle,{},d=>{d.simulation.maxRayDepth=0;}));
  for(const r of shallow){assert.equal(r.execution.summary.native.status,'incomplete');
    assert.equal(r.execution.summary.observations,null);
    const readings=(await evaluateObservables(r.doc,REQUESTS,r.execution.summary)).results;
    assert.ok(readings.every(x=>x.status==='suppressed'&&x.value===null));}
  assert.equal((await backprojectPair(shallow)).reason,'NATIVE_NOT_COMPLETE');
  const good=await pair('fresh-evidence',[-5,5]);assert.equal(good.result.status,'available');
  const stale=structuredClone(good.records[0]);component(stale.doc,'point-source').emission.directionDeg=-6;validate(stale.doc);
  assert.equal((await backprojectPair([stale,good.records[1]])).reason,'UNQUALIFIED_OR_STALE_HIT_EVIDENCE');
  const uncaptured={doc:good.records[0].doc,execution:evaluateDocument(good.records[0].doc,core)};
  assert.equal((await backprojectPair([uncaptured,good.records[1]])).reason,'UNQUALIFIED_OR_STALE_HIT_EVIDENCE');
});

test('research: mismatched source/material experiments and multiple boundaries are outside the paired probe',async()=>{
  const a=await run('family-base',-5),b=await run('family-other-source',5,{depthMm:121});
  assert.equal((await backprojectPair([a,b])).reason,'INCOMPATIBLE_EXPERIMENTS');
  const c=await run('family-other-medium',5,{objectIndex:1.6});
  assert.equal((await backprojectPair([a,c])).reason,'INCOMPATIBLE_EXPERIMENTS');
  const extra=makeDocument(5);extra.physics.components.push({id:'I2',type:'planar-interface',
    parameters:{x:40,y:0,normalDeg:0,negativeIndex:1,positiveIndex:1.5,partialReflection:true}});
  validate(extra); // Existing v5 admission is unchanged; this HARNESS declines it.
  assert.equal((await backprojectPair([a,{doc:extra,execution:null}])).reason,'OUTSIDE_ONE_PLANE_RESEARCH_SCOPE');
});

test('research: opt-in detector capture leaves native source, branch, counter and document evidence unchanged',async()=>{
  const doc=makeDocument(25),before=serializeSave(doc);
  const plain=evaluateDocument(doc,core),captured=evaluateDocument(doc,core,REQUESTS);
  assert.equal(serializeSave(doc),before);assert.deepEqual(captured.summary.native,plain.summary.native);
  assert.equal(captured.summary.native.status,'completed');
  for(const key of NATIVE_OBSERVATION_KEYS)
    assert.deepEqual(captured.summary.observations[key],plain.summary.observations[key]);
  assert.equal(Object.hasOwn(plain.summary.observations,'detectorHitEventsById'),false);
  const values=(await evaluateObservables(doc,REQUESTS,captured.summary)).results;
  assert.equal(values[0].value.length,1);
  assert.deepEqual(Object.keys(values[0].value[0]).sort(),['distanceFromP1Mm','incomingUnit','pointMm']);
});
