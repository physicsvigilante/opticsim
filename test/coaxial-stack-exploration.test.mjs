import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {
  COAXIAL_STACK_COMPARISON,
  COAXIAL_STACK_PACKAGE,
  COAXIAL_STACK_PARAM_REVISION,
  COAXIAL_STACK_STRUCTURE_REVISION,
  COAXIAL_STACK_SWEEP,
  COAXIAL_STACK_SWEEP_REPORT,
  coaxialStackExplorationCapabilities,
  coaxialStackHash,
  compareCoaxialStackResults,
  createCoaxialStackPackage,
  plotCoaxialStackSweep,
  reviseCoaxialStack,
  reviseCoaxialStackStructure,
  runCoaxialStackSweep,
  verifyCoaxialStackPackage
} from '../src/coaxial-stack-exploration.js';
import {canonicalJSON,sha256Text} from '../src/qualified-utils.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const cliPath=resolve(root,'scripts/explore-coaxial-stack.mjs');
const exampleData=JSON.parse(readFileSync(resolve(root,'examples/coaxial-stack-exploration.json'),'utf8'));

function baseSingleLens(extra={}){
  return {
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-200,y:10},
    elements:[{id:'L1',type:'thin-lens',x:0,focalLength:100}],
    ...extra
  };
}

function baseTwoLens(extra={}){
  return {
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    object:{x:-200,y:10},
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'L2',type:'thin-lens',x:150,focalLength:50}
    ],
    ...extra
  };
}

test('capabilities, canonical hashing, -0 equivalence, and invalid baseline rejection',async()=>{
  const caps=coaxialStackExplorationCapabilities();
  assert.equal(caps.formats.package,COAXIAL_STACK_PACKAGE);
  assert.equal(caps.formats.sweep,COAXIAL_STACK_SWEEP);
  assert.equal(caps.limits.sweep.maxSamples,25);
  assert.equal(caps.nativeObservation,false);
  assert.equal(caps.nativeImageDetected,false);
  assert.equal(caps.questionSupport,'not-assessed-by-engine');

  const a=baseSingleLens();
  const reordered={
    elements:[{focalLength:100,x:-0,type:'thin-lens',id:'L1'}],
    object:{y:10,x:-200},
    incidentIndex:1,
    lengthUnit:'mm',
    signConvention:'x-increasing',
    model:'coaxial-paraxial-optical-stack',
    format:COAXIAL_STACK_FACTS
  };
  const h1=await coaxialStackHash(a);
  const h2=await coaxialStackHash(reordered);
  assert.equal(h1,h2);
  assert.match(h1,/^[0-9a-f]{64}$/);

  // Async snapshot isolation: mutating caller object immediately after call cannot change digest.
  const mutable=baseSingleLens();
  const pending=coaxialStackHash(mutable);
  mutable.elements[0].focalLength=500;
  assert.equal(await pending,h1);

  // Invalid stack facts are rejected before hashing.
  await assert.rejects(()=>coaxialStackHash({...a,incidentIndex:0.5}),{code:'UNSUPPORTED_SCOPE'});
  await assert.rejects(()=>coaxialStackHash({...a,elements:[]}),{code:'UNSUPPORTED_SCOPE'});
});

