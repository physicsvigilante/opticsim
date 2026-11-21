// Independent finite-height native witnesses for the frozen A39/A40 settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const lens=(id,x,focalLength)=>({id,type:'ideal-lens',parameters:{x,focalLength,apertureHeight:400}});
const controls=[
  {id:'A39-mechanical',objective:4,eyepiece:25,separation:160,objectDistance:540/131,height:.01,reference:250,expected:-327.5},
  {id:'A39-optical',objective:4,eyepiece:25,separation:189,objectDistance:656/160,height:.01,reference:250,expected:-400},
  {id:'A40-near',objective:500,eyepiece:50,separation:10000/19+50,objectDistance:10000,height:1,reference:10000,expected:-200/19}
];
test('A40 distant adjustment: parallel off-axis input sampled at two heights',()=>{
  const components=[-1,1].map((y,i)=>({id:'S'+i,type:'point-source',
    parameters:{x:-30,y,brightness:.05},emission:{mode:'directional',directionDeg:-.4,angleDeg:1}}));
  components.push(lens('objective',0,500),lens('eyepiece',550,50));
  for(const [id,x] of [['before',-10],['after',560]])components.push({id,type:'ray-detector',
    parameters:{x,y:0,length:400,orientationDeg:90}});
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'preview-v1',components}).document;
  const req=['before','after'].map(id=>({id,kind:'detector-hit-events',componentId:id}));
  const {summary}=evaluateDocument(doc,core,req);
  assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
  assert.equal(summary.native.emitted,2);
  const hits=summary.observations.detectorHitEventsById;
  const slope=e=>e.incomingUnit.y/e.incomingUnit.x;
  for(const id of ['before','after']){
    assert.equal(hits[id].status,'complete');assert.equal(hits[id].events.length,2);
  }
  const incident=slope(hits.before.events[0]);
  assert.ok(Math.abs(incident-Math.tan(.1*Math.PI/180))<1e-10);
  assert.ok(Math.abs(slope(hits.before.events[1])-incident)<1e-12);
  for(const e of hits.after.events)assert.ok(Math.abs(slope(e)/incident+10)<1e-7);
});
for(const c of controls)test('Separated native ideal lenses: '+c.id,()=>{
  const detectorX=c.separation+10;
  const components=[
    {id:'object',type:'point-source',parameters:{x:-c.objectDistance,y:c.height,brightness:.05},
      emission:{mode:'directional',directionDeg:0,angleDeg:1}},
    lens('objective',0,c.objective),lens('eyepiece',c.separation,c.eyepiece),
    {id:'probe',type:'ray-detector',parameters:{x:detectorX,y:0,length:400,orientationDeg:90}}
  ];
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',components}).document;
  const counts={objective:0,eyepiece:0};
  const observedCore={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    for(const id of Object.keys(counts)){
      const obj=loaded.scene.objs[loaded.idMap.get(id)],native=obj.onRayIncident;
      obj.onRayIncident=function(...args){counts[id]++;return native.apply(this,args);};
    }
    return loaded;
  }};
  const req=[{id:'directions',kind:'detector-hit-events',componentId:'probe'}];
  const {summary}=evaluateDocument(doc,observedCore,req);
  assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
  const rays=summary.native.emitted,probe=summary.observations.detectorHitEventsById.probe;
  assert.ok(rays>=2);assert.equal(probe.status,'complete');assert.equal(probe.events.length,rays);
  assert.deepEqual(counts,{objective:rays,eyepiece:rays});
  for(const {incomingUnit:d} of probe.events){
    const gain=(d.y/d.x)/(-c.height/c.reference);
    assert.ok(Math.abs(gain-c.expected)<1e-7,JSON.stringify({gain,expected:c.expected}));
  }
});
