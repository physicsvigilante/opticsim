import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {
  COAXIAL_STACK_PARAM_REVISION,
  createCoaxialStackPackage,
  reviseCoaxialStack
} from '../src/coaxial-stack-exploration.js';
import {
  COAXIAL_WITNESS_PLAN,
  COAXIAL_WITNESS_REPORT,
  COAXIAL_WITNESS_SPEC,
  buildCoaxialStackNativeWitness,
  coaxialStackNativeWitnessCapabilities,
  runCoaxialStackNativeWitness
} from '../src/coaxial-stack-native-witness.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const cliPath=resolve(root,'scripts/witness-coaxial-stack.mjs');
const exampleData=JSON.parse(readFileSync(resolve(root,'examples/coaxial-stack-native-witness.json'),'utf8'));
const execute=(doc,requests)=>evaluateDocument(doc,core,requests);

test('classifyRun treats v37EndpointsVerified === false as incomplete (Astra P3 defense-in-depth)',()=>{
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v37EndpointsVerified:false
  }),'incomplete');
  assert.equal(core.classifyRun('simulationComplete',{
    errors:[],warnings:[],truncation:0,undefinedBehavior:0,v37EndpointsVerified:true
  }),'completed');
});

test('worked example verifies ideal-curved-mirror agreement and reveals real spherical aberration on circular-arc-mirror',async()=>{
  const caps=coaxialStackNativeWitnessCapabilities();
  assert.equal(caps.formats.spec,COAXIAL_WITNESS_SPEC);
  assert.equal(caps.targetNativeSchema.schemaVersion,37);

  // 1. Ideal curved mirror matches paraxial conjugate to sub-micrometer precision.
  const idealReport=await runCoaxialStackNativeWitness(exampleData.stackFacts,exampleData.witnessSpec,{execute});
  assert.equal(idealReport.format,COAXIAL_WITNESS_REPORT);
  assert.equal(idealReport.paraxial.nativeObservation,false);
  assert.equal(idealReport.paraxial.nativeImageDetected,false);
  assert.equal(idealReport.native.nativeObservation,true);
  assert.equal(idealReport.native.executionPassed,true);
  assert.equal(idealReport.native.v37EndpointsVerified,true);
  assert.equal(idealReport.nativeImageDetected,false);
  assert.equal(idealReport.comparison.status,'observed-ray-geometry-compared');
  assert.equal(idealReport.comparison.exitDirection,'-x');
  assert.ok(idealReport.comparison.outgoingHitCount>0);
  assert.ok(idealReport.comparison.nonExitDirectionHitCount>0,'forward-pass crossings must be separated from return rays');
  assert.ok(idealReport.comparison.maxPerpendicularMissMm<1e-6);
  assert.ok(idealReport.comparison.maxAbsDeltaYAtTargetXMm<1e-6);

  // 2. Same stack with real circular-arc-mirror at wider angle reveals genuine spherical aberration.
  const arcReport=await runCoaxialStackNativeWitness(exampleData.stackFacts,{
    ...exampleData.witnessSpec,
    mirrorModel:'circular-arc-mirror',
    emitter:{mode:'single-ray',directionDeg:14,brightness:0.5}
  },{execute});
  assert.equal(arcReport.native.executionPassed,true);
  assert.equal(arcReport.native.v37EndpointsVerified,true);
  assert.equal(arcReport.comparison.status,'observed-ray-geometry-compared');
  assert.equal(arcReport.comparison.outgoingHitCount,1);
  assert.ok(arcReport.comparison.maxPerpendicularMissMm>1e-3,'circular-arc-mirror should exhibit measurable non-paraxial aberration at 14 deg');
});

test('convex spherical terminal-mirror sign convention (+signedRadius -> diverging) agrees in both mirror models',async()=>{
  const convexStack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-150,y:0},
    elements:[
      {id:'M1',type:'terminal-mirror',x:0,signedRadius:200} // convex facing +x -> f = -100 mm, image at x = +60 mm (virtual)
    ]
  };
  const idealRep=await runCoaxialStackNativeWitness(convexStack,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    aperturesById:{M1:100},
    mirrorModel:'ideal-curved-mirror',
    emitter:{mode:'single-ray',directionDeg:5,brightness:0.5},
    detector:{id:'D1',x:-70,y:0,orientationDeg:90,length:140}
  },{execute});
  assert.equal(idealRep.paraxial.result.value.imageKind,'finite-virtual');
  assert.equal(idealRep.paraxial.result.value.imageX,60);
  assert.equal(idealRep.mapping.elements[0].nativeFocalLength,-100);
  assert.equal(idealRep.native.executionPassed,true);
  assert.equal(idealRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(idealRep.comparison.maxPerpendicularMissMm<1e-6);

  // Near-axis ray on convex circular-arc-mirror also tracks the virtual image closely.
  const arcRep=await runCoaxialStackNativeWitness(convexStack,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    aperturesById:{M1:100},
    mirrorModel:'circular-arc-mirror',
    emitter:{mode:'single-ray',directionDeg:1,brightness:0.5},
    detector:{id:'D1',x:-70,y:0,orientationDeg:90,length:140}
  },{execute});
  assert.equal(arcRep.mapping.elements[0].nativeRadius,-200);
  assert.equal(arcRep.native.executionPassed,true);
  assert.equal(arcRep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(arcRep.comparison.maxPerpendicularMissMm<0.02);
});

