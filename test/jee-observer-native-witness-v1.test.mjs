// Real pinned-PhyDemo sampled-arrival witness tests, independent from the
// analytical query's conditional status. The observed detector point MUST be
// from native, not a re-labelled predicted crossing or a virtual image.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {runObserverNativeWitness,nativeObserverWitnessCapabilities}
 from '../scripts/jee-observer-native-witness.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const query=()=>({format:'opticsim-planar-observer-point-query-v1',
 kind:'source-to-observer-transmission',lengthUnit:'mm',
 source:{x:-60,y:0},observer:{x:100,y:40},
 interface:{x:0,y:0,normalDeg:0,sourceIndex:1.5,observerIndex:1}});
const witness=()=>({format:'opticsim-observer-native-witness-v1',
 analyticalQuery:query(),physicalVerification:{
 sourceBrightness:1,partialReflection:false,runPolicy:'preview-v1',
 detector:{alignment:'tangent-to-interface',lengthMm:20},
 arrivalToleranceMm:1e-5,directionTolerance:1e-7}});
const output=()=>resolve('test-artifacts/llm-authoring/observer-witness-'+randomUUID());
const inputBytes=obj=>Buffer.from(JSON.stringify(obj,null,2)+'\n');
const nativeExecutor=(scene,requests)=>evaluateDocument(scene,core,requests).summary;
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=t,`Actual ${a} != expected ${b} within ${t}`);

