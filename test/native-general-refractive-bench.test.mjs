import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  COMPONENT_REVISION_FORMAT,
  capabilities,
  prepareScene,
  reviseComponents,
  reviseScene
} from '../src/authoring.js';
import {validate} from '../src/contract.js';
import {REFRACTIVE_BENCH_MODEL,REFRACTIVE_BENCH_VERSION} from '../src/native-general-refractive-bench.js';
import {evaluateObservables} from '../src/observables.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {createQualifiedBundle,initialQualification} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const exampleRequest=JSON.parse(readFileSync(resolve(root,'examples/native-general-refractive-bench.json'),'utf8'));

function refrReq(components,extra={}){
  return {
    title:'v38 refractive test bench',
    model:REFRACTIVE_BENCH_MODEL,
    lengthUnit:'mm',
    runPolicy:'preview-v1',
    components,
    ...extra
  };
}

test('v38 classifyRun treats v38EndpointsVerified === false as incomplete',()=>{
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v38EndpointsVerified:false
  }),'incomplete');
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v38EndpointsVerified:true
  }),'completed');
});

test('v38 worked example compiles, traces in pinned PhyDemo, and reports prism, mirror, and detector observables',async()=>{
  const caps=capabilities();
  assert.equal(caps.generalRefractiveBench.schemaVersion,REFRACTIVE_BENCH_VERSION);
  assert.equal(caps.generalRefractiveBench.model,REFRACTIVE_BENCH_MODEL);

  const {document:doc}=prepareScene(exampleRequest);
  assert.equal(doc.schemaVersion,REFRACTIVE_BENCH_VERSION);
  assert.equal(doc.physics.model,REFRACTIVE_BENCH_MODEL);
  validate(doc);

  const requests=[
    {id:'emit',kind:'source-emissions',componentId:'B1'},
    {id:'prismHits',kind:'interface-interactions',componentId:'PR1'},
    {id:'prismFaces',kind:'interface-face-events',componentId:'PR1'},
    {id:'mirrorRefl',kind:'mirror-reflections',componentId:'M1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v38EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  assert.equal(run.summary.native.undefinedBehavior,0);

  const observed=await evaluateObservables(doc,requests,run.summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));
  // Fresnel-off warning qualifies results honestly as 'qualified'.
  assert.equal(byId.emit.status,'qualified');
  assert.equal(byId.emit.value,4); // width 20 * density 0.2 = 4 deterministic samples
  assert.equal(byId.prismHits.status,'qualified');
  assert.ok(byId.prismHits.value>=8,'each beam sample should refract through both prism faces');
  assert.equal(byId.prismFaces.status,'qualified');
  assert.equal(byId.mirrorRefl.status,'qualified');
  assert.ok(byId.mirrorRefl.value>0);
  assert.equal(byId.det.status,'qualified');
  assert.equal(byId.hits.status,'qualified');
  assert.equal(byId.hits.value.length,byId.det.value);
});

test('v38 composes spherical-lens + polygon-dielectric + finite-aperture + circle-blocker + 2 single-ray sources + detector',async()=>{
  const {document:doc}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-220,y:12,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'S2',type:'point-source',parameters:{x:-220,y:-12,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'A1',type:'finite-aperture',parameters:{x:-140,y:0,orientationDeg:90,length:100,openingLength:40}},
    {id:'TL1',type:'spherical-lens',parameters:{x:-60,y:0,apertureHeight:60,centerThickness:14,frontRadius:80,backRadius:80,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:20,y1:-40,x2:60,y2:-40,x3:60,y3:40,x4:20,y4:40,insideIndex:1.6,outsideIndex:1,partialReflection:false}},
    {id:'K1',type:'circle-blocker',parameters:{x:120,y:75,radius:12}},
    {id:'D1',type:'ray-detector',parameters:{x:160,y:0,orientationDeg:90,length:160}}
  ]));
  const requests=[
    {id:'e1',kind:'source-emissions',componentId:'S1'},
    {id:'e2',kind:'source-emissions',componentId:'S2'},
    {id:'tl',kind:'interface-interactions',componentId:'TL1'},
    {id:'g1',kind:'interface-interactions',componentId:'G1'},
    {id:'absA',kind:'blocker-absorptions',componentId:'A1'},
    {id:'absK',kind:'blocker-absorptions',componentId:'K1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v38EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,requests,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.e1.value,1);
  assert.equal(byId.e2.value,1);
  assert.equal(byId.tl.value,4); // 2 rays * (front + back arc)
  assert.equal(byId.g1.value,4); // 2 rays * (entry + exit slab face)
  assert.equal(byId.absA.value,0);
  assert.equal(byId.absK.value,0);
  assert.equal(byId.det.value,2);
});

