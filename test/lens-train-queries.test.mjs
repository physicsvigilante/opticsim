import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {analyzeLensTrainQuery,lensTrainCapabilities,LENS_FACTS_FORMAT,LENS_QUERY_FORMAT} from '../src/lens-train-queries.js';
import {calculateLensTrain} from '../src/lens-train-matrix.js';
import {predict} from '../src/analysis.js';
import {prepareScene} from '../src/authoring.js';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {sequentialLensReference} from './helpers/lens-sequential-reference.mjs';
const query=kind=>({format:LENS_QUERY_FORMAT,kind:kind||'lens-train-image'});
const facts=(objectX=-300,lenses=[{id:'L1',x:0,focalLength:100}])=>({format:LENS_FACTS_FORMAT,
  model:'coaxial-ideal-thin-lenses',signConvention:'x-increasing',lengthUnit:'mm',objectX,lenses});
const run=(f=facts(),kind)=>analyzeLensTrainQuery(f,query(kind));
const problem=f=>({format:'opticsim-problem-v1',physical:f,requests:[{id:'axial',kind:'lens-train-image'}]});
const close=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);
const fresh=()=>resolve('test-artifacts/llm-authoring/lens-facts-'+randomUUID());
const raw=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
const rejects=(f,code,kind)=>assert.throws(()=>run(f,kind),e=>e.code===code);
function nativeRequest(f,height=3){
 return {lengthUnit:f.lengthUnit,components:[{id:'S',type:'point-source',parameters:{x:f.objectX,y:height,brightness:.08},
  emission:{mode:'directional',directionDeg:0,angleDeg:8}},...f.lenses.map(l=>({id:l.id,type:'ideal-lens',parameters:{x:l.x,focalLength:l.focalLength,apertureHeight:100}}))]};
}

test('reduced lens capabilities expose a separate conditional operation and defensive data',()=>{
 const c=lensTrainCapabilities();assert.deepEqual(c.kinds,['lens-train-image','lens-train-image-height']);
 c.kinds.length=0;c.lenses.required.length=0;c.bounds.coordinateMm[0]=0;
 assert.equal(lensTrainCapabilities().kinds.length,2);assert.equal(lensTrainCapabilities().lenses.required.length,3);
 assert.equal(lensTrainCapabilities().bounds.coordinateMm[0],-10000);
 const all=problemWorkflowCapabilities();assert.equal(all.requestKinds['ideal-image'].route,'existing-analysis-with-native-gate');
 assert.equal(all.requestKinds['lens-train-image'].route,'conditional-analytical');
 assert.deepEqual(all.methodSuitability.contractFamilies[LENS_QUERY_FORMAT],[LENS_FACTS_FORMAT]);
});

test('source-level two-lens axial facts give 7.5 cm without illumination or a scene',()=>{
 const f=facts(-30,[{id:'L1',x:0,focalLength:20},{id:'L2',x:30,focalLength:10}]);f.lengthUnit='cm';
 const original=structuredClone(f),r=run(f),p=planProblem(problem(f));
 assert.equal(r.status,'conditional');assert.equal(r.value.imageDistance,7.5);assert.equal(r.value.imageX,37.5);assert.equal(r.value.magnification,-.5);
 assert.equal('imageHeight' in r.value,false);assert.equal(p.scene,null);assert.equal(p.preparation,null);assert.equal(p.native.canRun,false);
 assert.equal(r.native.status,'not-run');assert.equal(r.nativeImageDetected,false);assert.deepEqual(f,original);
 assert.equal(p.methodSuitability.entries[0].familyCompatibility,'form-compatible');
 assert.equal(p.methodSuitability.entries[0].readiness,'conditional-result');
});

test('single converging and diverging lenses preserve signed real and virtual image meaning',()=>{
 for(const [u,f,v,m] of [[300,100,150,-.5],[50,100,-100,2],[300,-100,-75,.25]]){
  const r=run(facts(-u,[{id:'L',x:0,focalLength:f}])).value;
  close(r.imageDistance,v);close(r.magnification,m);assert.equal(r.imageKind,v<0?'finite-virtual':'finite-real');
 }
});

test('intermediate virtual objects and collimated segments use the same forward kernel',()=>{
 for(const f of [facts(-300,[{id:'A',x:0,focalLength:200},{id:'B',x:300,focalLength:100}]),
  facts(-100,[{id:'A',x:0,focalLength:100},{id:'B',x:150,focalLength:60}]),
  facts(-200,[{id:'A',x:0,focalLength:100},{id:'B',x:200,focalLength:-80},{id:'C',x:300,focalLength:60}])]){
  const ref=sequentialLensReference(f.objectX,f.lenses),v=run(f).value;assert.ok(v);
  close(v.imageDistance,ref.distance);close(v.imageX,ref.x);close(v.magnification,ref.magnification);
 }
});

