// Synthetic, public Opticsim problem-workflow acceptance for the OPTIONAL,
// NONCERTIFYING finite Glass diagnostic. No source-image interpretation,
// unapproved physics adjustment, automatic retry, or answers are generated.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=resolve(process.env.OPTICSIM_FINITE_HIT_OUTPUT||
  'test-artifacts/llm-authoring/finite-hit-diagnostic-v1');
mkdirSync(resolve(root,'..'),{recursive:true});mkdirSync(root);
const core=createRequire(import.meta.url)(resolve('dist/test-core.cjs'));
const source=JSON.parse(readFileSync(new URL('../examples/polygon-dielectric.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const sample=()=>structuredClone(source);
const advisory={id:'geometry-advisory',kind:'finite-hit-numerical-diagnostic',componentId:'G1'};
const outcomes=[];
async function run(name,make,expected){
 const input=sample();make(input);input.requests=[advisory,...input.requests];
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 const dir=join(root,name);
 writeFileSync(join(root,name+'.request.json'),bytes,{flag:'wx'});
 const t=performance.now(),before=process.memoryUsage().heapUsed;
 const result=await runProblemEvidence({inputBytes:bytes,outputPath:dir,
   execute:(doc,requests)=>evaluateDocument(doc,core,requests)});
 const elapsed=performance.now()-t,heapDelta=process.memoryUsage().heapUsed-before;
 const report=result.report,diagnostic=report.results[0];
 assert.equal(report.inputSha256,hash(bytes));
 assert.equal(diagnostic.kind,advisory.kind);
 assert.equal(report.dispatch.nativeCalls,1);
 assert.equal(report.native.status,expected?.status??report.native.status);
 if(['completed','completed-with-warnings'].includes(report.native.status)){
   assert.equal(diagnostic.status,'advisory',name);
   assert.ok(['checked','checked-no-hit','unknown','inconsistent'].includes(diagnostic.value?.status),
     name+': '+JSON.stringify(diagnostic));
   assert.equal(diagnostic.value.nativeMeasurementQualificationUnchanged,true);
   assert.equal(diagnostic.method,'advisory-native-finite-hit-binary64-v1');
   assert.equal(report.coverage.available,report.results.slice(1).filter(r=>
     ['available','qualified','conditional'].includes(r.status)).length);
   assert.equal(result.exitCode,2,'Advisory is not counted as a physically answered quantity');
   assert.ok(diagnostic.warnings.some(w=>/NONCERTIFYING|not certified|NOT independently certified/i.test(w)));
 }else{
   assert.equal(diagnostic.status,'suppressed');
   assert.equal(diagnostic.value,null);
   assert.notEqual(result.exitCode,0);
 }
 assert.ok(!('finiteHitDiagnostic'in (JSON.parse(readFileSync(join(dir,'qualified-scene.json'))).scene)),
   'Saved qualified scene has no old run-specific diagnostic');
 const bundle=await parseQualifiedBundle(readFileSync(join(dir,'qualified-scene.json'),'utf8'));
 assert.equal(bundle.observables[0].kind,advisory.kind);
 assert.ok(!('execution'in bundle)&&!('results'in bundle));
 outcomes.push({name,sourceSha256:report.inputSha256,native:report.native.status,
   diagnostic:diagnostic.value?.status??null,reason:diagnostic.reasonCode,
   observed:diagnostic.value?.observedGlassIncidents??null,exitCode:result.exitCode,
   elapsedMs:elapsed,heapDeltaBytes:heapDelta});
 return {result,dir,input};
}
const normal=await run('normal-and-detector',()=>{},{status:'completed'});
const miss=await run('valid-zero-glass-hit',i=>{
 i.physical.components.find(c=>c.type==='point-source').parameters.y=30;
},{status:'completed'});
assert.equal(miss.result.report.results[0].value.status,'checked-no-hit');
const noDet=await run('zero-detectors',i=>{
 i.physical.components=i.physical.components.filter(c=>c.type!=='ray-detector');
 i.requests=i.requests.filter(c=>c.kind!=='detector-crossings');
},{status:'completed'});
const two=await run('two-detectors-two-sources',i=>{
 i.physical.components.push({...structuredClone(i.physical.components[0]),id:'S2',
   parameters:{...i.physical.components[0].parameters,y:2}});
 const old=i.physical.components.find(c=>c.type==='ray-detector');
 i.physical.components.push({...structuredClone(old),id:'D2',
   parameters:{...old.parameters,x:30}});
});
const four=await run('four-sources',i=>{
 for(const [j,y]of [[2,2],[3,3],[4,4]]){
   const s=i.physical.components.find(c=>c.type==='point-source');
   i.physical.components.push({...structuredClone(s),id:'S'+j,parameters:{...s.parameters,y}});
 }
});
const fresnel=await run('full-fresnel',i=>{
 i.physical.components.find(c=>c.type==='polygon-dielectric').parameters.partialReflection=true;
});
const matched=await run('full-fresnel-matched-index',i=>{
 const g=i.physical.components.find(c=>c.type==='polygon-dielectric').parameters;
 g.partialReflection=true;g.insideIndex=g.outsideIndex=1.5;
},{status:'completed'});
const angle=Math.asin(1.3/1.6)*180/Math.PI,rotation=37*Math.PI/180;
const rotate=({x,y})=>({x:x*Math.cos(rotation)-y*Math.sin(rotation),
  y:x*Math.sin(rotation)+y*Math.cos(rotation)});
await run('exposed-rotated-computed-critical',i=>{
 const src=i.physical.components.find(c=>c.type==='point-source');
 const glass=i.physical.components.find(c=>c.type==='polygon-dielectric');
 i.physical.lengthUnit='mm';
 const p=rotate({x:0,y:-100});
 src.parameters={x:p.x,y:p.y,brightness:1};
 src.emission.directionDeg=90-angle+37;
 const points=[[-3000,-1000],[3000,-1000],[3000,0],[-3000,0]].map(([x,y])=>rotate({x,y}));
 for(let j=1;j<=4;j++){glass.parameters['x'+j]=points[j-1].x;glass.parameters['y'+j]=points[j-1].y;}
 glass.parameters.insideIndex=1.6;glass.parameters.outsideIndex=1.3;
 i.physical.components=i.physical.components.filter(c=>c.type!=='ray-detector');
 i.requests=i.requests.filter(c=>c.kind!=='detector-crossings');
});
// The uncertain computed critical scene deliberately has no fixed completed,
// interaction-count, or branch expectation: the existing pinned engine has
// shown actual unchanged-input execution variability. Record, do not repair.
writeFileSync(join(root,'acceptance.json'),JSON.stringify({
 format:'opticsim-finite-hit-stage1-public-acceptance-v1',status:'passed',node:process.version,
 baseMain:'fa158fc78da7a35b6a02eaed58c0cdbd4b699220',
 noNewPhysics:true,advisoryNotAnAnswer:true,sourceInterpretationAssessed:false,
 nativeOriginalProblemSolved:false,teacherParticipants:0,
 cases:outcomes
},null,2)+'\n',{flag:'wx'});
console.log('FINITE_HIT_STAGE1_ACCEPTANCE '+JSON.stringify({status:'passed',cases:outcomes.length,
 outcomes:outcomes.map(x=>({name:x.name,native:x.native,diagnostic:x.diagnostic,
  observed:x.observed,exit:x.exitCode,elapsedMs:Number(x.elapsedMs.toFixed(2))}))}));
