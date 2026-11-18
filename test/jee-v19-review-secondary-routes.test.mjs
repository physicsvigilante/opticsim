// TEST-ONLY / NONRELEASE v19 Chat B R2 N2/N3/N4 feasibility. Uses the
// frozen independently reviewed canonical public v19 contract and pinned native
// PhyDemo without introducing a ray path, solver change, or source substitution.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {parallelBeamSamples} from '../src/parallel-beam.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const sourceInput=name=>JSON.parse(readFileSync(
 new URL('../examples/jee-parallel-'+name+'-v19.json',import.meta.url),'utf8')).physical;
const component=(p,id)=>p.components.find(x=>x.id===id);
const close=(x,y,eps=1e-6)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=eps,x+' != '+y);
const requests=[
 {id:'beam',kind:'source-emissions',componentId:'B1'},
 {id:'one',kind:'interface-interactions',componentId:'I1'},
 {id:'two',kind:'interface-interactions',componentId:'I2'},
 {id:'count',kind:'detector-crossings',componentId:'D1'},
 {id:'hits',kind:'detector-hit-events',componentId:'D1'}
];
async function observe(p,req=requests){
 const d=prepareScene(p).document,original=JSON.stringify(d);
 assert.equal(d.schemaVersion,19);
 const out=evaluateDocument(d,core,req).summary;
 const results=(await evaluateObservables(d,req,out)).results;
 assert.equal(JSON.stringify(d),original,'Native readout must not mutate the authored scene');
 return {d,out,results};
}
const data=r=>Object.fromEntries(r.results.map(x=>[x.kind,x]));
// Backward/inside cases exercise *canonical* authoring and not #126's test
// substitution. Normal incidence gives independent y-coordinate invariants.
test('Chat B N3: native v19 Beam starts inside slab medium, exits once, then reaches detector',async()=>{
 const p=sourceInput('slab');
 component(p,'B1').parameters.x=30;
 component(p,'B1').parameters.directionDeg=0;
 component(p,'D1').parameters.y=0;
 const r=await observe(p);
 assert.equal(r.out.native.status,'completed');
 assert.equal(r.out.executionPassed,true);
 assert.equal(r.out.observations.emissionsById.B1.brightnessScale,1);
 assert.deepEqual(r.results.map(x=>x.value).slice(0,4),[8,0,8,8]);
 assert.equal(r.results[4].value.length,8);
 const expected=parallelBeamSamples(component(p,'B1').parameters,.2)
   .map(v=>v.y).sort((a,b)=>a-b);
 r.results[4].value.map(x=>x.pointMm.y).sort((a,b)=>a-b)
  .forEach((x,i)=>close(x,expected[i]));
 r.results[4].value.forEach(x=>{close(x.incomingUnit.x,1);close(x.incomingUnit.y,0);});
 console.log('V19_REVIEW_INSIDE_SLAB '+JSON.stringify({
  state:r.out.native.status,nativeEmitted:r.results[0].value,
  firstPlane:r.results[1].value,secondPlane:r.results[2].value,
  detector:r.results[3].value,partialReflection:false
 }));
});

test('Chat B N3: source beyond slab and reversed ray traverses BOTH native interfaces',async()=>{
 const p=sourceInput('slab');
 component(p,'B1').parameters.x=130;
 component(p,'B1').parameters.directionDeg=180;
 Object.assign(component(p,'D1').parameters,{x:-70,y:0,length:300});
 const r=await observe(p);
 assert.equal(r.out.native.status,'completed');
 assert.equal(r.out.executionPassed,true);
 assert.deepEqual(r.results.slice(0,4).map(x=>x.value),[8,8,8,8]);
 assert.equal(r.results[4].value.length,8);
 const expected=parallelBeamSamples(component(p,'B1').parameters,.2)
  .map(v=>v.y).sort((a,b)=>a-b);
 r.results[4].value.map(e=>e.pointMm.y).sort((a,b)=>a-b)
  .forEach((y,i)=>close(y,expected[i]));
 r.results[4].value.forEach(e=>{close(e.incomingUnit.x,-1);close(e.incomingUnit.y,0);});
 assert.equal(r.out.native.truncation,0);
 assert.equal(r.out.native.undefinedBehavior,0);
 console.log('V19_REVIEW_REVERSE_SLAB '+JSON.stringify({
  state:r.out.native.status,emitted:r.results[0].value,
  plane1:r.results[1].value,plane2:r.results[2].value,
  crossings:r.results[3].value
 }));
});

