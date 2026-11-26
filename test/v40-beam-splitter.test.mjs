import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {COMPONENT_REVISION_FORMAT,prepareScene,reviseComponents,reviseScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {OPTICAL_BENCH_V40_MODEL,OPTICAL_BENCH_V40_VERSION} from '../src/native-optical-bench.js';
import {evaluateObservables} from '../src/observables.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));

const v40Req=(components,extra={})=>({
  title:'v40 beam-splitter test',
  model:OPTICAL_BENCH_V40_MODEL,
  lengthUnit:'mm',
  backgroundIndex:1,
  randomSeed:'v40-beam-splitter-seed',
  components,
  ...extra
});

function reflect2D(d,n){
  const dn=d.x*n.x+d.y*n.y;
  return {x:d.x-2*dn*n.x,y:d.y-2*dn*n.y};
}
function rayCircleFirstHit(origin,dir,center,radius){
  const ox=origin.x-center.x,oy=origin.y-center.y;
  const b=ox*dir.x+oy*dir.y,c=ox*ox+oy*oy-radius*radius;
  const disc=Math.sqrt(b*b-c),t1=-b-disc,t2=-b+disc;
  const t=t1>1e-9?t1:t2;
  return {x:origin.x+t*dir.x,y:origin.y+t*dir.y};
}

test('v40 beam-splitter oracle: exact 45-deg reflection/transmission geometry, power conservation, and reviseScene transmissionRatio update',async()=>{
  // Horizontal ray (brightness 0.4, +x) hits 45-deg beam-splitter BS1 at (0, 0) with transmissionRatio = 0.3:
  // - Reflected branch goes straight +y (90 deg) with relative power 0.4 * 0.7 = 0.28 onto D_refl at y = 40
  // - Transmitted branch continues straight +x (0 deg) with relative power 0.4 * 0.3 = 0.12 onto D_trans at x = 40
  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}},
    {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:40,transmissionRatio:0.3}},
    {id:'D_refl',type:'ray-detector',parameters:{x:0,y:40,orientationDeg:0,length:40}},
    {id:'D_trans',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:40}}
  ]));
  assert.equal(doc.schemaVersion,OPTICAL_BENCH_V40_VERSION);
  assert.deepEqual(parseSave(serializeSave(doc)),doc);

  const reqs=[
    {id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'},
    {id:'rc',kind:'detector-crossings',componentId:'D_refl'},
    {id:'rp',kind:'detector-signed-power',componentId:'D_refl'},
    {id:'rh',kind:'detector-hit-events',componentId:'D_refl'},
    {id:'tc',kind:'detector-crossings',componentId:'D_trans'},
    {id:'tp',kind:'detector-signed-power',componentId:'D_trans'},
    {id:'th',kind:'detector-hit-events',componentId:'D_trans'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.bs.status,'available');
  assert.equal(byId.bs.value,1);
  assert.equal(byId.rc.value,1);
  assert.equal(byId.tc.value,1);
  assert.ok(Math.abs(Math.abs(byId.rp.value)-0.28)<1e-9,`Expected reflected power 0.28, got ${byId.rp.value}`);
  assert.ok(Math.abs(Math.abs(byId.tp.value)-0.12)<1e-9,`Expected transmitted power 0.12, got ${byId.tp.value}`);
  assert.ok(Math.abs(Math.abs(byId.rp.value)+Math.abs(byId.tp.value)-0.4)<1e-9);
  assert.ok(Math.abs(byId.rh.value[0].pointMm.x-0)<1e-6);
  assert.ok(Math.abs(byId.rh.value[0].pointMm.y-40)<1e-6);
  assert.ok(Math.abs(byId.rh.value[0].incomingUnit.y-1)<1e-6);
  assert.ok(Math.abs(byId.th.value[0].pointMm.x-40)<1e-6);
  assert.ok(Math.abs(byId.th.value[0].pointMm.y-0)<1e-6);
  assert.ok(Math.abs(byId.th.value[0].incomingUnit.x-1)<1e-6);

  // Targeted reviseScene changing transmissionRatio: 0.3 -> 0.75 (dimensionless: unit rejected)
  assert.throws(()=>reviseScene(doc,{changes:[{id:'BS1',section:'parameters',key:'transmissionRatio',value:0.75,unit:'mm'}]}),
    /Units apply only to length parameters/);
  const rev=reviseScene(doc,{changes:[{id:'BS1',section:'parameters',key:'transmissionRatio',value:0.75}]}).document;
  const runRev=await evaluateDocument(rev,core,reqs);
  assert.equal(runRev.summary.executionPassed,true);
  const byIdRev=Object.fromEntries((await evaluateObservables(rev,reqs,runRev.summary)).results.map(r=>[r.id,r]));
  assert.ok(Math.abs(Math.abs(byIdRev.rp.value)-0.10)<1e-9);
  assert.ok(Math.abs(Math.abs(byIdRev.tp.value)-0.30)<1e-9);
});

