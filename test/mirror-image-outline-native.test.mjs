import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'mirror-image-outline-'));
for(const [id,distance,height] of [['A',330,0],['B',330,1],['E',280,2],['D',280,0]])
  test('A09 independent native source at vertex '+id,()=>{
    const components=[
      {id:'S',type:'point-source',parameters:{x:-distance,y:height,brightness:.04},
        emission:{mode:'directional',directionDeg:0,angleDeg:1.8}},
      {id:'M',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:200,apertureHeight:40}},
      {id:'D',type:'ray-detector',parameters:{x:-100,y:0,orientationDeg:90,length:60}}
    ];
    const doc=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',components}).document;
    const paths=new Map();
    const observed={...core,loadDocument(...args){
      const loaded=core.loadDocument(...args),source=loaded.scene.objs[loaded.idMap.get('S')];
      const start=source.onSimulationStart;
      source.onSimulationStart=function(...a){
        const ret=start.apply(this,a);
        for(const ray of ret.newRays){assert.ok(!paths.has(ray));paths.set(ray,[]);}
        return ret;
      };
      for(const label of ['D','M']){
        const optic=loaded.scene.objs[loaded.idMap.get(label)],incident=optic.onRayIncident;
        optic.onRayIncident=function(ray,...rest){
          paths.get(ray).push([label,Math.sign(ray.p2.x-ray.p1.x)]);
          return incident.call(this,ray,...rest);
        };
      }
      return loaded;
    }};
    const {summary}=evaluateDocument(doc,observed,[{id:'hits',kind:'detector-hit-events',componentId:'D'}]);
    assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
    assert.equal(paths.size,3);
    for(const sequence of paths.values())assert.deepEqual(sequence,[['D',1],['M',1],['D',-1]]);
    const data=summary.observations.detectorHitEventsById.D;
    assert.equal(data.status,'complete');
    const returning=data.events.filter(e=>e.incomingUnit.x<0);
    assert.equal(returning.length,3);
    const expected={x:-100*distance/(distance-100),y:-100*height/(distance-100)};
    const intersections=[];
    for(const [i,a] of returning.entries())for(const b of returning.slice(i+1)){
      const ma=a.incomingUnit.y/a.incomingUnit.x,mb=b.incomingUnit.y/b.incomingUnit.x;
      assert.ok(Math.abs(ma-mb)>1e-6);
      const x=a.pointMm.x+(b.pointMm.y-a.pointMm.y+(a.pointMm.x-b.pointMm.x)*mb)/(ma-mb);
      const y=a.pointMm.y+(x-a.pointMm.x)*ma;
      assert.ok(Math.abs(x-expected.x)<.15&&Math.abs(y-expected.y)<.025);
      intersections.push({x,y});
    }
    writeFileSync(join(out,id+'.json'),JSON.stringify({doc,summary,expected,intersections},null,2),{flag:'wx'});
  });
