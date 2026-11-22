import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {analyzeConjugateReconstruction,conjugateReconstructionCapabilities,CONJUGATE_RECONSTRUCTION_FACTS,CONJUGATE_RECONSTRUCTION_QUERY} from '../src/thin-lens-conjugate-reconstruction.js';
import {calculateLensTrain} from '../src/lens-train-matrix.js';
import {measureNativeSingleRay} from './helpers/measure-native-single-ray.mjs';

const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example=()=>readJson('../examples/thin-lens-conjugate-reconstruction.json');
const run=problem=>planProblem(problem).results[0];

function makeProblem(object,image,lengthUnit='mm',extra={}){
  return {
    format:'opticsim-problem-v1',
    physical:{
      format:CONJUGATE_RECONSTRUCTION_FACTS,
      model:'coaxial-ideal-thin-lens-real-object-inverse',
      signConvention:'x-increasing',
      lengthUnit,
      object,
      image
    },
    requests:[{id:'lens',kind:'thin-lens-conjugate-reconstruction'}],
    ...extra
  };
}

function traceThroughReconstructedLens(objectMm,lensX,focalLength,targetY,detectorX,aperture=60){
  const source={type:'SingleRay',brightness:0.04,p1:{x:objectMm.x,y:-objectMm.y},p2:{x:lensX,y:-targetY}};
  const lens={type:'IdealLens',p1:{x:lensX,y:-aperture/2},p2:{x:lensX,y:aperture/2},focalLength};
  const detector={type:'Detector',p1:{x:detectorX,y:-aperture/2},p2:{x:detectorX,y:aperture/2}};
  const record=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
    lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,lens,detector]});
  assert.deepEqual(record.events.map(e=>e.objectIndex),[1,2]);
  assert.ok(record.events.every(e=>e.before.x>0&&e.after.x>0));
  return record.events.at(-1);
}

test('Problem 18 representative inverted real-image example reconstructs converging lens across units',()=>{
  const r0=run(example());
  assert.equal(r0.status,'conditional');
  assert.equal(r0.nativeObservation,false);
  assert.equal(Object.hasOwn(r0,'nativeImageDetected'),true);
  assert.equal(r0.nativeImageDetected,false);
  assert.equal(r0.value.lensType,'converging');
  assert.equal(r0.value.lensX,0);
  assert.equal(r0.value.focalLength,2);
  assert.equal(r0.value.frontFocusX,-2);
  assert.equal(r0.value.rearFocusX,2);
  assert.equal(r0.value.objectDistance,-3);
  assert.equal(r0.value.imageDistance,6);
  assert.equal(r0.value.magnification,-2);
  assert.equal(r0.value.imageKind,'real');
  assert.equal(r0.value.imageOrientation,'inverted');
  assert.deepEqual(r0.value.rayConstruction,{
    opticalCentre:{x:0,y:0},
    parallelRayLensHit:{x:0,y:1},
    rearFocalPoint:{x:2,y:0}
  });

  for(const [unit,scale] of [['mm',10],['cm',1],['m',0.01],['scale-unit',1]]){
    const res=run(makeProblem({x:-3*scale,y:1*scale},{x:6*scale,y:-2*scale},unit));
    assert.equal(res.status,'conditional',unit);
    assert.equal(res.value.lensType,'converging',unit);
    assert.ok(Math.abs(res.value.focalLength-2*scale)<1e-12*scale,unit+' f');
    assert.ok(Math.abs(res.value.lensX)<1e-12*scale,unit+' lensX');
  }
});

