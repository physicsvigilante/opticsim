import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
test('full-circle to single-ray revision cannot inherit an inactive source direction',()=>{
 const input={lengthUnit:'mm',components:[
  {id:'S1',type:'point-source',parameters:{x:-300,y:5,brightness:.1},emission:{mode:'full-circle'}},
  {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,apertureHeight:80,focalLength:100}}
 ]};
 const doc=prepareScene(input).document;
 assert.throws(()=>reviseScene(doc,{changes:[{id:'S1',section:'emission',key:'mode',value:'single-ray'}]}),/explicit directionDeg/);
 const next=reviseScene(doc,{changes:[{id:'S1',section:'emission',key:'mode',value:'single-ray'},
  {id:'S1',section:'emission',key:'directionDeg',value:0}]}).document;
 assert.equal(next.physics.components[0].emission.mode,'single-ray');
 assert.equal(evaluateDocument(next,core).summary.executionPassed,true);
});
