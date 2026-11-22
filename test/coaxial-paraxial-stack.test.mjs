import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {analyzeCoaxialStack,coaxialStackCapabilities,COAXIAL_STACK_FACTS,COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {analyzeReturn,RETURN_FACTS,RETURN_QUERY} from '../src/refracting-mirror-return.js';
import {analyzeSurfaceFocus,SURFACE_FOCUS_FACTS,SURFACE_FOCUS_QUERY} from '../src/two-surface-focus.js';
import {measureNativeSingleRay} from './helpers/measure-native-single-ray.mjs';

const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example=()=>readJson('../examples/coaxial-paraxial-stack.json');

function makeProblem(elements,requests,{incidentIndex=1,lengthUnit='mm',object,verifyNative}={}){
  const physical={
    format:COAXIAL_STACK_FACTS,
    model:'coaxial-paraxial-optical-stack',
    signConvention:'x-increasing',
    lengthUnit,
    incidentIndex,
    elements,
    ...(object===undefined?{}:{object})
  };
  return {
    format:'opticsim-problem-v1',
    physical,
    requests:requests.map((kind,i)=>({id:'r'+i,kind})),
    ...(verifyNative===undefined?{}:{verifyNative})
  };
}

test('slab + thin-lens multi-query example agrees analytically and with pinned native PhyDemo Glass + IdealLens',()=>{
  const plan=planProblem(example());
  assert.equal(plan.results.length,3);
  for(const r of plan.results){
    assert.equal(r.status,'conditional',r.kind);
    assert.equal(r.nativeObservation,false,r.kind);
    assert.equal(Object.hasOwn(r,'nativeImageDetected'),true,r.kind);
    assert.equal(r.nativeImageDetected,false,r.kind);
  }
  const [conj,focus,transfer]=plan.results.map(r=>r.value);
  // Slab t=30, n=1.5 gives apparent shift 10 mm -> u_eff = 150 - 10 = 140 mm before L1(f=50) at x=80.
  assert.equal(conj.propagationMode,'transmission');
  assert.equal(conj.exitDirection,'+x');
  assert.equal(conj.imageKind,'finite-real');
  assert.ok(Math.abs(conj.imageDistance-700/9)<1e-12);
  assert.ok(Math.abs(conj.imageX-(80+700/9))<1e-12);
  assert.ok(Math.abs(conj.magnification-(-5/9))<1e-12);
  assert.ok(Math.abs(conj.imageY-(-10/9))<1e-12);
  assert.equal(conj.imageOrientation,'inverted');

  // Parallel beam unaffected by planar slab -> focuses at x=80+50=130 mm.
  assert.equal(focus.state,'real-focus');
  assert.equal(focus.backFocalDistance,50);
  assert.equal(focus.backFocusX,130);
  assert.equal(focus.effectiveFocalLength,50);
  assert.equal(transfer.isAfocal,false);
  assert.equal(transfer.selfConjugateObjects,null);

  // Independent pinned native PhyDemo control: Glass slab [0,30] (n=1.5) + IdealLens (x=80, f=50).
  const slab={type:'Glass',refIndex:1.5,notDone:false,partialReflect:false,path:[
    {x:0,y:-40,arc:false},{x:30,y:-40,arc:false},{x:30,y:40,arc:false},{x:0,y:40,arc:false}
  ]};
  const lens={type:'IdealLens',p1:{x:80,y:-40},p2:{x:80,y:40},focalLength:50};
  const detector={type:'Detector',p1:{x:120,y:-40},p2:{x:120,y:40}};
  const hits=[-0.004,0.004].map(slope=>{
    const source={type:'SingleRay',brightness:0.04,p1:{x:-70,y:-2},p2:{x:-60,y:-2-10*slope}};
    const rec=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
      lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,slab,lens,detector]});
    assert.deepEqual(rec.events.map(e=>e.objectIndex),[1,1,2,3]);
    return rec.events.at(-1);
  });
  const [hA,hB]=hits;
  const mA=hA.before.y/hA.before.x,mB=hB.before.y/hB.before.x;
  const delta=(hB.y-hA.y)/(mA-mB),imgX=hA.x+delta,imgY=hA.y+mA*delta;
  assert.ok(Math.abs(imgX-conj.imageX)<0.05,'native slab+lens imageX');
  assert.ok(Math.abs(imgY-conj.imageY)<0.002,'native slab+lens imageY');
});

