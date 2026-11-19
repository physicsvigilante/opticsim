// Synthetic JEE-style v20 source-to-qualified-native acceptance. No original
// textbook problem facts are silently filled in; all scales are author choices.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/jee-parallel-two-lens-v20');
if(existsSync(out))throw Error('Refuse to overwrite existing v20 native evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/jee-parallel-two-lens-v20.json'),'utf8'));
const part=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const report={format:'opticsim-jee-two-lens-public-acceptance-v1',status:'running',
 cases:[],sourceProblemsRead:0,externalModelCalls:0,repairs:0,independentPhysicsReview:false};
async function run(name,mutate=()=>{}){
 const req=structuredClone(fixture);req.physical.title+=' · '+name;mutate(req);
 const inputBytes=Buffer.from(JSON.stringify(req,null,2)+'\n');
 let calls=0;
 const result=await runProblemEvidence({inputBytes,outputPath:resolve(out,name),
   execute:(doc,requests)=>{calls++;return evaluateDocument(doc,core,requests);}});
 const r=result.report;
 assert.equal(calls,r.dispatch?.nativeCalls??0);
 assert.equal(r.dispatch?.repairs??0,0);
 assert.equal(r.dispatch?.externalModelCalls??0,0);
 if(r.portable?.status==='created'){
  const bundle=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
  assert.equal(bundle.scene.schemaVersion,20);
  assert.equal(bundle.scene.physics.model,'native-parallel-two-lens-tracing');
  assert.deepEqual(bundle.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(bundle,'results'),false);
 }
 report.cases.push({name,inputSha256:r.inputSha256,exitCode:result.exitCode,native:r.native,
   preparation:r.preparation,readings:r.results,portable:r.portable});
 return {summary:r,exitCode:result.exitCode};
}
const base=await run('baseline');
assert.equal(base.exitCode,0);assert.equal(base.summary.native.status,'completed');
assert.deepEqual(base.summary.results.slice(0,3).map(v=>v.value),[8,8,8]);
assert.equal(base.summary.results[3].value.length,8);
assert.equal(base.summary.results[4].value.length,8);
const sign=await run('negative-offset',r=>{
 part(r,'L2').y=-2;
 r.interpretation.assumptions.push('This synthetic control independently chooses d=-2 mm.');
});
assert.equal(sign.exitCode,0);assert.equal(sign.summary.native.status,'completed');
assert.deepEqual(sign.summary.results.slice(0,3).map(v=>v.value),[8,8,8]);
const missed=await run('second-lens-partial-miss',r=>{
 part(r,'L2').apertureHeight=20;
 part(r,'D1').length=300;part(r,'D2').length=300;
 r.interpretation.assumptions.push('Finite second-lens clipping is probed without replacing native misses by absorption.');
});
assert.equal(missed.exitCode,0);assert.equal(missed.summary.native.status,'completed');
assert.deepEqual(missed.summary.results.slice(0,3).map(v=>v.value),[8,8,8]);
// Regression apparatus for fitted-view correctness. This is a deliberately
// off-axis *synthetic* finite arrangement, not an original J19 configuration:
// first lens intercepts the sampled rays, second lens may be missed entirely.
const displaced=await run('strong-offset-fit',r=>{
 part(r,'B1').y=720;
 part(r,'L1').y=720;
 part(r,'L2').y=-650;
 r.interpretation.requestedResult='View both physically present, independently displaced finite lens segments even when native samples bypass the second.';
 r.interpretation.assumptions.push('Both lens centres are independently authored at y=+720 and y=-650 mm solely to test apparatus fitting; no original J19 scale or offset is inferred.');
});
assert.equal(displaced.exitCode,0);
assert.equal(displaced.summary.native.status,'completed');
assert.equal(displaced.summary.results[0].value,8);
assert.deepEqual(displaced.summary.results.slice(1,3).map(v=>v.value),[0,0],
  'a native detector miss does not remove real apparatus from the Fit Results viewport');
const rim=await run('refused-second-rim',r=>{
 part(r,'L2').y=0;part(r,'L2').apertureHeight=70;
});
assert.equal(rim.summary.native.status,'not-run');
assert.equal(rim.summary.dispatch.nativeCalls,0);assert.notEqual(rim.exitCode,0);
const missing=await run('missing-centre-y',r=>delete part(r,'L2').y);
assert.equal(missing.summary.native.status,'not-run');
assert.equal(missing.summary.dispatch.nativeCalls,0);assert.notEqual(missing.exitCode,0);
report.status='passed';
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('JEE_TWO_LENS_PUBLIC_ACCEPTANCE '+JSON.stringify({status:'passed',cases:6,fullNative:4,refused:2,
 solver:'pinned-native-PhyDemo',sourceProblemsRead:0,externalModelCalls:0}));
