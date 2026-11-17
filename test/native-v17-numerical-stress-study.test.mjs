// Research-only numerical stress on the exact R2-reviewed v17 source tree.
// The pinned native PhyDemo computes every ray; the independent geometry below
// checks ACTUAL callback points. No scene admission, native solver, brightness
// threshold, cutoffs, model selection or reviewer verdict is modified.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(
 new URL('../examples/native-two-thick-lens-mirror-v17.json',import.meta.url),'utf8'));
const create=()=>structuredClone(fixture.physical);
const close=(a,b,eps=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=eps,`${a} != ${b}; abs error ${Math.abs(a-b)}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
const norm=r=>{
 const dx=r.p2.x-r.p1.x,dy=r.p1.y-r.p2.y,v=Math.hypot(dx,dy);
 assert.ok(Number.isFinite(v)&&v>0);
 return {x:dx/v,y:dy/v};
};
function capture(doc){
 const loaded=core.loadDocument(doc),trace=[];
 const emission=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
 const mirrors=core.observeMirrorSet(doc,loaded.scene,loaded.idMap);
 const detectors=core.observeDetectorSet(doc,loaded.scene,loaded.idMap);
 const interfaces=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
 for(const item of doc.physics.components){
  if(item.type==='point-source')continue;
  const native=loaded.scene.objs[loaded.idMap.get(item.id)];
  const original=native.onRayIncident;
  native.onRayIncident=function(...args){
   const incoming=norm(args[0]),point={x:args[2].x,y:-args[2].y};
   const returned=original.apply(this,args);
   const outputs=[...(!returned?.isAbsorbed?[args[0]]:[]),...(returned?.newRays||[])];
   assert.ok(trace.length<256,'Study must remain a finite bounded observation');
   trace.push({id:item.id,type:item.type,point,incoming,
    outgoing:outputs.map(norm),truncation:returned?.truncation??0,
    undefinedBehavior:returned?.isUndefinedBehavior===true});
   return returned;
  };
 }
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,
  doc.simulation.processedRayLimit);
 let completion=null;
 for(const name of ['simulationComplete','simulationStop'])
  sim.on(name,()=>{completion=name;});
 sim.updateSimulation();
 const diagnosis=core.diagnostics(loaded.scene,sim,emission,mirrors,detectors,interfaces);
 return {trace,status:core.classifyRun(completion,diagnosis),diagnosis,
  nativeCompletion:completion};
}
// Independent biconvex surface reconstruction; no prescribed ray itineraries.
function face(point,p){
 const a=p.apertureHeight/2,L=p.x-p.centerThickness/2,H=p.x+p.centerThickness/2;
 const sag=R=>a*a/(R+Math.sqrt(R*R-a*a));
 const rimL=L+sag(p.frontRadius),rimR=H-sag(p.backRadius),eps=3e-5;
 const candidates=[];
 for(const [name,center,r,side] of [
  ['front-arc',L+p.frontRadius,p.frontRadius,'left'],
  ['back-arc',H-p.backRadius,p.backRadius,'right']
 ]){
  const dx=point.x-center,dy=point.y-p.y,len=Math.hypot(dx,dy);
  const rightSide=side==='right'?dx>=-eps:dx<=eps;
  if(rightSide&&Math.abs(len-r)<eps&&Math.abs(dy)<=a+eps)
   candidates.push({id:name,normal:{x:dx/len,y:dy/len}});
 }
 if(Math.abs(point.y-(p.y+a))<eps&&point.x>=rimL-eps&&point.x<=rimR+eps)
  candidates.push({id:'top-rim',normal:{x:0,y:1}});
 if(Math.abs(point.y-(p.y-a))<eps&&point.x>=rimL-eps&&point.x<=rimR+eps)
  candidates.push({id:'bottom-rim',normal:{x:0,y:-1}});
 const corners=[{x:rimL,y:p.y+a},{x:rimR,y:p.y+a},
  {x:rimL,y:p.y-a},{x:rimR,y:p.y-a}];
 return {candidates,nearCorner:corners.some(c=>
  Math.hypot(c.x-point.x,c.y-point.y)<0.01)};
}
function checkActualEvent(e,p){
 assert.ok(Number.isFinite(e.point.x)&&Number.isFinite(e.point.y));
 const at=face(e.point,p);
 assert.equal(at.nearCorner,false,
  'A geometrically ambiguous near-corner callback cannot be independently certified');
 assert.equal(at.candidates.length,1,
  'A complete qualified native callback must have exactly one real finite physical face');
 const {id,normal:n}=at.candidates[0],projection=dot(e.incoming,n);
 assert.ok(Math.abs(projection)>1e-10,'Native near-tangent event is not a certified face');
 assert.ok(e.outgoing.length<=1,
  'Fresnel-off native scene should not fabricate a second branch');
 const pIn=projection>0?p.insideIndex:p.outsideIndex,
  pOut=projection>0?p.outsideIndex:p.insideIndex;
 for(const v of e.outgoing){
  if(projection*dot(v,n)>0){
   close(pIn*cross(e.incoming,n),pOut*cross(v,n),2e-7);
  }else{
   close(v.x,e.incoming.x-2*projection*n.x,2e-7);
   close(v.y,e.incoming.y-2*projection*n.y,2e-7);
  }
 }
 return {id,media:[pIn,pOut],point:e.point};
}
function checkNative(raw,doc){
 const lens=Object.fromEntries(doc.physics.components
  .filter(c=>c.type==='spherical-lens').map(c=>[c.id,c.parameters]));
 let curved=0;
 for(const e of raw.trace){
  if(Object.hasOwn(lens,e.id)){checkActualEvent(e,lens[e.id]);curved++;}
  if(e.type==='plane-mirror'){
   const mirror=doc.physics.components.find(c=>c.id===e.id),a=mirror.parameters.orientationDeg*Math.PI/180;
   const n={x:-Math.sin(a),y:Math.cos(a)},k=dot(e.incoming,n);
   assert.ok(e.outgoing.length<=1);
   for(const o of e.outgoing){
    close(o.x,e.incoming.x-2*k*n.x,2e-7);
    close(o.y,e.incoming.y-2*k*n.y,2e-7);
   }
  }
 }
 return curved;
}
async function publicWitness(doc,raw){
 const result=evaluateDocument(doc,core,fixture.requests);
 const checked=(await evaluateObservables(doc,fixture.requests,result.summary)).results;
 if(raw.status==='incomplete'||raw.status==='failed'||!result.summary.executionPassed){
  assert.equal(result.summary.executionPassed,false);
  assert.ok(checked.every(x=>x.status==='suppressed'&&x.value===null),
   'Native uncertainty must never publish a qualified request');
 }else assert.ok(checked.every(x=>['qualified','available'].includes(x.status)));
 return {publicStatus:result.summary.native.status,
  executionPassed:result.summary.executionPassed,
  resultStatuses:checked.map(x=>x.status)};
}
test('R2 follow-up: nine off-axis heights record actual native encounters or safe refusal',async()=>{
 const evidence=[];
 for(const height of [0,1,2,5,8,10,20,30,40]){
  const input=create();input.components.find(x=>x.id==='S1').parameters.y=height;
  const doc=prepareScene(input).document,raw=capture(doc);
  const qualified=await publicWitness(doc,raw);
  const checked=raw.status==='completed'?checkNative(raw,doc):null;
  evidence.push({height,status:raw.status,events:raw.trace.map(x=>x.id),
   checkedCurvedFaces:checked,truncation:raw.diagnosis.truncation,
   undefinedBehavior:raw.diagnosis.undefinedBehavior,
   errors:raw.diagnosis.errors,public:qualified});
 }
 assert.equal(evidence[0].status,'completed');
 assert.equal(evidence[0].events.join(','),'D1,L1,L1,L2,L2,M1,L2,L2,L1,L1,D1');
 assert.ok(evidence.some(x=>x.height>0&&x.status==='completed'));
 console.log('V17_STRESS_OFFAXIS '+JSON.stringify({pin:fixture.physical.runPolicy,
  cases:evidence}));
});
test('R2 follow-up: shared exterior material variations retain real local Snell or safe withholding',async()=>{
 const evidence=[];
 for(const outsideIndex of [1,1.1,1.2,1.33,1.4]){
  const input=create();input.components.find(x=>x.id==='S1').parameters.y=5;
  for(const lens of input.components.filter(x=>x.type==='spherical-lens'))
   lens.parameters.outsideIndex=outsideIndex;
  const doc=prepareScene(input).document,raw=capture(doc);
  const witness=await publicWitness(doc,raw);
  const checked=raw.status==='completed'?checkNative(raw,doc):null;
  evidence.push({outsideIndex,status:raw.status,checkedCurvedFaces:checked,
   events:raw.trace.map(x=>x.id),
   truncation:raw.diagnosis.truncation,
   undefinedBehavior:raw.diagnosis.undefinedBehavior,public:witness});
 }
 assert.ok(evidence[0].checkedCurvedFaces>0);
 console.log('V17_STRESS_SHARED_MEDIUM '+JSON.stringify({cases:evidence}));
});
test('R2 follow-up: translated apparatus has unchanged native finite physics',async()=>{
 const original=create();original.components.find(x=>x.id==='S1').parameters.y=2;
 const translated=structuredClone(original);
 for(const component of translated.components){
  component.parameters.x+=2500;component.parameters.y+=1800;
 }
 const docs=[original,translated].map(r=>prepareScene(r).document);
 const [a,b]=docs.map(capture);
 assert.equal(a.status,'completed');assert.equal(b.status,'completed');
 checkNative(a,docs[0]);checkNative(b,docs[1]);
 assert.deepEqual(a.trace.map(x=>x.id),b.trace.map(x=>x.id));
 for(let i=0;i<a.trace.length;i++){
  close(b.trace[i].point.x-a.trace[i].point.x,2500,2e-4);
  close(b.trace[i].point.y-a.trace[i].point.y,1800,2e-4);
 }
 await publicWitness(docs[0],a);await publicWitness(docs[1],b);
 console.log('V17_STRESS_TRANSLATION '+JSON.stringify({
  offsetMm:{x:2500,y:1800},status:a.status,
  eventCount:a.trace.length,objectOrder:a.trace.map(x=>x.id),
  geometricAgreementToleranceMm:2e-4}));
});