test('height request is independent: axial data never invent an object or image height',()=>{
 const f=facts(),p=problem(f);p.requests.push({id:'height',kind:'lens-train-image-height'});
 let plan=planProblem(p);assert.equal(plan.results[0].status,'conditional');assert.equal(plan.results[1].status,'needs-information');
 assert.equal('imageHeight' in plan.results[0].value,false);assert.equal(plan.scene,null);
 for(const h of [0,4,-4]){const withHeight={...f,objectHeight:h},r=run(withHeight,'lens-train-image-height');
  close(r.value.imageHeight,-.5*h);assert.equal('imageHeight' in run(withHeight).value,false);}
});

test('exact computed infinity, near singularity and missing height have distinct outcomes',()=>{
 const focused=facts(-100);let r=run(focused);assert.equal(r.status,'conditional');assert.equal(r.value.imageKind,'at-infinity');
 assert.equal(r.value.imageX,null);assert.equal(r.value.imageDistance,null);assert.equal(r.value.magnification,null);assert.equal('imageHeight' in r.value,false);
 rejects(focused,'MISSING_FACTS','lens-train-image-height');r=run({...focused,objectHeight:2},'lens-train-image-height');
 assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,'NO_FINITE_IMAGE_HEIGHT');
 const near=run(facts(-100.000000001));assert.equal(near.status,'numerically-indeterminate');assert.equal(near.value,null);
 const legacy=calculateLensTrain(-100.000000001,[{x:0,focalLength:100}],2).prediction;assert.equal(legacy.kind,'at-infinity','historical tolerance meaning retained');
 for(const x of [-99.99,-100.01])assert.equal(run(facts(x)).status,'conditional');
});

test('extreme cancellation is withheld by the unchanged matrix consistency check',()=>{
 const f=facts(-9000,[{id:'A',x:0,focalLength:1},{id:'B',x:150,focalLength:1},{id:'C',x:300,focalLength:1}]);
 const r=run(f);assert.equal(r.status,'numerically-indeterminate');assert.equal(r.reasonCode,'UNRELIABLE_LENS_MATRIX');assert.equal(r.value,null);
});

test('different dimensional units and input ordering preserve results and caller bytes',()=>{
 const f=facts(-300,[{id:'First',x:0,focalLength:200},{id:'Last',x:300,focalLength:100}]),original=raw(f);
 const ref=run(f).value;
 for(const [unit,scale] of [['mm',1],['cm',10],['m',1000]]){
  const g=structuredClone(f);g.lengthUnit=unit;g.objectX/=scale;g.lenses.reverse();g.lenses.forEach(l=>{l.x/=scale;l.focalLength/=scale;});
  const v=run(g).value;close(v.imageX*scale,ref.imageX);close(v.imageDistance*scale,ref.imageDistance);
  close(v.magnification,ref.magnification);assert.equal(v.referenceLensId,'Last');
 }
 assert.deepEqual(raw(f),original);
 const moved=structuredClone(f);moved.objectX+=135;for(const l of moved.lenses)l.x+=135;
 const m=run(moved).value;close(m.imageDistance,ref.imageDistance);close(m.imageX,ref.imageX+135);
});

test('missing essential facts and unsupported models are rejected without defaults',()=>{
 for(const key of ['model','signConvention','lengthUnit','objectX','lenses']){const f=facts();delete f[key];rejects(f,'MISSING_FACTS');}
 for(const key of ['id','x','focalLength']){const f=facts();delete f.lenses[0][key];rejects(f,'MISSING_FACTS');}
 for(const model of ['material-lens','thick-lens','coaxial-ideal-thin-lens'])rejects({...facts(),model},'UNSUPPORTED_MODEL');
 rejects({...facts(),signConvention:'right-to-left'},'UNSUPPORTED_SCOPE');
 for(const u of ['inch',['mm'],null,{},'__proto__'])rejects({...facts(),lengthUnit:u},'INVALID_LENS_FACTS');
});

