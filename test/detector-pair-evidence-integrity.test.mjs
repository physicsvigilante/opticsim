// B1a independent-review R1 P1: semantic manifest checks, not just file hashes.
// All native test data are genuine pinned PhyDemo unless marked INJECTED.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runDetectorPairEvidence,verifyDetectorPairManifest} from '../scripts/detector-selected-pair.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const input=JSON.parse(readFileSync(new URL('../examples/jee-detector-selected-native-pair-v1.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const request=()=>structuredClone(input);
const root=()=>resolve('test-artifacts/llm-authoring/b1a-r2-review-'+randomUUID());
const execute=(doc,reqs)=>evaluateDocument(doc,core,reqs);
const run=(p=request())=>runDetectorPairEvidence({
  inputBytes:Buffer.from(JSON.stringify(p,null,2)+'\n'),outputPath:root(),execute});
const rewrite=(dir,name,mutation)=>{
  const file=resolve(dir,name),object=JSON.parse(readFileSync(file,'utf8'));
  mutation(object);
  const bytes=Buffer.from(JSON.stringify(object,null,2)+'\n');
  writeFileSync(file,bytes);
  const manifestPath=resolve(dir,'manifest.json');
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const entry=manifest.files.find(x=>x.path===name);
  assert.ok(entry,'Expected existing manifest artifact');
  entry.sha256=sha(bytes);entry.bytes=bytes.length;
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
};
const swapAndRehash=(dir,source,target)=>{
  const payload=readFileSync(resolve(dir,source));
  const manifestPath=resolve(dir,'manifest.json');
  writeFileSync(resolve(dir,target),payload);
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const entry=manifest.files.find(x=>x.path===target);
  assert.ok(entry);
  entry.sha256=sha(payload);entry.bytes=payload.length;
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
};

test('R2 P1: swap native-B into native-A and rehash the manifest: semantic verifier MUST reject',async()=>{
  const r=await run();
  assert.equal((await verifyDetectorPairManifest(r.output)).status,'verified-finalized-evidence');
  swapAndRehash(r.output,'native-B.json','native-A.json');
  await assert.rejects(()=>verifyDetectorPairManifest(r.output),
    /identity mismatch.*native-A.*(different scene|role|pin)/i);
});
test('R2 P1: swap readouts-B into readouts-A and rehash the manifest: semantic verifier MUST reject',async()=>{
  const r=await run();
  assert.equal((await verifyDetectorPairManifest(r.output)).status,'verified-finalized-evidence');
  swapAndRehash(r.output,'readouts-B.json','readouts-A.json');
  await assert.rejects(()=>verifyDetectorPairManifest(r.output),
    /identity mismatch.*readouts-A/i);
});
test('R2 P1: rehash a modified native observation or a falsely relabelled readout, still reject',async()=>{
  for(const target of ['native-A.json','readouts-A.json']){
    const r=await run();
    rewrite(r.output,target,data=>{
      if(target.startsWith('native'))
        data.summary.observations.detectorsById.D1.crossings=1234;
      else data.observableResults.find(x=>x.kind==='detector-crossings').value=1234;
    });
    await assert.rejects(()=>verifyDetectorPairManifest(r.output),/identity mismatch/i);
  }
});
test('R2 P2: pre-native build/setup failure reports zero native attempts with no false manifest',async()=>{
  const r=await runDetectorPairEvidence({
    inputBytes:Buffer.from(JSON.stringify(request())),
    outputPath:root(),
    prepareNative:()=>{throw Error('SYNTHETIC_SETUP_FAILURE_NOT_PHYDEMO');}
  });
  assert.equal(r.report.status,'infrastructure-error');
  assert.equal(r.report.reasonCode,'NATIVE_SETUP_FAILED');
  assert.equal(r.report.nativeAttempted,0);
  assert.equal(r.report.nativeCompleted,0);
  assert.deepEqual(r.report.runs,[]);
  assert.equal(r.report.geometry.value,null);
  assert.ok(!existsSync(resolve(r.output,'native-A.json')));
  assert.ok(!existsSync(resolve(r.output,'manifest.json')));
  await assert.rejects(()=>verifyDetectorPairManifest(r.output));
});
test('R2 P2: every negative native observable retains warnings array and a reasonCode field',async()=>{
  const p=request();
  p.apparatus.components.find(x=>x.id==='S1').emission.directionDeg=180;
  p.secondDirectionDeg=.5;
  const r=await run(p);
  assert.equal(r.report.nativeAttempted,2);
  assert.equal(r.report.nativeCompleted,2);
  assert.equal(r.report.status,'native-selection-unavailable');
  assert.equal(r.report.geometry.value,null);
  for(const row of r.report.runs)
    for(const result of row.observableResults){
      assert.ok(Array.isArray(result.warnings));
      assert.ok(Object.hasOwn(result,'reasonCode'));
      assert.ok(Object.hasOwn(result,'reason'));
      assert.ok(Object.hasOwn(result,'method'));
      if(['suppressed','unavailable'].includes(result.status))
        assert.ok(result.reasonCode);
    }
  assert.equal((await verifyDetectorPairManifest(r.output)).status,'verified-finalized-evidence');
});
test('R2 P3: noncardinal normal and real finite detector orientation preserve actual sampled rays',async()=>{
  const p=request(),a=37*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const source=p.apparatus.components.find(x=>x.id==='S1');
  const plane=p.apparatus.components.find(x=>x.id==='I1');
  const detector=p.apparatus.components.find(x=>x.id==='D1');
  source.parameters.x=-120*c;source.parameters.y=-120*s;
  source.emission.directionDeg=36.5;p.secondDirectionDeg=37.5;
  plane.parameters.normalDeg=37;
  detector.parameters.x=40*c;detector.parameters.y=40*s;
  detector.parameters.orientationDeg=127;
  const r=await run(p);
  assert.equal(r.report.status,'native-hits-reported');
  assert.equal(r.report.nativeCompleted,2);
  assert.equal(r.report.geometry.value,null);
  for(const [i,row] of r.report.runs.entries()){
    assert.equal(row.schemaVersion,5);
    assert.equal(row.selection.status,'available');
    const event=row.observableResults.find(v=>v.kind==='detector-hit-events');
    assert.equal(event.value.length,1);
    const hit=event.value[0],t=[-1,1][i]*1.5708611274685678;
    assert.ok(Math.abs(hit.pointMm.x-(40*c-t*s))<1e-5);
    assert.ok(Math.abs(hit.pointMm.y-(40*s+t*c))<1e-5);
  }
  assert.equal((await verifyDetectorPairManifest(r.output)).status,'verified-finalized-evidence');
});
test('R2 test-injection seam is explicitly not native-authoritative',async()=>{
  const r=await run();
  assert.equal(r.report.executorProvenance,'test-injected-untrusted');
  const checked=await verifyDetectorPairManifest(r.output);
  assert.equal(checked.authority,'test-injected-non-authoritative');
  assert.equal(checked.report.geometry.value,null);
});