test('cross-index planar interface + lens and pure planar interface verify reduced-slope refraction and apparent depth',()=>{
  // 1. Single planar interface n=1.5 -> n=1 at x=0: apparent depth d/1.5, m=1, angular scale 1.5, m_long = 1/1.5.
  const ifacePlan=planProblem(makeProblem(
    [{id:'W',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1}],
    ['coaxial-stack-conjugate','coaxial-stack-collimated-focus','coaxial-stack-transfer'],
    {incidentIndex:1.5,object:{x:-60,y:3}}
  ));
  const [iConj,iFocus,iTransfer]=ifacePlan.results.map(r=>r.value);
  assert.equal(iConj.imageKind,'finite-virtual');
  assert.equal(iConj.imageDistance,-40);
  assert.equal(iConj.imageX,-40);
  assert.equal(iConj.magnification,1);
  assert.equal(iConj.imageY,3);
  assert.equal(iFocus.state,'afocal');
  assert.equal(iFocus.beamHeightScale,1);
  assert.equal(iFocus.angularScale,1.5);
  assert.equal(iTransfer.isAfocal,true);
  assert.equal(iTransfer.transverseMagnification,1);
  assert.ok(Math.abs(iTransfer.longitudinalMagnification-2/3)<1e-15);
  assert.equal(iTransfer.constantAxialShift,false);

  // 2. Submerged object (n=1.5) at x=-60 -> planar surface at x=0 (to air n=1) -> lens f=50 at x=20.
  // Apparent object at x=-40 (60 mm before lens) -> 1/v = 1/50 - 1/60 = 1/300 -> v = 300, imageX = 320, m = -5.
  const subPlan=planProblem(makeProblem([
    {id:'W',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1},
    {id:'L',type:'thin-lens',x:20,focalLength:50}
  ],['coaxial-stack-conjugate'],{incidentIndex:1.5,object:{x:-60,y:0.5}}));
  const sub=subPlan.results[0].value;
  assert.equal(sub.imageKind,'finite-real');
  assert.equal(sub.imageDistance,300);
  assert.equal(sub.imageX,320);
  assert.equal(sub.magnification,-5);
  assert.equal(sub.imageY,-2.5);

  // Independent pinned native PhyDemo control: source inside Glass block [-120,0] (n=1.5) + IdealLens (x=20, f=50).
  const tank={type:'Glass',refIndex:1.5,notDone:false,partialReflect:false,path:[
    {x:-120,y:-40,arc:false},{x:0,y:-40,arc:false},{x:0,y:40,arc:false},{x:-120,y:40,arc:false}
  ]};
  const lens={type:'IdealLens',p1:{x:20,y:-40},p2:{x:20,y:40},focalLength:50};
  const detector={type:'Detector',p1:{x:100,y:-40},p2:{x:100,y:40}};
  const hits=[-0.002,0.002].map(slope=>{
    const source={type:'SingleRay',brightness:0.04,p1:{x:-60,y:-0.5},p2:{x:-50,y:-0.5-10*slope}};
    const rec=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
      lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,tank,lens,detector]});
    assert.deepEqual(rec.events.map(e=>e.objectIndex),[1,2,3]);
    return rec.events.at(-1);
  });
  const [hA,hB]=hits;
  const mA=hA.before.y/hA.before.x,mB=hB.before.y/hB.before.x;
  const delta=(hB.y-hA.y)/(mA-mB),imgX=hA.x+delta,imgY=hA.y+mA*delta;
  assert.ok(Math.abs(imgX-320)<0.1,'native submerged+lens imageX');
  assert.ok(Math.abs(imgY-(-2.5))<0.005,'native submerged+lens imageY');
});

