import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {COMPONENT_REVISION_FORMAT,inspectAuthoringRequest,prepareScene} from '../src/authoring.js';
import {COMPONENT_BOUNDS,serializeSave} from '../src/contract.js';
import {OPTICAL_BENCH_V40_MODEL,OPTICAL_BENCH_V40_VERSION} from '../src/native-optical-bench.js';
import {analyzePlanarAngleQuery} from '../src/planar-angle-queries.js';
import {planProblem,problemWorkflowCapabilities,workflowCapabilitiesSummary} from '../src/problem-workflow.js';
import {INTERPRETATION_SCHEMA,parseQualifiedBundle,validateInterpretation} from '../src/qualification.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const sha256=text=>createHash('sha256').update(text).digest('hex');

function runCli(scriptRel,args,{allowFail=false}={}){
  try{
    const stdout=execFileSync(process.execPath,[resolve(root,scriptRel),...args],{
      cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
    });
    return {exitCode:0,stdout,stderr:''};
  }catch(error){
    if(!allowFail)throw error;
    return {exitCode:error.status??1,stdout:error.stdout?.toString()||'',stderr:error.stderr?.toString()||''};
  }
}

function snell2D(d,n,ni,nt){
  let nx=n.x,ny=n.y,cosI=-(d.x*nx+d.y*ny);
  if(cosI<0){nx=-nx;ny=-ny;cosI=-cosI;}
  const eta=ni/nt,k=1-eta*eta*(1-cosI*cosI);
  const c=eta*cosI-Math.sqrt(k);
  return {x:eta*d.x+c*nx,y:eta*d.y+c*ny};
}
function reflect2D(d,n){
  const dn=d.x*n.x+d.y*n.y;
  return {x:d.x-2*dn*n.x,y:d.y-2*dn*n.y};
}
function rayCircleExit(origin,dir,center,radius){
  const ox=origin.x-center.x,oy=origin.y-center.y;
  const b=ox*dir.x+oy*dir.y,c=ox*ox+oy*oy-radius*radius;
  const disc=Math.sqrt(b*b-c),t1=-b-disc,t2=-b+disc;
  const t=t1>1e-9?t1:t2;
  return {x:origin.x+t*dir.x,y:origin.y+t*dir.y};
}

test('v40 LLM front door: capabilities and repo skills expose v40 native-optical-bench cleanly',()=>{
  const wfCaps=problemWorkflowCapabilities();
  assert.equal(wfCaps.opticalBench.schemaVersion,OPTICAL_BENCH_V40_VERSION);
  assert.equal(wfCaps.opticalBench.model,OPTICAL_BENCH_V40_MODEL);
  assert.ok(wfCaps.opticalBench.components.finiteDielectrics.types['circular-cap-dielectric']);

  const qCaps=JSON.parse(runCli('scripts/qualified-scene.mjs',['capabilities']).stdout);
  assert.equal(qCaps.authoring.opticalBench.schemaVersion,40);
  assert.equal(qCaps.authoring.opticalBench.model,OPTICAL_BENCH_V40_MODEL);

  const rpCaps=JSON.parse(runCli('scripts/run-problem.mjs',['capabilities']).stdout);
  assert.equal(rpCaps.opticalBench.schemaVersion,40);
  assert.equal(rpCaps.opticalBench.model,OPTICAL_BENCH_V40_MODEL);

  const imageSkill=readFileSync(resolve(root,'skills/sim-ro-image-to-scene/SKILL.md'),'utf8');
  assert.match(imageSkill,/bench-capabilities/);
  assert.match(imageSkill,/native-optical-bench/);
  assert.match(imageSkill,/revise-components/);
  assert.match(imageSkill,/ideal-image/);
  assert.match(imageSkill,/planar-interface/);
  assert.match(imageSkill,/graded-index-rectangle/);

  const problemSkill=readFileSync(resolve(root,'skills/sim-ro-problem/SKILL.md'),'utf8');
  assert.match(problemSkill,/native-optical-bench/);
  assert.match(problemSkill,/bench-capabilities/);
  assert.match(problemSkill,/witness-optical-bench\.mjs/);
  assert.match(problemSkill,/ideal-image/);
  assert.match(problemSkill,/planar-interface/);
  assert.match(problemSkill,/graded-index-rectangle/);
  assert.match(problemSkill,/No automatic model fallback/i);

  const wfDoc=readFileSync(resolve(root,'docs/UNIFIED-PROBLEM-WORKFLOW.md'),'utf8');
  assert.match(wfDoc,/native-optical-bench/);
  assert.match(wfDoc,/ideal-image/);
  assert.match(wfDoc,/planar-interface/);
  assert.match(wfDoc,/graded-index-rectangle/);
});