test('package creation, verification, and tamper-detection invariants',async()=>{
  const base=baseTwoLens();
  const pkg=await createCoaxialStackPackage(base,{
    sourceNote:'Two-lens relay baseline for classroom what-if exploration.',
    assumptions:['Paraxial rays near optical axis']
  });
  assert.equal(pkg.format,COAXIAL_STACK_PACKAGE);
  assert.equal(pkg.provenanceStatus,'author-declared-not-verified');
  assert.equal(pkg.nativeObservation,false);
  assert.equal(pkg.nativeImageDetected,false);
  assert.equal(pkg.baselineSha256,pkg.currentSha256);
  assert.deepEqual(pkg.retiredIds,[]);
  assert.deepEqual(pkg.edits,[]);

  const verified=await verifyCoaxialStackPackage(pkg);
  assert.equal(verified.integritySha256,pkg.integritySha256);

  // Tamper with baseline facts -> rejected.
  const badBase=structuredClone(pkg);
  badBase.baselineFacts.elements[0].focalLength=120;
  await assert.rejects(()=>verifyCoaxialStackPackage(badBase),{code:'CORRUPT_PACKAGE'});

  // Tamper with metadata -> integrity hash fails.
  const badMeta=structuredClone(pkg);
  badMeta.metadata.sourceNote='Altered source claim';
  await assert.rejects(()=>verifyCoaxialStackPackage(badMeta),{code:'CORRUPT_PACKAGE'});

  // Tamper with native flags -> rejected.
  const badNative=structuredClone(pkg);
  badNative.nativeImageDetected=true;
  await assert.rejects(()=>verifyCoaxialStackPackage(badNative),{code:'INVALID_PACKAGE'});

  // Forged package where lengthUnit changed between baseline and current (even with recomputed hashes!).
  const forgedUnit=structuredClone(pkg);
  forgedUnit.currentFacts.lengthUnit='cm';
  forgedUnit.currentSha256=await coaxialStackHash(forgedUnit.currentFacts);
  forgedUnit.edits=[{
    index:1,kind:'parameter-revision',
    parentSha256:forgedUnit.baselineSha256,
    resultSha256:forgedUnit.currentSha256,
    intent:'forged',addedIds:[],removedIds:[],
    changes:[{target:'stack',field:'lengthUnit',before:'mm',after:'cm'}]
  }];
  const {integritySha256:_ignored,...coreUnit}=forgedUnit;
  forgedUnit.integritySha256=await sha256Text(canonicalJSON(coreUnit));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedUnit),{code:'CORRUPT_PACKAGE'});

  // Forged package where an element changed type under the same ID (even with recomputed hashes!).
  const forgedType=structuredClone(pkg);
  forgedType.currentFacts.elements[1]={id:'L2',type:'terminal-mirror',x:150,signedRadius:-100};
  forgedType.currentSha256=await coaxialStackHash(forgedType.currentFacts);
  forgedType.edits=[{
    index:1,kind:'parameter-revision',
    parentSha256:forgedType.baselineSha256,
    resultSha256:forgedType.currentSha256,
    intent:'forged type swap',addedIds:[],removedIds:[],
    changes:[{target:'element',id:'L2',field:'type',before:'thin-lens',after:'terminal-mirror'}]
  }];
  const {integritySha256:_ignored2,...coreType}=forgedType;
  forgedType.integritySha256=await sha256Text(canonicalJSON(coreType));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedType),{code:'CORRUPT_PACKAGE'});

  // Astra P2 regression #1: forged ordinary parameter edit with recomputed hashes
  // (focalLength actually changed 100->150, while edits[0].changes falsely claims x: 0->20).
  const forgedParam=await createCoaxialStackPackage(baseSingleLens());
  forgedParam.currentFacts.elements[0].focalLength=150;
  forgedParam.currentSha256=await coaxialStackHash(forgedParam.currentFacts);
  forgedParam.edits=[{
    index:1,kind:'parameter-revision',
    parentSha256:forgedParam.baselineSha256,
    resultSha256:forgedParam.currentSha256,
    intent:null,addedIds:[],removedIds:[],
    changes:[{target:'element',id:'L1',field:'x',before:0,after:20}]
  }];
  const {integritySha256:_ignored3,...coreParam}=forgedParam;
  forgedParam.integritySha256=await sha256Text(canonicalJSON(coreParam));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedParam),{code:'CORRUPT_PACKAGE'});

  // Forged parameter edit with false `before` value (even with matching `after` and final SHA).
  const forgedBefore=await createCoaxialStackPackage(baseSingleLens());
  forgedBefore.currentFacts.elements[0].focalLength=150;
  forgedBefore.currentSha256=await coaxialStackHash(forgedBefore.currentFacts);
  forgedBefore.edits=[{
    index:1,kind:'parameter-revision',
    parentSha256:forgedBefore.baselineSha256,
    resultSha256:forgedBefore.currentSha256,
    intent:null,addedIds:[],removedIds:[],
    changes:[{target:'element',id:'L1',field:'focalLength',before:99,after:150}]
  }];
  const {integritySha256:_ignored4,...coreBefore}=forgedBefore;
  forgedBefore.integritySha256=await sha256Text(canonicalJSON(coreBefore));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedBefore),{code:'CORRUPT_PACKAGE'});

  // Astra P2 regression #2: element added in structural edit 1 (S1: refracting-surface),
  // then fabricated edit 2 mutates S1's type to terminal-mirror with recomputed hashes.
  const sPkg0=await createCoaxialStackPackage(baseSingleLens());
  const sPkg1=(await reviseCoaxialStackStructure(sPkg0,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:sPkg0.currentSha256,
    expectedIntegritySha256:sPkg0.integritySha256,
    operations:[{op:'add-element',position:'end',element:{id:'S1',type:'refracting-surface',x:50,signedRadius:'infinity',downstreamIndex:1.5}}]
  })).package;
  const forgedAddedType=structuredClone(sPkg1);
  forgedAddedType.currentFacts.elements[1]={id:'S1',type:'terminal-mirror',x:50,signedRadius:-200};
  forgedAddedType.currentSha256=await coaxialStackHash(forgedAddedType.currentFacts);
  forgedAddedType.edits.push({
    index:2,kind:'parameter-revision',
    parentSha256:sPkg1.currentSha256,
    resultSha256:forgedAddedType.currentSha256,
    intent:'forged type mutation on newly added element',addedIds:[],removedIds:[],
    changes:[{target:'element',id:'L1',field:'focalLength',before:100,after:120}]
  });
  const {integritySha256:_ignored5,...coreAddedType}=forgedAddedType;
  forgedAddedType.integritySha256=await sha256Text(canonicalJSON(coreAddedType));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedAddedType),{code:'CORRUPT_PACKAGE'});

  // Forged structural summary mismatching recorded operations (with recomputed integritySha256).
  const forgedStructSummary=structuredClone(sPkg1);
  forgedStructSummary.edits[0].changes=[{op:'add-element',id:'S1',type:'thin-lens',insertIndex:1}];
  const {integritySha256:_ignored6,...coreStruct}=forgedStructSummary;
  forgedStructSummary.integritySha256=await sha256Text(canonicalJSON(coreStruct));
  await assert.rejects(()=>verifyCoaxialStackPackage(forgedStructSummary),{code:'CORRUPT_PACKAGE'});

  // Metadata validation bounds.
  await assert.rejects(()=>createCoaxialStackPackage(base,{sourceNote:'   '}),{code:'INVALID_PACKAGE'});
  await assert.rejects(()=>createCoaxialStackPackage(base,{assumptions:Array(17).fill('ok')}),{code:'INVALID_PACKAGE'});
});