test('return stacks unify lens+mirror, co-located silvered lenses, water-filled mirror, and native PhyDemo controls',()=>{
  // 1. PR #238 lens + concave mirror parallel return at d = f and d = f + R
  for(const [d,expectedScale,expectedSelf] of [[100,-1,[]],[200,1,[{objectDistanceFromEntrance:200,objectX:-200,magnification:1}]]]){
    const p=planProblem(makeProblem([
      {id:'L',type:'thin-lens',x:0,focalLength:100},
      {id:'M',type:'terminal-mirror',x:d,signedRadius:-100}
    ],['coaxial-stack-collimated-focus','coaxial-stack-transfer']));
    const [focus,tr]=p.results.map(r=>r.value);
    assert.equal(focus.propagationMode,'return');
    assert.equal(focus.exitDirection,'-x');
    assert.equal(focus.state,'afocal');
    assert.equal(focus.beamHeightScale,expectedScale);
    assert.equal(tr.isAfocal,true);
    assert.equal(tr.transverseMagnification,expectedScale);
    assert.equal(tr.longitudinalMagnification,-1);
    assert.equal(tr.constantAxialShift,false);
    assert.deepEqual(tr.selfConjugateObjects,expectedSelf);
  }

  // Native PhyDemo control for lens(x=0,f=100) + plane mirror(x=150) return conjugate!
  // Object at x=-150 (u=150 before L -> real image at x=300, 150 behind mirror -> reflected virtual obj at x=0 -> L makes v=0, imageX=0!).
  // Wait: pick object at x=-200: L(f=100) images at x=200 (50 behind mirror at x=150) -> mirror reflects to x=100 (100 right of L) -> return through L emerges collimated (at-infinity)!
  const infReturn=planProblem(makeProblem([
    {id:'L',type:'thin-lens',x:0,focalLength:100},
    {id:'M',type:'terminal-mirror',x:150,signedRadius:'infinity'}
  ],['coaxial-stack-conjugate','coaxial-stack-collimated-focus','coaxial-stack-transfer'],{object:{x:-200,y:1}}));
  assert.equal(infReturn.results[0].value.imageKind,'at-infinity');
  assert.equal(infReturn.results[0].value.imageY,null);
  // Check finite return conjugate for object at x=-300:
  // L(f=100) -> inverted image on mirror (x=150, m1=-0.5) -> returns through L -> upright image at x=-300 (m2=-2, m=+1).
  const selfRet=planProblem(makeProblem([
    {id:'L',type:'thin-lens',x:0,focalLength:100},
    {id:'M',type:'terminal-mirror',x:150,signedRadius:'infinity'}
  ],['coaxial-stack-conjugate','coaxial-stack-transfer'],{object:{x:-300,y:1}}));
  assert.equal(selfRet.results[0].value.imageKind,'finite-real');
  assert.equal(selfRet.results[0].value.imageX,-300);
  assert.equal(selfRet.results[0].value.magnification,1);
  assert.equal(selfRet.results[0].value.imageY,1);
  // Both self-conjugate roots: x=-100 (at front focus, m=-1) and x=-300 (images onto mirror, m=+1).
  assert.deepEqual(selfRet.results[1].value.selfConjugateObjects,[
    {objectDistanceFromEntrance:100,objectX:-100,magnification:-1},
    {objectDistanceFromEntrance:300,objectX:-300,magnification:1}
  ]);

  // Independent pinned native PhyDemo control for L(x=0,f=100) + plane Mirror(x=150) return from (-300, 1):
  const lens={type:'IdealLens',p1:{x:0,y:-40},p2:{x:0,y:40},focalLength:100};
  const mirror={type:'Mirror',p1:{x:150,y:-40},p2:{x:150,y:40}};
  const detector={type:'Detector',p1:{x:-200,y:-40},p2:{x:-200,y:40}};
  const retHits=[-0.002,0.002].map(slope=>{
    const source={type:'SingleRay',brightness:0.04,p1:{x:-300,y:-1},p2:{x:-290,y:-1-10*slope}};
    const rec=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:400,y:350},scale:1,
      lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:8,objs:[source,lens,mirror,detector]});
    // Events: detector(outbound=3), lens(1), mirror(2), lens(1), detector(return=3)
    assert.deepEqual(rec.events.map(e=>e.objectIndex),[3,1,2,1,3]);
    const last=rec.events.at(-1);
    assert.ok(last.before.x<0,'returning ray travels in -x');
    return last;
  });
  const [rA,rB]=retHits;
  const rmA=rA.before.y/rA.before.x,rmB=rB.before.y/rB.before.x;
  const rDelta=(rB.y-rA.y)/(rmA-rmB),rImgX=rA.x+rDelta,rImgY=rA.y+rmA*rDelta;
  assert.ok(Math.abs(rImgX-(-300))<1e-6,'native return self-conjugate x=-300');
  assert.ok(Math.abs(rImgY-1)<1e-6,'native return self-conjugate y=+1');

  // 2. Co-located silvered equiconvex thin lens (Problem 6: R=250, n=1.5) matches analyzeReturn identically
  const silvered=planProblem(makeProblem([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:250,downstreamIndex:1.5},
    {id:'M',type:'terminal-mirror',x:0,signedRadius:-250}
  ],['coaxial-stack-collimated-focus','coaxial-stack-transfer']));
  const refFocus=analyzeReturn({format:RETURN_FACTS,model:'coaxial-paraxial-refraction-reflection-return',lengthUnit:'mm',
    exteriorIndex:1,interiorIndex:1.5,geometry:{kind:'signed-poles',frontSignedRadius:250,mirrorSignedRadius:-250,poleSeparation:0}},
    {format:RETURN_QUERY,kind:'refracting-mirror-return-focus'});
  const refSelf=analyzeReturn({format:RETURN_FACTS,model:'coaxial-paraxial-refraction-reflection-return',lengthUnit:'mm',
    exteriorIndex:1,interiorIndex:1.5,geometry:{kind:'signed-poles',frontSignedRadius:250,mirrorSignedRadius:-250,poleSeparation:0}},
    {format:RETURN_QUERY,kind:'refracting-mirror-self-conjugate'});
  assert.equal(silvered.results[0].value.effectiveFocalLength,refFocus.value.effectiveFocalLength);
  assert.equal(silvered.results[0].value.backFocalDistance,refFocus.value.signedFrontFocusDistance);
  assert.deepEqual(silvered.results[1].value.selfConjugateObjects.map(x=>x.objectDistanceFromEntrance),refSelf.value.objectDistances);

  // 3. Water-filled concave mirror (Problem 10: R=-200, n=1.5 -> f_eq = R/(2n) = 200/3)
  const waterMirror=planProblem(makeProblem([
    {id:'surf',type:'refracting-surface',x:0,signedRadius:'infinity',downstreamIndex:1.5},
    {id:'M',type:'terminal-mirror',x:0,signedRadius:-200}
  ],['coaxial-stack-collimated-focus','coaxial-stack-transfer']));
  assert.ok(Math.abs(waterMirror.results[0].value.effectiveFocalLength-200/3)<1e-12);
  assert.ok(Math.abs(waterMirror.results[1].value.selfConjugateObjects[0].objectDistanceFromEntrance-400/3)<1e-12);
});

