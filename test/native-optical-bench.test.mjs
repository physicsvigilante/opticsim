import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  COMPONENT_REVISION_FORMAT,
  capabilities,
  opticalBenchCapabilities,
  prepareScene,
  reviseComponents,
  reviseScene
} from '../src/authoring.js';
import {parseSave,serializeSave,validate} from '../src/contract.js';
import {createExplorationNotebook} from '../src/exploration-notebook.js';
import {replayExplorationNotebook} from '../src/exploration-notebook-replay.js';
import {explorationContext,prepareExplorationProposal,snapshotScenario} from '../src/exploration.js';
import {focusedExplorationContext} from '../src/focused-exploration-context.js';
import {compareScenario} from '../src/scenario-comparison.js';
import {
  OPTICAL_BENCH_V40_MODEL,
  OPTICAL_BENCH_V40_VERSION,
  V40_DEFAULT_RANDOM_SEED,
  V40_MAX_RAY_DEPTH
} from '../src/native-optical-bench.js';
import {evaluateObservables} from '../src/observables.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {createQualifiedBundle,initialQualification} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const exampleRequest=JSON.parse(readFileSync(resolve(root,'examples/native-optical-bench.json'),'utf8'));
const starterSceneText=readFileSync(resolve(root,'scenes/native-optical-bench.json'),'utf8');
const html=readFileSync(resolve(root,'public/index.html'),'utf8');

function v40Req(components,{backgroundIndex=1,runPolicy,randomSeed,title='v40 test bench'}={}){
  return {
    title,
    model:OPTICAL_BENCH_V40_MODEL,
    lengthUnit:'mm',
    backgroundIndex,
    ...(runPolicy!==undefined?{runPolicy}:{}),
    ...(randomSeed!==undefined?{randomSeed}:{}),
    components
  };
}

// Independent standalone Snell vector helper for analytical test oracles.
// Uses standard Snell law on unit direction d and unit outward normal n (pointing into n2).
function snellStep(d,nInto2,n1,n2){
  const cosI=d.x*nInto2.x+d.y*nInto2.y;
  const sinI=d.x*nInto2.y-d.y*nInto2.x; // signed cross in 2D
  const ratio=n1/n2;
  const sinT=ratio*sinI;
  if(Math.abs(sinT)>=1){
    // Total internal reflection: reflect across normal
    return {tir:true,dir:{x:d.x-2*cosI*nInto2.x,y:d.y-2*cosI*nInto2.y}};
  }
  const cosT=Math.sqrt(1-sinT*sinT);
  // Tangent unit vector perpendicular to nInto2 such that d = cosI * nInto2 + sinI * t
  // Since sinI = d.x*n.y - d.y*n.x, t = (n.y, -n.x) satisfies d·t = d.x*n.y - d.y*n.x = sinI.
  const tx=nInto2.y,ty=-nInto2.x;
  return {tir:false,dir:{x:cosT*nInto2.x+sinT*tx,y:cosT*nInto2.y+sinT*ty}};
}

