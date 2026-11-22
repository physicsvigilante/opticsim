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
import {GENERAL_BENCH_MODEL,GENERAL_BENCH_VERSION} from '../src/native-general-optical-bench.js';
import {evaluateObservables} from '../src/observables.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {createQualifiedBundle,initialQualification} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const exampleRequest=JSON.parse(readFileSync(resolve(root,'examples/native-general-optical-bench.json'),'utf8'));

function benchReq(components,extra={}){
  return {
    title:'v37 test bench',
    model:GENERAL_BENCH_MODEL,
    lengthUnit:'mm',
    runPolicy:'preview-v1',
    components,
    ...extra
  };
}

test('v37 worked example compiles, traces in pinned PhyDemo, and reports native emissions, absorptions, reflections, and detector hits',async()=>{
  const caps=capabilities();
  assert.equal(caps.generalOpticalBench.schemaVersion,GENERAL_BENCH_VERSION);
  assert.equal(caps.generalOpticalBench.model,GENERAL_BENCH_MODEL);

  const {document:doc}=prepareScene(exampleRequest);
  assert.equal(doc.schemaVersion,GENERAL_BENCH_VERSION);
  assert.equal(doc.physics.model,GENERAL_BENCH_MODEL);
  validate(doc);

  const requests=[
    {id:'emit',kind:'source-emissions',componentId:'B1'},
    {id:'stop',kind:'blocker-absorptions',componentId:'A1'},
    {id:'refl',kind:'mirror-reflections',componentId:'M1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'},
    {id:'pwr',kind:'detector-signed-power',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.native.truncation,0);
  assert.equal(run.summary.native.undefinedBehavior,0);

  const observed=await evaluateObservables(doc,requests,run.summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));
  assert.equal(byId.emit.status,'available');
  assert.equal(byId.emit.value,12); // width 60 mm * rayDensity 0.2 = 12 deterministic beam samples
  assert.equal(byId.stop.status,'available');
  assert.ok(byId.stop.value>0,'outer beam samples should be absorbed by finite-aperture arms');
  assert.equal(byId.refl.status,'available');
  assert.ok(byId.refl.value>0,'transmitted samples should reflect from circular-arc-mirror M1');
  assert.equal(byId.det.status,'available');
  assert.ok(byId.det.value>byId.refl.value,'detector D1 should count both forward and returned crossings');
  assert.equal(byId.pwr.status,'available');
  assert.equal(typeof byId.pwr.value,'number');
  assert.equal(byId.hits.status,'available');
  assert.equal(byId.hits.value.length,byId.det.value);
});

test('v37 composes point-source + ideal-lens + ideal-curved-mirror + plane-mirror + circle-blocker + detector and withholds ideal-image',async()=>{
  const {document:doc}=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-220,y:15,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:30}},
    {id:'L1',type:'ideal-lens',parameters:{x:-60,focalLength:120,apertureHeight:140}},
    {id:'C1',type:'ideal-curved-mirror',parameters:{x:140,y:0,normalDeg:180,focalLength:100,apertureHeight:140}},
    {id:'P1',type:'plane-mirror',parameters:{x:-120,y:-110,orientationDeg:25,length:120}},
    {id:'K1',type:'circle-blocker',parameters:{x:20,y:-75,radius:12}},
    {id:'D1',type:'ray-detector',parameters:{x:-180,y:-40,orientationDeg:90,length:180}}
  ]));
  const requests=[
    {id:'emit',kind:'source-emissions',componentId:'S1'},
    {id:'reflC',kind:'mirror-reflections',componentId:'C1'},
    {id:'reflP',kind:'mirror-reflections',componentId:'P1'},
    {id:'absK',kind:'blocker-absorptions',componentId:'K1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'},
    {id:'img',kind:'ideal-image',componentId:'S1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  const observed=await evaluateObservables(doc,requests,run.summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));
  assert.equal(byId.emit.status,'available');
  assert.ok(byId.emit.value>0);
  assert.equal(byId.reflC.status,'available');
  assert.ok(byId.reflC.value>0);
  assert.equal(byId.reflP.status,'available');
  assert.equal(byId.absK.status,'available');
  assert.equal(byId.det.status,'available');
  // No route-independent analytical image prediction is fabricated for v37.
  assert.equal(byId.img.status,'unavailable');
});

