import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {measureNativeSingleRay} from './helpers/measure-native-single-ray.mjs';

const frozen=JSON.parse(readFileSync(new URL('../evaluation/three-lens-relay-study-v1/frozen.json',import.meta.url)));
const g=frozen.nativeProtocol;
mkdirSync('test-artifacts/llm-authoring',{recursive:true});
const out=mkdtempSync('test-artifacts/llm-authoring/three-lens-relay-');
function trace(trial,objectX,height,slope){
  const source={type:'SingleRay',brightness:g.brightness,p1:{x:objectX,y:-height},p2:{x:objectX+10,y:-height-10*slope}};
  const lenses=g.lensPositionFactors.map((factor,i)=>{
    const x=factor*g.aMm;
    return {type:'IdealLens',p1:{x,y:-g.apertureMm/2},p2:{x,y:g.apertureMm/2},focalLength:trial.focalScaleFactors[i]*g.aMm};
  });
  const detector={type:'Detector',p1:{x:g.detectorXmm,y:-g.detectorHeightMm/2},p2:{x:g.detectorXmm,y:g.detectorHeightMm/2}};
  const record=measureNativeSingleRay({version:5,width:1200,height:700,origin:{x:200,y:350},scale:1,
    lengthScale:1,mode:'rays',rayModeDensity:0.1,maxRayDepth:g.maxRayDepth,objs:[source,...lenses,detector]});
  assert.deepEqual(record.events.map(e=>e.objectIndex),[1,2,3,4]);
  assert.ok(record.events.every(e=>e.before.x>0 && e.after.x>0));
  return record;
}
for(const trial of frozen.cases)test('three-lens native relay '+trial.id,()=>{
  const observations=[];
  for(const objectX of g.objectXmm)for(const height of g.objectHeightMm){
    const records=g.slopes.map(s=>trace(trial,objectX,height,s));
    const [a,b]=records.map(r=>r.events.at(-1));
    assert.ok(Math.abs(a.x-g.detectorXmm)<1e-8 && Math.abs(b.x-g.detectorXmm)<1e-8);
    const m=a.before.y/a.before.x,n=b.before.y/b.before.x;
    assert.ok(Math.abs(m-n)>1e-4);
    const delta=(b.y-a.y)/(m-n), imageX=a.x+delta,imageY=a.y+m*delta;
    assert.ok(imageX<g.lensPositionFactors.at(-1)*g.aMm);
    assert.ok(Math.abs(imageX-(objectX+g.aMm*trial.expectedAxialShiftInA))<0.05);
    assert.ok(Math.abs(imageY-height*trial.transverseMagnification)<0.001);
    observations.push({objectX,height,imageX,imageY,records});
  }
  writeFileSync(join(out,trial.id+'.json'),JSON.stringify(observations,null,2),{flag:'wx'});
});