test('v40 classifyRun, capabilities, CLI bench-capabilities, and browser starter scene work cleanly',async()=>{
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v40EndpointsVerified:false
  }),'incomplete');
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v40EndpointsVerified:true
  }),'completed');

  const slim=opticalBenchCapabilities();
  assert.equal(slim.schemaVersion,OPTICAL_BENCH_V40_VERSION);
  assert.equal(slim.model,OPTICAL_BENCH_V40_MODEL);
  assert.equal(slim.maxRayDepth,V40_MAX_RAY_DEPTH);
  assert.deepEqual(capabilities().opticalBench,slim);

  const cliOut=JSON.parse(execFileSync(process.execPath,['scripts/author-scene.mjs','bench-capabilities'],{cwd:root,encoding:'utf8'}));
  assert.deepEqual(cliOut,slim);

  // Verify browser starter exists in scenes/, public/index.html, and matches examples/native-optical-bench.json physics.
  assert.ok(html.includes('option value="native-optical-bench"'));
  const starterDoc=parseSave(starterSceneText);
  validate(starterDoc);
  assert.equal(starterDoc.schemaVersion,40);
  assert.equal(starterDoc.physics.model,OPTICAL_BENCH_V40_MODEL);
  assert.equal(starterDoc.physics.backgroundIndex,1);
  assert.equal(starterDoc.simulation.maxRayDepth,16);
  assert.equal(starterDoc.simulation.randomSeed,V40_DEFAULT_RANDOM_SEED);

  const {document:fromExample}=prepareScene(exampleRequest);
  assert.deepEqual(fromExample.physics,starterDoc.physics);
  assert.deepEqual(fromExample.simulation,starterDoc.simulation);

  const reqs=[
    {id:'s1',kind:'source-emissions',componentId:'S1'},
    {id:'s2',kind:'source-emissions',componentId:'S2'},
    {id:'c1',kind:'interface-interactions',componentId:'C1'},
    {id:'sl1',kind:'interface-interactions',componentId:'SL1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(starterDoc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  assert.equal(run.summary.native.undefinedBehavior,0);
  const byId=Object.fromEntries((await evaluateObservables(starterDoc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.s1.value,1);
  assert.equal(byId.s2.value,1);
  assert.equal(byId.c1.value,2); // 1 exit per interior source; return rays clear C1
  assert.equal(byId.sl1.value,8); // 2 rays * (2 forward + 2 return)
  assert.equal(byId.m1.value,2);
  assert.equal(byId.d1.value,4); // 2 forward + 2 return crossings
  assert.equal(byId.hits.value.length,4);
  // Also confirm starter uses >8 encounters per ray (10 encounters), proving depth-16 capability:
  const depth8Doc=structuredClone(starterDoc);
  depth8Doc.simulation.maxRayDepth=8;
  const depth8Run=await evaluateDocument(depth8Doc,core,reqs);
  assert.equal(depth8Run.summary.executionPassed,false);
  assert.equal(depth8Run.summary.native.status,'incomplete');
});

test('Family 1 oracle: interior source inside circular dielectric -> ideal thin lens -> detector',async()=>{
  // Source at (0, 6) inside radius-15 circle centered at (0, 0), n_in = 1.5, backgroundIndex = 1.
  // Ray exits horizontally right, refracts at curved boundary, crosses ideal thin lens at x = 40 (f = 80),
  // hits vertical detector at x = 90.
  const R=15,y0=6,nIn=1.5,nOut=1,xLens=40,fLens=80,xDet=90;
  const xExit=Math.sqrt(R*R-y0*y0);
  const nOutward={x:xExit/R,y:y0/R};
  const afterCircle=snellStep({x:1,y:0},nOutward,nIn,nOut);
  assert.equal(afterCircle.tir,false);
  const slope1=afterCircle.dir.y/afterCircle.dir.x;
  const yLens=y0+(xLens-xExit)*slope1;
  // Exact PhyDemo IdealLens mapping: ray through (xLens, yLens) with incoming slope1
  // goes through the focal point (xLens + fLens, fLens * slope1):
  // slope2 = (fLens * slope1 - yLens) / fLens = slope1 - yLens / fLens.
  const slope2=slope1-yLens/fLens;
  const expectedYDet=yLens+(xDet-xLens)*slope2;

  const {document:doc}=prepareScene(v40Req([
    {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:R,insideIndex:nIn,outsideIndex:nOut,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:xLens,y:0,focalLength:fLens,apertureHeight:60}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:80}}
  ]));
  const reqs=[
    {id:'c1',kind:'interface-first-event',componentId:'C1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.equal(run.summary.observations.v40OpticalIncidentsById.L1,1);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.c1.value.from,'inside');
  assert.equal(byId.c1.value.outcome,'transmission');
  assert.equal(byId.hits.value.length,1);
  assert.ok(Math.abs(byId.hits.value[0].pointMm.y-expectedYDet)<1e-6,
    `Expected y=${expectedYDet}, got ${byId.hits.value[0].pointMm.y}`);
});

test('Family 2 oracle: interior triangular-prism source -> TIR on hypotenuse -> base exit -> ideal lens -> detector',async()=>{
  // Right isosceles prism: V1=(0,0), V2=(40,0), V3=(0,40). Hypotenuse is x + y = 40.
  // Interior source at (10, 10), shooting straight up (+90 deg).
  // Hits hypotenuse at (10, 30) with incidence angle 45 deg (> critical angle arcsin(1/1.5) = 41.81 deg) -> pure TIR!
  // After TIR on x+y=40, upward ray (0,1) reflects to (-1,0) leftward, hitting vertical face x=0 at (0, 30)
  // at normal incidence -> exits straight left (-1,0)!
  // Let's also make it oblique (85 deg) so BOTH TIR AND non-trivial Snell exit refraction + thin-lens bending are tested!
  // Source at (8, 8), direction 85 deg (d = (cos85, sin85)):
  const deg=85*Math.PI/180;
  const d0={x:Math.cos(deg),y:Math.sin(deg)};
  // Hits hypotenuse x + y = 40 at t1 = (40 - 16) / (d0.x + d0.y):
  const t1=24/(d0.x+d0.y);
  const p1={x:8+t1*d0.x,y:8+t1*d0.y};
  const nHyp={x:Math.SQRT1_2,y:Math.SQRT1_2};
  const step1=snellStep(d0,nHyp,1.5,1); // sin(theta_i) = sin(40 deg) = 0.6428 < 2/3 -> wait! Let's use 95 deg so incidence is 50 deg > 41.81 deg!
  // Recompute cleanly with 95 deg:
  const deg95=95*Math.PI/180;
  const dir0={x:Math.cos(deg95),y:Math.sin(deg95)};
  const th=(40-16)/(dir0.x+dir0.y);
  const pHyp={x:8+th*dir0.x,y:8+th*dir0.y};
  const afterTir=snellStep(dir0,nHyp,1.5,1);
  assert.equal(afterTir.tir,true);
  // Hits left vertical face x = 0 (outward normal (-1, 0)):
  const tx=(0-pHyp.x)/afterTir.dir.x;
  const pExit={x:0,y:pHyp.y+tx*afterTir.dir.y};
  assert.ok(pExit.y>1&&pExit.y<39);
  const afterExit=snellStep(afterTir.dir,{x:-1,y:0},1.5,1);
  assert.equal(afterExit.tir,false);
  // Left-going ray hits ideal lens at x = -30 (f = 100), then vertical detector at x = -70:
  const xLens=-30,fLens=100,xDet=-70;
  const slopeBefore=afterExit.dir.y/afterExit.dir.x; // dy/dx
  const yLens=pExit.y+(xLens-0)*slopeBefore;
  // For a left-going ray (dx < 0), PhyDemo IdealLens bends ray toward axis:
  // In propagation coordinate s = -x, incoming slope m_in = dy/ds = -slopeBefore,
  // outgoing slope m_out = m_in - yLens / fLens, so dy/dx = -m_out = slopeBefore + yLens / fLens.
  const slopeAfter=slopeBefore+yLens/fLens;
  const expectedYDet=yLens+(xDet-xLens)*slopeAfter;

  const {document:doc}=prepareScene(v40Req([
    {id:'PR1',type:'triangular-prism',parameters:{x1:0,y1:0,x2:40,y2:0,x3:0,y3:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:8,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:95}},
    {id:'L1',type:'ideal-lens',parameters:{x:xLens,y:0,focalLength:fLens,apertureHeight:100}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:120}}
  ]));
  const reqs=[
    {id:'tir',kind:'interface-tir-count',componentId:'PR1'},
    {id:'cnt',kind:'interface-interactions',componentId:'PR1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.tir.value,1);
  assert.equal(byId.cnt.value,2); // 1 TIR on hypotenuse + 1 transmission on x=0
  assert.equal(byId.hits.value.length,1);
  assert.ok(Math.abs(byId.hits.value[0].pointMm.y-expectedYDet)<1e-6,
    `Expected y=${expectedYDet}, got ${byId.hits.value[0].pointMm.y}`);
});

test('Family 3 oracle: two-body return, index-matched neutral slab, and 2 -> 1 -> 0 structural deletion closure',async()=>{
  // Exact analytical predictions from the architectural debate:
  // B1: circle center (0,0), R=10, n=1.5; S1 inside at (0,4), dir=0 deg.
  // B2: rectangular slab x in [20,40], y in [-20,20], n=1.6.
  // M1: vertical mirror at x=50, length=40; D1: vertical detector at x=15, y in [-16,-8].
  const r=Math.sqrt(21);
  const u=(r-6)/6;
  const w=(3*r-8)/25;
  const v=-(w/1.6)/Math.sqrt(1-(w/1.6)**2);
  const a=4+(20-2*r)*u;
  const yFull=a+25*u+40*v;         // ~ -10.273531748953 mm
  const yNoSlab=a+65*u;            // ~ -13.915026264881 mm

  const {document:fullDoc}=prepareScene(v40Req([
    {id:'B1',type:'circular-dielectric',parameters:{x:0,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:4,brightness:0.1},emission:{mode:'single-ray',directionDeg:0}},
    {id:'B2',type:'polygon-dielectric',parameters:{x1:20,y1:-20,x2:40,y2:-20,x3:40,y3:20,x4:20,y4:20,insideIndex:1.6,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:50,y:0,orientationDeg:90,length:40}},
    {id:'D1',type:'ray-detector',parameters:{x:15,y:-12,orientationDeg:90,length:8}}
  ],{runPolicy:'preview-v1'})); // 7 encounters fits inside depth=8 too!

  const fullReqs=[
    {id:'b1',kind:'interface-interactions',componentId:'B1'},
    {id:'b2',kind:'interface-interactions',componentId:'B2'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const fullRun=await evaluateDocument(fullDoc,core,fullReqs);
  assert.equal(fullRun.summary.executionPassed,true);
  assert.equal(fullRun.summary.observations.v40EndpointsVerified,true);
  const fullById=Object.fromEntries((await evaluateObservables(fullDoc,fullReqs,fullRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(fullById.b1.value,1);
  assert.equal(fullById.b2.value,4); // 2 forward + 2 return slab crossings
  assert.equal(fullById.m1.value,1);
  assert.equal(fullById.d1.value,1);
  assert.ok(Math.abs(fullById.hits.value[0].pointMm.y-yFull)<1e-6);

  // Variant B: index-matched neutral slab (insideIndex = 1 === backgroundIndex).
  // Optically equivalent detector hit to deleted slab, while 4 slab interface crossings remain observed!
  const neutralDoc=reviseScene(fullDoc,{changes:[{id:'B2',section:'parameters',key:'insideIndex',value:1}]}).document;
  const neutralRun=await evaluateDocument(neutralDoc,core,fullReqs);
  assert.equal(neutralRun.summary.executionPassed,true);
  const neutralById=Object.fromEntries((await evaluateObservables(neutralDoc,fullReqs,neutralRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(neutralById.b2.value,4);
  assert.equal(neutralById.d1.value,1);
  assert.ok(Math.abs(neutralById.hits.value[0].pointMm.y-yNoSlab)<1e-6);

  // Variant C: structural deletion of B2 (2 -> 1 bodies), preserving backgroundIndex & randomSeed.
  const oneBodyDoc=reviseComponents(fullDoc,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'remove',id:'B2'}]
  }).document;
  assert.equal(oneBodyDoc.physics.backgroundIndex,1);
  assert.equal(oneBodyDoc.simulation.randomSeed,V40_DEFAULT_RANDOM_SEED);
  const oneBodyReqs=[
    {id:'b1',kind:'interface-interactions',componentId:'B1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const oneBodyRun=await evaluateDocument(oneBodyDoc,core,oneBodyReqs);
  assert.equal(oneBodyRun.summary.executionPassed,true);
  const oneBodyById=Object.fromEntries((await evaluateObservables(oneBodyDoc,oneBodyReqs,oneBodyRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(oneBodyById.b1.value,1);
  assert.equal(oneBodyById.d1.value,1);
  assert.ok(Math.abs(oneBodyById.hits.value[0].pointMm.y-yNoSlab)<1e-6);
  // Neutral-slab hit and deleted-slab hit agree to < 1e-9 mm:
  assert.ok(Math.abs(neutralById.hits.value[0].pointMm.y-oneBodyById.hits.value[0].pointMm.y)<1e-9);

  // Variant D: structural deletion of host circle B1 (1 -> 0 bodies!).
  // Source S1 now emits horizontally at y=4 in ambient air, reflects once off M1, misses D1 at y in [-16,-8].
  const zeroBodyDoc=reviseComponents(oneBodyDoc,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'remove',id:'B1'}]
  }).document;
  assert.equal(zeroBodyDoc.physics.backgroundIndex,1);
  const zeroBodyReqs=[
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'}
  ];
  const zeroBodyRun=await evaluateDocument(zeroBodyDoc,core,zeroBodyReqs);
  assert.equal(zeroBodyRun.summary.executionPassed,true);
  assert.equal(zeroBodyRun.summary.observations.v40EndpointsVerified,true);
  const zeroBodyById=Object.fromEntries((await evaluateObservables(zeroBodyDoc,zeroBodyReqs,zeroBodyRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(zeroBodyById.m1.value,1);
  assert.equal(zeroBodyById.d1.value,0);

  // Non-air ambient (water n=1.33) deletion & re-addition preserves backgroundIndex = 1.33:
  const {document:waterDoc}=prepareScene(v40Req([
    {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:15,insideIndex:1.6,outsideIndex:1.33,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:5,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'D1',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:40}}
  ],{backgroundIndex:1.33}));
  const waterEmpty=reviseComponents(waterDoc,{format:COMPONENT_REVISION_FORMAT,operations:[{op:'remove',id:'C1'}]}).document;
  assert.equal(waterEmpty.physics.backgroundIndex,1.33);
  // Adding a new body with mismatched outsideIndex=1 must fail, while outsideIndex=1.33 passes:
  assert.throws(()=>reviseComponents(waterEmpty,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'add',lengthUnit:'mm',component:{id:'C2',type:'circular-dielectric',parameters:{x:0,y:0,radius:15,insideIndex:1.5,outsideIndex:1,partialReflection:false}}}]
  }),/backgroundIndex/);
  const waterRestored=reviseComponents(waterEmpty,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'add',lengthUnit:'mm',component:{id:'C2',type:'circular-dielectric',parameters:{x:0,y:0,radius:15,insideIndex:1.5,outsideIndex:1.33,partialReflection:false}}}]
  }).document;
  assert.equal(waterRestored.physics.backgroundIndex,1.33);
});

test('Family 4: unfamiliar JEE compositions — equilateral prism + ideal lens + tilted mirror oracle, plus 4-lens parallel-beam bench',async()=>{
  // 4A: Unfamiliar composition: exterior ray enters 60-deg equilateral prism (n=1.5 in air),
  // exits right face, refracts through converging ideal thin lens at x=60 (f=120),
  // reflects off 45-deg plane mirror at (110, -20) downward onto a horizontal detector at y=-60.
  // Prism vertices: V1=(0,0), V2=(40,0), V3=(20, 20*sqrt(3) ≈ 34.64101615).
  const h=20*Math.sqrt(3);
  // Horizontal ray at y = 12 from S1=(-30, 12):
  // Left face V1->V3: x = y / sqrt(3) => enters at xIn = 12/sqrt(3) = 4*sqrt(3), y = 12.
  const xIn=12/Math.sqrt(3);
  // Outward normal of left face V1->V3 (from (0,0) to (20, 20*sqrt(3))): (-sqrt(3)/2, 1/2).
  // Normal pointing INTO glass is (+sqrt(3)/2, -1/2).
  const inGlass=snellStep({x:1,y:0},{x:Math.sqrt(3)/2,y:-0.5},1,1.5);
  assert.equal(inGlass.tir,false);
  // Right face V2->V3: line from (40,0) to (20,20*sqrt(3)) => sqrt(3)*x + y = 40*sqrt(3).
  const tRight=(40*Math.sqrt(3)-(Math.sqrt(3)*xIn+12))/(Math.sqrt(3)*inGlass.dir.x+inGlass.dir.y);
  const pOut={x:xIn+tRight*inGlass.dir.x,y:12+tRight*inGlass.dir.y};
  // Outward normal of right face: (+sqrt(3)/2, +1/2).
  const outAir=snellStep(inGlass.dir,{x:Math.sqrt(3)/2,y:0.5},1.5,1);
  assert.equal(outAir.tir,false);
  const slope1=outAir.dir.y/outAir.dir.x;
  const xLens=60,fLens=120;
  const yLens=pOut.y+(xLens-pOut.x)*slope1;
  const slope2=slope1-yLens/fLens;
  // Tilted 105-deg plane mirror placed along the post-lens ray at xMir = 85:
  // A down-right ray (~-45 deg) reflecting off a 105-deg tangent mirror exits at ~2*105 - (-45) = 255 deg (-105 deg, steeply downward)
  // onto a horizontal detector at y = -80 without returning to the prism.
  const xMir=85;
  const yMir=yLens+slope2*(xMir-xLens);
  const len2=Math.hypot(1,slope2);
  const d2={x:1/len2,y:slope2/len2};
  const mirDeg=105,phi=mirDeg*Math.PI/180;
  const nMir={x:-Math.sin(phi),y:Math.cos(phi)};
  const dn=d2.x*nMir.x+d2.y*nMir.y;
  const dRefl={x:d2.x-2*dn*nMir.x,y:d2.y-2*dn*nMir.y};
  assert.ok(dRefl.y<-0.5,'Reflected ray should head cleanly downward');
  // Intersect horizontal detector at y = -80:
  const yDet=-80;
  const tDet=(yDet-yMir)/dRefl.y;
  const expectedXDet=xMir+tDet*dRefl.x;

  const {document:unfamiliarDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-30,y:12,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'PR1',type:'triangular-prism',parameters:{x1:0,y1:0,x2:40,y2:0,x3:20,y3:h,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'L1',type:'ideal-lens',parameters:{x:xLens,y:0,focalLength:fLens,apertureHeight:100}},
    {id:'M1',type:'plane-mirror',parameters:{x:xMir,y:yMir,orientationDeg:mirDeg,length:40}},
    {id:'D1',type:'ray-detector',parameters:{x:expectedXDet,y:yDet,orientationDeg:0,length:50}}
  ]));
  const reqs=[
    {id:'pr',kind:'interface-interactions',componentId:'PR1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(unfamiliarDoc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(unfamiliarDoc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.pr.value,2);
  assert.equal(byId.m1.value,1);
  assert.equal(byId.hits.value.length,1);
  assert.ok(Math.abs(byId.hits.value[0].pointMm.x-expectedXDet)<1e-5,
    `Expected x=${expectedXDet}, got ${byId.hits.value[0].pointMm.x}`);

  // 4B: Parallel beam + 4 coaxial ideal lenses + finite glass slab + opaque stop + curved mirror + detector!
  // Demonstrates v40 preserves parallel-beam AND 0..4 ideal lenses AND immersed backgroundIndex = 1.33.
  const {document:fourLensDoc}=prepareScene(v40Req([
    {id:'B1',type:'parallel-beam',parameters:{x:-220,y:0,width:20,directionDeg:0,brightness:0.2}},
    {id:'L1',type:'ideal-lens',parameters:{x:-160,y:0,focalLength:300,apertureHeight:90}},
    {id:'L2',type:'ideal-lens',parameters:{x:-110,y:0,focalLength:-400,apertureHeight:90}},
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:-60,y1:-50,x2:-20,y2:-50,x3:-20,y3:50,x4:-60,y4:50,insideIndex:1.6,outsideIndex:1.33,partialReflection:false}},
    {id:'L3',type:'ideal-lens',parameters:{x:20,y:0,focalLength:250,apertureHeight:90}},
    {id:'L4',type:'ideal-lens',parameters:{x:70,y:0,focalLength:250,apertureHeight:90}},
    {id:'A1',type:'finite-aperture',parameters:{x:110,y:0,orientationDeg:90,length:100,openingLength:60}},
    {id:'CM1',type:'circular-arc-mirror',parameters:{x:190,y:0,normalDeg:180,radius:240,apertureHeight:90}},
    {id:'D1',type:'ray-detector',parameters:{x:135,y:0,orientationDeg:90,length:110}}
  ],{backgroundIndex:1.33}));
  const beamReqs=[
    {id:'b1',kind:'source-emissions',componentId:'B1'},
    {id:'sl1',kind:'interface-interactions',componentId:'SL1'},
    {id:'cm1',kind:'mirror-reflections',componentId:'CM1'},
    {id:'d1',kind:'detector-crossings',componentId:'D1'}
  ];
  const beamRun=await evaluateDocument(fourLensDoc,core,beamReqs);
  assert.equal(beamRun.summary.executionPassed,true);
  assert.equal(beamRun.summary.observations.v40EndpointsVerified,true);
  assert.equal(beamRun.summary.observations.v40OpticalIncidentsById.L1,8); // 4 forward + 4 return (15 encounters/ray <= 16!)
  assert.equal(beamRun.summary.observations.v40OpticalIncidentsById.L4,8);
  const beamById=Object.fromEntries((await evaluateObservables(fourLensDoc,beamReqs,beamRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(beamById.b1.value,4);
  assert.equal(beamById.sl1.value,16); // 4 rays * (2 forward + 2 return)
  assert.equal(beamById.cm1.value,4);
  assert.equal(beamById.d1.value,8); // 4 forward + 4 return!
});

test('v40 deterministic randomSeed replay, parameter sweeps at maxRayDepth=16, and exploration notebook replay',async()=>{
  const {document:base}=prepareScene(v40Req([
    {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:35,y1:-30,x2:65,y2:-30,x3:65,y3:30,x4:35,y4:30,insideIndex:1.55,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:90,y:0,orientationDeg:90,length:80}}
  ],{randomSeed:'jee-demo-seed-42'}));
  assert.equal(base.simulation.randomSeed,'jee-demo-seed-42');
  assert.equal(base.simulation.maxRayDepth,16);

  // Confirm randomSeed is passed to native PhyDemo Scene and survives round-trip export.
  const loaded=core.loadDocument(base);
  assert.equal(loaded.scene.randomSeed,'jee-demo-seed-42');
  const reqs=[
    {id:'hits',kind:'detector-hit-events',componentId:'D1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const r1=await evaluateDocument(base,core,reqs);
  const r2=await evaluateDocument(base,core,reqs);
  assert.equal(r1.summary.executionPassed,true);
  assert.deepEqual(r1.summary.observations.detectorHitEventsById,r2.summary.observations.detectorHitEventsById);

  // Parameter sweep works at v40 maxRayDepth=16 without rejecting sweep budget:
  const q=initialQualification(base,null,{inputSha256:await sceneHash(base)});
  const bundle=await createQualifiedBundle(base,q,reqs);
  const sweep=await runParameterSweep(bundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:bundle.sceneSha256,
    parameter:{id:'SL1',section:'parameters',key:'insideIndex'},
    values:[1,1.5,1.8,4.5],
    observables:reqs
  },{execute:doc=>evaluateDocument(doc,core,reqs)});
  assert.equal(sweep.status,'completed-with-failed-samples');
  assert.equal(sweep.completedSamples,3);
  assert.equal(sweep.failedSamples,1);
  assert.equal(sweep.samples[3].status,'invalid-input');

  // Exploration notebook + fresh replay works cleanly on v40:
  const snap=await snapshotScenario(bundle,r1,'Baseline');
  const notebook=await createExplorationNotebook([snap]);
  const replayed=await replayExplorationNotebook(notebook,{
    run:(doc,obs)=>evaluateDocument(doc,core,obs)
  });
  assert.equal(replayed.status,'all-native-qualified');
  assert.equal(replayed.newNativeQualified,1);
});

test('v40 negative controls: exact membership boundaries, mismatched ambient, spherical interior, grazing/critical/Fresnel guards, and legacy isolation',async()=>{
  const circle={id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const prism={id:'PR1',type:'triangular-prism',parameters:{x1:0,y1:0,x2:20,y2:0,x3:0,y3:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const thick={id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:20,centerThickness:10,frontRadius:20,backRadius:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};

  // 1. Missing backgroundIndex in authoring request -> rejected.
  assert.throws(()=>prepareScene({
    model:OPTICAL_BENCH_V40_MODEL,lengthUnit:'mm',
    components:[{id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}]
  }),/backgroundIndex/);

  // 2. Mismatched body outsideIndex vs backgroundIndex -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    circle,
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ],{backgroundIndex:1.33})),/backgroundIndex/);

  // 3. Invalid randomSeed in authoring or canonical JSON -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ],{randomSeed:'   '})),/randomSeed/);
  const {document:validV40}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ]));
  const missingSeed=structuredClone(validV40);
  delete missingSeed.simulation.randomSeed;
  assert.throws(()=>validate(missingSeed),/randomSeed/);
  const missingBg=structuredClone(validV40);
  delete missingBg.physics.backgroundIndex;
  assert.throws(()=>validate(missingBg),/backgroundIndex/);

  // 4. Circle boundary band (< 0.01 mm inside OR outside) -> rejected.
  for(const y of [9.995,10.005]){
    assert.throws(()=>prepareScene(v40Req([
      circle,
      {id:'S1',type:'point-source',parameters:{x:0,y,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
    ])),/0\.01 mm from dielectric body boundary/);
  }

  // 5. Exact convex-polygon exterior corner distance:
  // Right-angle corner at (0,0): (-0.005, -0.005) has Euclidean dist 0.00707 < 0.01 -> rejected;
  // (-0.008, -0.008) has Euclidean dist 0.01131 >= 0.01 -> admitted!
  assert.throws(()=>prepareScene(v40Req([
    prism,
    {id:'S1',type:'point-source',parameters:{x:-0.005,y:-0.005,brightness:0.2},emission:{mode:'single-ray',directionDeg:180}}
  ])),/0\.01 mm from dielectric body boundary/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    prism,
    {id:'S1',type:'point-source',parameters:{x:-0.008,y:-0.008,brightness:0.2},emission:{mode:'single-ray',directionDeg:180}}
  ])));
  // Interior boundary band inside prism (x=0.005, y=5) -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    prism,
    {id:'S1',type:'point-source',parameters:{x:0.005,y:5,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ])),/0\.01 mm from dielectric body boundary/);

  // 6. Spherical-lens interior source -> rejected (exterior-only in M1).
  assert.throws(()=>prepareScene(v40Req([
    thick,
    {id:'S1',type:'point-source',parameters:{x:0,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ])),/outside spherical-lens/);

  // 7. Parallel beam intersecting dielectric body -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    circle,
    {id:'B1',type:'parallel-beam',parameters:{x:0,y:0,width:12,directionDeg:0,brightness:0.2}}
  ])),/Parallel emitter must lie completely outside/);

  // 8. Cardinality bounds: >2 bodies or >4 ideal lenses -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'C1',type:'circular-dielectric',parameters:{x:-40,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'C2',type:'circular-dielectric',parameters:{x:0,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'C3',type:'circular-dielectric',parameters:{x:40,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/0–2 disjoint finite dielectrics/);
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:-80,y:0,focalLength:100,apertureHeight:40}},
    {id:'L2',type:'ideal-lens',parameters:{x:-40,y:0,focalLength:100,apertureHeight:40}},
    {id:'L3',type:'ideal-lens',parameters:{x:0,y:0,focalLength:100,apertureHeight:40}},
    {id:'L4',type:'ideal-lens',parameters:{x:40,y:0,focalLength:100,apertureHeight:40}},
    {id:'L5',type:'ideal-lens',parameters:{x:80,y:0,focalLength:100,apertureHeight:40}}
  ])),/0–4 vertical ideal lenses/);

  // 9. Near-critical TIR and near-grazing dielectric incidence guards fail closed:
  // Slab x in [0,40], y in [-40,40], n=1.5 -> choose sin(theta) = (1 - 5e-7)/1.5 so |n_i sin(theta) - n_t| = 5e-7 <= 1e-6
  // while cos(theta_t) ~ 1e-3 >> 1e-10 (proving the v40 near-critical margin guard triggers specifically).
  const nearCritDeg=Math.asin((1-5e-7)/1.5)*180/Math.PI;
  const {document:nearCritDoc}=prepareScene(v40Req([
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:0,y1:-40,x2:40,y2:-40,x3:40,y3:40,x4:0,y4:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:nearCritDeg}}
  ]));
  const critRun=await evaluateDocument(nearCritDoc,core,[{id:'sl',kind:'interface-interactions',componentId:'SL1'}]);
  assert.equal(critRun.summary.executionPassed,false);
  assert.equal(critRun.report.native.diagnostics.v40EndpointsVerified,false);
  assert.match(critRun.summary.native.errors.join(' '),/near-critical/);

  // Near-grazing incidence onto top face y=0 of a tall slab x in [0,1000], y in [-40,0]:
  // source at (200, 0.02) aiming slightly downward at -0.004 deg -> |d·n| = sin(0.004 deg) ~ 6.98e-5 <= 1e-4,
  // hitting face at x ~ 200 + 0.02/6.98e-5 ~ 486.5 mm (far from corners 0 and 1000).
  const {document:nearGrazeDoc}=prepareScene(v40Req([
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:0,y1:-40,x2:1000,y2:-40,x3:1000,y3:0,x4:0,y4:0,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:200,y:0.02,brightness:0.2},emission:{mode:'single-ray',directionDeg:-0.004}}
  ]));
  const grazeRun=await evaluateDocument(nearGrazeDoc,core,[{id:'sl',kind:'interface-interactions',componentId:'SL1'}]);
  assert.equal(grazeRun.summary.executionPassed,false);
  assert.equal(grazeRun.report.native.diagnostics.v40EndpointsVerified,false);
  assert.match(grazeRun.summary.native.errors.join(' '),/grazing/);

  // 10. Fresnel partialReflection=true truncation withholds accepted measurements cleanly:
  const {document:fresnelDoc}=prepareScene(v40Req([
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:0,y1:-40,x2:40,y2:-40,x3:40,y3:40,x4:0,y4:40,insideIndex:1.5,outsideIndex:1,partialReflection:true}},
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'D1',type:'ray-detector',parameters:{x:60,y:0,orientationDeg:90,length:40}}
  ]));
  const fresnelRun=await evaluateDocument(fresnelDoc,core,[{id:'d1',kind:'detector-crossings',componentId:'D1'}]);
  assert.equal(fresnelRun.summary.executionPassed,false);
  assert.equal(fresnelRun.summary.native.status,'incomplete');
  assert.equal(fresnelRun.summary.observations,null);

  // 11. Legacy isolation: unmarked requests keep old schema versions, bench-v40 policy refused on non-v40,
  // and v39 keeps its depth<=8 ceiling.
  const v7=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      circle
    ]
  });
  assert.equal(v7.document.schemaVersion,7);
  assert.throws(()=>prepareScene({
    lengthUnit:'mm',runPolicy:'bench-v40',
    components:[{id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},circle]
  }),/UNSUPPORTED_POLICY|registered/);
  const v39Doc=parseSave(readFileSync(resolve(root,'scenes/native-general-hybrid-bench.json'),'utf8'));
  v39Doc.simulation.maxRayDepth=16;
  assert.throws(()=>validate(v39Doc),/maxRayDepth/);
});

