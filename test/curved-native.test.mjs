import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {validate,serializeSave,parseSave} from '../src/contract.js';
import {compileCurved,curvedPoints} from '../src/curved-mirrors.js';
import {analyzeCurvedMirrorQuery} from '../src/curved-mirror-queries.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const request=(type='ideal-curved-mirror',f=100)=>({lengthUnit:'mm',components:[
 {id:'S1',type:'point-source',parameters:{x:-300,y:5,brightness:.1},emission:{mode:'directional',directionDeg:0,angleDeg:10}},
 {id:'M1',type,parameters:{x:0,y:0,normalDeg:180,apertureHeight:80,...(type==='ideal-curved-mirror'?{focalLength:f}:{radius:2*f})}}
]});
function shoot(type,h,f=100){
 const c=request(type,f).components[1],native={version:5,objs:[{type:'SingleRay',p1:{x:-300,y:0},p2:{x:0,y:-h},brightness:.1},compileCurved(c)],mode:'rays',maxRayDepth:8};
 const scene=core.loadNative(native),m=scene.objs[1],original=m.onRayIncident;const events=[];
 m.onRayIncident=function(...args){const before=structuredClone(args[0]),ret=original.apply(this,args);events.push({before,after:structuredClone(args[0]),point:args[2]});return ret;};
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);let complete=false;sim.on('simulationComplete',()=>complete=true);sim.updateSimulation();
 assert.equal(complete,true);assert.equal(sim.totalTruncation,0);assert.equal(events.length,1);
 const e=events[0],a=e.after.p1,b=e.after.p2;
 return {...e,axisCross:a.x-a.y*(b.x-a.x)/(b.y-a.y)};
}
test('v6 curved scenes remain isolated from v4/v5 schemas and preserve signed physical fields',()=>{
 for(const type of ['ideal-curved-mirror','circular-arc-mirror']){
  const doc=prepareScene(request(type)).document;assert.equal(doc.schemaVersion,6);assert.equal(validate(doc),doc);
  assert.deepEqual(parseSave(serializeSave(doc)),doc);
  for(const version of [4,5]){const old=structuredClone(doc);old.schemaVersion=old.adapterVersion=version;old.physics.model=version===4?'general-component-tracing':'planar-media-tracing';assert.throws(()=>validate(old));}
 }
 const p=request('circular-arc-mirror');p.components[1].parameters.apertureHeight=400;assert.throws(()=>prepareScene(p),/minor arc/);
 const r=request();r.components[0].parameters.x=-10;assert.throws(()=>prepareScene(r),/bounding disk/);
 const l=request();l.components.push({id:'L1',type:'ideal-lens',parameters:{x:200,focalLength:100,apertureHeight:20}});assert.throws(()=>prepareScene(l),/no lenses/);
});
test('native IdealMirror finite rays agree with ideal image distance for concave and convex focal signs',()=>{
 for(const f of [100,-100])for(const h of [5,30])near(shoot('ideal-curved-mirror',h,f).axisCross,-f*300/(300-f));
});
test('circular mirror uses native local-normal reflection and shows finite-aperture spherical aberration',()=>{
 const small=shoot('circular-arc-mirror',2),wide=shoot('circular-arc-mirror',30);
 assert.ok(Math.abs(small.axisCross+150)<.1);assert.ok(Math.abs(wide.axisCross+150)>.1);
 const e=wide,a=e.before.p1,p=e.point,b=e.after.p2;
 const incoming={x:p.x-a.x,y:p.y-a.y};const il=Math.hypot(incoming.x,incoming.y);incoming.x/=il;incoming.y/=il;
 const normal={x:p.x+200,y:p.y},nl=Math.hypot(normal.x,normal.y);normal.x/=nl;normal.y/=nl;
 const dot=incoming.x*normal.x+incoming.y*normal.y;
 const expected={x:incoming.x-2*dot*normal.x,y:incoming.y-2*dot*normal.y},ol=Math.hypot(b.x-p.x,b.y-p.y);
 near((b.x-p.x)/ol,expected.x);near((b.y-p.y)/ol,expected.y);
});
test('rotated signed-radius geometry has the declared circular center and bounded minor arc',()=>{
 for(const normalDeg of [-90,0,35,180])for(const radius of [200,-200]){
  const c={type:'circular-arc-mirror',parameters:{x:10,y:-5,normalDeg,radius,apertureHeight:80}};
  const a=normalDeg*Math.PI/180,center={x:10+radius*Math.cos(a),y:-5+radius*Math.sin(a)};
  for(const p of curvedPoints(c))near(Math.hypot(p.x-center.x,p.y-center.y),Math.abs(radius));
 }
});
test('native accepted curved scenes execute, count reflections, round-trip and obey depth suppression',()=>{
 for(const type of ['ideal-curved-mirror','circular-arc-mirror']){
  const doc=prepareScene(request(type)).document,original=structuredClone(doc);
  const out=evaluateDocument(doc,core);assert.equal(out.summary.executionPassed,true,JSON.stringify(out.summary));
  assert.ok(out.summary.observations.reflectionsById.M1>0);assert.deepEqual(doc,original);
  const low=structuredClone(doc);low.simulation.maxRayDepth=0;
  const stopped=evaluateDocument(low,core);assert.equal(stopped.summary.executionPassed,false);assert.equal(stopped.summary.observations,null);
  const revised=reviseScene(doc,{changes:[{id:'M1',section:'parameters',key:type==='ideal-curved-mirror'?'focalLength':'radius',value:150}]}).document;
  assert.equal(revised.schemaVersion,6);
 }
});
test('passive detector counts and bounded two-curved-mirror scope remain distinct from single-image analysis',()=>{
 const p=request('circular-arc-mirror');p.components.push({id:'D1',type:'ray-detector',parameters:{x:-120,y:0,orientationDeg:90,length:200}});
 const doc=prepareScene(p).document,out=evaluateDocument(doc,core);
 assert.equal(out.summary.executionPassed,true);assert.ok(out.summary.observations.detectorsById.D1.crossings>0);
 const two=request();two.components.push({id:'M2',type:'circular-arc-mirror',parameters:{x:-600,y:0,normalDeg:0,radius:200,apertureHeight:60}});
 const d=prepareScene(two).document;assert.equal(d.physics.components.filter(c=>c.type.includes('mirror')).length,2);
 assert.throws(()=>analyzeCurvedMirrorQuery(two,{format:'opticsim-curved-mirror-query-v1',kind:'curved-mirror-image'}),/one source and one curved/);
});
