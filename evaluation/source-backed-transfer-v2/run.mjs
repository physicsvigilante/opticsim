// Current-main transfer replay: execute the exact frozen request bytes and report
// distinct supported, partial, refused and hypothetical cases. Never repair inputs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {REQUESTS} from './frozen-inputs.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const rel='test-artifacts/llm-authoring/source-backed-transfer-v2';
const out=resolve(root,rel);
const hash=b=>createHash('sha256').update(b).digest('hex');
const close=(a,b,epsilon=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<epsilon,'Physical residual '+a+' vs '+b);
const assumptions={
  T1:{status:'none-available',available:0,native:'not-run'},
  T2:{status:'none-available',available:0,native:'not-run'},
  T3:{status:'partially-available',available:1,native:'not-run'},
  T4:{status:'all-requested-quantities-available',available:1,native:'not-run'},
  T5:{status:'none-available',available:0,native:'not-run'},
  T6:{status:'none-available',available:0,native:'not-run'},
  C1R2:{status:'all-requested-quantities-available',available:3,native:'completed'},
  C2R:{status:'all-requested-quantities-available',available:3,native:'completed'}
};
const print=(id,report)=>({id,status:report.status,requested:report.coverage?.requested??null,available:report.coverage?.available??null,
  nativeStatus:report.native?.status??null,nativeCalls:report.dispatch?.nativeCalls??null,
  results:report.results.map(r=>({id:r.id,kind:r.kind,status:r.status,code:r.reasonCode??null,
    value:typeof r.value==='number'?r.value:null,branches:r.branches?.map(b=>({id:b.id,status:b.status,exitAngleDeg:b.value?.exitAngleDeg??null}))??null})),
  portable:report.portable?.status??null});
