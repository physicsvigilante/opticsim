import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {auditRecordedFiniteHit,FINITE_HIT_CAP} from '../src/finite-hit-exact.js';
import {createNativeFiniteHitDiagnostic,supportsFiniteHitDiagnostic,
  FINITE_DIAGNOSTIC_METHOD} from '../src/native-finite-hit-diagnostic.js';
import {polygonFaces} from '../src/polygon-dielectric.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {evidencePanelView} from '../src/evidence-panel.js';
import {resultCoverage} from '../src/problem-workflow.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/polygon-dielectric.json',import.meta.url)));
const input=()=>structuredClone(fixture.physical);
const doc=(edit=()=>{})=>{const x=input();edit(x);return prepareScene(x).document;};
const req=[{id:'finite-risk',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
const compare=(a,b)=>{
 assert.deepEqual(a.summary.native,b.summary.native);
 for(const k of NATIVE_OBSERVATION_KEYS)assert.deepEqual(a.summary.observations?.[k],
  b.summary.observations?.[k],k);
 assert.equal(a.summary.executionPassed,b.summary.executionPassed);
};
const face=polygonFaces([{x:-10,y:-10},{x:10,y:-10},{x:10,y:10},{x:-10,y:10}]);
const sample=(origin={x:0,y:-5},toward={x:1,y:-5},hit={x:10,y:-5})=>
 ({p1:origin,p2:toward,incident:hit});
const ref=(s)=>auditRecordedFiniteHit(s,face,1e-12);

test('strict exact dyadic geometry: genuinely forward finite hit with exact native point is a narrow check',()=>{
 const good=ref(sample());
 assert.equal(good.status,'checked');assert.equal(good.reasonCode,'EXACT_BINARY64_FINITE_FORWARD_AND_POINT_MATCH');
 assert.equal(ref(sample({x:11,y:-5},{x:12,y:-5})).status,'inconsistent');
 assert.equal(ref(sample({x:10,y:-5},{x:11,y:-5})).status,'inconsistent');
 assert.equal(ref(sample({x:10-0.5e-6,y:-5},{x:10,y:-5})).status,'inconsistent');
 assert.equal(ref(sample({x:10-2e-6,y:-5},{x:10,y:-5})).status,'checked',
   'Legitimate near-cutoff positive forward step must not be rejected');
});
test('reported native incident point must agree with independent exact crossing, not just supporting face',()=>{
 const wrong=ref(sample(undefined,undefined,{x:10,y:-7}));
 assert.deepEqual(wrong,{status:'unknown',reasonCode:'NATIVE_INCIDENT_POINT_AGREEMENT_UNBOUNDED'});
 const outside=ref(sample({x:0,y:-20},{x:1,y:-20},{x:10,y:-5}));
 assert.equal(outside.status,'inconsistent');
 assert.equal(outside.reasonCode,'EXACT_INTERSECTION_OUTSIDE_FINITE_EDGE');
 for(const near of [sample({x:0,y:0},{x:1,y:0},{x:10,y:0}),
   sample({x:0,y:-10},{x:1,y:-10},{x:10,y:-10}),
   sample({x:0,y:-5},{x:0,y:-4},{x:10,y:-5})]){
   assert.equal(ref(near).status,'unknown');
 }
 // If we have no justified point-error envelope, a harmless sub-ulp
 // discrepancy is UNKNOWN, not a false claim of numerical inconsistency.
 const small=ref(sample(undefined,undefined,{x:10,y:-5+Number.EPSILON*8}));
 assert.equal(small.status,'unknown');
});
test('same no-opt-in native scene and public outputs remain unchanged',async()=>{
 const scene=doc(),text=serializeSave(scene),old=evaluateDocument(scene,core);
 const withDiagnostic=evaluateDocument(scene,core,req);
 assert.equal(withDiagnostic.summary.native.status,'completed');
 assert.equal(serializeSave(scene),text);
 compare(old,withDiagnostic);
 assert.deepEqual(Object.keys(old.summary.observations),NATIVE_OBSERVATION_KEYS);
 assert.equal(old.report.native.diagnostics.finiteHitDiagnostic,undefined);
 assert.ok(withDiagnostic.report.native.diagnostics.finiteHitDiagnostic);
 const actual=withDiagnostic.summary.observations.finiteHitDiagnostic;
 assert.equal(actual.method,FINITE_DIAGNOSTIC_METHOD);
 assert.equal(actual.observedGlassIncidents,2);
 assert.ok(['checked','unknown'].includes(actual.status),JSON.stringify(actual));
 const results=await evaluateObservables(scene,req,withDiagnostic.summary);
 const r=results.results[0];assert.equal(r.status,'advisory');
 assert.equal(r.value.status,actual.status);
 assert.match(r.limitation,/Does NOT change canonical native/);
 assert.match(formatRequestedResult(r),/NOT A VERIFIED OPTICAL MEASUREMENT/);
 assert.equal(resultCoverage(results.results).available,0,'Diagnostic is not an answered optical quantity');
 assert.equal(resultCoverage(results.results).requested,1);
 const ev=evidencePanelView({doc:scene,requests:req,state:'completed',phase:'ready',results:results.results});
 assert.match(ev.summary,/NONCERTIFYING native diagnostic/);
 assert.match(ev.resultLimits,/does NOT certify/);
});
test('explicit advisory request cannot upgrade existing native detector and interface values',async()=>{
 const scene=doc(),extras=[{id:'detector',kind:'detector-crossings',componentId:'D1'},
  {id:'glass',kind:'interface-interactions',componentId:'G1'}];
 const ordinary=evaluateDocument(scene,core,extras),together=evaluateDocument(scene,core,[...req,...extras]);
 compare(ordinary,together);
 const old=(await evaluateObservables(scene,extras,ordinary.summary)).results;
 const withMore=(await evaluateObservables(scene,[...req,...extras],together.summary)).results;
 assert.deepEqual(withMore.slice(1),old);
 assert.equal(withMore[0].status,'advisory');
});
test('unsupported v5 planar scope is refused, with no diagnostic code installed',async()=>{
 const scene=JSON.parse(readFileSync(new URL('../scenes/planar-refraction.json',import.meta.url)));
 assert.equal(supportsFiniteHitDiagnostic(scene),false);
 const out=evaluateDocument(scene,core,req);
 assert.equal(out.report.native.diagnostics?.finiteHitDiagnostic,undefined);
 const results=await evaluateObservables(scene,req,out.summary);
 assert.ok(results.results[0].status==='unavailable'||results.results[0].status==='suppressed');
});
test('real complete zero-hit source remains diagnostically checked only with positive emission coverage',async()=>{
 const scene=doc(i=>{const s=i.components.find(c=>c.type==='point-source');s.parameters.y=30;});
 const out=evaluateDocument(scene,core,req);
 assert.equal(out.summary.native.status,'completed');
 const a=out.summary.observations.finiteHitDiagnostic;
 assert.equal(a.status,'checked-no-hit');assert.equal(a.observedGlassIncidents,0);
 assert.equal((await evaluateObservables(scene,req,out.summary)).results[0].status,'advisory');
});

function ledgerFixture({twoSources=false,twoDetectors=false}={}){
 const scene=doc(i=>{
  if(twoSources)i.components.push({...structuredClone(i.components[0]),id:'S2',
    parameters:{...i.components[0].parameters,y:2}});
  if(twoDetectors)i.components.push({...structuredClone(i.components.find(c=>c.type==='ray-detector')),
    id:'D2',parameters:{...i.components.find(c=>c.type==='ray-detector').parameters,x:30}});
 });
 const loaded=core.loadDocument(scene),ledger=createNativeFiniteHitDiagnostic(scene,loaded.scene,loaded.idMap,['G1']);
 assert.ok(ledger);
 return {scene,loaded,ledger};
}
function registerAll({scene,loaded,ledger},{skip=null}={}){
 for(const c of scene.physics.components){
   if(c.id===skip)continue;
   const obj=loaded.scene.objs[loaded.idMap.get(c.id)],method=c.type==='point-source'?
     'onSimulationStart':'onRayIncident';
   ledger.register(c.id,c.type,obj,obj[method],method);
 }
}
function fakeFinish({scene,loaded,ledger},extra={}){
 const bySource=Object.fromEntries(scene.physics.components.filter(c=>c.type==='point-source').map(c=>[c.id,{emitted:1}]));
 const byDetector=Object.fromEntries(scene.physics.components.filter(c=>c.type==='ray-detector').map(c=>[c.id,{crossings:0,signedPower:0}]));
 return ledger.finish({event:'simulationComplete',scene:loaded.scene,
  simulator:{totalTruncation:0,totalUndefinedBehavior:0,constructor:{MIN_RAY_SEGMENT_LENGTH_SQUARED:1e-12}},
  errors:[],warnings:[],sources:{byId:bySource},detectors:{byId:byDetector},
  interfaces:{byId:{G1:{interactions:0}}},...extra});
}
test('B5: zero-hit but missed source-start/Glass/detector ownership fails closed',()=>{
 for(const skip of ['S1','G1','D1']){
   const x=ledgerFixture();registerAll(x,{skip});
   if(skip!=='S1')x.ledger.sourceStarted('S1',{newRays:[{p1:{},p2:{}}]});
   const output=fakeFinish(x);
   assert.equal(output.status,'unknown');assert.equal(output.reasonCode,'NATIVE_CALLBACK_COVERAGE_UNAVAILABLE');
 }
 for(const f of ['missing-start','duplicate-start','bad-rays','replaced-handler']){
   const x=ledgerFixture();registerAll(x);
   if(f==='duplicate-start'){
     x.ledger.sourceStarted('S1',{newRays:[{}]});
     x.ledger.sourceStarted('S1',{newRays:[{}]});
   }else if(f==='bad-rays')x.ledger.sourceStarted('S1',{newRays:[]});
   else if(f==='replaced-handler'){
     x.ledger.sourceStarted('S1',{newRays:[{}]});
     x.loaded.scene.objs[x.loaded.idMap.get('G1')].onRayIncident=()=>({});
   }
   const output=fakeFinish(x);
   assert.equal(output.status,'unknown',f);
 }
});
test('B4: 128 is ONLY a diagnostic availability cap; 129 callbacks must not leak a clean result',()=>{
 assert.equal(FINITE_HIT_CAP,128);
 for(const n of [128,129]){
   const x=ledgerFixture();registerAll(x);x.ledger.sourceStarted('S1',{newRays:[{}]});
   for(let i=0;i<n;i++)x.ledger.beforeIncident('G1',
     {p1:{x:-200,y:-10},p2:{x:0,y:-10}}, {x:0,y:-10});
   const output=fakeFinish(x,{interfaces:{byId:{G1:{interactions:n}}}});
   assert.equal(output.observedGlassIncidents,n);
   if(n===129){assert.equal(output.status,'unknown');assert.equal(output.reasonCode,'FINITE_HIT_DIAGNOSTIC_CAP_EXCEEDED');}
   else assert.ok(['checked','unknown'].includes(output.status));
   assert.equal(output.advisory,true);assert.equal(output.nativeMeasurementQualificationUnchanged,true);
 }
});
test('native incomplete/stopped, warnings and malformed observer cannot be promoted to a clean finite-hit advisory',()=>{
 for(const config of [{event:'simulationStop'}, {errors:['failure']},
    {simulator:{totalTruncation:.01,totalUndefinedBehavior:0}}, {warnings:['native warning']}]){
   const x=ledgerFixture();registerAll(x);x.ledger.sourceStarted('S1',{newRays:[{}]});
   const ans=fakeFinish(x,config);
   if(config.warnings)assert.equal(ans.status,'unknown');
   else assert.equal(ans.status,'suppressed');
 }
 const x=ledgerFixture();registerAll(x);x.ledger.sourceStarted('S1',{newRays:[{}]});
 x.ledger.beforeIncident('G1',{get p1(){throw Error('fault injected');},p2:{}},{});
 assert.equal(fakeFinish(x,{interfaces:{byId:{G1:{interactions:1}}}}).status,'unknown');
});
test('single original native delegation and existing readouts survive optional source/glass/detector instrumentation',()=>{
 const scene=doc(),loaded=core.loadDocument(scene),ledger=createNativeFiniteHitDiagnostic(scene,loaded.scene,loaded.idMap,['G1']);
 const source=core.observeSourceSet(scene,loaded.scene,loaded.idMap,{finiteDiagnostic:ledger});
 const det=core.observeDetectorSet(scene,loaded.scene,loaded.idMap,{finiteDiagnostic:ledger});
 const glass=core.observeInterfaceSet(scene,loaded.scene,loaded.idMap,{finiteDiagnostic:ledger});
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,scene.simulation.processedRayLimit);
 let diagnostics=null;
 sim.on('simulationComplete',()=>diagnostics=core.diagnostics(loaded.scene,sim,source,null,det,glass,null,
   {nativeEvent:'simulationComplete',finiteDiagnostic:ledger}));
 sim.updateSimulation();
 assert.ok(diagnostics);assert.ok(diagnostics.finiteHitDiagnostic);
 assert.equal(diagnostics.finiteHitDiagnostic.observedGlassIncidents,
   diagnostics.interfacesById.G1.interactions);
 const noAudit=evaluateDocument(scene,core).report.native.diagnostics;
 assert.equal(diagnostics.processed,noAudit.processed);
 assert.deepEqual(diagnostics.detectorsById,noAudit.detectorsById);
 assert.deepEqual(diagnostics.interfacesById,noAudit.interfacesById);
});
test('an unrequested diagnostic is absent from native observations and source snapshots',()=>{
 assert.equal(snapshotNativeObservations({finiteHitDiagnostic:{status:'inconsistent'}},[]).finiteHitDiagnostic,undefined);
 assert.equal(snapshotNativeObservations({finiteHitDiagnostic:{status:'inconsistent'}},req).finiteHitDiagnostic.status,'inconsistent');
});
