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
import {HYBRID_BENCH_MODEL,HYBRID_BENCH_VERSION} from '../src/native-general-hybrid-bench.js';
import {evaluateObservables} from '../src/observables.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {createQualifiedBundle,initialQualification} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const exampleRequest=JSON.parse(readFileSync(resolve(root,'examples/native-general-hybrid-bench.json'),'utf8'));

function hybridReq(components,extra={}){
  return {
    title:'v39 hybrid test bench',
    model:HYBRID_BENCH_MODEL,
    lengthUnit:'mm',
    runPolicy:'preview-v1',
    components,
    ...extra
  };
}

test('v39 classifyRun treats v39EndpointsVerified === false as incomplete',()=>{
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v39EndpointsVerified:false
  }),'incomplete');
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v39EndpointsVerified:true
  }),'completed');
});

test('v39 worked example: parallel-beam + ideal-lens + polygon-dielectric slab + circular-arc-mirror return + detector completes cleanly',async()=>{
  const caps=capabilities();
  assert.equal(caps.generalHybridBench.schemaVersion,HYBRID_BENCH_VERSION);
  assert.equal(caps.generalHybridBench.model,HYBRID_BENCH_MODEL);

  const {document:doc}=prepareScene(exampleRequest);
  assert.equal(doc.schemaVersion,HYBRID_BENCH_VERSION);
  assert.equal(doc.physics.model,HYBRID_BENCH_MODEL);
  validate(doc);

  const requests=[
    {id:'emit',kind:'source-emissions',componentId:'B1'},
    {id:'slab',kind:'interface-interactions',componentId:'SL1'},
    {id:'mirror',kind:'mirror-reflections',componentId:'CM1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'},
    {id:'img',kind:'ideal-image'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v39EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  assert.equal(run.summary.native.undefinedBehavior,0);

  const byId=Object.fromEntries((await evaluateObservables(doc,requests,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.emit.status,'qualified');
  assert.equal(byId.emit.value,4);
  assert.equal(byId.slab.status,'qualified');
  assert.equal(byId.slab.value,16); // 4 rays * (2 forward + 2 return)
  assert.equal(byId.mirror.status,'qualified');
  assert.equal(byId.mirror.value,4);
  assert.equal(byId.det.status,'qualified');
  assert.equal(byId.det.value,4);
  assert.equal(byId.hits.status,'qualified');
  assert.equal(byId.hits.value.length,4);
  assert.equal(byId.img.status,'unavailable');
});

test('v39 composes 2 single-ray sources + finite-aperture + ideal-lens + prism + ideal-curved-mirror + circle-blocker + detector',async()=>{
  const {document:doc}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-220,y:6,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'S2',type:'point-source',parameters:{x:-220,y:-6,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'A1',type:'finite-aperture',parameters:{x:-150,y:0,orientationDeg:90,length:100,openingLength:40}},
    {id:'L1',type:'ideal-lens',parameters:{x:-80,focalLength:200,apertureHeight:80}},
    {id:'PR1',type:'triangular-prism',parameters:{x1:-20,y1:-40,x2:50,y2:-40,x3:15,y3:45,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'K1',type:'circle-blocker',parameters:{x:110,y:85,radius:10}},
    {id:'CM1',type:'ideal-curved-mirror',parameters:{x:160,y:-40,normalDeg:180,focalLength:120,apertureHeight:90}},
    {id:'D1',type:'ray-detector',parameters:{x:-10,y:-90,orientationDeg:0,length:180}}
  ]));
  const requests=[
    {id:'e1',kind:'source-emissions',componentId:'S1'},
    {id:'e2',kind:'source-emissions',componentId:'S2'},
    {id:'pr',kind:'interface-interactions',componentId:'PR1'},
    {id:'absA',kind:'blocker-absorptions',componentId:'A1'},
    {id:'absK',kind:'blocker-absorptions',componentId:'K1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v39EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,requests,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.e1.value,1);
  assert.equal(byId.e2.value,1);
  assert.ok(byId.pr.value>=4);
  assert.equal(byId.absA.value,0);
  assert.equal(byId.absK.value,0);
});

test('v39 integrates with reviseScene, reviseComponents (atomic dielectric + lens + emitter swaps), and runParameterSweep',async()=>{
  const {document:base}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-180,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:-90,focalLength:200,apertureHeight:80}},
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:-20,y1:-40,x2:20,y2:-40,x3:20,y3:40,x4:-20,y4:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:120,y:0,orientationDeg:90,length:140}}
  ]));

  const rev=reviseScene(base,{changes:[{id:'L1',section:'parameters',key:'focalLength',value:250}]});
  assert.equal(rev.document.physics.components[1].parameters.focalLength,250);

  const struct=reviseComponents(rev.document,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[
      {op:'remove',id:'SL1'},
      {op:'remove',id:'S1'},
      {op:'add',lengthUnit:'mm',component:{id:'B1',type:'parallel-beam',parameters:{x:-180,y:0,width:20,directionDeg:0,brightness:0.2}}},
      {op:'add',lengthUnit:'mm',component:{id:'C1',type:'circular-dielectric',parameters:{x:10,y:0,radius:30,insideIndex:1.5,outsideIndex:1,partialReflection:false}}}
    ]
  });
  assert.equal(struct.document.schemaVersion,HYBRID_BENCH_VERSION);
  assert.deepEqual(struct.removedIds,['SL1','S1']);
  assert.deepEqual(struct.addedIds,['B1','C1']);

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
    values:[1.33,1.5,4.5],
    observables:reqs
  },{
    execute:doc=>evaluateDocument(doc,core,reqs)
  });
  assert.equal(sweep.status,'completed-with-failed-samples');
  assert.equal(sweep.completedSamples,2);
  assert.equal(sweep.failedSamples,1);
  assert.equal(sweep.samples[2].status,'invalid-input');
});

