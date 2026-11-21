import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {analyzeAxialPreservation,axialPreservationCapabilities,AXIAL_PRESERVATION_FACTS,AXIAL_PRESERVATION_QUERY} from '../src/lens-train-axial-preservation.js';
import {calculateLensTrain} from '../src/lens-train-matrix.js';
import {measureNativeSingleRay} from './helpers/measure-native-single-ray.mjs';

const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example=()=>readJson('../examples/lens-train-axial-preservation.json');
const frozen=readJson('../evaluation/three-lens-relay-study-v1/frozen.json');
const run=problem=>planProblem(problem).results[0];

function makeProblem(lenses,lengthUnit='mm',extra={}){
  return {
    format:'opticsim-problem-v1',
    physical:{
      format:AXIAL_PRESERVATION_FACTS,
      model:'coaxial-ideal-thin-lenses',
      signConvention:'x-increasing',
      lengthUnit,
      lenses
    },
    requests:[{id:'check',kind:'lens-train-axial-preservation'}],
    ...extra
  };
}

test('frozen PR 239 source relay and changed-middle-lens counterexample match in scale-unit and physical units',()=>{
  const base=example();
  const r0=run(base);
  assert.equal(r0.status,'conditional');
  assert.equal(r0.nativeObservation,false);
  assert.equal(Object.hasOwn(r0,'nativeImageDetected'),true);
  assert.equal(r0.nativeImageDetected,false);
  assert.equal(r0.value.isAfocal,true);
  assert.equal(r0.value.equivalentPower,0);
  assert.equal(r0.value.equivalentFocalLength,null);
  assert.equal(r0.value.constantTransverseMagnification,true);
  assert.equal(r0.value.transverseMagnification,-1);
  assert.equal(r0.value.transverseMagnificationMagnitude,1);
  assert.equal(r0.value.imageOrientation,'inverted');
  assert.equal(r0.value.preservesTransverseSize,true);
  assert.equal(r0.value.longitudinalMagnification,1);
  assert.equal(r0.value.constantAxialShift,true);
  assert.equal(r0.value.axialShift,0);
  assert.equal(r0.value.preservesAxialImagePosition,true);
  assert.deepEqual(r0.value.systemMatrix,{a:-1,b:-8,c:0,d:-1});
  assert.deepEqual(r0.value.lensOrder,['L1','L2','L3']);

  for(const trial of frozen.cases){
    for(const [unit,aVal] of [['scale-unit',1],['mm',frozen.nativeProtocol.aMm],['cm',frozen.nativeProtocol.aMm/10],['m',frozen.nativeProtocol.aMm/1000]]){
      const lenses=frozen.nativeProtocol.lensPositionFactors.map((pos,i)=>({
        id:'L'+(i+1),
        x:pos*aVal,
        focalLength:trial.focalScaleFactors[i]*aVal
      }));
      const res=run(makeProblem(lenses,unit));
      assert.equal(res.status,'conditional',trial.id+' '+unit);
      assert.equal(res.value.lengthUnit,unit);
      assert.equal(res.value.isAfocal,true);
      assert.equal(res.value.transverseMagnification,trial.transverseMagnification);
      assert.equal(res.value.constantAxialShift,true);
      assert.equal(res.value.axialShift,trial.expectedAxialShiftInA*aVal);
      assert.equal(res.value.preservesAxialImagePosition,trial.expectedAxialShiftInA===0);
      assert.equal(res.value.systemMatrix.a,trial.matrixInScaledCoordinates[0][0]);
      assert.equal(res.value.systemMatrix.b,trial.matrixInScaledCoordinates[0][1]*aVal);
      assert.equal(res.value.systemMatrix.c,trial.matrixInScaledCoordinates[1][0]/aVal);
      assert.equal(res.value.systemMatrix.d,trial.matrixInScaledCoordinates[1][1]);
    }
  }
});

