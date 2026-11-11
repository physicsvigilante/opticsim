import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {capabilities,prepareScene,reviseScene,AuthoringError} from '../src/authoring.js';
import {validate,serializeSave,parseSave,GENERAL_SCOPE,COMPONENT_TYPES,
  COMPONENT_BOUNDS,componentParameterNames,UPSTREAM} from '../src/contract.js';
import {predict} from '../src/analysis.js';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=(name,suffix='request')=>JSON.parse(readFileSync(
  new URL('../'+(suffix==='request'?'test/fixtures/llm-authoring/':'scenes/')+
    name+'.'+(suffix==='request'?'request.json':'json'),import.meta.url)));
const names=['general-source-detector','general-two-source-lens','general-mirror-pair',
  'general-source-only'];
const errorCode=(fn,code,part='')=>assert.throws(fn,e=>
  e instanceof AuthoringError&&e.issues.some(x=>x.code===code&&x.path.includes(part)),
  'Expected AuthoringError '+code+' '+part);
const emitted=(run)=>run.native.diagnostics.emitted;
const noWarnings=(run)=>assert.deepEqual(run.native.diagnostics.warnings,[]);

test('capabilities use the live supported component names, physical fields, bounds and count limits',()=>{
  const c=capabilities();
  assert.equal(c.interfaceVersion,1);
  assert.equal(c.model,'general-component-tracing');
  assert.equal(c.nativeUpstreamCommit,UPSTREAM);
  assert.deepEqual(Object.keys(c.componentTypes),COMPONENT_TYPES);
  assert.deepEqual(c.bounds,COMPONENT_BOUNDS);
  for(const name of COMPONENT_TYPES){
    assert.deepEqual(c.componentTypes[name].parameters,componentParameterNames(name));
    assert.deepEqual(c.componentTypes[name].counts,GENERAL_SCOPE[name]);
  }
  assert.ok(c.limitations.some(x=>x.includes('not watts')));
  assert.equal(c.runPolicies['preview-v1'].rayDensity,.2);
});

test('LLM requests prepare deterministic canonical scenes; no canonical fields or physics are guessed',()=>{
  for(const name of names){
    const input=fixture(name),original=structuredClone(input);
    const prepared=prepareScene(input);
    assert.equal(validate(prepared.document),prepared.document);
    assert.deepEqual(prepared.document,fixture(name,'scene'),name);
    assert.deepEqual(parseSave(serializeSave(prepared.document)),prepared.document);
    assert.deepEqual(input,original);
    assert.equal(prepared.document.physics.model,'general-component-tracing');
    assert.equal(prepared.document.upstreamCommit,UPSTREAM);
    assert.equal(prepared.preparation.canonicalLengthUnit,'mm');
    assert.ok(prepared.document.presentation.view.zoom>=.03);
    assert.deepEqual(prepared.preparation.assignedIds,[]);
    assert.equal(predict(prepared.document).kind,'unavailable');
  }
});

test('general tracing removes mandatory apparatus types while keeping old restricted models strict',()=>{
  for(const name of names){
    const doc=prepareScene(fixture(name)).document;
    const n=doc.physics.components.filter(c=>c.type==='point-source').length;
    assert.ok(n>=1);
    assert.equal(validate(doc),doc);
    const original=structuredClone(doc);
    doc.physics.model='mixed-lens-mirror-tracing';
    errorCode(()=>prepareScene({...fixture(name),components:[]}),
      'INVALID_COMPONENTS');
    if(name!=='general-mirror-pair')assert.throws(()=>validate(doc),/mixed tracing supports/);
    assert.equal(original.physics.model,'general-component-tracing');
  }
  const old=fixture('general-two-source-lens','scene');
  old.physics.model='ideal-thin-lens-geometric';
  assert.throws(()=>validate(old),/lens bench supports/);
});

