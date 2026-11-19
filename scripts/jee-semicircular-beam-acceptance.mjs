// Public bounded v21 JEE-style source -> native -> qualified package.
// Synthetic radius/indices/beam/detectors are explicit teaching assumptions;
// an original J12 answer is neither inferred nor claimed.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/jee-semicircular-beam-v21');
if(existsSync(out))throw Error('Refuse to overwrite earlier v21 public native evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/jee-semicircular-beam-v21.json'),'utf8'));
const part=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const evidence={format:'opticsim-jee-semicircular-public-acceptance-v1',status:'running',
 cases:[],sourceProblemsRead:0,sourceSolutionsRead:0,externalModelCalls:0,repairs:0,
 originalQuestionSolved:false,independentPhysicsReview:false};
async function run(name,mutate=()=>{}){
 const req=structuredClone(fixture);
 req.physical.title+=' · '+name;
 mutate(req);
 const inputBytes=Buffer.from(JSON.stringify(req,null,2)+'\n');
 let calls=0;
 const result=await runProblemEvidence({inputBytes,outputPath:resolve(out,name),
   execute:(doc,requests)=>{calls++;return evaluateDocument(doc,core,requests);}});
 const r=result.report;
 assert.equal(calls,r.dispatch?.nativeCalls??0);
 assert.equal(r.dispatch?.repairs??0,0);
 assert.equal(r.dispatch?.externalModelCalls??0,0);
 if(r.portable?.status==='created'){
  const b=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
  assert.equal(b.scene.schemaVersion,21);
  assert.equal(b.scene.physics.model,'native-parallel-semicircular-tracing');
  assert.deepEqual(b.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(b,'results'),false);
 }
 evidence.cases.push({name,inputSha256:r.inputSha256,exitCode:result.exitCode,
   native:r.native,preparation:r.preparation,readings:r.results,portable:r.portable});
 return {report:r,exitCode:result.exitCode};
}
const baseline=await run('baseline');
assert.equal(baseline.exitCode,0);
assert.equal(baseline.report.native.status,'completed');
assert.deepEqual([baseline.report.results[0].value,baseline.report.results[1].value,
 baseline.report.results[5].value],[4,8,4]);
assert.equal(baseline.report.results[2].value['face-flat'].interactions,4);
assert.equal(baseline.report.results[2].value['face-arc'].interactions,4);
assert.equal(baseline.report.results[4].value,0);
assert.equal(baseline.report.results[6].value.length,4);
const reverseTilt=await run('negative-45-degree',r=>{
 part(r,'B1').y=150;part(r,'B1').directionDeg=-45;
 r.interpretation.assumptions.push('The fully authored mirror-symmetric control reverses the signed y-up Beam tilt.');
});
assert.equal(reverseTilt.exitCode,0);
assert.equal(reverseTilt.report.native.status,'completed');
assert.equal(reverseTilt.report.results[1].value,8);
const material=await run('index-1point3',r=>{
 part(r,'G1').insideIndex=1.3;
 r.interpretation.assumptions.push('This independent fully specified control chooses glass index 1.3.');
});
assert.equal(material.exitCode,0);
assert.equal(material.report.native.status,'completed');
assert.equal(material.report.results[1].value,8);
const tir=await run('native-tir',r=>{
 part(r,'B1').y=-58;part(r,'B1').width=10;
 r.interpretation.assumptions.push('Off-axis finite source placement is a separate synthetic TIR control.');
});
assert.equal(tir.exitCode,0);
assert.equal(tir.report.native.status,'completed');
assert.ok(tir.report.results[4].value>0);
assert.equal(tir.report.results[5].value,0);
const seam=await run('refused-flat-arc-seam',r=>part(r,'B1').y=-50);
assert.equal(seam.report.native.status,'not-run');
assert.equal(seam.report.dispatch.nativeCalls,0);
assert.notEqual(seam.exitCode,0);
const missing=await run('missing-radius',r=>delete part(r,'G1').radius);
assert.equal(missing.report.native.status,'not-run');
assert.equal(missing.report.dispatch.nativeCalls,0);
assert.notEqual(missing.exitCode,0);
const fresnel=await run('refused-fresnel-on',r=>part(r,'G1').partialReflection=true);
assert.equal(fresnel.report.native.status,'not-run');
assert.equal(fresnel.report.dispatch.nativeCalls,0);
assert.notEqual(fresnel.exitCode,0);
evidence.status='passed';
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('JEE_SEMICIRCLE_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:'passed',cases:7,nativeComplete:4,refusedBeforeNative:3,
 solver:'pinned-native-PhyDemo',sourceProblemsRead:0,sourceSolutionsRead:0,
 externalModelCalls:0,originalQuestionSolved:false}));
