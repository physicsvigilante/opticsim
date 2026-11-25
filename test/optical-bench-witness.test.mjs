import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {createCoaxialStackPackage} from '../src/coaxial-stack-exploration.js';
import {
  OPTICAL_BENCH_WITNESS_PLAN,
  OPTICAL_BENCH_WITNESS_REPORT,
  OPTICAL_BENCH_WITNESS_SPEC,
  buildOpticalBenchNativeWitness,
  opticalBenchNativeWitnessCapabilities,
  runOpticalBenchNativeWitness
} from '../src/optical-bench-witness.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const execute=(doc,requests)=>evaluateDocument(doc,core,requests);

const stackFacts=(elements,opts={})=>({
  format:COAXIAL_STACK_FACTS,
  model:'coaxial-paraxial-optical-stack',
  signConvention:'x-increasing',
  lengthUnit:'mm',
  incidentIndex:opts.incidentIndex??1,
  ...(opts.object?{object:opts.object}:{}),
  elements
});

const qConj={format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'};
const qColl={format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'};

test('v40 witness capabilities and CLI capabilities/plan/run subcommands work deterministically',async()=>{
  const caps=opticalBenchNativeWitnessCapabilities();
  assert.equal(caps.formats.spec,OPTICAL_BENCH_WITNESS_SPEC);
  assert.equal(caps.formats.plan,OPTICAL_BENCH_WITNESS_PLAN);
  assert.equal(caps.formats.report,OPTICAL_BENCH_WITNESS_REPORT);
  assert.equal(caps.targetNativeSchema.schemaVersion,40);
  assert.equal(caps.targetNativeSchema.model,'native-optical-bench');
  assert.equal(caps.targetNativeSchema.maxRayDepth,16);

  const cliPath=resolve(root,'scripts/witness-optical-bench.mjs');
  const cliCaps=JSON.parse(execFileSync(process.execPath,[cliPath,'capabilities'],{cwd:root,encoding:'utf8'}));
  assert.deepEqual(cliCaps,caps);

  const dir=mkdtempSync(join(tmpdir(),'opticsim-v40-witness-'));
  try{
    const stackFile=join(dir,'stack.json');
    const specFile=join(dir,'spec.json');
    writeFileSync(stackFile,JSON.stringify(stackFacts([
      {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
      {id:'M1',type:'terminal-mirror',x:10,signedRadius:'infinity'}
    ])));
    writeFileSync(specFile,JSON.stringify({
      format:OPTICAL_BENCH_WITNESS_SPEC,
      query:qColl,
      bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'M1',apertureHeight:40}],
      aperturesById:{M1:40},
      partialReflection:false,
      emitter:{mode:'single-ray',rays:[{x:-80,y:0.5,brightness:0.2}]},
      detector:{x:-100,y:0,orientationDeg:90,length:40}
    }));
    const planOut=JSON.parse(execFileSync(process.execPath,[cliPath,'plan',stackFile,specFile],{cwd:root,encoding:'utf8'}));
    assert.equal(planOut.format,OPTICAL_BENCH_WITNESS_PLAN);
    assert.equal(planOut.document.schemaVersion,40);
    const runOut=JSON.parse(execFileSync(process.execPath,[cliPath,'run',stackFile,specFile],{cwd:root,encoding:'utf8'}));
    assert.equal(runOut.format,OPTICAL_BENCH_WITNESS_REPORT);
    assert.equal(runOut.native.v40EndpointsVerified,true);
    assert.equal(runOut.comparison.status,'observed-ray-geometry-compared');
    assert.ok(runOut.comparison.maxPerpendicularMissMm<1e-3);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});

test('v40 witness covers pure thin-lens + mirror stacks (0 dielectric bodies) with directional fan and forbids stray partialReflection',async()=>{
  const stack=stackFacts([
    {id:'L1',type:'thin-lens',x:0,focalLength:80},
    {id:'L2',type:'thin-lens',x:40,focalLength:120},
    {id:'M1',type:'terminal-mirror',x:70,signedRadius:'infinity'}
  ],{object:{x:-120,y:5}});

  // partialReflection must be rejected when stack has 0 dielectric bodies
  await assert.rejects(()=>buildOpticalBenchNativeWitness(stack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    aperturesById:{L1:80,L2:80,M1:80},
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:0,brightness:0.2},
    detector:{x:-150,y:0,orientationDeg:90,length:80}
  }),/partialReflection applies only/);

  const rep=await runOpticalBenchNativeWitness(stack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    aperturesById:{L1:80,L2:80,M1:80},
    emitter:{mode:'directional',directionDeg:-2,angleDeg:6,brightness:0.2},
    detector:{x:-160,y:0,orientationDeg:90,length:120}
  },{execute});

  assert.equal(rep.native.schemaVersion,40);
  assert.equal(rep.native.executionPassed,true);
  assert.equal(rep.native.v40EndpointsVerified,true);
  assert.equal(rep.paraxial.nativeObservation,false);
  assert.equal(rep.native.nativeObservation,true);
  assert.equal(rep.nativeImageDetected,false);
  assert.equal(rep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(rep.comparison.routeQualification,'aggregate-axial-faces-and-optics-matched');
  assert.ok(rep.comparison.outgoingHitCount>=2);
  assert.ok(rep.comparison.maxPerpendicularMissMm<1e-6);
  assert.equal(rep.comparison.stackEncounters.byElementId.L1.incidents,2*rep.comparison.outgoingHitCount);
  assert.equal(rep.comparison.stackEncounters.byElementId.L2.incidents,2*rep.comparison.outgoingHitCount);
  assert.equal(rep.comparison.stackEncounters.byElementId.M1.reflections,rep.comparison.outgoingHitCount);
});

