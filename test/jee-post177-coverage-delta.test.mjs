// Developmental coverage replay only. No production physics or schema changes.
// Frozen PR165 records are references, never overwritten or retroactively scored.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runSphericalInterfaceEvidence} from '../scripts/spherical-interface-query.mjs';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {parseQualifiedBundle} from '../src/qualification.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const planBytes=readFileSync(resolve(root,'evaluation/jee-post177-coverage-delta-v1/plan.json'));
const plan=JSON.parse(planBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const parent=resolve(root,'test-artifacts/llm-authoring');
mkdirSync(parent,{recursive:true});
const out=mkdtempSync(resolve(parent,'jee-post177-coverage-delta-v1-'));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const outcomes=[];
const save=(name,data)=>writeFileSync(resolve(out,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(out,'plan.json'),planBytes,{flag:'wx'});
const near=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`);
const byId=r=>Object.fromEntries(r.results.map(x=>[x.id,x]));
function analytical(id){
 const item=plan.analyticalReplays.find(x=>x.id===id);
 assert.ok(item);
 const bytes=Buffer.from(JSON.stringify(item.query,null,2)+'\n');
 const r=runSphericalInterfaceEvidence({queryBytes:bytes,outputPath:resolve(out,id)});
 assert.deepEqual(readFileSync(resolve(out,id,'input.json')),bytes);
 assert.equal(r.report.originalInputSha256,sha(bytes));
 assert.equal(r.report.native.status,'not-run');
 assert.equal(r.report.native.nativeImageDetected,false);
 return r;
}

test('post177 accounting retains all 20 source cases without a solved-question percentage',()=>{
 assert.equal(plan.engineBaseline,'6295695483241620e17de1fd8df5e45abb80876d');
 assert.equal(plan.engineTree,'df49aa4114479ac2462bfa67682b4c9b6ef3e37b');
 assert.equal(plan.priorTrial.modified,false);
 assert.deepEqual(plan.cases.map(x=>x.id),Array.from({length:20},(_,i)=>'J'+String(i+1).padStart(2,'0')));
 assert.equal(plan.protocol.originalQuestionSuccessRate,null);
 assert.equal(plan.protocol.nativeIllustrationCountsAsOriginalQuestionSuccess,false);
 assert.deepEqual(plan.protocol.executionSelection,['J12','J15','J16','J19']);
 assert.equal(plan.cases.filter(x=>x.delta==='new-source-derived-conditional-analysis').length,1);
 assert.equal(plan.cases.filter(x=>x.delta==='new-public-native-illustration').length,2);
 assert.equal(plan.cases.filter(x=>x.delta==='new-conditional-illustration-original-still-incomplete').length,1);
 assert.equal(plan.cases.filter(x=>x.delta==='historical-conditional-result-not-rerun').length,5);
 outcomes.push({id:'accounting',passed:true,originalQuestionSuccessRate:null});
});

test('post177 J15 source-derived power is conditional mathematics, not native image evidence',()=>{
 const r=analytical('J15');
 assert.equal(r.exitCode,0);assert.equal(r.status,'conditional');
 near(r.report.results.value.powerDiopters,10/3);
 near(r.report.results.value.signedImageSpaceFocalDistance,40);
 assert.equal(r.report.results.native.status,'not-run');
 outcomes.push({id:'J15',passed:true,evidence:'source-derived-conditional-analysis',
  powerDiopters:r.report.results.value.powerDiopters,native:'not-run',nativeImageDetected:false});
});

test('post177 J16 still refuses an unstated exterior index despite the new mathematical capability',()=>{
 const r=analytical('J16-missing-exterior');
 assert.equal(r.status,'rejected');assert.equal(r.exitCode,1);
 assert.ok(r.report.issues.some(x=>x.code==='MISSING_FACTS'));
 outcomes.push({id:'J16-missing-exterior',passed:true,evidence:'required-fact-refused',native:'not-run'});
});

test('post177 J16 explicit exterior-index illustration is not promoted into original-source coverage',()=>{
 const item=plan.analyticalReplays.find(x=>x.id==='J16-illustration');
 assert.equal(item.extraMaterialValues.length,1);
 const r=analytical(item.id);
 assert.equal(r.exitCode,0);assert.equal(r.status,'conditional');
 near(r.report.results.value.signedImageDistance,-60/7);
 assert.equal(r.report.results.value.imageKind,'virtual');
 outcomes.push({id:item.id,passed:true,evidence:'conditional-illustration',
  signedImageDistanceCm:r.report.results.value.signedImageDistance,
  originalQuestionFullySpecified:false,native:'not-run',nativeImageDetected:false});
});

for(const item of plan.nativeReplays){
 test('post177 '+item.caseId+' replays a public native illustration and refuses lost essential facts',async()=>{
  const bytes=readFileSync(resolve(root,item.path));
  assert.equal(gitBlob(bytes),item.gitBlob,'The planned example bytes changed; do not silently substitute');
  const req=JSON.parse(bytes);
  assert.ok(req.interpretation.assumptions.length>0);
  let calls=0,captured=null;
  const result=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(out,item.caseId+'-native'),
   execute:(doc,requests)=>{calls++;captured=evaluateDocument(doc,core,requests);return captured;}});
  assert.equal(result.exitCode,0);assert.equal(calls,1);
  assert.equal(result.report.dispatch.nativeCalls,1);
  assert.equal(result.report.native.status,'completed');
  assert.deepEqual(readFileSync(resolve(out,item.caseId+'-native','input.json')),bytes);
  const values=byId(result.report);
  assert.equal(values.emitted.value,item.expectedEmissions);
  for(const [id,count] of Object.entries(item.expectedCrossings)){
   assert.ok(['available','qualified'].includes(values[id].status));
   assert.equal(values[id].value,count);
  }
  const bundle=await parseQualifiedBundle(readFileSync(resolve(out,item.caseId+'-native','qualified-scene.json'),'utf8'));
  assert.equal(bundle.scene.schemaVersion,item.schemaVersion);
  assert.deepEqual(bundle.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  const changed=structuredClone(bundle.scene);
  if(item.caseId==='J12'){
   const g=changed.physics.components.find(x=>x.id==='G1');g.parameters.insideIndex=1.6;
   assert.equal(req.physical.components.find(x=>x.id==='B1').parameters.directionDeg,45);
   near(req.physical.components.find(x=>x.id==='G1').parameters.insideIndex,Math.SQRT2);
  }else{
   const lenses=req.physical.components.filter(x=>x.type==='ideal-lens');
   assert.equal(lenses[0].parameters.focalLength,lenses[1].parameters.focalLength);
   near(lenses[1].parameters.x-lenses[0].parameters.x,3*lenses[0].parameters.focalLength);
   assert.notEqual(lenses[1].parameters.y,lenses[0].parameters.y);
   changed.physics.components.find(x=>x.id==='L2').parameters.y=3;
  }
  const stale=await evaluateObservables(changed,req.requests,captured.summary);
  assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
  save(item.caseId+'-stale.json',stale);
  const missing=structuredClone(req);
  if(item.caseId==='J12')delete missing.physical.components.find(x=>x.id==='G1').parameters.outsideIndex;
  else delete missing.physical.components.find(x=>x.id==='L2').parameters.y;
  let refusedCalls=0;
  const refusal=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(missing,null,2)+'\n'),
   outputPath:resolve(out,item.caseId+'-missing-fact'),execute:()=>{refusedCalls++;throw Error('Unexpected native execution');}});
  assert.equal(refusedCalls,0);assert.equal(refusal.report.dispatch.nativeCalls,0);
  assert.equal(refusal.report.native.status,'not-run');assert.notEqual(refusal.exitCode,0);
  outcomes.push({id:item.caseId,passed:true,evidence:'public-native-illustration',
   inputSha256:sha(bytes),schemaVersion:bundle.scene.schemaVersion,native:'completed',
   emitted:values.emitted.value,detectorCrossings:Object.fromEntries(Object.keys(item.expectedCrossings).map(id=>[id,values[id].value])),
   staleResultsSuppressed:true,missingEssentialFactRefusedBeforeNative:true,
   originalQuestionFullySpecified:false,nativeImageDetected:false});
 });
}

after(()=>{
 const expected=['accounting','J15','J16-missing-exterior','J16-illustration','J12','J19'];
 const completed=expected.every(id=>outcomes.some(x=>x.id===id&&x.passed));
 const report={format:'opticsim-jee-post177-coverage-delta-report-v1',
  status:completed?'passed':'failed-or-incomplete',engineBaseline:plan.engineBaseline,
  planSha256:sha(planBytes),outcomes,expectedChecks:expected,
  originalQuestionSuccessRate:null,independentEvaluation:false,
  sourceImagesReadByThisReplay:0,solutionsRead:0,nativeImageDetected:false,
  unchangedCases:'The other 16 source records are retained, not freshly rerun by this delta test.'};
 save('report.json',report);
 console.log('JEE_POST177_COVERAGE_DELTA '+JSON.stringify(report));
});