test('SHA-guarded targeted parameter revisions, ambient index shifts, and rejection guards',async()=>{
  const slabLens=structuredClone(exampleData.baselineFacts);
  const pkg=await createCoaxialStackPackage(slabLens);

  // Revise slab index S1.downstreamIndex (changes ambient index at S2) and lens x.
  const rev=await reviseCoaxialStack(pkg,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    intent:'Raise slab index to 1.8 and shift L1 to x=110 mm',
    changes:[
      {target:'element',id:'S1',field:'downstreamIndex',value:1.8},
      {target:'element',id:'L1',field:'x',value:110}
    ]
  });
  assert.equal(rev.changed,true);
  assert.equal(rev.nativeObservation,false);
  assert.equal(rev.nativeImageDetected,false);
  assert.equal(rev.changes.length,2);
  assert.equal(rev.ambientIndexShifts.length,1);
  assert.equal(rev.ambientIndexShifts[0].id,'S2');
  assert.equal(rev.ambientIndexShifts[0].beforeAmbientIndex,1.5);
  assert.equal(rev.ambientIndexShifts[0].afterAmbientIndex,1.8);
  assert.equal(rev.package.baselineSha256,pkg.baselineSha256);
  assert.equal(rev.package.edits.length,1);
  await verifyCoaxialStackPackage(rev.package);

  // Stale SHA on old package hash is rejected against revised package.
  await assert.rejects(()=>reviseCoaxialStack(rev.package,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:rev.package.integritySha256,
    changes:[{target:'element',id:'L1',field:'focalLength',value:120}]
  }),{code:'STALE_REVISION'});

  // Stale integrity SHA is rejected.
  await assert.rejects(()=>reviseCoaxialStack(rev.package,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rev.package.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    changes:[{target:'element',id:'L1',field:'focalLength',value:120}]
  }),{code:'STALE_PACKAGE'});

  // Raw facts work without expectedIntegritySha256, and reject expectedIntegritySha256 if supplied.
  const rawSha=await coaxialStackHash(slabLens);
  await assert.rejects(()=>reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    expectedIntegritySha256:pkg.integritySha256,
    changes:[{target:'element',id:'L1',field:'focalLength',value:120}]
  }),{code:'INVALID_REVISION'});

  // Updating S2.downstreamIndex shifts L1's ambient refractive index and reports thin-lens caution.
  const immerse=await reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    changes:[{target:'element',id:'S2',field:'downstreamIndex',value:1.33}]
  });
  assert.equal(immerse.ambientIndexShifts.length,1);
  assert.equal(immerse.ambientIndexShifts[0].id,'L1');
  assert.match(immerse.ambientIndexShifts[0].note,/thin-lens focalLength/);

  // Adding optional object.y onto an existing axial object works.
  const axial=baseSingleLens({object:{x:-200}});
  const axialSha=await coaxialStackHash(axial);
  const withY=await reviseCoaxialStack(axial,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:axialSha,
    changes:[{target:'object',field:'y',value:12}]
  });
  assert.equal(withY.facts.object.y,12);
  assert.equal(withY.changes[0].before,null);
  assert.equal(withY.changes[0].after,12);

  // Guards: no-op, duplicate target, unit edit, order-crossing x, absent object, wrong field.
  await assert.rejects(()=>reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    changes:[{target:'element',id:'L1',field:'focalLength',value:100}]
  }),{code:'NO_EFFECTIVE_CHANGE'});

  await assert.rejects(()=>reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    changes:[
      {target:'element',id:'L1',field:'focalLength',value:120},
      {target:'element',id:'L1',field:'focalLength',value:150}
    ]
  }),{code:'DUPLICATE_REVISION_TARGET'});

  await assert.rejects(()=>reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    changes:[{target:'stack',field:'lengthUnit',value:'cm'}]
  }),{code:'UNSUPPORTED_REVISION_TARGET'});

  await assert.rejects(()=>reviseCoaxialStack(slabLens,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:rawSha,
    changes:[{target:'element',id:'L1',field:'x',value:10}] // crosses S2 at x=30
  }),{code:'UNSUPPORTED_SCOPE'});

  const noObj=baseSingleLens();
  delete noObj.object;
  const noObjSha=await coaxialStackHash(noObj);
  await assert.rejects(()=>reviseCoaxialStack(noObj,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:noObjSha,
    changes:[{target:'object',field:'x',value:-100}]
  }),{code:'UNKNOWN_REVISION_TARGET'});
});