test('v40 LLM front door control (P2-1): v40 single-mirror traces natively with ideal-image unavailable, while historical v4 mirror yields conditional ideal-image (no automatic fallback)',async()=>{
  const runInline=async(problem,tag)=>{
    const outRel='test-artifacts/llm-authoring/v40-front-door-mirror-'+tag+'-'+Date.now()+'-'+process.pid;
    const outAbs=resolve(root,outRel);
    try{
      return await runProblemEvidence({
        inputBytes:Buffer.from(JSON.stringify(problem,null,2),'utf8'),
        outputPath:outRel,
        execute:async(scene,reqs)=>{
          const {evaluateDocument}=await import('../scripts/author-scene.mjs');
          return evaluateDocument(scene,core,reqs);
        }
      });
    }finally{
      rmSync(outAbs,{recursive:true,force:true});
    }
  };
  const sharedComponents=[
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'directional',directionDeg:0,angleDeg:30}},
    {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:40}}
  ];
  const reqs=[
    {id:'refl',kind:'mirror-reflections',componentId:'M1'},
    {id:'img',kind:'ideal-image',componentId:'S1'}
  ];

  // 1. v40 native-optical-bench: native trace succeeds, ideal-image stays unavailable (no silent downgrade)
  const v40Res=await runInline({
    format:'opticsim-problem-v1',
    physical:{title:'v40 mirror trace control',model:'native-optical-bench',lengthUnit:'mm',backgroundIndex:1,components:sharedComponents},
    requests:reqs
  },'v40');
  assert.equal(v40Res.exitCode,2);
  assert.equal(v40Res.report.status,'partially-available');
  assert.equal(v40Res.report.native.executionPassed,true);
  const v40ById=Object.fromEntries(v40Res.report.results.map(r=>[r.id,r]));
  assert.ok(v40ById.refl.value>0);
  assert.equal(v40ById.img.status,'unavailable');

  // 2. Historical v4 profile: same mirror traces natively AND yields conditional plane-mirror virtual image at (+20, 0)
  const v4Res=await runInline({
    format:'opticsim-problem-v1',
    physical:{title:'v4 mirror conditional-image control',lengthUnit:'mm',components:sharedComponents},
    requests:reqs
  },'v4');
  assert.equal(v4Res.exitCode,0);
  assert.equal(v4Res.report.status,'all-requested-quantities-available');
  assert.equal(v4Res.report.native.executionPassed,true);
  const v4ById=Object.fromEntries(v4Res.report.results.map(r=>[r.id,r]));
  assert.ok(v4ById.refl.value>0);
  assert.equal(v4ById.img.status,'conditional');
  assert.equal(v4ById.img.analysisModel,'plane-mirror-geometric');
  assert.ok(Math.abs(v4ById.img.value.x-20)<1e-9);
  assert.ok(Math.abs(v4ById.img.value.y-0)<1e-9);
});