test('thick curved lens, contact lenses, 3-lens relay, and collimated trains match independent contracts',()=>{
  // 1. Thick curved lens (two spherical refracting surfaces) matches analyzeSurfaceFocus identically
  const thick=planProblem(makeProblem([
    {id:'F1',type:'refracting-surface',x:0,signedRadius:100,downstreamIndex:1.5},
    {id:'F2',type:'refracting-surface',x:20,signedRadius:-100,downstreamIndex:1}
  ],['coaxial-stack-collimated-focus']));
  const refThick=analyzeSurfaceFocus({
    format:SURFACE_FOCUS_FACTS,incidence:'collimated-positive-x',
    geometry:{kind:'two-coaxial-spherical-surfaces',lengthUnit:'mm',entranceIndex:1,coreIndex:1.5,exitIndex:1,
      front:{id:'F1',signedRadius:100},rear:{id:'F2',signedRadius:-100},axialThickness:20}
  },{format:SURFACE_FOCUS_QUERY,kind:'two-surface-back-focus'});
  assert.ok(Math.abs(thick.results[0].value.backFocalDistance-refThick.value.signedBackFocalDistance)<1e-12);

  // 2. Co-located contact thin lenses (Problem 7: f1=5 cm, f2=-10 cm -> f_eq=10 cm)
  const contact=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:5},
    {id:'L2',type:'thin-lens',x:0,focalLength:-10}
  ],['coaxial-stack-collimated-focus'],{lengthUnit:'cm'}));
  assert.equal(contact.results[0].value.effectiveFocalLength,10);
  assert.equal(contact.results[0].value.backFocalDistance,10);

  // 3. PR #239 / #241 3-lens relay (4a, a, 4a -> preservesAxialImagePosition=true; 4a, 2a, 4a -> axialShift=8)
  const relayPres=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:4},
    {id:'L2',type:'thin-lens',x:4,focalLength:1},
    {id:'L3',type:'thin-lens',x:8,focalLength:4}
  ],['coaxial-stack-transfer'],{lengthUnit:'scale-unit'})).results[0].value;
  assert.equal(relayPres.preservesAxialImagePosition,true);
  assert.equal(relayPres.axialShift,0);
  assert.equal(relayPres.transverseMagnification,-1);

  const relayShift=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:4},
    {id:'L2',type:'thin-lens',x:4,focalLength:2},
    {id:'L3',type:'thin-lens',x:8,focalLength:4}
  ],['coaxial-stack-transfer'],{lengthUnit:'scale-unit'})).results[0].value;
  assert.equal(relayShift.preservesAxialImagePosition,false);
  assert.equal(relayShift.constantAxialShift,true);
  assert.equal(relayShift.axialShift,8);
});