test('v37 supports single-ray and multi-source point-source benches cleanly without source attribution',async()=>{
  const {document:doc}=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-180,y:20,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'S2',type:'point-source',parameters:{x:-180,y:-20,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:120}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:200,y:0,normalDeg:180,radius:200,apertureHeight:120}},
    {id:'D1',type:'ray-detector',parameters:{x:100,y:0,orientationDeg:90,length:120}}
  ]));
  const requests=[
    {id:'e1',kind:'source-emissions',componentId:'S1'},
    {id:'e2',kind:'source-emissions',componentId:'S2'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,requests);
  assert.equal(run.summary.executionPassed,true);
  const observed=await evaluateObservables(doc,requests,run.summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));
  assert.equal(byId.e1.value,1);
  assert.equal(byId.e2.value,1);
  assert.equal(byId.m1.value,2);
  assert.equal(byId.d1.value,4); // 2 forward + 2 reflected return crossings
});

test('v37 integrates with reviseScene, reviseComponents (including atomic emitter swap), and runParameterSweep',async()=>{
  const {document:base}=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-200,y:0,brightness:0.2},emission:{mode:'full-circle',directionDeg:0,angleDeg:30}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:120,apertureHeight:100}},
    {id:'D1',type:'ray-detector',parameters:{x:150,y:0,orientationDeg:90,length:120}}
  ]));

  // 1. reviseScene: switch S1 from full-circle to single-ray cleanly.
  const rev=reviseScene(base,{changes:[
    {id:'S1',section:'emission',key:'mode',value:'single-ray'},
    {id:'S1',section:'emission',key:'directionDeg',value:5}
  ]});
  assert.equal(rev.document.physics.components[0].emission.mode,'single-ray');

  // 2. reviseComponents: add a circular-arc-mirror and circle-blocker, AND swap S1 -> parallel-beam B1 atomically!
  const struct=reviseComponents(rev.document,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[
      {op:'remove',id:'S1'},
      {op:'add',lengthUnit:'mm',component:{id:'B1',type:'parallel-beam',parameters:{x:-200,y:0,width:40,directionDeg:0,brightness:0.2}}},
      {op:'add',lengthUnit:'mm',component:{id:'M1',type:'circular-arc-mirror',parameters:{x:240,y:0,normalDeg:180,radius:200,apertureHeight:100}}},
      {op:'add',lengthUnit:'mm',component:{id:'K1',type:'circle-blocker',parameters:{x:80,y:85,radius:10}}}
    ]
  });
  assert.equal(struct.document.schemaVersion,GENERAL_BENCH_VERSION);
  assert.deepEqual(struct.removedIds,['S1']);
  assert.deepEqual(struct.addedIds,['B1','M1','K1']);

  // 3. runParameterSweep over qualified v37 bundle (valid + colliding sample retained explicitly).
  const reqs=[
    {id:'refl',kind:'mirror-reflections',componentId:'M1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const q=initialQualification(struct.document,null,{inputSha256:await sceneHash(struct.document)});
  const bundle=await createQualifiedBundle(struct.document,q,reqs);
  const sweep=await runParameterSweep(bundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:bundle.sceneSha256,
    parameter:{id:'M1',section:'parameters',key:'x',unit:'mm'},
    values:[240,280,155], // 155 causes M1 bounding disk to collide with D1 at x=150 -> invalid-input!
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

test('v37 enforces strict pairwise geometry, clearance, emitter exclusivity, and beam sampling guards',()=>{
  // Mixing point-source and parallel-beam -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-200,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'B1',type:'parallel-beam',parameters:{x:-150,y:0,width:20,directionDeg:0,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
  ])),/not both/);

  // Zero emitters -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
  ])),/point sources or 1 parallel beam/);

  // >2 curved mirrors -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-300,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'C1',type:'ideal-curved-mirror',parameters:{x:0,y:150,normalDeg:180,focalLength:80,apertureHeight:40}},
    {id:'C2',type:'ideal-curved-mirror',parameters:{x:0,y:-150,normalDeg:180,focalLength:80,apertureHeight:40}},
    {id:'C3',type:'circular-arc-mirror',parameters:{x:250,y:0,normalDeg:180,radius:100,apertureHeight:40}}
  ])),/0–2 curved mirrors/);

  // >2 opaque stops across mixed stop types -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-300,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'K1',type:'line-blocker',parameters:{x:0,y:120,orientationDeg:0,length:40}},
    {id:'K2',type:'circle-blocker',parameters:{x:0,y:-120,radius:15}},
    {id:'K3',type:'finite-aperture',parameters:{x:100,y:0,orientationDeg:90,length:80,openingLength:20}}
  ])),/0–2 opaque stops/);

  // Parallel beam brightness > rayDensity (preview-v1 density is 0.2) -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:-200,y:0,width:40,directionDeg:0,brightness:0.5}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
  ])),/brightness must not exceed ray density/);

  // Parallel beam half-integer sample count (width 22.5 * density 0.2 = 4.5) -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:-200,y:0,width:22.5,directionDeg:0,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
  ])),/half-integer/);

  // Parallel beam crossing lens plane -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:0,y:0,width:40,directionDeg:45,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
  ])),/one side of every lens plane/);

  // Ideal lens entering curved-mirror bounding disk -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-200,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:10,focalLength:100,apertureHeight:80}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:40,y:0,normalDeg:180,radius:100,apertureHeight:100}}
  ])),/curved mirror bounding disk/);

  // Circle blocker overlapping curved-mirror bounding disk -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-200,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:100,y:0,normalDeg:180,focalLength:80,apertureHeight:100}},
    {id:'K1',type:'circle-blocker',parameters:{x:60,y:0,radius:20}}
  ])),/overlaps curved mirror bounding disk/);

  // Parallel beam entering circle blocker -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:-100,y:0,width:40,directionDeg:0,brightness:0.2}},
    {id:'K1',type:'circle-blocker',parameters:{x:-95,y:0,radius:10}}
  ])),/outside opaque circle/);

  // Finite-aperture arm nearly touching ideal-lens (<0.01 mm) -> rejected.
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-200,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:100}},
    {id:'A1',type:'finite-aperture',parameters:{x:0.005,y:0,orientationDeg:90,length:120,openingLength:20}}
  ])),/intersect or nearly touch/);

  // Astra P2 regression: exact Beam -> lens rim encounter and +/-epsilon perturbations are refused.
  for(const apertureHeight of [15,15+0.01,15-0.01]){
    assert.throws(()=>prepareScene(benchReq([
      {id:'B1',type:'parallel-beam',parameters:{x:-100,y:0,width:20,directionDeg:0,brightness:0.2}},
      {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight}}
    ])),/within 0\.01 mm/);
  }
  // Safe clearance (>0.01 mm) is admitted cleanly.
  const safeRim=prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:-100,y:0,width:20,directionDeg:0,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:15.04}}
  ]));
  assert.equal(safeRim.document.schemaVersion,GENERAL_BENCH_VERSION);

  // Oblique Beam sample hitting a finite lens rim -> refused.
  // B1 width=10, density=0.2 -> 2 samples at ±2.5 perpendicular; at directionDeg=45,
  // choose B1 centre so one sample at (-50, -42.5) travels along (1,1)/sqrt(2) straight to (0, 7.5).
  assert.throws(()=>prepareScene(benchReq([
    {id:'B1',type:'parallel-beam',parameters:{x:-50+2.5/Math.SQRT2,y:-42.5-2.5/Math.SQRT2,width:10,directionDeg:45,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:15}}
  ])),/within 0\.01 mm/);

  // Astra P3 #1 regression: exact 0.01 mm clearance on curved bounding disk is admitted; 0.009 mm is refused.
  const exactDiskClearance=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-10.01,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:20,apertureHeight:20}}
  ]));
  assert.equal(exactDiskClearance.document.schemaVersion,GENERAL_BENCH_VERSION);
  assert.throws(()=>prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-10.009,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:20,apertureHeight:20}}
  ])),/curved aperture bounding disk/);

  // Astra P3 #2: physical curved mirror points in [-10000,10000] are admitted even when clearance disk extends beyond 10000.
  const nearWorldEdge=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:9900,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:9995,y:0,normalDeg:180,focalLength:20,apertureHeight:20}}
  ]));
  assert.equal(nearWorldEdge.document.schemaVersion,GENERAL_BENCH_VERSION);
});