test('v40 witness handles signed and flat spherical lenses: plano-convex (paraxial vs marginal aberration), positive meniscus, and biconcave virtual focus',async()=>{
  // 1. Plano-convex lens (R1 = +60, R2 = infinity): paraxial ray closely matches ABCD backFocusX,
  // while a marginal ray (y = 14 mm) exhibits genuine physical spherical aberration!
  const planoConvex=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:'infinity',downstreamIndex:1}
  ]);
  const pcParaxial=await runOpticalBenchNativeWitness(planoConvex,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(pcParaxial.native.v40EndpointsVerified,true);
  assert.equal(pcParaxial.comparison.status,'observed-ray-geometry-compared');
  assert.ok(pcParaxial.comparison.maxPerpendicularMissMm<1e-3,
    `Paraxial plano-convex miss too large: ${pcParaxial.comparison.maxPerpendicularMissMm}`);

  const pcMarginal=await runOpticalBenchNativeWitness(planoConvex,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:14,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(pcMarginal.comparison.status,'observed-ray-geometry-compared');
  assert.ok(pcMarginal.comparison.maxPerpendicularMissMm>pcParaxial.comparison.maxPerpendicularMissMm*100,
    'Marginal ray should exhibit substantially larger spherical aberration than paraxial ray');

  // 2. Positive meniscus (R1 = +40, R2 = +80)
  const meniscus=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:40,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:80,downstreamIndex:1}
  ]);
  const menRep=await runOpticalBenchNativeWitness(meniscus,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:36}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(menRep.native.v40EndpointsVerified,true);
  assert.equal(menRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(menRep.comparison.maxPerpendicularMissMm<1e-3);

  // 3. Biconcave diverging lens (R1 = -50, R2 = +50): virtual backFocusX < 0,
  // outgoing diverging ray extrapolates cleanly back to paraxial virtual focus!
  const biconcave=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:-50,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:8,signedRadius:50,downstreamIndex:1}
  ]);
  const bcRep=await runOpticalBenchNativeWitness(biconcave,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2},{x:-40,y:-0.5,brightness:0.2}]},
    detector:{x:50,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(bcRep.native.v40EndpointsVerified,true);
  assert.ok(bcRep.paraxial.result.value.backFocusX<0);
  assert.equal(bcRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(bcRep.comparison.outgoingHitCount,2);
  assert.ok(bcRep.comparison.maxPerpendicularMissMm<1e-3);
});