test('v40 LLM front door developmental control: run-problem.mjs executes A28-inspired single-ray point-object approximation + sole-target binding + exact Snell oracle',async()=>{
  const R=20,nG=1.5,rad75=75*Math.PI/180,d0={x:Math.cos(rad75),y:Math.sin(rad75)};
  const pArc=rayCircleExit({x:0,y:8},d0,{x:0,y:0},R);
  const d1=reflect2D(d0,{x:-pArc.x/R,y:-pArc.y/R});
  const pFlat={x:pArc.x+(-pArc.y/d1.y)*d1.x,y:0};
  const d2=snell2D(d1,{x:0,y:-1},nG,1);
  const xExpected=pFlat.x+((-0.5)/d2.y)*d2.x;

  const problem={
    format:'opticsim-problem-v1',
    physical:{
      title:'A28-inspired curved-silvered hemisphere single-ray developmental control',
      model:'native-optical-bench',
      lengthUnit:'mm',
      backgroundIndex:1,
      components:[
        {id:'S1',type:'point-source',parameters:{x:0,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:75}},
        {id:'H1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:R,capHeight:R,normalDeg:90,insideIndex:nG,outsideIndex:1,partialReflection:false}},
        {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:20,normalDeg:-90,radius:20,apertureHeight:36}},
        {id:'D1',type:'ray-detector',parameters:{x:0,y:-0.5,orientationDeg:0,length:40}}
      ]
    },
    requests:[
      // Omit componentId on mirror-reflections to verify deterministic sole-compatible binding to M1:
      {id:'refl',kind:'mirror-reflections'},
      {id:'faces',kind:'interface-face-events',componentId:'H1'},
      {id:'hits',kind:'detector-hit-events',componentId:'D1'}
    ],
    interpretation:{
      requestedResult:'Atlas-inspired developmental control: trace one selected ray from an embedded point emitter reflecting off the curved-silvered dome and refracting out the flat base onto D1 (not an apparent-image or bubble-boundary solution).',
      stated:['Glass hemisphere R=20 mm, n=1.5, silvered curved dome, embedded point-emitter approximation at (0,8) launched at 75 deg.'],
      assumptions:['Explicit Fresnel-off approximation (partialReflection=false); single-ray point-object proxy only.'],
      unknowns:[]
    }
  };

  const outRel='test-artifacts/llm-authoring/v40-front-door-a28-'+Date.now()+'-'+process.pid;
  const outAbs=resolve(root,outRel);
  try{
    const res=await runProblemEvidence({
      inputBytes:Buffer.from(JSON.stringify(problem,null,2),'utf8'),
      outputPath:outRel,
      execute:async(scene,reqs)=>{
        const {evaluateDocument}=await import('../scripts/author-scene.mjs');
        return evaluateDocument(scene,core,reqs);
      }
    });
    assert.equal(res.exitCode,0);
    assert.equal(res.report.status,'all-requested-quantities-available');
    assert.equal(res.report.native.executionPassed,true);
    assert.equal(res.report.portable.status,'created');
    assert.deepEqual(res.report.targetBindings,[
      {requestId:'refl',kind:'mirror-reflections',componentId:'M1',rule:'sole-compatible-authored-component'}
    ]);
    const byId=Object.fromEntries(res.report.results.map(r=>[r.id,r]));
    assert.equal(byId.refl.value,1);
    assert.equal(byId.faces.value['face-arc'].interactions,0);
    assert.equal(byId.faces.value['face-flat'].interactions,1);
    assert.ok(Math.abs(byId.hits.value[0].pointMm.x-xExpected)<1e-6);

    // Qualified bundle generated by run-problem.mjs must parse and verify cleanly:
    const bundleText=readFileSync(resolve(outAbs,'qualified-scene.json'),'utf8');
    const parsed=await parseQualifiedBundle(bundleText);
    assert.equal(parsed.scene.schemaVersion,40);
    assert.equal(parsed.scene.physics.model,'native-optical-bench');
  }finally{
    rmSync(outAbs,{recursive:true,force:true});
  }
});