test('v40 two-splitter Mach-Zehnder geometric bench: 2 beam splitters + 2 mirrors + 2 output port detectors conserve power exactly',async()=>{
  // S1 (-40, 0) +x (brightness 0.4) -> BS1 (0, 0, 45 deg, T=0.5):
  //   Upper arm: (0,0) -> +y -> M_top (0, 60, 45 deg) -> +x -> BS2 (60, 60, 45 deg, T=0.5)
  //   Lower arm: (0,0) -> +x -> M_bot (60, 0, 45 deg) -> +y -> BS2 (60, 60, 45 deg, T=0.5)
  // Both arms recombine at BS2 (60, 60):
  //   Port X (D_x at x = 100, y = 60): receives upper transmitted (0.1) + lower reflected (0.1) = 2 crossings, |power| = 0.2
  //   Port Y (D_y at x = 60, y = 100): receives upper reflected (0.1) + lower transmitted (0.1) = 2 crossings, |power| = 0.2
  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}},
    {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:30,transmissionRatio:0.5}},
    {id:'M_top',type:'plane-mirror',parameters:{x:0,y:60,orientationDeg:45,length:30}},
    {id:'M_bot',type:'plane-mirror',parameters:{x:60,y:0,orientationDeg:45,length:30}},
    {id:'BS2',type:'beam-splitter',parameters:{x:60,y:60,orientationDeg:45,length:30,transmissionRatio:0.5}},
    {id:'D_x',type:'ray-detector',parameters:{x:100,y:60,orientationDeg:90,length:30}},
    {id:'D_y',type:'ray-detector',parameters:{x:60,y:100,orientationDeg:0,length:30}}
  ]));
  const reqs=[
    {id:'bs1',kind:'beam-splitter-interactions',componentId:'BS1'},
    {id:'bs2',kind:'beam-splitter-interactions',componentId:'BS2'},
    {id:'mt',kind:'mirror-reflections',componentId:'M_top'},
    {id:'mb',kind:'mirror-reflections',componentId:'M_bot'},
    {id:'dxc',kind:'detector-crossings',componentId:'D_x'},
    {id:'dxp',kind:'detector-signed-power',componentId:'D_x'},
    {id:'dyc',kind:'detector-crossings',componentId:'D_y'},
    {id:'dyp',kind:'detector-signed-power',componentId:'D_y'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.bs1.value,1);
  assert.equal(byId.bs2.value,2);
  assert.equal(byId.mt.value,1);
  assert.equal(byId.mb.value,1);
  assert.equal(byId.dxc.value,2);
  assert.equal(byId.dyc.value,2);
  assert.ok(Math.abs(Math.abs(byId.dxp.value)-0.2)<1e-9);
  assert.ok(Math.abs(Math.abs(byId.dyp.value)-0.2)<1e-9);
});

