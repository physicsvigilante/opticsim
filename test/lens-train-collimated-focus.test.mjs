import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {analyzeCollimatedFocus,collimatedFocusCapabilities,COLLIMATED_FOCUS_FACTS,COLLIMATED_FOCUS_QUERY} from '../src/lens-train-collimated-focus.js';
import {calculateLensTrain} from '../src/lens-train-matrix.js';
import {measureNativeSingleRay} from './helpers/measure-native-single-ray.mjs';

const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example=()=>readJson('../examples/lens-train-collimated-focus.json');
const run=problem=>planProblem(problem).results[0];

function makeProblem(lenses,lengthUnit='mm',extra={}){
  return {
    format:'opticsim-problem-v1',
    physical:{
      format:COLLIMATED_FOCUS_FACTS,
      model:'coaxial-ideal-thin-lenses',
      signConvention:'x-increasing',
      incidence:'collimated-along-axis',
      lengthUnit,
      lenses
    },
    requests:[{id:'focus',kind:'lens-train-collimated-focus'}],
    ...extra
  };
}

function traceParallelRay(lensesMm,yIn,detectorX,aperture=40){
  const startX=lensesMm[0].x-40;
  const source={type:'SingleRay',brightness:0.04,p1:{x:startX,y:-yIn},p2:{x:startX+10,y:-yIn}};
  const objs=lensesMm.map(l=>({type:'IdealLens',p1:{x:l.x,y:-aperture/2},p2:{x:l.x,y:aperture/2},focalLength:l.focalLength}));
  const detector={type:'Detector',p1:{x:detectorX,y:-aperture/2},p2:{x:detectorX,y:aperture/2}};
  const record=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
    lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,...objs,detector]});
  assert.deepEqual(record.events.map(e=>e.objectIndex),Array.from({length:objs.length+1},(_,i)=>i+1));
  assert.ok(record.events.every(e=>e.before.x>0&&e.after.x>0));
  return record.events.at(-1);
}

test('two-lens converging system (Problem 19) matches across units and pinned native PhyDemo parallel rays',()=>{
  const r0=run(example());
  assert.equal(r0.status,'conditional');
  assert.equal(r0.nativeObservation,false);
  assert.equal(Object.hasOwn(r0,'nativeImageDetected'),true);
  assert.equal(r0.nativeImageDetected,false);
  assert.equal(r0.value.state,'downstream');
  assert.equal(r0.value.isAfocal,false);
  assert.equal(r0.value.referenceLensId,'L2');
  assert.equal(r0.value.backFocalDistance,2.4);
  assert.equal(r0.value.backFocusX,5.4);
  assert.equal(r0.value.effectiveFocalLength,4.2);
  assert.equal(r0.value.rearPrincipalOffset,-1.8);
  assert.equal(r0.value.rearPrincipalX,1.2);
  assert.ok(Math.abs(r0.value.equivalentPower-5/21)<1e-15);

  for(const [unit,scale] of [['mm',10],['cm',1],['m',0.01],['scale-unit',1]]){
    const res=run(makeProblem([
      {id:'L1',x:0,focalLength:7*scale},
      {id:'L2',x:3*scale,focalLength:6*scale}
    ],unit));
    assert.equal(res.status,'conditional',unit);
    assert.equal(res.value.state,'downstream',unit);
    assert.ok(Math.abs(res.value.backFocalDistance-2.4*scale)<1e-12*scale,unit+' BFD');
    assert.ok(Math.abs(res.value.effectiveFocalLength-4.2*scale)<1e-12*scale,unit+' EFL');
  }

  // Independent pinned native PhyDemo SingleRay verification in mm (x = 0, 30; f = 70, 60 -> focus at x = 54 mm).
  const lensesMm=[{x:0,focalLength:70},{x:30,focalLength:60}];
  const [rA,rB]=[-1,1].map(y=>traceParallelRay(lensesMm,y,40));
  const mA=rA.before.y/rA.before.x,mB=rB.before.y/rB.before.x;
  assert.ok(Math.abs(mA-mB)>1e-3);
  const delta=(rB.y-rA.y)/(mA-mB),focusX=rA.x+delta,focusY=rA.y+mA*delta;
  assert.ok(Math.abs(focusX-54)<1e-6,'native Problem 19 focus x = 54 mm');
  assert.ok(Math.abs(focusY)<1e-6,'native Problem 19 focus y = 0 mm');
});

