// Independent Chat B R2 test-only adversarial controls for pinned PR #83.
// This file is NOT a production change or an approval to merge this branch.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createNativeRayParentage} from '../src/native-ray-parentage.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const source=(id,x,y,directionDeg)=>({id,type:'point-source',
  parameters:{x,y,brightness:1},emission:{mode:'single-ray',directionDeg}});
const face=(negativeIndex=4/3,positiveIndex=1,partialReflection=true)=>({
  id:'Boundary',type:'planar-interface',parameters:{x:0,y:0,normalDeg:90,
    negativeIndex,positiveIndex,partialReflection}
});
const detector=(id,y,length=500)=>({id,type:'ray-detector',
  parameters:{x:0,y,orientationDeg:0,length}});
const doc=components=>prepareScene({
  lengthUnit:'mm',title:'Independent review-only adversarial native parentage',
  runPolicy:'preview-v1',components
}).document;
const requests=(...ids)=>ids.map((componentId,i)=>({
  id:'review'+i,kind:'detector-ray-provenance',componentId
}));
const execute=(scene,ids)=>evaluateDocument(scene,core,requests(...ids));
const graph=(out,id)=>out.summary.observations.detectorRayProvenanceById[id];

test('review-only: reordered native source, interface and detector compilation preserves both actual object ancestries and totals',()=>{
  const s1=source('First',-100,100,-45),s2=source('Second',-150,100,-45);
  const boundary=face(),below=detector('Below',-100,400),
    above=detector('Above',200,500);
  const orders=[[s1,s2,boundary,below,above],[above,boundary,s2,below,s1],
    [below,s2,above,s1,boundary]];
  const reports=orders.map(x=>execute(doc(x),['Above','Below']));
  for(const out of reports){
    assert.equal(out.summary.native.status,'completed');
    assert.equal(out.summary.native.truncation,0);
    assert.equal(out.summary.native.undefinedBehavior,0);
    assert.equal(out.summary.native.processed,10);
    assert.deepEqual(out.summary.observations.detectorsById.Below.crossings,2);
    assert.deepEqual(out.summary.observations.detectorsById.Above.crossings,2);
    for(const id of ['Above','Below']){
      const g=graph(out,id);assert.equal(g.status,'complete');
      assert.equal(g.value.crossings.length,2);
      assert.deepEqual(g.value.nodes.filter(n=>n.parentToken===null)
        .map(n=>n.sourceId).sort(),['First','Second']);
    }
    assert.equal(graph(out,'Above').value.nodes.filter(n=>n.origin==='native-spawn').length,2);
    assert.equal(graph(out,'Below').value.nodes.filter(n=>n.origin==='native-spawn').length,0);
  }
  for(const out of reports.slice(1)){
    for(const id of ['Below','Above']){
      assert.equal(out.summary.observations.detectorsById[id].signedPower,
        reports[0].summary.observations.detectorsById[id].signedPower);
    }
  }
});

test('review-only: explicit 1.5 to 1 native 30-degree transmission and 50-degree TIR preserve same-object identity',async()=>{
  for(const [angle,expectedDetector,expectedOutcome] of [
    [30,'TransmittedAbove','transmission'],
    [50,'ReflectedBelow','total-internal-reflection']
  ]){
    const scene=doc([
      source('HighIndexRay',-100,-100,90-angle),
      face(1.5,1,false),
      detector('ReflectedBelow',-220,1000),
      detector('TransmittedAbove',120)
    ]);
    const out=execute(scene,['ReflectedBelow','TransmittedAbove']);
    assert.equal(out.summary.native.status,'completed',String(angle));
    assert.equal(out.summary.native.truncation,0,String(angle));
    const first=out.summary.observations.interfacesById.Boundary.first;
    assert.ok(first);
    assert.equal(first.outcome,expectedOutcome);
    assert.ok(Math.abs(first.incidentAngleDeg-angle)<1e-9);
    if(angle===30){
      const snell=Math.asin(1.5*Math.sin(30*Math.PI/180))*180/Math.PI;
      assert.ok(Math.abs(first.transmittedAngleDeg-snell)<1e-9);
    }else{
      assert.ok(angle>Math.asin(1/1.5)*180/Math.PI);
      assert.equal(first.transmittedAngleDeg,null);
    }
    const selected=graph(out,expectedDetector).value;
    assert.equal(selected.crossings.length,1);
    assert.equal(selected.nodes.length,1);
    assert.equal(selected.nodes[0].origin,'native-emission');
    assert.equal(selected.nodes[0].sourceId,'HighIndexRay');
    assert.equal(selected.nodes[0].parentToken,null);
    const other=expectedDetector==='ReflectedBelow'?'TransmittedAbove':'ReflectedBelow';
    assert.deepEqual(graph(out,other).value,{nodes:[],crossings:[]});
    const evaluated=await evaluateObservables(scene,requests(expectedDetector),out.summary);
    assert.equal(evaluated.results[0].status,'qualified');
  }
});

