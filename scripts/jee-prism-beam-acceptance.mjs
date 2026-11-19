// Public v22 fully specified synthetic JEE-style finite Beam+prism trial.
// Immutable source requests -> canonical strict authoring -> pinned native
// execution -> qualified export; no original solution or invented ray route.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/jee-prism-beam-v22');
if(existsSync(out))throw Error('Never overwrite earlier v22 native evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const seed=JSON.parse(readFileSync(resolve(root,'examples/jee-prism-beam-v22.json'),'utf8'));
const part=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const record={format:'opticsim-jee-prism-beam-v22-public-acceptance-v1',
 cases:[],sourceProblemsRead:0,sourceSolutionsRead:0,externalModelCalls:0,
 independentPhysicsCertification:false,originalTextbookProblemSolved:false,status:'running'};
async function run(name,edit=()=>{}){
 const input=structuredClone(seed);input.physical.title='JEE prism Beam v22 · '+name;edit(input);
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 let actualNativeCalls=0;
 const data=await runProblemEvidence({inputBytes:bytes,
   outputPath:resolve(out,name),execute:(doc,requests)=>{
     actualNativeCalls++;return evaluateDocument(doc,core,requests);
   }});
 const r=data.report;
 assert.equal(r.dispatch.nativeCalls,actualNativeCalls);
 assert.equal(r.dispatch.repairs,0);
 assert.equal(r.dispatch.externalModelCalls,0);
 if(r.portable?.status==='created'){
   const bundle=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
   assert.equal(bundle.scene.schemaVersion,22);
   assert.equal(bundle.scene.physics.model,'native-parallel-prism-tracing');
   assert.deepEqual(bundle.qualification.interpretation,input.interpretation);
   assert.equal(Object.hasOwn(bundle,'results'),false);
 }
 record.cases.push({name,inputSha256:r.inputSha256,
   exitCode:data.exitCode,native:r.native,preparation:r.preparation,
   requested:r.results,portable:r.portable});
 return {summary:r,exitCode:data.exitCode};
}
const baseline=await run('native-multi-face-tir-zero');
assert.equal(baseline.exitCode,0);
assert.equal(baseline.summary.native.status,'completed');
assert.deepEqual([baseline.summary.results[0].value,baseline.summary.results[1].value,
 baseline.summary.results[5].value],[4,12,0]);
for(const id of ['face-12','face-23','face-31'])
 assert.equal(baseline.summary.results[2].value[id].interactions,4);
assert.deepEqual(baseline.summary.results[6].value,[]);
const short=await run('short-apex-positive-native-detector',r=>{
 part(r,'G1').x3=20;
 r.interpretation.assumptions.push('The explicit 20-mm right-apex control changes actual finite native refraction and downstream detection.');
});
assert.equal(short.exitCode,0);
assert.equal(short.summary.native.status,'completed');
assert.ok(short.summary.results[5].value>0);
assert.equal(short.summary.results[5].value,short.summary.results[6].value.length);
const index=await run('inside-index-1point3',r=>{
 part(r,'G1').insideIndex=1.3;
 r.interpretation.assumptions.push('A second independent material control has explicitly authored index 1.3.');
});
assert.equal(index.exitCode,0);assert.equal(index.summary.native.status,'completed');
assert.equal(index.summary.results[1].value,12);
const width=await run('beam-width-40',r=>{
 part(r,'B1').width=40;
 r.interpretation.assumptions.push('A finite native emitter width control doubles actual sample count at unchanged numerical density.');
});
assert.equal(width.exitCode,0);assert.equal(width.summary.native.status,'completed');
assert.equal(width.summary.results[0].value,8);
assert.equal(width.summary.results[1].value,24);
const apex=await run('refused-sample-at-apex',r=>part(r,'G1').y3=2.5);
assert.notEqual(apex.exitCode,0);assert.equal(apex.summary.native.status,'not-run');
assert.equal(apex.summary.dispatch.nativeCalls,0);
const missing=await run('refused-unknown-outside-index',r=>delete part(r,'G1').outsideIndex);
assert.notEqual(missing.exitCode,0);assert.equal(missing.summary.native.status,'not-run');
assert.equal(missing.summary.dispatch.nativeCalls,0);
const fresnel=await run('refused-fresnel-branching',r=>part(r,'G1').partialReflection=true);
assert.notEqual(fresnel.exitCode,0);assert.equal(fresnel.summary.native.status,'not-run');
assert.equal(fresnel.summary.dispatch.nativeCalls,0);
record.status='passed';record.counts={planned:7,attempted:7,nativeComplete:4,refusedBeforeNative:3};
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('JEE_PRISM_BEAM_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:'passed',cases:7,nativeComplete:4,refusedBeforeNative:3,
 nativeSolver:'pinned-unchanged-PhyDemo',originalQuestionSolved:false,
 sourceSolutionsRead:0,externalModelCalls:0}));