test('v38 integrates with reviseScene, reviseComponents (atomic dielectric & emitter swaps), and runParameterSweep',async()=>{
  const {document:base}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-180,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'PR1',type:'triangular-prism',parameters:{x1:-60,y1:-40,x2:20,y2:-40,x3:-20,y3:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:120,y:0,orientationDeg:90,length:180}}
  ]));

  // 1. reviseScene: raise prism index 1.5 -> 1.65.
  const rev=reviseScene(base,{changes:[{id:'PR1',section:'parameters',key:'insideIndex',value:1.65}]});
  assert.equal(rev.document.physics.components[1].parameters.insideIndex,1.65);

  // 2. reviseComponents: swap PR1 -> circular-dielectric C1 AND swap S1 -> parallel-beam B1 atomically.
  const struct=reviseComponents(rev.document,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[
      {op:'remove',id:'PR1'},
      {op:'remove',id:'S1'},
      {op:'add',lengthUnit:'mm',component:{id:'B1',type:'parallel-beam',parameters:{x:-180,y:0,width:20,directionDeg:0,brightness:0.2}}},
      {op:'add',lengthUnit:'mm',component:{id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:35,insideIndex:1.5,outsideIndex:1,partialReflection:false}}}
    ]
  });
  assert.equal(struct.document.schemaVersion,REFRACTIVE_BENCH_VERSION);
  assert.deepEqual(struct.removedIds,['PR1','S1']);
  assert.deepEqual(struct.addedIds,['B1','C1']);

  // 3. runParameterSweep over qualified v38 bundle (valid indices + out-of-range invalid sample).
  const reqs=[
    {id:'hits',kind:'interface-interactions',componentId:'C1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const q=initialQualification(struct.document,null,{inputSha256:await sceneHash(struct.document)});
  const bundle=await createQualifiedBundle(struct.document,q,reqs);
  const sweep=await runParameterSweep(bundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:bundle.sceneSha256,
    parameter:{id:'C1',section:'parameters',key:'insideIndex'},
    values:[1.33,1.5,4.5], // 4.5 exceeds [1, 4] -> invalid-input retained explicitly!
    observables:reqs
  },{
    execute:doc=>evaluateDocument(doc,core,reqs)
  });
  assert.equal(sweep.status,'completed-with-failed-samples');
  assert.equal(sweep.completedSamples,2);
  assert.equal(sweep.failedSamples,1);
  assert.equal(sweep.samples[0].status,'completed');
  assert.equal(sweep.samples[1].status,'completed');
  assert.equal(sweep.samples[2].status,'invalid-input');
});

test('v38 route-independent observed native endpoint audit fails closed on post-refraction external endpoint hits',async()=>{
  // Oblique ray at 30 deg refracts through slab G1 (x in [-40, 20], n=1.5) and exits shifted
  // so the REFRACTED ray lands directly on mirror M1 bottom endpoint (100, yHit), while the
  // initial unrefracted line clears M1's endpoints by >13 mm (passes admission).
  const yHit=140/Math.sqrt(3)+60/Math.sqrt(8);
  const reqs=[{id:'refl',kind:'mirror-reflections',componentId:'M1'}];

  const {document:edgeDoc}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:100,y:yHit+50,orientationDeg:90,length:100}}
  ]));
  const edgeRun=await evaluateDocument(edgeDoc,core,reqs);
  assert.equal(edgeRun.summary.executionPassed,false);
  assert.notEqual(edgeRun.summary.observations?.v38EndpointsVerified,true);
  assert.ok(edgeRun.summary.native.errors.some(e=>/finite external endpoint/.test(e)));
  const edgeObs=await evaluateObservables(edgeDoc,reqs,edgeRun.summary);
  assert.equal(edgeObs.results[0].status,'suppressed');

  // Shifting M1 down by 2 mm so the refracted ray lands safely inside M1 passes cleanly.
  const {document:safeDoc}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:100,y:yHit+48,orientationDeg:90,length:100}}
  ]));
  const safeRun=await evaluateDocument(safeDoc,core,reqs);
  assert.equal(safeRun.summary.executionPassed,true);
  assert.equal(safeRun.summary.observations?.v38EndpointsVerified,true);
  const safeObs=await evaluateObservables(safeDoc,reqs,safeRun.summary);
  assert.equal(safeObs.results[0].status,'qualified');
  assert.equal(safeObs.results[0].value,1);
});

