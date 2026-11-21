import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const materials={insideIndex:1.5,outsideIndex:1,partialReflection:false};
const evidenceBase='test-artifacts/llm-authoring';
mkdirSync(evidenceBase,{recursive:true});
const evidence=mkdtempSync(join(evidenceBase,'two-surface-focus-'));
function witness(components,rearX,detectorX,version,prediction,tolerance){
  const probe={type:'ray-detector',id:'D',parameters:{x:detectorX,y:0,length:100,orientationDeg:90}};
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'preview-v1',components:[...components,probe]}).document;
  assert.equal(doc.schemaVersion,version);
  const requests=[{id:'hits',kind:'detector-hit-events',componentId:'D'}];
  const {summary}=evaluateDocument(doc,core,requests);
  writeFileSync(join(evidence,'v'+version+'.json'),JSON.stringify({doc,requests,summary,rearX,prediction,tolerance},null,2)+'\n',{flag:'wx'});
  assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
  const sample=summary.observations.detectorHitEventsById.D;
  const meter=summary.observations.interfacesById.G,rays=summary.native.emitted;
  assert.ok(rays>=2);assert.equal(meter.interactions,2*rays);assert.equal(meter.transmitted,2*rays);
  assert.equal(sample.status,'complete');assert.equal(sample.events.length,rays);
  assert.deepEqual(new Set(sample.events.map(e=>Math.sign(e.pointMm.y))),new Set([-1,1]));
  for(const {pointMm,incomingUnit} of sample.events){
    const z=pointMm.x-rearX-pointMm.y*incomingUnit.x/incomingUnit.y;
    assert.ok(Number.isFinite(z)&&Math.abs(z-prediction)<=tolerance,JSON.stringify({z,prediction,tolerance}));
  }
  return {meter,rays};
}
test('A29 v23 meridional sphere: near-axis outgoing ray intercepts',()=>{
  const beam={id:'B',type:'parallel-beam',parameters:{x:-500,y:0,width:10,directionDeg:0,brightness:.04}};
  const glass={id:'G',type:'circular-dielectric',parameters:{x:0,y:0,radius:400,...materials}};
  witness([beam,glass],400,500,23,200,.2);
});
test('asymmetric v15 native lens: both curved faces and downstream slopes',()=>{
  const sources=[-1,-.5,.5,1].map((y,i)=>({id:'S'+i,type:'point-source',parameters:{x:-50,y,brightness:.04},
    emission:{mode:'single-ray',directionDeg:0}}));
  const glass={id:'G',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:30,centerThickness:20,
    frontRadius:120,backRadius:80,...materials}};
  const {meter,rays}=witness([...sources,glass],10,60,15,2720/29,.10);
  assert.equal(rays,4);
  for(const face of ['front-arc','back-arc'])assert.equal(meter.faces[face].interactions,rays);
});