test('v40 LLM front door developmental control: author-scene.mjs evaluate -> revise -> revise-components (with SHA guard & negative controls) on A04-inspired 4-wall mirror box',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'opticsim-v40-cli-'));
  const tag=Date.now()+'-'+process.pid;
  const outEval='test-artifacts/llm-authoring/v40-cli-eval-'+tag;
  const outRev='test-artifacts/llm-authoring/v40-cli-rev-'+tag;
  const outStruct='test-artifacts/llm-authoring/v40-cli-struct-'+tag;
  const outStale='test-artifacts/llm-authoring/v40-cli-stale-'+tag;
  const outMissing='test-artifacts/llm-authoring/v40-cli-missing-'+tag;
  const outInvalid='test-artifacts/llm-authoring/v40-cli-invalid-'+tag;
  try{
    const reqPath=join(tmp,'box-req.json');
    writeFileSync(reqPath,JSON.stringify({
      title:'A04-inspired 4-wall mirror-box developmental control',
      model:'native-optical-bench',
      lengthUnit:'mm',
      backgroundIndex:1,
      randomSeed:'box-cli-seed',
      components:[
        {id:'S1',type:'point-source',parameters:{x:-15,y:-10,brightness:0.2},emission:{mode:'single-ray',directionDeg:45}},
        {id:'M_top',type:'plane-mirror',parameters:{x:0,y:30,orientationDeg:0,length:80}},
        {id:'M_bot',type:'plane-mirror',parameters:{x:0,y:-30,orientationDeg:0,length:80}},
        {id:'M_right',type:'plane-mirror',parameters:{x:40,y:0,orientationDeg:90,length:60}},
        {id:'M_left',type:'plane-mirror',parameters:{x:-40,y:0,orientationDeg:90,length:60}},
        {id:'K1',type:'line-blocker',parameters:{x:-25,y:20,orientationDeg:0,length:12}}
      ]
    },null,2));

    // 1. evaluate
    const ev=runCli('scripts/author-scene.mjs',['evaluate',reqPath,'--out',outEval]);
    const evJson=JSON.parse(ev.stdout);
    assert.equal(evJson.accepted,true);
    assert.equal(evJson.executionPassed,true);
    assert.equal(evJson.observations.v40EndpointsVerified,true);
    assert.equal(evJson.observations.blockersById.K1.absorptions,1);
    const scene1Path=evJson.outputs.scene;

    // 2. SHA-guarded targeted revise
    const revPatchPath=join(tmp,'rev-patch.json');
    writeFileSync(revPatchPath,JSON.stringify({
      expectedSha256:evJson.canonicalSha256,
      changes:[{id:'K1',section:'parameters',key:'length',value:14,unit:'mm'}]
    },null,2));
    const rv=runCli('scripts/author-scene.mjs',['revise',scene1Path,revPatchPath,'--out',outRev]);
    const rvJson=JSON.parse(rv.stdout);
    assert.equal(rvJson.accepted,true);
    assert.equal(rvJson.executionPassed,true);
    assert.equal(rvJson.revision.changesApplied,1);
    assert.notEqual(rvJson.canonicalSha256,evJson.canonicalSha256);
    const scene2Path=rvJson.outputs.scene;

    // 3. SHA-guarded structural revise-components: swap stop K1 -> K2 (stable IDs, preserving randomSeed & backgroundIndex)
    const structPatchPath=join(tmp,'struct-patch.json');
    writeFileSync(structPatchPath,JSON.stringify({
      expectedSha256:rvJson.canonicalSha256,
      format:COMPONENT_REVISION_FORMAT,
      operations:[
        {op:'remove',id:'K1'},
        {op:'add',lengthUnit:'mm',component:{id:'K2',type:'line-blocker',parameters:{x:-25,y:20,orientationDeg:0,length:12}}}
      ]
    },null,2));
    const st=runCli('scripts/author-scene.mjs',['revise-components',scene2Path,structPatchPath,'--out',outStruct]);
    const stJson=JSON.parse(st.stdout);
    assert.equal(stJson.accepted,true);
    assert.equal(stJson.executionPassed,true);
    assert.equal(stJson.observations.v40EndpointsVerified,true);
    assert.equal(stJson.observations.blockersById.K2.absorptions,1);
    assert.equal(stJson.revision.operationsApplied,2);
    assert.deepEqual(stJson.revision.addedIds,['K2']);
    assert.deepEqual(stJson.revision.removedIds,['K1']);
    const scene3=JSON.parse(readFileSync(stJson.outputs.scene,'utf8'));
    assert.equal(scene3.simulation.randomSeed,'box-cli-seed');
    assert.equal(scene3.physics.backgroundIndex,1);

    // 4. Negative controls on revise-components: stale SHA, missing SHA, and 5th mirror rejection before native run
    const stalePatchPath=join(tmp,'stale-patch.json');
    writeFileSync(stalePatchPath,JSON.stringify({
      expectedSha256:evJson.canonicalSha256, // stale! scene2 has rvJson.canonicalSha256
      format:COMPONENT_REVISION_FORMAT,
      operations:[{op:'remove',id:'K1'}]
    }));
    const staleRes=runCli('scripts/author-scene.mjs',['revise-components',scene2Path,stalePatchPath,'--out',outStale],{allowFail:true});
    assert.equal(staleRes.exitCode,1);
    const staleJson=JSON.parse(staleRes.stdout);
    assert.equal(staleJson.accepted,false);
    assert.equal(staleJson.native.status,'not-run');
    assert.equal(staleJson.issues[0].code,'STALE_REVISION');

    const missingPatchPath=join(tmp,'missing-patch.json');
    writeFileSync(missingPatchPath,JSON.stringify({
      format:COMPONENT_REVISION_FORMAT,
      operations:[{op:'remove',id:'K1'}]
    }));
    const missingRes=runCli('scripts/author-scene.mjs',['revise-components',scene2Path,missingPatchPath,'--out',outMissing],{allowFail:true});
    assert.equal(missingRes.exitCode,1);
    assert.equal(JSON.parse(missingRes.stdout).issues[0].code,'MISSING_REVISION');

    const invalidPatchPath=join(tmp,'invalid-patch.json');
    writeFileSync(invalidPatchPath,JSON.stringify({
      expectedSha256:rvJson.canonicalSha256,
      format:COMPONENT_REVISION_FORMAT,
      operations:[{op:'add',lengthUnit:'mm',component:{id:'M5',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:0,length:10}}}]
    }));
    const invalidRes=runCli('scripts/author-scene.mjs',['revise-components',scene2Path,invalidPatchPath,'--out',outInvalid],{allowFail:true});
    assert.equal(invalidRes.exitCode,1);
    const invalidJson=JSON.parse(invalidRes.stdout);
    assert.equal(invalidJson.accepted,false);
    assert.equal(invalidJson.native.status,'not-run');
  }finally{
    rmSync(tmp,{recursive:true,force:true});
    for(const rel of [outEval,outRev,outStruct,outStale,outMissing,outInvalid])
      rmSync(resolve(root,rel),{recursive:true,force:true});
  }
});