test('SHA-guarded atomic structural revisions, retired-ID guards, and lineage edit cap',async()=>{
  const pkg0=await createCoaxialStackPackage(baseTwoLens());

  // Insert a glass slab (S1, S2) between L1 (x=0) and L2 (x=150).
  const step1=await reviseCoaxialStackStructure(pkg0,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256,
    intent:'Insert a 30 mm n=1.5 glass slab between L1 and L2',
    operations:[
      {op:'add-element',position:{afterId:'L1'},element:{id:'S1',type:'refracting-surface',x:40,signedRadius:'infinity',downstreamIndex:1.5}},
      {op:'add-element',position:{afterId:'S1'},element:{id:'S2',type:'refracting-surface',x:70,signedRadius:'infinity',downstreamIndex:1}}
    ]
  });
  assert.deepEqual(step1.addedIds,['S1','S2']);
  assert.deepEqual(step1.removedIds,[]);
  assert.deepEqual(step1.facts.elements.map(e=>e.id),['L1','S1','S2','L2']);
  await verifyCoaxialStackPackage(step1.package);

  // Remove S2 -> L2 is now immersed in n=1.5, and S2 becomes retired!
  const step2=await reviseCoaxialStackStructure(step1.package,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:step1.package.currentSha256,
    expectedIntegritySha256:step1.package.integritySha256,
    intent:'Remove rear slab face S2 so downstream medium stays n=1.5',
    operations:[{op:'remove-element',id:'S2'}]
  });
  assert.deepEqual(step2.removedIds,['S2']);
  assert.deepEqual(step2.package.retiredIds,['S2']);
  assert.equal(step2.ambientIndexShifts.length,1);
  assert.equal(step2.ambientIndexShifts[0].id,'L2');
  assert.equal(step2.ambientIndexShifts[0].afterAmbientIndex,1.5);
  await verifyCoaxialStackPackage(step2.package);

  // Reusing retired ID 'S2' in a later structural edit is rejected!
  await assert.rejects(()=>reviseCoaxialStackStructure(step2.package,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:step2.package.currentSha256,
    expectedIntegritySha256:step2.package.integritySha256,
    operations:[{op:'add-element',position:{afterId:'S1'},element:{id:'S2',type:'refracting-surface',x:80,signedRadius:'infinity',downstreamIndex:1}}]
  }),{code:'RETIRED_ELEMENT_ID'});

  // Same-batch remove + re-add of the same ID is rejected even on raw facts (no disguised replacement!).
  const raw=baseSingleLens();
  const rawSha=await coaxialStackHash(raw);
  await assert.rejects(()=>reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[
      {op:'remove-element',id:'L1'},
      {op:'add-element',element:{id:'L1',type:'thin-lens',x:0,focalLength:200}}
    ]
  }),{code:'RETIRED_ELEMENT_ID'});

  // Atomic 1-element swap with a NEW stable ID succeeds (intermediate 0-element state allowed inside batch).
  const swapped=await reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[
      {op:'remove-element',id:'L1'},
      {op:'add-element',element:{id:'L1_alt',type:'thin-lens',x:0,focalLength:200}}
    ]
  });
  assert.deepEqual(swapped.removedIds,['L1']);
  assert.deepEqual(swapped.addedIds,['L1_alt']);
  assert.deepEqual(swapped.facts.elements.map(e=>e.id),['L1_alt']);

  // remove-object and add-object lifecycle.
  const noObjRes=await reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[{op:'remove-object'}]
  });
  assert.equal(noObjRes.objectChange,'removed');
  assert.equal('object' in noObjRes.facts,false);

  const reObjRes=await reviseCoaxialStackStructure(noObjRes.facts,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:noObjRes.sha256,
    operations:[{op:'add-object',object:{x:-150,y:5}}]
  });
  assert.equal(reObjRes.objectChange,'added');
  assert.deepEqual(reObjRes.facts.object,{x:-150,y:5});

  // Package round-trip verification across object-only structural edits (zero element additions/removals).
  const objPkg0=await createCoaxialStackPackage(baseSingleLens());
  const objPkg1=await reviseCoaxialStackStructure(objPkg0,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:objPkg0.currentSha256,
    expectedIntegritySha256:objPkg0.integritySha256,
    operations:[{op:'remove-object'}]
  });
  await verifyCoaxialStackPackage(objPkg1.package);
  const objPkg2=await reviseCoaxialStackStructure(objPkg1.package,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:objPkg1.package.currentSha256,
    expectedIntegritySha256:objPkg1.package.integritySha256,
    operations:[{op:'add-object',object:{x:-250}}]
  });
  await verifyCoaxialStackPackage(objPkg2.package);
  assert.equal(objPkg2.package.edits.length,2);
  assert.deepEqual(objPkg2.package.retiredIds,[]);

  // Invalid placements: terminal-mirror not final, unknown anchor, removing all elements.
  await assert.rejects(()=>reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[{op:'add-element',position:'start',element:{id:'M0',type:'terminal-mirror',x:-50,signedRadius:'infinity'}}]
  }),{code:'UNSUPPORTED_SCOPE'});

  await assert.rejects(()=>reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[{op:'add-element',position:{beforeId:'NO_SUCH'},element:{id:'L2',type:'thin-lens',x:50,focalLength:80}}]
  }),{code:'UNKNOWN_ANCHOR_ELEMENT'});

  await assert.rejects(()=>reviseCoaxialStackStructure(raw,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:rawSha,
    operations:[{op:'remove-element',id:'L1'}]
  }),{code:'UNSUPPORTED_SCOPE'});

  // Enforce the 64-edit history bound cleanly.
  let curPkg=await createCoaxialStackPackage(baseSingleLens());
  for(let i=0;i<64;i++){
    const next=await reviseCoaxialStack(curPkg,{
      format:COAXIAL_STACK_PARAM_REVISION,
      expectedSha256:curPkg.currentSha256,
      expectedIntegritySha256:curPkg.integritySha256,
      changes:[{target:'element',id:'L1',field:'focalLength',value:101+i}]
    });
    curPkg=next.package;
  }
  assert.equal(curPkg.edits.length,64);
  await verifyCoaxialStackPackage(curPkg);
  await assert.rejects(()=>reviseCoaxialStack(curPkg,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:curPkg.currentSha256,
    expectedIntegritySha256:curPkg.integritySha256,
    changes:[{target:'element',id:'L1',field:'focalLength',value:200}]
  }),{code:'EDIT_HISTORY_LIMIT'});
});