function fakeLedger(ids){
  const comps=[source('S',0,10,-45),face(),detector('A',-100),detector('B',100)];
  const scene={objs:comps.map(()=>({onSimulationStart(){},onRayIncident(){}}))};
  const model={schemaVersion:5,physics:{model:'planar-media-tracing',components:comps}};
  const idMap=new Map(comps.map((c,i)=>[c.id,i]));
  const ledger=createNativeRayParentage(model,scene,idMap,ids);
  assert.ok(ledger);
  for(const c of comps){
    const native=scene.objs[idMap.get(c.id)];
    const method=c.type==='point-source'?'onSimulationStart':'onRayIncident';
    ledger.register(c.id,c.type,native,native[method],method);
  }
  return ledger;
}

test('review-only: per-selected 33-hit overflow does not poison another selected or nonselected detector',()=>{
  for(const ids of [['A'],['A','B']]){
    const l=fakeLedger(ids),ray={p1:{x:0,y:0},p2:{x:1,y:0}};
    l.sourceStarted('S',{newRays:[ray]});
    l.detector('A',ray);
    for(let k=0;k<33;k++)l.detector('B',ray);
    const out=l.finish({
      event:'simulationComplete',simulator:{totalTruncation:0,totalUndefinedBehavior:0},
      errors:[],warnings:[],sources:{byId:{S:{emitted:1}}},
      detectors:{byId:{A:{crossings:1,signedPower:1},B:{crossings:33,signedPower:33}}},
      interfaces:{byId:{Boundary:{interactions:0}}}
    });
    assert.equal(out.A.status,'complete');
    assert.equal(out.A.value.crossings.length,1);
    if(ids.length===2){
      assert.equal(out.B.status,'unavailable');
      assert.equal(out.B.reasonCode,'PROVENANCE_LIMIT_EXCEEDED');
      assert.equal(out.B.value,null);
    }else assert.equal(out.B,undefined);
  }
});

test('review-only: a real nonselected native detector hit bypassing its registered wrapper cannot certify another detector',()=>{
  const sceneDoc=doc([
    source('S',-100,100,-45),face(4/3,1,false),
    detector('Selected',-100,400),detector('Other',-200,400)
  ]);
  const {scene,idMap}=core.loadDocument(sceneDoc);
  const ledger=createNativeRayParentage(sceneDoc,scene,idMap,['Selected']);
  const sources=core.observeSourceSet(sceneDoc,scene,idMap,{parentage:ledger});
  const detectors=core.observeDetectorSet(sceneDoc,scene,idMap,{parentage:ledger});
  const interfaces=core.observeInterfaceSet(sceneDoc,scene,idMap,{parentage:ledger});
  const other=scene.objs[idMap.get('Other')];
  // Test-only fault: a native hit occurs through the original engine method,
  // not the registered observer; other.power remains a separate native witness.
  other.onRayIncident=Object.getPrototypeOf(other).onRayIncident;
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,
    sceneDoc.simulation.processedRayLimit);
  let data;
  simulator.on('simulationComplete',()=>{
    data=core.diagnostics(scene,simulator,sources,null,detectors,interfaces,null,
      {nativeEvent:'simulationComplete',parentage:ledger});
  });
  simulator.updateSimulation();
  assert.ok(data);
  assert.ok(data.detectorsById.Selected.crossings>0);
  assert.equal(data.detectorsById.Other.crossings,0);
  assert.notEqual(other.power,0,'Native unwrapped detector still recorded real power');
  assert.deepEqual(data.detectorRayProvenanceById.Selected,
    {status:'unavailable',reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',value:null});
});

test('review-only: genuine captured root plus injected native warning may never publish graph tokens',()=>{
  const ledger=fakeLedger(['A']),ray={p1:{x:0,y:0},p2:{x:1,y:0}};
  ledger.sourceStarted('S',{newRays:[ray]});ledger.detector('A',ray);
  const out=ledger.finish({
    event:'simulationComplete',simulator:{totalTruncation:0,totalUndefinedBehavior:0},
    errors:[],warnings:['native warning must disqualify provenance'],
    sources:{byId:{S:{emitted:1}}},
    detectors:{byId:{A:{crossings:1,signedPower:1},B:{crossings:0,signedPower:0}}},
    interfaces:{byId:{Boundary:{interactions:0}}}
  });
  assert.deepEqual(out.A,{status:'unavailable',
    reasonCode:'NATIVE_PROVENANCE_UNQUALIFIED',value:null});
  assert.ok(!JSON.stringify(out).includes('parentToken'));
});