test('v40 LLM front door developmental control: qualified-scene.mjs create -> revise -> structure on layered mirror tank, and check-scene.mjs parallel-beam positive & mis-keyed negative controls',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'opticsim-v40-qual-'));
  const tag=Date.now()+'-'+process.pid;
  const outCreate='test-artifacts/llm-authoring/v40-qual-create-'+tag;
  const outRev='test-artifacts/llm-authoring/v40-qual-rev-'+tag;
  const outStruct='test-artifacts/llm-authoring/v40-qual-struct-'+tag;
  try{
    const reqPath=join(tmp,'tank-req.json');
    const obsPath=join(tmp,'tank-obs.json');
    writeFileSync(reqPath,JSON.stringify({
      title:'JEE Layered tank qualified lifecycle',
      model:'native-optical-bench',
      lengthUnit:'mm',
      backgroundIndex:1,
      randomSeed:'tank-qual-seed',
      components:[
        {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:15}},
        {id:'W1',type:'polygon-dielectric',parameters:{x1:0,y1:-40,x2:20,y2:-40,x3:20,y3:40,x4:0,y4:40,insideIndex:1.33,outsideIndex:1,partialReflection:false}},
        {id:'G1',type:'polygon-dielectric',parameters:{x1:20,y1:-40,x2:40,y2:-40,x3:40,y3:40,x4:20,y4:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
        {id:'M1',type:'plane-mirror',parameters:{x:40,y:0,orientationDeg:90,length:80}},
        {id:'D1',type:'ray-detector',parameters:{x:-20,y:0,orientationDeg:90,length:100}}
      ]
    },null,2));
    writeFileSync(obsPath,JSON.stringify([
      {id:'m1',kind:'mirror-reflections',componentId:'M1'},
      {id:'d1',kind:'detector-crossings',componentId:'D1'},
      {id:'w1',kind:'interface-face-events',componentId:'W1'}
    ],null,2));

    // 1. create
    const cr=JSON.parse(runCli('scripts/qualified-scene.mjs',['create',reqPath,'--observables',obsPath,'--out',outCreate]).stdout);
    assert.equal(cr.executionPassed,true);
    const crById=Object.fromEntries(cr.requestedResults.results.map(r=>[r.id,r]));
    assert.equal(crById.m1.value,1);
    assert.equal(crById.d1.value,2);
    assert.equal(crById.w1.value['face-23'].first.mergedWithId,'G1');
    const bundle1Path=resolve(root,outCreate,'qualified-scene.json');

    // 2. revise: replace water (1.33) with oil (1.45)
    const revPath=join(tmp,'tank-rev.json');
    writeFileSync(revPath,JSON.stringify({
      expectedSha256:cr.canonicalSha256,
      changes:[{id:'W1',section:'parameters',key:'insideIndex',value:1.45}]
    }));
    const rv=JSON.parse(runCli('scripts/qualified-scene.mjs',['revise',bundle1Path,revPath,'--out',outRev]).stdout);
    assert.equal(rv.executionPassed,true);
    assert.equal(rv.parentIntegritySha256,cr.integritySha256);
    assert.equal(rv.qualification.edits.length,1);
    const bundle2Path=resolve(root,outRev,'qualified-scene.json');

    // 3. structure: remove W1 -> leaves glass-on-mirror tank while preserving backgroundIndex & randomSeed
    const structPath=join(tmp,'tank-struct.json');
    writeFileSync(structPath,JSON.stringify({
      expectedSha256:rv.canonicalSha256,
      format:COMPONENT_REVISION_FORMAT,
      operations:[{op:'remove',id:'W1'}]
    }));
    const st=JSON.parse(runCli('scripts/qualified-scene.mjs',['structure',bundle2Path,structPath,'--out',outStruct]).stdout);
    assert.equal(st.executionPassed,true);
    assert.equal(st.parentIntegritySha256,rv.integritySha256);
    assert.deepEqual(st.structuralRevision.removedIds,['W1']);
    const stScene=JSON.parse(readFileSync(st.outputs.scene,'utf8'));
    assert.equal(stScene.simulation.randomSeed,'tank-qual-seed');
    assert.equal(stScene.physics.backgroundIndex,1);

    // 4. check-scene.mjs checkCandidate on A14-inspired parallel-beam hemisphere developmental control:
    // positive control + discriminating negative control (P3-1: mis-keyed beam ID with identical positive sum)
    const {document:a14Doc}=prepareScene({
      title:'A14-inspired parallel-beam hemisphere developmental control',
      model:'native-optical-bench',
      lengthUnit:'mm',
      backgroundIndex:1,
      components:[
        {id:'B1',type:'parallel-beam',parameters:{x:0,y:30,width:24,directionDeg:-90,brightness:0.1}},
        {id:'H1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:20,capHeight:20,normalDeg:90,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
        {id:'D1',type:'ray-detector',parameters:{x:0,y:-10,orientationDeg:0,length:40}}
      ]
    });
    const a14Text=serializeSave(a14Doc);
    const checked=checkCandidate(a14Text,core);
    assert.equal(checked.validation.valid,true);
    assert.equal(checked.native.completed,true);
    assert.equal(checked.native.sourceEmissions,'complete');
    assert.equal(checked.native.detectorMeasurements,'complete');
    assert.equal(checked.roundTrip.sandbox,true);
    assert.equal(checked.roundTrip.native,true);
    assert.equal(checked.executionPassed,true);
    assert.equal(checked.documentSha256,sha256(a14Text));

    // Discriminating negative control (P3-1): move B1's actual emitted count onto wrongBeam while
    // keeping total emitted, round-trip, and v40EndpointsVerified intact. The pre-fix checker
    // (which checked only point-source IDs) falsely passed this; the fixed checker must reject it.
    const miskeyedCore={
      ...core,
      diagnostics(...args){
        const d=core.diagnostics(...args);
        assert.ok(d.emissionsById.B1.emitted>0);
        return {...d,emissionsById:{wrongBeam:{emitted:d.emissionsById.B1.emitted}}};
      }
    };
    const miskeyed=checkCandidate(a14Text,miskeyedCore);
    assert.equal(miskeyed.native.completed,true);
    assert.equal(miskeyed.native.diagnostics.v40EndpointsVerified,true);
    assert.equal(miskeyed.native.sourceEmissions,'unavailable');
    assert.equal(miskeyed.roundTrip.sandbox,true);
    assert.equal(miskeyed.roundTrip.native,true);
    assert.equal(miskeyed.executionPassed,false);
  }finally{
    rmSync(tmp,{recursive:true,force:true});
    for(const rel of [outCreate,outRev,outStruct])
      rmSync(resolve(root,rel),{recursive:true,force:true});
  }
});