test('numerical indeterminacy guards catch cancellation across conjugate, focus, transfer, and return modes',()=>{
  const eps=2**-30;
  // 1. Near focal singularity in conjugate
  const nearInf=planProblem(makeProblem([{id:'L1',type:'thin-lens',x:0,focalLength:100}],['coaxial-stack-conjugate'],
    {object:{x:-100-eps}})).results[0];
  assert.equal(nearInf.status,'numerically-indeterminate');
  assert.equal(nearInf.reasonCode,'NEAR_FOCAL_SINGULARITY');

  // 2. Near image at exit plane (2 lenses: image of object near L2)
  // L1(x=0,f=50) images object at x=-100 to x=+100; place L2 at x=100+eps.
  const nearExit=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:50},
    {id:'L2',type:'thin-lens',x:100+eps,focalLength:80}
  ],['coaxial-stack-conjugate'],{object:{x:-100}})).results[0];
  assert.equal(nearExit.status,'numerically-indeterminate');
  assert.equal(nearExit.reasonCode,'NEAR_IMAGE_AT_EXIT_PLANE');

  // 3. Near afocal boundary (collimated & transfer)
  const nearAfocal=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:100},
    {id:'L2',type:'thin-lens',x:200+1e-10,focalLength:100}
  ],['coaxial-stack-collimated-focus','coaxial-stack-transfer']));
  assert.equal(nearAfocal.results[0].reasonCode,'NEAR_AFOCAL_BOUNDARY');
  assert.equal(nearAfocal.results[1].reasonCode,'NEAR_AFOCAL_BOUNDARY');

  // 4. Near focus at exit plane (collimated)
  const nearAtExit=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:80},
    {id:'L2',type:'thin-lens',x:80+eps,focalLength:50}
  ],['coaxial-stack-collimated-focus'])).results[0];
  assert.equal(nearAtExit.status,'numerically-indeterminate');
  assert.equal(nearAtExit.reasonCode,'NEAR_FOCUS_AT_EXIT_PLANE');

  // 5. Astra exact-dyadic 4-lens cancellation-heavy axial shift regression (expanded L + n_out*sa*sb bound)
  const g=1/512,f=g*(1+2**-10),u=f+g,t=2*g*(f+g)/(f-g)+1000;
  const heavyShift=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:f},
    {id:'L2',type:'thin-lens',x:u,focalLength:g},
    {id:'L3',type:'thin-lens',x:u+t,focalLength:g},
    {id:'L4',type:'thin-lens',x:2*u+t,focalLength:f}
  ],['coaxial-stack-transfer'],{lengthUnit:'scale-unit'})).results[0];
  assert.equal(heavyShift.status,'numerically-indeterminate');
  assert.equal(heavyShift.reasonCode,'NEAR_ZERO_AXIAL_SHIFT');

  // 6. Near self-conjugate at entrance plane for return stack (lens f=100 + concave mirror R=-100 at d=100+eps -> B near 0)
  const nearSelf=planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:100},
    {id:'M1',type:'terminal-mirror',x:100,signedRadius:-100-eps}
  ],['coaxial-stack-transfer'])).results[0];
  assert.equal(nearSelf.status,'numerically-indeterminate');
  assert.equal(nearSelf.reasonCode,'NEAR_SELF_CONJUGATE_AT_ENTRANCE_PLANE');

  // 7. Near-matched indices across a curved refracting surface ((n2-n1)/R bounded by (n2+n1)/|R|)
  const nearMatched=planProblem(makeProblem([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:100,downstreamIndex:1.5+2**-40}
  ],['coaxial-stack-collimated-focus','coaxial-stack-transfer'],{incidentIndex:1.5}));
  assert.equal(nearMatched.results[0].status,'numerically-indeterminate');
  assert.equal(nearMatched.results[0].reasonCode,'NEAR_AFOCAL_BOUNDARY');
  assert.equal(nearMatched.results[1].reasonCode,'NEAR_AFOCAL_BOUNDARY');
  // Exact matched indices across a curved surface cleanly classify as afocal (C = 0 exact)
  const exactMatched=planProblem(makeProblem([
    {id:'S1',type:'refracting-surface',x:0,signedRadius:100,downstreamIndex:1.5}
  ],['coaxial-stack-collimated-focus'],{incidentIndex:1.5})).results[0];
  assert.equal(exactMatched.status,'conditional');
  assert.equal(exactMatched.value.state,'afocal');
});