async function main(){
  if(!process.version.startsWith('v24.19.0'))throw Error('This is a supported-version replay: require exactly Node 24.19.0; observed '+process.version);
  mkdirSync(out,{recursive:true});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  // The PUBLIC runProblemEvidence entry point owns routing, qualification and
  // evidence writes. The injected executor reuses exactly its ordinary checker
  // and this same freshly built native core, avoiding redundant webpack builds.
  const native=(scene,requests)=>evaluateDocument(scene,core,requests);
  const trial={format:'opticsim-source-backed-transfer-current-main-v2',baseline:'00e6211d6d40c0db8c62910f9e57b910b6aeb6f5',
    githubCheckout:process.env.GITHUB_SHA??null,githubRunId:process.env.GITHUB_RUN_ID??null,node:process.version,
    originalArchiveSha256:'03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939',
    selectionSha256:'e26b38854d0bf2bddf3dbf22d6bcd40bce41e5f3413813289ff0a50c27a96d77',
    scope:'Same-assistant original interpretations, five Atlas-not-reviewed candidates and T4 exposed B06; no Solutions accessed, no new model inference',
    originalCases:[],teachingAnalogues:[],hypothesis:null};
  for(const [id,entry] of Object.entries(REQUESTS)){
    const bytes=Buffer.from(JSON.stringify(entry.value,null,2)+'\n');
    assert.equal(hash(bytes),entry.sha256,id+' input bytes differ from frozen first attempt; do not repair');
    const run=await runProblemEvidence({inputBytes:bytes,outputPath:rel+'/'+id,execute:native});
    assert.equal(run.report.inputSha256,entry.sha256);
    assert.equal(run.report.dispatch?.repairs,0);
    assert.equal(run.report.dispatch?.externalModelCalls,0);
    const baseline=assumptions[id];
    assert.equal(run.report.status,baseline.status,id+' public status changed; preserve counterexample');
    assert.equal(run.report.coverage.available,baseline.available,id+' available request count changed');
    assert.equal(run.report.native.status,baseline.native,id+' native state changed');
    if(id.startsWith('T')){
      assert.equal(run.report.dispatch.nativeCalls,0,'Original source lacked enough facts; zero native calls');
      assert.equal(run.report.portable.status,'not-created','No invented original scene');
      for(const result of run.report.results)if(result.kind==='branch-angles'){
        assert.equal(result.nativeObservation,false);
        assert.equal(result.status,'conditional');
      }else assert.ok(result.status==='unavailable'||result.status==='needs-information');
    }
    if(id==='T3'){
      const branch=run.report.results[0].branches[0];
      close(branch.value.exitAngleDeg,Math.asin(Math.sin(Math.PI/4)/(4/3))*180/Math.PI);
      assert.equal(run.report.results[1].reasonCode,'UNSUPPORTED_QUANTITY');
    }
    if(id==='T4'){
      const branches=run.report.results[0].branches;
      assert.equal(branches.length,2);
      close(branches[0].value.exitAngleDeg,Math.asin(1.3*Math.sin(Math.PI/6)/1)*180/Math.PI);
      close(branches[1].value.exitAngleDeg,Math.asin(1.3*Math.sin(Math.PI/6)/1.45)*180/Math.PI);
    }
    if(id==='C1R2'){
      assert.deepEqual(run.report.results.map(r=>r.value),[1,2,2]);
      assert.equal(run.report.native.truncation,0);
    }
    if(id==='C2R'){
      close(run.report.results[0].value,Math.asin(Math.sin(Math.PI/4)/(4/3))*180/Math.PI);
      assert.equal(run.report.results[2].value,1);
      assert.equal(run.report.native.truncation,0);
    }
    const row={...print(id,run.report),inputSha256:entry.sha256,originalTransfer:id.startsWith('T'),exposedHistoricalControl:id==='T4'};
    (id.startsWith('T')?trial.originalCases:trial.teachingAnalogues).push(row);
    console.log('CURRENT_TRANSFER_V2 '+JSON.stringify({id,status:row.status,available:row.available,native:row.nativeStatus,inputSha256:row.inputSha256}));
  }
  const c2=JSON.parse(readFileSync(resolve(out,'C2R/qualified-scene.json'),'utf8'));
  const patch={expectedSha256:'a968434203c2152f8bb17eddd22de88871be45b0432b5b0da636ad5d545d0067',
    changes:[{id:'AirWater',section:'parameters',key:'negativeIndex',value:1.5}]};
  const bytes=Buffer.from(JSON.stringify(patch,null,2)+'\n');
  assert.equal(hash(bytes),'b044fbd4ade4851f49caa9f93354f3ad12d96000879d803e04d5d6202f5bad17','Frozen physical edit differs');
  assert.equal(c2.sceneSha256,patch.expectedSha256,'Original canonical source changed; no silent patch correction');
  const patchFile=resolve(out,'C2R-hypothesis-patch.json');
  writeFileSync(patchFile,bytes,{flag:'wx'});
  const output=execFileSync(process.execPath,[resolve(root,'scripts/qualified-scene.mjs'),'revise',
    resolve(out,'C2R/qualified-scene.json'),patchFile,'--out',rel+'/C2R-hypothesis'],
    {cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const revised=JSON.parse(output),reading=revised.requestedResults?.results.find(r=>r.kind==='interface-transmission-angle');
  assert.equal(revised.executionPassed,true);
  assert.ok(['available','qualified'].includes(reading?.status));
  close(reading.value,Math.asin(Math.sin(Math.PI/4)/1.5)*180/Math.PI);
  const next=JSON.parse(readFileSync(resolve(out,'C2R-hypothesis/qualified-scene.json'),'utf8'));
  assert.notEqual(next.sceneSha256,c2.sceneSha256);
  assert.equal(next.observables.length,c2.observables.length);
  trial.hypothesis={inputSha256:hash(bytes),status:revised.native.status,waterIndex:1.5,angleDeg:reading.value,
    previousIndex:4/3,sourceSceneSha256:c2.sceneSha256,revisedSceneSha256:next.sceneSha256,
    noTextbookShadowClaim:true};
  trial.eligibleAtlasUnreviewedWithoutKnownBroaderExposure=['T1','T2','T3','T5','T6'];
  trial.historicalExposedControl=['T4'];
  trial.completedOriginalTasks=0;trial.completedSourceNativeRuns=0;
  trial.syntheticCompletedNativeControls=2;
  writeFileSync(resolve(out,'transfer-summary.json'),JSON.stringify(trial,null,2)+'\n',{flag:'wx'});
  console.log('CURRENT_TRANSFER_V2_SUMMARY '+JSON.stringify({cases:trial.originalCases.length,
    eligible:5,originalFull:0,analyticalPart:'T3',exposed:'T4',
    syntheticNative:2,hypothesisAngle:reading.value,mainExecution:trial.githubCheckout}));
}
main().catch(error=>{console.error('CURRENT_TRANSFER_V2_FAILURE '+(error.stack||error.message));process.exitCode=1});