test('v40 LLM front door DX: slim workflow-capabilities, self-contained bench-capabilities example/bounds, --help exit 0, and actionable diagnostics',()=>{
  // 1. Slim workflow-capabilities CLI index (< 15 KB vs ~182 KB monolithic dump) + per-family drill-down
  const summaryRes=runCli('scripts/author-scene.mjs',['workflow-capabilities']);
  assert.equal(summaryRes.exitCode,0);
  assert.ok(summaryRes.stdout.length<15000,`Expected slim workflow-capabilities summary < 15 KB, got ${summaryRes.stdout.length} bytes`);
  const summary=JSON.parse(summaryRes.stdout);
  assert.equal(summary.format,'opticsim-problem-workflow-summary-v1');
  assert.deepEqual(summary.interpretationSchema.allowedKeys,[...INTERPRETATION_SCHEMA.allowedKeys]);
  assert.ok(summary.analyticalFamilies.angular.kinds.includes('branch-angles'));
  assert.ok(summary.analyticalFamilies.coaxialParaxialStack.kinds.includes('coaxial-stack-conjugate'));
  assert.ok(summary.observables.kinds.includes('detector-hit-events'));

  const angularDrill=JSON.parse(runCli('scripts/author-scene.mjs',['workflow-capabilities','angular']).stdout);
  assert.equal(angularDrill.family,'angular');
  assert.deepEqual(angularDrill.contract.factsSchema.source.required,['id','region']);
  assert.deepEqual(angularDrill.contract.querySchemas['branch-angles'].required,['id','kind','sourceId','branches']);

  const interpDrill=JSON.parse(runCli('scripts/author-scene.mjs',['workflow-capabilities','interpretation']).stdout);
  assert.deepEqual(interpDrill.contract.allowedKeys,['source','requestedResult','stated','derived','assumptions','unknowns']);

  const unknownFam=runCli('scripts/author-scene.mjs',['workflow-capabilities','nonexistent-family'],{allowFail:true});
  assert.equal(unknownFam.exitCode,1);
  const unknownJson=JSON.parse(unknownFam.stdout);
  assert.equal(unknownJson.issues[0].code,'UNKNOWN_CAPABILITY_FAMILY');
  assert.match(unknownJson.issues[0].message,/Available families:/);

  // Also verify JS export parity
  assert.equal(workflowCapabilitiesSummary().problemFormat,'opticsim-problem-v1');

  // 2. author-scene.mjs --help exits 0 with clean usage text
  const helpRes=runCli('scripts/author-scene.mjs',['--help']);
  assert.equal(helpRes.exitCode,0);
  assert.match(helpRes.stdout,/workflow-capabilities \[family\]/);

  // 3. bench-capabilities includes nesting rule, live bounds parity, face naming, exterior-only stops/detectors, CLI revision shapes, and a live-executing minimalExample
  const bench=JSON.parse(runCli('scripts/author-scene.mjs',['bench-capabilities']).stdout);
  assert.match(bench.componentShape.rule,/parameters/);
  assert.deepEqual(bench.bounds.coordinateMm,[...COMPONENT_BOUNDS.coordinateMm]);
  assert.deepEqual(bench.bounds.positiveLengthMm,[...COMPONENT_BOUNDS.positiveLengthMm]);
  assert.deepEqual(bench.bounds.brightness,[...COMPONENT_BOUNDS.brightness]);
  assert.deepEqual(bench.bounds.refractiveIndex,[...COMPONENT_BOUNDS.refractiveIndex]);
  assert.deepEqual(bench.bounds.parallelBeamWidthMm,[10,100]);
  assert.deepEqual(bench.components.finiteDielectrics.faceNaming['triangular-prism'],['face-12','face-23','face-31']);
  assert.match(bench.components.opaqueStops.interiorPlacement,/outside/);
  assert.match(bench.components['ray-detector'].interiorPlacement,/outside/);
  assert.match(bench.revisions.targeted.fileShape,/expectedSha256/);
  assert.match(bench.revisions.structural.fileShape,/expectedSha256/);

  // minimalExample from bench-capabilities must compile and pass pinned native PhyDemo cleanly!
  const {document:minDoc}=prepareScene(bench.minimalExample);
  const minChecked=checkCandidate(serializeSave(minDoc),core);
  assert.equal(minChecked.executionPassed,true);
  assert.equal(minChecked.native.diagnostics.v40EndpointsVerified,true);

  // 4. Actionable interpretation metadata diagnostics (unexpected keys + allowed list, preserving prefix)
  assert.throws(
    ()=>validateInterpretation({sourceRef:'U1',statedFacts:['x']}),
    /Invalid interpretation metadata: unexpected key\(s\) \[sourceRef, statedFacts\]; allowed keys: source, requestedResult, stated, derived, assumptions, unknowns/
  );
  assert.throws(
    ()=>validateInterpretation({source:{file:'x.png'}}),
    /Invalid source reference: unexpected key\(s\) \[file\]; allowed keys: caseId, path, sha256/
  );
  assert.throws(
    ()=>planProblem({format:'opticsim-problem-v1',physical:null,requests:[{id:'q1',kind:'unknown-kind'}],interpretation:{summary:'bad'}}),
    /Invalid interpretation metadata: unexpected key\(s\) \[summary\]/
  );

  // 5. Actionable planar-angle-queries record diagnostics (unexpected + missing + allowed)
  assert.throws(
    ()=>analyzePlanarAngleQuery({format:'opticsim-planar-angular-facts-v1',source:{id:'S1',region:0},interfaces:[{id:'I1',negativeIndex:1,positiveIndex:1.5}]},
      {format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S1',extraKey:1}),
    /Invalid planar angular query fields: unexpected \[extraKey\]; allowed \[/
  );
  assert.throws(
    ()=>analyzePlanarAngleQuery({format:'opticsim-planar-angular-facts-v1',source:{id:'S1'},interfaces:[{id:'I1',negativeIndex:1,positiveIndex:1.5}]},
      {format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S1',branches:[]}),
    /Invalid angular source fields: missing \[region\]; allowed \[id, region, incidentAngleDeg, approach\]/
  );

  // 6. Actionable INVALID_INPUT bounds diagnostics report exact converted value & allowed range
  const beamIssues=inspectAuthoringRequest({
    model:'native-optical-bench',lengthUnit:'m',backgroundIndex:1,
    components:[{id:'B1',type:'parallel-beam',parameters:{x:0,y:1,width:0.4,directionDeg:-45,brightness:0.2}}]
  });
  assert.equal(beamIssues[0].code,'INVALID_INPUT');
  assert.match(beamIssues[0].message,/got 400 mm; allowed \[10, 100\] mm/);

  const circleIssues=inspectAuthoringRequest({
    model:'native-optical-bench',lengthUnit:'mm',backgroundIndex:1,
    components:[
      {id:'S1',type:'point-source',parameters:{x:-10,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'C1',type:'circular-dielectric',parameters:{x:10,y:0,radius:1,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
    ]
  });
  assert.equal(circleIssues[0].code,'INVALID_INPUT');
  assert.match(circleIssues[0].message,/got 1 mm; allowed \[2, 10000\] mm/);
});