test('strict validation, element ordering, verifyNative gate, CLI workflow, and contract preservation',()=>{
  const caps=problemWorkflowCapabilities();
  assert.deepEqual(caps.coaxialParaxialStack.kinds,['coaxial-stack-conjugate','coaxial-stack-collimated-focus','coaxial-stack-transfer']);
  assert.equal(caps.requestKinds['coaxial-stack-conjugate'].contract,COAXIAL_STACK_QUERY);
  assert.deepEqual(coaxialStackCapabilities().lengthUnits,['mm','cm','m','scale-unit']);

  // Missing object for conjugate -> needs-information, while focus/transfer still work without object!
  const noObj=planProblem(makeProblem([{id:'L1',type:'thin-lens',x:0,focalLength:50}],
    ['coaxial-stack-conjugate','coaxial-stack-collimated-focus','coaxial-stack-transfer']));
  assert.equal(noObj.results[0].status,'needs-information');
  assert.equal(noObj.results[1].status,'conditional');
  assert.equal(noObj.results[2].status,'conditional');

  // Out-of-order elements, terminal-mirror not last, tiny gap, >8 elements, bad index -> unavailable
  assert.equal(planProblem(makeProblem([
    {id:'L2',type:'thin-lens',x:50,focalLength:50},
    {id:'L1',type:'thin-lens',x:10,focalLength:50}
  ],['coaxial-stack-transfer'])).results[0].status,'unavailable');
  assert.equal(planProblem(makeProblem([
    {id:'M1',type:'terminal-mirror',x:0,signedRadius:'infinity'},
    {id:'L1',type:'thin-lens',x:50,focalLength:50}
  ],['coaxial-stack-transfer'])).results[0].status,'unavailable');
  assert.equal(planProblem(makeProblem([
    {id:'L1',type:'thin-lens',x:0,focalLength:50},
    {id:'L2',type:'thin-lens',x:0.005,focalLength:50}
  ],['coaxial-stack-transfer'])).results[0].status,'unavailable');
  assert.equal(planProblem(makeProblem(
    Array.from({length:9},(_,i)=>({id:'L'+i,type:'thin-lens',x:i*10,focalLength:50})),
    ['coaxial-stack-transfer']
  )).results[0].status,'unavailable');
  assert.equal(planProblem(makeProblem([{id:'L1',type:'thin-lens',x:0,focalLength:50}],['coaxial-stack-transfer'],{incidentIndex:0.5})).results[0].status,'unavailable');

  // Malformed optional object is rejected even when only focus is requested
  assert.equal(planProblem(makeProblem([{id:'L1',type:'thin-lens',x:0,focalLength:50}],['coaxial-stack-collimated-focus'],{object:{x:'bad'}})).results[0].status,'invalid-input');
  assert.throws(()=>analyzeCoaxialStack(example().physical,{format:COAXIAL_STACK_QUERY,kind:'unknown'}),/Unknown/);

  // verifyNative: true never bypassed
  const withVerify=planProblem({...example(),verifyNative:true});
  assert.equal(withVerify.native.required,true);
  assert.equal(withVerify.native.canRun,false);

  // CLI preflight and run
  mkdirSync('test-artifacts/llm-authoring',{recursive:true});
  const baseDir=mkdtempSync('test-artifacts/llm-authoring/coaxial-stack-cli-');
  const outDir=join(baseDir,'run');
  try{
    const pre=JSON.parse(execFileSync(process.execPath,['scripts/preflight-problem.mjs','examples/coaxial-paraxial-stack.json'],{encoding:'utf8'}));
    assert.equal(pre.results.length,3);
    for(const r of pre.results){
      assert.equal(r.status,'conditional');
      assert.equal(Object.hasOwn(r,'nativeImageDetected'),true);
      assert.equal(r.nativeImageDetected,false);
    }
    const cliSummary=JSON.parse(execFileSync(process.execPath,['scripts/run-problem.mjs','examples/coaxial-paraxial-stack.json','--out',outDir],{encoding:'utf8'}));
    assert.equal(cliSummary.status,'all-requested-quantities-available');
    assert.equal(cliSummary.native.status,'not-run');
    const cliReport=JSON.parse(readFileSync(cliSummary.report,'utf8'));
    assert.equal(cliReport.portable.status,'not-created');
    assert.equal(cliReport.dispatch.nativeCalls,0);
    for(const r of cliReport.results){
      assert.equal(Object.hasOwn(r,'nativeImageDetected'),true);
      assert.equal(r.nativeImageDetected,false);
    }
  }finally{
    rmSync(baseDir,{recursive:true,force:true});
  }
});