test('collimated-focus parallel-beam witness verifies both finite focus and afocal collimation',async()=>{
  // 1. Finite focus 2-lens transmission train.
  const twoLens={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'L2',type:'thin-lens',x:60,focalLength:80}
    ]
  };
  const focusRep=await runCoaxialStackNativeWitness(twoLens,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    aperturesById:{L1:100,L2:100},
    emitter:{mode:'parallel-beam',x:-120,y:0,width:30,brightness:0.2},
    detector:{id:'D1',x:120,y:0,orientationDeg:90,length:120},
    runPolicy:'preview-v1'
  },{execute});
  assert.equal(focusRep.native.executionPassed,true);
  assert.equal(focusRep.comparison.status,'observed-ray-geometry-compared');
  assert.equal(focusRep.comparison.outgoingHitCount,6); // width 30 * density 0.2 = 6 samples
  assert.ok(focusRep.comparison.maxPerpendicularMissMm<1e-6);

  // 2. Afocal 2-lens telescope (f1=100, f2=50, d=150).
  const afocal={
    ...twoLens,
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'L2',type:'thin-lens',x:150,focalLength:50}
    ]
  };
  const afocalRep=await runCoaxialStackNativeWitness(afocal,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    aperturesById:{L1:100,L2:100},
    emitter:{mode:'parallel-beam',x:-100,y:0,width:30,brightness:0.2},
    detector:{id:'D1',x:220,y:0,orientationDeg:90,length:120}
  },{execute});
  assert.equal(afocalRep.paraxial.result.value.isAfocal,true);
  assert.equal(afocalRep.comparison.status,'observed-afocal-collimation-compared');
  assert.equal(afocalRep.comparison.outgoingHitCount,6);
  assert.ok(afocalRep.comparison.maxAbsOutgoingSlope<1e-10);
});

test('verified lineage package + plane terminal-mirror return witness preserves package provenance',async()=>{
  const base={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-200,y:10},
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'M1',type:'terminal-mirror',x:160,signedRadius:'infinity'}
    ]
  };
  const pkg0=await createCoaxialStackPackage(base);
  const pkg1=(await reviseCoaxialStack(pkg0,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256,
    changes:[{target:'element',id:'M1',field:'x',value:180}]
  })).package;

  const rep=await runCoaxialStackNativeWitness(pkg1,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    aperturesById:{L1:120,M1:120},
    emitter:{mode:'single-ray',directionDeg:-2,brightness:0.5},
    detector:{id:'D1',x:-80,y:0,orientationDeg:90,length:160}
  },{execute});
  assert.equal(rep.stackSha256,pkg1.currentSha256);
  assert.equal(rep.packageIntegritySha256,pkg1.integritySha256);
  assert.equal(rep.native.executionPassed,true);
  assert.equal(rep.comparison.status,'observed-ray-geometry-compared');
  assert.ok(rep.comparison.maxPerpendicularMissMm<1e-6);
});