test('Chat B N3: canonical v19 ideal lens focuses +180 and -180 native Beam from the right',async()=>{
 for(const directionDeg of [180,-180]){
  const p=sourceInput('lens');
  p.components=p.components.filter(c=>c.id!=='A1');
  Object.assign(component(p,'B1').parameters,{x:100,y:0,directionDeg});
  Object.assign(component(p,'D1').parameters,{x:-100,y:0,length:200});
  const req=[
   {id:'s',kind:'source-emissions',componentId:'B1'},
   {id:'n',kind:'detector-crossings',componentId:'D1'},
   {id:'h',kind:'detector-hit-events',componentId:'D1'}
  ];
  const r=await observe(p,req);
  assert.equal(r.out.native.status,'completed');
  assert.deepEqual(r.results.slice(0,2).map(x=>x.value),[8,8]);
  const hits=r.results[2].value;assert.equal(hits.length,8);
  for(const h of hits){
   close(h.pointMm.x,-100);close(h.pointMm.y,0);
   assert.ok(h.incomingUnit.x<0,'The native returning direction must remain leftward');
  }
  console.log('V19_REVIEW_REVERSE_LENS '+JSON.stringify({
   directionDeg,state:r.out.native.status,emitted:r.results[0].value,
   focalPlaneX:-100,detectorSamples:hits.length
  }));
 }
});

// N2 historical pre-fix geometry: independently demonstrated in parent PR128
// that an admitted post-lens aperture can coincide with a native ray endpoint.
// The corrected validator now refuses that layout before native propagation.
// Previously, an actual *admitted* v19 scene could place a refracted ray near
// an aperture corner. The first-path guard checks emitted y=17.5 at x=50,
// but at x=0 an ideal f=100 lens changes the ray's eventual y at x=50 to
// 17.5*(1-50/100)=8.75, exactly the upper gap endpoint for openingLength=17.5.
// No ray route is created; this is an independent scalar reference to assess
// the admission policy, followed by the unchanged actual native solver.
function postLensStop(openingLength){
 const p=sourceInput('lens');
 component(p,'A1').parameters.x=50;
 component(p,'A1').parameters.openingLength=openingLength;
 return p;
}
// On the separately preserved original research HEAD 1b712dc00a0e49...,
// a real pinned native post-lens endpoint produced 2 absorbed rays and 6
// detector crossings in a completed run, but did NOT prove the exact-corner
// optical decision was numerically unambiguous. This source changes admission,
// never PhyDemo. No post-lens native report is relabelled as new blind evidence.
test('N2 correction: refuse every forward post-lens aperture near-corner configuration before any native run',()=>{
 for(const gap of [17.46,17.5,17.54]){
  const p=postLensStop(gap);
  assert.throws(()=>prepareScene(p),/downstream of a forward ideal lens/,String(gap));
 }
 const p=postLensStop(17.5);
 Object.assign(component(p,'B1').parameters,{x:100,directionDeg:180});
 Object.assign(component(p,'A1').parameters,{x:-50});
 Object.assign(component(p,'D1').parameters,{x:-100});
 assert.throws(()=>prepareScene(p),/downstream of a forward ideal lens/,'reverse-going postlens stop');
 component(p,'B1').parameters.directionDeg=-180;
 assert.throws(()=>prepareScene(p),/downstream of a forward ideal lens/,'equivalent -180 direction');
 console.log('V19_POST_LENS_STOP_REFUSAL '+JSON.stringify({
  testedGapsMm:[17.46,17.50,17.54],forwardRejected:true,
  reversePositive180Rejected:true,reverseNegative180Rejected:true,
  reason:'initial native sample clearances do not cover refracted corner encounters'
 }));
});

