import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/thick-lens-finite-conjugate-study-v1/frozen.json',import.meta.url)));
const protocol=frozen.nativeProtocol,root='test-artifacts/llm-authoring';
mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'thick-lens-finite-conjugate-'));
const close=(a,b,tolerance)=>assert.ok(Math.abs(a-b)<tolerance,JSON.stringify({actual:a,expected:b,tolerance}));

function trace(trial,height,slope){
  const lenses=trial.lensIds.map(id=>({id,type:'spherical-lens',parameters:frozen.lenses[id]}));
  const first=lenses[0].parameters;
  const objectX=first.x-first.centerThickness/2-trial.objectDistanceFromFrontMm;
  const detectorX=trial.rearPoleMm+protocol.detectorGapFromRearMm;
  const components=[
    {id:'S',type:'point-source',parameters:{x:objectX,y:height,brightness:.04},
      emission:{mode:'single-ray',directionDeg:Math.atan(slope)*180/Math.PI}},
    ...lenses,
    {id:'D',type:'ray-detector',parameters:{x:detectorX,y:0,orientationDeg:90,length:18}}
  ];
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'preview-v1',components}).document;
  assert.equal(doc.schemaVersion,15);
  const types=core.compile(doc).native.objs.map(o=>o.type);
  assert.deepEqual(types,['SingleRay',...lenses.map(()=> 'SphericalLens'),'Detector']);
  const requests=[
    ...lenses.map(l=>({id:l.id,kind:'interface-face-events',componentId:l.id})),
    {id:'hits',kind:'detector-hit-events',componentId:'D'}
  ];
  const {summary}=evaluateDocument(doc,core,requests);
  assert.equal(summary.native.status,'completed');
  assert.equal(summary.native.emitted,1);
  for(const {id} of lenses){
    const meter=summary.observations.interfacesById[id];
    assert.equal(meter.transmitted,2);
    assert.equal(meter.totalInternalReflections,0);
    assert.equal(meter.faces['front-arc'].interactions,1);
    assert.equal(meter.faces['back-arc'].interactions,1);
    assert.equal(meter.faces['top-rim'].interactions+meter.faces['bottom-rim'].interactions,0);
  }
  const hits=summary.observations.detectorHitEventsById.D.events;
  assert.equal(hits.length,1);
  assert.ok(hits[0].incomingUnit.x>0);
  close(hits[0].pointMm.x,detectorX,1e-8);
  return {emission:{height,slope},native:summary.native,interfaces:summary.observations.interfacesById,hit:hits[0]};
}

for(const trial of frozen.trials)test('finite conjugate from pinned native thick lenses '+trial.id,()=>{
  for(const height of protocol.objectHeightsMm){
    const rays=protocol.slopes.map(slope=>trace(trial,height,slope)),estimates=[];
    for(let i=0;i<rays.length-1;i++)for(let j=i+1;j<rays.length;j++){
      const a=rays[i].hit,b=rays[j].hit;
      const am=a.incomingUnit.y/a.incomingUnit.x,bm=b.incomingUnit.y/b.incomingUnit.x;
      assert.ok(Math.abs(am-bm)>1e-5);
      const projection=(b.pointMm.y-a.pointMm.y)/(am-bm);
      const signedDistance=a.pointMm.x+projection-trial.rearPoleMm;
      const imageHeight=a.pointMm.y+projection*am;
      close(signedDistance,trial.signedImageDistanceMm,protocol.maxAxialResidualMm);
      close(imageHeight,height*trial.magnification,protocol.maxTransverseResidualMm);
      estimates.push({signedDistance,imageHeight});
    }
    writeFileSync(join(out,trial.id+'-'+height+'.json'),JSON.stringify({trial,rays,estimates},null,2),{flag:'wx'});
  }
});
