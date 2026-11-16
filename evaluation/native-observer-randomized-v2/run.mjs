// Research-only, pinned-native fixed-input experiment. Two DISTINCT arms:
// A) randomised OFF/ON in separate OS processes without extra observers;
// B) separately labelled research SHADOW with one extra native wrapper solely
// to retain ORIGINAL per-callback binary64 coordinates for independent review.
// No new optics, Stage-2 gate, source claim, physics corrections, or retries.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {createNativeFiniteHitDiagnostic} from '../../src/native-finite-hit-diagnostic.js';
import {auditRecordedFiniteHit,FINITE_HIT_CAP} from '../../src/finite-hit-exact.js';
import {polygonFaces} from '../../src/polygon-dielectric.js';

const root=fileURLToPath(new URL('../../',import.meta.url)),self=fileURLToPath(import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const require=createRequire(import.meta.url),core=require(resolve(root,'dist/test-core.cjs'));
const base='50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518';
const indexRatio={inside:1.6,outside:1.3},critical=Math.asin(indexRatio.outside/indexRatio.inside)*180/Math.PI;
const advisory=[{id:'numeric-risk',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
const isComplete=s=>['completed','completed-with-warnings'].includes(s);
const rotate=(p,deg)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 return {x:p.x*c-p.y*s,y:p.x*s+p.y*c};};
const place=(p,t)=>{const v=rotate(p,t.deg||0);return {x:v.x+(t.dx||0),y:v.y+(t.dy||0)};};
const materialVertices=[{x:-3000,y:-1000},{x:3000,y:-1000},{x:3000,y:0},{x:-3000,y:0}];
function criticalCase(id,angle,t={}){
 const vertices=materialVertices.map(v=>place(v,t)),p=place({x:0,y:-100},t);
 const g=Object.fromEntries(vertices.flatMap((v,i)=>[['x'+(i+1),v.x],['y'+(i+1),v.y]]));
 const authored={lengthUnit:'mm',title:'Synthetic native fresh-process study '+id,
  runPolicy:'preview-v1',components:[
   {id:'S1',type:'point-source',parameters:{x:p.x,y:p.y,brightness:1},
    emission:{mode:'single-ray',directionDeg:90-angle+(t.deg||0)}},
   {id:'G1',type:'polygon-dielectric',parameters:{
    ...g,insideIndex:indexRatio.inside,outsideIndex:indexRatio.outside,partialReflection:false}}
  ]};
 return {id,authored,angleDeg:angle,regime:id};
}
function frozenCases(){
 const basic=JSON.parse(readFileSync(resolve(root,'examples/polygon-dielectric.json'),'utf8')).physical;
 const arr=[
  {id:'normal-with-detector',regime:'normal',authored:basic},
  criticalCase('far-below-five',critical-5),
  criticalCase('critical-translated',critical,{dx:245,dy:-170}),
  criticalCase('critical-rotated37',critical,{deg:37}),
  criticalCase('far-above-five',critical+5)
 ];
 return arr.map(x=>{
  const document=prepareScene(x.authored).document,save=serializeSave(document);
  assert.equal(document.schemaVersion,9);
  return {...x,document,sceneSha256:hash(save)};
 });
}
function assertPin(){
 assert.ok(process.version.startsWith('v24.'),'Expected Node 24');
 const vendor=resolve(root,'vendor/ray-optics');
 assert.equal(execFileSync('git',['-C',vendor,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),UPSTREAM);
 assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],
 {encoding:'utf8'}).trim(),'','Pinned native source must be clean');
}
function nativeProjection(diagnostics,native,executionPassed){
 const glass=diagnostics?.interfacesById?.G1||null;
 return {
  status:native.status,completed:native.completed,executionPassed,
  error:native.error??null,errors:diagnostics?.errors??[],
  warnings:diagnostics?.warnings??[],truncation:diagnostics?.truncation??null,
  undefinedBehavior:diagnostics?.undefinedBehavior??null,
  processed:diagnostics?.processed??null,emitted:diagnostics?.emitted??null,
  emissionsById:diagnostics?.emissionsById??null,
  detectorsById:diagnostics?.detectorsById??null,
  interface:glass?{interactions:glass.interactions,transmitted:glass.transmitted,
   reflected:glass.reflected,tir:glass.totalInternalReflections,
   invalidObservations:glass.invalidObservations,
   first:glass.first?{
    outcome:glass.first.outcome,from:glass.first.from,
    faceId:glass.first.faceId??null,
    incidence:glass.first.incidentAngleDeg,transmission:glass.first.transmittedAngleDeg,
    reflection:glass.first.reflectedAngleDeg
   }:null,
   faces:Object.fromEntries(Object.entries(glass.faces||{}).map(([k,v])=>[k,{interactions:v.interactions}]))
  }:null
 };
}
function ordinary(c,mode){
 const before=serializeSave(c.document),started=performance.now();
 assert.equal(hash(before),c.sceneSha256);
 const evaluated=evaluateDocument(c.document,core,mode==='on'?advisory:[]);
 assert.equal(serializeSave(c.document),before);
 const d=evaluated.report.native.diagnostics,additional=d?.finiteHitDiagnostic??null;
 if(mode==='off')assert.ok(!Object.hasOwn(d,'finiteHitDiagnostic'),
   'OFF must remain genuinely uninstrumented by finite-hit diagnostic');
 if(mode==='on')assert.ok(additional?.advisory===true,
   'ON must use existing production opt-in advisory, not custom shadow code');
 const native=nativeProjection(d,evaluated.report.native,evaluated.report.executionPassed);
 return {caseId:c.id,mode,sceneSha256:c.sceneSha256,
  native,projectedNativeSha256:hash(JSON.stringify(native)),
  diagnostic:additional?{
   status:additional.status,reasonCode:additional.reasonCode,
   observedGlassIncidents:additional.observedGlassIncidents,
   checked:additional.checked,unknown:additional.unknown,conflicting:additional.conflicting
  }:null,
  elapsedMs:Number((performance.now()-started).toFixed(3))};
}
// This SHADOW is a different experiment profile, NOT interchangeable with
// genuine "on" (one native observer owner) or "off" (no optional observer).
// It adds a separate read-only native-calling wrapper *before* the existing
// owning Stage-1 interface observer; the added JS call may perturb critical
// behavior. Keep these rows segregated, never infer observer neutrality.
function shadow(c){
 const before=serializeSave(c.document),loaded=core.loadDocument(c.document);
 assert.equal(hash(before),c.sceneSha256);
 const glass=loaded.scene.objs[loaded.idMap.get('G1')];
 assert.ok(glass&&typeof glass.onRayIncident==='function');
 const original=glass.onRayIncident,captures=[];let count=0,captureError=null;
 glass.onRayIncident=function(...args){
  count++;
  try{
   if(count<=FINITE_HIT_CAP){
    const ray=args[0],hit=args[2];
    const copy=p=>({x:p?.x??null,y:p?.y??null});
    captures.push({p1:copy(ray?.p1),p2:copy(ray?.p2),incident:copy(hit)});
   }
  }catch(e){captureError??=String(e);}
  return original.apply(this,args);
 };
 const finite=createNativeFiniteHitDiagnostic(c.document,loaded.scene,loaded.idMap,['G1']);
 assert.ok(finite);
 const sources=core.observeSourceSet(c.document,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
 const detectors=core.observeDetectorSet(c.document,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
 const interfaces=core.observeInterfaceSet(c.document,loaded.scene,loaded.idMap,{finiteDiagnostic:finite});
 const session=new core.Session(()=>{
  const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,c.document.simulation.processedRayLimit);
  return {cancel(){sim.shouldSimulatorStop=true;},
   run(notify){
    for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>notify(event,
     core.diagnostics(loaded.scene,sim,sources,null,detectors,interfaces,null,
      {nativeEvent:event,finiteDiagnostic:finite})));
    sim.updateSimulation();
   }};
 },()=>{});
 session.apply(c.document);
 if(session.state==='running')session.stop();
 const d=session.data??null;
 const native=nativeProjection(d,{status:session.state,completed:isComplete(session.state),
  error:session.error??null},isComplete(session.state));
 assert.equal(serializeSave(c.document),before,'SHADOW may not change authored physics');
 assert.equal(count,d?.interfacesById?.G1?.interactions,
  'Extra shadow hook must see each actual interface owner invocation');
 const cap=finite?.limit||FINITE_HIT_CAP;
 const faces=polygonFaces(c.document.physics.components.find(x=>x.id==='G1').parameters);
 const cutoff=core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED*(loaded.scene.lengthScale??1)**2;
 const exactAtCaptured=captures.map((hit,index)=>{
  const d=auditRecordedFiniteHit(hit,faces,cutoff);
  return {index,kind:d.status,reasonCode:d.reasonCode};
 });
 return {caseId:c.id,mode:'shadow-extra-wrapper',sceneSha256:c.sceneSha256,
  native,projectedNativeSha256:hash(JSON.stringify(native)),
  diagnostic:d?.finiteHitDiagnostic??null,
  instrumentProfile:'extra research-only native-calling wrapper BEFORE existing Stage-1 observer; not equivalent to ON/OFF',
  totalCapturedCallbackCount:count,rawCapturedCount:captures.length,captureLimit:FINITE_HIT_CAP,
  captureError,actualNativeHitCoordinates:captures,existingExactFunctionClassifications:exactAtCaptured,
  nativeFaceVertices:faces.map(f=>({id:f.id,a:f.a,b:f.b})),
  nativeSegmentCutoffSquared:cutoff};
}
function seeded(seed){
 let n=seed>>>0;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};
}
function shuffle(a,random){
 const v=[...a];for(let j=v.length-1;j>0;j--){
  const i=Math.floor(random()*(j+1));[v[j],v[i]]=[v[i],v[j]];
 }return v;
}
const tally=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].sort()
 .map(k=>[k,rows.filter(x=>key(x)===k).length]));