test('all three admissible single-thin-lens regimes round-trip with calculateLensTrain and pinned native PhyDemo',()=>{
  const regimes=[
    {
      name:'converging-real-inverted',
      object:{x:-30,y:2},image:{x:60,y:-4},
      expected:{lensType:'converging',lensX:0,f:20,u:-30,v:60,m:-2,kind:'real',orient:'inverted'}
    },
    {
      name:'converging-real-inverted-below-axis',
      object:{x:-40,y:-3},image:{x:40,y:3},
      expected:{lensType:'converging',lensX:0,f:20,u:-40,v:40,m:-1,kind:'real',orient:'inverted'}
    },
    {
      name:'converging-virtual-magnified-upright',
      object:{x:-10,y:2},image:{x:-20,y:4},
      expected:{lensType:'converging',lensX:0,f:20,u:-10,v:-20,m:2,kind:'virtual',orient:'upright'}
    },
    {
      name:'diverging-virtual-diminished-upright',
      object:{x:-20,y:2},image:{x:-10,y:1},
      expected:{lensType:'diverging',lensX:0,f:-20,u:-20,v:-10,m:0.5,kind:'virtual',orient:'upright'}
    },
    {
      name:'diverging-virtual-diminished-below-axis',
      object:{x:-60,y:-4},image:{x:-20,y:-1},
      expected:{lensType:'diverging',lensX:-20/3,f:-160/9,u:-160/3,v:-40/3,m:0.25,kind:'virtual',orient:'upright'}
    }
  ];

  for(const tc of regimes){
    const res=run(makeProblem(tc.object,tc.image,'mm'));
    assert.equal(res.status,'conditional',tc.name);
    const v=res.value;
    assert.equal(v.lensType,tc.expected.lensType,tc.name);
    assert.ok(Math.abs(v.lensX-tc.expected.lensX)<1e-11,tc.name+' lensX');
    assert.ok(Math.abs(v.focalLength-tc.expected.f)<1e-11,tc.name+' f');
    assert.ok(Math.abs(v.objectDistance-tc.expected.u)<1e-11,tc.name+' u');
    assert.ok(Math.abs(v.imageDistance-tc.expected.v)<1e-11,tc.name+' v');
    assert.ok(Math.abs(v.magnification-tc.expected.m)<1e-12,tc.name+' m');
    assert.equal(v.imageKind,tc.expected.kind,tc.name);
    assert.equal(v.imageOrientation,tc.expected.orient,tc.name);

    // Analytical round-trip through calculateLensTrain
    const pred=calculateLensTrain(tc.object.x,[{x:v.lensX,focalLength:v.focalLength}],tc.object.y).prediction;
    assert.ok(Math.abs(pred.x-tc.image.x)<1e-10,tc.name+' forward x');
    assert.ok(Math.abs(pred.y-tc.image.y)<1e-10,tc.name+' forward y');

    // Independent pinned native PhyDemo IdealLens + SingleRay + Detector round-trip
    const detectorX=v.lensX+25;
    const hitCentre=traceThroughReconstructedLens(tc.object,v.lensX,v.focalLength,0,detectorX);
    const hitParallel=traceThroughReconstructedLens(tc.object,v.lensX,v.focalLength,tc.object.y,detectorX);
    const mC=hitCentre.before.y/hitCentre.before.x;
    const mP=hitParallel.before.y/hitParallel.before.x;
    assert.ok(Math.abs(mC-mP)>1e-4,tc.name+' distinct outgoing slopes');
    const delta=(hitParallel.y-hitCentre.y)/(mC-mP);
    const nativeImgX=hitCentre.x+delta;
    const nativeImgY=hitCentre.y+mC*delta;
    assert.ok(Math.abs(nativeImgX-tc.image.x)<1e-6,tc.name+' native image x');
    assert.ok(Math.abs(nativeImgY-tc.image.y)<1e-6,tc.name+' native image y');
    // Parallel ray outgoing line crosses optical axis y=0 at exact rearFocusX
    const nativeRearFocusX=hitParallel.x-hitParallel.y/mP;
    assert.ok(Math.abs(nativeRearFocusX-v.rearFocusX)<1e-6,tc.name+' native rearFocusX');
  }
});

test('axial translation shifts lens and focal coordinates identically while preserving focal length and distances',()=>{
  const shift=125;
  const rBase=run(makeProblem({x:-30,y:2},{x:60,y:-4},'mm')).value;
  const rShifted=run(makeProblem({x:-30+shift,y:2},{x:60+shift,y:-4},'mm')).value;
  assert.equal(rShifted.lensX,rBase.lensX+shift);
  assert.equal(rShifted.frontFocusX,rBase.frontFocusX+shift);
  assert.equal(rShifted.rearFocusX,rBase.rearFocusX+shift);
  assert.equal(rShifted.focalLength,rBase.focalLength);
  assert.equal(rShifted.objectDistance,rBase.objectDistance);
  assert.equal(rShifted.imageDistance,rBase.imageDistance);
  assert.equal(rShifted.magnification,rBase.magnification);
});