// Independent R2 P1 regression: plane-order policy must not inherit the
// 0.01 mm clearance threshold (whose equality is admitted elsewhere).
test('R2 P1: boundary-close forward lens and downstream stop cannot evade the topology refusal',()=>{
 for(const directionDeg of [0,180,-180]){
  const sign=directionDeg===0?1:-1;
  const p=postLensStop(17.5035);
  Object.assign(component(p,'B1').parameters,{x:0,directionDeg});
  component(p,'L1').parameters.x=sign*0.01;
  component(p,'A1').parameters.x=sign*50;
  component(p,'D1').parameters.x=sign*100;
  assert.throws(()=>prepareScene(p),/downstream of a forward ideal lens/,
    'source-to-lens at 0.01 mm, direction '+directionDeg);
  for(const distance of [0.009,0.011]){
   component(p,'L1').parameters.x=sign*distance;
   assert.throws(()=>prepareScene(p),/UNSUPPORTED_SCOPE|downstream of a forward ideal lens|at least 0.01 mm/,
    'source-to-lens near boundary '+distance+' deg '+directionDeg);
  }
  // Re-establish a source safely upstream and place the stop exactly at
  // and to either side of the lens-stop clearance boundary.
  component(p,'B1').parameters.x=-sign*100;
  component(p,'L1').parameters.x=0;
  for(const distance of [0.009,0.01,0.011]){
   component(p,'A1').parameters.x=sign*distance;
   assert.throws(()=>prepareScene(p),/downstream of a forward ideal lens/,
    'lens-to-stop gap '+distance+' deg '+directionDeg);
  }
 }
});
test('R2 P1: an upstream aperture is not misclassified as downstream',()=>{
 for(const directionDeg of [0,180,-180]){
  const sign=directionDeg===0?1:-1;
  const p=sourceInput('lens');
  Object.assign(component(p,'B1').parameters,{x:-sign*100,directionDeg});
  component(p,'L1').parameters.x=0;
  component(p,'A1').parameters.x=-sign*50;
  component(p,'D1').parameters.x=sign*100;
  assert.doesNotThrow(()=>prepareScene(p),'prelens stop deg '+directionDeg);
 }
});

test('N2 correction: preserve true native aperture BEFORE lens in both directions and ordinary no-stop focusing',async()=>{
 const original=sourceInput('lens'),reference=await observe(original,[
  {id:'emitted',kind:'source-emissions',componentId:'B1'},
  {id:'abs',kind:'blocker-absorptions',componentId:'A1'},
  {id:'count',kind:'detector-crossings',componentId:'D1'}
 ]);
 assert.equal(reference.out.native.status,'completed');
 assert.deepEqual(reference.results.map(x=>x.value),[8,6,2]);
 const p=sourceInput('lens');
 Object.assign(component(p,'B1').parameters,{x:100,directionDeg:180});
 Object.assign(component(p,'A1').parameters,{x:50,openingLength:12});
 Object.assign(component(p,'D1').parameters,{x:-100});
 const reverse=await observe(p,[
  {id:'emitted',kind:'source-emissions',componentId:'B1'},
  {id:'abs',kind:'blocker-absorptions',componentId:'A1'},
  {id:'count',kind:'detector-crossings',componentId:'D1'}
 ]);
 assert.equal(reverse.out.native.status,'completed');
 assert.equal(reverse.out.native.truncation,0);
 assert.deepEqual(reverse.results.map(x=>x.value),[8,6,2]);
 console.log('V19_PRE_LENS_STOP_ALLOWED '+JSON.stringify({
  forward:reference.results.map(x=>x.value),
  reverse:reverse.results.map(x=>x.value)
 }));
});

test('Chat B N4: explicit numerical limits below default remain hash-bound and suppress incomplete native output',async()=>{
 const p=sourceInput('lens'),d=prepareScene(p).document,shallow=structuredClone(d);
 shallow.simulation.maxRayDepth=0;
 // A canonical saved numerical choice is not silently changed to the public
 // preview-v1 default depth8 by the physical geometry/adapter validator.
 const {validate}=await import('../src/contract.js');
 assert.doesNotThrow(()=>validate(shallow));
 const req=[{id:'beam',kind:'source-emissions',componentId:'B1'},
   {id:'blocked',kind:'blocker-absorptions',componentId:'A1'},
   {id:'count',kind:'detector-crossings',componentId:'D1'}];
 const native=evaluateDocument(shallow,core,req).summary;
 const r=(await evaluateObservables(shallow,req,native)).results;
 assert.equal(native.native.status,'incomplete');
 assert.equal(native.executionPassed,false);
 assert.equal(native.observations,null);
 assert.ok(r.every(x=>x.status==='suppressed'&&x.value===null));
 console.log('V19_REVIEW_NUMERIC_DEPTH '+JSON.stringify({
  explicitMaxRayDepth:0,defaultPreviewDepth:d.simulation.maxRayDepth,
  nativeStatus:native.native.status,results:r.map(x=>x.status)
 }));
});
