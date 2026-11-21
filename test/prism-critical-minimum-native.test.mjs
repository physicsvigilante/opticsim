import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const evidence=mkdtempSync(join(root,'prism-critical-minimum-'));
const rad=Math.PI/180,ratio=Math.sqrt(5),iMin=Math.asin(ratio*Math.sin(22.5*rad))/rad;
test('A22 native second-face outcomes away from grazing and local minimum-deviation witnesses',()=>{
  const deltas=new Map();
  for(const i of [44,46,55,iMin,62]){
    const components=[{id:'S',type:'point-source',parameters:{x:-30,y:-30*Math.tan(i*rad),brightness:.04},
      emission:{mode:'single-ray',directionDeg:i}},
    {id:'G',type:'triangular-prism',parameters:{x1:0,y1:-100,x2:0,y2:100,x3:200,y3:-100,
      insideIndex:ratio,outsideIndex:1,partialReflection:false}}];
    const doc=prepareScene({lengthUnit:'mm',components}).document;
    const {summary}=evaluateDocument(doc,core,[{id:'faces',kind:'interface-face-events',componentId:'G'}]);
    writeFileSync(join(evidence,'i-'+i+'.json'),JSON.stringify({doc,summary},null,2),{flag:'wx'});
    assert.equal(doc.schemaVersion,8);
    assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
    const faces=summary.observations.interfacesById.G.faces;
    assert.equal(faces['face-12'].first.from,'outside');
    assert.equal(faces['face-23'].first.from,'inside');
    assert.equal(faces['face-23'].first.outcome,i===44?'total-internal-reflection':'transmission');
    if(i===44)continue;
    const branch=faces['face-23'].first.branches.find(e=>e.kind==='transmitted');
    const deviation=i-Math.atan2(branch.direction.y,branch.direction.x)/rad;
    const beta=Math.asin(Math.sin(i*rad)/ratio),e=Math.asin(ratio*Math.sin(45*rad-beta));
    assert.ok(Math.abs(deviation-(i+e/rad-45))<1e-8);
    deltas.set(i,deviation);
  }
  assert.ok(Math.abs(deltas.get(iMin)-(2*iMin-45))<1e-8);
  assert.ok(deltas.get(55)>deltas.get(iMin)&&deltas.get(62)>deltas.get(iMin));
});