test('v39 audit fails closed on transparent aperture-gap near-miss and same-body critical departure grazing; safe controls pass',async()=>{
  // 1. Secondary transparent aperture-gap near-miss after slab refraction (no arm callback).
  const yHit=140/Math.sqrt(3)+60/Math.sqrt(8);
  const apReqs=[{id:'absA',kind:'blocker-absorptions',componentId:'A1'}];
  const {document:nearAp}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'A1',type:'finite-aperture',parameters:{x:100,y:yHit+0.005-20,orientationDeg:90,length:100,openingLength:40}}
  ]));
  const nearApRun=await evaluateDocument(nearAp,core,apReqs);
  assert.equal(nearApRun.summary.executionPassed,false);
  assert.equal(nearApRun.summary.observations,null);
  assert.equal(nearApRun.report.native.diagnostics.v39EndpointsVerified,false);
  assert.equal((await evaluateObservables(nearAp,apReqs,nearApRun.summary)).results[0].status,'suppressed');

  const {document:safeAp}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:30}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:20,y2:-20,x3:20,y3:100,x4:-40,y4:100,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'A1',type:'finite-aperture',parameters:{x:100,y:yHit+0.035-20,orientationDeg:90,length:100,openingLength:40}}
  ]));
  const safeApRun=await evaluateDocument(safeAp,core,apReqs);
  assert.equal(safeApRun.summary.executionPassed,true);
  assert.equal(safeApRun.summary.observations.v39EndpointsVerified,true);

  // 2. Same-body critical departure grazing on circular dielectric (n_in=1, n_out=1.25, y=8, r=10).
  const cReqs=[{id:'first',kind:'interface-first-event',componentId:'C1'}];
  const circle={id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:10,insideIndex:1,outsideIndex:1.25,partialReflection:false}};
  const {document:grazingDoc}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-20,y:8,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ]));
  const grazingRun=await evaluateDocument(grazingDoc,core,cReqs);
  assert.equal(grazingRun.summary.executionPassed,false);
  assert.equal(grazingRun.report.native.diagnostics.v39EndpointsVerified,false);
  assert.equal((await evaluateObservables(grazingDoc,cReqs,grazingRun.summary)).results[0].status,'suppressed');

  const {document:safeCircle}=prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-20,y:7.5,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    circle
  ]));
  const safeCircleRun=await evaluateDocument(safeCircle,core,cReqs);
  assert.equal(safeCircleRun.summary.executionPassed,true);
  assert.equal(safeCircleRun.summary.observations.v39EndpointsVerified,true);
});

test('v39 enforces hybrid clearance, overlap, cardinality, and historical profile isolation',()=>{
  const ray={id:'S1',type:'point-source',parameters:{x:-180,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}};
  const slab={id:'SL1',type:'polygon-dielectric',parameters:{x1:-20,y1:-40,x2:20,y2:-40,x3:20,y3:40,x4:-20,y4:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}};

  // Ideal lens intersecting slab -> rejected.
  assert.throws(()=>prepareScene(hybridReq([
    ray,slab,
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:60}}
  ])),/outside dielectric body/);

  // Curved mirror bounding disk overlapping slab -> rejected.
  assert.throws(()=>prepareScene(hybridReq([
    ray,slab,
    {id:'CM1',type:'circular-arc-mirror',parameters:{x:40,y:0,normalDeg:180,radius:100,apertureHeight:80}}
  ])),/outside dielectric body/);

  // Zero dielectrics -> rejected (belongs to v37).
  assert.throws(()=>prepareScene(hybridReq([
    ray,{id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:60}}
  ])),/1–2 disjoint finite dielectrics/);

  // > 2 ideal lenses -> rejected.
  assert.throws(()=>prepareScene(hybridReq([
    ray,slab,
    {id:'L1',type:'ideal-lens',parameters:{x:-120,focalLength:100,apertureHeight:60}},
    {id:'L2',type:'ideal-lens',parameters:{x:-80,focalLength:100,apertureHeight:60}},
    {id:'L3',type:'ideal-lens',parameters:{x:-50,focalLength:100,apertureHeight:60}}
  ])),/0–2 coaxial ideal lenses/);

  // Initial ray hitting ideal-lens rim within 0.01 mm -> rejected at admission.
  assert.throws(()=>prepareScene(hybridReq([
    {id:'S1',type:'point-source',parameters:{x:-180,y:30,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:-80,focalLength:100,apertureHeight:60}},
    slab
  ])),/finite component endpoint|ideal-lens rim/);

  // Unmarked v4/v7 requests keep historical profiles.
  const v7=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
      {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:30,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  assert.equal(v7.document.schemaVersion,7);
});