test('three-lens mixed afocal system (Problem 21) emerges collimated analytically and in pinned native PhyDemo',()=>{
  for(const [unit,scale] of [['cm',1],['mm',10],['scale-unit',1]]){
    const res=run(makeProblem([
      {id:'L1',x:0,focalLength:10*scale},
      {id:'L2',x:15*scale,focalLength:-20*scale},
      {id:'L3',x:20*scale,focalLength:9*scale}
    ],unit));
    assert.equal(res.status,'conditional',unit);
    assert.equal(res.value.state,'afocal',unit);
    assert.equal(res.value.isAfocal,true,unit);
    assert.equal(res.value.equivalentPower,0,unit);
    assert.equal(res.value.effectiveFocalLength,null,unit);
    assert.equal(res.value.backFocalDistance,null,unit);
    assert.equal(res.value.backFocusX,null,unit);
    assert.equal(res.value.rearPrincipalX,null,unit);
    assert.equal(res.value.beamHeightScale,-1.125,unit);
    assert.ok(Math.abs(res.value.angularScale+8/9)<1e-15,unit);
  }

  // Independent pinned native PhyDemo SingleRay verification in mm.
  const lensesMm=[{x:0,focalLength:100},{x:150,focalLength:-200},{x:200,focalLength:90}];
  for(const yIn of [-1,1]){
    const hit=traceParallelRay(lensesMm,yIn,240);
    const slope=hit.before.y/hit.before.x;
    assert.ok(Math.abs(slope)<1e-12,'native Problem 21 emerging ray must be collimated');
    assert.ok(Math.abs(hit.y-(-1.125*yIn))<1e-9,'native Problem 21 beam height scale = -1.125');
  }
});

test('upstream virtual focus, at-last-lens focus, single lenses, and 4-lens train agree with native controls and Gaussian imaging',()=>{
  // 1. Single converging and single diverging lenses
  const conv=run(makeProblem([{id:'L1',x:10,focalLength:100}],'mm'));
  assert.equal(conv.value.state,'downstream');
  assert.equal(conv.value.backFocalDistance,100);
  assert.equal(conv.value.backFocusX,110);
  assert.equal(conv.value.rearPrincipalOffset,0);
  assert.equal(conv.value.rearPrincipalX,10);

  const div=run(makeProblem([{id:'L1',x:10,focalLength:-100}],'mm'));
  assert.equal(div.value.state,'upstream');
  assert.equal(div.value.backFocalDistance,-100);
  assert.equal(div.value.backFocusX,-90);
  assert.equal(div.value.effectiveFocalLength,-100);
  assert.equal(div.value.rearPrincipalX,10);

  // 2. Two-lens upstream virtual focus + native control
  const divPair=[{id:'L1',x:0,focalLength:-100},{id:'L2',x:50,focalLength:-100}];
  const divRes=run(makeProblem(divPair,'mm'));
  assert.equal(divRes.status,'conditional');
  assert.equal(divRes.value.state,'upstream');
  // L1 focuses parallel at -100 (150 in front of L2); L2: 1/v = -1/100 - 1/150 = -1/60 -> v = -60, x = -10.
  assert.equal(divRes.value.backFocalDistance,-60);
  assert.equal(divRes.value.backFocusX,-10);
  const [dA,dB]=[-1,1].map(y=>traceParallelRay(divPair,y,80));
  const dmA=dA.before.y/dA.before.x,dmB=dB.before.y/dB.before.x;
  const dFocusX=dA.x+(dB.y-dA.y)/(dmA-dmB);
  assert.ok(Math.abs(dFocusX-(-10))<1e-6,'native diverging pair virtual focus x = -10 mm');

  // 3. Exact at-last-lens focus (A = 0) + native control
  const atLast=[{id:'L1',x:0,focalLength:80},{id:'L2',x:80,focalLength:50}];
  const atLastRes=run(makeProblem(atLast,'mm'));
  assert.equal(atLastRes.status,'conditional');
  assert.equal(atLastRes.value.state,'at-last-lens');
  assert.equal(atLastRes.value.backFocalDistance,0);
  assert.equal(atLastRes.value.backFocusX,80);
  assert.equal(atLastRes.value.effectiveFocalLength,80);
  assert.equal(atLastRes.value.rearPrincipalX,0);
  const [aA,aB]=[-1,1].map(y=>traceParallelRay(atLast,y,120));
  const amA=aA.before.y/aA.before.x,amB=aB.before.y/aB.before.x;
  const aFocusX=aA.x+(aB.y-aA.y)/(amA-amB);
  assert.ok(Math.abs(aFocusX-80)<1e-6,'native at-last-lens focus x = 80 mm');

  // 4. Four-lens mixed train verified against far-object calculateLensTrain limit and native trace
  const four=[
    {id:'L1',x:0,focalLength:60},
    {id:'L2',x:40,focalLength:-40},
    {id:'L3',x:80,focalLength:80},
    {id:'L4',x:120,focalLength:50}
  ];
  const fourRes=run(makeProblem(four,'mm'));
  assert.equal(fourRes.status,'conditional');
  assert.equal(fourRes.value.isAfocal,false);
  assert.equal(fourRes.value.backFocusX,-80);
  assert.equal(fourRes.value.effectiveFocalLength,600);
  assert.equal(fourRes.value.rearPrincipalX,-680);
  for(const ox of [-500,-2000,-1e5]){
    const pred=calculateLensTrain(ox,four).prediction;
    assert.ok(pred.kind==='finite-real'||pred.kind==='finite-virtual');
    assert.ok(Math.abs((pred.x-fourRes.value.backFocusX)+pred.magnification*fourRes.value.effectiveFocalLength)<1e-9,'exact Newtonian focal relation at '+ox);
  }
  assert.ok(Math.abs((fourRes.value.backFocusX-fourRes.value.rearPrincipalX)-fourRes.value.effectiveFocalLength)<1e-12,'Gaussian rear principal-plane identity');
  const [fA,fB]=[-0.5,0.5].map(y=>traceParallelRay(four,y,160));
  const fmA=fA.before.y/fA.before.x,fmB=fB.before.y/fB.before.x;
  const fFocusX=fA.x+(fB.y-fA.y)/(fmA-fmB);
  assert.ok(Math.abs(fFocusX-fourRes.value.backFocusX)<1e-6,'native 4-lens focus agrees with exact BFD');
});