test('four-lens upright axial-preserving relay agrees analytically and with pinned native PhyDemo SingleRay controls',()=>{
  // x = [0, 4, 8, 12], f = [3, 1, 1, 3] -> exact transfer matrix [[1, 12], [0, 1]], m = +1, deltaX = 0.
  const scaleRes=run(makeProblem([
    {id:'L1',x:0,focalLength:3},
    {id:'L2',x:4,focalLength:1},
    {id:'L3',x:8,focalLength:1},
    {id:'L4',x:12,focalLength:3}
  ],'scale-unit'));
  assert.equal(scaleRes.status,'conditional');
  assert.equal(scaleRes.value.isAfocal,true);
  assert.equal(scaleRes.value.transverseMagnification,1);
  assert.equal(scaleRes.value.imageOrientation,'upright');
  assert.equal(scaleRes.value.preservesTransverseSize,true);
  assert.equal(scaleRes.value.longitudinalMagnification,1);
  assert.equal(scaleRes.value.constantAxialShift,true);
  assert.equal(scaleRes.value.axialShift,0);
  assert.equal(scaleRes.value.preservesAxialImagePosition,true);
  assert.deepEqual(scaleRes.value.systemMatrix,{a:1,b:12,c:0,d:1});

  // Independent native PhyDemo SingleRay verification at a = 20 mm.
  const aMm=20,xs=[0,4,8,12].map(v=>v*aMm),fs=[3,1,1,3].map(v=>v*aMm);
  const detectorX=280,aperture=24;
  for(const objectX of [-40,-90])for(const height of [-0.2,0.2]){
    const pair=[-0.002,0.002].map(slope=>{
      const source={type:'SingleRay',brightness:0.04,p1:{x:objectX,y:-height},p2:{x:objectX+10,y:-height-10*slope}};
      const lenses=xs.map((x,i)=>({type:'IdealLens',p1:{x,y:-aperture/2},p2:{x,y:aperture/2},focalLength:fs[i]}));
      const detector={type:'Detector',p1:{x:detectorX,y:-aperture/2},p2:{x:detectorX,y:aperture/2}};
      const record=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
        lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,...lenses,detector]});
      assert.deepEqual(record.events.map(e=>e.objectIndex),[1,2,3,4,5]);
      assert.ok(record.events.every(e=>e.before.x>0&&e.after.x>0));
      return record.events.at(-1);
    });
    const [rA,rB]=pair;
    const mA=rA.before.y/rA.before.x,mB=rB.before.y/rB.before.x;
    assert.ok(Math.abs(mA-mB)>1e-4);
    const delta=(rB.y-rA.y)/(mA-mB),imageX=rA.x+delta,imageY=rA.y+mA*delta;
    assert.ok(Math.abs(imageX-objectX)<0.05,'native upright relay axial preservation');
    assert.ok(Math.abs(imageY-height)<0.001,'native upright relay transverse magnification +1');
  }
});