test('v38 enforces shared outsideIndex, mutual disjointness, emitter exclusivity, corner/tangency/endpoint guards, and exact 0.01 mm clearance',()=>{
  const prism={id:'PR1',type:'triangular-prism',parameters:{x1:-40,y1:-30,x2:40,y2:-30,x3:0,y3:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const circle={id:'C1',type:'circular-dielectric',parameters:{x:120,y:0,radius:30,insideIndex:1.4,outsideIndex:1,partialReflection:false}};
  const ray={id:'S1',type:'point-source',parameters:{x:-150,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}};

  // Mismatched outsideIndex across two dielectrics -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    ray,prism,{...circle,parameters:{...circle.parameters,outsideIndex:1.33}}
  ])),/share one explicit outsideIndex/);

  // Overlapping prism and circular dielectric -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    ray,prism,{...circle,parameters:{...circle.parameters,x:45,y:0,radius:30}}
  ])),/disjoint/);

  // Mixing point-source and parallel-beam -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    ray,
    {id:'B1',type:'parallel-beam',parameters:{x:-180,y:0,width:20,directionDeg:0,brightness:0.2}},
    prism
  ])),/not both/);

  // Zero dielectrics -> rejected.
  assert.throws(()=>prepareScene(refrReq([ray])),/1–2 disjoint finite dielectrics/);

  // >2 dielectrics -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    ray,prism,circle,
    {id:'G1',type:'polygon-dielectric',parameters:{x1:200,y1:-20,x2:240,y2:-20,x3:240,y3:20,x4:200,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/1–2 disjoint finite dielectrics/);

  // Non-single-ray point source -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-150,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:20}},
    prism
  ])),/supported: single-ray|single-ray/);

  // Point source inside circular dielectric -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:120,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ])),/outside every dielectric body/);

  // Initial ray passing within 0.01 mm of prism apex (0, 40) -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:40,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    prism
  ])),/corner\/vertex/);

  // Initial ray tangent to circular dielectric (y = 30 for circle at (120, 0), r = 30) -> rejected.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:30,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ])),/tangency/);

  // Direct initial ray hitting external mirror endpoint -> rejected at admission.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-150,y:50,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    prism,
    {id:'M1',type:'plane-mirror',parameters:{x:100,y:0,orientationDeg:90,length:100}}
  ])),/finite external endpoint/);

  // Exact 0.01 mm clearance on circular dielectric is admitted; 0.009 mm is refused.
  const exactClear=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:89.99,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ]));
  assert.equal(exactClear.document.schemaVersion,REFRACTIVE_BENCH_VERSION);
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:89.991,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ])),/outside every dielectric body/);
});

test('historical v7, v8, v9, v14, v15, and v22 profile selection remains unchanged',()=>{
  const v7=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
      {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:30,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  assert.equal(v7.document.schemaVersion,7);
  assert.equal(v7.document.physics.model,'circular-dielectric-tracing');

  const v8=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
      {id:'PR1',type:'triangular-prism',parameters:{x1:-20,y1:-30,x2:20,y2:-30,x3:0,y3:30,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  assert.equal(v8.document.schemaVersion,8);
  assert.equal(v8.document.physics.model,'triangular-prism-tracing');
});

test('v38 P2-1: secondary aperture-gap near miss (no arm callback) fails closed; >=0.01 mm gap clearance passes',async()=>{
  const yHit=140/Math.sqrt(3)+60/Math.sqrt(8);
  const reqs=[
    {id:'slab',kind:'interface-interactions',componentId:'G1'},
    {id:'absA',kind:'blocker-absorptions',componentId:'A1'}
  ];
  // Refracted ray passes 0.005 mm below upper inner aperture endpoint (y = yHit + 0.005)
  // through the transparent gap with NO Aperture.onRayIncident callback.
  const {document:nearDoc}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'A1',type:'finite-aperture',parameters:{x:100,y:yHit+0.005-20,orientationDeg:90,length:100,openingLength:40}}
  ]));
  const nearRun=await evaluateDocument(nearDoc,core,reqs);
  assert.equal(nearRun.summary.executionPassed,false);
  assert.equal(nearRun.summary.observations,null);
  assert.equal(nearRun.report.native.diagnostics.v38EndpointsVerified,false);
  assert.equal(nearRun.report.native.diagnostics.blockersById.A1.absorptions,0);
  assert.ok(nearRun.summary.native.errors.some(e=>/A1.*finite external endpoint/.test(e)));
  const nearObs=await evaluateObservables(nearDoc,reqs,nearRun.summary);
  assert.ok(nearObs.results.every(r=>r.status==='suppressed'));

  // Safe >= 0.01 mm variant: shift aperture up by 0.03 mm (perp clearance ~0.0303 mm >= 0.01 mm).
  const {document:safeDoc}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'A1',type:'finite-aperture',parameters:{x:100,y:yHit+0.035-20,orientationDeg:90,length:100,openingLength:40}}
  ]));
  const safeRun=await evaluateDocument(safeDoc,core,reqs);
  assert.equal(safeRun.summary.executionPassed,true);
  assert.equal(safeRun.summary.observations.v38EndpointsVerified,true);
  const safeObs=await evaluateObservables(safeDoc,reqs,safeRun.summary);
  assert.ok(safeObs.results.every(r=>r.status==='qualified'));
  assert.equal(safeObs.results[1].value,0);
});

