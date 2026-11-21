import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../../src/authoring.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
export function observeSphericalMirror({distance,height,detectorX,apertureHeight=40,measureIntersections=true}){
  const components=[
    {id:'S',type:'point-source',parameters:{x:-distance,y:height,brightness:.04},
      emission:{mode:'directional',directionDeg:0,angleDeg:1.8}},
    {id:'M',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:200,apertureHeight}},
    {id:'D',type:'ray-detector',parameters:{x:detectorX,y:0,orientationDeg:90,length:60}}
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
  if(!measureIntersections)return {doc,summary,returning};
  const intersections=[];
  for(const [i,a] of returning.entries())for(const b of returning.slice(i+1)){
    const ma=a.incomingUnit.y/a.incomingUnit.x,mb=b.incomingUnit.y/b.incomingUnit.x;
    assert.ok(Math.abs(ma-mb)>1e-6);
    const x=a.pointMm.x+(b.pointMm.y-a.pointMm.y+(a.pointMm.x-b.pointMm.x)*mb)/(ma-mb);
    const y=a.pointMm.y+(x-a.pointMm.x)*ma;
    intersections.push({x,y});
  }
  return {doc,summary,intersections};
}