test('invalid types, IDs, scope and coincident planes cannot manufacture a train',()=>{
 for(const x of [null,'-300',true,NaN,Infinity])rejects({...facts(),objectX:x},'INVALID_LENS_FACTS');
 for(const x of [0,100,-.001,10001])rejects({...facts(),objectX:x},'UNSUPPORTED_SCOPE');
 for(const f of [0,.5,10001])rejects(facts(-300,[{id:'L',x:0,focalLength:f}]),'UNSUPPORTED_SCOPE');
 rejects(facts(-300,[]),'UNSUPPORTED_SCOPE');rejects(facts(-300,Array.from({length:5},(_,i)=>({id:'L'+i,x:50*i,focalLength:100}))),'UNSUPPORTED_SCOPE');
 for(const bad of [null,{id:'1wrong',x:0,focalLength:100},{id:'L',x:'0',focalLength:100}]){
  assert.throws(()=>run(facts(-300,[bad])));
 }
 rejects(facts(-300,[{id:'L',x:0,focalLength:100},{id:'L',x:150,focalLength:100}]),'INVALID_LENS_FACTS');
 rejects(facts(-300,[{id:'L1',x:0,focalLength:100},{id:'L2',x:0,focalLength:100}]),'UNSUPPORTED_SCOPE');
});

test('mixed optics, hidden routes, extra quantities and arbitrary source fields are not silently dropped',()=>{
 for(const [key,value] of [['components',[{type:'plane-mirror'}]],['route',['L1']],['brightness',1],['objectVelocity',3],['solvedImage',150]])
  rejects({...facts(),[key]:value},'INVALID_LENS_FACTS');
 const wrong=facts();wrong.lenses[0].type='plane-mirror';rejects(wrong,'INVALID_LENS_FACTS');
 rejects(nativeRequest(facts()),'UNSUPPORTED_FACTS');
 assert.throws(()=>analyzeLensTrainQuery(facts(),{...query(),componentId:'L1'}),e=>e.code==='INVALID_LENS_FACTS');
 assert.throws(()=>analyzeLensTrainQuery(facts(),query('lens-inverse')),e=>e.code==='UNSUPPORTED_QUERY');
});

test('one focal revision changes no unrelated fact and recomputes the ideal answer',()=>{
 const f=facts(-300,[{id:'L1',x:0,focalLength:200},{id:'L2',x:300,focalLength:100}]),before=raw(f),child=structuredClone(f);
 child.lenses[1].focalLength=150;close(run(child).value.imageDistance,100);close(run(f).value.imageDistance,75);
 const restored=structuredClone(child);restored.lenses[1].focalLength=100;assert.deepEqual(raw(restored),before);assert.deepEqual(raw(f),before);
});

test('164 frozen historical predictions retain exact fields and bytes after extracting the shared kernel',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/lens-train-legacy-baseline.json',import.meta.url)));
 assert.equal(fixture.baselineAnalysisGitBlob,'f0fe74f899b5b151c088a12e023f600446249749');assert.equal(fixture.records.length,164);
 for(const c of fixture.records){
  const result=calculateLensTrain(c.objectX,c.lenses,c.objectHeight).prediction;
  assert.equal(JSON.stringify(result),JSON.stringify(c.prediction),c.id+' kernel');
  const f=facts(c.objectX,c.lenses.map((l,i)=>({id:'L'+i,...l}))),doc=prepareScene(nativeRequest(f,c.objectHeight)).document;
  doc.physics.model='ideal-thin-lens-geometric';assert.equal(JSON.stringify(predict(doc)),JSON.stringify(c.prediction),c.id+' existing predictor');
 }
});

test('independent rational conjugates agree across bounded one-to-four-lens arrangements',()=>{
 let checked=0;
 for(let n=1;n<=4;n++)for(let k=0;k<18;k++){
  const ls=Array.from({length:n},(_,i)=>({id:'L'+i,x:i*(65+k),focalLength:(i+k)%3===0?-(70+k+i*9):80+k*3+i*25}));
  const f=facts(-180-k*5,ls),ref=sequentialLensReference(f.objectX,ls,3),r=run({...f,objectHeight:3},'lens-train-image-height');
  assert.equal(r.status,'conditional');assert.equal(r.value.imageKind,ref.kind);close(r.value.imageX,ref.x);
  close(r.value.imageDistance,ref.distance);close(r.value.magnification,ref.magnification);close(r.value.imageHeight,ref.y);checked++;
 }
 assert.equal(checked,72);
});