test('missing physics and unapproved components are rejected with actionable exact field paths',()=>{
  const raw=fixture('general-source-detector');
  const invalid=[
    [r=>{delete r.components[0].parameters.brightness;},'MISSING_VALUE','brightness'],
    [r=>{delete r.components[1].parameters.length;},'MISSING_VALUE','length'],
    [r=>{delete r.components[0].emission.directionDeg;},'MISSING_VALUE','directionDeg'],
    [r=>{r.components[1].type='prism';},'UNSUPPORTED_COMPONENT','.type'],
    [r=>{r.components[0].parameters.wavelength=500;},'UNSUPPORTED_FIELD','wavelength'],
    [r=>{r.components[1].parameters.length='20 cm';},'INVALID_VALUE','length'],
    [r=>{r.lengthUnit='pixels';},'UNSUPPORTED_UNIT','lengthUnit'],
    [r=>{r.components[1].id='S1';},'DUPLICATE_ID','.id'],
    [r=>{r.components[1].parameters.x=-25;},'UNSUPPORTED_SCOPE','physics.components'],
    [r=>{r.components[1].parameters.length=0;},'INVALID_INPUT','length']
  ];
  for(const [change,code,path] of invalid){
    const r=structuredClone(raw);change(r);errorCode(()=>prepareScene(r),code,path);
  }
});

test('canonical preparation supports auto-IDs but preserves explicit stable IDs and inactive emission flags',()=>{
  const req=fixture('general-source-detector');
  const reserved=req.components[0].id;
  delete req.components[1].id;
  req.components.push({type:'ray-detector',parameters:{
    x:28,y:9,orientationDeg:0,length:5}});
  const prepared=prepareScene(req);
  assert.equal(prepared.document.physics.components[0].id,reserved);
  assert.deepEqual(prepared.preparation.assignedIds,[
    {index:1,id:'detector-1'},{index:2,id:'detector-2'}]);
  const full=fixture('general-source-only');
  const p=prepareScene(full);
  assert.deepEqual(p.document.physics.components[0].emission,
    {mode:'full-circle',directionDeg:0,angleDeg:30});
  assert.ok(p.preparation.defaulted.includes('S1.inactiveEmissionAngles'));
  full.components[0].emission.mode='directional';
  errorCode(()=>prepareScene(full),'MISSING_VALUE','directionDeg');
});

test('bounded native PhyDemo executes unseen general combinations with actual per-ID readings',()=>{
  for(const name of names){
    const doc=prepareScene(fixture(name)).document;
    const report=checkCandidate(serializeSave(doc),core);
    assert.equal(report.validation.valid,true,name);
    assert.equal(report.native.status,'completed',name+': '+report.native.error);
    assert.equal(report.native.completed,true);
    assert.equal(report.native.sourceEmissions,'complete');
    assert.equal(report.executionPassed,true);
    assert.deepEqual(report.roundTrip,{sandbox:true,native:true});
    assert.equal(report.analysis.status,'unavailable');
    assert.equal(report.analysis.prediction,null);
    assert.equal(report.interpretation,'not-assessed-by-checker');
    assert.deepEqual(report.native.diagnostics.errors,[]);
    noWarnings(report);
    assert.ok(emitted(report)>0);
    assert.equal(report.native.diagnostics.emitted,
      Object.values(report.native.diagnostics.emissionsById)
        .reduce((total,reading)=>total+reading.emitted,0));
    if(name==='general-source-detector'){
      assert.equal(report.native.detectorMeasurements,'complete');
      assert.ok(report.native.diagnostics.detectorsById.D1.crossings>0);
    }
    if(name==='general-source-only'){
      assert.equal(report.native.diagnostics.reflectionsById,null);
      assert.equal(report.native.detectorMeasurements,'not-applicable');
    }
    if(name==='general-mirror-pair')
      assert.deepEqual(Object.keys(report.native.diagnostics.reflectionsById),['M1','M2']);
  }
});

