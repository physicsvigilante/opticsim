// Tests for the Hybrid Paraxial Stack <-> Native v39 Verification Bridge.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {
  HYBRID_WITNESS_PLAN,
  HYBRID_WITNESS_REPORT,
  HYBRID_WITNESS_SPEC,
  buildHybridStackNativeWitness,
  hybridNativeWitnessCapabilities,
  runHybridStackNativeWitness
} from '../src/hybrid-native-witness.js';
import {COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {createCoaxialStackPackage} from '../src/coaxial-stack-exploration.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
const core=require(resolve(root,'dist/test-core.cjs'));
const execute=(doc,requests)=>evaluateDocument(doc,core,requests);

const worked=JSON.parse(readFileSync(resolve(root,'examples/hybrid-native-witness.json'),'utf8'));

test('worked hybrid return example (thin lens + planar slab + concave mirror) completes 8/8 encounters and separates ideal-curved vs circular-arc aberration',async()=>{
  const arcReport=await runHybridStackNativeWitness(worked.stack,worked.witnessSpec,{execute});
  assert.equal(arcReport.format,HYBRID_WITNESS_REPORT);
  assert.equal(arcReport.paraxial.nativeObservation,false);
  assert.equal(arcReport.paraxial.nativeImageDetected,false);
  assert.equal(arcReport.native.nativeObservation,true);
  assert.equal(arcReport.native.nativeImageDetected,false);
  assert.equal(arcReport.native.schemaVersion,39);
  assert.equal(arcReport.native.executionPassed,true);
  assert.equal(arcReport.native.v39EndpointsVerified,true);
  assert.equal(arcReport.comparison.status,'observed-ray-geometry-compared');
  assert.equal(arcReport.comparison.routeQualification,'all-emitted-rays-encountered-every-element');
  assert.equal(arcReport.comparison.exitDirection,'-x');
  assert.equal(arcReport.comparison.outgoingHitCount,2);

  // Per-element encounter counts: 2 rays x (SL1: 4, L1: 2, CM1: 1).
  const enc=arcReport.comparison.stackEncounters.byElementId;
  assert.equal(enc.SL1.interactions,8);
  assert.equal(enc.SL1.transmitted,8);
  assert.equal(enc.SL1.reflected,0);
  assert.equal(enc.SL1.totalInternalReflections,0);
  assert.equal(enc.L1.incidents,4);
  assert.equal(enc.CM1.reflections,2);
  assert.equal(enc.CM1.incidents,2);

  // Paraxial ray (y=2) matches ABCD focus tightly; marginal ray (y=24) exhibits larger real spherical + slab aberration.
  const [paraxialHit,marginalHit]=arcReport.comparison.hits;
  assert.ok(paraxialHit.perpendicularMissMm<0.05,'paraxial ray should pass very close to ABCD focus');
  assert.ok(marginalHit.perpendicularMissMm>paraxialHit.perpendicularMissMm*10,'marginal ray should expose real finite-aperture aberration');

  // Same stack with ideal-curved-mirror eliminates mirror spherical aberration on paraxial ray.
  const idealSpec=structuredClone(worked.witnessSpec);
  idealSpec.mirrorModel='ideal-curved-mirror';
  const idealReport=await runHybridStackNativeWitness(worked.stack,idealSpec,{execute});
  assert.equal(idealReport.comparison.status,'observed-ray-geometry-compared');
  assert.ok(idealReport.comparison.hits[0].perpendicularMissMm<0.02);
});

const BASE_STACK={format:COAXIAL_STACK_FACTS,model:'coaxial-paraxial-optical-stack',signConvention:'x-increasing',lengthUnit:'mm'};

test('immersed (n=1.33) hybrid transmission stack (spherical-lens + thin-lens + planar slab) agrees with exact ABCD conjugate',async()=>{
  const stack={
    ...BASE_STACK,
    incidentIndex:1.33,
    object:{x:-240,y:4},
    elements:[
      {id:'F1',type:'refracting-surface',x:-60,signedRadius:100,downstreamIndex:1.6},
      {id:'F2',type:'refracting-surface',x:-44,signedRadius:-100,downstreamIndex:1.33},
      {id:'L1',type:'thin-lens',x:20,focalLength:200},
      {id:'S1',type:'refracting-surface',x:60,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:84,signedRadius:'infinity',downstreamIndex:1.33}
    ]
  };
  const spec={
    format:HYBRID_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    bodies:[
      {id:'G1',frontSurfaceId:'F1',backSurfaceId:'F2',apertureHeight:60},
      {id:'SL1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60}
    ],
    aperturesById:{L1:60},
    partialReflection:false,
    emitter:{mode:'single-ray',id:'R1',directionDeg:0.5,brightness:0.5},
    detector:{id:'D1',x:160,y:0,orientationDeg:90,length:140}
  };
  const report=await runHybridStackNativeWitness(stack,spec,{execute});
  assert.equal(report.native.executionPassed,true);
  assert.equal(report.native.v39EndpointsVerified,true);
  assert.equal(report.comparison.status,'observed-ray-geometry-compared');
  assert.equal(report.comparison.exitDirection,'+x');
  assert.equal(report.comparison.stackEncounters.byElementId.G1.interactions,2);
  assert.equal(report.comparison.stackEncounters.byElementId.L1.incidents,1);
  assert.equal(report.comparison.stackEncounters.byElementId.SL1.interactions,2);
  assert.ok(report.comparison.maxPerpendicularMissMm<0.05,'immersed paraxial hybrid ray should agree closely with exact ABCD');
});

test('parallel-beam collimated-focus witness on hybrid thin-lens + planar slab stack works with exploration package provenance',async()=>{
  const stack={
    ...BASE_STACK,
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:-60,focalLength:200},
      {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1}
    ]
  };
  const pkg=await createCoaxialStackPackage(stack);
  const spec={
    format:HYBRID_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    bodies:[{id:'SL1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:80}],
    aperturesById:{L1:80},
    partialReflection:false,
    emitter:{mode:'parallel-beam',id:'B1',x:-140,y:0,width:20,brightness:0.2},
    detector:{id:'D1',x:80,y:0,orientationDeg:90,length:120}
  };
  const report=await runHybridStackNativeWitness(pkg,spec,{execute});
  assert.equal(report.packageIntegritySha256,pkg.integritySha256);
  assert.equal(report.comparison.status,'observed-ray-geometry-compared');
  assert.ok(report.comparison.outgoingHitCount>=2);
  assert.ok(report.comparison.maxPerpendicularMissMm<0.05);
});

test('encounter gating withholds corroboration on bypassed ideal-lens, Fresnel truncation, and stale runner summaries',async()=>{
  // 1. Bypassed thin-lens (ray y=30 misses small lens apertureHeight=20 but hits wide slab and detector).
  const stack={
    ...BASE_STACK,
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:-60,focalLength:200},
      {id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:30,signedRadius:'infinity',downstreamIndex:1}
    ]
  };
  const bypassSpec={
    format:HYBRID_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    bodies:[{id:'SL1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:100}],
    aperturesById:{L1:20},
    partialReflection:false,
    emitter:{mode:'single-ray',rays:[{id:'R_miss',x:-120,y:30,brightness:0.5}]},
    detector:{id:'D1',x:80,y:0,orientationDeg:90,length:120}
  };
  const bypassReport=await runHybridStackNativeWitness(stack,bypassSpec,{execute});
  assert.equal(bypassReport.comparison.status,'stack-optics-not-encountered');
  assert.deepEqual(bypassReport.comparison.stackEncounters.zeroEncounterElementIds,['L1']);

  // 2. Partial Fresnel reflection enabled on return stack truncates -> native-run-not-qualified.
  const fresnelSpec=structuredClone(worked.witnessSpec);
  fresnelSpec.partialReflection=true;
  const fresnelReport=await runHybridStackNativeWitness(worked.stack,fresnelSpec,{execute});
  assert.equal(fresnelReport.comparison.status,'native-run-not-qualified');

  // 3. Stale runner summary (mismatched canonicalSha256) is withheld.
  const staleReport=await runHybridStackNativeWitness(worked.stack,worked.witnessSpec,{
    execute:()=>({summary:{canonicalSha256:'0'.repeat(64),executionPassed:true,native:{status:'completed',truncation:0,undefinedBehavior:0,errors:[],warnings:[]},observations:{v39EndpointsVerified:true},measurementState:'complete'}})
  });
  assert.equal(staleReport.comparison.status,'native-run-not-qualified');
});

test('strict scope and maxRayDepth=8 build-time refusals reject out-of-scope stacks cleanly',async()=>{
  // 1. 1 body + 2 thin lenses + terminal mirror = 4 + 4 + 2 = 10 > 8 encounters -> refused at build time.
  const tooDeepReturn={
    ...BASE_STACK,
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:-120,focalLength:200},
      {id:'L2',type:'thin-lens',x:-80,focalLength:200},
      {id:'S1',type:'refracting-surface',x:-20,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:20,signedRadius:'infinity',downstreamIndex:1},
      {id:'M1',type:'terminal-mirror',x:80,signedRadius:'infinity'}
    ]
  };
  await assert.rejects(
    buildHybridStackNativeWitness(tooDeepReturn,{
      ...worked.witnessSpec,
      mirrorModel:undefined,
      aperturesById:{L1:60,L2:60,M1:60}
    }),
    err=>err.code==='UNSUPPORTED_WITNESS_SCOPE'&&/maxRayDepth = 8/.test(err.message)
  );

  // 2. 2 bodies + terminal mirror = 8 + 2 = 10 > 8 -> refused at build time.
  const twoBodyReturn={
    ...BASE_STACK,
    incidentIndex:1,
    elements:[
      {id:'S1',type:'refracting-surface',x:-80,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S2',type:'refracting-surface',x:-50,signedRadius:'infinity',downstreamIndex:1},
      {id:'S3',type:'refracting-surface',x:-10,signedRadius:'infinity',downstreamIndex:1.5},
      {id:'S4',type:'refracting-surface',x:20,signedRadius:'infinity',downstreamIndex:1},
      {id:'M1',type:'terminal-mirror',x:80,signedRadius:'infinity'}
    ]
  };
  await assert.rejects(
    buildHybridStackNativeWitness(twoBodyReturn,{
      ...worked.witnessSpec,
      mirrorModel:undefined,
      bodies:[
        {id:'SL1',frontSurfaceId:'S1',backSurfaceId:'S2',apertureHeight:60},
        {id:'SL2',frontSurfaceId:'S3',backSurfaceId:'S4',apertureHeight:60}
      ],
      aperturesById:{M1:60}
    }),
    err=>err.code==='UNSUPPORTED_WITNESS_SCOPE'&&/maxRayDepth = 8/.test(err.message)
  );

  // 3. Pure thin-lens stack (0 dielectric bodies) -> refused (belongs to v37 witness).
  const pureThin={
    ...BASE_STACK,
    incidentIndex:1,
    elements:[{id:'L1',type:'thin-lens',x:0,focalLength:150}]
  };
  await assert.rejects(
    buildHybridStackNativeWitness(pureThin,{
      ...worked.witnessSpec,
      mirrorModel:undefined,
      bodies:[],
      aperturesById:{L1:60}
    }),
    err=>err.code==='UNSUPPORTED_WITNESS_SCOPE'&&/at least 1 finite dielectric body/.test(err.message)
  );

  // 4. Missing mirrorModel for spherical terminal mirror -> rejected.
  const noMirrorModel=structuredClone(worked.witnessSpec);
  delete noMirrorModel.mirrorModel;
  await assert.rejects(
    buildHybridStackNativeWitness(worked.stack,noMirrorModel),
    err=>err.code==='INVALID_WITNESS_SPEC'&&/mirrorModel/.test(err.message)
  );

  // 5. Missing explicit aperture in aperturesById -> rejected.
  const noAp=structuredClone(worked.witnessSpec);
  delete noAp.aperturesById.L1;
  await assert.rejects(
    buildHybridStackNativeWitness(worked.stack,noAp),
    err=>err.code==='MISSING_WITNESS_APERTURE'
  );
});

test('offline CLI scripts/witness-hybrid-stack.mjs executes capabilities, plan, and run cleanly',()=>{
  const caps=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-hybrid-stack.mjs'),'capabilities'],{cwd:root,encoding:'utf8'}));
  assert.deepEqual(caps,hybridNativeWitnessCapabilities());

  const tmp=mkdtempSync(join(tmpdir(),'opticsim-hybrid-witness-'));
  try{
    const stackPath=join(tmp,'stack.json');
    const specPath=join(tmp,'spec.json');
    writeFileSync(stackPath,JSON.stringify(worked.stack,null,2));
    writeFileSync(specPath,JSON.stringify(worked.witnessSpec,null,2));

    const plan=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-hybrid-stack.mjs'),'plan',stackPath,specPath],{cwd:root,encoding:'utf8'}));
    assert.equal(plan.format,HYBRID_WITNESS_PLAN);
    assert.equal(plan.document.schemaVersion,39);

    const run=JSON.parse(execFileSync(process.execPath,[resolve(root,'scripts/witness-hybrid-stack.mjs'),'run',stackPath,specPath],{cwd:root,encoding:'utf8'}));
    assert.equal(run.format,HYBRID_WITNESS_REPORT);
    assert.equal(run.comparison.status,'observed-ray-geometry-compared');
    assert.equal(run.native.v39EndpointsVerified,true);
  }finally{
    rmSync(tmp,{recursive:true,force:true});
  }
});