test('afocal telescopes, shifted relays, and non-afocal trains agree with calculateLensTrain across object positions',()=>{
  const cases=[
    {
      name:'keplerian-telescope',
      lenses:[{id:'obj',x:0,focalLength:200},{id:'eye',x:300,focalLength:100}],
      expected:{isAfocal:true,m:-0.5,mLong:0.25,orient:'inverted',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'galilean-telescope',
      lenses:[{id:'obj',x:0,focalLength:200},{id:'eye',x:150,focalLength:-50}],
      expected:{isAfocal:true,m:0.25,mLong:0.0625,orient:'upright',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'two-lens-2f-relay',
      lenses:[{id:'L1',x:0,focalLength:50},{id:'L2',x:100,focalLength:50}],
      expected:{isAfocal:true,m:-1,mLong:1,orient:'inverted',unitSize:true,constShift:true,shift:200,preserves:false}
    },
    {
      name:'three-lens-diverging-middle-shifted-relay',
      lenses:[{id:'L1',x:0,focalLength:100},{id:'L2',x:100,focalLength:-50},{id:'L3',x:200,focalLength:100}],
      expected:{isAfocal:true,m:-1,mLong:1,orient:'inverted',unitSize:true,constShift:true,shift:600,preserves:false}
    },
    {
      name:'single-converging-lens-non-afocal',
      lenses:[{id:'L1',x:0,focalLength:100}],
      expected:{isAfocal:false,m:null,mLong:null,orient:'object-dependent',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'single-diverging-lens-always-upright',
      lenses:[{id:'L1',x:0,focalLength:-100}],
      expected:{isAfocal:false,m:null,mLong:null,orient:'upright',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'two-lens-non-afocal-always-inverted',
      lenses:[{id:'L1',x:0,focalLength:100},{id:'L2',x:150,focalLength:100}],
      expected:{isAfocal:false,m:null,mLong:null,orient:'inverted',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'two-lens-non-afocal-exact-zero-D-always-inverted',
      lenses:[{id:'L1',x:0,focalLength:50},{id:'L2',x:100,focalLength:100}],
      expected:{isAfocal:false,m:null,mLong:null,orient:'inverted',unitSize:false,constShift:false,shift:null,preserves:false}
    },
    {
      name:'two-lens-non-afocal-object-dependent',
      lenses:[{id:'L1',x:0,focalLength:100},{id:'L2',x:50,focalLength:100}],
      expected:{isAfocal:false,m:null,mLong:null,orient:'object-dependent',unitSize:false,constShift:false,shift:null,preserves:false}
    }
  ];

  for(const tc of cases){
    const res=run(makeProblem(tc.lenses,'mm'));
    assert.equal(res.status,'conditional',tc.name);
    assert.equal(res.value.isAfocal,tc.expected.isAfocal,tc.name);
    assert.equal(res.value.constantTransverseMagnification,tc.expected.isAfocal,tc.name);
    assert.equal(res.value.transverseMagnification,tc.expected.m,tc.name);
    assert.equal(res.value.longitudinalMagnification,tc.expected.mLong,tc.name);
    assert.equal(res.value.imageOrientation,tc.expected.orient,tc.name);
    assert.equal(res.value.preservesTransverseSize,tc.expected.unitSize,tc.name);
    assert.equal(res.value.constantAxialShift,tc.expected.constShift,tc.name);
    assert.equal(res.value.axialShift,tc.expected.shift,tc.name);
    assert.equal(res.value.preservesAxialImagePosition,tc.expected.preserves,tc.name);

    const probes=[-300,-180,-75].map(ox=>({ox,pred:calculateLensTrain(ox,tc.lenses,2).prediction}));
    if(tc.expected.isAfocal){
      for(const {ox,pred} of probes){
        assert.ok(Math.abs(pred.magnification-tc.expected.m)<1e-12,tc.name+' mag at '+ox);
      }
      const dx0=probes[1].pred.x-probes[0].pred.x;
      assert.ok(Math.abs(dx0/(probes[1].ox-probes[0].ox)-tc.expected.mLong)<1e-12,tc.name+' mLong');
      if(tc.expected.constShift){
        for(const {ox,pred} of probes)assert.ok(Math.abs((pred.x-ox)-tc.expected.shift)<1e-10,tc.name+' shift');
      }
    }else{
      assert.ok(Math.abs(probes[0].pred.magnification-probes[1].pred.magnification)>1e-3,tc.name+' varying mag');
      if(tc.expected.orient==='upright'){
        for(const {ox,pred} of probes)assert.ok(pred.magnification>0,tc.name+' always upright at '+ox);
      }else if(tc.expected.orient==='inverted'){
        for(const {ox,pred} of probes)assert.ok(pred.magnification<0,tc.name+' always inverted at '+ox);
      }
    }
  }
});

test('axial translation and unsorted input order preserve results without mutating caller arrays',()=>{
  const raw=[
    {id:'L3',x:320,focalLength:100},
    {id:'L1',x:120,focalLength:100},
    {id:'L2',x:220,focalLength:25}
  ];
  const snapshot=structuredClone(raw);
  const res=run(makeProblem(raw,'mm'));
  assert.deepEqual(raw,snapshot,'caller array must not be mutated');
  assert.equal(res.status,'conditional');
  assert.deepEqual(res.value.lensOrder,['L1','L2','L3']);
  assert.equal(res.value.firstLensId,'L1');
  assert.equal(res.value.lastLensId,'L3');
  assert.equal(res.value.trainSpan,200);
  assert.equal(res.value.preservesAxialImagePosition,true);
  assert.equal(res.value.axialShift,0);
  assert.equal(res.value.transverseMagnification,-1);
});

test('near-afocal, near-unit-magnification, and near-zero-shift boundaries return numerically-indeterminate',()=>{
  // 1. Near-afocal perturbation (C != 0 inside relative 1e-10 band).
  const nearAfocal=run(makeProblem([
    {id:'L1',x:0,focalLength:100},
    {id:'L2',x:200+1e-10,focalLength:100}
  ],'mm'));
  assert.equal(nearAfocal.status,'numerically-indeterminate');
  assert.equal(nearAfocal.reasonCode,'NEAR_AFOCAL_BOUNDARY');
  assert.equal(nearAfocal.value,null);

  // 1b. Binary64 decimal shift (0.9 - 0.5 !== 0.4 in IEEE-754 binary64) must not silently claim non-afocal.
  const binary64Shift=run(makeProblem([
    {id:'L1',x:0.1,focalLength:0.4},
    {id:'L2',x:0.5,focalLength:0.1},
    {id:'L3',x:0.9,focalLength:0.4}
  ],'m'));
  assert.equal(binary64Shift.status,'numerically-indeterminate');
  assert.equal(binary64Shift.reasonCode,'NEAR_AFOCAL_BOUNDARY');

  // 2. Exact C = 0 afocal telescope with |m| near 1 (exact dyadic f1=128, f2=128+2^-30, d=f1+f2).
  const epsDyadic=2**-30;
  const nearUnitMag=run(makeProblem([
    {id:'L1',x:0,focalLength:128},
    {id:'L2',x:256+epsDyadic,focalLength:128+epsDyadic}
  ],'mm'));
  assert.equal(nearUnitMag.status,'numerically-indeterminate');
  assert.equal(nearUnitMag.reasonCode,'NEAR_UNIT_MAGNIFICATION_BOUNDARY');
  assert.equal(nearUnitMag.value,null);

  // 3. Exact C = 0 and A = -1 relay with nonzero axial shift inside relative 1e-10 band.
  // For x=[0,128,256], f=[128,f2,128], C=0 and A=-1 identically for every f2, while deltaX=512*(1-32/f2).
  const nearZeroShift=run(makeProblem([
    {id:'L1',x:0,focalLength:128},
    {id:'L2',x:128,focalLength:32+epsDyadic},
    {id:'L3',x:256,focalLength:128}
  ],'mm'));
  assert.equal(nearZeroShift.status,'numerically-indeterminate');
  assert.equal(nearZeroShift.reasonCode,'NEAR_ZERO_AXIAL_SHIFT');
  assert.equal(nearZeroShift.value,null);

  // 3b. Exact-dyadic four-lens cancellation-heavy A=D=1, C=0 train where deltaX != 0
  // lies inside the fully expanded positive-monomial bound EPS*(L + sa*sb) (PR #241 Round 1 P2 regression).
  const g=1/512,f=g*(1+2**-10),u=f+g,t=2*g*(f+g)/(f-g)+1000;
  const heavyCancellationShift=run(makeProblem([
    {id:'L1',x:0,focalLength:f},
    {id:'L2',x:u,focalLength:g},
    {id:'L3',x:u+t,focalLength:g},
    {id:'L4',x:2*u+t,focalLength:f}
  ],'scale-unit'));
  assert.equal(heavyCancellationShift.status,'numerically-indeterminate');
  assert.equal(heavyCancellationShift.reasonCode,'NEAR_ZERO_AXIAL_SHIFT');
  assert.equal(heavyCancellationShift.value,null);

  // 4. Non-afocal train with D != 0 inside relative 1e-10 band (front focal plane near first lens).
  const nearZeroD=run(makeProblem([
    {id:'L1',x:0,focalLength:50},
    {id:'L2',x:100,focalLength:100+epsDyadic}
  ],'mm'));
  assert.equal(nearZeroD.status,'numerically-indeterminate');
  assert.equal(nearZeroD.reasonCode,'NEAR_FRONT_FOCUS_AT_FIRST_LENS');
  assert.equal(nearZeroD.value,null);
});

test('strict validation, refusal of historical per-object facts, verifyNative gate, CLI, and historical preservation',()=>{
  // Capabilities publication & immutability
  const caps=problemWorkflowCapabilities();
  assert.deepEqual(caps.lensTrainAxialPreservation.kinds,['lens-train-axial-preservation']);
  assert.equal(caps.requestKinds['lens-train-axial-preservation'].contract,AXIAL_PRESERVATION_QUERY);
  assert.deepEqual(axialPreservationCapabilities().lengthUnits,['mm','cm','m','scale-unit']);

  // Missing facts -> needs-information
  assert.equal(run({format:'opticsim-problem-v1',physical:null,requests:[{id:'r',kind:'lens-train-axial-preservation'}]}).status,'needs-information');
  const missingLenses=example();
  delete missingLenses.physical.lenses;
  assert.equal(run(missingLenses).status,'needs-information');

  // Unsupported facts/model/scope -> unavailable
  const oldFacts=readJson('../examples/lens-train-facts.json');
  assert.equal(run({...oldFacts,requests:[{id:'r',kind:'lens-train-axial-preservation'}]}).status,'unavailable');
  assert.equal(run(makeProblem([],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([
    {id:'L1',x:0,focalLength:10},{id:'L2',x:10,focalLength:10},{id:'L3',x:20,focalLength:10},
    {id:'L4',x:30,focalLength:10},{id:'L5',x:40,focalLength:10}
  ],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:0}],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:50},{id:'L2',x:0.005,focalLength:50}],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:0.5}],'mm')).status,'unavailable');
  assert.equal(run(makeProblem([{id:'L1',x:0,focalLength:0.0005}],'scale-unit')).status,'unavailable');
  const wrongSign=example();
  wrongSign.physical.signConvention='x-decreasing';
  assert.equal(run(wrongSign).status,'unavailable');

  // Invalid inputs -> invalid-input
  const dupId=makeProblem([{id:'L1',x:0,focalLength:50},{id:'L1',x:100,focalLength:50}],'mm');
  assert.equal(run(dupId).status,'invalid-input');
  const extraField=example();
  extraField.physical.objectX=-50;
  assert.equal(run(extraField).status,'invalid-input');
  const strNum=makeProblem([{id:'L1',x:'0',focalLength:50}],'mm');
  assert.equal(run(strNum).status,'invalid-input');
  assert.throws(()=>analyzeAxialPreservation(example().physical,{format:AXIAL_PRESERVATION_QUERY,kind:'unknown'}),/Unknown/);

  // verifyNative: true is never satisfied by reduced-facts analytical success
  const withVerify=planProblem({...example(),verifyNative:true});
  assert.equal(withVerify.results[0].status,'conditional');
  assert.equal(withVerify.native.required,true);
  assert.equal(withVerify.native.canRun,false);

  // Historical per-object lens-train-facts example remains intact
  const historical=planProblem(oldFacts);
  assert.equal(historical.results[0].status,'conditional');
  assert.equal(historical.results[0].value.imageX,37.5);
  assert.equal(historical.results[0].value.magnification,-0.5);

  // CLI preflight and run into a fresh test-artifacts directory
  mkdirSync('test-artifacts/llm-authoring',{recursive:true});
  const baseDir=mkdtempSync('test-artifacts/llm-authoring/axial-preservation-cli-');
  const outDir=join(baseDir,'run');
  try{
    const pre=JSON.parse(execFileSync(process.execPath,['scripts/preflight-problem.mjs','examples/lens-train-axial-preservation.json'],{encoding:'utf8'}));
    assert.equal(pre.results[0].status,'conditional');
    assert.equal(Object.hasOwn(pre.results[0],'nativeImageDetected'),true);
    assert.equal(pre.results[0].nativeImageDetected,false);
    assert.equal(pre.results[0].value.preservesAxialImagePosition,true);
    assert.equal(pre.results[0].value.transverseMagnification,-1);
    const cliSummary=JSON.parse(execFileSync(process.execPath,['scripts/run-problem.mjs','examples/lens-train-axial-preservation.json','--out',outDir],{encoding:'utf8'}));
    assert.equal(cliSummary.status,'all-requested-quantities-available');
    assert.equal(cliSummary.native.status,'not-run');
    const cliReport=JSON.parse(readFileSync(cliSummary.report,'utf8'));
    assert.equal(cliReport.results[0].status,'conditional');
    assert.equal(Object.hasOwn(cliReport.results[0],'nativeImageDetected'),true);
    assert.equal(cliReport.results[0].nativeImageDetected,false);
    assert.equal(cliReport.results[0].value.preservesAxialImagePosition,true);
    assert.equal(cliReport.portable.status,'not-created');
    assert.equal(cliReport.dispatch.nativeCalls,0);
  }finally{
    rmSync(baseDir,{recursive:true,force:true});
  }
});
