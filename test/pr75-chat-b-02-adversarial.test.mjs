// Chat B second review, independent adversarial tests ONLY.
// Base: Opticsim PR75 head f4fddec213e04d733920399dc0eeea0b29a60dac.
// Physical scenes are built from supported fixtures and native core.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {validate,mirrorEndpoints,serializeSave} from '../src/contract.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const requests=ids=>ids.flatMap(id=>[
 {id:id+'-hits',kind:'detector-hit-events',componentId:id},
 {id:id+'-count',kind:'detector-crossings',componentId:id}]);
const sha=s=>createHash('sha256').update(s).digest('hex');
const close=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,String(a)+' != '+String(b));
const evaluate=async(doc,req)=>{
 validate(doc);
 const sourceSha256=sha(serializeSave(doc));
 const execution=evaluateDocument(doc,core,req);
 const readings=(await evaluateObservables(doc,req,execution.summary)).results;
 return {sourceSha256,execution,readings};
};
const endpoint=(gap,angle=90)=>{
 const d=read('./fixtures/detector-hit-plate.json');
 d.physics.components.find(c=>c.id==='S1').emission.directionDeg=0;
 d.physics.components.find(c=>c.id==='Dhit').parameters={
  x:-120,y:angle===90?105-gap:95+gap,orientationDeg:angle,length:10};
 d.presentation.title='Chat B endpoint '+gap+' angle '+angle;
 return d;
};
const req=requests(['Dhit']);

test('B02-A1 native endpoint crossing: 0.009 excluded; 0.011 accepted with orientation reversal',async()=>{
 const powers=[];
 for(const [gap,angle,accept] of [[.009,90,false],[.011,90,true],[.011,-90,true]]){
  const doc=endpoint(gap,angle),{sourceSha256,execution,readings}=await evaluate(doc,req);
  const [hits,count]=readings, native=execution.summary.native;
  const raw=execution.summary.observations?.detectorHitEventsById?.Dhit;
  const power=execution.summary.observations?.detectorsById?.Dhit?.signedPower;
  console.log('CHAT_B_02_A1 '+JSON.stringify({sourceSha256,doc,native:native.status,count:count.value,power,
   hitsStatus:hits.status,hits:hits.value,raw}));
  assert.equal(native.status,'completed');assert.equal(execution.summary.executionPassed,true);
  assert.equal(count.value,1,'real native detector crossing even if position is withheld');
  assert.equal(raw.observedCount,1);
  assert.ok(['available','qualified'].includes(count.status));
  if(!accept){
   assert.equal(hits.status,'unavailable');assert.equal(hits.value,null);
   assert.equal(raw.reasonCode,'AMBIGUOUS_DETECTOR_HIT');assert.equal(raw.events,null);
  }else{
   assert.ok(['available','qualified'].includes(hits.status));assert.equal(hits.value.length,1);
   assert.equal(raw.status,'complete');assert.equal(raw.reasonCode,null);
   const e=hits.value[0],p=mirrorEndpoints(doc.physics.components.find(c=>c.id==='Dhit').parameters);
   close(e.pointMm.x,-120);close(e.pointMm.y,100);
   close(e.distanceFromP1Mm,gap,2e-7);
   close(Math.hypot(e.incomingUnit.x,e.incomingUnit.y),1);
   close(e.incomingUnit.x,1);close(e.incomingUnit.y,0);
   close(Math.hypot(e.pointMm.x-p[0].x,e.pointMm.y-p[0].y),gap,2e-7);
   assert.deepEqual(Object.keys(e).sort(),['distanceFromP1Mm','incomingUnit','pointMm']);
  }
  powers.push(power);
 }
 assert.ok(Number.isFinite(powers[1])&&powers[1]!==0);
 close(powers[1],-powers[2],1e-9);
});