test('v40 P2-1 regression: exact corner clearance for circle/polygon bodies, circle blockers, curved mirrors, and diagonal polygons',async()=>{
  const sq={id:'B1',type:'polygon-dielectric',parameters:{x1:0,y1:0,x2:20,y2:0,x3:20,y3:20,x4:0,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const ray={id:'S1',type:'point-source',parameters:{x:-30,y:10,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}};

  // Positive witness from PR #260 R1 P2-1:
  // Circle centered at (-2, -2) with R = 2 has exact clearance sqrt(8) - 2 ~ 0.8284 mm (> 80x 0.01 mm) from square B1.
  const {document:cornerCircleDoc}=prepareScene(v40Req([
    sq,
    {id:'C1',type:'circular-dielectric',parameters:{x:-2,y:-2,radius:2,insideIndex:1.4,outsideIndex:1,partialReflection:false}},
    ray
  ]));
  const cornerRun=await evaluateDocument(cornerCircleDoc,core,[
    {id:'b1',kind:'interface-interactions',componentId:'B1'},
    {id:'c1',kind:'interface-interactions',componentId:'C1'}
  ]);
  assert.equal(cornerRun.summary.executionPassed,true);
  assert.equal(cornerRun.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(cornerCircleDoc,[
    {id:'b1',kind:'interface-interactions',componentId:'B1'},
    {id:'c1',kind:'interface-interactions',componentId:'C1'}
  ],cornerRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.b1.value,2);
  assert.equal(byId.c1.value,0);

  // Positive witness for circle-blocker and curved-mirror bounding disk placed safely beyond a polygon corner:
  assert.doesNotThrow(()=>prepareScene(v40Req([
    sq,
    {id:'K1',type:'circle-blocker',parameters:{x:-2,y:-2,radius:2}},
    {id:'CM1',type:'ideal-curved-mirror',parameters:{x:25,y:25,normalDeg:-135,focalLength:20,apertureHeight:10}},
    ray
  ])));

  // Positive witness for two diagonally separated convex polygons (corner gap 2*sqrt(2) ~ 2.83 mm):
  assert.doesNotThrow(()=>prepareScene(v40Req([
    sq,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:-22,y1:-22,x2:-2,y2:-22,x3:-2,y3:-2,x4:-22,y4:-2,insideIndex:1.4,outsideIndex:1,partialReflection:false}},
    ray
  ])));

  // Negative controls: nested circle, near-corner (< 0.01 mm), overlapping near-corner circle/blocker, and overlapping diagonal polygon.
  for(const [label,cx,cy] of [
    ['nested circle inside polygon',10,10],
    ['near-corner circle (< 0.01 mm clearance)',-1.42,-1.42],
    ['overlapping near-corner circle',-1.4,-1.4]
  ]){
    assert.throws(()=>prepareScene(v40Req([
      sq,
      {id:'C1',type:'circular-dielectric',parameters:{x:cx,y:cy,radius:2,insideIndex:1.4,outsideIndex:1,partialReflection:false}},
      ray
    ])),/Finite dielectric bodies must be disjoint/,label);
  }
  assert.throws(()=>prepareScene(v40Req([
    sq,
    {id:'K1',type:'circle-blocker',parameters:{x:-1.4,y:-1.4,radius:2}},
    ray
  ])),/opaque circle must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    sq,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:-20.005,y1:-20.005,x2:-0.005,y2:-20.005,x3:-0.005,y3:-0.005,x4:-20.005,y4:-0.005,insideIndex:1.4,outsideIndex:1,partialReflection:false}},
    ray
  ])),/Finite dielectric bodies must be disjoint/);
});

