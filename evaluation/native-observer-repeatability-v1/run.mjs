// RESEARCH ONLY: repeated, unchanged authored v9 native runs with and without
// the existing Stage-1 opt-in advisory. This is NOT a neutrality proof, new
// physics, a ray solver, a mandatory gate, or a historical first-attempt edit.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const thisFile=fileURLToPath(import.meta.url);
const sha=s=>createHash('sha256').update(s).digest('hex');
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const expectedMain='50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518';
const diagnostic=[{id:'repeatability-only-advisory',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
const isComplete=s=>['completed','completed-with-warnings'].includes(s);
const indices={inside:1.6,outside:1.3};
const critical=Math.asin(indices.outside/indices.inside)*180/Math.PI;
const fixture=JSON.parse(readFileSync(resolve(root,'examples/polygon-dielectric.json'),'utf8'));
const rotate=(p,degrees)=>{
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {x:p.x*c-p.y*s,y:p.x*s+p.y*c};
};
const transform=(p,{deg=0,dx=0,dy=0}={})=>{
 const q=rotate(p,deg);return {x:q.x+dx,y:q.y+dy};
};
const geom=[
 {x:-3000,y:-1000},{x:3000,y:-1000},
 {x:3000,y:0},{x:-3000,y:0}
];
function criticalInput(id,theta,tr={}){
 const glass={
  id:'G1',type:'polygon-dielectric',
  parameters:{...Object.fromEntries(geom.flatMap((p,i)=>{
   const q=transform(p,tr),n=i+1;
   return [['x'+n,q.x],['y'+n,q.y]];
  })),
   insideIndex:indices.inside,outsideIndex:indices.outside,
   partialReflection:false}
 };
 const origin=transform({x:0,y:-100},tr);
 return {id,kind:'inside-to-outside-square-glass',
  regime:theta<critical?'below-computed-critical':theta>critical?'above-computed-critical':'computed-critical',
  angleDeg:theta,transform:tr,
  authored:{lengthUnit:'mm',
   title:'Synthetic fixed-input native numerical repeatability '+id,
   runPolicy:'preview-v1',
   components:[
    {id:'S1',type:'point-source',
     parameters:{x:origin.x,y:origin.y,brightness:1},
     emission:{mode:'single-ray',directionDeg:90-theta+(tr.deg||0)}},
    glass
   ]}
 };
}
function cases(){
 const simple=structuredClone(fixture.physical);
 const many=structuredClone(fixture.physical);
 const source=many.components.find(c=>c.type==='point-source');
 const detector=many.components.find(c=>c.type==='ray-detector');
 many.components.push({...structuredClone(source),id:'S2',
  parameters:{...source.parameters,y:2}});
 many.components.push({...structuredClone(detector),id:'D2',
  parameters:{...detector.parameters,x:30}});
 return [
  {id:'normal-one-source-one-detector',kind:'control',regime:'normal',authored:simple},
  {id:'normal-two-source-two-detector',kind:'control',regime:'normal',authored:many},
  criticalInput('five-deg-below',critical-5),
  criticalInput('near-below-point001',critical-.001),
  criticalInput('computed-critical-base',critical),
  criticalInput('computed-critical-translated',critical,{dx:245,dy:-170}),
  criticalInput('computed-critical-rotated37',critical,{deg:37}),
  criticalInput('near-above-point001',critical+.001),
  criticalInput('five-deg-above',critical+5)
 ];
}
function preflight(){
 const vendor=resolve(root,'vendor/ray-optics');
 const pin=execFileSync('git',['-C',vendor,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(pin,UPSTREAM,'No drift from exact pinned PhyDemo optics engine');
 assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],
  {encoding:'utf8'}).trim(),'','Pinned vendored optics source must not be modified');
 assert.ok(process.versions.node.startsWith('24.'),'Require supported Node 24 native test runtime');
}
function prepare(input){
 const doc=prepareScene(input.authored).document;
 assert.equal(doc.schemaVersion,9,'All cases remain existing v9 Glass');
 return {...input,document:doc,sceneSha256:sha(serializeSave(doc))};
}
function runOnce(input,mode,where,ordinal){
 const document=input.document, before=serializeSave(document),started=performance.now();
 const report=evaluateDocument(document,core,mode==='on'?diagnostic:[]);
 assert.equal(serializeSave(document),before,'Native trial may not modify immutable physical document');
 assert.equal(sha(before),input.sceneSha256,'Native trial changed frozen physical input hash');
 const {summary}=report,raw=report.report.native.diagnostics;
 const status=summary.native.status;
 const advisory=raw?.finiteHitDiagnostic??null;
 if(mode==='off'){
   assert.equal(Object.hasOwn(raw,'finiteHitDiagnostic'),false,'No opt-in means no native advisory observer output');
   assert.equal(summary.observations&&Object.hasOwn(summary.observations,'finiteHitDiagnostic'),false,
    'No opt-in means no accepted advisory result');
 }else{
   assert.ok(advisory&&advisory.advisory===true,'Opt-in native diagnostic must retain honest status');
   assert.equal(advisory.nativeMeasurementQualificationUnchanged,true,
    'Opt-in observation must never change native measurement qualification');
   if(isComplete(status))assert.ok(summary.observations?.finiteHitDiagnostic,
     'Complete requested diagnostic must be present');
   else assert.equal(summary.observations,null,
     'Incomplete native runs must not expose a qualified observation snapshot');
 }
 const meter=raw?.interfacesById?.G1,first=meter?.first;
 const native={
  state:status,completed:report.report.native.completed,
  processed:raw?.processed??null,truncation:raw?.truncation??null,
  undefinedBehavior:raw?.undefinedBehavior??null,
  emitted:raw?.emitted??null,
  errors:raw?.errors||[],warnings:raw?.warnings||[],
  emissionsById:raw?.emissionsById??null,
  detectorsById:raw?.detectorsById??null,
  glass:meter?{
   interactions:meter.interactions,invalidObservations:meter.invalidObservations,
   transmitted:meter.transmitted,reflected:meter.reflected,
   totalInternalReflections:meter.totalInternalReflections,
   first:first?{
    outcome:first.outcome,incidentAngleDeg:first.incidentAngleDeg,
    transmittedAngleDeg:first.transmittedAngleDeg??null,
    reflectedAngleDeg:first.reflectedAngleDeg??null,
    from:first.from,faceId:first.faceId??null
   }:null,
   faces:Object.fromEntries(Object.entries(meter.faces||{}).map(([id,v])=>[id,{
    interactions:v.interactions,firstOutcome:v.first?.outcome??null
   }]))
  }:null
 };
 const nativeFingerprint=sha(JSON.stringify(native));
 const forward=first?.outcome??null,reference=null;
 let independentFirst=null;
 if(input.kind==='inside-to-outside-square-glass'&&
   ['five-deg-below','five-deg-above'].includes(input.id)){
   const shouldTransmit=input.id==='five-deg-below';
   const expectedAngle=shouldTransmit?
    Math.asin(indices.inside/indices.outside*Math.sin(input.angleDeg*Math.PI/180))*180/Math.PI:null;
   independentFirst={kind:'independent-scalar-snell-first-encounter',
    incidentDeg:input.angleDeg,expectedOutcome:shouldTransmit?'transmission':'total-internal-reflection',
    expectedTransmissionDeg:expectedAngle,
    actualOutcome:forward,
    actualIncidentDeg:first?.incidentAngleDeg??null,
    actualTransmissionDeg:first?.transmittedAngleDeg??null};
 }
 const phase=mode==='on'?'diagnostic requested':'ordinary native run';
 return {caseId:input.id,mode,phase,where,ordinal,sceneSha256:input.sceneSha256,
  elapsedMs:Number((performance.now()-started).toFixed(4)),nativeFingerprint,native,
  diagnostic:advisory?{
   status:advisory.status,reasonCode:advisory.reasonCode,
   observedGlassIncidents:advisory.observedGlassIncidents,
   analyzedGlassIncidents:advisory.analyzedGlassIncidents,
   checked:advisory.checked,unknown:advisory.unknown,conflicting:advisory.conflicting,
   limit:advisory.limit
  }:null,
  independentFirst};
}
const tally=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>key(r)))].map(k=>
 [k,rows.filter(r=>key(r)===k).length]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
const hashset=rows=>new Set(rows.map(r=>r.nativeFingerprint));
function statistics(rows,caseId){
 const g=rows.filter(r=>r.caseId===caseId&&!r.error);
 const modes={};
 for(const mode of ['off','on']){
  const rs=g.filter(x=>x.mode===mode);
  modes[mode]={count:rs.length,nativeStates:tally(rs,x=>x.native.state),
   totalNativeFingerprints:hashset(rs).size,
   glassIncidents:tally(rs,x=>x.native.glass?.interactions??'none'),
   processedSegments:tally(rs,x=>x.native.processed??'none'),
   firstNativeOutcomes:tally(rs,x=>x.native.glass?.first?.outcome??'none'),
   advisoryStatuses:mode==='on'?tally(rs,x=>x.diagnostic?.status??'none'):null};
 }
 return {caseId,total:g.length,modes,
  note:'Distinct separate executions are not paired ray objects or a causal identification of observation effects.'};
}
function syntheticInputList(){
 return cases().map(x=>prepare(x));
}
async function main(){
 preflight();
 const output=process.argv[2]?
  resolve(root,process.argv[2]):resolve(root,'test-artifacts/llm-authoring/native-observer-repeatability-v1');
 const allowed=resolve(root,'test-artifacts/llm-authoring/');
 if(!output.startsWith(allowed+'/'))throw Error('Output must be fresh path under test-artifacts/llm-authoring/');
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output,{recursive:false});
 const input=syntheticInputList();
 const inputsText=JSON.stringify({format:'opticsim-v9-repeatability-inputs-v1',
  method:'synthetic prospective fixed geometry, no source image',criticalDeg:critical,
  cases:input},null,2)+'\n';
 const inputFile=join(output,'inputs.json');
 writeFileSync(inputFile,inputsText,{flag:'wx'});
 const rows=[],errors=[];
 const schedule=['off','on','on','off'];
 // ABBA order controls coarse order drift without calling two different
 // native rays "the same." Four rounds × 4 modes × 9 scenes = 144 true
 // same-process native executions (8 off / 8 on per scene).
 for(const c of input)for(let round=0;round<4;round++)for(const [slot,mode]of schedule.entries()){
  try{rows.push(runOnce(c,mode,'same-process',
    {round:round+1,slot:slot+1,orderIndex:round*4+slot+1}));}
  catch(e){errors.push({caseId:c.id,mode,where:'same-process',
    round,slot,message:String(e?.stack||e)});}
 }
 // Process isolation tests initialization/JIT/global-state contributions.
 // Two fresh OS processes per mode/case, deliberately counterbalanced.
 // Never pass different authored physical parameters to "repair" outcomes.
 const sets=[['off','on'],['on','off']];
 for(const c of input)for(const [cycle,modes]of sets.entries())for(const [position,mode]of modes.entries()){
  try{
   const outputText=execFileSync(process.execPath,[thisFile,'single',inputFile,c.id,mode],{
    cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:20000});
   const marker=outputText.split('\n').find(x=>x.startsWith('REPEATABILITY_SINGLE '));
   if(!marker)throw Error('Fresh process did not report a native observation');
   const record=JSON.parse(marker.slice('REPEATABILITY_SINGLE '.length));
   assert.equal(record.sceneSha256,c.sceneSha256);
   rows.push({...record,where:'fresh-process',
    ordinal:{cycle:cycle+1,slot:position+1,orderIndex:cycle*2+position+1}});
  }catch(e){errors.push({caseId:c.id,mode,where:'fresh-process',cycle,position,
   message:String(e?.stack||e)});}
 }
 const summary=input.map(c=>statistics(rows,c.id));
 const runCount=rows.length,canonicalInputsValid=rows.every(r=>
  input.some(c=>c.id===r.caseId&&c.sceneSha256===r.sceneSha256));
 const controlOutcomes=[];
 for(const r of rows)if(r.independentFirst){
  const x=r.independentFirst;
  if(r.native.state==='completed'||r.native.state==='completed-with-warnings'){
   const agree=x.actualOutcome===x.expectedOutcome&&
    Math.abs((x.actualIncidentDeg??NaN)-x.incidentDeg)<1e-5&&
    (x.expectedTransmissionDeg===null?
      x.actualTransmissionDeg===null:
      Math.abs((x.actualTransmissionDeg??NaN)-x.expectedTransmissionDeg)<1e-5);
   if(!agree)controlOutcomes.push({caseId:r.caseId,mode:r.mode,where:r.where,
    ordinal:r.ordinal,physicalFarControlMismatch:x});
  }
 }
 const report={format:'opticsim-native-observer-fixed-input-repeatability-v1',
  status:errors.length||!canonicalInputsValid||controlOutcomes.length?'failed-invariants':'research-complete',
  provenance:{baseMain:expectedMain,node:process.version,v8:process.versions.v8,
   pinnedPhyDemo:UPSTREAM,gitCheckoutSha:process.env.GITHUB_SHA??null,
   githubRunId:process.env.GITHUB_RUN_ID??null,inputFileSha256:sha(inputsText)},
  methodology:{cases:input.length,abbreviatedSchedule:'(OFF, ON, ON, OFF)×4 each case in one Node process; + (OFF,ON),(ON,OFF) in fresh processes',
   intendedSameProcessNativeRuns:input.length*16,intendedFreshProcessNativeRuns:input.length*4,
   independentlyAuthoredControls:'scalar Snell/TIR at ±5deg first native encounter only',
   noNativeRayChanged:true,noCutoffChanged:true,noStage2Policy:true,
   notBlindIndependentEvaluation:true,
   limitations:'Separate native executions are not the same ray or proof of causal observer effects; JIT, state, order and numerical conditioning may vary. Completed native is not certified physical correctness. This is same-assistant research, not a Chat B or human physics review.'},
  observedNativeRuns:runCount,errors,farControlMismatches:controlOutcomes,
  summary,rows};
 const reportPath=join(output,'report.json');
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 assert.equal(errors.length,0,'At least one real native trial failed setup, see retained research report');
 assert.equal(runCount,input.length*20,'Incomplete prospective repeated native matrix');
 assert.ok(canonicalInputsValid,'One native record did not preserve its original input hash');
 assert.equal(controlOutcomes.length,0,'Far-from-critical independent Snell/TIR controls disagree');
 console.log('NATIVE_OBSERVER_REPEATABILITY '+JSON.stringify({
  status:report.status,actualNativeExecutions:runCount,
  cases:input.length,summary:summary.map(x=>({case:x.caseId,off:x.modes.off,on:x.modes.on})),
  reportPath}).slice(0,20000));
}
if(process.argv[2]==='single'){
 const inputText=readFileSync(resolve(process.argv[3]),'utf8');
 const document=JSON.parse(inputText);
 const matched=document.cases.find(x=>x.id===process.argv[4]);
 if(!matched||!['off','on'].includes(process.argv[5]))
  throw Error('Usage single <frozen-inputs.json> <case-id> <off|on>');
 preflight();
 console.log('REPEATABILITY_SINGLE '+JSON.stringify(runOnce(matched,process.argv[5],'fresh-process',null)));
}else if(process.argv[1]&&resolve(process.argv[1])===thisFile)await main();
