// B1a: native 2-run finite-detector measurement; NO B1b backprojection/image.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {parsePairJSON} from '../src/detector-pair-json.js';
import {planDetectorSelectedPair,pairCapabilities} from '../src/detector-pair-plan.js';
import {runDetectorPairEvidence,verifyDetectorPairManifest} from '../scripts/detector-selected-pair.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {sceneHash} from '../src/qualified-utils.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync(new URL('../examples/jee-detector-selected-native-pair-v1.json',import.meta.url)));
const q=()=>structuredClone(example);
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/b1a-native-'+randomUUID());
const native=(d,r)=>evaluateDocument(d,core,r);
const near=(a,b,tol=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,a+' != '+b);
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=async(request,execute=native)=>runDetectorPairEvidence({inputBytes:bytes(request),outputPath:fresh(),execute});
const sum=rs=>rs.map(r=>r.selection.status);
const setupInput=(p)=>{
 mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
 const filename=resolve('test-artifacts/llm-authoring/b1a-request-'+randomUUID()+'.json');
 writeFileSync(filename,bytes(p),{flag:'wx'});
 return filename;
};

test('B1a is explicitly native-hit-only with exactly one strict versioned authored apparatus',async()=>{
 const request=q(),original=structuredClone(request),p=await planDetectorSelectedPair(request);
 assert.equal(pairCapabilities().requestedResult,'native-finite-window-hits-only');
 assert.equal(p.scenes.length,2);assert.equal(p.familySha256.length,64);
 assert.equal(p.scenes[0].scene.schemaVersion,5);
 assert.equal(p.scenes[0].scene.physics.model,'planar-media-tracing');
 assert.equal(p.scenes[0].scene.upstreamCommit,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.notEqual(p.scenes[0].sceneSha256,p.scenes[1].sceneSha256);
 assert.deepEqual(p.scenes.map(r=>r.role),['run-A','run-B']);
 assert.deepEqual(p.scenes.map(r=>r.scene.physics.components.find(c=>c.id==='S1').emission.directionDeg),[-.5,.5]);
 for(const sc of p.scenes)assert.equal(await sceneHash(sc.scene),sc.sceneSha256);
 assert.deepEqual(request,original,'planning never repairs or mutates authored physical facts');
});

test('real full-Fresnel native rays give two distinct finite-window crossings, never a public image coordinate',async()=>{
 const p=q(),raw=bytes(p),output=await run(p);
 assert.equal(output.exitCode,0);
 const report=output.report;
 assert.equal(report.status,'native-hits-reported');
 assert.equal(report.nativeAttempted,2);assert.equal(report.nativeCompleted,2);
 assert.equal(report.nativeSelection.status,'available');
 assert.deepEqual(report.geometry,{status:'withheld',value:null,reasonCode:'B1B_NUMERICAL_GATE_NOT_RELEASED'});
 assert.equal(report.imageAssessment,'not-assessed');
 assert.equal(report.observerAssessment,'not-assessed');
 assert.equal(report.runs.length,2);
 assert.equal(report.inputSha256,sha(raw));
 assert.notEqual(report.runs[0].sceneSha256,report.runs[1].sceneSha256);
 const expected=[-1.5708611274685678,1.5708611274685678];
 for(let i=0;i<2;i++){
  const r=report.runs[i],values=r.observableResults;
  assert.equal(r.selection.status,'available');
  assert.equal(r.nativeStatus,'completed');
  assert.equal(r.sceneHashMatches,true);
  assert.equal(r.nativePinMatches,true);
  assert.equal(r.rawNativeWarnings.length,0);
  assert.deepEqual(values.map(x=>x.kind),['source-emissions','interface-first-event','detector-crossings','detector-hit-events']);
  assert.deepEqual(values.map(x=>x.status),['available','available','available','available']);
  assert.equal(values[0].value,1);assert.equal(values[2].value,1);
  assert.equal(values[1].value.outcome,'transmission');
  const branches=values[1].value.branches;
  assert.equal(branches.filter(b=>b.kind==='transmitted').length,1);
  assert.equal(branches.filter(b=>b.kind==='reflected').length,1);
  assert.equal(values[3].value.length,1);
  const h=values[3].value[0];
  near(h.pointMm.x,40);near(h.pointMm.y,expected[i]);
  assert.ok(Math.min(h.distanceFromP1Mm,5-h.distanceFromP1Mm)>.9);
  const u=branches.find(b=>b.kind==='transmitted').direction;
  near(h.incomingUnit.x,u.x,1e-10);near(h.incomingUnit.y,u.y,1e-10);
 }
 assert.deepEqual(readdirSync(output.output).sort(),[
  'input.json','manifest.json','native-A.json','native-B.json','plan.json',
  'readouts-A.json','readouts-B.json','report.json',
  'scene-A.ray-optics-2d.json','scene-B.ray-optics-2d.json'].sort());
 assert.deepEqual(readFileSync(resolve(output.output,'input.json')),raw);
 const verified=verifyDetectorPairManifest(output.output);
 assert.equal(verified.status,'verified-finalized-evidence');
 assert.equal(verified.report.geometry.value,null);
 const saved=JSON.parse(readFileSync(resolve(output.output,'manifest.json'),'utf8'));
 assert.equal(saved.files.length,9);assert.equal(saved.nativeAttempted,2);
 assert.ok(saved.files.every(f=>f.sha256.length===64));
 assert.ok(!JSON.stringify(report).includes('normalDepthMm'));
 console.log('[b1a-native-hit-evidence] '+JSON.stringify({
   source:'REAL_PINNED_PHYDEMO_SAMPLED_DETECTOR_EVENTS',
   inputSha256:report.inputSha256,
   nativeSelection:report.nativeSelection,
   geometry:report.geometry,
   runs:report.runs.map(row=>({
     role:row.role,sceneSha256:row.sceneSha256,nativePin:row.nativePin,
     nativeStatus:row.nativeStatus,qualification:row.selection.status,
     authoredDirectionDeg:row.authoredDirectionDeg,
     emissions:row.observableResults[0].value,
     firstNativeInterfaceEvent:row.observableResults[1].value,
     nativeCrossings:row.observableResults[2].value,
     measuredFiniteDetectorHitEvents:row.observableResults[3].value
   }))
 }));
});

test('equal media native transmissions yield actual finite hit evidence and STILL no B1b geometry',async()=>{
 for(const index of [1,1.5]){
  const p=q(),plane=p.apparatus.components.find(c=>c.id==='I1');
  plane.parameters.negativeIndex=index;plane.parameters.positiveIndex=index;
  const r=await run(p);
  assert.equal(r.exitCode,0);
  assert.equal(r.report.nativeSelection.status,'available');
  assert.equal(r.report.geometry.value,null);
  for(const [i,row] of r.report.runs.entries()){
   const v=row.observableResults;
   assert.equal(v[1].value.outcome,'transmission');
   assert.equal(v[1].value.branches.filter(b=>b.kind==='reflected').length,0);
   assert.equal(v[2].value,1);
   near(v[3].value[0].pointMm.y,[-1,1][i]*1.396298846521404);
  }
 }
});

test('2mm and 10mm physical detector-window boundaries report genuine native misses and hits',async()=>{
 for(const length of [2,10]){
  const p=q();p.apparatus.components.find(c=>c.id==='D1').parameters.length=length;
  const r=await run(p);
  assert.equal(r.report.nativeAttempted,2);assert.equal(r.report.nativeCompleted,2);
  assert.equal(r.report.geometry.value,null);
  if(length===2){
   assert.equal(r.report.status,'native-selection-unavailable');
   assert.deepEqual(r.report.runs.map(x=>x.observableResults[2].value),[0,0]);
   assert.deepEqual(r.report.runs.map(x=>x.observableResults[3].value),[[],[]]);
   assert.deepEqual(sum(r.report.runs),['unavailable','unavailable']);
  }else{
   assert.equal(r.report.status,'native-hits-reported');
   assert.deepEqual(r.report.runs.map(x=>x.observableResults[2].value),[1,1]);
   assert.ok(r.report.runs.every(x=>x.observableResults[3].value.length===1));
  }
  assert.equal(verifyDetectorPairManifest(r.output).status,'verified-finalized-evidence');
 }
});

test('an actually shifted finite detector records a measured miss while retaining the second run',async()=>{
 const p=q(),d=p.apparatus.components.find(c=>c.id==='D1');d.parameters.y=2.5;
 const r=await run(p);
 assert.equal(r.report.status,'native-selection-unavailable');assert.equal(r.exitCode,2);
 assert.equal(r.report.nativeAttempted,2);assert.equal(r.report.nativeCompleted,2);
 assert.deepEqual(r.report.runs.map(x=>x.observableResults[2].value),[0,1]);
 assert.deepEqual(r.report.runs[0].observableResults[3].value,[]);
 assert.deepEqual(sum(r.report.runs),['unavailable','available']);
 assert.equal(r.report.geometry.value,null);
 assert.equal(verifyDetectorPairManifest(r.output).status,'verified-finalized-evidence');
});

test('full Fresnel-off provenance remains qualified, never silently available or an image',async()=>{
 const p=q();p.apparatus.components.find(c=>c.id==='I1').parameters.partialReflection=false;
 const r=await run(p);
 assert.equal(r.report.status,'native-hits-reported');assert.equal(r.report.nativeSelection.status,'qualified');
 assert.deepEqual(sum(r.report.runs),['qualified','qualified']);
 for(const row of r.report.runs){
  assert.deepEqual(row.observableResults.map(v=>v.status),['qualified','qualified','qualified','qualified']);
  assert.ok(row.observableResults.every(v=>v.warnings.some(w=>/omits Fresnel/.test(w))));
  assert.equal(row.nativeStatus,'completed');assert.equal(row.rawNativeWarnings.length,0);
 }
 assert.equal(r.report.geometry.value,null);
 const shifted=q();shifted.apparatus.components.find(c=>c.id==='I1').parameters.partialReflection=false;
 shifted.apparatus.components.find(c=>c.id==='D1').parameters.y=2.5;
 const miss=await run(shifted);
 assert.equal(miss.report.status,'native-selection-unavailable');
 assert.deepEqual(sum(miss.report.runs),['unavailable','qualified']);
 assert.ok(miss.report.runs.every(x=>x.observableResults.every(v=>v.status==='qualified')));
 assert.equal(miss.report.geometry.value,null);
});

test('reverse normal, source-side reversal, units and reordered component arrays preserve native selection',async()=>{
 const variants=[
  p=>{p.apparatus.components.reverse();},
  p=>{const plane=p.apparatus.components.find(c=>c.id==='I1');
    plane.parameters.normalDeg=180;plane.parameters.negativeIndex=1;plane.parameters.positiveIndex=1.5;},
  p=>{const source=p.apparatus.components.find(c=>c.id==='S1'),
     detector=p.apparatus.components.find(c=>c.id==='D1'),
     plane=p.apparatus.components.find(c=>c.id==='I1');
     source.parameters.x=120;source.emission.directionDeg=179.5;
     p.secondDirectionDeg=-179.5;detector.parameters.x=-40;
     plane.parameters.negativeIndex=1;plane.parameters.positiveIndex=1.5;},
  p=>{p.apparatus.lengthUnit='cm';
    for(const c of p.apparatus.components){c.parameters.x/=10;c.parameters.y/=10;
      if(c.type==='ray-detector')c.parameters.length/=10;}},
  p=>{p.apparatus.lengthUnit='m';
    for(const c of p.apparatus.components){c.parameters.x/=1000;c.parameters.y/=1000;
      if(c.type==='ray-detector')c.parameters.length/=1000;}}
 ];
 for(const edit of variants){
  const p=q();edit(p);const r=await run(p);
  assert.equal(r.report.nativeAttempted,2,JSON.stringify({request:p,report:r.report}));
  assert.equal(r.report.nativeCompleted,2,JSON.stringify({request:p,report:r.report}));
  assert.equal(r.report.nativeSelection.status,'available',JSON.stringify({request:p,report:r.report}));
  assert.equal(r.report.geometry.value,null);
  assert.deepEqual(r.report.runs.map(v=>v.observableResults[2].value),[1,1]);
 }
});


test('real total internal reflection remains native evidence but never a selected receiving-side ray',async()=>{
 const p=q();p.apparatus.components.find(c=>c.id==='S1').emission.directionDeg=-50;
 p.secondDirectionDeg=50;
 const r=await run(p);
 assert.equal(r.report.nativeAttempted,2);
 assert.equal(r.report.nativeCompleted,2);
 assert.equal(r.report.nativeSelection.status,'unavailable');
 assert.equal(r.report.geometry.value,null);
 for(const row of r.report.runs){
  assert.equal(row.nativeStatus,'completed');
  assert.equal(row.selection.status,'unavailable');
  assert.equal(row.selection.reasonCode,'NO_TRANSMITTED_BRANCH');
  assert.equal(row.observableResults[0].value,1);
  assert.equal(row.observableResults[1].value.outcome,'total-internal-reflection');
  assert.equal(row.observableResults[2].value,0);
  assert.deepEqual(row.observableResults[3].value,[]);
 }
 assert.equal(verifyDetectorPairManifest(r.output).status,'verified-finalized-evidence');
});

test('strict original-byte parser rejects identical and escaped duplicate keys across nesting',()=>{
 const duplicate=[
  '{"format":"one","format":"two"}',
  '{"outer":{"angle":5,"angle":5}}',
  '{"outer":{"normalDeg":0,"normalD\\u0065g":0}}',
  '{"entries":[{"name":"a","name":"a"}]}'
 ];
 for(const raw of duplicate)
  assert.throws(()=>parsePairJSON(Buffer.from(raw)),e=>e.reasonCode==='DUPLICATE_JSON_KEY');
 assert.throws(()=>parsePairJSON(Buffer.from('{"a":1,}')),e=>e.reasonCode==='INVALID_ENVELOPE');
 assert.throws(()=>parsePairJSON(Buffer.from('{"bad":"\\u00x0"}')),e=>e.reasonCode==='INVALID_ENVELOPE');
 assert.throws(()=>parsePairJSON(Buffer.from('{"s":"unterminated}')),e=>e.reasonCode==='INVALID_ENVELOPE');
 assert.throws(()=>parsePairJSON(Buffer.from('{"x":[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]}')),
  e=>e.reasonCode==='INVALID_ENVELOPE');
});

test('missing facts, invalid nested values/unknowns, duplicate IDs and out-of-scope optics refuse with zero native calls',async()=>{
 const cases=[
  [p=>{delete p.apparatus.components[0].parameters.x;},'needs-information'],
  [p=>{delete p.apparatus.components[0].parameters.x;p.apparatus.components[2].parameters.unexpected=1;},'invalid-input'],
  [p=>{p.apparatus.components[1].parameters.negativeIndex='1.5';},'invalid-input'],
  [p=>{p.apparatus.components[2].id='S1';},'invalid-input'],
  [p=>{p.apparatus.components[0].emission.mode='full-circle';},'unavailable'],
  [p=>{p.apparatus.components[2].parameters.length=1;},'unavailable'],
  [p=>{p.apparatus.components[2].parameters.length=11;},'unavailable'],
  [p=>{p.apparatus.components[2].parameters.orientationDeg=0;},'unavailable'],
  [p=>{p.apparatus.components[2].parameters.x=-20;},'unavailable'],
  [p=>{p.apparatus.components[0].parameters.x=-.5;},'unavailable'],
  [p=>{p.apparatus.components[1].parameters.normalDeg=10;},'unavailable'],
  [p=>{p.apparatus.components.push(structuredClone(p.apparatus.components[2]));},'invalid-input'],
  [p=>{p.secondDirectionDeg=p.apparatus.components[0].emission.directionDeg;},'invalid-input'],
  [p=>{p.apparatus.components[0].emission.directionDeg=-180;p.secondDirectionDeg=180;},'invalid-input'],
  [p=>{p.apparatus.components[0].emission.directionDeg=0;p.secondDirectionDeg=1e-10;},'invalid-input'],
  [p=>{p.sourceId='wrong';},'invalid-input'],
  [p=>{p.apparatus.runPolicy='magic';},'invalid-input'],
  [p=>{p.observer={type:'eye'};},'invalid-input']
 ];
 for(const [mutate,status] of cases){
  const p=q();mutate(p);let calls=0;
  const r=await run(p,()=>{calls++;throw Error('must not execute rejected physical facts');});
  assert.equal(calls,0,JSON.stringify(p));
  assert.equal(r.report.status,status,JSON.stringify(p));
  assert.equal(r.report.nativeAttempted,0);
  assert.equal(r.report.nativeCompleted,0);
  assert.equal(r.report.geometry.value,null);
  assert.equal(r.report.runs.length,0);
  assert.ok(!existsSync(resolve(r.output,'manifest.json')));
 }
 const mismatch=q();mismatch.apparatus.components[0].emission.directionDeg=180;
 mismatch.secondDirectionDeg=-180;
 const r=await run(mismatch,()=>{throw Error('must not run');});
 assert.equal(r.report.reasonCode,'IDENTICAL_SOURCE_HEADINGS');
});

test('native zero selection and raw warning are distinct from incomplete/stale measurements',async()=>{
 const away=q();away.apparatus.components.find(c=>c.id==='S1').emission.directionDeg=180;
 away.secondDirectionDeg=0.5;
 const miss=await run(away);
 assert.equal(miss.report.nativeAttempted,2);
 assert.equal(miss.report.nativeCompleted,2);
 assert.equal(miss.report.nativeSelection.status,'unavailable');
 assert.equal(miss.report.geometry.value,null);
 let calls=0;
 const incomplete=await run(q(),(doc,requests)=>{
  calls++;const data=native(doc,requests);
  data.summary.native.status='incomplete';data.summary.executionPassed=false;
  data.summary.observations=null;
  return data;
 });
 assert.equal(calls,2);
 assert.equal(incomplete.report.status,'native-suppressed');
 assert.deepEqual(sum(incomplete.report.runs),['suppressed','suppressed']);
 assert.equal(incomplete.report.nativeAttempted,2);
 assert.equal(incomplete.report.nativeCompleted,0);
 assert.equal(incomplete.report.geometry.value,null);
 assert.equal(verifyDetectorPairManifest(incomplete.output).status,'verified-finalized-evidence');
 const warning=await run(q(),(doc,requests)=>{
  const data=native(doc,requests);data.summary.native.warnings=['SYNTHETIC_WARNING_FOR_METADATA_ONLY'];
  return data;
 });
 assert.equal(warning.report.status,'native-suppressed');
 assert.ok(warning.report.runs.every(r=>r.rawNativeWarnings.includes('SYNTHETIC_WARNING_FOR_METADATA_ONLY')));
 assert.equal(warning.report.nativeAttempted,2);
 assert.equal(warning.report.geometry.value,null);
});


test('B1a reports no native interface encounter separately from a completed finite-detector miss',async()=>{
 const away=q();away.apparatus.components.find(c=>c.id==='S1').emission.directionDeg=180;
 away.secondDirectionDeg=.5;
 const r=await run(away);
 assert.equal(r.report.nativeAttempted,2);
 assert.equal(r.report.nativeCompleted,2);
 assert.equal(r.report.runs[0].selection.status,'unavailable');
 assert.equal(r.report.runs[0].selection.reasonCode,'NO_TRANSMITTED_BRANCH');
 assert.equal(r.report.runs[0].observableResults[2].value,0);
 assert.equal(r.report.runs[1].selection.status,'available');
 assert.equal(r.report.geometry.value,null);
});

test('B1a never accepts forged transmitted directions, missing hit capture or swapped scene identities',async()=>{
 const mismatch=await run(q(),(doc,requests)=>{
  const execution=native(doc,requests);
  const observed=execution.summary.observations.interfacesById.I1.first;
  observed.branches.find(b=>b.kind==='transmitted').direction.y+=.05;
  return execution;
 });
 assert.equal(mismatch.report.nativeAttempted,2);
 assert.equal(mismatch.report.nativeCompleted,2);
 assert.equal(mismatch.report.status,'native-selection-unavailable');
 assert.ok(mismatch.report.runs.every(r=>r.selection.reasonCode==='INCONSISTENT_NATIVE_BRANCH'));
 assert.equal(mismatch.report.geometry.value,null);
 const absent=await run(q(),doc=>native(doc,[]));
 assert.equal(absent.report.nativeAttempted,2);
 assert.equal(absent.report.status,'native-selection-unavailable');
 assert.ok(absent.report.runs.every(r=>r.selection.reasonCode==='MISSING_NATIVE_HIT_CAPTURE'));
 assert.ok(absent.report.runs.every(r=>r.observableResults[3].status==='unavailable'));
 assert.equal(absent.report.geometry.value,null);
 const swapped=await run(q(),(doc,requests)=>{
  const changed=structuredClone(doc);
  changed.physics.components.find(c=>c.id==='S1').emission.directionDeg+=.1;
  return native(changed,requests);
 });
 assert.equal(swapped.report.nativeAttempted,1);
 assert.equal(swapped.report.reasonCode,'STALE_EXECUTION_SHA');
 assert.equal(swapped.report.geometry.value,null);
});

test('stale native scene hashes suppress selection and stop at the actual first attempt',async()=>{
 const r=await run(q(),(doc,requests)=>{
  const changed=structuredClone(doc);
  changed.physics.components.find(c=>c.id==='S1').emission.directionDeg=1;
  return native(changed,requests);
 });
 assert.equal(r.report.nativeAttempted,1);
 assert.equal(r.report.nativeCompleted,0);
 assert.equal(r.report.status,'native-suppressed');
 assert.equal(r.report.reasonCode,'STALE_EXECUTION_SHA');
 assert.equal(r.report.runs[0].selection.status,'suppressed');
 assert.equal(r.report.geometry.value,null);
 assert.ok(!existsSync(resolve(r.output,'manifest.json')));
});

test('first and second executor failures retain genuine 0/1 completed results without success manifest',async()=>{
 for(const failAt of [1,2]){
  let calls=0;
  const r=await run(q(),(doc,requests)=>{
   calls++;
   if(calls===failAt)throw Error('simulated executor failure');
   return native(doc,requests);
  });
  assert.equal(r.exitCode,2);
  assert.equal(r.report.status,'infrastructure-error');
  assert.equal(r.report.reasonCode,'NATIVE_EXECUTOR_FAILURE');
  assert.equal(r.report.nativeAttempted,failAt);
  assert.equal(r.report.nativeCompleted,failAt-1);
  assert.equal(r.report.runs.length,failAt-1);
  assert.equal(r.report.geometry.value,null);
  assert.equal(existsSync(resolve(r.output,'native-A.json')),failAt===2);
  assert.equal(existsSync(resolve(r.output,'native-B.json')),false);
  assert.ok(!existsSync(resolve(r.output,'manifest.json')));
 }
});

test('manifest detects tampering and unfinished output cannot be reopened as verified',async()=>{
 const r=await run(q());
 assert.equal(verifyDetectorPairManifest(r.output).status,'verified-finalized-evidence');
 const filename=resolve(r.output,'native-A.json');
 const text=readFileSync(filename,'utf8');
 writeFileSync(filename,text+'\n'); // Even whitespace-only file changes break the manifest SHA.
 assert.throws(()=>verifyDetectorPairManifest(r.output),/Tampered|inconsistent/);
 const fail=await run(q(),()=>{throw Error('no native');});
 assert.throws(()=>verifyDetectorPairManifest(fail.output));
});


test('finalized B1a manifest cannot omit a run file or have altered run associations',async()=>{
 const r=await run(q());
 const path=resolve(r.output,'manifest.json');
 const original=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(original.files.length,9);
 const withoutB=structuredClone(original);
 withoutB.files=withoutB.files.filter(f=>f.path!=='native-B.json');
 writeFileSync(path,JSON.stringify(withoutB,null,2)+'\n');
 assert.throws(()=>verifyDetectorPairManifest(r.output),/both actual run records/);
});

test('async request mutation cannot change frozen original bytes or the two native runs',async()=>{
 const input=q(),raw=bytes(input),before=Buffer.from(raw),out=fresh();
 let entered;const inside=new Promise(resolve=>{entered=resolve;});
 let release;const pause=new Promise(resolve=>{release=resolve;});
 let calls=0;
 const task=runDetectorPairEvidence({inputBytes:raw,outputPath:out,
  execute:async (doc,requests)=>{
   calls++;
   if(calls===1){entered();await pause;}
   return native(doc,requests);
  }});
 await inside;
 raw.fill(0);input.apparatus.components[0].parameters.x=0;
 release();
 const result=await task;
 assert.equal(result.exitCode,0);
 assert.equal(calls,2);
 assert.deepEqual(readFileSync(resolve(result.output,'input.json')),before);
 assert.equal(result.report.inputSha256,sha(before));
 assert.equal(result.report.nativeSelection.status,'available');
 assert.equal(verifyDetectorPairManifest(result.output).status,'verified-finalized-evidence');
});

test('public standalone CLI performs real native execution and writes a finalized hash-linked report',()=>{
 const file=setupInput(q()),out=fresh();
 let r;
 try{r=spawnSync(process.execPath,['scripts/detector-selected-pair.mjs',file,'--out',out],{encoding:'utf8',timeout:90000});}
 finally{rmSync(file);}
 assert.equal(r.status,0,r.stderr);
 const response=JSON.parse(r.stdout);
 assert.equal(response.status,'native-hits-reported');
 assert.equal(response.nativeAttempted,2);assert.equal(response.nativeCompleted,2);
 assert.equal(response.geometry.value,null);
 const verified=verifyDetectorPairManifest(out);
 assert.equal(verified.report.nativeSelection.status,'available');
 const cap=spawnSync(process.execPath,['scripts/detector-selected-pair.mjs','capabilities'],{encoding:'utf8'});
 assert.equal(cap.status,0);
 assert.equal(JSON.parse(cap.stdout).requestedResult,'native-finite-window-hits-only');
});