test('B02-A2 two disjoint detectors: overflow does not poison separate bounded list',async()=>{
 const d=read('../scenes/general-source-detector.json');
 d.presentation.title='Chat B independent dual-detector overflow';
 d.simulation.rayDensity=1;
 const s=d.physics.components.find(c=>c.id==='S1');
 d.physics.components.push({...structuredClone(s),id:'S2',parameters:{...s.parameters,y:40}});
 d.physics.components.push({id:'D2',type:'ray-detector',
  parameters:{x:240,y:20,orientationDeg:90,length:40}});
 const r=requests(['D1','D2']);
 const {sourceSha256,execution,readings}=await evaluate(d,r);
 const legacy=evaluateDocument(d,core);
 const byId=execution.summary.observations?.detectorsById;
 const raw=execution.summary.observations?.detectorHitEventsById;
 console.log('CHAT_B_02_A2 '+JSON.stringify({sourceSha256,doc:d,
  native:execution.summary.native.status,legacy:legacy.summary.native.status,
  byId,raw,readings}));
 assert.equal(execution.summary.native.status,'completed');
 assert.equal(execution.summary.executionPassed,true);
 assert.equal(legacy.summary.native.status,'completed');
 assert.deepEqual(byId,legacy.summary.observations.detectorsById);
 const [wideHits,wideCount,narrowHits,narrowCount]=readings;
 assert.ok(wideCount.value>32,'wide native crossing count must exceed cap');
 assert.ok(narrowCount.value>0&&narrowCount.value<=32,'narrow detector must have nonzero bounded native hits');
 assert.equal(raw.D1.observedCount,wideCount.value);assert.equal(raw.D2.observedCount,narrowCount.value);
 assert.equal(wideHits.status,'unavailable');assert.equal(wideHits.value,null);
 assert.equal(raw.D1.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');assert.equal(raw.D1.events,null);
 assert.ok(['available','qualified'].includes(narrowHits.status));
 assert.equal(narrowHits.value.length,narrowCount.value);
 assert.equal(raw.D2.status,'complete');assert.equal(raw.D2.reasonCode,null);
 assert.ok(narrowHits.value.every(e=>Math.abs(e.pointMm.x-240)<1e-7&&e.pointMm.y>0&&e.pointMm.y<40));
 assert.ok(!JSON.stringify(narrowHits.value).includes('sourceId'));
});

test('B02-A3 native physical revision suppresses earlier observations and delayed callback',async()=>{
 const a=endpoint(.011),b=endpoint(.011);b.physics.components.find(c=>c.id==='Dhit').parameters.x=-121;
 const first=await evaluate(a,req),second=await evaluate(b,req);
 console.log('CHAT_B_02_A3 '+JSON.stringify({baselineSha:first.sourceSha256,updatedSha:second.sourceSha256,
  baseline:first.readings,updated:second.readings}));
 assert.notEqual(first.sourceSha256,second.sourceSha256);
 assert.equal(first.execution.summary.native.status,'completed');
 assert.equal(second.execution.summary.native.status,'completed');
 assert.equal(first.readings[1].value,1);assert.equal(second.readings[1].value,1);
 close(first.readings[0].value[0].pointMm.x,-120);
 close(second.readings[0].value[0].pointMm.x,-121);
 const stale=(await evaluateObservables(b,req,first.execution.summary)).results;
 assert.ok(stale.every(r=>r.status==='suppressed'&&r.value===null));
 // Controlled delayed Session callbacks below reuse two real native diagnostics.
 // These delayed notifications are not a new native trace.
 const callbacks=[];
 const session=new core.Session(()=>({cancel(){},run(fn){callbacks.push(fn);}}),()=>{},()=>({kind:'unavailable'}));
 assert.equal(session.apply(a),true);assert.equal(session.state,'running');
 assert.equal(session.apply(b),true);assert.equal(session.state,'running');
 callbacks[0]('simulationComplete',first.execution.report.native.diagnostics);
 assert.equal(session.state,'running');assert.equal(session.data,null);
 callbacks[1]('simulationComplete',second.execution.report.native.diagnostics);
 assert.ok(['completed','completed-with-warnings'].includes(session.state));
 close(session.data.detectorHitEventsById.Dhit.events[0].pointMm.x,-121);
 console.log('CHAT_B_02_A3_RACE '+JSON.stringify({oldCallbackIgnored:true,newState:session.state,
  accepted:session.data.detectorHitEventsById.Dhit.events[0],staleStatuses:stale.map(r=>r.status)}));
});
