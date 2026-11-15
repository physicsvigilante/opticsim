// Public Opticsim problem workflow acceptance for observed native object parentage.
// Every apparatus is synthetic, expressly authored, not extracted from a textbook.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=resolve(process.env.OPTICSIM_PARENTAGE_ACCEPTANCE_OUTPUT||
  'test-artifacts/llm-authoring/native-ray-parentage-v1');
mkdirSync(resolve(root,'..'),{recursive:true});mkdirSync(root);
const core=createRequire(import.meta.url)(resolve('dist/test-core.cjs'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const s=(id,x,y,directionDeg,brightness=1)=>({id,type:'point-source',
  parameters:{x,y,brightness},emission:{mode:'single-ray',directionDeg}});
const i=(partialReflection=true)=>({id:'AirWater',type:'planar-interface',
  parameters:{x:0,y:0,normalDeg:90,negativeIndex:4/3,positiveIndex:1,partialReflection}});
const d=(id,x,y,length)=>({id,type:'ray-detector',
  parameters:{x,y,orientationDeg:0,length}});
const scene=(partialReflection=true)=>[
  s('SunRay',-100,100,-45),s('SunRay2',-150,100,-45),i(partialReflection),
  d('LakeBottomDetector',50,-100,400),d('ReflectedDetector',200,200,500)
];
const request=(components,ids=['LakeBottomDetector','ReflectedDetector'])=>({
  format:'opticsim-problem-v1',
  physical:{lengthUnit:'mm',title:'Fully authored teaching analogue: native object parentage',
    runPolicy:'preview-v1',components},
  requests:ids.map((componentId,j)=>({id:'p'+j,kind:'detector-ray-provenance',componentId}))
});
const experiments=[];
async function record(name,input,expected){
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 const dir=join(root,name),file=join(root,name+'.request.json');
 writeFileSync(file,bytes,{flag:'wx'});
 const out=await runProblemEvidence({inputBytes:bytes,outputPath:dir,
   execute:(doc,requests)=>evaluateDocument(doc,core,requests)});
 const r=out.report;
 assert.equal(out.exitCode,expected.exit,name+': public exit');
 assert.equal(r.native.status,expected.native,name+': native status');
 if(expected.count!==undefined)for(const [j,v] of expected.count.entries()){
   assert.equal(r.results[j].value?.crossings?.length,v,name+' detector '+j);
 }
 if(expected.status)assert.ok(r.results.every(x=>x.status===expected.status),
   name+': '+JSON.stringify(r.results));
 assert.equal(r.inputSha256,sha(bytes));
 const fileData={name,sourceSha256:r.inputSha256,exitCode:out.exitCode,
   native:r.native.status,requested:r.results.map(x=>({id:x.id,status:x.status,
     reasonCode:x.reasonCode??null,method:x.method,
     crossings:x.value?.crossings?.length??null,nodes:x.value?.nodes?.length??null})),
   output:dir};
 experiments.push(fileData);return {result:out,dir};
}
const positive=await record('two-source-fresnel',request(scene()),{exit:0,native:'completed',count:[2,2],status:'available'});
const primary=positive.result.report.results[0],secondary=positive.result.report.results[1];
assert.equal(primary.value.nodes.length,2);assert.equal(secondary.value.nodes.length,4);
assert.equal(secondary.value.nodes.filter(x=>x.parentToken!==null).length,2);
assert.deepEqual(secondary.value.nodes.filter(x=>x.parentToken!==null).map(x=>x.sourceId),['SunRay','SunRay2']);
const bundle=await parseQualifiedBundle(readFileSync(join(positive.dir,'qualified-scene.json'),'utf8'));
assert.deepEqual(bundle.observables,request(scene()).requests);
assert.ok(!('execution'in bundle)&&!('results'in bundle),'Export must not embed an old ray identity registry');
const edited=scene();edited[0].parameters.x=-110;
await record('physical-source-revision',request(edited),{exit:0,native:'completed',count:[2,2],status:'available'});
const noReflection=await record('transmitted-only',request(scene(false)),{exit:0,native:'completed',count:[2,0],status:'qualified'});
assert.equal(noReflection.result.report.results[1].value.nodes.length,0);
const away=[s('Away',-100,100,135),i(false),d('EmptyDetector',200,-100,200)];
await record('clean-zero-hit',request(away,['EmptyDetector']),{exit:0,native:'completed',count:[0],status:'qualified'});
const weak=scene();weak.splice(1,1);weak[0].parameters.brightness=.01;
const truncated=await record('weak-fresnel-incomplete',request(weak,['ReflectedDetector']),{exit:2,native:'incomplete',status:'suppressed'});
assert.equal(truncated.result.report.results[0].value,null);
assert.ok(!JSON.stringify(JSON.parse(readFileSync(join(truncated.dir,'native-evidence.json'))).report?.native?.diagnostics||{}).includes('"nodes"'));
writeFileSync(join(root,'acceptance.json'),JSON.stringify({
  format:'opticsim-native-parentage-public-acceptance-v1',status:'passed',
  originalQuestionSolved:false,externalModelCalls:0,independentReview:false,
  node:process.version,cases:experiments
},null,2)+'\n',{flag:'wx'});
console.log('NATIVE_RAY_PARENTAGE_ACCEPTANCE '+JSON.stringify({status:'passed',
  cases:experiments.map(e=>({name:e.name,native:e.native,exit:e.exitCode}))}));