test('v40 witness handles touching layered slabs (both 3-surface Way A and 4-surface zero-gap Way B) with merged contact verification',async()=>{
  // Water (n=1.33, x=[0,15]) resting directly on glass (n=1.5, x=[15,30]) in air.
  const wayA=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.33},
    {id:'S2',type:'refracting-surface',x:15,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S3',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1}
  ],{object:{x:-50,y:0}});
  const wayB=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.33},
    {id:'S2a',type:'refracting-surface',x:15,signedRadius:'infinity',downstreamIndex:1},
    {id:'S2b',type:'refracting-surface',x:15,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S3',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1}
  ],{object:{x:-50,y:0}});

  const repA=await runOpticalBenchNativeWitness(wayA,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[
      {id:'W1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60},
      {id:'G1',frontSurfaceId:'S2',backSurfaceId:'S3',apertureHeight:60}
    ],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.2},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});
  const repB=await runOpticalBenchNativeWitness(wayB,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[
      {id:'W1',frontSurfaceId:'S1',backSurfaceId:'S2a',apertureHeight:60},
      {id:'G1',frontSurfaceId:'S2b',backSurfaceId:'S3',apertureHeight:60}
    ],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.2},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});

  for(const rep of [repA,repB]){
    assert.equal(rep.native.v40EndpointsVerified,true);
    assert.equal(rep.comparison.status,'observed-ray-geometry-compared');
    assert.ok(rep.comparison.maxPerpendicularMissMm<2e-3);
    const wEnc=rep.comparison.stackEncounters.byElementId.W1;
    const gEnc=rep.comparison.stackEncounters.byElementId.G1;
    assert.equal(wEnc.frontFaceInteractions,1);
    assert.equal(wEnc.backFaceInteractions,1);
    assert.equal(wEnc.observedMergedBackPartnerId,'G1');
    assert.equal(gEnc.frontFaceInteractions,0);
    assert.equal(gEnc.backFaceInteractions,1);
  }
  assert.equal(repA.paraxial.result.value.imageX,repB.paraxial.result.value.imageX);
  assert.equal(repA.comparison.hits[0].pointMm.y,repB.comparison.hits[0].pointMm.y);
});

test('v40 witness handles coaxial cemented doublet (curved shared boundary) for both collimated focus and conjugate fan',async()=>{
  // Crown glass biconvex (R1=+60, R2=-50, n=1.5, x=[0,12]) cemented to flint plano-concave (R1=-50, R2=inf, n=1.65, x=[12,20])
  const doublet=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:12,signedRadius:-50,downstreamIndex:1.65},
    {id:'S3',type:'refracting-surface',x:20,signedRadius:'infinity',downstreamIndex:1}
  ],{object:{x:-250,y:2}});

  const collRep=await runOpticalBenchNativeWitness(doublet,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[
      {id:'Crown',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40},
      {id:'Flint',frontSurfaceId:'S2',backSurfaceId:'S3',apertureHeight:40}
    ],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2},{x:-40,y:-0.5,brightness:0.2}]},
    detector:{x:100,y:0,orientationDeg:90,length:40}
  },{execute});

  assert.equal(collRep.native.v40EndpointsVerified,true);
  assert.equal(collRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(collRep.comparison.outgoingHitCount,2);
  assert.ok(collRep.comparison.maxPerpendicularMissMm<2e-3);
  assert.equal(collRep.comparison.stackEncounters.byElementId.Crown.frontFaceInteractions,2);
  assert.equal(collRep.comparison.stackEncounters.byElementId.Crown.backFaceInteractions,2);
  assert.equal(collRep.comparison.stackEncounters.byElementId.Crown.observedMergedBackPartnerId,'Flint');
  assert.equal(collRep.comparison.stackEncounters.byElementId.Flint.frontFaceInteractions,0);
  assert.equal(collRep.comparison.stackEncounters.byElementId.Flint.backFaceInteractions,2);

  const conjRep=await runOpticalBenchNativeWitness(doublet,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[
      {id:'Crown',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40},
      {id:'Flint',frontSurfaceId:'S2',backSurfaceId:'S3',apertureHeight:40}
    ],
    partialReflection:false,
    runPolicy:'bench-v40-dense',
    emitter:{mode:'directional',directionDeg:-0.4,angleDeg:4,brightness:0.2},
    detector:{x:120,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(conjRep.native.v40EndpointsVerified,true);
  assert.equal(conjRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(conjRep.comparison.outgoingHitCount>=2);
  assert.ok(conjRep.comparison.maxPerpendicularMissMm<0.5);
});

test('v40 witness handles JEE silvered plano-convex lenses (flat-silvered and curved-silvered, direct and zero-gap forms)',async()=>{
  // 1. Flat-silvered plano-convex lens: front R1=+60 at x=0, flat silvered back at x=10, n=1.5
  const flatSilvered=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:'infinity'}
  ]);
  const flatRep=await runOpticalBenchNativeWitness(flatSilvered,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'M1',apertureHeight:40}],
    aperturesById:{M1:40},
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-80,y:0.5,brightness:0.2},{x:-80,y:-0.5,brightness:0.2}]},
    detector:{x:-100,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(flatRep.native.v40EndpointsVerified,true);
  assert.equal(flatRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(flatRep.comparison.exitDirection,'-x');
  assert.ok(flatRep.comparison.maxPerpendicularMissMm<1e-3);
  assert.equal(flatRep.comparison.stackEncounters.byElementId.L1.frontFaceInteractions,4);
  assert.equal(flatRep.comparison.stackEncounters.byElementId.L1.backFaceInteractions,0);
  assert.equal(flatRep.comparison.stackEncounters.byElementId.M1.reflections,2);

  // 2. Curved-silvered plano-convex lens: front flat at x=0, curved back R=-50 silvered at x=10 (both direct [S1,M1] and zero-gap [S1,S2,M1])
  const curvedDirect=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:-50}
  ]);
  const curvedZeroGap=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:-50,downstreamIndex:1},
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:-50}
  ]);
  const cDirectRep=await runOpticalBenchNativeWitness(curvedDirect,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'M1',apertureHeight:40}],
    aperturesById:{M1:40},
    mirrorModel:'circular-arc-mirror',
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-60,y:0.5,brightness:0.2}]},
    detector:{x:-80,y:0,orientationDeg:90,length:40}
  },{execute});
  const cZeroRep=await runOpticalBenchNativeWitness(curvedZeroGap,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    aperturesById:{M1:40},
    mirrorModel:'circular-arc-mirror',
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-60,y:0.5,brightness:0.2}]},
    detector:{x:-80,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(cDirectRep.paraxial.result.value.backFocusX,cZeroRep.paraxial.result.value.backFocusX);
  assert.equal(cDirectRep.comparison.hits[0].pointMm.y,cZeroRep.comparison.hits[0].pointMm.y);
  for(const rep of [cDirectRep,cZeroRep]){
    assert.equal(rep.native.v40EndpointsVerified,true);
    assert.equal(rep.comparison.status,'observed-ray-geometry-compared');
    assert.ok(rep.comparison.maxPerpendicularMissMm<1e-3);
    assert.equal(rep.comparison.stackEncounters.byElementId.L1.frontFaceInteractions,2);
    assert.equal(rep.comparison.stackEncounters.byElementId.L1.backFaceInteractions,0);
    assert.equal(rep.comparison.stackEncounters.byElementId.M1.reflections,1);
    assert.equal(rep.comparison.stackEncounters.byElementId.M1.flushSilveredBodyId,'L1');
  }
});

