import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {createCoaxialStackPackage} from '../src/coaxial-stack-exploration.js';
import {
  REFRACTIVE_WITNESS_PLAN,
  REFRACTIVE_WITNESS_REPORT,
  REFRACTIVE_WITNESS_SPEC,
  buildRefractiveStackNativeWitness,
  refractiveNativeWitnessCapabilities,
  runRefractiveStackNativeWitness
} from '../src/refractive-native-witness.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const example=JSON.parse(readFileSync(resolve(root,'examples/refractive-native-witness.json'),'utf8'));
const execute=(doc,requests)=>evaluateDocument(doc,core,requests);

test('worked example: thick biconvex lens collimated focus separates paraxial agreement from marginal spherical aberration',async()=>{
  const caps=refractiveNativeWitnessCapabilities();
  assert.equal(caps.formats.spec,REFRACTIVE_WITNESS_SPEC);
  assert.equal(caps.targetNativeSchema.schemaVersion,38);

  const plan=await buildRefractiveStackNativeWitness(example.stack,example.spec);
  assert.equal(plan.format,REFRACTIVE_WITNESS_PLAN);
  assert.equal(plan.document.schemaVersion,38);
  assert.equal(plan.nativeObservation,false);
  assert.equal(plan.nativeImageDetected,false);

  const report=await runRefractiveStackNativeWitness(example.stack,example.spec,{execute});
  assert.equal(report.format,REFRACTIVE_WITNESS_REPORT);
  assert.equal(report.paraxial.nativeObservation,false);
  assert.equal(report.native.nativeObservation,true);
  assert.equal(report.native.executionPassed,true);
  assert.equal(report.native.v38EndpointsVerified,true);
  assert.equal(report.nativeImageDetected,false);

  assert.equal(report.comparison.status,'observed-ray-geometry-compared');
  assert.equal(report.comparison.routeQualification,'all-emitted-rays-encountered-every-element');
  assert.equal(report.comparison.outgoingHitCount,2);
  assert.equal(report.comparison.stackEncounters.byElementId.L1.observedCount,4);
  assert.equal(report.comparison.stackEncounters.byElementId.L1.expectedForAllEmittedRays,4);

  // Sort hits by |y| on the detector to identify paraxial (y=2) vs marginal (y=24) ray.
  const [paraxialHit,marginalHit]=[...report.comparison.hits].sort((a,b)=>Math.abs(a.pointMm.y)-Math.abs(b.pointMm.y));
  assert.ok(Math.abs(paraxialHit.deltaXAtTargetYMm)<0.1,'paraxial ray should cross axis near ABCD backFocusX');
  assert.ok(paraxialHit.perpendicularMissMm<0.01,'paraxial ray perpendicular miss should be tiny');
  assert.ok(marginalHit.deltaXAtTargetYMm<-2,'marginal ray should show real negative longitudinal spherical aberration');
  assert.ok(marginalHit.perpendicularMissMm>0.5,'marginal ray should deviate measurably from paraxial focus');
});

test('immersed (n=1.33) thick lens + planar slab two-body conjugate witness agrees with exact ABCD',async()=>{
  const stack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1.33,
    object:{x:-250,y:0},
    elements:[
      {id:'F1',type:'refracting-surface',x:-10,signedRadius:60,downstreamIndex:1.6},
      {id:'B1',type:'refracting-surface',x:10,signedRadius:-60,downstreamIndex:1.33},
      {id:'S1',type:'refracting-surface',x:40,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:70,signedRadius:'infinity',downstreamIndex:1.33}
    ]
  };
  const spec={
    format:REFRACTIVE_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    bodies:[
      {id:'L1',frontSurfaceId:'F1',backSurfaceId:'B1',apertureHeight:50},
      {id:'SL1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60}
    ],
    partialReflection:false,
    emitter:{mode:'single-ray',id:'Ray1',directionDeg:1,brightness:0.5},
    detector:{id:'D1',x:120,y:0,orientationDeg:90,length:120}
  };

  const report=await runRefractiveStackNativeWitness(stack,spec,{execute});
  assert.equal(report.native.executionPassed,true);
  assert.equal(report.native.v38EndpointsVerified,true);
  assert.equal(report.comparison.status,'observed-ray-geometry-compared');
  assert.equal(report.comparison.stackEncounters.byElementId.L1.observedCount,2);
  assert.equal(report.comparison.stackEncounters.byElementId.SL1.observedCount,2);
  assert.ok(report.comparison.maxPerpendicularMissMm<0.05,'near-axis immersed two-body ray should match ABCD conjugate tightly');
});