test('explicit native witness verifies ONE measured detector hit, not analytical image detection',async()=>{
 const authored=witness(),snapshot=structuredClone(authored);
 const bytes=inputBytes(authored),dir=output();
 const r=await runObserverNativeWitness({requestBytes:bytes,outputPath:dir,
  executeNative:nativeExecutor});
 assert.equal(r.status,'verified-sampled-arrival');
 assert.equal(r.exitCode,0);
 assert.deepEqual(authored,snapshot);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),bytes);
 assert.equal(r.report.originalInputSha256,
  createHash('sha256').update(bytes).digest('hex'));
 assert.equal(r.report.actualNativeResult.method,'actual-native-single-ray-detector-hit');
 assert.equal(r.report.actualNativeResult.native.status,'completed');
 assert.equal(r.report.actualNativeResult.native.executionPassed,true);
 assert.equal(r.report.actualNativeResult.native.nativeImageDetected,false);
 assert.equal(r.report.analyticalResult.native.status,'not-run');
 assert.equal(r.report.analyticalResult.value.crossingIsNativeHit,false);
 assert.equal(r.report.actualNativeResult.arrivalWithinDeclaredTolerance,true);
 assert.equal(r.report.actualNativeResult.directionWithinDeclaredTolerance,true);
 near(r.report.actualNativeResult.actualDetectorHit.x,100,1e-5);
 near(r.report.actualNativeResult.actualDetectorHit.y,40,1e-5);
 assert.ok(r.report.actualNativeResult.warnings.some(x=>/omits Fresnel/.test(x)));
 assert.ok(r.report.actualReadings.every(x=>['available','qualified'].includes(x.status)));
 assert.ok(r.report.actualReadings.find(x=>x.id==='hits').value.length===1);
 assert.ok(existsSync(resolve(dir,'scene.ray-optics-2d.json')));
 const scene=JSON.parse(readFileSync(resolve(dir,'scene.ray-optics-2d.json')));
 assert.equal(scene.schemaVersion,5);
 assert.equal(scene.simulation.maxRayDepth,8);
 assert.equal(scene.physics.components.length,3);
 assert.equal(scene.physics.components.find(x=>x.id==='S1').emission.mode,'single-ray');
 assert.equal(scene.physics.components.find(x=>x.id==='I1').parameters.partialReflection,false);
 const analytic=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(analytic.native.status,'not-run');
 assert.equal(analytic.originalInputSha256,r.report.originalInputSha256);
 const report=JSON.parse(readFileSync(resolve(dir,'report.json')));
 assert.equal(report.status,r.status);
 console.log('JEE_OBSERVER_NATIVE_WITNESS '+JSON.stringify({
  nativeStatus:r.report.native.status,hit:r.report.actualNativeResult.actualDetectorHit,
  arrivalErrorMm:r.report.actualNativeResult.arrivalErrorMm,
  nativeImageDetected:false,realNativeSingleRay:true
 }));
});
test('mirror-symmetric true native single rays qualify separately with correct outgoing signs',async()=>{
 for(const y of [-40,40]){
  const x=witness();x.analyticalQuery.observer.y=y;
  const r=await runObserverNativeWitness({requestBytes:inputBytes(x),
   outputPath:output(),executeNative:nativeExecutor});
  assert.equal(r.status,'verified-sampled-arrival');
  near(r.report.actualNativeResult.actualDetectorHit.y,y,1e-5);
  assert.ok(r.report.actualNativeResult.actualIncomingDirection.y*y>0);
 }
});
// Deliberately SYNTHETIC complete event summaries, injected into the test
// executor to exercise the witness's classification of genuinely *available*
// native zeros. They are NOT independent native no-hit runs or source traces.
function syntheticZeroExecution({noInterface=false,noEmission=false,
  brokenHitCount=false,contradictoryFirst=false}={}){
 return (scene,requests)=>{
  const summary=structuredClone(nativeExecutor(scene,requests));
  assert.equal(summary.native.status,'completed');
  const o=summary.observations;
  o.detectorsById.D1.crossings=0;
  o.detectorHitEventsById.D1.observedCount=0;
  o.detectorHitEventsById.D1.events=brokenHitCount?[
   {pointMm:{x:100,y:40},incomingUnit:{x:1,y:0},distanceFromP1Mm:10}
  ]:[];
  if(noInterface){
   o.interfacesById.I1.interactions=0;
   o.interfacesById.I1.transmitted=0;
   o.interfacesById.I1.reflected=0;
   o.interfacesById.I1.totalInternalReflections=0;
   if(!contradictoryFirst)o.interfacesById.I1.first=null;
  }
  if(noEmission)o.emissionsById.S1.emitted=0;
  return summary;
 };
}
test('R2 P1: complete measured zero detector crossing with one transmitted interface event is an observed negative',async()=>{
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(witness()),outputPath:output(),
  executeNative:syntheticZeroExecution()});
 assert.equal(r.status,'native-observed-no-crossing');
 assert.equal(r.exitCode,0);
 const observed=r.report.actualNativeResult;
 assert.equal(observed.reasonCode,'MEASURED_ZERO_DETECTOR_CROSSINGS');
 assert.equal(observed.method,'native-detector-zero-crossing-observation');
 assert.equal(observed.observedEmissions,1);
 assert.equal(observed.observedDetectorCrossings,0);
 assert.equal(observed.observedInterfaceInteractions,1);
 assert.equal(observed.native.status,'completed');
 assert.equal(observed.actualDetectorHit,null);
 assert.equal(observed.actualIncomingDirection,null);
 assert.equal(observed.arrivalErrorMm,null);
 assert.equal(observed.arrivalWithinDeclaredTolerance,false);
 assert.equal(observed.nativeImageDetected,false);
 assert.match(observed.reason,/does not prove invisibility/);
 assert.ok(observed.warnings.some(x=>/omits Fresnel/.test(x)));
 const by=Object.fromEntries(r.report.actualReadings.map(v=>[v.id,v]));
 assert.equal(by.crossings.status,'qualified');
 assert.equal(by.crossings.value,0);
 assert.equal(by.hits.status,'qualified');
 assert.deepEqual(by.hits.value,[]);
 assert.equal(by.first.status,'qualified');
 assert.equal(by.first.method,'native-observation');
 console.log('JEE_OBSERVER_NATIVE_ZERO_CLASSIFICATION '+JSON.stringify({
  syntheticCompleteEventSummary:true,
  observedCrossings:0,observedInteractions:1,
  status:r.status,nativeImageDetected:false
 }));
});
test('R2 P1: no native interface encounter has no first event yet detector zero is still an observed negative',async()=>{
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(witness()),outputPath:output(),
  executeNative:syntheticZeroExecution({noInterface:true})});
 assert.equal(r.status,'native-observed-no-crossing');
 assert.equal(r.exitCode,0);
 assert.equal(r.report.actualNativeResult.observedInterfaceInteractions,0);
 const by=Object.fromEntries(r.report.actualReadings.map(v=>[v.id,v]));
 assert.equal(by.encounters.status,'qualified');
 assert.equal(by.encounters.value,0);
 assert.equal(by.first.status,'unavailable');
 assert.equal(by.first.value,null);
 assert.equal(by.crossings.value,0);
 assert.deepEqual(by.hits.value,[]);
 assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
});
// Adversarial event shapes are injected into an otherwise complete,
// hash-matched test summary. They are NOT native events observed by PhyDemo.
function tamperedNativeEvent(mutate,{zero=true}={}){
 return (scene,requests)=>{
  const summary=zero?syntheticZeroExecution()(scene,requests):
    structuredClone(nativeExecutor(scene,requests));
  const meter=summary.observations.interfacesById.I1;
  mutate(meter);
  return summary;
 };
}
test('R3 P1 pre-review matrix: contradictory or incomplete first interface transmission never qualifies a measured zero',async()=>{
 const cases=[
  ['no transmitted branch',m=>{m.first.branches=[];m.transmitted=0;}],
  ['missing transmitted branch despite counter',m=>{m.first.branches=[];}],
  ['transmitted count contradicts first',m=>{m.transmitted=0;}],
  ['TIR but claimed transmitted',m=>{m.first.outcome='total-internal-reflection';}],
  ['reflected-only first event',m=>{m.first.outcome='no-transmitted-primary';}],
  ['missing incoming angle',m=>{m.first.incidentAngleDeg=null;}],
  ['nonfinite incoming angle',m=>{m.first.incidentAngleDeg=Infinity;}],
  ['missing refracted angle',m=>{m.first.transmittedAngleDeg=null;}],
  ['NaN outgoing unit',m=>{m.first.branches[0].direction.x=NaN;}],
  ['not a unit direction',m=>{m.first.branches[0].direction={x:2,y:0};}],
  ['nonfinite branch angle',m=>{m.first.branches[0].angleDeg=Infinity;}],
  ['transmitted direction points back into source medium',m=>{
    const dir=m.first.branches[0].direction;
    m.first.branches[0].direction={x:-dir.x,y:dir.y};
  }],
  ['transmitted direction geometry contradicts angle',m=>{
    m.first.branches[0].direction={x:1,y:0};
  }],
  ['transmission branch angle disagrees with first',m=>{m.first.transmittedAngleDeg+=.4;}],
  ['outcome is not transmission',m=>{m.first.outcome='grazing';}],
  ['incorrect incoming medium side',m=>{m.first.from='positive';}],
  ['Fresnel policy contradicts scene',m=>{m.first.partialReflection=true;}],
  ['reflected branch contradicts Fresnel disabled',m=>{
    m.first.branches.push({...structuredClone(m.first.branches[0]),
      kind:'reflected',angleDeg:5,relativePower:.05});
    m.reflected=1;m.first.reflectedAngleDeg=5;
  }],
  ['bogus reflected counter',m=>{m.reflected=1;}],
  ['bogus TIR counter',m=>{m.totalInternalReflections=1;}],
  ['invalid observation counter',m=>{m.invalidObservations=1;}],
  ['native encounter truncation',m=>{m.first.nativeTruncation=1;}]
 ];
 for(const [name,mutate] of cases){
  const r=await runObserverNativeWitness({
   requestBytes:inputBytes(witness()),outputPath:output(),
   executeNative:tamperedNativeEvent(mutate)});
  assert.equal(r.status,'native-evidence-unavailable',name);
  assert.equal(r.exitCode,2,name);
  assert.equal(r.report.actualNativeResult.reasonCode,
   'UNQUALIFIED_NATIVE_INTERFACE_EVIDENCE',name);
  assert.equal(r.report.actualNativeResult.actualDetectorHit,null,name);
  assert.equal(r.report.actualNativeResult.arrivalWithinDeclaredTolerance,false,name);
 }
 console.log('JEE_OBSERVER_NATIVE_EVENT_INTEGRITY_MATRIX '+JSON.stringify({
  syntheticCompleteRecordMutations:cases.length,
  allWithheld:true,actualNativeRerunOfMutations:false
 }));
});
test('R3 zero native hit cannot qualify a well-formed but analytically contradictory first event',async()=>{
 for(const mutate of [
  m=>{m.first.incidentAngleDeg+=.001;},
  m=>{m.first.transmittedAngleDeg+=.001;
    m.first.branches[0].angleDeg=m.first.transmittedAngleDeg;
    const a=m.first.transmittedAngleDeg*Math.PI/180;
    m.first.branches[0].direction={x:Math.cos(a),y:Math.sin(a)};},
 ]){
  const r=await runObserverNativeWitness({
   requestBytes:inputBytes(witness()),outputPath:output(),
   executeNative:tamperedNativeEvent(mutate)});
  assert.equal(r.status,'native-evidence-unavailable');
  assert.equal(r.exitCode,2);
  assert.equal(r.report.actualNativeResult.reasonCode,'UNQUALIFIED_NATIVE_INTERFACE_EVIDENCE');
  assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
 }
});
test('R3 full-Fresnel native reflected branch must point back toward source medium',async()=>{
 const input=witness();input.physicalVerification.partialReflection=true;
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(input),outputPath:output(),
  executeNative:(scene,requests)=>{
   const s=syntheticZeroExecution()(scene,requests);
   const m=s.observations.interfacesById.I1;
   const transmitted=m.first.branches.find(b=>b.kind==='transmitted');
   const reflected=m.first.branches.find(b=>b.kind==='reflected');
   assert.ok(transmitted&&reflected);
   reflected.direction={...transmitted.direction};
   reflected.angleDeg=transmitted.angleDeg;
   m.first.reflectedAngleDeg=reflected.angleDeg;
   return s;
  }});
 assert.equal(r.status,'native-evidence-unavailable');
 assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
 assert.equal(r.exitCode,2);
});
test('R3 shared integrity gate also protects a positive detector hit from forged first event',async()=>{
 for(const mutate of [
  m=>{m.first.branches=[];m.transmitted=0;},
  m=>{m.first.transmittedAngleDeg=Infinity;},
  m=>{m.first.branches[0].direction.y=NaN;}
 ]){
  const r=await runObserverNativeWitness({
   requestBytes:inputBytes(witness()),outputPath:output(),
   executeNative:tamperedNativeEvent(mutate,{zero:false})});
  assert.equal(r.status,'native-evidence-unavailable');
  assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
  assert.equal(r.exitCode,2);
 }
});
test('R3 legitimate full native Fresnel transmission+reflection remains admitted for actual arrival and classified zero',async()=>{
 const req=witness();req.physicalVerification.partialReflection=true;
 const real=await runObserverNativeWitness({
  requestBytes:inputBytes(req),outputPath:output(),
  executeNative:nativeExecutor});
 assert.equal(real.status,'verified-sampled-arrival');
 assert.equal(real.exitCode,0);
 const observed=Object.fromEntries(real.report.actualReadings.map(r=>[r.id,r]));
 assert.equal(observed.encounters.value,1);
 assert.equal(observed.first.value.outcome,'transmission');
 assert.equal(observed.first.value.partialReflection,true);
 const branches=observed.first.value.branches;
 assert.equal(branches.filter(b=>b.kind==='transmitted').length,1);
 assert.equal(branches.filter(b=>b.kind==='reflected').length,1);
 assert.ok(branches.every(b=>Number.isFinite(b.angleDeg)));
 assert.ok(real.report.actualNativeResult.arrivalWithinDeclaredTolerance);
 const zero=await runObserverNativeWitness({
  requestBytes:inputBytes(req),outputPath:output(),
  executeNative:syntheticZeroExecution()});
 assert.equal(zero.status,'native-observed-no-crossing');
 assert.equal(zero.exitCode,0);
 assert.equal(zero.report.actualNativeResult.observedInterfaceInteractions,1);
 assert.equal(zero.report.actualNativeResult.actualDetectorHit,null);
 console.log('JEE_OBSERVER_NATIVE_FRESNEL_TWO_BRANCH_CONTROL '+JSON.stringify({
  fullFresnelNativeArrival:true,realReflectedBranches:1,
  injectedZeroForClassificationOnly:true,nativeImageDetected:false
 }));
});
test('R2 P1: actual pinned native missed-detector controls show available zero with and without interface interaction',async()=>{
 // These are GENUINE separate native controls with deliberately changed
 // source angles. They are NOT represented as native evidence for the
 // original analytically proposed shooting direction (hashes differ).
 let inspected=false;
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(witness()),outputPath:output(),
  executeNative:async(scene,requests)=>{
   for(const [heading,interactions] of [[30,1],[180,0]]){
    const away=structuredClone(scene);
    away.physics.components.find(x=>x.id==='S1').emission.directionDeg=heading;
    const actual=nativeExecutor(away,requests);
    assert.equal(actual.native.status,'completed');
    assert.equal(actual.executionPassed,true);
    const obs=await evaluateObservables(away,requests,actual);
    const by=Object.fromEntries(obs.results.map(x=>[x.id,x]));
    assert.equal(by.emissions.value,1);
    assert.equal(by.encounters.value,interactions);
    assert.equal(by.crossings.value,0);
    assert.deepEqual(by.hits.value,[]);
    assert.equal(by.hits.method,'native-hit-event-observation');
    assert.ok(['available','qualified'].includes(by.hits.status));
    if(interactions===0){
     assert.equal(by.first.status,'unavailable');
     assert.equal(by.first.value,null);
    }else{
     assert.ok(['available','qualified'].includes(by.first.status));
     assert.equal(by.first.value.outcome,'transmission');
    }
   }
   inspected=true;
   return nativeExecutor(scene,requests);
  }});
 assert.equal(inspected,true);
 assert.equal(r.status,'verified-sampled-arrival'); // original scene unaffected
 console.log('JEE_OBSERVER_NATIVE_REAL_ZERO_CONTROLS '+JSON.stringify({
  separateFullNativeScenes:2,
  cases:['transmitted-ray-misses-detector','ray-misses-interface-and-detector'],
  zeroIsAvailable:true,
  notSourceSceneEvidence:true
 }));
});
test('R2 P1: inconsistent counts, false first event, zero emission and missing measurement never become observed negatives',async()=>{
 for(const [label,options] of [
  ['zero-emitted',{noEmission:true}],
  ['hit-list-mismatch',{brokenHitCount:true}],
  ['unphysical-first',{noInterface:true,contradictoryFirst:true}]
 ]){
  const r=await runObserverNativeWitness({
   requestBytes:inputBytes(witness()),outputPath:output(),
   executeNative:syntheticZeroExecution(options)});
  assert.equal(r.status,'native-evidence-unavailable',label);
  assert.equal(r.exitCode,2,label);
  assert.equal(r.report.actualNativeResult.actualDetectorHit,null,label);
  assert.equal(r.report.actualNativeResult.arrivalWithinDeclaredTolerance,false,label);
 }
});
test('R2 N1: angle-only native first-event mismatch has a dedicated reason, not a user tolerance failure',async()=>{
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(witness()),outputPath:output(),
  executeNative:(scene,requests)=>{
   const summary=structuredClone(nativeExecutor(scene,requests));
   summary.observations.interfacesById.I1.first.incidentAngleDeg+=.001;
   return summary;
  }});
 assert.equal(r.status,'measured-miss');
 assert.equal(r.exitCode,2);
 assert.equal(r.report.actualNativeResult.reasonCode,'NATIVE_FIRST_EVENT_ANGLE_MISMATCH');
 assert.equal(r.report.actualNativeResult.arrivalWithinDeclaredTolerance,true);
 assert.equal(r.report.actualNativeResult.directionWithinDeclaredTolerance,true);
 assert.equal(r.report.actualNativeResult.angleErrorWithinFixedTolerance,false);
});
test('numerically withheld incoming grazing does not author or execute a native ray',async()=>{
 const x=witness();
 Object.assign(x.analyticalQuery.interface,{normalDeg:135,sourceIndex:1,observerIndex:2});
 x.analyticalQuery.source={x:9758.080722152847,y:9758.066438595866};
 x.analyticalQuery.observer={x:-9616.652224137046,y:-9475.230867899736};
 let calls=0;const dir=output();
 const r=await runObserverNativeWitness({requestBytes:inputBytes(x),
  outputPath:dir,executeNative:()=>{calls++;throw Error('No execution permitted');}});
 assert.equal(r.status,'analysis-unqualified');
 assert.equal(r.report.analyticalResult.status,'numerically-unstable');
 assert.equal(r.report.analyticalResult.reasonCode,'NEAR_GRAZING_INGRESS');
 assert.equal(r.report.native.status,'not-run');
 assert.equal(calls,0);
 assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
 assert.equal(existsSync(resolve(dir,'analytical-result.json')),true);
});
test('world rounding invalidates native authoring while retaining the separate mathematical evidence',async()=>{
 const x=witness();
 x.analyticalQuery.source={x:-.02,y:9000};
 x.analyticalQuery.observer={x:.02,y:9000.01};
 let calls=0;const r=await runObserverNativeWitness({
  requestBytes:inputBytes(x),outputPath:output(),
  executeNative:()=>{calls++;throw Error('must not be called');}});
 assert.equal(r.status,'analysis-unqualified');
 assert.equal(r.report.analyticalResult.reasonCode,'WORLD_COORDINATE_ROUNDING');
 assert.equal(calls,0);
});
test('finite detector endpoints outside world bounds refuse scene before any native execution',async()=>{
 const x=witness();
 x.analyticalQuery.source={x:9980,y:9997};
 x.analyticalQuery.interface.x=9990;
 x.analyticalQuery.observer={x:9995,y:9997};
 let called=0;const dir=output();
 const r=await runObserverNativeWitness({
  requestBytes:inputBytes(x),outputPath:dir,
  executeNative:()=>{called++;throw Error('No native for invalid detector');}});
 assert.equal(r.status,'physical-scene-refused');
 assert.equal(r.report.native.status,'not-run');
 assert.equal(r.report.analyticalResult.status,'conditional');
 assert.equal(called,0);
 assert.equal(existsSync(resolve(dir,'analytical-result.json')),true);
 assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
});
test('incomplete native execution suppresses all requested observed measurements',async()=>{
 const x=witness();
 const r=await runObserverNativeWitness({requestBytes:inputBytes(x),outputPath:output(),
  executeNative:(scene,requests)=>{
   const shallow=structuredClone(scene);shallow.simulation.maxRayDepth=0;
   const summary=nativeExecutor(shallow,requests);
   assert.equal(summary.native.status,'incomplete');
   assert.equal(summary.observations,null);
   return summary;
  }});
 assert.equal(r.status,'native-incomplete');
 assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
 assert.equal(r.report.actualNativeResult.arrivalWithinDeclaredTolerance,false);
 assert.ok(r.report.actualReadings.every(x=>x.status==='suppressed'&&x.value===null));
});
test('hash-mismatched complete native execution cannot be relabelled as a verified observer hit',async()=>{
 const x=witness();
 const r=await runObserverNativeWitness({requestBytes:inputBytes(x),outputPath:output(),
  executeNative:(scene,requests)=>{
   const changed=structuredClone(scene);
   changed.physics.components.find(x=>x.id==='S1').emission.directionDeg+=1;
   return nativeExecutor(changed,requests);
  }});
 assert.equal(r.status,'native-evidence-unavailable');
 assert.equal(r.report.actualNativeResult.reasonCode,'STALE_NATIVE_EVIDENCE');
 assert.equal(r.report.actualNativeResult.actualDetectorHit,null);
 assert.ok(r.report.actualReadings.every(x=>x.status==='suppressed'));
});
test('actual native setup failures never erase saved analytical and prepared canonical scenes',async()=>{
 const dir=output(),x=witness();
 const r=await runObserverNativeWitness({requestBytes:inputBytes(x),outputPath:dir,
  executeNative:()=>{throw Error('Injected native setup fault');}});
 assert.equal(r.status,'native-infrastructure-error');
 assert.equal(r.exitCode,2);
 assert.match(r.report.reason,/Injected native setup fault/);
 assert.equal(r.report.native.status,'failed');
 assert.ok(existsSync(resolve(dir,'analytical-result.json')));
 assert.ok(existsSync(resolve(dir,'scene.ray-optics-2d.json')));
});
test('closed physical-verification input refuses incomplete, invalid or guessed physics',async()=>{
 const edits=[
  x=>delete x.physicalVerification.sourceBrightness,
  x=>delete x.physicalVerification.partialReflection,
  x=>delete x.physicalVerification.runPolicy,
  x=>delete x.physicalVerification.detector,
  x=>delete x.physicalVerification.arrivalToleranceMm,
  x=>delete x.physicalVerification.directionTolerance,
  x=>x.physicalVerification.sourceBrightness=2,
  x=>x.physicalVerification.partialReflection='false',
  x=>x.physicalVerification.runPolicy='guess',
  x=>x.physicalVerification.detector.lengthMm=0,
  x=>x.physicalVerification.detector.lengthMm=300,
  x=>x.physicalVerification.detector.alignment='eye',
  x=>x.physicalVerification.arrivalToleranceMm=1e-9,
  x=>x.physicalVerification.directionTolerance=1,
  x=>x.extra='ignore-this',
  x=>x.physicalVerification.nativeRayRoute=['I1','D1'],
  x=>x.analyticalQuery.observer={x:-100,y:40},
 ];
 for(const edit of edits){
  const x=witness();edit(x);
  let called=false;const dir=output();
  const r=await runObserverNativeWitness({
   requestBytes:inputBytes(x),outputPath:dir,
   executeNative:()=>{called=true;throw Error('unpermitted native');}});
  assert.equal(r.status,'rejected');
  assert.equal(r.report.native.status,'not-run');
  assert.equal(called,false);
  assert.equal(existsSync(resolve(dir,'analytical-result.json')),false);
 }
 const data=inputBytes(witness()),dir=output();
 const a=await runObserverNativeWitness({requestBytes:data,outputPath:dir,
  executeNative:nativeExecutor});
 assert.equal(a.status,'verified-sampled-arrival');
 await assert.rejects(runObserverNativeWitness({requestBytes:data,outputPath:dir,
  executeNative:nativeExecutor}),/exists|already/);
 const invalid=Buffer.from('{"format":}');
 const b=await runObserverNativeWitness({requestBytes:invalid,outputPath:output(),
  executeNative:()=>{throw Error('never');}});
 assert.equal(b.status,'rejected');
 assert.equal(nativeObserverWitnessCapabilities().format,'opticsim-observer-native-witness-v1');
});
