import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/calibrated-lens-immersion-v1/frozen.json',import.meta.url)));
const g=frozen.syntheticNativeControl;
mkdirSync('test-artifacts/llm-authoring',{recursive:true});
const out=mkdtempSync('test-artifacts/llm-authoring/calibrated-lens-immersion-');

for(const outsideIndex of g.media) test('calibrated immersion native control at exterior index '+outsideIndex,()=>{
  const frontPower=(g.lensIndex-outsideIndex)/g.frontRadiusMm;
  const rearPower=(outsideIndex-g.lensIndex)/g.rearSignedRadiusMm;
  const rearHeight=1-g.thicknessMm*frontPower/g.lensIndex;
  const expected=outsideIndex*rearHeight/(frontPower+rearPower*rearHeight);
  const rearPole=g.thicknessMm/2, detectorX=rearPole+g.detectorGapFromRearMm;
  const records=[];
  for(const y of g.singleRayHeightsMm){
    const components=[
      {id:'S',type:'point-source',parameters:{x:-50,y,brightness:0.04},emission:{mode:'single-ray',directionDeg:0}},
      {id:'L',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:g.apertureHeightMm,centerThickness:g.thicknessMm,
        frontRadius:g.frontRadiusMm,backRadius:-g.rearSignedRadiusMm,insideIndex:g.lensIndex,outsideIndex,partialReflection:false}},
      {id:'D',type:'ray-detector',parameters:{x:detectorX,y:0,length:20,orientationDeg:90}}
    ];
    const doc=prepareScene({lengthUnit:'mm',components}).document;
    assert.equal(doc.schemaVersion,15);
    const {summary}=evaluateDocument(doc,core,[{id:'hits',kind:'detector-hit-events',componentId:'D'}]);
    assert.equal(summary.native.status,'completed');
    assert.deepEqual(summary.native.warnings,[]);
    const boundary=summary.observations.interfacesById.L;
    assert.equal(boundary.interactions,2);
    assert.equal(boundary.transmitted,2);
    assert.equal(boundary.faces['front-arc'].interactions,1);
    assert.equal(boundary.faces['back-arc'].interactions,1);
    const detector=summary.observations.detectorHitEventsById.D;
    assert.equal(detector.status,'complete');
    assert.equal(detector.events.length,1);
    const {pointMm,incomingUnit}=detector.events[0];
    assert.ok(incomingUnit.x>0 && Math.abs(pointMm.x-detectorX)<1e-8);
    const backFocus=pointMm.x-rearPole-pointMm.y*incomingUnit.x/incomingUnit.y;
    assert.ok(Math.abs(backFocus-expected)<0.5,JSON.stringify({backFocus,expected}));
    records.push({doc,summary,backFocus,expected});
  }
  assert.ok(Math.abs(records[0].backFocus-records[1].backFocus)<0.01);
  writeFileSync(join(out,'medium-'+outsideIndex+'.json'),JSON.stringify(records,null,2),{flag:'wx'});
});
