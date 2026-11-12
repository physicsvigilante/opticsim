// Deterministic follow-up to previously seen U1, not a replacement first attempt,
// independent accuracy evaluation, or native simulation of textbook apparatus.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonicalJSON} from '../src/qualified-utils.js';
import {readProblemPng,sha256} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const root=resolve('.'),folder=resolve(root,'test-artifacts/llm-authoring/mirror-angular-acceptance');
mkdirSync(folder,{recursive:true});
const raw=readFileSync('evaluation/mirror-angular-v1/first-followup.json'),followup=JSON.parse(raw);
const originalBytes=readFileSync(followup.source.originalTrial),original=JSON.parse(originalBytes);
const seal=sha256(Buffer.from(canonicalJSON(original)));
assert.equal(seal,followup.source.originalTrialCanonicalSha256);
const first=original.cases.find(x=>x.id==='U1');
assert.equal(first.request.physical,null);
assert.equal(first.request.requests[0].kind,'mirror-incidence-from-output-direction');
assert.ok(followup.source.problemPath.includes('/Problems/'));
assert.ok(!followup.source.problemPath.includes('/Solutions/'));
const sourceImage=readProblemPng(readFileSync('08_Ray_Optics_Explanations.zip'),followup.source.problemPath);
assert.equal(sha256(sourceImage),followup.source.imageSha256);
writeFileSync(resolve(folder,'U1-source.png'),sourceImage,{flag:'wx'});
writeFileSync(resolve(folder,'first-followup.json'),raw,{flag:'wx'});
const records=[];
function countNumbers(v){return typeof v==='number'?1:Array.isArray(v)?v.reduce((n,x)=>n+countNumbers(x),0):v&&typeof v==='object'?Object.values(v).reduce((n,x)=>n+countNumbers(x),0):0;}
function execute(id,input,status,exit){
 const inputPath=resolve(folder,id+'.input.json');
 writeFileSync(inputPath,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
 const proc=spawnSync(process.execPath,['scripts/run-problem.mjs',inputPath,'--out',resolve(folder,id)],
   {encoding:'utf8',timeout:90000});
 if(proc.error||proc.signal||proc.status!==exit)throw Error(id+' failed: '+(proc.error?.message||proc.signal||proc.status)+' '+proc.stdout+' '+proc.stderr);
 const report=JSON.parse(readFileSync(resolve(folder,id,'report.json')));
 assert.equal(report.results[0].status,status);
 assert.equal(report.native.status,'not-run');
 assert.equal(report.dispatch.nativeCalls,0);
 assert.equal(report.dispatch.repairs,0);
 assert.equal(report.dispatch.externalModelCalls,0);
 assert.equal(report.portable.status,'not-created');
 assert.equal(report.inputSha256,sha256(readFileSync(inputPath)));
 assert.equal(report.questionSupport,'not-assessed-by-engine');
 const result=report.results[0];
 records.push({id,status:result.status,value:result.value,
   candidates:result.candidateIncidenceAnglesDeg||[],
   authoredNumericFields:countNumbers(input.physical),
   inputSha256:report.inputSha256,native:report.native.status});
 return report;
}
const u1=execute('U1-followup',followup.request,'conditional',0);
assert.equal(u1.results[0].value.incidenceAngleDeg,50);
assert.equal(u1.results[0].value.complementarySurfaceAngleDeg,40);
for(const c of followup.additionalCases){
 const input={format:'opticsim-problem-v1',physical:c.physical,requests:[{
   id:'angle',kind:c.query.kind,referenceMirrorId:c.query.referenceMirrorId,
   outgoingRelation:c.query.outgoingRelation,angleConvention:c.query.angleConvention
 }]};
 const status=c.id==='four-mirror-ambiguous'?'multiple-solutions':c.id==='coincident-grazing'?'unavailable':'conditional';
 const result=execute(c.id,input,status,status==='conditional'?0:2).results[0];
 if(c.id==='two-mirror-30')assert.equal(result.value.incidenceAngleDeg,30);
 if(c.id==='two-mirror-45')assert.equal(result.value.incidenceAngleDeg,0);
 if(c.id==='four-mirror-ambiguous')assert.deepEqual(result.candidateIncidenceAnglesDeg,[10,50]);
 if(c.id==='coincident-grazing')assert.equal(result.value,null);
}
assert.equal(sha256(Buffer.from(canonicalJSON(JSON.parse(readFileSync(followup.source.originalTrial))))),seal);
const report={format:'opticsim-mirror-angular-acceptance-v1',status:'pass',
 originalFirstAttemptUnchanged:true,originalFirstAttemptCanonicalSha256:seal,
 sourceImagePath:followup.source.problemPath,sourceImageSha256:followup.source.imageSha256,
 previouslyViewed:true,solutionsRead:false,independentAccuracyScore:null,
 externalModelCalls:0,automaticRepairs:0,
 nativeCrosscheck:'A separate test-only finite two-mirror PhyDemo scene is exercised in test/mirror-angle-native.test.mjs; the original question has no authored native scene.',
 records};
writeFileSync(resolve(folder,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Mirror-angle unified CLI acceptance PASS: U1 50 degrees, 30/45 independent controls, ambiguous chain, grazing rejection, sealed original unchanged.');
