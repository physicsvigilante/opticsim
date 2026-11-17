// RESEARCH ONLY — native mixed-object composability, not public authoring.
// This test starts with a valid canonical v15 thick-lens scene, appends a
// built-in pinned PhyDemo Mirror and Detector to its TEST-ONLY native JSON,
// then observes the native simulator. No physics, scene admission, ray route,
// threshold, source type or product UI behavior is changed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-train.json',import.meta.url),'utf8'));
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const direction=ray=>{
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,n=Math.hypot(dx,dy);
 assert.ok(n>0&&Number.isFinite(n));
 return {x:dx/n,y:dy/n};
};

function run({mirrorY=0,mirrorX=130,sourceHeight=10,includeDetector=true}={}){
 const request=structuredClone(fixture.physical);
 request.components=request.components.filter(c=>['S1','L1'].includes(c.id));
 request.components.find(c=>c.id==='S1').parameters.y=sourceHeight;
 const doc=prepareScene(request).document;
 assert.equal(doc.schemaVersion,15);
 const compiled=core.compile(doc);
 assert.equal(compiled.native.objs[1].type,'SphericalLens');
 // The mirror and detector are NOT canonical v15 components. We test native
 // feasibility without implying this mixed arrangement has been admitted.
 const mirrorIndex=compiled.native.objs.length;
 compiled.native.objs.push({type:'Mirror',
  p1:{x:mirrorX,y:-mirrorY-100},p2:{x:mirrorX,y:-mirrorY+100},filter:false});
 const detectorIndex=compiled.native.objs.length;
 if(includeDetector)compiled.native.objs.push({type:'Detector',
  p1:{x:-100,y:-120},p2:{x:-100,y:120},irradMap:false});
 const loaded=core.loadNative(compiled.native),events=[];
 const specs=[{id:'L1',type:'SphericalLens',index:1},
  {id:'M1',type:'Mirror',index:mirrorIndex},
  ...(includeDetector?[{id:'D1',type:'Detector',index:detectorIndex}]:[])];
 for(const spec of specs){
  const native=loaded.objs[spec.index];
  assert.equal(native.constructor.type,spec.type);
  const original=native.onRayIncident;
  native.onRayIncident=function(...args){
   const before=direction(args[0]),at={x:args[2].x,y:-args[2].y},
    result=original.apply(this,args);
   const outputs=[...(!result?.isAbsorbed?[args[0]]:[]),...(result?.newRays||[])];
   assert.ok(events.length<24,'Bounded actual native interaction evidence');
   events.push({id:spec.id,type:spec.type,point:at,incoming:before,
    outgoing:outputs.map(direction),
    truncation:result?.truncation??0,absorbed:result?.isAbsorbed===true});
   return result;
  };
 }
 const sim=new core.Simulator(loaded,null,null,null,null,null,false,10000);
 let completion=null;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{completion=name;});
 sim.updateSimulation();
 return {doc,events,completion,source:request.components.find(c=>c.id==='S1')};
}

function verifySphericalEvent(event,physical){
 assert.equal(event.type,'SphericalLens');
 assert.equal(event.outgoing.length,1);
 assert.equal(event.absorbed,false);
 const {x,y}=event.point,p=physical,half=p.apertureHeight/2;
 assert.ok(Math.abs(y-p.y)<half-0.01,'Native finite spherical arc, not a rim/corner');
 const left=p.x-p.centerThickness/2,right=p.x+p.centerThickness/2;
 const front=x<p.x;
 const R=front?p.frontRadius:p.backRadius,cx=front?left+R:right-R;
 near(Math.hypot(x-cx,y-p.y),R,1e-5);
 const n={x:(x-cx)/R,y:(y-p.y)/R},incoming=event.incoming;
 const leaving=dot(incoming,n)>0,ni=leaving?p.insideIndex:p.outsideIndex,
  nt=leaving?p.outsideIndex:p.insideIndex;
 const out=event.outgoing[0];
 assert.ok(dot(incoming,n)*dot(out,n)>0,'Native branch must transmit on Fresnel-off path');
 near(ni*cross(incoming,n),nt*cross(out,n),1e-7);
 return {face:front?'front-arc':'back-arc',from:leaving?'inside':'outside',
  point:event.point,incidentIndex:ni,destinationIndex:nt,
  incoming:event.incoming,outgoing:out};
}

test('Test-only mixed native SphericalLens+Mirror retraces the SAME finite lens on a return path',()=>{
 assert.equal(capabilities().composition.profiles.some(p=>
  p.schemaVersion===15&&p.counts['plane-mirror']),false,
  'v15 still does not publicly admit mixing lens and mirror');
 const r=run(),ids=r.events.map(e=>e.id);
 assert.equal(r.completion,'simulationComplete');
 assert.deepEqual(ids,['D1','L1','L1','M1','L1','L1','D1'],
  'The actual native intersections, not a prescribed route, must show lens return');
 const lens=r.doc.physics.components.find(c=>c.id==='L1').parameters;
 const sequence=r.events.filter(e=>e.id==='L1').map(e=>verifySphericalEvent(e,lens));
 assert.deepEqual(sequence.map(e=>e.face),['front-arc','back-arc','back-arc','front-arc']);
 assert.deepEqual(sequence.map(e=>e.from),['outside','inside','outside','inside']);
 const mirror=r.events.find(e=>e.id==='M1');
 assert.equal(mirror.outgoing.length,1);
 near(mirror.point.x,130);
 near(mirror.outgoing[0].x,-mirror.incoming.x);
 near(mirror.outgoing[0].y,mirror.incoming.y);
 const detector=r.events.filter(e=>e.id==='D1');
 assert.equal(detector.length,2);
 assert.ok(detector[0].incoming.x>0&&detector[1].incoming.x<0,
  'Passive detector sees actual outbound and return crossings');
 assert.ok(r.events.every(e=>e.truncation===0));
 console.log('THICK_LENS_MIRROR_NATIVE_FEASIBILITY '+JSON.stringify({
  upstream:r.doc.upstreamCommit,status:r.completion,
  sequence:ids,interfaces:sequence,mirror,
  detector:detector.map(e=>({point:e.point,direction:e.incoming}))
 }));
});

test('Moving external native mirror off the beam leaves a genuine lens-only encounter sequence',()=>{
 const r=run({mirrorY:500});
 assert.equal(r.completion,'simulationComplete');
 assert.deepEqual(r.events.map(e=>e.id),['D1','L1','L1']);
 assert.ok(r.events.every(e=>e.truncation===0));
 const lens=r.doc.physics.components.find(c=>c.id==='L1').parameters;
 r.events.filter(e=>e.id==='L1').forEach(e=>verifySphericalEvent(e,lens));
 assert.equal(r.events.filter(e=>e.id==='M1').length,0);
 console.log('THICK_LENS_MIRROR_NATIVE_MISS '+JSON.stringify({
  upstream:r.doc.upstreamCommit,sequence:r.events.map(e=>e.id),status:r.completion}));
});