async function experiment(){
 assertPin();
 const output=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/native-observer-randomized-v2');
 const allowed=resolve(root,'test-artifacts/llm-authoring/');
 if(!output.startsWith(allowed))throw Error('Only fresh test-artifacts output is allowed');
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output,{recursive:false});
 const cases=frozenCases();
 const frozen={format:'opticsim-native-observer-randomized-input-v2',
  projectBase:base,nativePin:UPSTREAM,node:process.version,
  seed:0x90a112,criticalDeg:critical,
  question:'Descriptive fixed-input OFF/ON randomness and separate captured binary64 evidence; not causal neutrality',
  cases};
 const inputText=JSON.stringify(frozen,null,2)+'\n',inputFile=join(output,'inputs.json');
 writeFileSync(inputFile,inputText,{flag:'wx'});
 const random=seeded(frozen.seed),order=[];
 // Preregister six RANDOMISED balanced 4-trial blocks per case, 12
 // OFF and 12 ON, each in a fresh OS process. Within-block order is
 // randomized, not chosen in response to earlier outcomes.
 for(const c of cases)for(let block=0;block<6;block++){
  for(const [slot,mode] of shuffle(['off','off','on','on'],random).entries())
   order.push({caseId:c.id,profile:mode,block:block+1,slot:slot+1});
 }
 // A separate auxiliary evidence arm, with extra wrapper, is NOT part of
 // ON/OFF randomization or causal comparisons. Four per selected case.
 for(const caseId of ['normal-with-detector','critical-translated','critical-rotated37']){
  for(let i=0;i<4;i++)order.push({caseId,profile:'shadow',block:i+1,slot:1});
 }
 const rows=[],errors=[];
 for(const [index,spec]of order.entries()){
  try{
   const stdout=execFileSync(process.execPath,[self,'single',inputFile,spec.caseId,spec.profile],{
    cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:20000});
   const marker=stdout.trim().split('\n').find(x=>x.startsWith('NATIVE_RANDOMIZED_SINGLE '));
   if(!marker)throw Error('Child produced no native experiment record');
   const row=JSON.parse(marker.slice('NATIVE_RANDOMIZED_SINGLE '.length));
   const source=cases.find(c=>c.id===spec.caseId);
   assert.equal(row.sceneSha256,source.sceneSha256);
   rows.push({...row,schedule:spec,ordinal:index+1,processKind:'new OS process'});
  }catch(e){errors.push({schedule:spec,ordinal:index+1,message:String(e.stack||e)});}
 }
 const analysis=cases.map(c=>{
  const own=rows.filter(x=>x.caseId===c.id);
  return {caseId:c.id,
   ordinary:Object.fromEntries(['off','on'].map(mode=>{
    const arr=own.filter(x=>x.mode===mode);
    return [mode,{n:arr.length,states:tally(arr,x=>x.native.status),
     incidentCounts:tally(arr,x=>String(x.native.interface?.interactions??'none')),
     fingerprints:tally(arr,x=>x.projectedNativeSha256),
     advisory:mode==='on'?tally(arr,x=>x.diagnostic?.status??'none'):null}];
   })),
   separateShadow:{n:own.filter(x=>x.mode==='shadow-extra-wrapper').length,
    originalPerHitEvidenceCount:own.filter(x=>x.mode==='shadow-extra-wrapper').reduce((n,x)=>n+x.rawCapturedCount,0)}};
 });
 const captured=rows.filter(x=>x.mode==='shadow-extra-wrapper');
 const physicalControls=[];
 for(const x of rows.filter(x=>['far-below-five','far-above-five'].includes(x.caseId))){
  const reference=cases.find(c=>c.id===x.caseId);
  const want=reference.id==='far-below-five'?'transmission':'total-internal-reflection';
  const first=x.native.interface?.first;
  // The first physical event exists even if an eventual execution fails;
  // only compare it to first-encounter analytical Snell/TIR.
  if(first&&first.outcome!==want)physicalControls.push({caseId:x.caseId,ordinal:x.ordinal,
    observed:first.outcome,expected:want});
 }
 const report={format:'opticsim-native-observer-randomized-and-shadow-v2',
  status:errors.length||physicalControls.length?'invariants-failed':'research-complete',
  source:{baseMain:base,commit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
   nativePin:UPSTREAM,node:process.version,inputSha256:hash(inputText)},
  design:{cases:cases.length,randomSeed:frozen.seed,randomization:'Fisher-Yates per fixed case, 6 balanced 2 OFF/2 ON fresh-process blocks',
   plannedOrdinary:cases.length*24,plannedShadow:3*4,
   shadowMeaning:'separate EXTRA native wrapper, may perturb execution: do not combine with ON/OFF frequencies',
   noNativePatch:true,noStage2:true,noCausalNeutralityClaim:true,
   noFullOpticalSolver:true,noOriginalTextbookSource:true},
  rows:rows.length,ordinaryRuns:rows.filter(x=>['off','on'].includes(x.mode)).length,
  separateExtraShadowRuns:captured.length,
  genuineNativeStates:tally(rows,x=>x.native.status),analysis,
  rawPerHitEvidenceRetained:captured.reduce((n,x)=>n+x.rawCapturedCount,0),
  physicalControls,errors,records:rows};
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 assert.equal(errors.length,0,'Execution/setup error; see archived original report');
 assert.equal(rows.length,order.length,'Missing trial');
 assert.equal(report.ordinaryRuns,120,'Expected 120 new-process randomized native runs');
 assert.equal(report.separateExtraShadowRuns,12,'Expected 12 distinct extra-instrumentation runs');
 assert.equal(physicalControls.length,0,'Independent scalar branch disagreement far from critical');
 console.log('NATIVE_OBSERVER_RANDOMIZED '+JSON.stringify({status:report.status,ordinary:report.ordinaryRuns,
  shadow:report.separateExtraShadowRuns,rawHitEvents:report.rawPerHitEvidenceRetained,
  cases:report.analysis.map(x=>({id:x.caseId,off:x.ordinary.off,on:x.ordinary.on,shadow:x.separateShadow})),
  output}).slice(0,23000));
}
if(process.argv[2]==='single'){
 assertPin();const input=JSON.parse(readFileSync(resolve(process.argv[3]),'utf8'));
 const item=input.cases.find(x=>x.id===process.argv[4]),mode=process.argv[5];
 if(!item||!['off','on','shadow'].includes(mode))throw Error('Invalid fresh-process trial');
 const row=mode==='shadow'?shadow(item):ordinary(item,mode);
 console.log('NATIVE_RANDOMIZED_SINGLE '+JSON.stringify(row));
}else if(process.argv[1]&&resolve(process.argv[1])===self)await experiment();