test('Milestone 2A oracle: decentered ideal-lens.y exact deflection, transverse shift via reviseScene, and rim guard',async()=>{
  // Source at (-100, 10) shooting at +10 deg into decentered lens L1 at (x=0, y=25, f=60, aperture=50),
  // detector at x=120.
  const x0=-100,y0=10,deg=10*Math.PI/180,m1=Math.tan(deg);
  const xL=0,yL=25,f=60,xD=120;
  const yHit=y0+(xL-x0)*m1;
  const m2=m1-(yHit-yL)/f;
  const expectedY=yHit+(xD-xL)*m2;

  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:x0,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:10}},
    {id:'L1',type:'ideal-lens',parameters:{x:xL,y:yL,focalLength:f,apertureHeight:50}},
    {id:'D1',type:'ray-detector',parameters:{x:xD,y:0,orientationDeg:90,length:200}}
  ]));
  const reqs=[{id:'hits',kind:'detector-hit-events',componentId:'D1'}];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const res=(await evaluateObservables(doc,reqs,run.summary)).results[0];
  assert.equal(res.value.length,1);
  assert.ok(Math.abs(res.value[0].pointMm.y-expectedY)<1e-6,
    `Expected y=${expectedY}, got ${res.value[0].pointMm.y}`);

  // Shift L1.y by -10 mm via reviseScene -> detector hit must shift by (xD - xL) * (-10) / f = -20 mm!
  const shifted=reviseScene(doc,{changes:[{id:'L1',section:'parameters',key:'y',value:15,unit:'mm'}]}).document;
  const shiftRun=await evaluateDocument(shifted,core,reqs);
  assert.equal(shiftRun.summary.executionPassed,true);
  const shiftRes=(await evaluateObservables(shifted,reqs,shiftRun.summary)).results[0];
  assert.ok(Math.abs((shiftRes.value[0].pointMm.y-res.value[0].pointMm.y)-(-20))<1e-6);

  // Missing y on v40 ideal-lens -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:60,apertureHeight:50}}
  ])),/y/);

  // Initial ray hitting decentered lens upper rim (y = 25 + 25 = 50) within 0.01 mm -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-100,y:50.005,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:25,focalLength:60,apertureHeight:50}}
  ])),/finite component endpoint|ideal-lens rim/);
});

test('Milestone 2A oracle: JEE Billet split-lens (two lenses at same x=0) with directional fan produces two exact real images',async()=>{
  // Object S1 at (-120, 0), directional cone 36 deg -> hits upper lens L1 (x=0, y=+22, f=80, ap=40 -> y in [2,42])
  // and lower lens L2 (x=0, y=-22, f=80, ap=40 -> y in [-42,-2]), leaving a 4 mm central gap.
  // Thin-lens equation: u = 120, f = 80 -> v = 240, m = -2 -> images at (240, +66) and (240, -66)!
  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:36}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:22,focalLength:80,apertureHeight:40}},
    {id:'L2',type:'ideal-lens',parameters:{x:0,y:-22,focalLength:80,apertureHeight:40}},
    {id:'D1',type:'ray-detector',parameters:{x:240,y:0,orientationDeg:90,length:200}}
  ]));
  const reqs=[
    {id:'emit',kind:'source-emissions',componentId:'S1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.ok(run.summary.observations.v40OpticalIncidentsById.L1>=4);
  assert.ok(run.summary.observations.v40OpticalIncidentsById.L2>=4);

  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.hits.value.length,byId.emit.value);
  const upperImageHits=byId.hits.value.filter(e=>Math.abs(e.pointMm.y-66)<1e-5);
  const lowerImageHits=byId.hits.value.filter(e=>Math.abs(e.pointMm.y+66)<1e-5);
  const gapHits=byId.hits.value.filter(e=>Math.abs(e.pointMm.y)<6);
  assert.equal(upperImageHits.length,run.summary.observations.v40OpticalIncidentsById.L1);
  assert.equal(lowerImageHits.length,run.summary.observations.v40OpticalIncidentsById.L2);
  assert.equal(upperImageHits.length+lowerImageHits.length+gapHits.length,byId.emit.value);

  // Overlapping lenses at the same x=0 -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:36}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:15,focalLength:80,apertureHeight:40}},
    {id:'L2',type:'ideal-lens',parameters:{x:0,y:-15,focalLength:80,apertureHeight:40}}
  ])),/finite segments intersect or nearly touch/);
});

test('Milestone 2A oracle: JEE Snell window — interior directional fan inside water tank splits cleanly into transmission vs TIR',async()=>{
  // Interior directional fan at (0, -20) inside water tank x in [-55, 55], y in [-40, 0], n=1.33, backgroundIndex=1.
  // Because n = 1.33 has critical angle arcsin(1/1.33) = 48.7535 deg > 45 deg, every top-face TIR ray hits the
  // vertical sidewall at 90 - theta < 41.25 deg < theta_c and exits cleanly (no trapped 4-wall TIR loop).
  // At rayDensity=0.2 (3.6 deg step), symmetric 120 deg cone emits 34 rays from -60 to +58.8 deg:
  // 27 rays (|theta| <= 48.0 deg) transmit out the top face into D1 at y=10;
  // 7 rays (-60, -56.4, -52.8, -49.2, +51.6, +55.2, +58.8 deg) undergo exactly 1 top-face TIR and exit the sidewall!
  const {document:doc}=prepareScene(v40Req([
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:-55,y1:-40,x2:55,y2:-40,x3:55,y3:0,x4:-55,y4:0,insideIndex:1.33,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:-20,brightness:0.2},emission:{mode:'directional',directionDeg:90,angleDeg:120}},
    {id:'D1',type:'ray-detector',parameters:{x:0,y:10,orientationDeg:0,length:280}}
  ]));
  const reqs=[
    {id:'emit',kind:'source-emissions',componentId:'S1'},
    {id:'tir',kind:'interface-tir-count',componentId:'SL1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.emit.value,34);
  assert.equal(byId.det.value,27);
  assert.equal(byId.tir.value,7);
  assert.equal(byId.det.value+byId.tir.value,byId.emit.value);
});

test('Milestone 2A: full-circle (360 deg) source in v40 and reviseScene source-mode transitions',async()=>{
  // Full-circle interior source inside a circular dielectric surrounded by an external detector.
  const {document:doc}=prepareScene(v40Req([
    {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:25,insideIndex:1.4,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:0,brightness:0.2},emission:{mode:'full-circle'}},
    {id:'D1',type:'ray-detector',parameters:{x:50,y:0,orientationDeg:90,length:80}}
  ]));
  const reqs=[
    {id:'emit',kind:'source-emissions',componentId:'S1'},
    {id:'c1',kind:'interface-interactions',componentId:'C1'},
    {id:'det',kind:'detector-crossings',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.emit.value,100); // 0.2 * 500 = 100 radial rays, all normal to C1!
  assert.equal(byId.c1.value,100);
  assert.ok(byId.det.value>15&&byId.det.value<35);

  // reviseScene mode transitions: single-ray -> directional requires explicit angleDeg; succeeds when supplied.
  const {document:singleDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-80,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'D1',type:'ray-detector',parameters:{x:50,y:0,orientationDeg:90,length:100}}
  ]));
  assert.throws(()=>reviseScene(singleDoc,{
    changes:[{id:'S1',section:'emission',key:'mode',value:'directional'}]
  }),/explicit angleDeg/);
  const dirDoc=reviseScene(singleDoc,{
    changes:[
      {id:'S1',section:'emission',key:'mode',value:'directional'},
      {id:'S1',section:'emission',key:'angleDeg',value:24}
    ]
  }).document;
  assert.equal(dirDoc.physics.components[0].emission.mode,'directional');
  assert.equal(dirDoc.physics.components[0].emission.angleDeg,24);
  const dirRun=await evaluateDocument(dirDoc,core,[{id:'det',kind:'detector-crossings',componentId:'D1'}]);
  assert.equal(dirRun.summary.executionPassed,true);
  assert.ok(dirRun.summary.observations.detectorsById.D1.crossings>=6);

  // Legacy v37 isolation (PR #261 R1 P2-1): v37 reviseScene retains its prior single-ray -> directional
  // transition without forcing a duplicate angleDeg edit when angleDeg was already authored.
  const {document:v37Single}=prepareScene({
    model:'native-general-optical-bench',lengthUnit:'mm',
    components:[{
      id:'S1',type:'point-source',
      parameters:{x:-80,y:0,brightness:0.2},
      emission:{mode:'single-ray',directionDeg:0,angleDeg:24}
    }]
  });
  const v37Dir=reviseScene(v37Single,{
    changes:[{id:'S1',section:'emission',key:'mode',value:'directional'}]
  }).document;
  assert.equal(v37Dir.schemaVersion,37);
  assert.equal(v37Dir.physics.components[0].emission.mode,'directional');
  assert.equal(v37Dir.physics.components[0].emission.angleDeg,24);
});