test('symmetric return pass (thick lens + planar terminal mirror) from exploration package verifies return encounters',async()=>{
  const stack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-180,y:0},
    elements:[
      {id:'F1',type:'refracting-surface',x:-10,signedRadius:100,downstreamIndex:1.5},
      {id:'B1',type:'refracting-surface',x:10,signedRadius:-100,downstreamIndex:1},
      {id:'M1',type:'terminal-mirror',x:80,signedRadius:'infinity'}
    ]
  };
  const pkg=await createCoaxialStackPackage(stack);
  const spec={
    format:REFRACTIVE_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    bodies:[
      {id:'L1',frontSurfaceId:'F1',backSurfaceId:'B1',apertureHeight:60}
    ],
    mirrorLength:80,
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.5},
    detector:{id:'D_ret',x:-60,y:0,orientationDeg:90,length:100}
  };

  const report=await runRefractiveStackNativeWitness(pkg,spec,{execute});
  assert.equal(report.packageIntegritySha256,pkg.integritySha256);
  assert.equal(report.native.executionPassed,true);
  assert.equal(report.native.v38EndpointsVerified,true);
  assert.equal(report.comparison.exitDirection,'-x');
  assert.equal(report.comparison.status,'observed-ray-geometry-compared');
  assert.equal(report.comparison.stackEncounters.byElementId.L1.observedCount,4);
  assert.equal(report.comparison.stackEncounters.byElementId.M1.observedCount,1);
  assert.equal(report.comparison.nonExitDirectionHitCount,1,'forward pass through D_ret is filtered out of return hits');
  assert.ok(report.comparison.maxPerpendicularMissMm<0.05,'near-axis return ray should match ABCD return conjugate');
});

test('parallel-beam collimated witness on coaxial planar slab verifies afocal emergence',async()=>{
  const stack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    elements:[
      {id:'F1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'B1',type:'refracting-surface',x:40,signedRadius:'infinity',downstreamIndex:1}
    ]
  };
  const spec={
    format:REFRACTIVE_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    bodies:[
      {id:'SL1',frontSurfaceId:'F1',backSurfaceId:'B1',apertureHeight:80}
    ],
    partialReflection:false,
    emitter:{mode:'parallel-beam',x:-60,y:0,width:20,brightness:0.2},
    detector:{id:'D1',x:90,y:0,orientationDeg:90,length:100}
  };

  const report=await runRefractiveStackNativeWitness(stack,spec,{execute});
  assert.equal(report.native.executionPassed,true);
  assert.equal(report.native.v38EndpointsVerified,true);
  assert.equal(report.comparison.status,'observed-afocal-collimation-compared');
  assert.equal(report.comparison.outgoingHitCount,4);
  assert.equal(report.comparison.stackEncounters.byElementId.SL1.observedCount,8);
  assert.ok(report.comparison.maxAbsOutgoingSlope<1e-12);
});

test('encounter gating withholds corroboration on bypassed rays, partial bypass, Fresnel truncation, and unverified runs',async()=>{
  // 1. Full bypass: ray at y = 40 clears lens apertureHeight = 40 (half = 20) -> zero encounters.
  const bypassSpec=structuredClone(example.spec);
  bypassSpec.bodies[0].apertureHeight=40;
  bypassSpec.emitter={mode:'single-ray',rays:[{id:'S_miss',x:-80,y:35,brightness:0.5}]};
  const bypassReport=await runRefractiveStackNativeWitness(example.stack,bypassSpec,{execute});
  assert.equal(bypassReport.native.executionPassed,true);
  assert.equal(bypassReport.comparison.status,'stack-optics-not-encountered');
  assert.deepEqual(bypassReport.comparison.stackEncounters.zeroEncounterElementIds,['L1']);

  // 2. Partial bypass: 1 ray hits L1 (2 interactions), 1 ray misses L1 -> partial-stack-encounters-route-unverified.
  const partialSpec=structuredClone(bypassSpec);
  partialSpec.emitter={mode:'single-ray',rays:[
    {id:'S_hit',x:-80,y:2,brightness:0.5},
    {id:'S_miss',x:-80,y:35,brightness:0.5}
  ]};
  const partialReport=await runRefractiveStackNativeWitness(example.stack,partialSpec,{execute});
  assert.equal(partialReport.native.executionPassed,true);
  assert.equal(partialReport.comparison.status,'partial-stack-encounters-route-unverified');

  // 3. Fresnel splitting with partialReflection: true causes truncation > 0 at depth 8 -> native-run-not-qualified.
  const fresnelSpec=structuredClone(example.spec);
  fresnelSpec.partialReflection=true;
  const fresnelReport=await runRefractiveStackNativeWitness(example.stack,fresnelSpec,{execute});
  assert.equal(fresnelReport.native.executionPassed,false);
  assert.equal(fresnelReport.comparison.status,'native-run-not-qualified');

  // 4. Rim-exit ray (enters front face of planar slab, exits top rim -> total 2 interactions,
  //    but back face = 0 and rim = 1) -> partial-stack-encounters-route-unverified.
  const rimStack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-5,y:0},
    elements:[
      {id:'F1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.2},
      {id:'B1',type:'refracting-surface',x:60,signedRadius:'infinity',downstreamIndex:1}
    ]
  };
  const rimSpec={
    format:REFRACTIVE_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    bodies:[{id:'SL1',frontSurfaceId:'F1',backSurfaceId:'B1',apertureHeight:20}],
    partialReflection:false,
    emitter:{mode:'single-ray',directionDeg:50,brightness:0.5},
    detector:{id:'D1',x:90,y:80,orientationDeg:90,length:180}
  };
  const rimReport=await runRefractiveStackNativeWitness(rimStack,rimSpec,{execute});
  assert.equal(rimReport.native.executionPassed,true);
  assert.equal(rimReport.comparison.status,'partial-stack-encounters-route-unverified');
  assert.equal(rimReport.comparison.stackEncounters.byElementId.SL1.observedCount,2);
  assert.equal(rimReport.comparison.stackEncounters.byElementId.SL1.rimInteractions,1);
  assert.equal(rimReport.comparison.stackEncounters.byElementId.SL1.backInteractions,0);

  // 5. Forged/unverified v38EndpointsVerified === false -> native-run-not-qualified.
  const tamperedReport=await runRefractiveStackNativeWitness(example.stack,example.spec,{
    execute:async(doc,reqs)=>{
      const res=await execute(doc,reqs);
      res.summary.observations.v38EndpointsVerified=false;
      return res;
    }
  });
  assert.equal(tamperedReport.comparison.status,'native-run-not-qualified');
});

