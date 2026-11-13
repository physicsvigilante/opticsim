// Development follow-ups: preserve original input bytes and actual native outcomes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle,createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {reviseScene} from '../src/authoring.js';
import {canonicalJSON} from '../src/qualified-utils.js';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const folder=resolve('test-artifacts/llm-authoring/curved-mirrors');
mkdirSync(folder,{recursive:true});
const save=(name,value)=>writeFileSync(resolve(folder,name),Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const followup=JSON.parse(readFileSync('evaluation/curved-mirror-v1/followups.json'));
const sealed=readFileSync('evaluation/unified-workflow-v1/first-attempt.json');
assert.equal(hash(Buffer.from(canonicalJSON(JSON.parse(sealed)))),followup.originalTrialCanonicalSha256);
const archive=readFileSync('08_Ray_Optics_Explanations.zip');
assert.equal(hash(archive),'03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939');
save('followups.json',followup);save('REVIEW.md',readFileSync('evaluation/curved-mirror-v1/REVIEW.md'));
const report={format:'opticsim-curved-mirror-acceptance-v1',status:'running',cases:[],browserBundles:{},solutionsRead:false,independentAccuracyScore:null};
async function run(name,request,expectedExit=0){
 const bytes=Buffer.from(JSON.stringify(request,null,2)+'\n');save(name+'.input.json',bytes);
 const result=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(folder,name),execute:scene=>evaluateDocument(scene,core)});
 assert.equal(result.exitCode,expectedExit,JSON.stringify(result.report));assert.equal(result.report.inputSha256,hash(bytes));
 report.cases.push({name,coverage:result.report.coverage,native:result.report.native.status,results:result.report.results,dispatch:result.report.dispatch});
 return result;
}
for(const c of followup.cases){
 const image=readProblemPng(archive,c.problemPath);assert.equal(hash(image),c.imageSha256);save(c.id+'.png',image);
 const r=await run(c.id,c.request,c.id==='B04'?2:0);
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
 if(c.id==='U2'){assert.ok(Math.abs(r.report.results[0].value.velocity.axial-40*Math.SQRT2)<1e-9);assert.ok(Math.abs(r.report.results[0].value.velocity.transverse+10*Math.SQRT2)<1e-9);}
 if(c.id==='B03'){assert.equal(r.report.results[0].value.imageHeight,-5);assert.equal(r.report.results[0].value.magnification,-2);}
 if(c.id==='B04-half-period'){assert.equal(r.report.results[0].value.imageKind,'at-infinity');assert.equal(r.report.results[0].value.magnification,null);}
}
for(const [name,type,sign] of [['native-ideal','ideal-curved-mirror',1],['native-circular','circular-arc-mirror',1],['native-convex','circular-arc-mirror',-1]]){
 const p={format:'opticsim-problem-v1',physical:{lengthUnit:'mm',title:name+' — explicitly synthetic apparatus',components:[
  {id:'S1',type:'point-source',parameters:{x:-300,y:5,brightness:.1},emission:{mode:'directional',directionDeg:0,angleDeg:10}},
  {id:'M1',type,parameters:{x:0,y:0,normalDeg:180,apertureHeight:80,...(type==='ideal-curved-mirror'?{focalLength:100}:{radius:200*sign})}}
 ]},requests:[{id:'image',kind:'curved-mirror-image',componentId:'M1'},{id:'reflections',kind:'mirror-reflections',componentId:'M1'}],
 interpretation:{requestedResult:'Synthetic native reflection check with a separate conditional Gaussian image calculation.',assumptions:['All numeric source and aperture values describe a deliberately constructed example, not an original question.']}};
 const r=await run(name,p);assert.equal(r.report.native.status,'completed');assert.ok(r.report.results[1].value>0);
 const filepath=resolve(folder,name,'qualified-scene.json');const b=await parseQualifiedBundle(readFileSync(filepath,'utf8'));
 assert.equal(b.scene.schemaVersion,6);assert.equal(b.qualification.calculations[0].kind,'curved-mirror-image');report.browserBundles[name]=filepath;
 if(name==='native-ideal'){
  const next=reviseScene(b.scene,{changes:[{id:'M1',section:'parameters',key:'focalLength',value:120}]}).document;
  const q=recordQualifiedEdit(b.scene,next,b.qualification),reopened=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(next,q,b.observables)));
  assert.equal(reopened.qualification.edits.at(-1).kind,'physics');assert.equal(reopened.scene.physics.components[1].parameters.focalLength,120);
 }
}
const missing={...followup.cases[0].request,physical:{...followup.cases[0].request.physical}};delete missing.physical.stationaryMirror;
assert.equal((await run('missing-stationarity',missing,2)).report.results[0].status,'needs-information');
const infinity={...followup.cases[0].request,physical:{...followup.cases[0].request.physical,objectDistance:20}};
assert.equal((await run('focal-velocity',infinity,2)).report.results[0].value,null);
assert.deepEqual(readFileSync('evaluation/unified-workflow-v1/first-attempt.json'),sealed);
report.status='pass';report.originalFirstAttemptUnchanged=true;save('report.json',report);
console.log('Curved-mirror acceptance PASS: '+report.cases.length+' cases; original U2/B03, limited B04, distinct native ideal/circular/convex models, and negative controls.');