test('v40 witness handles 3-component water-on-glass-on-mirror tank, deep maxRayDepth=16 return stacks, non-air immersion, and stack packages',async()=>{
  // 1. 3-component water-on-glass-on-mirror tank: air -> water (1.33, 12 mm) -> glass (1.5, 10 mm) -> mirror
  const tank=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.33},
    {id:'S2',type:'refracting-surface',x:12,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:22,signedRadius:'infinity'}
  ],{object:{x:-40,y:0}});
  const tankRep=await runOpticalBenchNativeWitness(tank,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[
      {id:'W1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60},
      {id:'G1',frontSurfaceId:'S2',backSurfaceId:'M1',apertureHeight:60}
    ],
    aperturesById:{M1:60},
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.2},
    detector:{x:-20,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(tankRep.native.v40EndpointsVerified,true);
  assert.equal(tankRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(tankRep.comparison.nonExitDirectionHitCount,1); // forward pass through detector at x=-20
  assert.equal(tankRep.comparison.outgoingHitCount,1); // returning pass through detector at x=-20
  assert.ok(tankRep.comparison.maxPerpendicularMissMm<2e-3);
  // W1 handles front (2) and merged W1/G1 contact (2); G1 is sandwiched between W1 and M1 so 0 direct callbacks & matches=true!
  assert.equal(tankRep.comparison.stackEncounters.byElementId.W1.frontFaceInteractions,2);
  assert.equal(tankRep.comparison.stackEncounters.byElementId.W1.backFaceInteractions,2);
  assert.equal(tankRep.comparison.stackEncounters.byElementId.W1.observedMergedBackPartnerId,'G1');
  assert.equal(tankRep.comparison.stackEncounters.byElementId.G1.interactions,0);
  assert.equal(tankRep.comparison.stackEncounters.byElementId.G1.matches,true);
  assert.equal(tankRep.comparison.stackEncounters.byElementId.M1.reflections,1);

  // 2. Deep return stack exceeding legacy v39 maxRayDepth=8:
  // 2 disjoint slabs (8 hits) + 1 thin lens (2 hits) + 1 separated mirror (1 hit) + detector (1 hit) = 12 <= 16!
  const deepStack=stackFacts([
    {id:'L1',type:'thin-lens',x:0,focalLength:200},
    {id:'S1',type:'refracting-surface',x:20,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1},
    {id:'S3',type:'refracting-surface',x:50,signedRadius:'infinity',downstreamIndex:1.4},
    {id:'S4',type:'refracting-surface',x:60,signedRadius:'infinity',downstreamIndex:1},
    {id:'M1',type:'terminal-mirror',x:80,signedRadius:'infinity'}
  ]);
  const deepRep=await runOpticalBenchNativeWitness(deepStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[
      {id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60},
      {id:'G2',frontSurfaceId:'S3',backSurfaceId:'S4',apertureHeight:60}
    ],
    aperturesById:{L1:60,M1:60},
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-50,y:1,brightness:0.2}]},
    detector:{x:-70,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(deepRep.mapping.plannedEncountersPerRay,12);
  assert.equal(deepRep.native.v40EndpointsVerified,true);
  assert.equal(deepRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(deepRep.comparison.maxPerpendicularMissMm<2e-3);

  // 3. Non-air immersion (backgroundIndex = 1.33) via coaxial stack package!
  const immersedFacts=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:50,downstreamIndex:1.6},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:'infinity',downstreamIndex:1.33}
  ],{incidentIndex:1.33});
  const pkg=await createCoaxialStackPackage(immersedFacts,{sourceNote:'Water-immersed plano-convex lens'});
  const immRep=await runOpticalBenchNativeWitness(pkg,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:80,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(immRep.packageIntegritySha256,pkg.integritySha256);
  assert.equal(immRep.document?.physics?.backgroundIndex,undefined); // report omits raw document, keeps mapping
  assert.equal(immRep.mapping.backgroundIndex,1.33);
  assert.equal(immRep.native.v40EndpointsVerified,true);
  assert.equal(immRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(immRep.comparison.maxPerpendicularMissMm<1e-3);
});