test('v37 route-independent native endpoint audit fails closed and suppresses measurements on finite endpoint hits',async()=>{
  // Point source aimed straight at plane mirror M1 top endpoint (0, 50):
  // admitted geometrically, but observed native endpoint hit suppresses measurements.
  const {document:edgeDoc}=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:50,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:100}}
  ]));
  const reqs=[{id:'refl',kind:'mirror-reflections',componentId:'M1'}];
  const edgeRun=await evaluateDocument(edgeDoc,core,reqs);
  assert.equal(edgeRun.summary.executionPassed,false);
  assert.notEqual(edgeRun.summary.observations?.v37EndpointsVerified,true);
  assert.ok(edgeRun.summary.native.errors.some(e=>/finite component endpoint/.test(e)));
  const edgeObs=await evaluateObservables(edgeDoc,reqs,edgeRun.summary);
  assert.equal(edgeObs.results[0].status,'suppressed');

  // Shifting S1.y to 49.9 (0.1 mm inside mirror) passes endpoint audit and qualifies reflection count.
  const {document:safeDoc}=prepareScene(benchReq([
    {id:'S1',type:'point-source',parameters:{x:-100,y:49.9,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:100}}
  ]));
  const safeRun=await evaluateDocument(safeDoc,core,reqs);
  assert.equal(safeRun.summary.executionPassed,true);
  assert.equal(safeRun.summary.observations?.v37EndpointsVerified,true);
  const safeObs=await evaluateObservables(safeDoc,reqs,safeRun.summary);
  assert.equal(safeObs.results[0].status,'available');
  assert.equal(safeObs.results[0].value,1);
});