test('v40 U7-inspired thin-plate beam-splitter + convex circular-arc-mirror: simultaneous reflection & transmission virtual-image coincidence in one native run',async()=>{
  // Convex arc mirror M1 at (0,0), normalDeg=0 (+x), radius=-400 mm (f = -200 mm, center at (-400, 0)), apertureHeight = 140 mm.
  // Thin plate modeled as beam-splitter BS1 at x = 50 mm (a = 5 cm in front of mirror), orientationDeg = 90, length = 120 mm, T = 0.5.
  // Point source S1 at (200, 0) (b = 15 cm from plate -> front-surface virtual image at x = -100 mm; paraxial mirror virtual image at x = -100 mm!).
  // Off-axis ray at 168 deg (12 deg from -x) hits BS1 -> reflected branch goes straight to D1 (x = 250 mm),
  // transmitted branch hits convex mirror M1, reflects back through BS1 onto D1 (re-reflected echo diverges to y ~ 88 mm > 70 mm and misses M1 cleanly with zero truncation!).
  const R=400,a=50,xS=200,xD=250,deg=168*Math.PI/180;
  const s0={x:xS,y:0},d0={x:Math.cos(deg),y:Math.sin(deg)};
  // Branch 1: reflection at BS1 (x = 50)
  const pBS1={x:a,y:(a-xS)*d0.y/d0.x};
  const dRefl1={x:-d0.x,y:d0.y};
  const yDetRefl=pBS1.y+(xD-a)*dRefl1.y/dRefl1.x;
  // Branch 2: transmission through BS1 -> convex mirror M1 (center (-400, 0), R = 400) -> return transmission through BS1
  const mCenter={x:-R,y:0};
  const pM=rayCircleFirstHit(pBS1,d0,mCenter,R);
  const nM={x:(pM.x-mCenter.x)/R,y:(pM.y-mCenter.y)/R};
  const dMir=reflect2D(d0,nM);
  const yDetMir=pM.y+(xD-pM.x)*dMir.y/dMir.x;

  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:xS,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:168}},
    {id:'BS1',type:'beam-splitter',parameters:{x:a,y:0,orientationDeg:90,length:140,transmissionRatio:0.5}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:0,radius:-R,apertureHeight:140}},
    {id:'D1',type:'ray-detector',parameters:{x:xD,y:0,orientationDeg:90,length:500}}
  ]));
  const reqs=[
    {id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'},
    {id:'m1',kind:'mirror-reflections',componentId:'M1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  assert.equal(run.summary.native.truncation,0);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.m1.value,1);
  assert.equal(byId.bs.value,2);
  assert.equal(byId.hits.value.length,2);
  const hits=byId.hits.value;
  const hRefl=hits.find(h=>Math.abs(h.pointMm.y-yDetRefl)<1e-5);
  const hMir=hits.find(h=>Math.abs(h.pointMm.y-yDetMir)<1e-5);
  assert.ok(hRefl,'Expected front-surface BS1 reflected ray on D1');
  assert.ok(hMir,'Expected transmitted->M1->transmitted ray on D1');
  // Backward virtual-image x-intercepts: x_virt = x - y * u_x / u_y
  const xVirtRefl=hRefl.pointMm.x-hRefl.pointMm.y*hRefl.incomingUnit.x/hRefl.incomingUnit.y;
  const xVirtMir=hMir.pointMm.x-hMir.pointMm.y*hMir.incomingUnit.x/hMir.incomingUnit.y;
  const xVirtMirExpected=pM.x-pM.y*dMir.x/dMir.y;
  assert.ok(Math.abs(xVirtRefl-(-100))<1e-6,`BS1 virtual image expected -100 mm, got ${xVirtRefl}`);
  assert.ok(Math.abs(xVirtMir-xVirtMirExpected)<1e-5,`Convex arc mirror virtual intercept expected ${xVirtMirExpected}, got ${xVirtMir}`);
  assert.ok(Math.abs(xVirtMir-(-100))<4,'Convex arc mirror virtual intercept near paraxial -100 mm');
});

test('v40 beam-splitter fail-closed controls: brightness truncation, cavity bounce truncation, and reflected/transmitted endpoint-graze runtime audits',async()=>{
  // 1. Faint transmitted branch (brightness 0.02 * T 0.4 = 0.008 <= 0.01) triggers native truncation -> incomplete & withheld
  {
    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.02},emission:{mode:'single-ray',directionDeg:0}},
      {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:40,transmissionRatio:0.4}},
      {id:'D1',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:40}}
    ]));
    const run=await evaluateDocument(doc,core,[{id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'}]);
    assert.equal(run.summary.executionPassed,false);
    assert.ok(run.summary.native.truncation>0);
    assert.equal(run.summary.observations,null);
  }

  // 2. Strict on-axis cavity (0 deg ray between BS1 and facing plane-mirror M1) bounces repeatedly until cutoff -> withheld
  {
    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}},
      {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:90,length:40,transmissionRatio:0.5}},
      {id:'M1',type:'plane-mirror',parameters:{x:40,y:0,orientationDeg:90,length:40}}
    ]));
    const run=await evaluateDocument(doc,core,[{id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'}]);
    assert.equal(run.summary.executionPassed,false);
    assert.ok(run.summary.native.truncation>0);
  }

  // 3. Runtime endpoint-graze audit catches < 0.01 mm graze on REFLECTED branch (args[0])
  {
    // Ray along +x reflects at 45 deg BS1 to +y (x = 0). Place D_refl horizontal at y = 40 with left endpoint at x = 0.004 -> graze!
    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}},
      {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:40,transmissionRatio:0.5}},
      {id:'D_refl',type:'ray-detector',parameters:{x:10.004,y:40,orientationDeg:0,length:20}}
    ]));
    const run=await evaluateDocument(doc,core,[{id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'}]);
    assert.equal(run.summary.executionPassed,false);
    assert.equal(run.summary.observations,null);
    assert.match(run.summary.native.errors.join(' '),/within 0\.01 mm of a finite component endpoint/);
  }

  // 4. Runtime endpoint-graze audit catches < 0.01 mm graze on TRANSMITTED child branch (result.newRays[0])
  {
    // Refract/deflect first? No: deflect with 20 deg mirror M0 at (-20,0) so initial ray doesn't trigger initial forward guard,
    // wait: use 45 deg BS1 on a ray arriving from S1 (-40, -40) at 45 deg? Even simpler:
    // S1 at (-40, 20) reflects off tilted mirror M0 at (-20, 20, 0 deg? no, aim down-right) into BS1 (0, 0, 45 deg),
    // then transmitted branch continues along (1, -1)/sqrt(2) grazing D_trans endpoint by 0.004 mm!
    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-40,y:40,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}},
      {id:'M0',type:'plane-mirror',parameters:{x:-20,y:40,orientationDeg:-22.5,length:20}},
      // Ray at 0 deg hitting -22.5 deg mirror reflects to -45 deg: from (-20,40) along (1,-1)/sqrt(2) -> hits (20, 0)
      {id:'BS1',type:'beam-splitter',parameters:{x:20,y:0,orientationDeg:90,length:30,transmissionRatio:0.5}},
      // Transmitted ray continues along (1,-1)/sqrt(2) through (40, -20). Place D_trans vertically at x=40 with top endpoint at y=-20.004!
      {id:'D_trans',type:'ray-detector',parameters:{x:40,y:-30.004,orientationDeg:90,length:20}}
    ]));
    const run=await evaluateDocument(doc,core,[{id:'bs',kind:'beam-splitter-interactions',componentId:'BS1'}]);
    assert.equal(run.summary.executionPassed,false);
    assert.equal(run.summary.observations,null);
    assert.match(run.summary.native.errors.join(' '),/within 0\.01 mm of a finite component endpoint/);
  }
});