test('inadmissible virtual-object and degenerate conjugate pairs return explicit unavailable reasonCodes',()=>{
  // Virtual-object regimes in +x propagation (u >= 0):
  // 1. Inverted (m < 0) with image upstream of object (xI < xO)
  const invLeft=run(makeProblem({x:30,y:2},{x:-60,y:-4},'mm'));
  assert.equal(invLeft.status,'unavailable');
  assert.equal(invLeft.reasonCode,'VIRTUAL_OBJECT_REQUIRED');
  assert.equal(invLeft.value,null);

  // 2. Upright magnified (m > 1) with image downstream of object (xI > xO)
  const magRight=run(makeProblem({x:10,y:2},{x:20,y:4},'mm'));
  assert.equal(magRight.status,'unavailable');
  assert.equal(magRight.reasonCode,'VIRTUAL_OBJECT_REQUIRED');

  // 3. Upright diminished (0 < m < 1) with image upstream of object (xI < xO)
  const dimLeft=run(makeProblem({x:20,y:2},{x:10,y:1},'mm'));
  assert.equal(dimLeft.status,'unavailable');
  assert.equal(dimLeft.reasonCode,'VIRTUAL_OBJECT_REQUIRED');

  // Degenerate geometries:
  const samePt=run(makeProblem({x:10,y:2},{x:10,y:2},'mm'));
  assert.equal(samePt.status,'unavailable');
  assert.equal(samePt.reasonCode,'COINCIDENT_OBJECT_AND_IMAGE');

  const parallelAxis=run(makeProblem({x:-10,y:2},{x:20,y:2},'mm'));
  assert.equal(parallelAxis.status,'unavailable');
  assert.equal(parallelAxis.reasonCode,'NO_FINITE_LENS_SOLUTION');

  const samePlane=run(makeProblem({x:10,y:2},{x:10,y:-4},'mm'));
  assert.equal(samePlane.status,'unavailable');
  assert.equal(samePlane.reasonCode,'COINCIDENT_AXIAL_PLANES');
});

test('numerical indeterminacy boundaries withhold brittle reconstructions',()=>{
  const eps=2**-35;
  // 1. Near unit upright magnification (yI nearly equals yO)
  const nearUnit=run(makeProblem({x:-10,y:2},{x:20,y:2+eps},'mm'));
  assert.equal(nearUnit.status,'numerically-indeterminate');
  assert.equal(nearUnit.reasonCode,'NEAR_UNIT_UPRIGHT_MAGNIFICATION');

  // 2. Near-coincident axial planes (xI nearly equals xO)
  const nearAxial=run(makeProblem({x:50,y:2},{x:50+eps,y:-2},'mm'));
  assert.equal(nearAxial.status,'numerically-indeterminate');
  assert.equal(nearAxial.reasonCode,'NEAR_COINCIDENT_AXIAL_PLANES');

  // 2b. Equal heights with nearly coincident axial planes
  const nearSamePt=run(makeProblem({x:50,y:2},{x:50+eps,y:2},'mm'));
  assert.equal(nearSamePt.status,'numerically-indeterminate');
  assert.equal(nearSamePt.reasonCode,'NEAR_COINCIDENT_AXIAL_PLANES');

  // 3. Reconstructed lens plane closer than min separation to object plane
  const nearLensPlane=run(makeProblem({x:0,y:0.05},{x:0.02,y:-50},'mm'));
  assert.equal(nearLensPlane.status,'numerically-indeterminate');
  assert.equal(nearLensPlane.reasonCode,'NEAR_COINCIDENT_LENS_PLANE');

  // 4. Derived focal length exceeding 1e9 magnitude ceiling
  const hugeDerived=run(makeProblem({x:-10000,y:1000},{x:10000,y:999.999},'mm'));
  assert.equal(hugeDerived.status,'numerically-indeterminate');
  assert.equal(hugeDerived.reasonCode,'DERIVED_COORDINATE_OUT_OF_RANGE');
});

