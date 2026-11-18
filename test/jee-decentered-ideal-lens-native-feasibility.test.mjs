// RESEARCH ONLY. J19 (Lens Formula / Problems / 027) requires two thin
// convex lenses, equal f, separation 3f, centre offset d << f, parallel input.
// f=200 mm, d=2 mm and finite beam/lens/detector choices below are DECLARED
// numerical research illustrations, NOT numbers inferred from the source.
//
// Production authoring still REFUSES this composition. We compile an admitted
// one-lens seed, then explicitly construct a different TEST-NATIVE scene by
// translating native lens endpoints and adding another native IdealLens.
// NEVER submit that different scene to public qualification under the seed's
// canonical hash. Raw native configuration and provenance are saved separately.
// No propagated ray/encounter/hit is calculated or changed by this harness.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const PIN='811f508d2b070898c241a568b0c167dcb8645251';
const BASE='8b4ffee3c9deb34fcf7d657221f917fab321de4c';
const SOURCE={archive:'08_Ray_Optics_Explanations.zip',
 archiveSha256:'03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939',
 caseId:'J19',chapter:'07_Lens_Formula',problem:'027',solutionsRead:false};
const near=(a,b,tolerance=1e-6,label='')=>assert.ok(
 Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,
 label+': '+a+' != '+b+' within '+tolerance);
const digest=text=>createHash('sha256').update(text).digest('hex');
const sorted=values=>[...values].sort((a,b)=>a-b);
const span=values=>Math.max(...values)-Math.min(...values);
const vector=ray=>{
 const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,n=Math.hypot(x,y);
 assert.ok(n>0&&Number.isFinite(n),'a real native ray direction is needed');
 return {x:x/n,y:y/n};
};
const settings=(extra={})=>({f1:200,f2:200,separation:600,offset:2,
 centre1:0,width:40,apertureHeight:200,sign:1,reverseHeading:180,
 detectorU:1000,detectorY:4,detectorLength:400,maxRayDepth:8,
 includeSecond:true,...extra});
const seedFor=s=>({lengthUnit:'mm',runPolicy:'preview-v1',
 title:'Admitted one-lens seed ONLY; NOT the native research two-lens apparatus',
 components:[
  {id:'B1',type:'parallel-beam',parameters:{x:-s.sign*s.f1,
    y:s.centre1,width:s.width,directionDeg:s.sign===1?0:s.reverseHeading,brightness:.08}},
  {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:s.f1,
    apertureHeight:s.apertureHeight}},
  {id:'D1',type:'ray-detector',parameters:{x:s.sign*s.detectorU,
    y:s.detectorY,length:s.detectorLength,orientationDeg:90}}
 ]});

