import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,serializeSave,parseSave,UPSTREAM} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/finite-dielectric-composition.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const part=(r,id)=>r.components.find(c=>c.id===id);
const doc=(r=request())=>prepareScene(r).document;
const execute=d=>evaluateDocument(d,core);
const close=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const direction=r=>{const x=r.p2.x-r.p1.x,y=r.p1.y-r.p2.y,n=Math.hypot(x,y);return {x:x/n,y:y/n};};
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
function transform(r,rotation,scale=1,tx=0,ty=0){
 const a=rotation*Math.PI/180,point=(x,y)=>({x:tx+scale*(x*Math.cos(a)-y*Math.sin(a)),y:ty+scale*(x*Math.sin(a)+y*Math.cos(a))});
 const wrap=x=>((x+180)%360+360)%360-180;
 for(const c of r.components){const p=c.parameters;
  if(c.type==='polygon-dielectric')for(let i=1;i<=4;i++){const q=point(p['x'+i],p['y'+i]);p['x'+i]=q.x;p['y'+i]=q.y;}
  else{Object.assign(p,point(p.x,p.y));if('length' in p)p.length*=scale;if('orientationDeg' in p)p.orientationDeg=wrap(p.orientationDeg+rotation);}
  if(c.emission)c.emission.directionDeg=wrap(c.emission.directionDeg+rotation);
 }return r;
}
// Test-only actual-event inspection. These expectations never produce native
// rays. Normals are derived independently from authored edges (shoelace winding).
function inspectNative(d){
 const loaded=core.loadDocument(d),trace=[];
 const emission=core.observeSourceSet(d,loaded.scene,loaded.idMap);
 const mirrors=core.observeMirrorSet(d,loaded.scene,loaded.idMap);
 const detectors=core.observeDetectorSet(d,loaded.scene,loaded.idMap);
 const interfaces=core.observeInterfaceSet(d,loaded.scene,loaded.idMap);
 for(const c of d.physics.components.filter(c=>c.type!=='point-source')){
  const obj=loaded.scene.objs[loaded.idMap.get(c.id)],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const incoming=direction(args[0]),point={x:args[2].x,y:-args[2].y};
   const ret=original.apply(this,args);
   const outgoing=[...(!ret?.isAbsorbed?[args[0]]:[]),...(ret?.newRays||[])].map(direction);
   trace.push({id:c.id,type:c.type,point,incoming,outgoing});return ret;
  };
 }
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,d.simulation.processedRayLimit);
 let event;for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});sim.updateSimulation();
 const diagnostic=core.diagnostics(loaded.scene,sim,emission,mirrors,detectors,interfaces);
 assert.equal(core.classifyRun(event,diagnostic),'completed');
 for(const e of trace){
  const c=d.physics.components.find(c=>c.id===e.id),p=c.parameters;
  if(c.type==='plane-mirror'){
   const a=p.orientationDeg*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)};
   for(const v of e.outgoing){close(v.x,e.incoming.x-2*dot(e.incoming,n)*n.x);close(v.y,e.incoming.y-2*dot(e.incoming,n)*n.y);}
  }
  if(c.type==='polygon-dielectric'){
   const v=[1,2,3,4].map(i=>({x:p['x'+i],y:p['y'+i]}));
   const winding=Math.sign(v.reduce((s,a,i)=>s+cross(a,v[(i+1)%4]),0));
   const face=v.map((a,i)=>{const b=v[(i+1)%4],edge={x:b.x-a.x,y:b.y-a.y},len=Math.hypot(edge.x,edge.y);
    const offset={x:e.point.x-a.x,y:e.point.y-a.y};return {n:{x:winding*edge.y/len,y:-winding*edge.x/len},distance:Math.abs(cross(edge,offset))/len,t:dot(edge,offset)/(len*len)};
   }).filter(f=>f.distance<1e-6&&f.t>0&&f.t<1);
   assert.equal(face.length,1);const n=face[0].n,leaving=dot(e.incoming,n)>0;
   const ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
   for(const v of e.outgoing){
    if(dot(e.incoming,n)*dot(v,n)>0)close(ni*cross(e.incoming,n),nt*cross(v,n));
    else{close(v.x,e.incoming.x-2*dot(e.incoming,n)*n.x);close(v.y,e.incoming.y-2*dot(e.incoming,n)*n.y);}
   }
  }
 }
 return {trace,diagnostic};
}
test('composition is explicitly v10; old saved families and their scopes remain unchanged',()=>{
 const r=request(),before=structuredClone(r),d=doc(r);
 assert.deepEqual(r,before);assert.equal(d.schemaVersion,10);assert.equal(d.adapterVersion,10);
 assert.equal(d.physics.model,'finite-dielectric-composition');assert.equal(d.upstreamCommit,UPSTREAM);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(capabilities().finiteDielectricComposition.schemaVersion,10);
 const original=request();original.components=original.components.filter(c=>c.id!=='M1');const old=doc(original);
 assert.equal(old.schemaVersion,9);
 const addition={format:'opticsim-component-revision-v1',operations:[{op:'add',lengthUnit:'mm',component:part(request(),'M1')}]};
 assert.throws(()=>reviseComponents(old,addition));assert.equal(old.schemaVersion,9);
 for(const version of [4,5,6,7,8,9]){const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=version;assert.throws(()=>validate(bad));}
 const wrong=structuredClone(d);wrong.physics.model='polygon-dielectric-tracing';assert.throws(()=>validate(wrong));
});
test('normal return uses the same native Glass and Mirror instances with no prescribed path',()=>{
 const d=doc(),out=execute(d);assert.equal(out.summary.executionPassed,true);
 const o=out.summary.observations;assert.equal(o.interfacesById.G1.interactions,4);
 assert.equal(o.interfacesById.G1.faces['face-12'].interactions,2);assert.equal(o.interfacesById.G1.faces['face-34'].interactions,2);
 assert.equal(o.reflectionsById.M1,1);assert.equal(o.detectorsById.D1.crossings,2);close(o.detectorsById.D1.signedPower,0);
 const checked=inspectNative(d);assert.deepEqual(checked.trace.map(e=>e.id),['G1','G1','D1','M1','D1','G1','G1']);
 assert.deepEqual(checked.diagnostic.interfacesById,o.interfacesById);
 const native=core.loadDocument(d);assert.deepEqual(native.scene.objs.map(o=>o.constructor.type),['SingleRay','Glass','Mirror','Detector']);
 assert.equal(out.summary.analysis.status,'unavailable');
});
test('oblique returns obey Snell and reflection at EVERY actual native hit across geometry/material variations',()=>{
 let cases=0;
 for(const rotation of [0,37,90,-90])for(const scale of [.1,1,10])for(const [insideIndex,outsideIndex] of [[1.5,1],[2,1.33]]){
  const r=request();part(r,'S1').parameters.y=-15;part(r,'S1').emission.directionDeg=10;
  Object.assign(part(r,'G1').parameters,{insideIndex,outsideIndex});transform(r,rotation,scale,100,-75);
  const checked=inspectNative(doc(r));assert.equal(checked.diagnostic.interfacesById.G1.interactions,4);
  assert.equal(checked.diagnostic.reflectionsById.M1,1);assert.equal(checked.diagnostic.detectorsById.D1.crossings,2);cases++;
 }
 assert.equal(cases,24);
 for(const orientation of [80,100]){const r=request();part(r,'M1').parameters.orientationDeg=orientation;inspectNative(doc(r));}
 const trapezoid=request();part(trapezoid,'G1').parameters.x3=25;inspectNative(doc(trapezoid));
});
test('mirror misses, glass misses and TIR remain genuine native outcomes, not enforced returns',async()=>{
 const r=request();part(r,'M1').parameters.y=100;let d=doc(r),out=execute(d);
 assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.reflectionsById.M1,0);
 assert.equal(out.summary.observations.interfacesById.G1.interactions,2);assert.equal(out.summary.observations.detectorsById.D1.crossings,1);
 const allMiss=request();part(allMiss,'S1').emission.directionDeg=180;out=execute(doc(allMiss));
 assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.interfacesById.G1.interactions,0);assert.equal(out.summary.observations.reflectionsById.M1,0);
 const tir=request();Object.assign(part(tir,'G1').parameters,{insideIndex:1,outsideIndex:1.5});
 part(tir,'S1').parameters.y=-40*Math.tan(50*Math.PI/180);part(tir,'S1').emission.directionDeg=50;
 Object.assign(part(tir,'D1').parameters,{x:-20,length:60});d=doc(tir);out=execute(d);inspectNative(d);
 assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.interfacesById.G1.totalInternalReflections,1);
 const results=await evaluateObservables(d,[{id:'t',kind:'interface-transmission-angle',componentId:'G1'}],out.summary);
 assert.equal(results.results[0].status,'unavailable');assert.equal(results.results[0].value,null);
});
test('composition rejects internal, crossed, touching and near-contact external surfaces',()=>{
 for(const changes of [{x:10},{x:20},{x:20.005},{x:10,orientationDeg:0,length:100}]){
  const r=request();Object.assign(part(r,'M1').parameters,changes);assert.throws(()=>doc(r),/outside the dielectric/);
 }
 const near=request();part(near,'D1').parameters.x=59.995;assert.throws(()=>doc(near),/clearance/);
 const crossed=request();Object.assign(part(crossed,'D1').parameters,{x:60,y:5,orientationDeg:0,length:40});assert.throws(()=>doc(crossed),/intersect/);
 const internal=request();part(internal,'D1').parameters.x=10;assert.throws(()=>doc(internal),/outside the polygon/);
 const edgeSource=request();part(edgeSource,'S1').parameters.x=0;assert.throws(()=>doc(edgeSource),/clearance/);
 const corner=request();part(corner,'S1').parameters.y=30;assert.throws(()=>doc(corner),/vertex/);
 const duplicate=request();duplicate.components.push(structuredClone(part(duplicate,'M1')));assert.throws(()=>doc(duplicate),/unique/);
 const collapsed=request();Object.assign(part(collapsed,'G1').parameters,{x4:0,y4:-30});assert.throws(()=>doc(collapsed),/convex/);
});
test('no extra optical families or missing physical values enter the composition pilot',()=>{
 for(const added of [
  {id:'M2',type:'plane-mirror',parameters:{x:80,y:0,length:30,orientationDeg:90}},
  {id:'L1',type:'ideal-lens',parameters:{x:80,focalLength:20,apertureHeight:30}},
  {id:'B1',type:'line-blocker',parameters:{x:80,y:0,length:20,orientationDeg:90}},
  {...part(request(),'G1'),id:'G2'}]){
  // Historical v10 must still reject extra optics; new two-mirror authoring
  // intentionally selects v11 and is tested separately. No migration here.
  const d=doc();d.physics.components.push(added);assert.throws(()=>validate(d));
  if(added.id!=='M2'){const r=request();r.components.push(added);assert.throws(()=>doc(r));}
 }
 for(const key of ['outsideIndex','insideIndex','partialReflection','x4']){const r=request();delete part(r,'G1').parameters[key];assert.throws(()=>doc(r),/Required/);}
 for(const key of ['length','orientationDeg']){const r=request();delete part(r,'M1').parameters[key];assert.throws(()=>doc(r),/Required/);}
 const fan=request();part(fan,'S1').emission={mode:'directional',directionDeg:0,angleDeg:20};assert.throws(()=>doc(fan),/single-ray/);
 const missing=request();delete part(missing,'S1').emission.directionDeg;assert.throws(()=>doc(missing),/explicit/);
});
test('full Fresnel, two-detector depth limit, stop and stale evidence suppress readings without changing budgets',async()=>{
 const full=request();part(full,'G1').parameters.partialReflection=true;
 const two=request();two.components.push({id:'D2',type:'ray-detector',parameters:{x:-20,y:0,orientationDeg:90,length:40}});
 for(const d of [doc(full),doc(two),{...doc(),simulation:{...doc().simulation,maxRayDepth:2}},
  {...doc(),simulation:{...doc().simulation,processedRayLimit:1}}]){
  const out=execute(d);assert.ok(['incomplete','stopped'].includes(out.summary.native.status));assert.equal(out.summary.observations,null);
  const results=await evaluateObservables(d,fixture.requests,out.summary);assert.ok(results.results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const d=doc(),out=execute(d),changed=reviseScene(d,{changes:[{id:'M1',section:'parameters',key:'y',value:100}]}).document;
 assert.ok((await evaluateObservables(changed,fixture.requests,out.summary)).results.every(r=>r.status==='suppressed'));
 const image=await evaluateObservables(d,[{id:'image',kind:'ideal-image',componentId:'S1'}],out.summary);
 assert.equal(image.results[0].status,'unavailable');assert.equal(image.results[0].value,null);
 assert.equal(d.simulation.maxRayDepth,8);assert.equal(core.loadDocument(d).scene.colorMode,'default');
});
test('winding, input order, length units, multiple sources and existing structural edits reuse the same contract',()=>{
 for(const unit of ['cm','m']){const r=request(),divisor=unit==='cm'?10:1000;r.lengthUnit=unit;
  for(const c of r.components)for(const key of capabilities().lengthParameters)if(key in c.parameters)c.parameters[key]/=divisor;
  r.components.reverse();assert.equal(execute(doc(r)).summary.observations.interfacesById.G1.interactions,4);
 }
 const r=request(),p=part(r,'G1').parameters,v=[1,2,3,4].map(i=>[p['x'+i],p['y'+i]]).reverse();
 v.forEach(([x,y],i)=>{p['x'+(i+1)]=x;p['y'+(i+1)]=y;});inspectNative(doc(r));
 const source={id:'S2',type:'point-source',parameters:{x:-40,y:5,brightness:.5},emission:{mode:'single-ray',directionDeg:0}};
 const revised=reviseComponents(doc(),{format:'opticsim-component-revision-v1',operations:[{op:'add',lengthUnit:'mm',component:source}]}).document;
 const out=execute(revised);assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.interfacesById.G1.interactions,8);assert.equal(out.summary.observations.reflectionsById.M1,2);
 assert.equal(out.summary.observations.emissionsById.S2.emitted,1);assert.equal(out.summary.observations.detectorsById.D1.crossings,4);
 assert.throws(()=>reviseComponents(doc(),{format:'opticsim-component-revision-v1',operations:[{op:'remove',id:'M1'}]}));
});
test('qualified roundtrip and immutable mirror sweep retain assumptions and failed samples',async()=>{
 const d=doc(),q=initialQualification(d,null,{inputSha256:'a'.repeat(64),interpretation:fixture.interpretation});
 const bundle=await createQualifiedBundle(d,q,fixture.requests),before=structuredClone(bundle);
 assert.deepEqual((await parseQualifiedBundle(JSON.stringify(bundle))).scene,d);
 const sweep=await runParameterSweep(bundle,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:bundle.sceneSha256,
  parameter:{id:'M1',section:'parameters',key:'x',unit:'mm'},values:[60,80,10],observables:fixture.requests},{execute});
 assert.equal(sweep.samples.length,3);assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');
 assert.deepEqual(bundle,before);
 const invalid={changes:[{id:'M1',section:'parameters',key:'x',value:10}]};assert.throws(()=>reviseScene(d,invalid));assert.deepEqual(bundle.scene,d);
});
test('a reflected corner hit suppresses results rather than inventing an unambiguous face',async()=>{
 const r=request();part(r,'M1').parameters.orientationDeg=(180-Math.atan(.75)*180/Math.PI)/2;
 const d=doc(r),out=execute(d);assert.equal(out.summary.native.status,'failed');
 assert.ok(out.summary.native.undefinedBehavior>0);assert.equal(out.summary.observations,null);
 assert.ok((await evaluateObservables(d,fixture.requests,out.summary)).results.every(r=>r.status==='suppressed'&&r.value===null));
});
test('inside sources and mirror-first illumination do not acquire an assumed glass-return route',()=>{
 const inside=request();part(inside,'S1').parameters.x=10;let out=execute(doc(inside));
 assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.interfacesById.G1.interactions,3);
 const reverse=request();part(reverse,'S1').parameters.x=80;part(reverse,'S1').emission.directionDeg=180;
 out=execute(doc(reverse));assert.equal(out.summary.executionPassed,true);
 assert.equal(out.summary.observations.reflectionsById.M1,1);assert.equal(out.summary.observations.interfacesById.G1.interactions,0);
});