test('strict validation, on-axis rejection, verifyNative gate, CLI workflow, and contract preservation',()=>{
  const caps=problemWorkflowCapabilities();
  assert.deepEqual(caps.thinLensConjugateReconstruction.kinds,['thin-lens-conjugate-reconstruction']);
  assert.equal(caps.requestKinds['thin-lens-conjugate-reconstruction'].contract,CONJUGATE_RECONSTRUCTION_QUERY);
  assert.deepEqual(conjugateReconstructionCapabilities().lensTypes,['converging','diverging']);

  // Missing facts -> needs-information
  assert.equal(run({format:'opticsim-problem-v1',physical:null,requests:[{id:'r',kind:'thin-lens-conjugate-reconstruction'}]}).status,'needs-information');
  const missingImg=example();
  delete missingImg.physical.image;
  assert.equal(run(missingImg).status,'needs-information');

  // Unsupported scope / facts -> unavailable
  assert.equal(run(makeProblem({x:-30,y:0},{x:60,y:-4},'mm')).status,'unavailable');
  assert.equal(run(makeProblem({x:-30,y:2},{x:60,y:0},'mm')).status,'unavailable');
  assert.equal(run(makeProblem({x:-30,y:0.005},{x:60,y:-4},'mm')).status,'unavailable');
  const wrongSign=example();
  wrongSign.physical.signConvention='x-decreasing';
  assert.equal(run(wrongSign).status,'unavailable');
  const oldFacts=readJson('../examples/lens-train-facts.json');
  assert.equal(run({...oldFacts,requests:[{id:'r',kind:'thin-lens-conjugate-reconstruction'}]}).status,'unavailable');

  // Invalid inputs -> invalid-input
  const extraField=example();
  extraField.physical.focalLength=2;
  assert.equal(run(extraField).status,'invalid-input');
  assert.equal(run(makeProblem({x:'-30',y:2},{x:60,y:-4},'mm')).status,'invalid-input');
  assert.throws(()=>analyzeConjugateReconstruction(example().physical,{format:CONJUGATE_RECONSTRUCTION_QUERY,kind:'unknown'}),/Unknown/);

  // verifyNative: true never bypassed by analytical success
  const withVerify=planProblem({...example(),verifyNative:true});
  assert.equal(withVerify.results[0].status,'conditional');
  assert.equal(withVerify.native.required,true);
  assert.equal(withVerify.native.canRun,false);

  // CLI preflight and run into fresh test-artifacts directory
  mkdirSync('test-artifacts/llm-authoring',{recursive:true});
  const baseDir=mkdtempSync('test-artifacts/llm-authoring/conjugate-recon-cli-');
  const outDir=join(baseDir,'run');
  try{
    const pre=JSON.parse(execFileSync(process.execPath,['scripts/preflight-problem.mjs','examples/thin-lens-conjugate-reconstruction.json'],{encoding:'utf8'}));
    assert.equal(pre.results[0].status,'conditional');
    assert.equal(Object.hasOwn(pre.results[0],'nativeImageDetected'),true);
    assert.equal(pre.results[0].nativeImageDetected,false);
    assert.equal(pre.results[0].value.lensType,'converging');
    assert.equal(pre.results[0].value.focalLength,2);

    const cliSummary=JSON.parse(execFileSync(process.execPath,['scripts/run-problem.mjs','examples/thin-lens-conjugate-reconstruction.json','--out',outDir],{encoding:'utf8'}));
    assert.equal(cliSummary.status,'all-requested-quantities-available');
    assert.equal(cliSummary.native.status,'not-run');
    const cliReport=JSON.parse(readFileSync(cliSummary.report,'utf8'));
    assert.equal(cliReport.results[0].status,'conditional');
    assert.equal(Object.hasOwn(cliReport.results[0],'nativeImageDetected'),true);
    assert.equal(cliReport.results[0].nativeImageDetected,false);
    assert.equal(cliReport.results[0].value.lensType,'converging');
    assert.equal(cliReport.portable.status,'not-created');
    assert.equal(cliReport.dispatch.nativeCalls,0);
  }finally{
    rmSync(baseDir,{recursive:true,force:true});
  }
});