// Independent ideal-thin-lens affine reference; never supplied to PhyDemo as
// a ray itinerary, point on a ray, detector output, or optical object.
function reference(s,emittedY){
 const h=emittedY-s.centre1;
 const slope1=-h/s.f1;
 const atSecond=emittedY+s.separation*slope1;
 const outgoing=s.includeSecond?
  slope1-(atSecond-(s.centre1+s.offset))/s.f2:slope1;
 const atDetector=atSecond+(s.detectorU-s.separation)*outgoing;
 return {slope1,atSecond,outgoing,atDetector};
}
function focalReference(s){
 const denominator=s.separation-s.f1-s.f2;
 if(!s.includeSecond||Math.abs(denominator)<1e-10)return null;
 const fromSecond=s.f2*(s.separation-s.f1)/denominator;
 return {x:s.sign*(s.separation+fromSecond),
  y:s.centre1+fromSecond*s.offset/s.f2,fromSecond};
}
function probe(extra={}){
 const s=settings(extra),physical=seedFor(s),physicalBytes=JSON.stringify(physical);
 const doc=prepareScene(physical).document;
 assert.equal(doc.schemaVersion,19);assert.equal(doc.upstreamCommit,PIN);
 doc.simulation.maxRayDepth=s.maxRayDepth;
 const seedBytes=JSON.stringify(doc),compiled=core.compile(doc);
 const native=structuredClone(compiled.native),seedNativeBytes=JSON.stringify(compiled.native);
 const idMap=new Map(compiled.idMap),lens1Index=idMap.get('L1');
 // Native y is DOWN. Native endpoint midpoint is the actual ideal lens
 // centre, independently of its endpoint orientation or incident side.
 const first=native.objs[lens1Index];
 assert.equal(first.type,'IdealLens');
 first.p1.y=-s.centre1-s.apertureHeight/2;
 first.p2.y=-s.centre1+s.apertureHeight/2;
 if(s.includeSecond){
  const c2=s.centre1+s.offset;
  idMap.set('L2-research',native.objs.length);
  native.objs.push({type:'IdealLens',focalLength:s.f2,
   p1:{x:s.sign*s.separation,y:-c2-s.apertureHeight/2},
   p2:{x:s.sign*s.separation,y:-c2+s.apertureHeight/2}});
 }
 const nativeBytes=JSON.stringify(native);
 assert.notEqual(digest(nativeBytes),digest(seedNativeBytes),
  'the two-lens experiment must never pretend to be the one-lens canonical seed');
 const scene=core.loadNative(native),emissions=[],incidents=[];
 const source=scene.objs[idMap.get('B1')],start=source.onSimulationStart;
 let starts=0;
 source.onSimulationStart=function(...args){
  const result=start.apply(this,args);starts++;
  assert.ok(Array.isArray(result.newRays)&&result.newRays.length<=32,
   'bounded actual samples, no clipping or artificial resampling');
  for(const ray of result.newRays)emissions.push({
   pointMm:{x:ray.p1.x,y:-ray.p1.y},incomingUnit:vector(ray)});
  return result;
 };
 const sources=core.observeSourceSet(doc,scene,idMap);
 const mirrors=core.observeMirrorSet(doc,scene,idMap);
 const detectors=core.observeDetectorSet(doc,scene,idMap,{captureHitEvents:true});
 const interfaces=core.observeInterfaceSet(doc,scene,idMap);
 const blockers=core.observeBlockerSet(doc,scene,idMap);
 for(const id of s.includeSecond?['L1','L2-research']:['L1']){
  const obj=scene.objs[idMap.get(id)],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const pointMm={x:args[2].x,y:-args[2].y},incomingUnit=vector(args[0]);
   const result=original.apply(this,args); // exactly ONE actual native call
   assert.ok(incidents.length<128,'bounded research recording without clipping');
   incidents.push({componentId:id,pointMm,incomingUnit,
    outgoingUnit:vector(args[0]),absorbed:result?.isAbsorbed===true});
   return result; // original native response and rays, unchanged
  };
 }
 const simulator=new core.Simulator(scene,null,null,null,null,null,false,
   doc.simulation.processedRayLimit);
 let event=null;
 for(const type of ['simulationComplete','simulationStop'])
  simulator.on(type,()=>{event=type;});
 simulator.updateSimulation();
 assert.ok(event,'no completion claim without an actual native terminal callback');
 const diagnostics=core.diagnostics(scene,simulator,sources,mirrors,detectors,
  interfaces,blockers,{detectorHitEvents:true,nativeEvent:event});
 const status=core.classifyRun(event,diagnostics);
 assert.equal(starts,1);
 assert.equal(JSON.stringify(native),nativeBytes,'native input object was not mutated');
 assert.equal(JSON.stringify(doc),seedBytes,'seed canonical document stays unchanged');
 assert.equal(JSON.stringify(physical),physicalBytes,'physical seed is unchanged');
 assert.equal(diagnostics.emissionsById.B1.emitted,emissions.length);
 return {s,doc,native,event,status,diagnostics,emissions,incidents,
  nativeInputSha256:digest(nativeBytes),seedOnlySha256:digest(seedBytes)};
}
function complete(r){
 assert.equal(r.event,'simulationComplete');assert.equal(r.status,'completed');
 assert.deepEqual(r.diagnostics.errors,[]);
 assert.equal(r.diagnostics.truncation,0);assert.equal(r.diagnostics.undefinedBehavior,0);
 assert.equal(r.diagnostics.detectorHitEventsById.D1.status,'complete');
 near(r.diagnostics.emissionsById.B1.brightnessScale,1);
 assert.equal(r.emissions.length,r.s.width*.2);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,r.emissions.length);
 assert.equal(r.diagnostics.detectorHitEventsById.D1.events.length,r.emissions.length);
 assert.equal(r.incidents.filter(e=>e.componentId==='L1').length,r.emissions.length);
 if(r.s.includeSecond)
  assert.equal(r.incidents.filter(e=>e.componentId==='L2-research').length,r.emissions.length);
 const hits=r.diagnostics.detectorHitEventsById.D1.events;
 const expected=r.emissions.map(e=>reference(r.s,e.pointMm.y));
 const ys=sorted(hits.map(h=>h.pointMm.y));
 sorted(expected.map(e=>e.atDetector)).forEach((y,i)=>near(ys[i],y,1e-6,'native detector y'));
 const slopes=sorted(hits.map(h=>h.incomingUnit.y/(r.s.sign*h.incomingUnit.x)));
 sorted(expected.map(e=>e.outgoing)).forEach((m,i)=>near(slopes[i],m,1e-8,'native outgoing slope'));
 for(const e of r.incidents){
  assert.equal(e.absorbed,false);
  const centre=e.componentId==='L1'?r.s.centre1:r.s.centre1+r.s.offset;
  const focal=e.componentId==='L1'?r.s.f1:r.s.f2;
  assert.ok(Math.abs(e.pointMm.y-centre)<r.s.apertureHeight/2-1,
   'actual lens encounter must remain safely away from native endpoints');
  const incomingSlope=e.incomingUnit.y/(r.s.sign*e.incomingUnit.x);
  const outgoingSlope=e.outgoingUnit.y/(r.s.sign*e.outgoingUnit.x);
  near(outgoingSlope,incomingSlope-(e.pointMm.y-centre)/focal,1e-8,
   'actual native ideal lens transfer at recorded encounter');
 }
 return hits;
}
function archive(name,r){
 const parent=resolve('test-artifacts/llm-authoring');mkdirSync(parent,{recursive:true});
 const directory=mkdtempSync(join(parent,'decentered-lens-research-'));
 const report={format:'opticsim-native-decentered-ideal-lens-research-v1',
  name,source:SOURCE,engineBaseline:BASE,upstreamCommit:PIN,researchOnly:true,
  canonicalAuthoringAvailable:false,publicCanonicalQualificationClaimed:false,
  sourceQuestionNumericScaleGiven:false,declaredIllustrationSettings:r.s,
  nativeInputSha256:r.nativeInputSha256,seedOnlySha256:r.seedOnlySha256,
  provenance:'Actual native input differs from the admitted one-lens seed. Never qualify it with the seed hash. No public evaluateDocument/evaluateObservables result is asserted.',
  status:r.status,event:r.event,diagnostics:r.diagnostics,
  actualNativeEmissions:r.emissions,actualNativeLensIncidents:r.incidents,
  independentConditionalFocalReference:focalReference(r.s),nativeImageDetected:false};
 writeFileSync(join(directory,'native-input.json'),JSON.stringify(r.native,null,2)+'\n',{flag:'wx'});
 writeFileSync(join(directory,'research-evidence.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('JEE_DECENTERED_IDEAL_LENS_NATIVE '+JSON.stringify({name,
  status:r.status,researchOnly:true,canonicalAuthoringAvailable:false,
  nativeInputSha256:r.nativeInputSha256,emitted:r.emissions.length,
  detectorCrossings:r.diagnostics.detectorsById.D1.crossings,
  conditionalFocalReference:focalReference(r.s),nativeImageDetected:false,
  evidenceDirectory:directory}));
}

