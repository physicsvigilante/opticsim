import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {analyzeSurfaceFocus,SURFACE_FOCUS_FACTS,SURFACE_FOCUS_QUERY} from '../src/two-surface-focus.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const evidenceRoot='test-artifacts/llm-authoring';
mkdirSync(evidenceRoot,{recursive:true});
const evidence=mkdtempSync(join(evidenceRoot,'material-lens-native-'));
for(const outsideIndex of [1,1.6]) for(const insideIndex of [1.5,1.7])
  test('A34 finite lens native witness in index '+outsideIndex+' with material '+insideIndex,()=>{
    const sources=[-1,1].map((y,i)=>({id:'S'+i,type:'point-source',parameters:{x:-50,y,brightness:.04},
      emission:{mode:'single-ray',directionDeg:0}}));
    const lens={id:'L',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:20,centerThickness:5,
      frontRadius:200,backRadius:200,insideIndex,outsideIndex,partialReflection:false}};
    const detector={id:'D',type:'ray-detector',parameters:{x:30,y:0,length:30,orientationDeg:90}};
    const doc=prepareScene({lengthUnit:'mm',components:[...sources,lens,detector]}).document;
    assert.equal(doc.schemaVersion,15);
    const requests=[{id:'hits',kind:'detector-hit-events',componentId:'D'}];
    const {summary}=evaluateDocument(doc,core,requests);
    assert.equal(summary.native.status,'completed');
    assert.deepEqual(summary.native.warnings,[]);
    const arc=summary.observations.interfacesById.L;
    assert.equal(arc.transmitted,4);
    assert.equal(arc.faces['front-arc'].interactions,2);
    assert.equal(arc.faces['back-arc'].interactions,2);
    const hits=summary.observations.detectorHitEventsById.D;
    assert.equal(hits.status,'complete');assert.equal(hits.events.length,2);
    assert.deepEqual(new Set(hits.events.map(h=>Math.sign(h.pointMm.y))),new Set([-1,1]));
    const finite=analyzeSurfaceFocus({format:SURFACE_FOCUS_FACTS,incidence:'collimated-positive-x',
      geometry:{kind:'two-coaxial-spherical-surfaces',lengthUnit:'mm',entranceIndex:outsideIndex,
        coreIndex:insideIndex,exitIndex:outsideIndex,axialThickness:5,
        front:{id:'front',signedRadius:200},rear:{id:'rear',signedRadius:-200}}},
      {format:SURFACE_FOCUS_QUERY,kind:'two-surface-back-focus'}).value.signedBackFocalDistance;
    const thin=outsideIndex*100/(insideIndex-outsideIndex);
    writeFileSync(join(evidence,'exterior-'+outsideIndex+'-glass-'+insideIndex+'.json'),
      JSON.stringify({doc,requests,summary,finiteBackFocusMm:finite,thinFocalLengthMm:thin},null,2)+'\n',{flag:'wx'});
    for(const {pointMm,incomingUnit} of hits.events){
      const z=pointMm.x-2.5-pointMm.y*incomingUnit.x/incomingUnit.y;
      assert.ok(Math.abs(z-finite)<.12,JSON.stringify({z,finite}));
      assert.equal(Math.sign(z),Math.sign(thin));
      assert.ok(Math.abs(z-thin)<.01*Math.abs(thin));
    }
  });