test('atomic edits preserve component identities, support explicit units and reject incomplete mode changes',()=>{
  const doc=prepareScene(fixture('general-two-source-lens')).document;
  const saved=structuredClone(doc);
  const updated=reviseScene(doc,{changes:[{id:'L1',section:'parameters',
    key:'focalLength',value:12,unit:'cm'}]});
  assert.equal(updated.document.physics.components.find(c=>c.id==='L1').parameters.focalLength,120);
  assert.equal(updated.changesApplied,1);
  assert.deepEqual(doc,saved);
  assert.equal(updated.document.physics.components[0].id,'S1');
  errorCode(()=>reviseScene(doc,{changes:[{id:'L1',section:'parameters',
    key:'focalLength',value:0}]}),'INVALID_INPUT','focalLength');
  errorCode(()=>reviseScene(doc,{changes:[{id:'M1',section:'parameters',
    key:'length',value:90}]}),'UNKNOWN_COMPONENT','.id');
  errorCode(()=>reviseScene(doc,{changes:[{id:'L1',section:'parameters',
    key:'focalLength',value:12,unit:'degrees'}]}),'UNSUPPORTED_UNIT','unit');
  errorCode(()=>reviseScene(doc,{changes:[{id:'L1',section:'parameters',
    key:'focalLength',value:12},{id:'L1',section:'parameters',
    key:'focalLength',value:8}]}),'DUPLICATE_CHANGE');
  const full=prepareScene(fixture('general-source-only')).document;
  errorCode(()=>reviseScene(full,{changes:[{id:'S1',section:'emission',
    key:'mode',value:'directional'}]}),'MISSING_VALUE');
  const switched=reviseScene(full,{changes:[{id:'S1',section:'emission',
    key:'mode',value:'directional'},{id:'S1',section:'emission',
    key:'directionDeg',value:90},{id:'S1',section:'emission',
    key:'angleDeg',value:20}]});
  assert.equal(switched.document.physics.components[0].emission.directionDeg,90);
  assert.equal(switched.document.simulation.rayDensity,full.simulation.rayDensity);
});

test('execution status, measurement availability and interpretation remain separate',()=>{
  const doc=prepareScene(fixture('general-source-detector')).document;
  const good=evaluateDocument(doc,core);
  assert.equal(good.summary.executionPassed,true);
  assert.equal(good.summary.measurementState,'complete');
  assert.equal(good.summary.analysis.status,'unavailable');
  assert.equal(good.summary.interpretation,'not-assessed-by-engine');
  const low=structuredClone(doc);
  low.simulation.processedRayLimit=1;
  const incomplete=evaluateDocument(low,core);
  assert.equal(incomplete.summary.executionPassed,false);
  assert.equal(incomplete.summary.observations,null);
  assert.equal(incomplete.summary.measurementState,'withheld-incomplete');
  assert.equal(incomplete.summary.analysis.status,'suppressed');
});

test('native source brightness warnings qualify rather than invalidate general tracing observations',()=>{
  const doc=prepareScene(fixture('general-two-source-lens')).document;
  doc.physics.components.find(c=>c.id==='S1').parameters.brightness=.5;
  doc.physics.components.find(c=>c.id==='S2').parameters.brightness=.25;
  const outcome=evaluateDocument(doc,core);
  assert.equal(outcome.summary.native.status,'completed-with-warnings');
  assert.match(outcome.summary.native.warnings.join(' '),/inconsistent ratios/);
  assert.equal(outcome.summary.measurementState,'qualified-with-warnings');
  assert.equal(outcome.summary.analysis.status,'unavailable');
  assert.equal(outcome.summary.executionPassed,true);
  assert.equal(outcome.summary.interpretation,'not-assessed-by-engine');
});

test('CLI capabilities are usable without a native build and stale revisions are rejected before execution',()=>{
  const output=execFileSync(process.execPath,['scripts/author-scene.mjs','capabilities'],
    {cwd:root,encoding:'utf8'});
  assert.equal(JSON.parse(output).model,'general-component-tracing');
  const scene='scenes/general-source-only.json';
  const patch='test/fixtures/llm-authoring/stale-patch.json';
  // A rejected edit must not build any native core or write output files.
  const result=spawnSync(process.execPath,['scripts/author-scene.mjs','revise',
    scene,patch],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,1);
  const report=JSON.parse(result.stdout);
  assert.equal(report.accepted,false);
  assert.ok(report.issues.some(x=>x.code==='STALE_REVISION'));
  assert.equal(report.native.status,'not-run');
});