test('axial translation and unsorted input order preserve offsets and do not mutate caller arrays',()=>{
  const raw=[
    {id:'L2',x:53,focalLength:6},
    {id:'L1',x:50,focalLength:7}
  ];
  const snapshot=structuredClone(raw);
  const res=run(makeProblem(raw,'cm'));
  assert.deepEqual(raw,snapshot,'caller array must not be mutated');
  assert.equal(res.status,'conditional');
  assert.deepEqual(res.value.lensOrder,['L1','L2']);
  assert.equal(res.value.firstLensId,'L1');
  assert.equal(res.value.referenceLensId,'L2');
  assert.equal(res.value.backFocalDistance,2.4);
  assert.equal(res.value.backFocusX,55.4);
  assert.equal(res.value.rearPrincipalOffset,-1.8);
  assert.equal(res.value.rearPrincipalX,51.2);
});

test('near-afocal and near-focus-at-last-lens boundaries return numerically-indeterminate',()=>{
  // 1. Near-afocal perturbation
  const nearAfocal=run(makeProblem([
    {id:'L1',x:0,focalLength:100},
    {id:'L2',x:200+1e-10,focalLength:100}
  ],'mm'));
  assert.equal(nearAfocal.status,'numerically-indeterminate');
  assert.equal(nearAfocal.reasonCode,'NEAR_AFOCAL_BOUNDARY');
  assert.equal(nearAfocal.value,null);

  // 1b. Binary64 decimal shift on afocal 3-lens relay (0.9 - 0.5 !== 0.4 in IEEE-754)
  const binary64Shift=run(makeProblem([
    {id:'L1',x:0.1,focalLength:0.4},
    {id:'L2',x:0.5,focalLength:0.1},
    {id:'L3',x:0.9,focalLength:0.4}
  ],'m'));
  assert.equal(binary64Shift.status,'numerically-indeterminate');
  assert.equal(binary64Shift.reasonCode,'NEAR_AFOCAL_BOUNDARY');

  // 2. Near focus at last lens (A != 0 inside relative 1e-10*sa band)
  const epsDyadic=2**-30;
  const nearAtLast=run(makeProblem([
    {id:'L1',x:0,focalLength:80},
    {id:'L2',x:80+epsDyadic,focalLength:50}
  ],'mm'));
  assert.equal(nearAtLast.status,'numerically-indeterminate');
  assert.equal(nearAtLast.reasonCode,'NEAR_FOCUS_AT_LAST_LENS');
  assert.equal(nearAtLast.value,null);
});