test('J19 research preserves production refusals for two Beam lenses and unknown transverse centre',()=>{
 const p=seedFor(settings());
 const two=structuredClone(p);
 two.components.splice(2,0,{id:'L2',type:'ideal-lens',parameters:{
  x:600,focalLength:200,apertureHeight:200}});
 assert.throws(()=>prepareScene(two),'production v19 must not silently admit two ideal lenses');
 const shifted=structuredClone(p);
 shifted.components.find(c=>c.id==='L1').parameters.y=2;
 assert.throws(()=>prepareScene(shifted),'unknown transverse centre must not be ignored');
 const d=prepareScene(p).document;
 assert.equal(d.schemaVersion,19);
 assert.equal(core.compile(d).native.objs.filter(o=>o.type==='IdealLens').length,1);
});
test('J19 native equal-f lenses at 3f really deliver sampled rays to (5f,2d), including opposite offsets',()=>{
 for(const offset of [2,-2,0]){
  const r=probe({offset,detectorY:2*offset}),hits=complete(r),expected=focalReference(r.s);
  near(expected.x,1000);near(expected.y,2*offset);
  for(const h of hits){near(h.pointMm.x,1000);near(h.pointMm.y,2*offset);}
  archive('equal-f-3f-offset-'+offset,r);
 }
});
test('J19 native offset lens pair retains scale and common transverse translation',()=>{
 for(const scale of [.5,2]){
  const f=200*scale,d=2*scale;
  const r=probe({f1:f,f2:f,separation:3*f,offset:d,width:40*scale,
   apertureHeight:200*scale,detectorU:5*f,detectorY:2*d,detectorLength:400*scale});
  const hits=complete(r);
  for(const h of hits){near(h.pointMm.x,5*f);near(h.pointMm.y,2*d);}
 }
 const r=probe({centre1:13,detectorY:17}),hits=complete(r);
 for(const h of hits){near(h.pointMm.x,1000);near(h.pointMm.y,17);}
});
test('J19 native reverse illumination traverses both decentered ideal lenses without fabricated routing',()=>{
 for(const reverseHeading of [180,-180]){
  const r=probe({sign:-1,reverseHeading}),hits=complete(r);
  for(const h of hits){near(h.pointMm.x,-1000);near(h.pointMm.y,4);assert.ok(h.incomingUnit.x<0);}
  archive('reverse-heading-'+reverseHeading,r);
 }
});
test('two native unequal ideal lenses follow generic affine transfer, not a hardcoded J19 answer',()=>{
 const fromSecond=150*(700-200)/(700-200-150);
 const r=probe({f2:150,separation:700,detectorU:700+fromSecond,
  detectorY:fromSecond*2/150}),hits=complete(r),focus=focalReference(r.s);
 for(const h of hits){near(h.pointMm.x,focus.x);near(h.pointMm.y,focus.y);}
 archive('unequal-positive-lenses',r);
});
test('native afocal pair and removal of second lens do not manufacture finite focus',()=>{
 const afocal=probe({separation:400,detectorU:800,detectorY:4});
 const hits=complete(afocal);
 assert.equal(focalReference(afocal.s),null);
 assert.ok(span(hits.map(h=>h.pointMm.y))>30,'parallel outgoing ray samples remain spatially separated');
 for(const h of hits)near(h.incomingUnit.y/h.incomingUnit.x,.01,1e-8);
 archive('afocal-parallel-output-not-image',afocal);
 const single=probe({includeSecond:false,centre1:13,detectorY:13});
 const isolated=complete(single);
 assert.equal(single.incidents.some(e=>e.componentId==='L2-research'),false);
 assert.ok(span(isolated.map(h=>h.pointMm.y))>100,'removing the second lens must alter native detector readings');
});
test('incomplete native two-lens trace withholds the complete detector-hit evidence',()=>{
 const r=probe({maxRayDepth:0});
 assert.equal(r.status,'incomplete');
 assert.ok(r.diagnostics.truncation>0||r.diagnostics.undefinedBehavior>0);
 assert.equal(r.diagnostics.detectorHitEventsById,null);
 archive('deliberately-incomplete-no-qualified-hits',r);
});