test('v40 witness fail-closed negative controls: flush mirror rules, depth > 16, lateral rim, bypass, Fresnel branching, and tampered execution',async()=>{
  // 1. Flush curved silvering MUST reject ideal-curved-mirror!
  const curvedSilvered=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:-50}
  ]);
  await assert.rejects(()=>buildOpticalBenchNativeWitness(curvedSilvered,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'M1',apertureHeight:40}],
    aperturesById:{M1:40},
    mirrorModel:'ideal-curved-mirror',
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-50,y:0.5,brightness:0.2}]},
    detector:{x:-70,y:0,orientationDeg:90,length:40}
  }),/circular-arc-mirror/);

  // 2. Flush silvered mirror wider than its silvered dielectric body MUST be rejected (prevents air-wing bypass)!
  const tank=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.33},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:20,signedRadius:'infinity'}
  ]);
  await assert.rejects(()=>buildOpticalBenchNativeWitness(tank,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[
      {id:'W1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40},
      {id:'G1',frontSurfaceId:'S2',backSurfaceId:'M1',apertureHeight:20}
    ],
    aperturesById:{M1:40},
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:2,brightness:0.2}]},
    detector:{x:-60,y:0,orientationDeg:90,length:40}
  }),/must not exceed the silvered dielectric body/);

  // 3. Exceeding v40 maxRayDepth=16 (8 stack elements: 3 thin lenses + 2 disjoint bodies + mirror = 15 optical hits,
  //    plus an interior detector crossed twice = 17 > 16) -> refused at build time!
  const tooDeep=stackFacts([
    {id:'L1',type:'thin-lens',x:0,focalLength:200},
    {id:'L2',type:'thin-lens',x:10,focalLength:200},
    {id:'L3',type:'thin-lens',x:20,focalLength:200},
    {id:'S1',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:40,signedRadius:'infinity',downstreamIndex:1},
    {id:'S3',type:'refracting-surface',x:50,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S4',type:'refracting-surface',x:60,signedRadius:'infinity',downstreamIndex:1},
    {id:'M1',type:'terminal-mirror',x:70,signedRadius:'infinity'}
  ]);
  await assert.rejects(()=>buildOpticalBenchNativeWitness(tooDeep,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[
      {id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40},
      {id:'G2',frontSurfaceId:'S3',backSurfaceId:'S4',apertureHeight:40}
    ],
    aperturesById:{L1:40,L2:40,L3:40,M1:40},
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:1,brightness:0.2}]},
    detector:{x:-20,y:0,orientationDeg:90,length:40}
  }),/maxRayDepth = 16/);

  // 4. Lateral-rim hit on a dielectric slab MUST withhold geometric corroboration!
  const rimSlab=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:20,signedRadius:'infinity',downstreamIndex:1}
  ],{object:{x:-20,y:0}});
  const rimRep=await runOpticalBenchNativeWitness(rimSlab,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[{id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:10}],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:12,brightness:0.2}, // enters front at y=4.25, hits top rim y=5 before x=20!
    detector:{x:40,y:0,orientationDeg:90,length:80}
  },{execute});
  assert.equal(rimRep.native.v40EndpointsVerified,true);
  assert.equal(rimRep.comparison.status,'lateral-rim-encounter-route-unverified');
  assert.equal(rimRep.comparison.targetPointMm,null);

  // 5. Partial-silvering bypass (ray exits unsilvered outer lens face instead of hitting narrow M1) -> withheld!
  const partialSilv=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:'infinity'}
  ]);
  const bypassRep=await runOpticalBenchNativeWitness(partialSilv,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'M1',apertureHeight:40}],
    aperturesById:{M1:10}, // mirror covers only y in [-5, +5]
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-60,y:12,brightness:0.2}]}, // misses M1 completely!
    detector:{x:-80,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.equal(bypassRep.native.v40EndpointsVerified,true);
  assert.equal(bypassRep.comparison.status,'no-outgoing-detector-hits');

  // 6. Full Fresnel partialReflection:true does NOT falsely claim clean unbranched corroboration!
  const fresnelRep=await runOpticalBenchNativeWitness(stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:'infinity',downstreamIndex:1}
  ]),{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:true,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{execute});
  assert.ok(['partial-stack-encounters-route-unverified','native-run-not-qualified'].includes(fresnelRep.comparison.status),
    `Expected unverified or unqualified under Fresnel branching, got ${fresnelRep.comparison.status}`);

  // 7. Unqualified/tampered execution summary MUST withhold BOTH comparison AND native.observables!
  const cleanStack=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:60,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:10,signedRadius:'infinity',downstreamIndex:1}
  ]);
  const tampered=await runOpticalBenchNativeWitness(cleanStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  },{
    execute:async(doc,reqs)=>{
      const res=await execute(doc,reqs);
      res.summary.observations.v40EndpointsVerified=false;
      return res;
    }
  });
  assert.equal(tampered.native.v40EndpointsVerified,false);
  assert.equal(tampered.comparison.status,'native-run-not-qualified');
  assert.ok(tampered.native.observables.every(o=>o.status==='suppressed'));

  // 8. Non-mm unit, legacy runPolicy, and co-located thin lens rejections
  await assert.rejects(()=>buildOpticalBenchNativeWitness({
    ...cleanStack,lengthUnit:'cm'
  },{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  }),/lengthUnit "mm"/);
  await assert.rejects(()=>buildOpticalBenchNativeWitness(cleanStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qColl,
    bodies:[{id:'L1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:40}],
    partialReflection:false,
    runPolicy:'preview-v1',
    emitter:{mode:'single-ray',rays:[{x:-40,y:0.5,brightness:0.2}]},
    detector:{x:60,y:0,orientationDeg:90,length:40}
  }),/bench-v40/);
});