test('strict validation, refusals, verifyNative gate, CLI workflow, and historical contract preservation',()=>{
  const caps=problemWorkflowCapabilities();
  assert.deepEqual(caps.lensTrainCollimatedFocus.kinds,['lens-train-collimated-focus']);
  assert.equal(caps.requestKinds['lens-train-collimated-focus'].contract,COLLIMATED_FOCUS_QUERY);
  assert.deepEqual(collimatedFocusCapabilities().states,['downstream','upstream','at-last-lens','afocal']);

  // Missing facts -> needs-information
  assert.equal(run({format:'opticsim-problem-v1',physical:null,requests:[{id:'r',kind:'lens-train-collimated-focus'}]}).status,'needs-information');
  const missingInc=example();
  delete missingInc.physical.incidence;
  assert.equal(run(missingInc).status,'needs-information');

  // Unsupported facts/model/scope -> unavailable
  const oldFacts=readJson('../examples/lens-train-facts.json');
  assert.equal(run({...oldFacts,requests:[{id:'r',kind:'lens-train-collimated-focus'}]}).status,'unavailable');
  const finiteInc=example();
  finiteInc.physical.incidence='finite-object';
  assert.equal(run(finiteInc).status,'unavailable');
  assert.equal(run(makeProblem([],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:0}],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:50},{id:'L2',x:0.005,focalLength:50}],'mm')).status,'unavailable');

  // Invalid inputs -> invalid-input
  const dupId=makeProblem([{id:'L1',x:0,focalLength:50},{id:'L1',x:100,focalLength:50}],'mm');
  assert.equal(run(dupId).status,'invalid-input');
  const extraField=example();
  extraField.physical.objectX=-50;
  assert.equal(run(extraField).status,'invalid-input');
  assert.throws(()=>analyzeCollimatedFocus(example().physical,{format:COLLIMATED_FOCUS_QUERY,kind:'unknown'}),/Unknown/);

  // verifyNative: true is never bypassed by analytical success
  const withVerify=planProblem({...example(),verifyNative:true});
  assert.equal(withVerify.results[0].status,'conditional');
  assert.equal(withVerify.native.required,true);
  assert.equal(withVerify.native.canRun,false);

  // Historical contracts remain untouched
  const historical=planProblem(oldFacts);
  assert.equal(historical.results[0].value.imageX,37.5);
  const axialEx=planProblem(readJson('../examples/lens-train-axial-preservation.json'));
  assert.equal(axialEx.results[0].value.preservesAxialImagePosition,true);

  // CLI preflight and run into fresh test-artifacts directory
  mkdirSync('test-artifacts/llm-authoring',{recursive:true});
  const baseDir=mkdtempSync('test-artifacts/llm-authoring/collimated-focus-cli-');
  const outDir=join(baseDir,'run');
  try{
    const pre=JSON.parse(execFileSync(process.execPath,['scripts/preflight-problem.mjs','examples/lens-train-collimated-focus.json'],{encoding:'utf8'}));
    assert.equal(pre.results[0].status,'conditional');
    assert.equal(Object.hasOwn(pre.results[0],'nativeImageDetected'),true);
    assert.equal(pre.results[0].nativeImageDetected,false);
    assert.equal(pre.results[0].value.backFocalDistance,2.4);

    const cliSummary=JSON.parse(execFileSync(process.execPath,['scripts/run-problem.mjs','examples/lens-train-collimated-focus.json','--out',outDir],{encoding:'utf8'}));
    assert.equal(cliSummary.status,'all-requested-quantities-available');
    assert.equal(cliSummary.native.status,'not-run');
    const cliReport=JSON.parse(readFileSync(cliSummary.report,'utf8'));
    assert.equal(cliReport.results[0].status,'conditional');
    assert.equal(Object.hasOwn(cliReport.results[0],'nativeImageDetected'),true);
    assert.equal(cliReport.results[0].nativeImageDetected,false);
    assert.equal(cliReport.results[0].value.backFocalDistance,2.4);
    assert.equal(cliReport.portable.status,'not-created');
    assert.equal(cliReport.dispatch.nativeCalls,0);
  }finally{
    rmSync(baseDir,{recursive:true,force:true});
  }
});