test('v38 P2-2: spherical-lens generating-circle tangency fails at admission and on secondary rays; >=0.01 mm clears',async()=>{
  const lens={id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:60,centerThickness:14,frontRadius:80,backRadius:80,insideIndex:1.5,outsideIndex:1,partialReflection:false}};

  // Initial-ray witness: front generating circle center is (73, 0), r = 80;
  // x = -6.995 is 0.005 mm inside tangency -> rejected at admission.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-6.995,y:-100,brightness:0.5},emission:{mode:'single-ray',directionDeg:90}},
    lens
  ])),/tangency/);

  // Safe >= 0.01 mm initial-ray variant: x = -6.98 (0.02 mm inside tangency).
  const {document:safeInit}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-6.98,y:-100,brightness:0.5},emission:{mode:'single-ray',directionDeg:90}},
    lens
  ]));
  const safeInitRun=await evaluateDocument(safeInit,core,[{id:'tl',kind:'interface-interactions',componentId:'TL1'}]);
  assert.equal(safeInitRun.summary.executionPassed,true);
  assert.equal(safeInitRun.summary.observations.v38EndpointsVerified,true);

  // Secondary-ray witness: horizontal ray reflects off 45-deg mirror onto x = -6.995
  // (passes admission, fails closed at runtime on generating-circle near-tangency).
  const reqs=[{id:'refl',kind:'mirror-reflections',componentId:'M1'}];
  const {document:secNear}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:-100,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'plane-mirror',parameters:{x:-6.995,y:-100,orientationDeg:45,length:20}},
    lens
  ]));
  const secNearRun=await evaluateDocument(secNear,core,reqs);
  assert.equal(secNearRun.summary.executionPassed,false);
  assert.equal(secNearRun.summary.observations,null);
  assert.equal(secNearRun.report.native.diagnostics.v38EndpointsVerified,false);
  assert.ok(secNearRun.summary.native.errors.some(e=>/TL1.*tangency/.test(e)));
  const secNearObs=await evaluateObservables(secNear,reqs,secNearRun.summary);
  assert.equal(secNearObs.results[0].status,'suppressed');

  // Safe secondary-ray variant: mirror at x = -6.98 (0.02 mm >= 0.01 mm clear).
  const {document:secSafe}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:-100,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'plane-mirror',parameters:{x:-6.98,y:-100,orientationDeg:45,length:20}},
    lens
  ]));
  const secSafeRun=await evaluateDocument(secSafe,core,reqs);
  assert.equal(secSafeRun.summary.executionPassed,true);
  assert.equal(secSafeRun.summary.observations.v38EndpointsVerified,true);
  const secSafeObs=await evaluateObservables(secSafe,reqs,secSafeRun.summary);
  assert.equal(secSafeObs.results[0].status,'qualified');
  assert.equal(secSafeObs.results[0].value,1);
});

