import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const base=()=>({lengthUnit:'cm',components:[
  {type:'point-source',parameters:{x:-25,y:2}},
  {type:'ideal-lens',parameters:{x:0,focalLength:12}}
]});
function temporary(t){
  const parent=resolve(root,'test-artifacts/llm-authoring');
  mkdirSync(parent,{recursive:true});
  const folder=mkdtempSync(resolve(parent,'audit-'));
  t.after(()=>rmSync(folder,{recursive:true,force:true}));
  return folder;
}
function cli(args){
  const p=spawnSync(process.execPath,['scripts/author-scene.mjs',...args],{cwd:root,encoding:'utf8'});
  assert.equal(p.status,1,p.stderr);
  return JSON.parse(p.stdout);
}
const incomplete='test/fixtures/problem-authoring/missing-focal.request.json';

test('audit: malformed or impossible numeric input is not missing information',()=>{
  for(const input of [null,[],{...base(),components:'lens'}]){
    assert.equal(resolveProblemRequest(input).status,'invalid-input');
  }
  const input=base();input.components[1].parameters.focalLength=0;
  assert.equal(resolveProblemRequest(input,{illustration:true}).status,'invalid-input');
});

test('audit: collect missing facts across components without masking unsupported physics',()=>{
  const input=base();delete input.components[1].parameters.focalLength;
  const out=resolveProblemRequest(input);
  const paths=out.issues.map(x=>x.path);
  for(const field of ['brightness','emission','focalLength','apertureHeight'])
    assert.ok(paths.some(p=>p.endsWith('.'+field)),field+' missing from diagnostics');
  const unsupported=base();unsupported.components[1].type='prism';
  assert.equal(resolveProblemRequest(unsupported).status,'unsupported');
});

test('audit: proposed assumptions differ from applied assumptions on blocked or strict runs',()=>{
  const input=base(),copy=structuredClone(input);
  const strict=resolveProblemRequest(input);
  assert.equal(strict.proposedChoices.length,3);
  assert.deepEqual(strict.appliedChoices,[]);
  const blocked=base();delete blocked.components[1].parameters.focalLength;
  const noScene=resolveProblemRequest(blocked,{illustration:true});
  assert.equal(noScene.prepared,null);
  assert.deepEqual(noScene.appliedChoices,[]);
  const accepted=resolveProblemRequest(input,{illustration:true});
  assert.equal(accepted.appliedChoices.length,3);
  assert.ok(accepted.appliedChoices.every(x=>typeof x.componentId==='string'));
  assert.equal(accepted.policyVersion,'illustration-v1');
  assert.equal(accepted.questionSupport,'not-assessed-by-engine');
  assert.deepEqual(input,copy);
});

test('audit: explicit invalid values and partial source emission cannot be defaulted away',()=>{
  const input=base();input.components[0].parameters.brightness=null;
  const out=resolveProblemRequest(input,{illustration:true});
  assert.equal(out.status,'invalid-input');
  assert.equal(out.prepared,null);
  const directional=base();directional.components[0].emission={mode:'directional',directionDeg:0};
  const result=resolveProblemRequest(directional,{illustration:true});
  assert.equal(result.status,'needs-information');
  assert.ok(result.issues.some(x=>x.path.endsWith('angleDeg')));
});

test('audit: reusing an output directory cannot pair an old scene with a new rejection report',t=>{
  const folder=temporary(t);
  const scene=resolve(folder,'scene.ray-optics-2d.json'),report=resolve(folder,'report.json');
  writeFileSync(scene,'old-scene-evidence');writeFileSync(report,'old-report-evidence');
  const out=cli(['problem',incomplete,'--illustrate','--out',folder]);
  assert.ok(out.issues.some(x=>x.code==='OUTPUT_EXISTS'));
  assert.equal(readFileSync(scene,'utf8'),'old-scene-evidence');
  assert.equal(readFileSync(report,'utf8'),'old-report-evidence');
});

test('audit: output path checks reject symbolic-link ancestors',t=>{
  const folder=temporary(t),target=resolve(folder,'target'),link=resolve(folder,'link');
  mkdirSync(target);
  try{symlinkSync(target,link,'dir');}catch(e){
    if(process.platform==='win32'&&e.code==='EPERM'){t.skip('symlink privilege unavailable');return;}
    throw e;
  }
  const out=cli(['problem',incomplete,'--illustrate','--out',resolve(link,'attempt')]);
  assert.ok(out.issues.some(x=>x.code==='UNSAFE_OUTPUT'));
  assert.equal(existsSync(resolve(target,'attempt')),false);
});

test('audit: fresh blocked output preserves submitted bytes and has no scene',t=>{
  const folder=temporary(t),outdir=resolve(folder,'new-attempt');
  const out=cli(['problem',incomplete,'--illustrate','--out',outdir]);
  assert.equal(out.native.status,'not-run');
  assert.equal(existsSync(resolve(outdir,'scene.ray-optics-2d.json')),false);
  const input=readFileSync(resolve(root,incomplete));
  assert.deepEqual(readFileSync(resolve(outdir,'input.json')),input);
  const saved=JSON.parse(readFileSync(resolve(outdir,'report.json'),'utf8'));
  assert.equal(saved.summary.inputSha256,createHash('sha256').update(input).digest('hex'));
  assert.deepEqual(saved.summary.problem.appliedChoices,[]);
});

test('audit: illustrative preparation executes actual native optics without certifying the question',()=>{
  const prepared=resolveProblemRequest(base(),{illustration:true});
  assert.equal(prepared.status,'illustrative');
  const result=evaluateDocument(prepared.prepared.document,core);
  assert.equal(result.summary.executionPassed,true);
  assert.ok(result.summary.native.emitted>0);
  assert.equal(result.summary.analysis.status,'unavailable');
  assert.equal(result.summary.interpretation,'not-assessed-by-engine');
  assert.equal(prepared.questionSupport,'not-assessed-by-engine');
});
