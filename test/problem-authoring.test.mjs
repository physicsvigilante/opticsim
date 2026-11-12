import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {prepareScene} from '../src/authoring.js';
import {validate} from '../src/contract.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const make=()=>({
  lengthUnit:'cm',
  components:[
    {id:'S1',type:'point-source',parameters:{x:-25,y:2}},
    {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:12}}
  ]
});
const exact=()=>{
  const r=make();
  r.components[0].parameters.brightness=.08;
  r.components[0].emission={mode:'full-circle'};
  r.components[1].parameters.apertureHeight=10;
  return r;
};
test('full specification is unchanged and canonical data is strict',()=>{
  const input=exact(),original=structuredClone(input);
  const r=resolveProblemRequest(input);
  assert.equal(r.status,'fully-specified');
  assert.deepEqual(r.choices,[]);
  assert.equal(validate(r.prepared.document),r.prepared.document);
  assert.deepEqual(r.prepared.document,prepareScene(input).document);
  assert.deepEqual(input,original);
});
test('illustration is explicit, deterministic, provenance-rich and outside saved scene',()=>{
  const input=make(),original=structuredClone(input);
  const strict=resolveProblemRequest(input);
  assert.equal(strict.status,'needs-information');
  assert.equal(strict.prepared,null);
  assert.equal(strict.choices.length,3);
  const a=resolveProblemRequest(input,{illustration:true});
  const b=resolveProblemRequest(input,{illustration:true});
  assert.equal(a.status,'illustrative');
  assert.deepEqual(a.choices,b.choices);
  assert.deepEqual(a.prepared.document,b.prepared.document);
  assert.equal(a.prepared.document.physics.components[0].parameters.brightness,.08);
  assert.equal(a.prepared.document.physics.components[0].emission.mode,'full-circle');
  assert.equal(a.prepared.document.physics.components[1].parameters.apertureHeight,100);
  assert.ok(a.choices.every(c=>c.purpose.includes('illustrative')));
  assert.deepEqual(input,original);
  assert.ok(!JSON.stringify(a.prepared.document).includes('illustrative'));
  assert.equal(a.physicalFidelity,'not-assessed-by-engine');
  assert.equal(a.interpretation,'not-assessed-by-engine');
});
test('aperture choices convert units correctly without changing native length',()=>{
  for(const [unit,scale] of [['mm',1],['cm',10],['m',1000]]){
    const input=make();input.lengthUnit=unit;
    // Keep the same physical geometry (mm) in every input unit.
    input.components[0].parameters.x=-250/scale;
    input.components[0].parameters.y=20/scale;
    input.components[1].parameters.focalLength=120/scale;
    const r=resolveProblemRequest(input,{illustration:true});
    assert.equal(r.status,'illustrative');
    const choice=r.choices.find(c=>c.path.endsWith('apertureHeight'));
    assert.equal(choice.value,100/scale);
    assert.equal(choice.canonicalValueMm,100);
    assert.equal(r.prepared.document.physics.components[1].parameters.apertureHeight,100);
  }
});
test('missing essential geometry blocks scene despite illustration opt-in',()=>{
  const r=make();delete r.components[1].parameters.focalLength;
  const out=resolveProblemRequest(r,{illustration:true});
  assert.equal(out.status,'needs-information');
  assert.equal(out.prepared,null);
  assert.ok(out.issues.some(x=>x.path.endsWith('focalLength')&&x.code==='MISSING_VALUE'));
});
test('directional emission is not guessed and partial angle settings cannot become full-circle',()=>{
  const r=make();r.components[0].emission={mode:'directional',directionDeg:0};
  const out=resolveProblemRequest(r,{illustration:true});
  assert.equal(out.status,'needs-information');
  assert.equal(out.prepared,null);
  assert.ok(out.issues.some(x=>x.path.endsWith('angleDeg')));
  const p=make();p.components[0].emission={mode:'directional'};
  assert.equal(resolveProblemRequest(p,{illustration:true}).status,'needs-information');
});
test('unsupported apparatus cannot be transformed into a substitute',()=>{
  const r=make();r.components[1].type='prism';
  const out=resolveProblemRequest(r,{illustration:true});
  assert.equal(out.status,'unsupported');
  assert.equal(out.prepared,null);
  assert.ok(out.issues.some(x=>x.code==='UNSUPPORTED_COMPONENT'));
});
test('CLI rejects blocked problem before native build and omits scene artifact',()=>{
  const cli=spawnSync(process.execPath,['scripts/author-scene.mjs','problem',
    'test/fixtures/problem-authoring/missing-focal.request.json','--illustrate'],
    {cwd:root,encoding:'utf8'});
  assert.equal(cli.status,1,cli.stderr);
  const report=JSON.parse(cli.stdout);
  assert.equal(report.problem.status,'needs-information');
  assert.equal(report.native.status,'not-run');
  assert.equal(report.document,undefined);
});
test('CLI offers discoverable minimal-authoring policy without native setup',()=>{
  const cli=spawnSync(process.execPath,
    ['scripts/author-scene.mjs','problem-capabilities'],{cwd:root,encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  const c=JSON.parse(cli.stdout);
  assert.equal(c.problemAuthoring.optInFlag,'--illustrate');
  assert.deepEqual(c.problemAuthoring.statuses,
    ['fully-specified','illustrative','needs-information','unsupported','invalid-input']);
  assert.equal(c.problemAuthoring.interfaceVersion,2);
  assert.equal(c.componentTypes['ideal-lens'].parameters.includes('focalLength'),true);
});