test('bounded parameter sweeps retain valid, at-infinity, indeterminate, and invalid samples from an unchanged baseline',async()=>{
  const base=baseSingleLens(); // L1 at x=0, f=100, object at x=-200
  const pkg=await createCoaxialStackPackage(base);
  const report=await runCoaxialStackSweep(pkg,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    parameter:{target:'object',field:'x'},
    values:[-200,-100,-100-1e-11,-50,0,20],
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'},
    plot:{field:'imageX'}
  });

  assert.equal(report.format,COAXIAL_STACK_SWEEP_REPORT);
  assert.equal(report.status,'completed-with-invalid-samples');
  assert.equal(report.plannedSamples,6);
  assert.equal(report.conditionalSamples,3);
  assert.equal(report.indeterminateSamples,1);
  assert.equal(report.invalidSamples,2);
  assert.equal(report.nativeObservation,false);
  assert.equal(report.nativeImageDetected,false);

  // Sample 0: baseline (-200) -> imageX = 200, mag = -1
  assert.equal(report.samples[0].matchesBaselineValue,true);
  assert.equal(report.samples[0].status,'conditional');
  assert.equal(report.samples[0].result.value.imageX,200);
  assert.equal(report.samples[0].result.value.magnification,-1);

  // Sample 1: exact focus (-100) -> conditional at-infinity
  assert.equal(report.samples[1].status,'conditional');
  assert.equal(report.samples[1].result.value.imageKind,'at-infinity');
  assert.equal(report.samples[1].result.value.imageX,null);

  // Sample 2: near focus -> numerically-indeterminate
  assert.equal(report.samples[2].status,'numerically-indeterminate');
  assert.equal(report.samples[2].result.reasonCode,'NEAR_FOCAL_SINGULARITY');

  // Sample 3: virtual image (-50) -> imageX = -100, mag = 2
  assert.equal(report.samples[3].status,'conditional');
  assert.equal(report.samples[3].result.value.imageKind,'finite-virtual');
  assert.equal(report.samples[3].result.value.imageX,-100);

  // Samples 4 & 5: object at or behind lens -> invalid-input retained explicitly
  assert.equal(report.samples[4].status,'invalid-input');
  assert.equal(report.samples[4].error.code,'UNSUPPORTED_SCOPE');
  assert.equal(report.samples[5].status,'invalid-input');

  // Plot projection maps non-finite/indeterminate/invalid samples to y: null with reasons.
  const series=plotCoaxialStackSweep(report);
  assert.equal(series.length,6);
  assert.deepEqual(series.map(p=>p.y),[200,null,null,-100,null,null]);
  assert.equal(series[0].reason,null);
  assert.match(series[1].reason,/infinity/i);
  assert.match(series[2].reason,/focal plane/i);
  assert.match(series[4].reason,/precede/i);

  // Sweep signedRadius through concave -> "infinity" (plane) -> convex on a return mirror!
  const returnStack={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit:'mm',
    incidentIndex:1,
    elements:[
      {id:'L1',type:'thin-lens',x:0,focalLength:100},
      {id:'M1',type:'terminal-mirror',x:150,signedRadius:-200}
    ]
  };
  const retSha=await coaxialStackHash(returnStack);
  const radiusSweep=await runCoaxialStackSweep(returnStack,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:retSha,
    parameter:{target:'element',id:'M1',field:'signedRadius'},
    values:[-200,'infinity',200],
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-transfer'},
    plot:{field:'equivalentPower'}
  });
  assert.equal(radiusSweep.status,'completed');
  assert.equal(radiusSweep.samples[1].value,'infinity');
  assert.equal(radiusSweep.samples[1].result.value.selfConjugateObjects.length,2);
  const radiusPlot=plotCoaxialStackSweep(radiusSweep);
  assert.equal(radiusPlot[1].x,'infinity');
  assert.equal(typeof radiusPlot[1].y,'number');

  // Sweep validation guards: duplicate (0 and -0), >25 samples, "infinity" on focalLength, missing object.
  await assert.rejects(()=>runCoaxialStackSweep(pkg,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    parameter:{target:'object',field:'y'},
    values:[0,-0],
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'}
  }),{code:'INVALID_SWEEP'});

  await assert.rejects(()=>runCoaxialStackSweep(pkg,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    parameter:{target:'element',id:'L1',field:'focalLength'},
    values:Array.from({length:26},(_,i)=>50+i),
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'}
  }),{code:'INVALID_SWEEP'});

  await assert.rejects(()=>runCoaxialStackSweep(pkg,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:pkg.currentSha256,
    expectedIntegritySha256:pkg.integritySha256,
    parameter:{target:'element',id:'L1',field:'focalLength'},
    values:[100,'infinity'],
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'}
  }),{code:'INVALID_SWEEP'});

  await assert.rejects(()=>runCoaxialStackSweep(returnStack,{
    format:COAXIAL_STACK_SWEEP,
    expectedSha256:retSha,
    parameter:{target:'element',id:'M1',field:'signedRadius'},
    values:[-200,'infinity'],
    query:{format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'}
  }),{code:'MISSING_FACTS'});
});

