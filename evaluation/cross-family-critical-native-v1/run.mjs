// RESEARCH ONLY: compare native high-to-low near-critical refraction at four
// independently authored Opticsim physical families. Never change propagation,
// reinsert rays, attach guessed source IDs, or promote diagnostic near-grazing
// events into available physical measurements.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from '../../scripts/authoring-evidence.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const high=1.6,low=1.3,critical=Math.asin(low/high)*180/Math.PI;
const cases=Object.freeze([
  ['below5',critical-5],['below001',critical-.001],
  ['exact-computed',critical],['above001',critical+.001],['above5',critical+5]
]);
const transforms=Object.freeze([
  {id:'base',scale:1,deg:0,tx:0,ty:0},
  {id:'small01',scale:.1,deg:0,tx:0,ty:0},
  {id:'translated',scale:1,deg:0,tx:245,ty:-170},
  {id:'rotated37',scale:1,deg:37,tx:0,ty:0}
]);
const wrap=deg=>((deg+180)%360+360)%360-180;
function coordinate(p,t){
 const a=t.deg*Math.PI/180;
 return {x:t.tx+t.scale*(p.x*Math.cos(a)-p.y*Math.sin(a)),
   y:t.ty+t.scale*(p.x*Math.sin(a)+p.y*Math.cos(a))};
}
const source=(p,directionDeg)=>({id:'S',type:'point-source',
  parameters:{...p,brightness:1},emission:{mode:'single-ray',directionDeg:wrap(directionDeg)}});
const xy=(id,pts)=>Object.fromEntries(pts.flatMap((p,i)=>[['x'+(i+1),p.x],['y'+(i+1),p.y]]));
function makeInput(family,angleCase,theta,t){
 let origin,heading,boundary;
 if(family==='planar'){
   origin=coordinate({x:0,y:-100},t);heading=90-theta+t.deg;
   boundary={id:'Boundary',type:'planar-interface',parameters:{
     ...coordinate({x:0,y:0},t),normalDeg:wrap(90+t.deg),
     negativeIndex:high,positiveIndex:low,partialReflection:false}};
 }else if(family==='circle'){
   // A horizontal chord with impact parameter R sin(theta) gives the actual
   // incidence theta at a circular rim. Rotate/translate/scale both as one
   // physical configuration; do not nudge native rays to force a result.
   origin=coordinate({x:-100,y:1000*Math.sin(theta*Math.PI/180)},t);
   heading=t.deg;
   boundary={id:'Boundary',type:'circular-dielectric',parameters:{
     ...coordinate({x:0,y:0},t),radius:1000*t.scale,
     insideIndex:high,outsideIndex:low,partialReflection:false}};
 }else if(family==='triangle'||family==='quadrilateral'){
   origin=coordinate({x:0,y:-100},t);heading=90-theta+t.deg;
   const pts=(family==='triangle'?
     [{x:-2500,y:0},{x:2500,y:0},{x:0,y:-1500}]:
     [{x:-3000,y:-1000},{x:3000,y:-1000},
      {x:3000,y:0},{x:-3000,y:0}]).map(p=>coordinate(p,t));
   boundary={id:'Boundary',type:family==='triangle'?'triangular-prism':'polygon-dielectric',
     parameters:{...xy('Boundary',pts),insideIndex:high,outsideIndex:low,
       partialReflection:false}};
 }else throw Error('Unknown family: '+family);
 return {id:family+'-'+angleCase+'-'+t.id,family,angleCase,theta,
   transform:t,request:{lengthUnit:'mm',
     title:'Synthetic critical native risk '+family+' '+angleCase+' '+t.id,
     runPolicy:'preview-v1',components:[source(origin,heading),boundary]}};
}
export function criticalInputs(){
 return ['planar','triangle','quadrilateral','circle'].flatMap(f=>
   cases.flatMap(([name,theta])=>transforms.map(t=>makeInput(f,name,theta,t))));
}
const segment=ray=>ray?.p1&&ray?.p2?{p1:{x:ray.p1.x,y:ray.p1.y},
  p2:{x:ray.p2.x,y:ray.p2.y}}:null;