test('historical v4, v6, and v19 profile selection and isolation remain completely unchanged',()=>{
  const v4=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-150,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:20}},
      {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
    ]
  });
  assert.equal(v4.document.schemaVersion,4);
  assert.equal(v4.document.physics.model,'general-component-tracing');

  const v6=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-150,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'M1',type:'circular-arc-mirror',parameters:{x:100,y:0,normalDeg:180,radius:150,apertureHeight:80}}
    ]
  });
  assert.equal(v6.document.schemaVersion,6);
  assert.equal(v6.document.physics.model,'curved-mirror-tracing');

  const v19=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'B1',type:'parallel-beam',parameters:{x:-150,y:0,width:40,directionDeg:0,brightness:0.2}},
      {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:100,apertureHeight:80}}
    ]
  });
  assert.equal(v19.document.schemaVersion,19);
  assert.equal(v19.document.physics.model,'native-parallel-lens-tracing');
});

test('v37 F1 audit parity: emitted and outgoing no-callback endpoint/tangency misses fail closed; >=0.01 mm controls pass',async()=>{
  const reqs=[{id:'det',kind:'detector-crossings',componentId:'D1'}];
  const arc={id:'CM1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:0,radius:20,apertureHeight:20}};

  const cases=[
    {
      name:'transparent aperture gap',
      near:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:4.995,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'A1',type:'finite-aperture',parameters:{x:0,y:0,orientationDeg:90,length:40,openingLength:10}},
        {id:'D1',type:'ray-detector',parameters:{x:20,y:4.995,orientationDeg:90,length:10}}
      ],
      safe:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:4.95,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'A1',type:'finite-aperture',parameters:{x:0,y:0,orientationDeg:90,length:40,openingLength:10}},
        {id:'D1',type:'ray-detector',parameters:{x:20,y:4.95,orientationDeg:90,length:10}}
      ],
      errRe:/A1.*endpoint/
    },
    {
      name:'redirected mirror->aperture gap',
      near:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:45,length:10}},
        {id:'A1',type:'finite-aperture',parameters:{x:-4.995,y:20,orientationDeg:0,length:40,openingLength:10}},
        {id:'D1',type:'ray-detector',parameters:{x:0,y:40,orientationDeg:0,length:10}}
      ],
      safe:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:45,length:10}},
        {id:'A1',type:'finite-aperture',parameters:{x:-4.95,y:20,orientationDeg:0,length:40,openingLength:10}},
        {id:'D1',type:'ray-detector',parameters:{x:0,y:40,orientationDeg:0,length:10}}
      ],
      errRe:/A1.*endpoint/
    },
    {
      name:'circle-blocker tangency miss',
      near:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:10.005,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'K1',type:'circle-blocker',parameters:{x:0,y:0,radius:10}},
        {id:'D1',type:'ray-detector',parameters:{x:20,y:10.005,orientationDeg:90,length:10}}
      ],
      safe:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:10.05,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'K1',type:'circle-blocker',parameters:{x:0,y:0,radius:10}},
        {id:'D1',type:'ray-detector',parameters:{x:20,y:10.05,orientationDeg:90,length:10}}
      ],
      errRe:/K1.*tangency/
    },
    {
      name:'circular-arc endpoint miss',
      near:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:10.005,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        arc,
        {id:'D1',type:'ray-detector',parameters:{x:20,y:10.005,orientationDeg:90,length:10}}
      ],
      safe:[
        {id:'S1',type:'point-source',parameters:{x:-20,y:10.05,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        arc,
        {id:'D1',type:'ray-detector',parameters:{x:20,y:10.05,orientationDeg:90,length:10}}
      ],
      errRe:/CM1.*endpoint/
    },
    {
      name:'circular-arc vertex tangency miss',
      near:[
        {id:'S1',type:'point-source',parameters:{x:-0.005,y:-20,brightness:0.5},emission:{mode:'single-ray',directionDeg:90}},
        arc,
        {id:'D1',type:'ray-detector',parameters:{x:-0.005,y:20,orientationDeg:0,length:10}}
      ],
      safe:[
        {id:'S1',type:'point-source',parameters:{x:-0.05,y:-20,brightness:0.5},emission:{mode:'single-ray',directionDeg:90}},
        arc,
        {id:'D1',type:'ray-detector',parameters:{x:-0.05,y:20,orientationDeg:0,length:10}}
      ],
      errRe:/CM1.*tangency/
    }
  ];

  for(const tc of cases){
    const {document:nearDoc}=prepareScene(benchReq(tc.near));
    const nearRun=await evaluateDocument(nearDoc,core,reqs);
    assert.equal(nearRun.summary.executionPassed,false,tc.name+' should fail closed');
    assert.equal(nearRun.summary.observations,null,tc.name+' should withhold observations');
    assert.equal(nearRun.report.native.diagnostics.v37EndpointsVerified,false,tc.name+' v37EndpointsVerified false');
    assert.ok(nearRun.summary.native.errors.some(e=>tc.errRe.test(e)),tc.name+' expected error match');
    assert.equal((await evaluateObservables(nearDoc,reqs,nearRun.summary)).results[0].status,'suppressed');

    const {document:safeDoc}=prepareScene(benchReq(tc.safe));
    const safeRun=await evaluateDocument(safeDoc,core,reqs);
    assert.equal(safeRun.summary.executionPassed,true,tc.name+' safe control should pass');
    assert.equal(safeRun.summary.observations.v37EndpointsVerified,true,tc.name+' safe v37EndpointsVerified true');
    const safeObs=await evaluateObservables(safeDoc,reqs,safeRun.summary);
    assert.equal(safeObs.results[0].status,'available');
    assert.equal(safeObs.results[0].value,1);
  }
});
