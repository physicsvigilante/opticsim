// Regression tests for Slice C deep error analysis (GitHub Issue #255, C1–C7).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {initialQualification,createQualifiedBundle,verifyQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {QualifiedUI} from '../src/qualified-ui.js';
import {ExplorationUI} from '../src/exploration-ui.js';
import {explorationBundle,prepareExplorationProposal,EXPLORATION_PROPOSAL,browserExecution,snapshotScenario} from '../src/exploration.js';
import {createExplorationNotebook,parseExplorationNotebook,serializeExplorationNotebook,EXPLORATION_NOTEBOOK_MAX_BYTES} from '../src/exploration-notebook.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {fitRequestedView,apparatusPoints} from '../src/result-preview.js';
import {parallelBeamGeometry} from '../src/parallel-beam.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {prepareScene} from '../src/authoring.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
const core=require(resolve(root,'dist/test-core.cjs'));

const loadScene=rel=>JSON.parse(readFileSync(resolve(root,rel),'utf8'));

function nativeRunData(doc,requests=[]){
  const ev=evaluateDocument(doc,core,requests);
  assert.equal(ev.summary.executionPassed,true,'expected native run to pass');
  return {
    state:ev.summary.native.status,
    data:{
      ...ev.summary.observations,
      emitted:ev.summary.native.emitted,
      processed:ev.summary.native.processed,
      truncation:ev.summary.native.truncation,
      undefinedBehavior:ev.summary.native.undefinedBehavior,
      errors:ev.summary.native.errors,
      warnings:ev.summary.native.warnings
    }
  };
}

// C1: Malformed calculation result shapes rejected before committing; atomic commit rollback.
test('C1: validateQualification rejects malformed calculation resultValue shapes and QualifiedUI.commit rolls back on render error',async()=>{
  const doc=loadScene('scenes/single-lens.json');
  const makeBase=()=>initialQualification(doc,{status:'fully-specified',appliedChoices:[],policyVersion:null},{inputSha256:'a'.repeat(64)});
  const baseCalc=(q,kind,resultValue)=>({
    format:'opticsim-qualified-calculation-v1',
    inputSha256:q.origin.inputSha256,
    querySha256:'b'.repeat(64),
    sourceRequest:{},
    query:{kind},
    method:'conditional-analytical',
    kind,
    status:'conditional',
    resultValue,
    computedFields:[],
    conditions:[]
  });

  // Malformed branch-angles: branches is object instead of array.
  const q1=makeBase();
  q1.calculations=[baseCalc(q1,'branch-angles',{branches:{}})];
  await assert.rejects(createQualifiedBundle(doc,q1),/branch-angles resultValue\.branches must be a bounded array/);

  // Malformed branch-angles: branches contains null entry.
  const q2=makeBase();
  q2.calculations=[baseCalc(q2,'branch-angles',{branches:[null]})];
  await assert.rejects(createQualifiedBundle(doc,q2),/Calculated branch entry must be an object/);

  // Malformed curved-mirror-image: missing imageKind.
  const q3=makeBase();
  q3.calculations=[baseCalc(q3,'curved-mirror-image',{imageDistance:100})];
  await assert.rejects(createQualifiedBundle(doc,q3),/Calculated imageKind/);

  // Legitimate null resultValue (unavailable) remains accepted.
  const qNull=makeBase();
  qNull.calculations=[{...baseCalc(qNull,'branch-angles',null),status:'unavailable'}];
  const validNullBundle=await verifyQualifiedBundle(await createQualifiedBundle(doc,qNull));
  assert.equal(validNullBundle.qualification.calculations[0].resultValue,null);

  // Atomic rollback in QualifiedUI.commit() if refresh() throws.
  const prevQ=makeBase();
  const fakeErrorEl={textContent:''};
  const prevDoc=globalThis.document;
  globalThis.document={getElementById:id=>id==='qualification-error'?fakeErrorEl:null};
  try{
    const ui=Object.create(QualifiedUI.prototype);
    ui.qualification=prevQ;
    ui.requests=[{id:'old',kind:'ideal-image'}];
    ui.session={changed:()=>{}};
    let failOnce=true;
    ui.refresh=()=>{if(failOnce){failOnce=false;throw TypeError('simulated render failure');}};
    assert.throws(()=>ui.commit({qualification:{poisoned:true},requests:[]}),/simulated render failure/);
    assert.equal(ui.qualification,prevQ,'previous qualification must remain intact after failed commit');
    assert.deepEqual(ui.requests,[{id:'old',kind:'ideal-image'}]);
    // Subsequent valid raw import succeeds cleanly.
    ui.commit({qualification:null,requests:[]});
    assert.equal(ui.qualification,null);
    assert.deepEqual(ui.requests,[]);
  }finally{
    globalThis.document=prevDoc;
  }
});