test('public workflow evidence is immutable and invokes no native executor for reduced facts',async()=>{
 const input=problem(facts()),bytes=raw(input),out=fresh();let calls=0;
 const result=await runProblemEvidence({inputBytes:bytes,outputPath:out,execute:()=>{calls++;throw Error('must not execute');}});
 assert.equal(calls,0);assert.equal(result.exitCode,0);assert.equal(result.report.native.status,'not-run');assert.equal(result.report.dispatch.nativeCalls,0);
 assert.equal(result.report.portable.status,'not-created');assert.equal(result.report.inputSha256,sha(bytes));
 assert.deepEqual(readFileSync(resolve(out,'input.json')),bytes);assert.equal(existsSync(resolve(out,'qualified-scene.json')),false);
 const plan=JSON.parse(readFileSync(resolve(out,'plan.json')));assert.equal(plan.scene,null);assert.equal(plan.calculations.length,1);
 const report=JSON.parse(readFileSync(resolve(out,'analytical-results.json')));assert.equal(report.calculations[0].result.nativeImageDetected,false);
 await assert.rejects(()=>runProblemEvidence({inputBytes:bytes,outputPath:out}));
 const proc=spawnSync(process.execPath,['scripts/preflight-problem.mjs',resolve(out,'input.json')],{encoding:'utf8'});
 assert.equal(proc.status,0,proc.stderr);const preflight=JSON.parse(proc.stdout);assert.equal(preflight.status,'no-native-required');assert.equal(preflight.scenePrepared,false);
});

test('native requests and explicit verification remain unresolved rather than borrowing analytical success',async()=>{
 for(const input of [{...problem(facts()),verifyNative:true},{...problem(facts()),requests:[{id:'a',kind:'lens-train-image'},{id:'n',kind:'ideal-image',componentId:'S'}]}]){
  let calls=0;const r=await runProblemEvidence({inputBytes:raw(input),outputPath:fresh(),execute:()=>{calls++;throw Error('no native scene');}});
  assert.equal(calls,0);assert.equal(r.report.native.status,'not-run');assert.equal(r.exitCode,2);assert.equal(r.report.portable.status,'not-created');
  assert.equal(r.report.results[0].status,'conditional');if(r.report.results.length>1)assert.equal(r.report.results[1].status,'needs-information');
 }
});

test('mixed request outcomes, missing facts and unknown operations retain their own result states',()=>{
 const p=problem(facts());p.requests.push({id:'height',kind:'lens-train-image-height'},{id:'unknown',kind:'ideal-telescope'});
 const plan=planProblem(p);assert.deepEqual(plan.results.map(r=>r.status),['conditional','needs-information','unavailable']);assert.equal(plan.scene,null);
 assert.equal(planProblem({...p,physical:null}).results[0].status,'needs-information');
 assert.throws(()=>planProblem({...p,requests:Array.from({length:5},(_,i)=>({id:'a'+i,kind:'lens-train-image'}))}),/At most four/);
 assert.throws(()=>planProblem({...p,requests:[{id:'a',kind:'lens-train-image',componentId:'L1'}]}),/Unsupported lens/);
 const notAuto=planProblem({...problem(facts()),requests:[{id:'image',kind:'ideal-image'}]});assert.equal(notAuto.results[0].status,'needs-information');
});

test('both existing CLIs compute lens facts in a copy containing no vendor, build or native core',async()=>{
 const {mkdtempSync,cpSync,writeFileSync}=await import('node:fs');
 const isolated=mkdtempSync(resolve('test-artifacts/lens-facts-node-only-'));
 for(const dir of ['src','scripts','skills'])cpSync(resolve(dir),resolve(isolated,dir),{recursive:true});
 writeFileSync(resolve(isolated,'package.json'),' {"type":"module"}\n');
 writeFileSync(resolve(isolated,'request.json'),raw(problem(facts())));
 assert.equal(existsSync(resolve(isolated,'vendor')),false);assert.equal(existsSync(resolve(isolated,'dist')),false);
 for(const [script,args] of [['preflight-problem.mjs',['request.json']],['run-problem.mjs',['request.json','--out','test-artifacts/llm-authoring/run']]]){
  const p=spawnSync(process.execPath,['scripts/'+script,...args],{cwd:isolated,encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).native.status,'not-run');
 }
 assert.equal(existsSync(resolve(isolated,'dist')),false);
 const r=JSON.parse(readFileSync(resolve(isolated,'test-artifacts/llm-authoring/run/report.json')));
 assert.equal(r.dispatch.nativeCalls,0);assert.equal(r.dispatch.externalModelCalls,0);
});

test('floating-point zero caused by an unreliable focus matrix is not accepted as infinity',()=>{
 const f=facts(-9000,[{id:'A',x:0,focalLength:1},{id:'B',x:150,focalLength:1},{id:'C',x:300,focalLength:148.99324323817004}]);
 const old=calculateLensTrain(f.objectX,f.lenses,3);assert.equal(old.matrix.d,0);assert.equal(old.prediction.kind,'at-infinity');
 assert.ok(Math.abs(-old.matrix.b*old.matrix.c-1)>1e-7);
 const r=run(f);assert.equal(r.status,'numerically-indeterminate');assert.equal(r.reasonCode,'UNRELIABLE_LENS_MATRIX');assert.equal(r.value,null);
});
