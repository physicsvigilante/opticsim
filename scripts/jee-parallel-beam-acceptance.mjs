// Public JEE-style problem-to-qualified-native acceptance; no alternate solver.
// Each case is a fresh fully specified synthetic request and a real PhyDemo run.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/jee-parallel-beam-v19');
if(existsSync(out))throw Error('Refuse to replace earlier v19 beam evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixtures=Object.fromEntries(['lens','slab'].map(id=>[id,JSON.parse(readFileSync(resolve(root,'examples/jee-parallel-'+id+'-v19.json'),'utf8'))]));
const byId=(x,id)=>x.physical.components.find(c=>c.id===id);
const evidence={format:'opticsim-jee-parallel-beam-public-acceptance-v1',status:'running',
 cases:[],sourceProblemsRead:0,externalModelCalls:0,repairs:0,independentReview:false};
async function run(name,family,mutate=()=>{}){
 const request=structuredClone(fixtures[family]);
 request.physical.title+=' · '+name;
 mutate(request);
 const bytes=Buffer.from(JSON.stringify(request,null,2)+'\n');
 let calls=0;
 const result=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(out,name),
   execute:(doc,requests)=>{calls++;return evaluateDocument(doc,core,requests);}});
 const r=result.report;
 assert.equal(calls,r.dispatch?.nativeCalls??0);
 assert.equal(r.dispatch?.repairs??0,0);
 assert.equal(r.dispatch?.externalModelCalls??0,0);
 if(r.portable?.status==='created'){
  const b=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
  assert.equal(b.scene.schemaVersion,19);
  assert.deepEqual(b.qualification.interpretation,request.interpretation);
  assert.equal(Object.hasOwn(b,'results'),false);
 }
 evidence.cases.push({name,family,inputSha256:r.inputSha256,exitCode:result.exitCode,
   native:r.native,preparation:r.preparation,readings:r.results,portable:r.portable});
 return {report:r,exitCode:result.exitCode};
}
const clear=await run('lens-gap','lens');
assert.equal(clear.exitCode,0);assert.equal(clear.report.native.status,'completed');
assert.deepEqual(clear.report.results.slice(0,3).map(v=>v.value),[8,6,2]);
assert.equal(clear.report.results[3].value.length,2);
const opaque=await run('opaque-arm','lens',r=>byId(r,'A1').parameters.y=30);
assert.equal(opaque.exitCode,0);assert.equal(opaque.report.native.status,'completed');
assert.deepEqual(opaque.report.results.slice(0,3).map(v=>v.value),[8,8,0]);
assert.deepEqual(opaque.report.results[3].value,[]);
const slab=await run('oblique-slab','slab');
assert.equal(slab.exitCode,0);assert.equal(slab.report.native.status,'completed');
assert.deepEqual(slab.report.results.slice(0,4).map(v=>v.value),[8,8,8,8]);
assert.ok(slab.report.results.every(v=>v.status==='qualified'));
const alternate=await run('index-1point8','slab',r=>{
 byId(r,'I1').parameters.positiveIndex=1.8;
 byId(r,'I2').parameters.negativeIndex=1.8;
 r.interpretation.assumptions.push('This new fully declared synthetic control uses slab index 1.8.');
});
assert.equal(alternate.exitCode,0);assert.equal(alternate.report.native.status,'completed');
assert.equal(alternate.report.results[3].value,8);
const fresnel=await run('fresnel-incomplete','slab',r=>{
 for(const id of ['I1','I2'])byId(r,id).parameters.partialReflection=true;
 r.interpretation.assumptions.push('Fresnel-on branches may be incomplete at native depth 8.');
});
assert.equal(fresnel.report.native.status,'incomplete');
assert.ok(fresnel.report.results.every(v=>v.status==='suppressed'&&v.value===null));
const wrong=await run('invalid-source-overlap','slab',r=>byId(r,'B1').parameters.x=0);
assert.equal(wrong.report.native.status,'not-run');
assert.equal(wrong.report.dispatch.nativeCalls,0);
assert.notEqual(wrong.exitCode,0);
const absent=await run('missing-width','lens',r=>delete byId(r,'B1').parameters.width);
assert.equal(absent.report.native.status,'not-run');
assert.equal(absent.report.dispatch.nativeCalls,0);
assert.notEqual(absent.exitCode,0);
evidence.status='passed';
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('JEE_PARALLEL_BEAM_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:evidence.status,cases:evidence.cases.length,fullNativeCases:4,
 incomplete:1,refused:2,solver:'pinned-native-PhyDemo',
 sourceProblemsRead:0,externalModelCalls:0}));
