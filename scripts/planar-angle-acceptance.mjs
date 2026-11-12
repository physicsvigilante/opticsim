// Sealed original requests + prespecified independent synthetic analytical
// configurations. Real native checks never become analytical-method claims.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const first=JSON.parse(readFileSync('evaluation/original-refraction-pair-v1/first-attempt.json'));
const trials=JSON.parse(readFileSync('evaluation/planar-angular-v1/cases.json'));
const reduced=JSON.parse(readFileSync('evaluation/planar-angular-v1/reduced-facts.json'));
const folder=resolve('test-artifacts/llm-authoring/planar-angle-acceptance');
mkdirSync(folder,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const capabilities=spawnSync(process.execPath,['scripts/qualified-scene.mjs','capabilities'],{encoding:'utf8'});
assert.equal(capabilities.status,0,capabilities.stderr);
assert.deepEqual(JSON.parse(capabilities.stdout).conditionalAngularQueries.kinds,
  ['critical-input-angle','branch-angles']);
const report={format:'opticsim-planar-angle-acceptance-v1',
  originalProblemsPreviouslySeen:true,solutionsRead:false,independentModelBenchmark:false,
  attempts:[]};
const save=(name,data)=>{
 const file=resolve(folder,name);writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'});return file;
};
function run(name,request,query,{native=false,status='conditional'}={}){
 const input=save(name+'.request.json',request),queries=save(name+'.query.json',query);
 const out=resolve(folder,name);
 const args=['scripts/planar-angle-query.mjs',input,queries,'--out',out];
 if(native)args.push('--native-check');
 const child=spawnSync(process.execPath,args,{encoding:'utf8',timeout:90000});
 assert.equal(child.status,0,child.stdout+child.stderr);
 const result=JSON.parse(readFileSync(resolve(out,'report.json')));
 assert.equal(result.results.status,status);
 assert.equal(result.physicalSceneMutated,false);
 assert.equal(result.originalInputSha256,sha(readFileSync(input)));
 assert.equal(result.queryInputSha256,sha(readFileSync(queries)));
 assert.equal(result.results.native.status,'not-run');
 assert.equal(result.forwardNativeCheck?.status||'not-run',native?'incomplete':'not-run');
 assert.ok(existsSync(resolve(out,'analytical-result.json')));
 const hasScene=Boolean(result.results.proposedForwardScene||result.results.canonicalForwardScene);
 if(hasScene){
   assert.equal(result.portableQualifiedScene.status,'created',JSON.stringify(result.portableQualifiedScene));
   const bundle=JSON.parse(readFileSync(resolve(out,'derived-forward-scene.qualified.json')));
   assert.equal(bundle.format,'opticsim-qualified-scene-v1');
   assert.equal(bundle.qualification.calculations[0].querySha256,result.queryInputSha256);
   assert.deepEqual(bundle.qualification.calculations[0].query,query);
   assert.equal(bundle.qualification.origin.inputSha256,result.originalInputSha256);
 }else{
   assert.equal(result.portableQualifiedScene.status,'not-applicable');
   assert.ok(!existsSync(resolve(out,'derived-forward-scene.qualified.json')));
 }
 report.attempts.push({name,resultStatus:result.results.status,nativeStatus:result.forwardNativeCheck?.status||'not-run',
   actualResult:result.results.results?.map(x=>({id:x.id,status:x.status,angleDeg:x.value?.exitAngleDeg}))||
    result.results.value,requestSha256:result.originalInputSha256,querySha256:result.queryInputSha256});
 return result;
}
const get=id=>structuredClone(first.cases.find(c=>c.id===id).request);
const b05=run('B05-inverse',get('B05'),trials.original.B05,{native:true});
assert.ok(Math.abs(b05.results.value.initialIncidenceAngleDeg-54.3409123039)<1e-8);
assert.equal(b05.forwardNativeCheck.actualObservations,null);
const b06=run('B06-two-branches',get('B06'),trials.original.B06,{native:true});
const r=b06.results.results;
assert.ok(Math.abs(r[0].value.exitAngleDeg-26.6331187492)<1e-8);
assert.ok(Math.abs(r[1].value.exitAngleDeg-40.5416018735)<1e-8);
assert.equal(b06.forwardNativeCheck.actualObservations,null);
run('reverse-critical',trials.synthetic.reverseCritical.request,trials.synthetic.reverseCritical.query);
run('middle-branches',trials.synthetic.middleBranches.request,trials.synthetic.middleBranches.query);
for(const c of reduced.cases)run(c.id,c.input,c.query);
const impossible=get('B05');
impossible.components.find(x=>x.id==='I12').parameters.negativeIndex=1;
const blocked=run('impossible-critical',impossible,trials.original.B05,{status:'unavailable'});
assert.equal(blocked.results.proposedForwardScene,undefined);
save('acceptance.json',{...report,status:'pass',cases:report.attempts.length});
console.log('Planar angular analysis acceptance PASS: B05/B06 conditional answers and reduced facts, portable provenance, unchanged native incompleteness, two independent cases and unavailable control.');