// Independent exact 2-surface spherical-lens ray tracer for Milestone 2B physical oracles.
// Uses outward-convex sign convention (+R convex outward, -R concave inward, null flat).
function traceThickLensOracle(origin,dir,lens,xDet){
  const {x,y,centerThickness:d,frontRadius:rf,backRadius:rb,insideIndex:nIn,outsideIndex:nOut}=lens;
  const frontApex=x-d/2,backApex=x+d/2;
  const hitFace=(p,u,apex,R,isFront)=>{
    if(R===null){
      const t=(apex-p.x)/u.x;
      return {point:{x:apex,y:p.y+t*u.y},outwardNormal:{x:isFront?-1:1,y:0}};
    }
    const cx=isFront?apex+R:apex-R,cy=y,absR=Math.abs(R),sgn=Math.sign(R);
    const ox=p.x-cx,oy=p.y-cy;
    const b=ox*u.x+oy*u.y,c=ox*ox+oy*oy-absR*absR;
    const disc=b*b-c;
    assert.ok(disc>0,'Oracle ray must hit curved face');
    const s=Math.sqrt(disc);
    const ts=[-b-s,-b+s].filter(t=>t>1e-9).filter(t=>{
      const hx=p.x+t*u.x;
      return isFront?(sgn>0?hx<=cx:hx>=cx):(sgn>0?hx>=cx:hx<=cx);
    });
    assert.ok(ts.length>=1,'Oracle ray must meet the expected arc hemisphere');
    const t=Math.min(...ts);
    const point={x:p.x+t*u.x,y:p.y+t*u.y};
    const outwardNormal={x:sgn*(point.x-cx)/absR,y:sgn*(point.y-cy)/absR};
    return {point,outwardNormal};
  };
  const f1=hitFace(origin,dir,frontApex,rf,true);
  const nIntoGlass={x:-f1.outwardNormal.x,y:-f1.outwardNormal.y};
  const step1=snellStep(dir,nIntoGlass,nOut,nIn);
  assert.equal(step1.tir,false);
  const f2=hitFace(f1.point,step1.dir,backApex,rb,false);
  const step2=snellStep(step1.dir,f2.outwardNormal,nIn,nOut);
  assert.equal(step2.tir,false);
  const tDet=(xDet-f2.point.x)/step2.dir.x;
  return {
    front:f1,
    back:f2,
    outDir:step2.dir,
    yDet:f2.point.y+tDet*step2.dir.y
  };
}

test('Milestone 2B oracle: signed/flat spherical-lens — plano-convex (both orientations), positive & negative meniscus, and biconcave lenses',async()=>{
  const cases=[
    {name:'plano-convex (flat front, convex back)',y0:10,xDet:120,lens:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:null,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:-1},
    {name:'plano-convex (convex front, flat back)',y0:10,xDet:120,lens:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:null,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:-1},
    {name:'plano-concave (flat front, concave back)',y0:8,xDet:100,lens:{x:0,y:0,apertureHeight:40,centerThickness:8,frontRadius:null,backRadius:-50,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:+1},
    {name:'plano-concave (concave front, flat back)',y0:8,xDet:100,lens:{x:0,y:0,apertureHeight:40,centerThickness:8,frontRadius:-50,backRadius:null,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:+1},
    {name:'converging meniscus (+40 front, -80 back)',y0:8,xDet:120,lens:{x:0,y:0,apertureHeight:36,centerThickness:10,frontRadius:40,backRadius:-80,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:-1},
    {name:'diverging meniscus (+80 front, -40 back)',y0:8,xDet:120,lens:{x:0,y:0,apertureHeight:36,centerThickness:10,frontRadius:80,backRadius:-40,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:+1},
    {name:'biconcave (-50 front, -50 back)',y0:8,xDet:100,lens:{x:0,y:0,apertureHeight:40,centerThickness:8,frontRadius:-50,backRadius:-50,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:+1},
    {name:'flat-flat zero-power slab control (null, null)',y0:8,xDet:100,lens:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:null,backRadius:null,insideIndex:1.5,outsideIndex:1,partialReflection:false},expectSign:0}
  ];

  const planoY=[];
  for(const tc of cases){
    const oracle=traceThickLensOracle({x:-60,y:tc.y0},{x:1,y:0},tc.lens,tc.xDet);
    if(tc.expectSign<0)assert.ok(oracle.outDir.y<-0.01,tc.name+' should converge');
    if(tc.expectSign>0)assert.ok(oracle.outDir.y>0.01,tc.name+' should diverge');
    if(tc.expectSign===0)assert.ok(Math.abs(oracle.outDir.y)<1e-12,tc.name+' should stay horizontal');

    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-60,y:tc.y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'TL1',type:'spherical-lens',parameters:tc.lens},
      {id:'D1',type:'ray-detector',parameters:{x:tc.xDet,y:0,orientationDeg:90,length:200}}
    ]));
    // Confirm canonical JSON round-trip preserves null flat radii cleanly.
    const reparsed=parseSave(serializeSave(doc));
    validate(reparsed);
    assert.deepEqual(reparsed.physics,doc.physics);

    const reqs=[
      {id:'faces',kind:'interface-face-events',componentId:'TL1'},
      {id:'hits',kind:'detector-hit-events',componentId:'D1'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true,tc.name);
    assert.equal(run.summary.observations.v40EndpointsVerified,true,tc.name);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.equal(byId.hits.value.length,1,tc.name);
    assert.ok(Math.abs(byId.hits.value[0].pointMm.y-oracle.yDet)<1e-5,
      `${tc.name}: expected y=${oracle.yDet}, got ${byId.hits.value[0].pointMm.y}`);
    assert.equal(byId.faces.value['front-arc'].interactions,1,tc.name);
    assert.equal(byId.faces.value['back-arc'].interactions,1,tc.name);
    assert.ok(Math.hypot(
      byId.faces.value['front-arc'].first.outwardNormal.x-oracle.front.outwardNormal.x,
      byId.faces.value['front-arc'].first.outwardNormal.y-oracle.front.outwardNormal.y
    )<1e-5,tc.name+' front outward normal');
    assert.ok(Math.hypot(
      byId.faces.value['back-arc'].first.outwardNormal.x-oracle.back.outwardNormal.x,
      byId.faces.value['back-arc'].first.outwardNormal.y-oracle.back.outwardNormal.y
    )<1e-5,tc.name+' back outward normal');
    if(tc.name.startsWith('plano-convex'))planoY.push(byId.hits.value[0].pointMm.y);
  }
  // Classic JEE spherical-aberration / principal-plane asymmetry: orienting the curved face
  // toward the collimated ray yields a distinct marginal intercept from the flat-front orientation.
  assert.ok(Math.abs(planoY[0]-planoY[1])>0.05,`Expected distinct plano-convex intercepts, got ${planoY[0]} vs ${planoY[1]}`);

  // Oblique flat-flat slab oracle in non-unit ambient (backgroundIndex = 1.2, insideIndex = 1.6):
  // Proves emergent ray stays strictly parallel to incoming 20 deg ray with exact Snell lateral shift.
  const theta1=20*Math.PI/180,nOut=1.2,nIn=1.6,d=16,x0=-40,y0=-10,xDet=60;
  const theta2=Math.asin((nOut/nIn)*Math.sin(theta1));
  const expectedShiftY=y0+(xDet-x0)*Math.tan(theta1)-d*(Math.tan(theta1)-Math.tan(theta2));
  const {document:obliqueFlat}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:x0,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:20}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:60,centerThickness:d,frontRadius:null,backRadius:null,insideIndex:nIn,outsideIndex:nOut,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:120}}
  ],{backgroundIndex:nOut}));
  const oblReqs=[{id:'hits',kind:'detector-hit-events',componentId:'D1'}];
  const oblRun=await evaluateDocument(obliqueFlat,core,oblReqs);
  assert.equal(oblRun.summary.executionPassed,true);
  assert.equal(oblRun.summary.observations.v40EndpointsVerified,true);
  const oblHits=(await evaluateObservables(obliqueFlat,oblReqs,oblRun.summary)).results[0].value;
  assert.equal(oblHits.length,1);
  assert.ok(Math.abs(oblHits[0].pointMm.y-expectedShiftY)<1e-6,
    `Oblique flat-flat slab expected y=${expectedShiftY}, got ${oblHits[0].pointMm.y}`);
  assert.ok(Math.hypot(oblHits[0].incomingUnit.x-Math.cos(theta1),oblHits[0].incomingUnit.y-Math.sin(theta1))<1e-6,
    'Emergent ray from parallel flat-flat faces must remain parallel to incoming ray');
});

test('Milestone 2B: signed spherical-lens revisions, cm units, flat-baseline sweep, concave AABB clearance, and legacy v15/v38 isolation',async()=>{
  const {document:base}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:6,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:120,y:0,orientationDeg:90,length:200}}
  ]));
  // Revise biconvex -> plano-convex (null) -> meniscus (-60) -> biconcave (-60, -60):
  const plano=reviseScene(base,{changes:[{id:'TL1',section:'parameters',key:'frontRadius',value:null}]}).document;
  assert.equal(plano.physics.components[1].parameters.frontRadius,null);
  const meniscus=reviseScene(plano,{changes:[{id:'TL1',section:'parameters',key:'frontRadius',value:-6,unit:'cm'}]}).document;
  assert.equal(meniscus.physics.components[1].parameters.frontRadius,-60);
  const biconcave=reviseScene(meniscus,{changes:[{id:'TL1',section:'parameters',key:'backRadius',value:-60,unit:'mm'}]}).document;
  assert.equal(biconcave.physics.components[1].parameters.backRadius,-60);

  // Add a signed plano-concave lens via reviseComponents in cm units:
  const withSecond=reviseComponents(plano,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{
      op:'add',lengthUnit:'cm',
      component:{id:'TL2',type:'spherical-lens',parameters:{x:4,y:0,apertureHeight:4,centerThickness:1,frontRadius:null,backRadius:-5,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    }]
  }).document;
  const tl2=withSecond.physics.components.find(c=>c.id==='TL2');
  assert.equal(tl2.parameters.frontRadius,null);
  assert.equal(tl2.parameters.backRadius,-50);
  const twoRun=await evaluateDocument(withSecond,core,[{id:'hits',kind:'detector-hit-events',componentId:'D1'}]);
  assert.equal(twoRun.summary.executionPassed,true);

  // Sweep frontRadius starting from a plano-convex (frontRadius: null) baseline across concave & convex radii:
  const reqs=[{id:'hits',kind:'detector-hit-events',componentId:'D1'},{id:'det',kind:'detector-crossings',componentId:'D1'}];
  const q=initialQualification(plano,null,{inputSha256:await sceneHash(plano)});
  const planoBundle=await createQualifiedBundle(plano,q,reqs);
  const sweep=await runParameterSweep(planoBundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:planoBundle.sceneSha256,
    parameter:{id:'TL1',section:'parameters',key:'frontRadius',unit:'mm'},
    values:[-60,-40,40,60,-10],
    observables:reqs
  },{execute:doc=>evaluateDocument(doc,core,reqs)});
  assert.equal(sweep.status,'completed-with-failed-samples');
  assert.equal(sweep.completedSamples,4);
  assert.equal(sweep.failedSamples,1);
  assert.equal(sweep.samples[4].status,'invalid-input');

  // Concave protruding rim AABB guard:
  // Biconcave at x=0, d=8, ap=40, R=-50 has frontApex=-4 but frontRim ~ -8.174 mm.
  // Source at (-7, 0) lies inside the conservative AABB and MUST be rejected; source at (-9, 0) is admitted.
  const biconcaveLens={id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:8,frontRadius:-50,backRadius:-50,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  assert.throws(()=>prepareScene(v40Req([
    biconcaveLens,
    {id:'S1',type:'point-source',parameters:{x:-7,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ])),/outside spherical-lens/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    biconcaveLens,
    {id:'S1',type:'point-source',parameters:{x:-9,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ])));

  // Invalid |radius| < halfAperture + 1 or zero radius -> rejected in v40:
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:-20,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/half-aperture \+ 1/);
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:0,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/INVALID_INPUT|bounds/);

  // Legacy isolation: v15 and v38 MUST still reject negative and null spherical-lens radii!
  for(const badR of [-50,null]){
    assert.throws(()=>prepareScene({
      lengthUnit:'mm',
      components:[
        {id:'S1',type:'point-source',parameters:{x:-60,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
        {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:badR,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
      ]
    }),/Expected a finite numeric value|outside the live contract bounds/);
    assert.throws(()=>prepareScene({
      model:'native-general-refractive-bench',lengthUnit:'mm',
      components:[
        {id:'S1',type:'point-source',parameters:{x:-60,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
        {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:badR,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
      ]
    }),/Expected a finite numeric value|outside the live contract bounds/);
  }
});

test('Milestone 2B: finite-segment clearance in v40 admits side-by-side / L-shaped JEE setups while preserving segment and endpoint safety',async()=>{
  // Source S1 at (0, 0) lies directly on the infinite line extension x = 0 of:
  // - vertical mirror M1 at (0, 45, orientationDeg=90, length=20 -> y in [35, 55])
  // - decentered ideal-lens L1 at (0, -35, f=50, ap=20 -> y in [-45, -25])
  // - finite-aperture A1 at (0, 0, orientationDeg=90, length=40, openingLength=10 -> arms [-20,-5] and [5,20])
  // Ray from S1 at +30 deg clears A1's opening, reflects off M2 at (40, 20) -> (40, 40/sqrt(3)),
  // hits M1 squarely at (0, 80/sqrt(3) ~ 46.188), and reflects right-up at +30 deg onto D1 at x = 30
  // at exact y = 110 / sqrt(3) ~ 63.50853 mm!
  const expectedY=110/Math.sqrt(3);
  const {document:lShapeDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:0,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:30}},
    {id:'A1',type:'finite-aperture',parameters:{x:0,y:0,orientationDeg:90,length:40,openingLength:10}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:-35,focalLength:50,apertureHeight:20}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:45,orientationDeg:90,length:20}},
    {id:'M2',type:'plane-mirror',parameters:{x:40,y:20,orientationDeg:90,length:60}},
    {id:'D1',type:'ray-detector',parameters:{x:30,y:65,orientationDeg:90,length:40}}
  ]));
  const reqs=[
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'m2',kind:'mirror-reflections',componentId:'M2'},
    {id:'a1',kind:'blocker-absorptions',componentId:'A1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(lShapeDoc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(lShapeDoc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.m1.value,1);
  assert.equal(byId.m2.value,1);
  assert.equal(byId.a1.value,0);
  assert.equal(byId.hits.value.length,1);
  assert.ok(Math.abs(byId.hits.value[0].pointMm.y-expectedY)<1e-5,
    `Expected y=${expectedY}, got ${byId.hits.value[0].pointMm.y}`);

  // Negative controls:
  // 1. Source within 0.01 mm of actual finite mirror segment -> rejected.
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:0.005,y:45,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:45,orientationDeg:90,length:20}}
  ])),/at least 0\.01 mm from finite segment/);
  // 2. Source on supporting line aiming collinearly into mirror endpoint -> rejected by endpoint guard!
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:0,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:90}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:45,orientationDeg:90,length:20}}
  ])),/finite component endpoint/);
  // 3. Parallel beam within 0.01 mm of finite mirror segment -> rejected; parallel beam clear of segment on same line -> admitted!
  assert.throws(()=>prepareScene(v40Req([
    {id:'B1',type:'parallel-beam',parameters:{x:0,y:45,width:12,directionDeg:0,brightness:0.2}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:45,orientationDeg:90,length:20}}
  ])),/clearance from finite segment/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    {id:'B1',type:'parallel-beam',parameters:{x:0,y:0,width:12,directionDeg:0,brightness:0.2}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:45,orientationDeg:90,length:20}}
  ])));
});