// C2 & C3: New exploration baseline has null intent/parent; restore & loadNotebookScene retain variant intent/parent/label.
test('C2 & C3: ExplorationUI start() produces valid notebook baseline and restore/loadNotebookScene retain variant metadata',async()=>{
  const doc=loadScene('scenes/single-lens-detector.json');
  const makeUi=(initialDoc,initialQ,initialReqs)=>{
    const run=nativeRunData(initialDoc,initialReqs);
    const ui=Object.create(ExplorationUI.prototype);
    ui.session={document:structuredClone(initialDoc),state:run.state,data:run.data,revision:1};
    ui.qualified={
      qualification:initialQ,
      requests:initialReqs,
      commit:({qualification,requests})=>{ui.qualified.qualification=qualification;ui.qualified.requests=requests;}
    };
    ui.hasPending=()=>false;
    ui.saved=[];ui.preview=null;ui.busy=false;ui.comparison=null;ui.intent=null;ui.importedNotebook=null;
    ui.proposal={value:''};ui.previewText={textContent:''};ui.status={textContent:''};ui.error={textContent:''};
    ui.comparisonText={textContent:'',dataset:{}};ui.root={dataset:{}};ui.name={value:''};
    ui.notebookStatus={textContent:''};ui.notebookSelect={value:'0'};
    ui.select={value:'0',replaceChildren(){this._opts=[];},append(o){this._opts.push(o);}};
    ui.setOptions=idx=>{ui.select.value=String(idx);};
    ui.applyBundle=bundle=>{
      const r=nativeRunData(bundle.scene,bundle.observables);
      ui.session.document=structuredClone(bundle.scene);
      ui.session.state=r.state;
      ui.session.data=r.data;
      ui.session.revision++;
      ui.qualified.commit({qualification:bundle.qualification,requests:bundle.observables});
      return true;
    };
    return ui;
  };

  // Start exploration from raw single-lens-detector.
  const ui=makeUi(doc,null,[]);
  await ui.start();
  assert.equal(ui.saved.length,1);
  assert.equal(ui.saved[0].label,'Baseline');
  assert.equal(ui.saved[0].intent,null);
  assert.equal(ui.saved[0].parentIntegritySha256,null);

  // Apply a valid hypothetical changing lens-1.focalLength to 150 mm.
  const baseBundle=ui.saved[0].bundle;
  const proposal={
    format:EXPLORATION_PROPOSAL,
    expectedIntegritySha256:baseBundle.integritySha256,
    intent:'Teacher hypothesis: increase focal length to 150 mm',
    action:'revise',
    patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]}
  };
  ui.proposal.value=JSON.stringify(proposal);
  await ui.inspect();
  await ui.apply();
  ui.name.value='150 mm variant';
  await ui.capture();
  assert.equal(ui.saved[1].intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(ui.saved[1].parentIntegritySha256,baseBundle.integritySha256);

  // C2: Start a NEW exploration directly from the just-applied hypothetical child.
  const notebookBeforeRestart=await createExplorationNotebook(ui.saved);
  await ui.start();
  assert.equal(ui.saved[0].label,'Baseline');
  assert.equal(ui.saved[0].intent,null);
  assert.equal(ui.saved[0].parentIntegritySha256,null);
  const restartedNotebook=await createExplorationNotebook(ui.saved);
  const parsedRestart=await parseExplorationNotebook(serializeExplorationNotebook(restartedNotebook));
  assert.equal(parsedRestart.entries[0].label,'Baseline');
  assert.equal(parsedRestart.entries[0].intent,null);
  assert.equal(parsedRestart.entries[0].parentIntegritySha256,null);

  // C3 (imported notebook path): load Baseline -> start -> load variant -> fresh native trace -> capture -> export.
  const ui2=makeUi(doc,null,[]);
  ui2.importedNotebook=await parseExplorationNotebook(serializeExplorationNotebook(notebookBeforeRestart));
  ui2.notebookSelect.value='0';
  await ui2.loadNotebookScene();
  await ui2.start();
  ui2.notebookSelect.value='1';
  await ui2.loadNotebookScene();
  assert.equal(ui2.name.value,'150 mm variant');
  assert.equal(ui2.intent.intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(ui2.intent.parentIntegritySha256,baseBundle.integritySha256);
  await ui2.capture();
  assert.equal(ui2.saved[1].label,'150 mm variant');
  assert.equal(ui2.saved[1].intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(ui2.saved[1].parentIntegritySha256,baseBundle.integritySha256);
  const reexported=await parseExplorationNotebook(serializeExplorationNotebook(await createExplorationNotebook(ui2.saved)));
  assert.equal(reexported.entries[1].intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(reexported.entries[1].parentIntegritySha256,baseBundle.integritySha256);

  // C3 (saved scenario restore path): restore variant -> capture retains metadata.
  ui2.select.value='1';
  await ui2.restore();
  assert.equal(ui2.name.value,'150 mm variant');
  assert.equal(ui2.intent.intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(ui2.intent.parentIntegritySha256,baseBundle.integritySha256);
  await ui2.capture();
  assert.equal(ui2.saved[2].intent,'Teacher hypothesis: increase focal length to 150 mm');
  assert.equal(ui2.saved[2].parentIntegritySha256,baseBundle.integritySha256);
});

// C4: Substantial-history notebook serializes and reimports under the exact same 4 MiB byte cap.
test('C4: serializeExplorationNotebook round-trips 230 genuine edits x 12 snapshots within 4 MiB limit',async()=>{
  const base=loadScene('scenes/single-lens-detector.json');
  let prev=structuredClone(base);
  let q=initialQualification(prev,{status:'fully-specified',appliedChoices:[],policyVersion:null},{inputSha256:'a'.repeat(64)});
  for(let i=0;i<230;i++){
    const d=i%2===0?1:0;
    const next=structuredClone(base);
    Object.assign(next.physics.components.find(c=>c.id==='source-1').parameters,{x:-300+d,y:10+d,brightness:0.5+d*0.1});
    Object.assign(next.physics.components.find(c=>c.id==='lens-1').parameters,{x:d,focalLength:100+d,apertureHeight:180+d});
    Object.assign(next.physics.components.find(c=>c.id==='detector-1').parameters,{x:170+d,y:d,length:160+d});
    q=recordQualifiedEdit(prev,next,q);
    prev=next;
  }
  const bundle=await createQualifiedBundle(prev,q,[]);
  const run=nativeRunData(prev,[]);
  const exec=await browserExecution(prev,run.state,run.data,[]);
  const saved=[];
  for(let i=0;i<12;i++){
    saved.push(await snapshotScenario(bundle,exec,i===0?'Baseline':`Saved ${i}`));
  }
  const notebook=await createExplorationNotebook(saved);
  const serialized=serializeExplorationNotebook(notebook);
  assert.ok(new TextEncoder().encode(serialized).length<=EXPLORATION_NOTEBOOK_MAX_BYTES);
  const parsed=await parseExplorationNotebook(serialized);
  assert.equal(parsed.entries.length,12);
  assert.equal(parsed.entries[0].bundle.qualification.edits.length,230);
});

// C5 & C6: Sweep CLI forwards opt-in requests; runParameterSweep rejects stale cached runner evidence.
test('C5 & C6: Sweep CLI captures opt-in detector-hit-events and runParameterSweep rejects stale cached execution',async()=>{
  const doc=loadScene('scenes/native-general-optical-bench.json');
  const q=initialQualification(doc,{status:'fully-specified',appliedChoices:[],policyVersion:null},{inputSha256:'a'.repeat(64)});
  const requests=[{id:'hits',kind:'detector-hit-events',componentId:'D1'}];
  const bundle=await createQualifiedBundle(doc,q,requests);
  const spec={
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:bundle.sceneSha256,
    parameter:{id:'L1',section:'parameters',key:'focalLength',unit:'mm'},
    values:[160,180]
  };

  // C5: Actual CLI execution captures detector-hit-events on both samples.
  const tmp=mkdtempSync(join(tmpdir(),'opticsim-c5-'));
  const outRel='test-artifacts/llm-authoring/c5-sweep-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const outAbs=resolve(root,outRel);
  try{
    const bundlePath=join(tmp,'bundle.json');
    const specPath=join(tmp,'spec.json');
    writeFileSync(bundlePath,JSON.stringify(bundle,null,2));
    writeFileSync(specPath,JSON.stringify(spec,null,2));
    execFileSync(process.execPath,[resolve(root,'scripts/run-parameter-sweep.mjs'),bundlePath,specPath,'--out',outRel],{cwd:root,stdio:'pipe'});
    const cliReport=JSON.parse(readFileSync(resolve(outAbs,'report.json'),'utf8'));
    assert.equal(cliReport.status,'completed');
    assert.equal(cliReport.completedSamples,2);
    assert.equal(cliReport.failedSamples,0);
    for(const sample of cliReport.samples){
      const hitResult=sample.requestedResults.results.find(r=>r.id==='hits');
      assert.equal(hitResult.status,'available');
      assert.equal(hitResult.value.length,16);
    }
  }finally{
    rmSync(tmp,{recursive:true,force:true});
    rmSync(outAbs,{recursive:true,force:true});
  }

  // C5: Verify runParameterSweep forwards effective requests to execute() for finite-hit-numerical-diagnostic and detector-ray-provenance too.
  const polyFixture=loadScene('examples/polygon-dielectric.json');
  const polyDoc=prepareScene(polyFixture.physical).document;
  const polyQ=initialQualification(polyDoc,{status:'fully-specified',appliedChoices:[],policyVersion:null},{inputSha256:'a'.repeat(64)});
  const diagReqs=[{id:'diag',kind:'finite-hit-numerical-diagnostic',componentId:'G1'}];
  const polyBundle=await createQualifiedBundle(polyDoc,polyQ,diagReqs);
  const seenDiagReqs=[];
  const diagReport=await runParameterSweep(polyBundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:polyBundle.sceneSha256,
    parameter:{id:'G1',section:'parameters',key:'insideIndex'},
    values:[1.5,1.6]
  },{
    execute:(d,reqs)=>{seenDiagReqs.push(reqs);return evaluateDocument(d,core,reqs);}
  });
  assert.equal(diagReport.status,'completed');
  assert.deepEqual(seenDiagReqs[0],diagReqs);
  assert.equal(diagReport.samples[0].requestedResults.results[0].status,'advisory');

  const v5Doc=prepareScene({
    lengthUnit:'mm',runPolicy:'preview-v1',
    components:[
      {id:'S1',type:'point-source',parameters:{x:-100,y:100,brightness:1},emission:{mode:'single-ray',directionDeg:-45}},
      {id:'I1',type:'planar-interface',parameters:{x:0,y:0,normalDeg:90,negativeIndex:4/3,positiveIndex:1,partialReflection:false}},
      {id:'D1',type:'ray-detector',parameters:{x:50,y:-100,orientationDeg:0,length:400}}
    ]
  }).document;
  const v5Q=initialQualification(v5Doc,{status:'fully-specified',appliedChoices:[],policyVersion:null},{inputSha256:'a'.repeat(64)});
  const provReqs=[{id:'prov',kind:'detector-ray-provenance',componentId:'D1'}];
  const v5Bundle=await createQualifiedBundle(v5Doc,v5Q,provReqs);
  const seenProvReqs=[];
  const provReport=await runParameterSweep(v5Bundle,{
    format:'opticsim-parameter-sweep-v1',
    expectedSceneSha256:v5Bundle.sceneSha256,
    parameter:{id:'I1',section:'parameters',key:'negativeIndex'},
    values:[1.33,1.5]
  },{
    execute:(d,reqs)=>{seenProvReqs.push(reqs);return evaluateDocument(d,core,reqs);}
  });
  assert.equal(provReport.status,'completed');
  assert.deepEqual(seenProvReqs[0],provReqs);
  assert.equal(provReport.samples[0].requestedResults.results[0].status,'qualified');

  // C6: Cached baseline execution returned for a different sample must be marked incomplete/failed.
  const cached=evaluateDocument(bundle.scene,core,requests);
  const staleReport=await runParameterSweep(bundle,spec,{execute:()=>cached});
  assert.equal(staleReport.status,'completed-with-failed-samples');
  assert.equal(staleReport.completedSamples,1);
  assert.equal(staleReport.failedSamples,1);
  assert.equal(staleReport.samples[0].status,'completed');
  assert.equal(staleReport.samples[0].requestedResults.results[0].status,'available');
  assert.equal(staleReport.samples[1].status,'incomplete');
  assert.equal(staleReport.samples[1].requestedResults.results[0].status,'suppressed');
  assert.match(staleReport.samples[1].error.message,/scene hash/i);
});

// C7: fitRequestedView includes parallel-beam finite endpoints inside the padded viewport.
test('C7: fitRequestedView includes finite parallel-beam endpoints and prevents emitter clipping',async()=>{
  const doc=loadScene('scenes/native-general-hybrid-bench.json');
  const beam=doc.physics.components.find(c=>c.id==='B1');
  Object.assign(beam.parameters,{y:200,width:100});
  const pts=apparatusPoints(doc);
  const geom=parallelBeamGeometry(beam.parameters);
  assert.ok(pts.some(p=>Math.abs(p.x-geom.p1.x)<1e-9&&Math.abs(p.y-geom.p1.y)<1e-9),'apparatusPoints must include beam p1');
  assert.ok(pts.some(p=>Math.abs(p.x-geom.p2.x)<1e-9&&Math.abs(p.y-geom.p2.y)<1e-9),'apparatusPoints must include beam p2');

  const fitted=await fitRequestedView(doc,null,1000,450);
  assert.equal(fitted.apparatusFits,true);
  const v=fitted.document.presentation.view;
  for(const end of [geom.p1,geom.p2]){
    const sx=1000/2+(end.x-v.x)*v.zoom;
    const sy=450/2-(end.y-v.y)*v.zoom;
    assert.ok(sx>=fitted.padding-1e-6&&sx<=1000-fitted.padding+1e-6,`beam endpoint x (${sx}) must stay inside padded viewport`);
    assert.ok(sy>=fitted.padding-1e-6&&sy<=450-fitted.padding+1e-6,`beam endpoint y (${sy}) must stay inside padded viewport`);
  }
});
