// Frozen protocol is committed separately BEFORE implementation. Research only.
// Pinned native GrinGlass owns all ray propagation and boundary/refraction.
// This file does not add a public component, parser, scene schema or solver.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const baseScene=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const plan=JSON.parse(readFileSync(new URL('../evaluation/jee-grin-numerical-qualification-v2/protocol.json',import.meta.url),'utf8'));
const NATIVE_LATEX='\\sqrt{1.5-y}'; // JS value is one literal LaTeX backslash, fixed/trusted.
const LIMIT_CALLBACKS=2048;
const ALLOWED=['format','lengthUnit','indexFamily','squaredIndexAtOrigin',
 'scaleLengthMm','outsideIndex','sourceXLocalMm','sourceYLocalMm','stepSizeMm',
 'translateXmm','translateYmm','sourceAngleDeg'];
const template=()=>({
 format:'opticsim-grin-research-admission-v2',
 lengthUnit:'mm',
 indexFamily:'fixed-sqrt-affine-y',
 squaredIndexAtOrigin:1.5,
 scaleLengthMm:1,
 outsideIndex:1,
 sourceXLocalMm:.1,
 sourceYLocalMm:0,
 stepSizeMm:.01,
 translateXmm:0,
 translateYmm:0,
 sourceAngleDeg:0
});
function validateResearchFacts(q) {
 if(!q||typeof q!=='object'||Array.isArray(q))throw Error('Research facts must be a record');
 const missing=ALLOWED.filter(k=>!Object.hasOwn(q,k));
 const extras=Object.keys(q).filter(k=>!ALLOWED.includes(k));
 if(missing.length||extras.length)throw Error('Missing or unsupported research fields: '+[...missing,...extras].join(','));
 if(q.format!=='opticsim-grin-research-admission-v2'||q.lengthUnit!=='mm'||
    q.indexFamily!=='fixed-sqrt-affine-y')throw Error('Unsupported scope, unit or fixed formula');
 const nums=ALLOWED.filter(k=>!['format','lengthUnit','indexFamily'].includes(k));
 if(nums.some(k=>typeof q[k]!=='number'||!Number.isFinite(q[k])))
  throw Error('All numeric facts must be explicit finite JSON numbers');
 if(q.squaredIndexAtOrigin!==1.5||q.scaleLengthMm!==1||q.outsideIndex!==1)
  throw Error('Only the explicitly frozen physically bounded field and background are admitted');
 const squaredMin=q.squaredIndexAtOrigin-.4/q.scaleLengthMm;
 const squaredMax=q.squaredIndexAtOrigin+.9/q.scaleLengthMm;
 if(squaredMin<1||squaredMax>16||!(squaredMax>=squaredMin))
  throw Error('Entire dielectric must maintain finite physical index n>=1 and n<=4');
 if(q.stepSizeMm<.0025||q.stepSizeMm>.04)
  throw Error('Unsupported native integration step size');
 if(q.sourceXLocalMm<.05||q.sourceXLocalMm>.95||
    q.sourceYLocalMm<-.75||q.sourceYLocalMm>.25)
  throw Error('The initial ray must clear the rectangle boundary by at least 0.05 mm');
 if(q.sourceAngleDeg!==0)throw Error('Near-grazing, tilted or boundary-launched GRIN illumination is NOT admitted');
 if(Math.abs(q.translateXmm)>500||Math.abs(q.translateYmm)>500)
  throw Error('Large-world-coordinate numerical reliability not publicly certified');
 const allX=[q.translateXmm,q.translateXmm+1.2],allY=[q.translateYmm-1,q.translateYmm+1];
 if([...allX,...allY].some(x=>Math.abs(x)>9999))throw Error('Out-of-world input');
 return Object.freeze({squaredMin,squaredMax,minIndex:Math.sqrt(squaredMin),maxIndex:Math.sqrt(squaredMax)});
}
function observedNative({stepSize=.01,dx=0,dy=0,sourceX=.1,rawResearch=false}={}){
 const spec={...template(),stepSizeMm:stepSize,translateXmm:dx,translateYmm:dy,sourceXLocalMm:sourceX};
 if(!rawResearch)validateResearchFacts(spec);
 const compiled=core.compile(baseScene);
 assert.equal(compiled.native.objs[0].type,'SingleRay');
 assert.equal(compiled.native.objs[2].type,'Detector');
 const source=structuredClone(compiled.native.objs[0]);
 source.p1={x:dx+sourceX,y:dy};
 source.p2={x:dx+sourceX+20,y:dy};
 const glass={
  type:'GrinGlass',
  path:[
   {x:dx,y:dy-.9},{x:dx+1,y:dy-.9},
   {x:dx+1,y:dy+.4},{x:dx,y:dy+.4}],
  notDone:false,refIndexFn:NATIVE_LATEX,absorptionFn:'0',plotFns:false,
  origin:{x:dx,y:dy},stepSize,intersectTol:1e-5,partialReflect:false
 };
 const detector=structuredClone(compiled.native.objs[2]);
 detector.p1={x:dx+1.2,y:dy-1};
 detector.p2={x:dx+1.2,y:dy+1};
 const scene=core.loadNative({...compiled.native,objs:[source,glass,detector],maxRayDepth:2048});
 assert.deepEqual(scene.objs.map(o=>o.constructor.type),['SingleRay','GrinGlass','Detector']);
 const steps=[],hits=[],auditFaults=[];
 const oldGlass=scene.objs[1].onRayIncident;
 scene.objs[1].onRayIncident=function(...args){
  const incident={x:args[2]?.x,y:args[2]?.y};
  const outcome=oldGlass.apply(this,args); // actual pinned solver unchanged
  if(steps.length<LIMIT_CALLBACKS){
   steps.push({
    at:incident,
    next:outcome?.isAbsorbed?null:{x:args[0]?.p2?.x,y:args[0]?.p2?.y},
    absorbed:outcome?.isAbsorbed===true,
    undefinedBehavior:outcome?.isUndefinedBehavior===true
   });
  }else auditFaults.push('native-callback-cap-exceeded');
  return outcome;
 };
 const oldDetector=scene.objs[2].onRayIncident;
 scene.objs[2].onRayIncident=function(...args){
  if(hits.length<8)hits.push({x:args[2]?.x,y:args[2]?.y});
  else auditFaults.push('detector-hit-cap-exceeded');
  return oldDetector.apply(this,args);
 };
 const simulator=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;
 for(const event of ['simulationComplete','simulationStop'])
  simulator.on(event,()=>{terminal=event;});
 simulator.updateSimulation();
 const diag=core.diagnostics(scene,simulator);
 return {spec,terminal,diag,state:core.classifyRun(terminal,diag),steps,hits,
  auditFaults,rawResearch,publicAuthoring:false,nativeImageDetected:false,
  continuousErrorCertified:false};
}
function assertQualified(r,label){
 assert.equal(r.terminal,'simulationComplete',label+': actual native terminal');
 assert.equal(r.state,'completed',label+': native run must complete without errors');
 assert.equal(r.diag.errors.length,0,label+': zero native errors');
 assert.equal(r.diag.truncation,0,label+': no native truncation');
 assert.equal(r.diag.undefinedBehavior,0,label+': no undefined behavior');
 assert.deepEqual(r.auditFaults,[],label+': bounded evidence');
 assert.ok(r.steps.length>=10&&r.steps.length<LIMIT_CALLBACKS,label+': actual native incremental ray callbacks');
 assert.ok(r.steps.every(p=>p.at&&p.next&&!p.absorbed&&!p.undefinedBehavior&&
  [p.at.x,p.at.y,p.next.x,p.next.y].every(Number.isFinite)),label+': finite native witness');
 assert.equal(r.hits.length,1,label+': one genuine detector hit');
 assert.ok([r.hits[0].x,r.hits[0].y].every(Number.isFinite),label+': real finite detector coordinates');
 assert.ok(Math.abs(r.hits[0].x-r.spec.translateXmm-1.2)<1e-8,label+': actual detector plane');
 assert.equal(r.nativeImageDetected,false);
}
function analyticNativeY(){
 const p=plan.predeclaredAnalyticalControl;
 const dx=p.exitXmm-p.x0mm;
 const yExit=dx*dx/(4*p.A*p.Lmm);
 const sint=dx/(2*Math.sqrt(p.A)*p.Lmm);
 return -(yExit+(p.detectorXmm-p.exitXmm)*sint/Math.sqrt(1-sint*sint));
}
test('frozen protocol and strictly bounded preflight reject unsupported GRIN units, expressions and singular domains',()=>{
 assert.equal(plan.format,'opticsim-jee-grin-numerical-qualification-v2');
 assert.equal(plan.status,'frozen-before-test-implementation');
 assert.equal(plan.baseline,'d3c535d9fe1bc5e2a27e414a9224084a3ae7bc3f');
 assert.equal(plan.pinnedPhyDemo,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(plan.model.nativeYDownLatex,NATIVE_LATEX);
 assert.ok(Math.abs(plan.predeclaredAnalyticalControl.analyticalNativeDetectorYmm-analyticNativeY())<1e-12,
  'frozen first-integral reference must match within binary64 representation tolerance');
 const allowed=validateResearchFacts(template());
 assert.ok(allowed.minIndex>1&&allowed.maxIndex<4);
 const variants=[
  q=>{q.latexExpression='\\sqrt{1-y}';},
  q=>{q.lengthUnit='cm';},q=>{q.stepSizeMm=0;},q=>{q.stepSizeMm=.1;},
  q=>{q.squaredIndexAtOrigin=1;},q=>{q.squaredIndexAtOrigin=.5;},
  q=>{q.indexFamily='arbitrary-latex';},q=>{q.sourceXLocalMm=0;},
  q=>{q.sourceXLocalMm=1;},q=>{q.sourceYLocalMm=.4;},
  q=>{q.sourceAngleDeg=89.99;},q=>{q.translateXmm=9000;},
  q=>{q.translateYmm=-9000;},q=>{q.scaleLengthMm=-1;},
  q=>{delete q.outsideIndex;},q=>{q.stepSizeMm=NaN;},
  q=>{q.outsideIndex='1';},q=>{q.squaredIndexAtOrigin=Infinity;}
 ];
 for(const fn of variants){const q=template();fn(q);assert.throws(()=>validateResearchFacts(q));}
 assert.throws(()=>validateResearchFacts(null));
 const unsupported=structuredClone(baseScene);
 unsupported.physics.components[1].type='grin-dielectric';
 assert.throws(()=>core.compile(unsupported),/scope|support|type|invalid|expected/i);
});
test('physically bounded native gradient converges toward frozen analytical reference under five integration steps',()=>{
 const values=[],records=[];
 for(const stepSize of plan.stepsMm){
  const r=observedNative({stepSize});
  assertQualified(r,'step '+stepSize);
  const yLocal=r.hits[0].y;
  records.push({stepSizeMm:stepSize,nativeCallbacks:r.steps.length,nativeDetectorYmm:yLocal});
  values.push(yLocal);
 }
 const reference=analyticNativeY();
 const errors=values.map(y=>Math.abs(y-reference));
 assert.ok(errors.every(e=>Number.isFinite(e)&&e<.04),
  'this bounded native configuration must remain numerically near the independent continuous reference');
 assert.ok(errors.at(-1)<errors[0],
  'finer native stepping should improve the baseline reference discrepancy');
 assert.ok(errors.at(-1)<.01,'at 0.0025 mm this synthetic detector error must be under 0.01 mm');
 assert.ok(values.some((v,i)=>i>0&&Math.abs(v-values[0])>1e-6),
  'native Euler step results cannot silently be represented as exact');
 for(let i=1;i<records.length;i++)
  assert.ok(records[i].nativeCallbacks>records[i-1].nativeCallbacks);
 console.log('JEE_GRIN_V2_STEP_SERIES '+JSON.stringify({status:'native-complete-research-only',
  records,continuousReferenceNativeYmm:reference,absoluteDeviationMm:errors,
  certifiedErrorBound:null,originalJeeSolved:false,nativeImageDetected:false}));
});
test('moderate shifted fixed-index regions preserve local native measurements within declared bound',()=>{
 const base=observedNative({stepSize:.01});assertQualified(base,'base');
 const records=[];
 for(const [dx,dy] of plan.translationsNativeMm.slice(1,3)){
  const r=observedNative({stepSize:.01,dx,dy});
  assertQualified(r,'translated '+dx+','+dy);
  const yLocal=r.hits[0].y-dy;
  assert.ok(Math.abs(yLocal-base.hits[0].y)<.005,
   'shifted scene must preserve native crossing within 0.005 mm');
  records.push({dx,dy,nativeYLocal:yLocal,deltaFromUnshiftedMm:yLocal-base.hits[0].y});
 }
 console.log('JEE_GRIN_V2_TRANSLATION '+JSON.stringify({records,baselineYmm:base.hits[0].y,
  certifiedGlobalInvariance:false,publicAdmission:false}));
});
test('near-world-boundary native translations remain raw observations only; bounded preflight refuses them',()=>{
 const records=[];
 for(const [dx,dy] of plan.translationsNativeMm.slice(3)){
  const spec={...template(),translateXmm:dx,translateYmm:dy};
  assert.throws(()=>validateResearchFacts(spec),/Large-world-coordinate/);
  const r=observedNative({stepSize:.01,dx,dy,rawResearch:true});
  const yLocal=r.hits.length===1?r.hits[0].y-dy:null;
  records.push({dx,dy,nativeState:r.state,terminal:r.terminal,
   callbackCount:r.steps.length,detectorYLocalMm:yLocal,
   errors:r.diag.errors.slice(0,2),truncation:r.diag.truncation,
   qualifiedPublic:false});
  // Even a raw native completion at large |x| is NOT permission for public use.
  assert.equal(r.publicAuthoring,false);
  assert.equal(r.continuousErrorCertified,false);
  assert.ok(r.steps.length<LIMIT_CALLBACKS,'the raw research audit must stay bounded');
 }
 console.log('JEE_GRIN_V2_NEAR_WORLD '+JSON.stringify({records,admission:'refused-by-proposed-research-gate'}));
});
