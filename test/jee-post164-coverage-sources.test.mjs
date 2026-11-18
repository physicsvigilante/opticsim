// Development-only source material for a frozen 20-problem coverage audit.
// No changes to physics, no native result claims, no original Solutions read.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const policy=JSON.parse(readFileSync(new URL('../evaluation/jee-post164-coverage-v1/policy.json',import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const chapters=[
 ['01_Reflection_at_Plane_Surfaces',15,3],
 ['02_Reflection_at_Curved_Surfaces',13,3],
 ['03_General_Refraction',12,3],
 ['04_Total_Internal_Reflection_TIR',10,3],
 ['05_Prism',15,2],
 ['06_Refraction_at_Curved_Surfaces',13,2],
 ['07_Lens_Formula',27,3],
 ['08_Aberrations_Human_Eye_Optical_Instruments',9,1]
];

test('post-PR164 coverage selection is frozen, Problems-only and not an independent solved-question benchmark',()=>{
 assert.equal(policy.engineBaseline,'8b4ffee3c9deb34fcf7d657221f917fab321de4c');
 assert.equal(policy.engineTree,'f371366765c8aa96029a0b29d6ae3f770e9b0eb2');
 assert.equal(policy.sampleSize,20);
 assert.equal(policy.sourceSolutionsRead,false);
 assert.equal(policy.previousFirstAttemptsMutable,false);
 assert.equal(policy.independentModelBenchmark,false);
 assert.equal(policy.allowInventedEssentialPhysics,false);
 assert.equal(policy.evaluationAxes.length,5);
 const expected=[];
 for(const [chapter,count,take] of chapters){
  const indices=take===1?[1]:take===2?[1,count]:[1,Math.floor((count-1)/2)+1,count];
  for(const index of indices)expected.push(['J'+String(expected.length+1).padStart(2,'0'),chapter,String(index).padStart(3,'0')]);
 }
 assert.deepEqual(policy.casePaths,expected);
 assert.equal(new Set(policy.casePaths.map(x=>x[1]+'/'+x[2])).size,20);
});

test('exact source archive and 20 problem PNGs are hash-checked and archived, not scored or simulated',()=>{
 const bytes=readFileSync(resolve(root,policy.sourceArchive));
 assert.equal(digest(bytes),policy.sourceArchiveSha256,'Original archive hash must match the frozen supplied source');
 const output=resolve(root,'test-artifacts/llm-authoring/jee-post164-coverage-v1');
 assert.equal(existsSync(output),false,'source evidence must not overwrite an earlier attempt');
 mkdirSync(resolve(output,'sources'),{recursive:true});
 const rows=[];
 for(const [id,chapter,number] of policy.casePaths){
  const problemPath='08_Ray_Optics_Explanations/'+chapter+'/Problems/'+number+'.png';
  assert.ok(problemPath.includes('/Problems/')&&!problemPath.includes('/Solutions/'));
  const png=readProblemPng(bytes,problemPath);
  const imageSha256=digest(png);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.ok(width>0&&height>0);
  writeFileSync(resolve(output,'sources',id+'.png'),png,{flag:'wx'});
  rows.push({id,problemPath,imageSha256,width,height,sourceInspection:'pending-visual-review',nativeStatus:'not-run',independentModelBenchmark:false});
 }
 const manifest={format:'opticsim-jee-post164-source-manifest-v1',status:'source-material-verified-only',engineBaseline:policy.engineBaseline,engineTree:policy.engineTree,sourceArchive:policy.sourceArchive,sourceArchiveSha256:digest(bytes),count:rows.length,solutionsRead:false,nativeExecutions:0,modelCalls:0,priorAtlasExposurePossible:true,cases:rows};
 writeFileSync(resolve(output,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 writeFileSync(resolve(output,'selection-policy.json'),JSON.stringify(policy,null,2)+'\n',{flag:'wx'});
 assert.equal(rows.length,20);
 console.log('JEE_POST164_SOURCE_MATERIAL '+JSON.stringify(manifest));
});