test('Milestone 2B end-to-end v40 exploration: prepareExplorationProposal (revise + 2->1->0 structure), compareScenario, and notebook replay',async()=>{
  const {document:baseDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-70,y:8,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:12}},
    {id:'TL1',type:'spherical-lens',parameters:{x:-10,y:0,apertureHeight:44,centerThickness:12,frontRadius:null,backRadius:60,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'SL1',type:'polygon-dielectric',parameters:{x1:20,y1:-35,x2:40,y2:-35,x3:40,y3:35,x4:20,y4:35,insideIndex:1.6,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:90,y:0,orientationDeg:90,length:140}}
  ]));
  const reqs=[
    {id:'cross',kind:'detector-crossings',componentId:'D1'},
    {id:'power',kind:'detector-signed-power',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const baseQual=initialQualification(baseDoc,null,{inputSha256:await sceneHash(baseDoc)});
  const baseBundle=await createQualifiedBundle(baseDoc,baseQual,reqs);
  const baseRun=await evaluateDocument(baseDoc,core,reqs);
  assert.equal(baseRun.summary.executionPassed,true);
  const baseSnap=await snapshotScenario(baseBundle,baseRun,'Baseline');

  // Step 1: Parameter edit proposal — convert plano-convex TL1 into biconvex (+60, +60).
  const pRevise=await prepareExplorationProposal(baseBundle,{
    format:'opticsim-exploration-proposal-v1',
    expectedIntegritySha256:baseBundle.integritySha256,
    intent:'Compare plano-convex against biconvex lens with same back curvature',
    action:'revise',
    patch:{changes:[{id:'TL1',section:'parameters',key:'frontRadius',value:60,unit:'mm'}]}
  });
  const reviseRun=await evaluateDocument(pRevise.child.scene,core,reqs);
  assert.equal(reviseRun.summary.executionPassed,true);
  const reviseSnap=await snapshotScenario(pRevise.child,reviseRun,'Biconvex TL1',{
    intent:pRevise.proposal.intent,parentIntegritySha256:baseBundle.integritySha256
  });

  // Step 2: Structural deletion 2 -> 1 bodies (remove slab SL1) inside v40 without schema change.
  const pOneBody=await prepareExplorationProposal(baseBundle,{
    format:'opticsim-exploration-proposal-v1',
    expectedIntegritySha256:baseBundle.integritySha256,
    intent:'Remove glass slab SL1 to isolate the plano-convex lens alone',
    action:'structure',
    patch:{format:COMPONENT_REVISION_FORMAT,operations:[{op:'remove',id:'SL1'}]}
  });
  assert.equal(pOneBody.child.scene.schemaVersion,40);
  assert.equal(pOneBody.child.scene.physics.backgroundIndex,1);
  const oneBodyRun=await evaluateDocument(pOneBody.child.scene,core,reqs);
  assert.equal(oneBodyRun.summary.executionPassed,true);
  const oneBodySnap=await snapshotScenario(pOneBody.child,oneBodyRun,'Remove SL1 (1 body)',{
    intent:pOneBody.proposal.intent,parentIntegritySha256:baseBundle.integritySha256
  });

  // Step 3: Structural deletion 1 -> 0 bodies (remove TL1 as well) inside v40.
  const pZeroBody=await prepareExplorationProposal(pOneBody.child,{
    format:'opticsim-exploration-proposal-v1',
    expectedIntegritySha256:pOneBody.child.integritySha256,
    intent:'Remove lens TL1 too to observe free-space propagation',
    action:'structure',
    patch:{format:COMPONENT_REVISION_FORMAT,operations:[{op:'remove',id:'TL1'}]}
  });
  assert.equal(pZeroBody.child.scene.schemaVersion,40);
  assert.equal(pZeroBody.child.scene.physics.backgroundIndex,1);
  const zeroBodyRun=await evaluateDocument(pZeroBody.child.scene,core,reqs);
  assert.equal(zeroBodyRun.summary.executionPassed,true);
  const zeroBodySnap=await snapshotScenario(pZeroBody.child,zeroBodyRun,'Free space (0 bodies)',{
    intent:pZeroBody.proposal.intent,parentIntegritySha256:pOneBody.child.integritySha256
  });

  // Verify compareScenario honestly records Fresnel-off warning qualification on dielectric variants
  // while still confirming accepted evidence, same model/numerics, and distinct physics:
  for(const variant of [reviseSnap,oneBodySnap,zeroBodySnap]){
    const cmp=await compareScenario(baseSnap,variant);
    assert.equal(cmp.evidenceChecks.baseline.accepted,true);
    assert.equal(cmp.evidenceChecks.scenario.accepted,true);
    assert.equal(cmp.samePhysics,false);
    assert.equal(cmp.sameNumerics,true);
    const byKind=Object.fromEntries(cmp.entries.map(e=>[e.kind,e]));
    assert.equal(byKind['detector-crossings'].conditions.samePhysicalModel,true);
    assert.equal(byKind['detector-crossings'].comparison,'not-comparable');
    assert.match(byKind['detector-crossings'].reason,/warning qualifications/);
  }

  // Export portable input-only notebook and freshly replay all 4 v40 entries + 3 baseline comparisons:
  const notebook=await createExplorationNotebook([baseSnap,reviseSnap,oneBodySnap,zeroBodySnap]);
  const replayed=await replayExplorationNotebook(notebook,{
    run:(doc,obs)=>evaluateDocument(doc,core,obs)
  });
  assert.equal(replayed.status,'all-native-qualified');
  assert.equal(replayed.newNativeQualified,4);
  assert.equal(replayed.comparisonsMade,3);
  assert.equal(replayed.comparisonsWithheld,0);
  assert.ok(replayed.comparisons.every(c=>c.status==='compared'));

  // And on a warning-free v40 scene (no Fresnel-off approximation), compareScenario returns
  // full 'sampled-native-comparison' across both reviseScene and structural reviseComponents!
  const {document:cleanBase}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-80,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:20}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:5,focalLength:80,apertureHeight:60}},
    {id:'D1',type:'ray-detector',parameters:{x:100,y:0,orientationDeg:90,length:120}}
  ]));
  const cleanReqs=[
    {id:'cross',kind:'detector-crossings',componentId:'D1'},
    {id:'power',kind:'detector-signed-power',componentId:'D1'}
  ];
  const cleanBundle=await createQualifiedBundle(cleanBase,initialQualification(cleanBase,null,{inputSha256:await sceneHash(cleanBase)}),cleanReqs);
  const cleanRun=await evaluateDocument(cleanBase,core,cleanReqs);
  const cleanSnap=await snapshotScenario(cleanBundle,cleanRun,'Baseline');

  const cleanRemoved=await prepareExplorationProposal(cleanBundle,{
    format:'opticsim-exploration-proposal-v1',
    expectedIntegritySha256:cleanBundle.integritySha256,
    intent:'Remove ideal lens L1 to compare free-space detector crossings',
    action:'structure',
    patch:{format:COMPONENT_REVISION_FORMAT,operations:[{op:'remove',id:'L1'}]}
  });
  const cleanRemovedRun=await evaluateDocument(cleanRemoved.child.scene,core,cleanReqs);
  const cleanRemovedSnap=await snapshotScenario(cleanRemoved.child,cleanRemovedRun,'No L1',{
    intent:cleanRemoved.proposal.intent,parentIntegritySha256:cleanBundle.integritySha256
  });
  const cleanCmp=await compareScenario(cleanSnap,cleanRemovedSnap);
  assert.equal(cleanCmp.evidenceChecks.baseline.accepted,true);
  assert.equal(cleanCmp.evidenceChecks.scenario.accepted,true);
  const cleanByKind=Object.fromEntries(cleanCmp.entries.map(e=>[e.kind,e]));
  assert.equal(cleanByKind['detector-crossings'].comparison,'sampled-native-comparison');
  assert.equal(cleanByKind['detector-signed-power'].comparison,'sampled-native-comparison');
});