test('v40 witness R2 regression (P2-1): physical x-envelope rejects pre-lens/pre-return-sag detector hits while preserving post-envelope coverage',async()=>{
  // 1. Astra R1 exact meniscus witness: S1(x=0, R=+20, n=1.5), S2(x=2, R=+20, n=1), ap=30 -> AABB x=[0, 8.771243...].
  // Slanted -45 deg ray crosses detector (3, 16.5) BEFORE entering either curved lens face, then traverses both faces.
  // Because exitPlaneX uses the full physical envelope (8.771243...), this pre-lens hit MUST NOT be certified as outgoing!
  const meniscusStack=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:20,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:2,signedRadius:20,downstreamIndex:1}
  ],{object:{x:-20,y:39.5}});
  const preLensRep=await runOpticalBenchNativeWitness(meniscusStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[{id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:30}],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:-45,brightness:0.2},
    detector:{x:3,y:16.5,orientationDeg:90,length:2}
  },{execute});
  assert.equal(preLensRep.native.v40EndpointsVerified,true);
  assert.ok(preLensRep.mapping.stackXEnvelope.maxX>8.77);
  assert.equal(preLensRep.mapping.exitPlaneX,preLensRep.mapping.stackXEnvelope.maxX);
  assert.notEqual(preLensRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(preLensRep.comparison.status,'no-outgoing-detector-hits');
  assert.equal(preLensRep.comparison.outgoingHitCount,0);
  assert.equal(preLensRep.comparison.nonExitDirectionHitCount,1);

  // Positive control on the exact same meniscus & ray with detector strictly past physical envelope (x=12 > 8.77):
  const postLensRep=await runOpticalBenchNativeWitness(meniscusStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[{id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:30}],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:-45,brightness:0.2},
    detector:{x:12,y:7,orientationDeg:90,length:6}
  },{execute});
  assert.equal(postLensRep.native.v40EndpointsVerified,true);
  assert.equal(postLensRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(postLensRep.comparison.outgoingHitCount,1);

  // 2. Reciprocal return-mode curved-sag control: concave-front meniscus (R1=-20, R2=-20, x=[0,2], ap=30) + concave mirror M1.
  // Front lens rim bows left to x = -6.771243... < axial vertex 0; M1 vertex at x = 12, sag left to x = 5.228756...
  const returnConcave=stackFacts([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:-20,downstreamIndex:1.5},
    {id:'S2',type:'refracting-surface',x:2,signedRadius:-20,downstreamIndex:1},
    {id:'M1',type:'terminal-mirror',x:12,signedRadius:'infinity'}
  ],{object:{x:-20,y:0}});
  // Detector inside the sag envelope at x = -2 (between stackMinX=-6.77 and frontApex=0) receives the -x return hit at x=-2,
  // which MUST be withheld because x=-2 > stackMinX=-6.771243!
  const insideSagRep=await runOpticalBenchNativeWitness(returnConcave,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[{id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:30}],
    aperturesById:{M1:40},
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:10,brightness:0.2},
    detector:{x:-2,y:16.5,orientationDeg:90,length:2}
  },{execute});
  assert.ok(insideSagRep.mapping.stackXEnvelope.minX<-6.77);
  assert.equal(insideSagRep.mapping.exitPlaneX,insideSagRep.mapping.stackXEnvelope.minX);
  assert.notEqual(insideSagRep.comparison.status,'observed-ray-geometry-compared');

  // Valid return-mode detector strictly left of stackMinX (x = -12 < -6.77) succeeds cleanly:
  const postReturnRep=await runOpticalBenchNativeWitness(returnConcave,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    bodies:[{id:'G1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:30}],
    aperturesById:{M1:40},
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:2,brightness:0.2},
    detector:{x:-12,y:0,orientationDeg:90,length:20}
  },{execute});
  assert.equal(postReturnRep.native.v40EndpointsVerified,true);
  assert.equal(postReturnRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(postReturnRep.comparison.outgoingHitCount,1);
  assert.ok(postReturnRep.comparison.maxPerpendicularMissMm<2e-3);

  // 3. Pure concave circular-arc-mirror return envelope (vertex x=10, R=-20, ap=30 -> rim sags left to x=3.228756...):
  const concaveMirrorStack=stackFacts([
    {id:'M1',type:'terminal-mirror',x:10,signedRadius:-20}
  ],{object:{x:-20,y:0}});
  const cmPlan=await buildOpticalBenchNativeWitness(concaveMirrorStack,{
    format:OPTICAL_BENCH_WITNESS_SPEC,
    query:qConj,
    aperturesById:{M1:30},
    mirrorModel:'circular-arc-mirror',
    emitter:{mode:'single-ray',directionDeg:2,brightness:0.2},
    detector:{x:-10,y:0,orientationDeg:90,length:20}
  });
  assert.ok(Math.abs(cmPlan.mapping.stackXEnvelope.minX-(10-(225/(20+Math.sqrt(175)))))<1e-12);
  assert.equal(cmPlan.mapping.exitPlaneX,cmPlan.mapping.stackXEnvelope.minX);
});