test('strict scope and spec validation refuses unsupported stacks and missing explicit inputs',async()=>{
  // Non-mm unit
  await assert.rejects(()=>buildRefractiveStackNativeWitness(
    {...example.stack,lengthUnit:'cm'},example.spec
  ),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Thin lens belongs to v37 bridge
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    elements:[{id:'L1',type:'thin-lens',x:0,focalLength:100}]
  },example.spec),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Curved terminal mirror out of v38 scope
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    elements:[...example.stack.elements,{id:'M1',type:'terminal-mirror',x:80,signedRadius:-100}]
  },{...example.spec,mirrorLength:80}),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Unpaired single refracting surface
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    elements:[example.stack.elements[0]]
  },example.spec),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Plano-convex surface pair refused
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    elements:[
      {id:'F1',type:'refracting-surface',x:-10,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'B1',type:'refracting-surface',x:10,signedRadius:-100,downstreamIndex:1}
    ]
  },example.spec),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Cemented doublet (back does not return to shared outsideIndex) refused
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    elements:[
      {id:'F1',type:'refracting-surface',x:-10,signedRadius:100,downstreamIndex:1.5},
      {id:'B1',type:'refracting-surface',x:10,signedRadius:-100,downstreamIndex:1.6}
    ]
  },example.spec),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  // Missing explicit partialReflection
  const noFresnel=structuredClone(example.spec);
  delete noFresnel.partialReflection;
  await assert.rejects(()=>buildRefractiveStackNativeWitness(example.stack,noFresnel),{code:'INVALID_WITNESS_SPEC'});

  // Extra mirrorLength when no terminal mirror exists
  await assert.rejects(()=>buildRefractiveStackNativeWitness(
    example.stack,{...example.spec,mirrorLength:80}
  ),{code:'INVALID_WITNESS_SPEC'});

  // Virtual object (object.x >= first surface x) refused by stack validation
  await assert.rejects(()=>buildRefractiveStackNativeWitness({
    ...example.stack,
    object:{x:50,y:0}
  },{
    ...example.spec,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.5}
  }),{code:'UNSUPPORTED_SCOPE'});

  // Mismatched surface IDs in bodies
  const badBody=structuredClone(example.spec);
  badBody.bodies[0].frontSurfaceId='WRONG';
  await assert.rejects(()=>buildRefractiveStackNativeWitness(example.stack,badBody),{code:'INVALID_WITNESS_SPEC'});
});

test('offline CLI scripts/witness-refractive-stack.mjs executes capabilities, plan, and run cleanly',()=>{
  const dir=mkdtempSync(join(tmpdir(),'opticsim-refr-witness-'));
  try{
    const stackFile=join(dir,'stack.json');
    const specFile=join(dir,'spec.json');
    writeFileSync(stackFile,JSON.stringify(example.stack,null,2));
    writeFileSync(specFile,JSON.stringify(example.spec,null,2));

    const caps=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-refractive-stack.mjs'),'capabilities'],{cwd:root,encoding:'utf8'}));
    assert.equal(caps.formats.spec,REFRACTIVE_WITNESS_SPEC);

    const plan=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-refractive-stack.mjs'),'plan',stackFile,specFile],{cwd:root,encoding:'utf8'}));
    assert.equal(plan.format,REFRACTIVE_WITNESS_PLAN);

    const run=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-refractive-stack.mjs'),'run',stackFile,specFile],{cwd:root,encoding:'utf8'}));
    assert.equal(run.format,REFRACTIVE_WITNESS_REPORT);
    assert.equal(run.native.executionPassed,true);
    assert.equal(run.native.v38EndpointsVerified,true);
    assert.equal(run.comparison.status,'observed-ray-geometry-compared');
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