test('guarded baseline-vs-variant comparison enforces units, exit reference planes, and qualitative transitions',async()=>{
  const qConj={format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-conjugate'};
  const qColl={format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-collimated-focus'};
  const qTrans={format:COAXIAL_STACK_QUERY,kind:'coaxial-stack-transfer'};

  // 1. Parameter edit with fixed exit plane -> global and exit-relative deltas both comparable.
  const pkg0=await createCoaxialStackPackage(baseSingleLens());
  const revF=await reviseCoaxialStack(pkg0,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256,
    changes:[{target:'element',id:'L1',field:'focalLength',value:150}]
  });
  const cmp1=await compareCoaxialStackResults(pkg0,revF.package,qConj);
  assert.equal(cmp1.format,COAXIAL_STACK_COMPARISON);
  assert.equal(cmp1.compatibility.sameLengthUnit,true);
  assert.equal(cmp1.compatibility.sameExitReference,true);
  assert.equal(cmp1.compatibility.sameSourceBaseline,true);
  assert.equal(cmp1.nativeObservation,false);
  assert.equal(cmp1.nativeImageDetected,false);
  const mImgX=cmp1.metrics.find(m=>m.field==='imageX');
  const mImgDist=cmp1.metrics.find(m=>m.field==='imageDistance');
  assert.equal(mImgX.comparison,'comparable');
  assert.equal(mImgX.baseline,200);
  assert.equal(mImgX.variant,600);
  assert.equal(mImgX.delta,400);
  assert.equal(mImgDist.comparison,'comparable');
  assert.equal(mImgDist.delta,400);

  // 2. Parameter edit that moves the exit element x -> global imageX comparable, exit-relative imageDistance NOT comparable!
  const two0=await createCoaxialStackPackage(baseTwoLens());
  const movedExit=await reviseCoaxialStack(two0,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:two0.currentSha256,
    expectedIntegritySha256:two0.integritySha256,
    changes:[{target:'element',id:'L2',field:'x',value:170}]
  });
  const cmpMoved=await compareCoaxialStackResults(two0,movedExit.package,qConj);
  assert.equal(cmpMoved.compatibility.sameExitReference,false);
  assert.equal(cmpMoved.metrics.find(m=>m.field==='imageX').comparison,'comparable');
  assert.equal(cmpMoved.metrics.find(m=>m.field==='imageDistance').comparison,'not-comparable');
  assert.match(cmpMoved.metrics.find(m=>m.field==='imageDistance').reason,/Exit reference plane/);

  // 3. Structural edit adding a terminal-mirror (transmission -> return):
  //    global backFocusX comparable, exit-relative backFocalDistance NOT comparable.
  const withMirror=await reviseCoaxialStackStructure(pkg0,{
    format:COAXIAL_STACK_STRUCTURE_REVISION,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256,
    operations:[{op:'add-element',position:'end',element:{id:'M1',type:'terminal-mirror',x:150,signedRadius:-200}}]
  });
  const cmpRet=await compareCoaxialStackResults(pkg0,withMirror.package,qColl);
  assert.equal(cmpRet.statusTransitions.propagationMode.baseline,'transmission');
  assert.equal(cmpRet.statusTransitions.propagationMode.variant,'return');
  assert.equal(cmpRet.compatibility.samePropagationMode,false);
  assert.equal(cmpRet.compatibility.sameExitReference,false);
  assert.equal(cmpRet.metrics.find(m=>m.field==='backFocusX').comparison,'comparable');
  assert.equal(cmpRet.metrics.find(m=>m.field==='backFocalDistance').comparison,'not-comparable');

  // 4. Transfer query: non-afocal -> afocal transition + side-by-side selfConjugateComparison.
  const cmpTrans=await compareCoaxialStackResults(two0,await reviseCoaxialStack(two0,{
    format:COAXIAL_STACK_PARAM_REVISION,
    expectedSha256:two0.currentSha256,
    expectedIntegritySha256:two0.integritySha256,
    changes:[{target:'element',id:'L2',field:'x',value:150.0001}]
  }).then(r=>r.package),qTrans);
  // Wait: baseline two0 has f1=100, f2=50, d=150 -> exact afocal! Variant d=150.0001 -> non-afocal!
  assert.equal(cmpTrans.statusTransitions.isAfocal.baseline,true);
  assert.equal(cmpTrans.statusTransitions.isAfocal.variant,false);
  assert.equal(cmpTrans.metrics.find(m=>m.field==='equivalentPower').comparison,'comparable');
  assert.equal(cmpTrans.metrics.find(m=>m.field==='effectiveFocalLength').comparison,'not-comparable');
  assert.ok(cmpTrans.selfConjugateComparison);

  // 5. Unit mismatch (mm vs cm) -> all metrics not-comparable.
  const cmStack=baseSingleLens({lengthUnit:'cm',object:{x:-20,y:1},elements:[{id:'L1',type:'thin-lens',x:0,focalLength:10}]});
  const cmpUnit=await compareCoaxialStackResults(baseSingleLens(),cmStack,qConj);
  assert.equal(cmpUnit.compatibility.sameLengthUnit,false);
  assert.ok(cmpUnit.metrics.every(m=>m.comparison==='not-comparable'));
  assert.ok(cmpUnit.warnings.some(w=>/lengthUnit/.test(w)));

  // 6. Reused ID with changed type between raw stacks is explicitly flagged.
  const mirrorSameId=baseSingleLens({elements:[{id:'L1',type:'terminal-mirror',x:0,signedRadius:-200}]});
  const cmpType=await compareCoaxialStackResults(baseSingleLens(),mirrorSameId,qConj);
  assert.equal(cmpType.compatibility.reusedIdWithChangedType,true);
  assert.ok(cmpType.warnings.some(w=>/different element types/.test(w)));

  // 7. Conditional -> numerically-indeterminate transition withholds all numeric deltas and cites reasonCode.
  const nearFocal=baseSingleLens({object:{x:-100-1e-11,y:10}});
  const cmpIndet=await compareCoaxialStackResults(baseSingleLens(),nearFocal,qConj);
  assert.equal(cmpIndet.compatibility.bothConditional,false);
  assert.equal(cmpIndet.statusTransitions.status.variant,'numerically-indeterminate');
  assert.ok(cmpIndet.metrics.every(m=>m.comparison==='not-comparable'&&/NEAR_FOCAL_SINGULARITY/.test(m.reason)));

  // 8. Omitted object.y vs present object.y keeps imageY visible and not-comparable (never invents 0).
  const noY=baseSingleLens({object:{x:-200}});
  const cmpY=await compareCoaxialStackResults(noY,baseSingleLens(),qConj);
  const mImgY=cmpY.metrics.find(m=>m.field==='imageY');
  assert.ok(mImgY);
  assert.equal(mImgY.baseline,null);
  assert.equal(mImgY.variant,-10);
  assert.equal(mImgY.comparison,'not-comparable');

  // 9. Malformed sweep report throws INVALID_SWEEP_REPORT.
  assert.throws(()=>plotCoaxialStackSweep({format:COAXIAL_STACK_SWEEP_REPORT}),{code:'INVALID_SWEEP_REPORT'});
});