test('v40 beam-splitter negative controls, legacy isolation, structural revisions, and run-problem sole-target binding',async()=>{
  const s1={id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.4},emission:{mode:'single-ray',directionDeg:0}};
  const bs=extra=>({id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:30,transmissionRatio:0.5,...extra}});

  // 1. transmissionRatio bounds [0.01, 0.99]
  for(const badT of [0,1,-0.1,0.005,0.995,1.5]){
    assert.throws(()=>prepareScene(v40Req([s1,bs({transmissionRatio:badT})])),/allowed \[0\.01, 0\.99\]/);
  }

  // 2. Over-count (3 beam splitters > max 2)
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:90,length:20,transmissionRatio:0.5}},
    {id:'BS2',type:'beam-splitter',parameters:{x:20,y:0,orientationDeg:90,length:20,transmissionRatio:0.5}},
    {id:'BS3',type:'beam-splitter',parameters:{x:40,y:0,orientationDeg:90,length:20,transmissionRatio:0.5}}
  ])),/0–2 beam splitters/);

  // 3. Exterior-only vs dielectric bodies (strictly inside, crossing, AND flush on flat face all rejected!)
  const slab={id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-20,x2:40,y2:-20,x3:40,y3:20,x4:0,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  assert.throws(()=>prepareScene(v40Req([s1,slab,{id:'BS1',type:'beam-splitter',parameters:{x:20,y:0,orientationDeg:90,length:10,transmissionRatio:0.5}}])),
    /finite segment must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([s1,slab,{id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:90,length:20,transmissionRatio:0.5}}])),
    /finite segment must lie outside dielectric body/);

  // 4. No corner-touching with plane-mirror and strict >= 0.01 mm clearance from arc mirror
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'M1',type:'plane-mirror',parameters:{x:10,y:0,orientationDeg:0,length:20}},
    {id:'BS1',type:'beam-splitter',parameters:{x:0,y:10,orientationDeg:90,length:20,transmissionRatio:0.5}}
  ])),/finite segments intersect or nearly touch/);
  assert.throws(()=>prepareScene(v40Req([
    s1,
    {id:'CM1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:-50,apertureHeight:40}},
    {id:'BS1',type:'beam-splitter',parameters:{x:-0.005,y:0,orientationDeg:90,length:20,transmissionRatio:0.5}}
  ])),/finite segment intersects or approaches circular-arc-mirror/);

  // 5. Strict legacy isolation (v4 unmarked, v37, v38, v39 all reject beam-splitter)
  assert.throws(()=>prepareScene({lengthUnit:'mm',components:[s1,bs()]}));
  for(const legacyModel of ['native-general-optical-bench','native-general-refractive-bench','native-general-hybrid-bench']){
    assert.throws(()=>prepareScene({model:legacyModel,lengthUnit:'mm',components:[s1,bs()]}));
  }

  // 6. Observable type separation: mirror-reflections rejects beam-splitter, beam-splitter-interactions rejects plane-mirror
  const {document:mixDoc}=prepareScene(v40Req([
    s1,bs(),
    {id:'M1',type:'plane-mirror',parameters:{x:40,y:0,orientationDeg:90,length:30}}
  ]));
  const mixRun=await evaluateDocument(mixDoc,core,[]);
  const mismatch=await evaluateObservables(mixDoc,[
    {id:'bad1',kind:'mirror-reflections',componentId:'BS1'},
    {id:'bad2',kind:'beam-splitter-interactions',componentId:'M1'}
  ],mixRun.summary);
  assert.equal(mismatch.results[0].status,'unavailable');
  assert.equal(mismatch.results[1].status,'unavailable');

  // 7. Structural revision (reviseComponents): add and remove beam-splitter preserving backgroundIndex and randomSeed
  const {document:baseDoc}=prepareScene(v40Req([s1],{backgroundIndex:1.25,randomSeed:'bs-struct-seed'}));
  const withBs=reviseComponents(baseDoc,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'add',lengthUnit:'cm',component:{id:'BS1',type:'beam-splitter',parameters:{x:0,y:0,orientationDeg:45,length:4,transmissionRatio:0.6}}}]
  }).document;
  assert.equal(withBs.physics.components.find(c=>c.id==='BS1').parameters.length,40);
  assert.equal(withBs.physics.components.find(c=>c.id==='BS1').parameters.transmissionRatio,0.6);
  const removed=reviseComponents(withBs,{
    format:COMPONENT_REVISION_FORMAT,
    operations:[{op:'remove',id:'BS1'}]
  }).document;
  assert.equal(removed.physics.backgroundIndex,1.25);
  assert.equal(removed.simulation.randomSeed,'bs-struct-seed');

  // 8. Unified run-problem.mjs sole-compatible target binding for beam-splitter-interactions
  const outRel='test-artifacts/llm-authoring/v40-bs-workflow-'+Date.now()+'-'+process.pid;
  const outAbs=resolve(root,outRel);
  try{
    const res=await runProblemEvidence({
      inputBytes:Buffer.from(JSON.stringify({
        format:'opticsim-problem-v1',
        physical:v40Req([
          s1,bs(),
          {id:'D1',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:40}}
        ]),
        requests:[
          {id:'bs-hits',kind:'beam-splitter-interactions'},
          {id:'det',kind:'detector-crossings'}
        ]
      },null,2),'utf8'),
      outputPath:outRel,
      execute:async(scene,reqs)=>evaluateDocument(scene,core,reqs)
    });
    assert.equal(res.exitCode,0);
    assert.equal(res.report.status,'all-requested-quantities-available');
    assert.deepEqual(res.report.targetBindings,[
      {requestId:'bs-hits',kind:'beam-splitter-interactions',componentId:'BS1',rule:'sole-compatible-authored-component'},
      {requestId:'det',kind:'detector-crossings',componentId:'D1',rule:'sole-compatible-authored-component'}
    ]);
    assert.equal(res.report.results[0].value,1);
    assert.equal(res.report.results[1].value,1);
  }finally{
    rmSync(outAbs,{recursive:true,force:true});
  }
});