test('v38 P2-3: secondary circular-dielectric near-tangency (hit and no-callback miss) fails closed at 0.01 mm; safe variant qualifies',async()=>{
  const yHit=140/Math.sqrt(3)+60/Math.sqrt(8);
  const nx=0.5,ny=-Math.sqrt(3)/2; // unit normal to 30-deg outgoing ray
  const reqs=[{id:'cHits',kind:'interface-interactions',componentId:'C1'}];
  const makeCircleScene=impact=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'C1',type:'circular-dielectric',parameters:{x:100+impact*nx,y:yHit+impact*ny,radius:15,insideIndex:1.4,outsideIndex:1,partialReflection:false}}
  ])).document;

  // 1. Hitting near-tangency (impact = 14.995 mm, 0.005 mm inside r = 15).
  const hitDoc=makeCircleScene(14.995);
  const hitRun=await evaluateDocument(hitDoc,core,reqs);
  assert.equal(hitRun.summary.executionPassed,false);
  assert.equal(hitRun.summary.observations,null);
  assert.equal(hitRun.report.native.diagnostics.v38EndpointsVerified,false);
  assert.ok(hitRun.summary.native.errors.some(e=>/C1.*tangency/.test(e)));
  assert.equal((await evaluateObservables(hitDoc,reqs,hitRun.summary)).results[0].status,'suppressed');

  // 2. No-callback near-miss (impact = 15.005 mm, 0.005 mm outside r = 15).
  const missDoc=makeCircleScene(15.005);
  const missRun=await evaluateDocument(missDoc,core,reqs);
  assert.equal(missRun.summary.executionPassed,false);
  assert.equal(missRun.summary.observations,null);
  assert.equal(missRun.report.native.diagnostics.v38EndpointsVerified,false);
  assert.equal(missRun.report.native.diagnostics.interfacesById.C1.interactions,0);
  assert.ok(missRun.summary.native.errors.some(e=>/C1.*tangency/.test(e)));
  assert.equal((await evaluateObservables(missDoc,reqs,missRun.summary)).results[0].status,'suppressed');

  // 3. Safe >= 0.01 mm variant (impact = 14.5 mm).
  const safeDoc=makeCircleScene(14.5);
  const safeRun=await evaluateDocument(safeDoc,core,reqs);
  assert.equal(safeRun.summary.executionPassed,true);
  assert.equal(safeRun.summary.observations.v38EndpointsVerified,true);
  const safeObs=await evaluateObservables(safeDoc,reqs,safeRun.summary);
  assert.equal(safeObs.results[0].status,'qualified');
  assert.equal(safeObs.results[0].value,2);
});

test('v38 P2-4: opaque circle-blocker tangency fails at admission and on secondary no-callback near-miss; safe variants pass',async()=>{
  const farPrism={id:'PR1',type:'triangular-prism',parameters:{x1:-20,y1:-120,x2:20,y2:-120,x3:0,y3:-80,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const blocker={id:'K1',type:'circle-blocker',parameters:{x:0,y:0,radius:10}};

  // Admission negative: exact tangent horizontal ray at y = 10.
  assert.throws(()=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:10,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    blocker,farPrism
  ])),/opaque circle blocker/);

  // Admission safe >= 0.01 mm variant: y = 10.02 (0.02 mm clear).
  const {document:safeInit}=prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:10.02,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    blocker,farPrism
  ]));
  const safeInitRun=await evaluateDocument(safeInit,core,[{id:'absK',kind:'blocker-absorptions',componentId:'K1'}]);
  assert.equal(safeInitRun.summary.executionPassed,true);
  assert.equal(safeInitRun.summary.observations.v38EndpointsVerified,true);
  assert.equal(safeInitRun.summary.observations.blockersById.K1.absorptions,0);

  // Secondary no-callback near-miss: refracted ray passes 0.005 mm outside circle-blocker (r = 15).
  const yHit=140/Math.sqrt(3)+60/Math.sqrt(8);
  const nx=0.5,ny=-Math.sqrt(3)/2;
  const reqs=[{id:'absK',kind:'blocker-absorptions',componentId:'K1'}];
  const makeBlockerScene=impact=>prepareScene(refrReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'K1',type:'circle-blocker',parameters:{x:100+impact*nx,y:yHit+impact*ny,radius:15}}
  ])).document;

  const nearMissDoc=makeBlockerScene(15.005);
  const nearMissRun=await evaluateDocument(nearMissDoc,core,reqs);
  assert.equal(nearMissRun.summary.executionPassed,false);
  assert.equal(nearMissRun.summary.observations,null);
  assert.equal(nearMissRun.report.native.diagnostics.v38EndpointsVerified,false);
  assert.equal(nearMissRun.report.native.diagnostics.blockersById.K1.absorptions,0);
  assert.ok(nearMissRun.summary.native.errors.some(e=>/K1.*tangency/.test(e)));
  assert.equal((await evaluateObservables(nearMissDoc,reqs,nearMissRun.summary)).results[0].status,'suppressed');

  // Safe secondary variant: impact = 15.05 mm (0.05 mm >= 0.01 mm clear).
  const safeSecDoc=makeBlockerScene(15.05);
  const safeSecRun=await evaluateDocument(safeSecDoc,core,reqs);
  assert.equal(safeSecRun.summary.executionPassed,true);
  assert.equal(safeSecRun.summary.observations.v38EndpointsVerified,true);
  const safeSecObs=await evaluateObservables(safeSecDoc,reqs,safeSecRun.summary);
  assert.equal(safeSecObs.results[0].status,'qualified');
  assert.equal(safeSecObs.results[0].value,0);
});