test('Milestone 2B P2-2 regression: focusedExplorationContext & capabilities accurately expose schema-specific spherical-lens contracts',async()=>{
  // 1. Full capabilities() documents both legacy positive-only and v40 signed/flat spherical-lens contracts.
  const fullCaps=capabilities();
  assert.match(fullCaps.componentTypes['spherical-lens'].geometry,/v40/);
  assert.match(fullCaps.componentTypes['spherical-lens'].geometry,/null/);
  assert.deepEqual(fullCaps.componentTypes['spherical-lens'].schemaVariants.v40.nullableParameters,['frontRadius','backRadius']);

  // 2. Focused exploration context for v40 spherical-lens + ideal-lens baseline exposes v40 signed/null radii and ideal-lens y.
  const {document:v40Doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'L1',type:'ideal-lens',parameters:{x:40,y:5,focalLength:80,apertureHeight:40}}
  ]));
  const v40Bundle=await createQualifiedBundle(v40Doc,initialQualification(v40Doc,null,{inputSha256:await sceneHash(v40Doc)}),[]);
  const v40Focused=await focusedExplorationContext(v40Bundle,'Make TL1 plano-concave with flat front and concave back');
  const v40Spherical=v40Focused.authoring.componentTypes['spherical-lens'];
  assert.deepEqual(v40Spherical.nullableParameters,['frontRadius','backRadius']);
  assert.deepEqual(v40Spherical.faceIds,['front-arc','back-arc','top-rim','bottom-rim']);
  assert.match(v40Spherical.geometry,/negative values \(concave inward\)/);
  assert.match(v40Spherical.geometry,/null \(flat\/planar face/);
  assert.doesNotMatch(v40Spherical.geometry,/positive-only/);
  assert.equal(Object.hasOwn(v40Spherical,'schemaVariants'),false);
  assert.deepEqual(v40Focused.authoring.componentTypes['ideal-lens'].parameters,['x','y','focalLength','apertureHeight']);

  // Full explorationContext retains v40 opticalBench capabilities too.
  const v40Full=await explorationContext(v40Bundle,'Compare plano-concave TL1');
  assert.match(v40Full.authoring.opticalBench.components.finiteDielectrics.types['spherical-lens'].note,/null is a flat/);

  // 3. Focused exploration context for legacy v15 and v38 spherical-lens baselines retains positive-only biconvex contract!
  const {document:v15Doc}=prepareScene({
    lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-60,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  const {document:v38Doc}=prepareScene({
    model:'native-general-refractive-bench',lengthUnit:'mm',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-60,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  for(const legacyDoc of [v15Doc,v38Doc]){
    const legacyBundle=await createQualifiedBundle(legacyDoc,initialQualification(legacyDoc,null,{inputSha256:await sceneHash(legacyDoc)}),[]);
    const legacyFocused=await focusedExplorationContext(legacyBundle,'Change frontRadius');
    const legacySpherical=legacyFocused.authoring.componentTypes['spherical-lens'];
    assert.equal(Object.hasOwn(legacySpherical,'nullableParameters'),false);
    assert.equal(Object.hasOwn(legacySpherical,'schemaVariants'),false);
    assert.match(legacySpherical.geometry,/legacy positive-only contract/);
    assert.match(legacySpherical.geometry,/neither negative nor null/);
  }
});

// Independent ray-circle / reflection helper for Milestone 3 silvered-lens and cemented-doublet oracles.
function hitCurvedOrFlatFace(p,u,apex,R,yAxis,isFront){
  if(R===null){
    const t=(apex-p.x)/u.x;
    return {point:{x:apex,y:p.y+t*u.y},outwardNormal:{x:isFront?-1:1,y:0}};
  }
  const cx=isFront?apex+R:apex-R,cy=yAxis,absR=Math.abs(R),sgn=Math.sign(R);
  const ox=p.x-cx,oy=p.y-cy;
  const b=ox*u.x+oy*u.y,c=ox*ox+oy*oy-absR*absR;
  const s=Math.sqrt(b*b-c);
  const ts=[-b-s,-b+s].filter(t=>t>1e-9).filter(t=>{
    const hx=p.x+t*u.x;
    return isFront?(sgn>0?hx<=cx:hx>=cx):(sgn>0?hx>=cx:hx<=cx);
  });
  const t=Math.min(...ts);
  const point={x:p.x+t*u.x,y:p.y+t*u.y};
  return {point,outwardNormal:{x:sgn*(point.x-cx)/absR,y:sgn*(point.y-cy)/absR}};
}
function reflectDir(d,n){
  const dn=d.x*n.x+d.y*n.y;
  return {x:d.x-2*dn*n.x,y:d.y-2*dn*n.y};
}

test('Milestone 3 oracle: layered media (water resting on glass) — transmission, merged TIR, order invariance, and true merged near-critical audit',async()=>{
  const glass={id:'B1',type:'polygon-dielectric',parameters:{x1:-50,y1:-30,x2:50,y2:-30,x3:50,y3:0,x4:-50,y4:0,insideIndex:1.6,outsideIndex:1,partialReflection:false}};
  const water={id:'B2',type:'polygon-dielectric',parameters:{x1:-50,y1:0,x2:50,y2:0,x3:50,y3:20,x4:-50,y4:20,insideIndex:1.33,outsideIndex:1,partialReflection:false}};

  // 1A: Source inside glass at (0, -15) shooting at 65 deg (theta1 = 25 deg from +y normal) -> glass(1.6) -> water(1.33) -> air(1) -> detector at y=35.
  const th1=25*Math.PI/180;
  const th2=Math.asin((1.6/1.33)*Math.sin(th1));
  const th3=Math.asin(1.6*Math.sin(th1));
  const expectedX=15*Math.tan(th1)+20*Math.tan(th2)+15*Math.tan(th3);
  const det={id:'D1',type:'ray-detector',parameters:{x:20,y:35,orientationDeg:0,length:100}};
  const src={id:'S1',type:'point-source',parameters:{x:0,y:-15,brightness:0.2},emission:{mode:'single-ray',directionDeg:65}};

  // Verify BOTH component orders ([B1, B2] and [B2, B1]) agree to < 1e-6 mm and report true merged indices (1.6 -> 1.33)!
  for(const [orderName,pair,primaryId,secondaryId] of [
    ['glass-first',[glass,water],'B1','B2'],
    ['water-first',[water,glass],'B2','B1']
  ]){
    const {document:doc}=prepareScene(v40Req([...pair,src,det]));
    const reqs=[
      {id:'first',kind:'interface-first-event',componentId:primaryId},
      {id:'hits',kind:'detector-hit-events',componentId:'D1'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true,orderName);
    assert.equal(run.summary.observations.v40EndpointsVerified,true,orderName);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.equal(byId.hits.value.length,1,orderName);
    assert.ok(Math.abs(byId.hits.value[0].pointMm.x-expectedX)<1e-6,
      `${orderName}: expected x=${expectedX}, got ${byId.hits.value[0].pointMm.x}`);
    assert.equal(byId.first.value.incidentIndex,1.6,orderName);
    assert.equal(byId.first.value.destinationIndex,1.33,orderName);
    assert.equal(byId.first.value.mergedWithId,secondaryId,orderName);
  }

  // 1B: Merged glass->water TIR (theta1 = 60 deg > arcsin(1.33/1.6) = 56.23 deg).
  // Source at (0, -10) shooting at +30 deg: hits y=0 at x=10*sqrt(3), TIRs to -30 deg,
  // hits right sidewall x=40 at y = -(40 - 10*sqrt(3))/sqrt(3) = 10 - 40/sqrt(3) ~ -13.094 (inside [-20,0]),
  // exits glass(1.6)->air(1) at 30 deg incidence -> sin(theta_out)=1.6*0.5=0.8 -> hits detector at x=60!
  const gTir={id:'B1',type:'polygon-dielectric',parameters:{x1:-40,y1:-20,x2:40,y2:-20,x3:40,y3:0,x4:-40,y4:0,insideIndex:1.6,outsideIndex:1,partialReflection:false}};
  const wTir={id:'B2',type:'polygon-dielectric',parameters:{x1:-40,y1:0,x2:40,y2:0,x3:40,y3:20,x4:-40,y4:20,insideIndex:1.33,outsideIndex:1,partialReflection:false}};
  const yWall=10-40/Math.sqrt(3);
  const sinOut=1.6*0.5,tanOut=sinOut/Math.sqrt(1-sinOut*sinOut);
  const expectedTirY=yWall-20*tanOut;
  const {document:tirDoc}=prepareScene(v40Req([
    gTir,wTir,
    {id:'S1',type:'point-source',parameters:{x:0,y:-10,brightness:0.2},emission:{mode:'single-ray',directionDeg:30}},
    {id:'D1',type:'ray-detector',parameters:{x:60,y:-30,orientationDeg:90,length:80}}
  ]));
  const tirReqs=[
    {id:'tir',kind:'interface-tir-count',componentId:'B1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const tirRun=await evaluateDocument(tirDoc,core,tirReqs);
  assert.equal(tirRun.summary.executionPassed,true);
  assert.equal(tirRun.summary.observations.v40EndpointsVerified,true);
  const tirById=Object.fromEntries((await evaluateObservables(tirDoc,tirReqs,tirRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(tirById.tir.value,1);
  assert.equal(tirById.hits.value.length,1);
  assert.ok(Math.abs(tirById.hits.value[0].pointMm.y-expectedTirY)<1e-6);

  // 1C: Merged near-critical audit checks TRUE glass-water critical angle (1.4/1.6), NOT glass-air (1/1.6)!
  // Source at (25, -10) shooting at exact glass-air critical angle crosses y=0 at x~33.01 into water(n=1.4)
  // at theta_w~45.58 deg and exits the right sidewall x=50 at y~16.65 (angle 44.42 deg < 45.58 deg critical) cleanly!
  const glassAirCritFromVert=Math.asin(1/1.6)*180/Math.PI;
  const water14={id:'B2',type:'polygon-dielectric',parameters:{x1:-50,y1:0,x2:50,y2:0,x3:50,y3:25,x4:-50,y4:25,insideIndex:1.4,outsideIndex:1,partialReflection:false}};
  const {document:notCritMerged}=prepareScene(v40Req([
    glass,water14,
    {id:'S1',type:'point-source',parameters:{x:25,y:-10,brightness:0.2},emission:{mode:'single-ray',directionDeg:90-glassAirCritFromVert}}
  ]));
  const safeMergedRun=await evaluateDocument(notCritMerged,core,[{id:'b1',kind:'interface-interactions',componentId:'B1'}]);
  assert.equal(safeMergedRun.summary.executionPassed,true,'Glass-air critical angle must NOT falsely trip merged glass-water audit');

  // Near TRUE glass-water (1.6 -> 1.4) critical angle -> MUST fail closed with /near-critical/!
  const trueMergedNearCrit=Math.asin((1.4-5e-7)/1.6)*180/Math.PI;
  const {document:critMerged}=prepareScene(v40Req([
    glass,water14,
    {id:'S1',type:'point-source',parameters:{x:-30,y:-10,brightness:0.2},emission:{mode:'single-ray',directionDeg:90-trueMergedNearCrit}}
  ]));
  const critMergedRun=await evaluateDocument(critMerged,core,[{id:'b1',kind:'interface-interactions',componentId:'B1'}]);
  assert.equal(critMergedRun.summary.executionPassed,false);
  assert.equal(critMergedRun.report.native.diagnostics.v40EndpointsVerified,false);
  assert.match(critMergedRun.summary.native.errors.join(' '),/near-critical/);
});

test('Milestone 3 oracle: JEE silvered plano-convex lenses (flat-silvered and curved-silvered) match exact 3-step Snell+reflection oracles',async()=>{
  // 2A: Flat-silvered plano-convex lens: frontRadius=+60, backRadius=null, d=10, ap=40, n=1.5, x=0.
  // Plane mirror M1 flush on flat back face at x=+5, orientationDeg=90, length=40.
  const y0=6,xDet=-80,R=60,d=10,n=1.5;
  const f1a=hitCurvedOrFlatFace({x:-100,y:y0},{x:1,y:0},-d/2,R,0,true);
  const in1a=snellStep({x:1,y:0},{x:-f1a.outwardNormal.x,y:-f1a.outwardNormal.y},1,n);
  const tMirA=(d/2-f1a.point.x)/in1a.dir.x;
  const pMirA={x:d/2,y:f1a.point.y+tMirA*in1a.dir.y};
  const reflA=reflectDir(in1a.dir,{x:-1,y:0});
  const f2a=hitCurvedOrFlatFace(pMirA,reflA,-d/2,R,0,true);
  const outA=snellStep(reflA,f2a.outwardNormal,n,1);
  const expectedYA=f2a.point.y+((xDet-f2a.point.x)/outA.dir.x)*outA.dir.y;

  const {document:flatSilv}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-100,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:d,frontRadius:R,backRadius:null,insideIndex:n,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:d/2,y:0,orientationDeg:90,length:40}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:120}}
  ]));
  const reqs=[
    {id:'tl',kind:'interface-interactions',componentId:'TL1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const runA=await evaluateDocument(flatSilv,core,reqs);
  assert.equal(runA.summary.executionPassed,true);
  assert.equal(runA.summary.observations.v40EndpointsVerified,true);
  const byIdA=Object.fromEntries((await evaluateObservables(flatSilv,reqs,runA.summary)).results.map(r=>[r.id,r]));
  assert.equal(byIdA.tl.value,2); // front entry + front exit; back hit owned by flush mirror M1
  assert.equal(byIdA.m1.value,1);
  assert.equal(byIdA.hits.value.length,2); // 1 outgoing ray + 1 returning ray!
  const retA=byIdA.hits.value.find(h=>h.incomingUnit.x<0);
  assert.ok(retA&&Math.abs(retA.pointMm.y-expectedYA)<1e-5,
    `Flat-silvered expected y=${expectedYA}, got ${retA?.pointMm.y}`);

  // 2B: Curved-silvered plano-convex lens: frontRadius=null, backRadius=+60, d=10, ap=40, n=1.5, x=0.
  // Circular-arc mirror M1 concentric & flush on curved back face: x=+5, y=0, normalDeg=180, radius=+60, ap=40.
  const f1b=hitCurvedOrFlatFace({x:-100,y:y0},{x:1,y:0},-d/2,null,0,true); // normal entry, stays horizontal!
  const pMirB=hitCurvedOrFlatFace(f1b.point,{x:1,y:0},d/2,R,0,false);
  const reflB=reflectDir({x:1,y:0},pMirB.outwardNormal);
  const f2b=hitCurvedOrFlatFace(pMirB.point,reflB,-d/2,null,0,true);
  const outB=snellStep(reflB,f2b.outwardNormal,n,1);
  const expectedYB=f2b.point.y+((xDet-f2b.point.x)/outB.dir.x)*outB.dir.y;

  const {document:curvedSilv}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-100,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:d,frontRadius:null,backRadius:R,insideIndex:n,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:d/2,y:0,normalDeg:180,radius:R,apertureHeight:40}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:120}}
  ]));
  const runB=await evaluateDocument(curvedSilv,core,reqs);
  assert.equal(runB.summary.executionPassed,true);
  assert.equal(runB.summary.observations.v40EndpointsVerified,true);
  const byIdB=Object.fromEntries((await evaluateObservables(curvedSilv,reqs,runB.summary)).results.map(r=>[r.id,r]));
  assert.equal(byIdB.tl.value,2);
  assert.equal(byIdB.m1.value,1);
  const retB=byIdB.hits.value.find(h=>h.incomingUnit.x<0);
  assert.ok(retB&&Math.abs(retB.pointMm.y-expectedYB)<1e-5,
    `Curved-silvered expected y=${expectedYB}, got ${retB?.pointMm.y}`);
});

