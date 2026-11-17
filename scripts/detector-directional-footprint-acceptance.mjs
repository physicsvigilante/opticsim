// Public CLI acceptance of a new opt-in *derived* native measurement.
// Do not mistake unweighted sampled detector spread for a measured PSF,
// physical image, brightness-weighted exposure, or source-attributed ray.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseQualifiedBundle} from '../src/qualification.js';
const out=resolve(process.env.OPTICSIM_FOOTPRINT_ACCEPTANCE_OUTPUT||
 'test-artifacts/llm-authoring/detector-directional-footprint-v1');
mkdirSync(resolve(out,'..'),{recursive:true});mkdirSync(out);
const sourceFixture=name=>JSON.parse(readFileSync(
 new URL('../test/fixtures/detector-hit-'+name+'.json',import.meta.url),'utf8'));
const requests=id=>[{id:'foot',kind:'detector-directional-footprint',componentId:id},
 {id:'crossings',kind:'detector-crossings',componentId:id}];
const source=(doc,requests,runPolicy=null)=>({format:'opticsim-problem-v1',
 physical:{title:doc.presentation.title,lengthUnit:'mm',
  ...(runPolicy?{runPolicy}:{}),components:structuredClone(doc.physics.components)},
 requests,interpretation:{requestedResult:'Measure actual native detector crossing directions and sampled positions only.',stated:[],derived:[],
  assumptions:['Finite native sampled ray statistics are not continuous intensity or a detected image.'],
  unknowns:['No source identity, completed ray path or physical point-spread function is inferred.']}});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const close=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const evidence=[];
function execute(name,request,{exit,status,count=null,positive=null,negative=null,withheld=false}){
 const file=join(out,name+'.request.json'),bytes=Buffer.from(JSON.stringify(request,null,2)+'\n');
 writeFileSync(file,bytes,{flag:'wx'});
 const dir=join(out,name),run=spawnSync(process.execPath,
  ['scripts/run-problem.mjs',file,'--out',dir],{encoding:'utf8',timeout:90000});
 assert.equal(run.status,exit,`${name}: ${run.stdout}\n${run.stderr}`);
 const report=JSON.parse(readFileSync(join(dir,'report.json'),'utf8'));
 assert.equal(report.inputSha256,digest(bytes));assert.equal(report.native.status,status);
 const a=report.results.find(x=>x.kind==='detector-directional-footprint'),
  b=report.results.find(x=>x.kind==='detector-crossings');
 assert.ok(a&&b,'Every requested kind remains present');
 if(count!==null){assert.equal(b.value,count);assert.equal(a.value?.observedCount,count);}
 if(positive!==null)assert.equal(a.value?.towardPositiveNormal?.count,positive);
 if(negative!==null)assert.equal(a.value?.towardNegativeNormal?.count,negative);
 if(withheld)assert.ok(report.results.every(r=>r.value===null&&r.status==='suppressed'));
 else if(a.value){
  assert.equal(a.value.towardPositiveNormal.count+a.value.towardNegativeNormal.count,a.value.observedCount);
  assert.ok(!JSON.stringify(a.value).includes('sourceId'));
  assert.ok(!JSON.stringify(a.value).includes('rayToken'));
 }
 evidence.push({name,sha256:report.inputSha256,nativeStatus:report.native.status,
  publicResults:report.results.map(r=>({kind:r.kind,status:r.status,
   reportedCount:r.value?.observedCount??r.value??null,reasonCode:r.reasonCode??null})),
  output:dir});
 return {dir,report};
}
const plate=sourceFixture('plate'),lens=sourceFixture('lens');
const first=execute('plate-two-directions',source(plate,requests('Dhit')),
 {exit:0,status:'completed',count:2,positive:1,negative:1});
const fp=first.report.results[0].value;
close(fp.towardPositiveNormal.rmsSpreadMm,0);close(fp.towardNegativeNormal.rmsSpreadMm,0);
const packageText=readFileSync(join(first.dir,'qualified-scene.json'),'utf8');
const bundle=await parseQualifiedBundle(packageText);
assert.deepEqual(bundle.observables,requests('Dhit'));
assert.equal(Object.hasOwn(bundle,'execution'),false);
assert.equal(Object.hasOwn(bundle,'results'),false);
execute('lens-mirror-crossings',source(lens,requests('Dhit')),
 {exit:0,status:'completed',count:11,positive:5,negative:6});
const miss=sourceFixture('plate');miss.physics.components.find(c=>c.type==='point-source').emission.directionDeg=180;
const absent=execute('true-detector-miss',source(miss,requests('Dhit')),
 {exit:0,status:'completed',count:0,positive:0,negative:0});
assert.equal(absent.report.results[0].value.towardPositiveNormal.rmsSpreadMm,null);
assert.equal(absent.report.results[0].value.towardNegativeNormal.meanPointMm,null);
const tooMany=JSON.parse(readFileSync(new URL('../scenes/general-source-detector.json',import.meta.url)));
tooMany.physics.components.push({...structuredClone(tooMany.physics.components[0]),id:'S2',
 parameters:{...tooMany.physics.components[0].parameters,y:40}});
const overflow=execute('over-32-native-crossings',source(tooMany,requests('D1'),'dense-v1'),
 {exit:2,status:'completed'});
assert.equal(overflow.report.results[0].status,'unavailable');
assert.equal(overflow.report.results[0].value,null);
assert.ok(overflow.report.results[1].value>32);
const fresnel=sourceFixture('plate');
fresnel.physics.components.find(c=>c.type==='planar-interface').parameters.partialReflection=true;
execute('incomplete-fresnel',source(fresnel,requests('Dhit')),
 {exit:2,status:'incomplete',withheld:true});
writeFileSync(join(out,'acceptance.json'),JSON.stringify({
 format:'opticsim-native-detector-directional-footprint-acceptance-v1',
 status:'passed',source:'synthetic public CLI, pinned native physics',
 checks:evidence.length,sampledOnly:true,physicalImageDetected:false,
 continuousIrradianceMeasured:false,independentOpticsExpertReview:false,
 evidence
},null,2)+'\n',{flag:'wx'});
console.log('Directional native detector footprint public acceptance PASS: '+evidence.length+
 ' real CLI cases; no image/source attribution and incomplete evidence withheld.');
