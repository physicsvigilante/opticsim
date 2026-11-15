// Read-only native acceptance through the PUBLIC problem workflow.
// Each input is synthetic; no textbook image, inferred ray history, or model call.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parseQualifiedBundle} from '../src/qualification.js';
const DETECTOR_HIT_EVENT_LIMIT=32;
const root=resolve(process.env.OPTICSIM_DETECTOR_ACCEPTANCE_OUTPUT||'test-artifacts/llm-authoring/detector-hit-events-v2');
mkdirSync(resolve(root,'..'),{recursive:true});mkdirSync(root);
const fixture=n=>JSON.parse(readFileSync(new URL('../test/fixtures/detector-hit-'+n+'.json',import.meta.url),'utf8'));
const positions=[{id:'hits',kind:'detector-hit-events',componentId:'Dhit'},
 {id:'count',kind:'detector-crossings',componentId:'Dhit'}];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const saved=[],check=(name,source,expect)=>{
 const path=join(root,name+'.request.json');const bytes=Buffer.from(JSON.stringify(source,null,2)+'\n');
 writeFileSync(path,bytes,{flag:'wx'});
 const out=join(root,name),run=spawnSync(process.execPath,['scripts/run-problem.mjs',path,'--out',out],{encoding:'utf8',timeout:90000});
 assert.equal(run.status,expect.exit,`${name}: ${run.stdout}\n${run.stderr}`);
 const report=JSON.parse(readFileSync(join(out,'report.json')));
 assert.equal(report.inputSha256,hash(bytes),name+' immutable source');
 assert.equal(report.native.status,expect.native,name+' actual native status');
 assert.equal(report.dispatch.nativeCalls,expect.native==='not-run'?0:1);
 const readouts=report.results,hit=readouts.find(x=>x.id==='hits'),count=readouts.find(x=>x.id==='count');
 if(expect.count!==undefined){assert.equal(count?.value,expect.count);assert.equal(hit?.value?.length,expect.count);}
 if(expect.minCount){assert.ok(count.value>expect.minCount);assert.equal(hit.status,'unavailable');assert.equal(hit.value,null);}
 if(expect.suppressed)assert.ok(readouts.every(r=>r.status==='suppressed'&&r.value===null));
 if(expect.noNative)assert.equal(report.portable?.status,'not-created');
 saved.push({name,inputSha256:report.inputSha256,status:report.status,native:report.native.status,
  requestedResults:readouts.map(r=>({id:r.id,kind:r.kind,status:r.status,count:Array.isArray(r.value)?r.value.length:r.value??null,reason:r.reason??null})),
  output:out});
 return {report,output:out};
};
const source=(scene,requests=positions,policy)=>({format:'opticsim-problem-v1',
 physical:{lengthUnit:'mm',title:scene.presentation.title,...(policy?{runPolicy:policy}:{}),
  components:structuredClone(scene.physics.components)},requests});
const plate=fixture('plate'),lens=fixture('lens');
const initial=check('plate-initial',source(plate),{exit:0,native:'completed',count:2});
const packageText=readFileSync(join(initial.output,'qualified-scene.json'),'utf8');
const bundle=await parseQualifiedBundle(packageText);
assert.deepEqual(bundle.observables,positions);assert.equal(bundle.qualification.origin.preparationStatus,'fully-specified');
assert.equal(Object.hasOwn(bundle,'execution'),false);assert.equal(Object.hasOwn(bundle,'results'),false);
const changed=structuredClone(plate);changed.physics.components.find(c=>c.type==='planar-interface').parameters.positiveIndex=1.6;
const changedRun=check('plate-index-hypothesis',source(changed),{exit:0,native:'completed',count:2});
const a=initial.report.results[0].value,b=changedRun.report.results[0].value;
assert.notEqual(a[1].pointMm.x,b[1].pointMm.x);
const away=structuredClone(plate);away.physics.components.find(c=>c.type==='point-source').emission.directionDeg=180;
check('plate-miss',source(away),{exit:0,native:'completed',count:0});
check('lens-mirror',source(lens),{exit:0,native:'completed',count:11});
const high=JSON.parse(readFileSync(new URL('../scenes/general-source-detector.json',import.meta.url)));
high.physics.components.push({...structuredClone(high.physics.components[0]),id:'S2',
 parameters:{...high.physics.components[0].parameters,y:40}});
const highObs=positions.map(r=>({...r,componentId:'D1'}));
check('over-limit',source(high,highObs,'dense-v1'),{exit:2,native:'completed',minCount:DETECTOR_HIT_EVENT_LIMIT});
const fresnel=structuredClone(plate);fresnel.physics.components.find(c=>c.type==='planar-interface').parameters.partialReflection=true;
check('fresnel-incomplete',source(fresnel),{exit:2,native:'incomplete',suppressed:true});
const bad=structuredClone(plate);bad.physics.components.find(c=>c.type==='ray-detector').parameters.y=0;
check('invalid-intersection',source(bad),{exit:2,native:'not-run',noNative:true});
writeFileSync(join(root,'acceptance.json'),JSON.stringify({format:'opticsim-detector-hit-acceptance-v1',
 status:'passed',checks:saved.length,source:'synthetic; ordinary public authoring, native observation and qualification',
 limit:DETECTOR_HIT_EVENT_LIMIT,results:saved,originalProblemSolved:false,
 nativeRayHistoryCreated:false,independentLLMTest:false},null,2)+'\n');
console.log('Detector hit-position acceptance PASS: '+saved.length+' expected outcomes; public native results, bounded refusals and retained provenance.');