test('worked example fixture and offline CLI script execute end-to-end cleanly',async()=>{
  // Verify examples/coaxial-stack-exploration.json works cleanly as a live workflow!
  const base=exampleData.baselineFacts;
  const pkg0=await createCoaxialStackPackage(base);

  const paramRes=await reviseCoaxialStack(pkg0,{
    ...exampleData.parameterRevisionTemplate,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256
  });
  const structRes=await reviseCoaxialStackStructure(paramRes.package,{
    ...exampleData.structureRevisionTemplate,
    expectedSha256:paramRes.package.currentSha256,
    expectedIntegritySha256:paramRes.package.integritySha256
  });
  const sweepRes=await runCoaxialStackSweep(pkg0,{
    ...exampleData.sweepTemplate,
    expectedSha256:pkg0.currentSha256,
    expectedIntegritySha256:pkg0.integritySha256
  });
  assert.equal(structRes.facts.elements.at(-1).id,'M1');
  assert.equal(sweepRes.status,'completed');
  assert.equal(sweepRes.conditionalSamples,5);

  // Run the offline CLI across commands in a temporary directory.
  const dir=mkdtempSync(join(tmpdir(),'opticsim-coaxial-explore-'));
  try{
    const baseFile=join(dir,'baseline.json');
    const pkgFile=join(dir,'package.json');
    const revFile=join(dir,'rev.json');
    const revPkgFile=join(dir,'rev-package.json');
    const structFile=join(dir,'struct.json');
    const sweepFile=join(dir,'sweep.json');
    writeFileSync(baseFile,JSON.stringify(base,null,2));

    const runCli=(...args)=>JSON.parse(execFileSync(process.execPath,[cliPath,...args],{encoding:'utf8'}));

    const capsOut=runCli('capabilities');
    assert.equal(capsOut.formats.package,COAXIAL_STACK_PACKAGE);

    const hashOut=runCli('hash',baseFile);
    assert.equal(hashOut.sha256,pkg0.baselineSha256);

    const pkgOut=runCli('package',baseFile);
    writeFileSync(pkgFile,JSON.stringify(pkgOut,null,2));

    const verifyOut=runCli('verify',pkgFile);
    assert.equal(verifyOut.valid,true);

    writeFileSync(revFile,JSON.stringify({
      ...exampleData.parameterRevisionTemplate,
      expectedSha256:pkgOut.currentSha256,
      expectedIntegritySha256:pkgOut.integritySha256
    },null,2));
    const revOut=runCli('revise',pkgFile,revFile);
    assert.equal(revOut.changed,true);
    writeFileSync(revPkgFile,JSON.stringify(revOut.package,null,2));

    writeFileSync(structFile,JSON.stringify({
      ...exampleData.structureRevisionTemplate,
      expectedSha256:revOut.package.currentSha256,
      expectedIntegritySha256:revOut.package.integritySha256
    },null,2));
    const structOut=runCli('structure',revPkgFile,structFile);
    assert.deepEqual(structOut.addedIds,['M1']);

    writeFileSync(sweepFile,JSON.stringify({
      ...exampleData.sweepTemplate,
      expectedSha256:pkgOut.currentSha256,
      expectedIntegritySha256:pkgOut.integritySha256
    },null,2));
    const sweepOut=runCli('sweep',pkgFile,sweepFile);
    assert.equal(sweepOut.status,'completed');
    assert.equal(sweepOut.plotSeries.length,5);

    const cmpOut=runCli('compare',pkgFile,revPkgFile,'coaxial-stack-conjugate');
    assert.equal(cmpOut.format,COAXIAL_STACK_COMPARISON);
    assert.equal(cmpOut.compatibility.sameSourceBaseline,true);
    assert.equal(cmpOut.metrics.find(m=>m.field==='imageX').comparison,'comparable');

    // Invalid CLI usage exits nonzero with JSON error on stderr.
    assert.throws(()=>execFileSync(process.execPath,[cliPath,'unknown-cmd'],{stdio:'pipe'}));
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