test('honest failure modes: endpoint suppression, zero outgoing hits, and strict scope/spec rejections',async()=>{
  // 1. Ray hitting finite mirror endpoint fails v37EndpointsVerified -> comparison withheld.
  const edgeStack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-100,y:50},
    elements:[{id:'M1',type:'terminal-mirror',x:0,signedRadius:'infinity'}]
  };
  const edgeRep=await runCoaxialStackNativeWitness(edgeStack,{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    aperturesById:{M1:100},
    emitter:{mode:'single-ray',directionDeg:0,brightness:0.5},
    detector:{id:'D1',x:-50,y:0,orientationDeg:90,length:140}
  },{execute});
  assert.equal(edgeRep.native.executionPassed,false);
  assert.equal(edgeRep.native.v37EndpointsVerified,false);
  assert.equal(edgeRep.comparison.status,'native-run-not-qualified');

  // 2. Detector placed completely away from outgoing rays -> no-outgoing-detector-hits.
  const missRep=await runCoaxialStackNativeWitness(exampleData.stackFacts,{
    ...exampleData.witnessSpec,
    emitter:{mode:'single-ray',directionDeg:0,brightness:0.5},
    detector:{id:'D1',x:-90,y:500,orientationDeg:90,length:40}
  },{execute});
  assert.equal(missRep.native.executionPassed,true);
  assert.equal(missRep.comparison.status,'no-outgoing-detector-hits');

  // 2b. Detector placed interior to a 2-lens transmission stack (between L1 and L2) is NOT
  // falsely compared against the post-L2 whole-stack paraxial focus.
  const interiorRep=await runCoaxialStackNativeWitness({
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'L2',type:'thin-lens',x:60,focalLength:80}
    ]
  },{
    format:COAXIAL_WITNESS_SPEC,
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'},
    aperturesById:{L1:100,L2:100},
    emitter:{mode:'parallel-beam',x:-100,y:0,width:20,brightness:0.2},
    detector:{id:'D_mid',x:30,y:0,orientationDeg:90,length:100}
  },{execute});
  assert.equal(interiorRep.native.executionPassed,true);
  assert.equal(interiorRep.comparison.status,'no-outgoing-detector-hits');
  assert.equal(interiorRep.comparison.nonExitDirectionHitCount,4);

  // 3. Strict scope rejections: refracting-surface, non-mm unit, incidentIndex != 1, missing aperture, missing/extra mirrorModel.
  const slabStack={
    ...exampleData.stackFacts,
    elements:[{id:'S1',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5}]
  };
  await assert.rejects(()=>buildCoaxialStackNativeWitness(slabStack,{
    ...exampleData.witnessSpec,aperturesById:{S1:100}
  }),{code:'UNSUPPORTED_WITNESS_SCOPE'});

  await assert.rejects(()=>buildCoaxialStackNativeWitness({...exampleData.stackFacts,lengthUnit:'cm'},exampleData.witnessSpec),
    {code:'UNSUPPORTED_WITNESS_SCOPE'});

  await assert.rejects(()=>buildCoaxialStackNativeWitness({...exampleData.stackFacts,incidentIndex:1.33},exampleData.witnessSpec),
    {code:'UNSUPPORTED_WITNESS_SCOPE'});

  await assert.rejects(()=>buildCoaxialStackNativeWitness(exampleData.stackFacts,{
    ...exampleData.witnessSpec,aperturesById:{L1:120} // missing M1
  }),{code:'MISSING_WITNESS_APERTURE'});

  const noMirrorModel={...exampleData.witnessSpec};
  delete noMirrorModel.mirrorModel;
  await assert.rejects(()=>buildCoaxialStackNativeWitness(exampleData.stackFacts,noMirrorModel),
    {code:'INVALID_WITNESS_SPEC'});
});

test('offline CLI scripts/witness-coaxial-stack.mjs executes capabilities, plan, and run cleanly',()=>{
  const dir=mkdtempSync(join(tmpdir(),'opticsim-coaxial-witness-'));
  try{
    const stackFile=join(dir,'stack.json');
    const specFile=join(dir,'spec.json');
    writeFileSync(stackFile,JSON.stringify(exampleData.stackFacts,null,2));
    writeFileSync(specFile,JSON.stringify(exampleData.witnessSpec,null,2));

    const runCli=(...args)=>JSON.parse(execFileSync(process.execPath,[cliPath,...args],{encoding:'utf8'}));

    const caps=runCli('capabilities');
    assert.equal(caps.formats.report,COAXIAL_WITNESS_REPORT);

    const plan=runCli('plan',stackFile,specFile);
    assert.equal(plan.format,COAXIAL_WITNESS_PLAN);
    assert.equal(plan.document.schemaVersion,37);

    const rep=runCli('run',stackFile,specFile);
    assert.equal(rep.format,COAXIAL_WITNESS_REPORT);
    assert.equal(rep.native.executionPassed,true);
    assert.equal(rep.native.v37EndpointsVerified,true);
    assert.equal(rep.comparison.status,'observed-ray-geometry-compared');
    assert.ok(rep.comparison.maxPerpendicularMissMm<1e-6);

    assert.throws(()=>execFileSync(process.execPath,[cliPath,'bad-cmd'],{stdio:'pipe'}));
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