test('Milestone 3 oracle: silvered glass sphere, water-on-glass-on-mirror tank, and coaxial cemented doublet',async()=>{
  // 3A: Silvered glass sphere (R=30, n=1.5) with concentric rear circular-arc-mirror at (30, 0).
  const R=30,n=1.5,y0=6,xDet=-70;
  const xIn=-Math.sqrt(R*R-y0*y0);
  const nIn={x:-xIn/R,y:-y0/R}; // pointing into sphere
  const d1=snellStep({x:1,y:0},nIn,1,n).dir;
  // Hit right hemisphere of circle x^2+y^2=R^2 from (xIn, y0):
  const b1=xIn*d1.x+y0*d1.y;
  const t1=-2*b1;
  const pMir={x:xIn+t1*d1.x,y:y0+t1*d1.y};
  const d2=reflectDir(d1,{x:pMir.x/R,y:pMir.y/R});
  const b2=pMir.x*d2.x+pMir.y*d2.y;
  const t2=-2*b2;
  const pOut={x:pMir.x+t2*d2.x,y:pMir.y+t2*d2.y};
  const d3=snellStep(d2,{x:pOut.x/R,y:pOut.y/R},n,1).dir;
  const expectedSphereY=pOut.y+((xDet-pOut.x)/d3.x)*d3.y;

  const {document:sphereDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-80,y:y0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:R,insideIndex:n,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:R,y:0,normalDeg:180,radius:R,apertureHeight:30}},
    {id:'D1',type:'ray-detector',parameters:{x:xDet,y:0,orientationDeg:90,length:100}}
  ]));
  const sphereReqs=[
    {id:'c1',kind:'interface-interactions',componentId:'C1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const sphereRun=await evaluateDocument(sphereDoc,core,sphereReqs);
  assert.equal(sphereRun.summary.executionPassed,true);
  assert.equal(sphereRun.summary.observations.v40EndpointsVerified,true);
  const sById=Object.fromEntries((await evaluateObservables(sphereDoc,sphereReqs,sphereRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(sById.c1.value,2);
  assert.equal(sById.m1.value,1);
  const sphereRet=sById.hits.value.find(h=>h.incomingUnit.x<0);
  assert.ok(sphereRet&&Math.abs(sphereRet.pointMm.y-expectedSphereY)<1e-5);

  // 3B: 3-component contact stack — water (y in [15,35], n=1.33) on glass (y in [0,15], n=1.6) on bottom mirror (y=0).
  const thA=30*Math.PI/180,thW=Math.asin(Math.sin(thA)/1.33),thG=Math.asin(Math.sin(thA)/1.6);
  const expectedTankX=-40+2*(20*Math.tan(thA)+20*Math.tan(thW)+15*Math.tan(thG));
  const {document:tankDoc}=prepareScene(v40Req([
    {id:'B1',type:'polygon-dielectric',parameters:{x1:-50,y1:0,x2:50,y2:0,x3:50,y3:15,x4:-50,y4:15,insideIndex:1.6,outsideIndex:1,partialReflection:false}},
    {id:'B2',type:'polygon-dielectric',parameters:{x1:-50,y1:15,x2:50,y2:15,x3:50,y3:35,x4:-50,y4:35,insideIndex:1.33,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:0,length:100}},
    {id:'S1',type:'point-source',parameters:{x:-40,y:55,brightness:0.2},emission:{mode:'single-ray',directionDeg:-60}},
    {id:'D1',type:'ray-detector',parameters:{x:10,y:55,orientationDeg:0,length:80}}
  ]));
  const tankRun=await evaluateDocument(tankDoc,core,[
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ]);
  assert.equal(tankRun.summary.executionPassed,true);
  assert.equal(tankRun.summary.observations.v40EndpointsVerified,true);
  const tankById=Object.fromEntries((await evaluateObservables(tankDoc,[
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ],tankRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(tankById.m1.value,1);
  assert.equal(tankById.hits.value.length,1);
  assert.ok(Math.abs(tankById.hits.value[0].pointMm.x-expectedTankX)<1e-5);

  // 3C: Coaxial cemented doublet — crown biconvex TL1 (+60, +50, n=1.5, d=12, x=-6) cemented to
  // flint plano-concave TL2 (-50, null, n=1.65, d=8, x=+4) sharing curved interface at x=0!
  const yDoub=8,xDetDoub=120;
  const f1=hitCurvedOrFlatFace({x:-60,y:yDoub},{x:1,y:0},-12,60,0,true);
  const dIn1=snellStep({x:1,y:0},{x:-f1.outwardNormal.x,y:-f1.outwardNormal.y},1,1.5).dir;
  const f2=hitCurvedOrFlatFace(f1.point,dIn1,0,50,0,false);
  const dIn2=snellStep(dIn1,f2.outwardNormal,1.5,1.65).dir;
  const f3=hitCurvedOrFlatFace(f2.point,dIn2,8,null,0,false);
  const dOut=snellStep(dIn2,f3.outwardNormal,1.65,1).dir;
  const expectedDoubY=f3.point.y+((xDetDoub-f3.point.x)/dOut.x)*dOut.y;

  const {document:doubDoc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:yDoub,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'TL1',type:'spherical-lens',parameters:{x:-6,y:0,apertureHeight:40,centerThickness:12,frontRadius:60,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'TL2',type:'spherical-lens',parameters:{x:4,y:0,apertureHeight:40,centerThickness:8,frontRadius:-50,backRadius:null,insideIndex:1.65,outsideIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:xDetDoub,y:0,orientationDeg:90,length:160}}
  ]));
  const doubReqs=[
    {id:'faces',kind:'interface-face-events',componentId:'TL1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const doubRun=await evaluateDocument(doubDoc,core,doubReqs);
  assert.equal(doubRun.summary.executionPassed,true);
  assert.equal(doubRun.summary.observations.v40EndpointsVerified,true);
  const doubById=Object.fromEntries((await evaluateObservables(doubDoc,doubReqs,doubRun.summary)).results.map(r=>[r.id,r]));
  assert.equal(doubById.hits.value.length,1);
  assert.ok(Math.abs(doubById.hits.value[0].pointMm.y-expectedDoubY)<1e-5,
    `Cemented doublet expected y=${expectedDoubY}, got ${doubById.hits.value[0].pointMm.y}`);
  assert.equal(doubById.faces.value['back-arc'].first.incidentIndex,1.5);
  assert.equal(doubById.faces.value['back-arc'].first.destinationIndex,1.65);
  assert.equal(doubById.faces.value['back-arc'].first.mergedWithId,'TL2');
});

test('Milestone 3 negative controls: near-contact gaps, overlaps, mismatched silvering, non-mirror contact, and legacy v38/v39 isolation',()=>{
  const s1={id:'S1',type:'point-source',parameters:{x:-80,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}};
  const slabA={id:'B1',type:'polygon-dielectric',parameters:{x1:-20,y1:-20,x2:0,y2:-20,x3:0,y3:20,x4:-20,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};

  // 1. Forbidden near-contact air gap (0.005 mm in (1e-8, 0.01) mm) between two slabs -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    s1,slabA,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:0.005,y1:-20,x2:20.005,y2:-20,x3:20.005,y3:20,x4:0.005,y4:20,insideIndex:1.6,outsideIndex:1,partialReflection:false}}
  ])),/Finite dielectric bodies/);

  // 2. Overlapping interiors -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    s1,slabA,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:-2,y1:-20,x2:18,y2:-20,x3:18,y3:20,x4:-2,y4:20,insideIndex:1.6,outsideIndex:1,partialReflection:false}}
  ])),/Finite dielectric bodies/);

  // 3. Insufficient flat-face overlap (< 1 mm) -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    s1,slabA,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:0,y1:19.5,x2:20,y2:19.5,x3:20,y3:39.5,x4:0,y4:39.5,insideIndex:1.6,outsideIndex:1,partialReflection:false}}
  ])),/Finite dielectric bodies/);

  // 4. Plane mirror on curved spherical-lens AABB (NOT a physical flat face) -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'plane-mirror',parameters:{x:6,y:0,orientationDeg:90,length:40}}
  ])),/flush on a flat dielectric face/);

  // 5. Curved arc mirror with mismatched radius or exceeding lens aperture -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:null,backRadius:60,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:5,y:0,normalDeg:180,radius:59.5,apertureHeight:40}}
  ])),/silver a coincident curved face/);
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:10,frontRadius:null,backRadius:60,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:5,y:0,normalDeg:180,radius:60,apertureHeight:50}}
  ])),/silver a coincident curved face/);

  // 6. Non-mirror segments (detector, ideal-lens, line-blocker) flush on a dielectric face -> rejected!
  for(const badSeg of [
    {id:'D1',type:'ray-detector',parameters:{x:0,y:0,orientationDeg:90,length:30}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,y:0,focalLength:80,apertureHeight:30}},
    {id:'K1',type:'line-blocker',parameters:{x:0,y:0,orientationDeg:90,length:30}}
  ]){
    assert.throws(()=>prepareScene(v40Req([s1,slabA,badSeg])),/flush on a flat dielectric face/);
  }

  // 7. Source on or within 0.01 mm of shared glass-glass boundary -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    slabA,
    {id:'B2',type:'polygon-dielectric',parameters:{x1:0,y1:-20,x2:20,y2:-20,x3:20,y3:20,x4:0,y4:20,insideIndex:1.6,outsideIndex:1,partialReflection:false}},
    {id:'S1',type:'point-source',parameters:{x:0,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}
  ])),/0\.01 mm from dielectric body boundary/);

  // 8. Legacy v38 and v39 MUST still reject touching slabs and flush silvered mirrors!
  for(const model of ['native-general-refractive-bench','native-general-hybrid-bench']){
    assert.throws(()=>prepareScene({
      model,lengthUnit:'mm',
      components:[
        s1,slabA,
        {id:'B2',type:'polygon-dielectric',parameters:{x1:0,y1:-20,x2:20,y2:-20,x3:20,y3:20,x4:0,y4:20,insideIndex:1.6,outsideIndex:1,partialReflection:false}}
      ]
    }),/disjoint/);
    assert.throws(()=>prepareScene({
      model,lengthUnit:'mm',
      components:[
        s1,slabA,
        {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:40}}
      ]
    }),/outside dielectric/);
  }
});