function runInstrumented(doc,core){
 const saved=serializeSave(doc),loaded=core.loadDocument(doc);
 const meter=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
 const interfaceMeter=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
 const native=loaded.scene.objs[loaded.idMap.get('Boundary')],original=native.onRayIncident;
 const tokens=new WeakMap();let next=0,actualEvents=0;const entries=[];
 const token=ray=>{
   if(!ray||typeof ray!=='object')return null;
   if(!tokens.has(ray))tokens.set(ray,'native-object-'+(++next));
   return tokens.get(ray);
 };
 native.onRayIncident=function(...args){
   const ray=args[0],id=token(ray),before=segment(ray),point=args[2]&&
     {x:args[2].x,y:-args[2].y};
   const result=original.apply(this,args);actualEvents++;
   if(entries.length<24)entries.push({
     callback:actualEvents,rayToken:id,actualHitPointMm:point,
     beforeNative:before,afterNative:segment(ray),
     newlyReturnedNativeObjects:Array.isArray(result?.newRays)?
       result.newRays.map(child=>({token:token(child),afterNative:segment(child)})):[],
     absorbed:result?.isAbsorbed===true,
     undefinedBehavior:result?.isUndefinedBehavior===true
   });
   return result;
 };
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,
   doc.simulation.processedRayLimit);
 let event=null;
 for(const name of ['simulationComplete','simulationStop'])
   sim.on(name,()=>{event=name;});
 sim.updateSimulation();
 assert.ok(event,'Missing terminal pinned native event');
 const diag=core.diagnostics(loaded.scene,sim,meter,null,null,interfaceMeter);
 const nativeStatus=core.classifyRun(event,diag);
 const selfRehits=[];
 for(let i=1;i<entries.length;i++){
   const a=entries[i-1],b=entries[i];
   if(a.rayToken!==b.rayToken||!a.actualHitPointMm||!b.actualHitPointMm)continue;
   const distance=Math.hypot(a.actualHitPointMm.x-b.actualHitPointMm.x,
     a.actualHitPointMm.y-b.actualHitPointMm.y);
   if(distance<.01)selfRehits.push({earlierCallback:a.callback,
     laterCallback:b.callback,distanceMm:distance,sameActualRayObject:true});
 }
 assert.equal(serializeSave(doc),saved,'Must not edit authored physics');
 return {nativeStatus,event,
   metrics:{errors:diag.errors,warnings:diag.warnings,processed:diag.processed,
     truncation:diag.truncation,undefinedBehavior:diag.undefinedBehavior,
     emissionsById:diag.emissionsById,
     interface:diag.interfacesById?.Boundary??null},
   trace:{observedCallbacks:actualEvents,retainedCallbacks:entries.length,
     truncatedLog:actualEvents>entries.length,entries,selfRehits},
   limitation:'Tokens reflect in-run native JS object references only. No claimed complete ray path or source authenticity.'};
}
function parity(instrumented,ordinary,id){
 const n=ordinary.report.native;
 assert.equal(n.status,instrumented.nativeStatus,id+' native status parity');
 for(const [name,key] of [['processed','processed'],['truncation','truncation'],
    ['undefinedBehavior','undefinedBehavior']])
   assert.equal(n.diagnostics[key],instrumented.metrics[name],id+' '+name);
 const a=instrumented.metrics.interface,b=n.diagnostics.interfacesById?.Boundary;
 assert.equal(a.interactions,b?.interactions,id+' real interface counts');
 assert.equal(a.invalidObservations,b?.invalidObservations,id+' invalid measurement incidents');
 assert.equal(a.first?.outcome,b?.first?.outcome,id+' native first outcome');
 if(a.first?.transmittedAngleDeg!==undefined)
   assert.equal(a.first.transmittedAngleDeg,b?.first?.transmittedAngleDeg,
     id+' same actual native first transmitted direction');
 assert.deepEqual(instrumented.metrics.emissionsById,n.diagnostics.emissionsById);
}
function farFieldReference(record){
 const first=record.instrumented.metrics.interface?.first;
 if(!first)return {kind:'first-native-incident-missing'};
 const theta=record.theta*Math.PI/180,
   expectedTransmission=record.theta<critical?
     Math.asin(high/low*Math.sin(theta))*180/Math.PI:null;
 return {kind:'independent-scalar-Snell-first-encounter',
   incidenceDeg:record.theta,criticalDeg:critical,
   transmittedDeg:expectedTransmission,
   expectedOutcome:record.theta<critical?'transmission':'total-internal-reflection',
   measuredIncidenceDeg:first.incidentAngleDeg,
   measuredTransmissionDeg:first.transmittedAngleDeg,
   measuredOutcome:first.outcome,
   incidenceResidualDeg:first.incidentAngleDeg-record.theta,
   transmittedResidualDeg:expectedTransmission===null?null:
     (first.transmittedAngleDeg===null?null:first.transmittedAngleDeg-expectedTransmission)};
}
function reportRecord(input,core){
 const doc=prepareScene(input.request).document;
 const original=serializeSave(doc),instrumented=runInstrumented(doc,core),
   ordinary=evaluateDocument(doc,core);
 parity(instrumented,ordinary,input.id);
 assert.equal(serializeSave(doc),original,input.id+' authored input unchanged');
 const record={id:input.id,family:input.family,angleCase:input.angleCase,
   theta:input.theta,transform:input.transform,canonicalSha256:sha(original),
   canonicalStatus:ordinary.summary.native.status,
   canonicalObservations:ordinary.summary.observations===null?'suppressed':
     'present',
   instrumented,independentReference:null,flags:[]};
 record.independentReference=farFieldReference(record);
 const r=record.independentReference,m=instrumented.metrics;
 if(m.errors.length)record.flags.push('NATIVE_OBSERVATION_ERROR');
 if(m.warnings.length)record.flags.push('NATIVE_WARNING');
 if(instrumented.nativeStatus!=='completed')record.flags.push('NATIVE_NOT_COMPLETED');
 if(instrumented.trace.selfRehits.length)record.flags.push('CLOSE_SAME_OBJECT_NATIVE_REHIT');
 if(!m.interface?.first)record.flags.push('MISSING_FIRST_NATIVE_INTERACTION');
 if(Math.abs(r.incidenceResidualDeg??Infinity)>1e-5)
   record.flags.push('INCIDENCE_GEOMETRY_MISMATCH');
 if(input.angleCase==='below5'&&
   (r.measuredOutcome!=='transmission'||
     r.transmittedResidualDeg===null||Math.abs(r.transmittedResidualDeg)>1e-5))
   record.flags.push('FAR_BELOW_SNELL_DISAGREEMENT');
 if(input.angleCase==='above5'&&
   (r.measuredOutcome!=='total-internal-reflection'||
     r.measuredTransmissionDeg!==null))
   record.flags.push('FAR_ABOVE_TIR_DISAGREEMENT');
 if(input.angleCase==='exact-computed')
   record.flags.push('EXACT_CRITICAL_BINARY64_CLASSIFICATION_ONLY');
 return record;
}
async function main(){
 const target=process.argv[2]||
   'test-artifacts/llm-authoring/cross-family-critical-native-v1';
 if(process.argv.length>3)throw Error('Usage: node run.mjs [fresh-output-directory]');
 const output=reserveAuthoringOutput(target,root);
 const input=criticalInputs(),inputText=JSON.stringify(input,null,2)+'\n';
 writeEvidence(output.input,inputText);
 // Reject untracked or changed vendored upstream; do not silently select a
 // different physical engine or threshold to improve the results.
 const vendor=resolve(root,'vendor/ray-optics');
 assert.equal(execFileSync('git',['-C',vendor,'rev-parse','HEAD'],
   {encoding:'utf8'}).trim(),UPSTREAM);
 assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],
   {encoding:'utf8'}).trim(),'');
 const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
 const records=[],errors=[];
 for(const row of input){
   try{records.push(reportRecord(row,core));}
   catch(error){errors.push({id:row.id,error:error.message});}
 }
 const bins=Object.fromEntries(['planar','triangle','quadrilateral','circle'].map(f=>{
   const rs=records.filter(x=>x.family===f);
   return [f,{total:rs.length,
     completed:rs.filter(x=>x.canonicalStatus==='completed').length,
     incomplete:rs.filter(x=>x.canonicalStatus==='incomplete').length,
     other:rs.filter(x=>!['completed','incomplete'].includes(x.canonicalStatus)).length,
     closeRehits:rs.filter(x=>x.flags.includes('CLOSE_SAME_OBJECT_NATIVE_REHIT')).length,
     firstMismatch:rs.filter(x=>x.flags.includes('INCIDENCE_GEOMETRY_MISMATCH')).length,
     failedFarControls:rs.filter(x=>x.flags.includes('FAR_BELOW_SNELL_DISAGREEMENT')||
       x.flags.includes('FAR_ABOVE_TIR_DISAGREEMENT')).length}];
 }));
 const report={format:'opticsim-cross-family-critical-native-research-v1',
   baseMain:'fa158fc78da7a35b6a02eaed58c0cdbd4b699220',
   pinnedUpstream:UPSTREAM,inputsSha256:sha(inputText),
   intendedCases:input.length,capturedCases:records.length,errors,
   independentScalar:{high,low,criticalDeg:critical},summary:bins,
   records,limitation:'Same-assistant synthetic diagnostic. Explicit Fresnel-off model; TIR still native. Full native incompleteness is never relabeled completed. No physical repair, source-image evaluation, or generalized near-critical correctness is claimed.'};
 writeEvidence(output.report,JSON.stringify(report,null,2)+'\n');
 // Keep all actual observations even if acceptance fails; a failed case is
 // evidence, not permission to modify authored physics.
 assert.equal(errors.length,0,'Research run had setup, validation or parity failures; inspect report');
 for(const row of records){
   assert.ok(row.instrumented.metrics.interface?.first,'Each source must encounter its real boundary: '+row.id);
   if(row.angleCase==='below5'||row.angleCase==='above5')
     assert.ok(!row.flags.some(x=>x.startsWith('FAR_')||x==='INCIDENCE_GEOMETRY_MISMATCH'),
       'Independent far-from-critical reference mismatch: '+row.id+' '+row.flags.join(','));
 }
 console.log('CRITICAL_CROSS_FAMILY '+JSON.stringify({
   status:'pass',nativeCases:records.length,
   canonicalAdditionalRuns:records.length,summary:bins,
   warning:'Exact-critical behavior is native-identity/geometry research, not physics-qualified transmission.',
   reportPath:output.report}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
