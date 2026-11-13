import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,inspectAuthoringRequest,reviseScene} from '../src/authoring.js';
import {predict} from '../src/analysis.js';
import {validate,parseSave,serializeSave,setSourceMode} from '../src/contract.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView} from '../src/result-preview.js';
import {sceneHash} from '../src/qualified-utils.js';
import {validateMotion} from '../src/source-motion.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync(new URL('../examples/circular-dielectric.json',import.meta.url)));
const request=()=>structuredClone(example.physical);
const circle=r=>r.components.find(c=>c.type==='circular-dielectric');
const source=r=>r.components.find(c=>c.type==='point-source');
const withoutDetector=()=>{const r=request();r.components=r.components.filter(c=>c.type!=='ray-detector');return r;};
const make=(edit=()=>{})=>{const r=withoutDetector();edit(r);return prepareScene(r).document;};
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} is not near ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const unit=r=>{const x=r.p2.x-r.p1.x,y=-(r.p2.y-r.p1.y),d=Math.hypot(x,y);return {x:x/d,y:y/d};};
function incidents(doc){
 const {scene,idMap}=core.loadDocument(doc),component=doc.physics.components.find(c=>c.type==='circular-dielectric');
 const optic=scene.objs[idMap.get(component.id)],fn=optic.onRayIncident,events=[];
 optic.onRayIncident=function(...args){
  const before=unit(args[0]),point={x:args[2].x,y:-args[2].y};
  const dx=point.x-component.parameters.x,dy=point.y-component.parameters.y,r=Math.hypot(dx,dy);
  const normal={x:dx/r,y:dy/r},leaving=dot(before,normal)>0;
  const result=fn.apply(this,args);
  events.push({before,normal,point,leaving,after:result?.isAbsorbed?null:unit(args[0]),
   reflected:(result?.newRays||[]).map(unit),result});
  return result;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event;sim.on('simulationComplete',()=>event='simulationComplete');sim.on('simulationStop',()=>event='simulationStop');sim.updateSimulation();
 return {scene,sim,events,event};
}

test('circular v7 uses existing minimal authoring fields, explicit absolute indices and native CircleGlass',()=>{
 const r=request(),snapshot=JSON.stringify(r),doc=prepareScene(r).document;
 assert.equal(doc.schemaVersion,7);assert.equal(doc.adapterVersion,7);assert.equal(doc.physics.model,'circular-dielectric-tracing');
 assert.equal(capabilities().circularDielectric.schemaVersion,7);
 assert.equal(capabilities().componentTypes['circular-dielectric'].nativeType,'CircleGlass');
 assert.deepEqual(capabilities().componentTypes['circular-dielectric'].parameters,['x','y','radius','insideIndex','outsideIndex','partialReflection']);
 const a=core.compile(doc),body=a.native.objs[a.idMap.get('G1')];
 assert.deepEqual(body,{type:'CircleGlass',p1:{x:0,y:-0},p2:{x:100,y:-0},refIndex:1.5,partialReflect:false});
 assert.equal(doc.physics.components[1].parameters.radius,100);
 assert.equal(JSON.stringify(r),snapshot);assert.deepEqual(parseSave(serializeSave(doc)),doc);
 const restored=core.loadNative(JSON.parse(core.nativeExport(doc)));
 assert.equal(restored.objs[a.idMap.get('G1')].constructor.type,'CircleGlass');
 assert.equal(predict(doc).kind,'unavailable');
});

test('circular fields cannot leak into legacy v4/v5/v6 or masquerade as lens/mirror images',()=>{
 const doc=make();
 for(const [v,model] of [[4,'general-component-tracing'],[5,'planar-media-tracing'],[6,'curved-mirror-tracing']]){
  const bad=structuredClone(doc);bad.schemaVersion=bad.adapterVersion=v;bad.physics.model=model;assert.throws(()=>validate(bad));
 }
 for(const model of ['ideal-thin-lens-geometric','curved-mirror-tracing','general-component-tracing']){
  assert.throws(()=>validate({...doc,physics:{...doc.physics,model}}));
 }
 assert.throws(()=>setSourceMode(doc,'S1','directional'));
 assert.throws(()=>validateMotion(doc,{format:'opticsim-source-motion-v1',sourceId:'S1',law:'constant-velocity',velocity:{x:1,y:0,unit:'mm/s'},durationSeconds:1,samples:2,continuationAssumption:'Synthetic control'}));
});

test('missing or invalid circle physics is reported, never defaulted into a native scene',()=>{
 for(const field of ['x','y','radius','insideIndex','outsideIndex','partialReflection']){
  const r=request();delete circle(r).parameters[field];
  assert.ok(inspectAuthoringRequest(r).some(i=>i.path.endsWith('.'+field)));
  for(const illustration of [false,true])assert.equal(resolveProblemRequest(r,{illustration}).prepared,null);
 }
 for(const [k,v] of [['radius',0],['radius',-.2],['insideIndex',0],['outsideIndex',4.1],['insideIndex','1.5'],['partialReflection',0],['x',NaN]]){
  const r=request();circle(r).parameters[k]=v;assert.throws(()=>prepareScene(r));
 }
 const r=request();delete source(r).emission.directionDeg;assert.throws(()=>prepareScene(r));
});

test('continuous region geometry rejects boundary sources, tangent rays, internal/intersecting detectors and oversized circles',()=>{
 for(const edit of [
  r=>{circle(r).parameters.radius=-10;},
  r=>{circle(r).parameters.radius=.199;},
  r=>{circle(r).parameters.x=999;},
  r=>{source(r).parameters.x=-10;source(r).parameters.y=0;},
  r=>{source(r).parameters.x=-10.0005;source(r).parameters.y=0;},
  r=>{source(r).parameters.y=10;},
  r=>{source(r).parameters.y=10.0005;},
  r=>{r.components[2].parameters.x=0;},
  r=>{r.components[2].parameters.x=10;},
  r=>{r.components[2].parameters.x=10.0005;},
  r=>{r.components.push({...circle(r),id:'G2'});},
  r=>{r.components.push({id:'L1',type:'ideal-lens',parameters:{x:50,focalLength:10,apertureHeight:8}});},
  r=>{source(r).emission={mode:'full-circle'};}
 ]){const r=request();edit(r);assert.throws(()=>prepareScene(r));}
 // A backward-directed tangent supporting line does not create a forward encounter.
 assert.doesNotThrow(()=>make(r=>{source(r).parameters.y=10;source(r).emission.directionDeg=180;}));
 assert.doesNotThrow(()=>make(r=>{source(r).parameters.y=10.01;}));
});

test('native circular entry AND exit satisfy independent local Snell invariants, including reversed and immersed rays',()=>{
 const cases=[
  ()=>{},
  r=>{source(r).parameters.y=0;},
  r=>{source(r).parameters.x=30;source(r).emission.directionDeg=180;},
  r=>{circle(r).parameters.insideIndex=2;circle(r).parameters.outsideIndex=1.5;},
  r=>{circle(r).parameters.insideIndex=1;circle(r).parameters.outsideIndex=1.5;},
  r=>{circle(r).parameters.insideIndex=1.5;circle(r).parameters.outsideIndex=1.5;}
 ];
 for(const edit of cases){
  const doc=make(edit),p=doc.physics.components[1].parameters,{events,sim}=incidents(doc);
  assert.equal(events.length,2);assert.equal(sim.totalTruncation,0);assert.equal(sim.totalUndefinedBehavior,0);
  assert.equal(events[0].leaving,false);assert.equal(events[1].leaving,true);
  for(const e of events){
   const n1=e.leaving?p.insideIndex:p.outsideIndex,n2=e.leaving?p.outsideIndex:p.insideIndex;
   near(n1*cross(e.before,e.normal),n2*cross(e.after,e.normal));
   assert.ok(dot(e.before,e.normal)*dot(e.after,e.normal)>0);
   near(Math.hypot(e.point.x-p.x,e.point.y-p.y),p.radius);
  }
  const evidence=evaluateDocument(doc,core);assert.equal(evidence.summary.native.status,'completed');
  assert.equal(evidence.summary.observations.interfacesById.G1.interactions,2);
 }
});

test('inside source can exit once and exported first-event evidence uses inside/outside indices and y-up normal',async()=>{
 const doc=make(r=>{source(r).parameters.x=0;source(r).parameters.y=3;}),res=evaluateDocument(doc,core);
 assert.equal(res.summary.native.status,'completed');
 const m=res.summary.observations.interfacesById.G1;assert.equal(m.interactions,1);
 assert.equal(m.first.from,'inside');assert.equal(m.first.incidentIndex,1.5);assert.equal(m.first.destinationIndex,1);
 assert.ok(m.first.pointMm.y>0);assert.ok(m.first.outwardNormal.y>0);
 const requests=[{id:'first',kind:'interface-first-event',componentId:'G1'}];
 const values=await evaluateObservables(doc,requests,res.summary);
 assert.equal(values.results[0].method,'native-observation');assert.equal(values.results[0].status,'qualified');
 near(values.results[0].value.transmittedAngleDeg,Math.asin(.45)*180/Math.PI);
});

test('real native TIR of an outside ray at a lower-index circle completes with no invented transmission',async()=>{
 const doc=make(r=>{source(r).parameters.y=8;circle(r).parameters.insideIndex=1;circle(r).parameters.outsideIndex=1.5;});
 const native=incidents(doc),e=native.events[0];assert.equal(native.events.length,1);
 assert.equal(native.sim.totalTruncation,0);assert.equal(e.result,undefined);
 near(dot(e.before,e.normal),-dot(e.after,e.normal));near(cross(e.before,e.normal),cross(e.after,e.normal));
 const res=evaluateDocument(doc,core);assert.equal(res.summary.native.status,'completed');
 const report=await evaluateObservables(doc,[{id:'tir',kind:'interface-tir-count',componentId:'G1'},
  {id:'trans',kind:'interface-transmission-angle',componentId:'G1'}],res.summary);
 assert.equal(report.results[0].value,1);assert.equal(report.results[1].value,null);assert.equal(report.results[1].status,'unavailable');
 assert.match(report.results[1].reason,/total-internal-reflection/);
});

test('trapped interior TIR and full Fresnel remain incomplete despite native completion callbacks',async()=>{
 for(const edit of [r=>{source(r).parameters.x=0;source(r).parameters.y=8;},r=>{circle(r).parameters.partialReflection=true;}]){
  const doc=make(edit),run=incidents(doc);assert.equal(run.event,'simulationComplete');assert.ok(run.sim.totalTruncation>0);
  const res=evaluateDocument(doc,core);assert.equal(res.summary.native.status,'incomplete');assert.equal(res.summary.observations,null);
  const report=await evaluateObservables(doc,[{id:'n',kind:'interface-interactions',componentId:'G1'}],res.summary);
  assert.equal(report.results[0].status,'suppressed');assert.equal(report.results[0].value,null);
 }
});

test('native circular misses and zero interactions are available, not missing or fabricated image results',async()=>{
 const doc=make(r=>{source(r).parameters.y=15;}),res=evaluateDocument(doc,core);
 assert.equal(res.summary.native.status,'completed');assert.equal(res.summary.observations.interfacesById.G1.interactions,0);
 const report=await evaluateObservables(doc,[{id:'count',kind:'interface-interactions',componentId:'G1'},
  {id:'first',kind:'interface-first-event',componentId:'G1'},
  {id:'image',kind:'ideal-image',componentId:'S1'}],res.summary);
 assert.equal(report.results[0].value,0);assert.equal(report.results[1].status,'unavailable');
 assert.equal(report.results[2].status,'unavailable');assert.equal(report.results[2].value,null);
});

test('limits, failures and stale circular scene evidence suppress every requested native quantity',async()=>{
 const doc=make();
 for(const [k,v,status] of [['maxRayDepth',0,'incomplete'],['processedRayLimit',1,'stopped']]){
  const limited=structuredClone(doc);limited.simulation[k]=v;
  const res=evaluateDocument(limited,core);assert.equal(res.summary.native.status,status);
  const r=await evaluateObservables(limited,[{id:'c',kind:'interface-interactions',componentId:'G1'}],res.summary);
  assert.equal(r.results[0].status,'suppressed');
 }
 const res=evaluateDocument(doc,core);doc.physics.components[1].parameters.insideIndex=1.6;
 const r=await evaluateObservables(doc,[{id:'c',kind:'interface-interactions',componentId:'G1'}],res.summary);
 assert.equal(r.results[0].status,'suppressed');assert.match(r.results[0].reason,/hash/);
});

test('circle source geometry, local angles and indices survive translation, rotation, unit scaling and component order',()=>{
 const original=make(),originalReport=evaluateDocument(original,core).summary;
 for(const kind of ['rotation','translation','units','order','common-index-scale']){
  const r=withoutDetector();
  if(kind==='rotation'){
   const a=37*Math.PI/180,p=source(r).parameters;
   [p.x,p.y]=[p.x*Math.cos(a)-p.y*Math.sin(a),p.x*Math.sin(a)+p.y*Math.cos(a)];source(r).emission.directionDeg=37;
  }else if(kind==='translation')for(const c of r.components){c.parameters.x+=17;c.parameters.y-=9;}
  else if(kind==='units'){r.lengthUnit='mm';for(const c of r.components)for(const k of ['x','y','radius'])if(k in c.parameters)c.parameters[k]*=10;}
  else if(kind==='order')r.components.reverse();
  else {circle(r).parameters.insideIndex=3;circle(r).parameters.outsideIndex=2;}
  const doc=prepareScene(r).document,res=evaluateDocument(doc,core).summary;
  assert.equal(res.native.status,'completed');const a=res.observations.interfacesById.G1,b=originalReport.observations.interfacesById.G1;
  assert.equal(a.interactions,b.interactions);near(a.first.incidentAngleDeg,b.first.incidentAngleDeg);near(a.first.transmittedAngleDeg,b.first.transmittedAngleDeg);
 }
});

test('circular native observers delegate exactly once with unchanged args, returned object and mutated rays',()=>{
 const doc=make(),plain=core.loadDocument(doc),wrapped=core.loadDocument(doc),c=doc.physics.components[1];
 const nativeA=plain.scene.objs[plain.idMap.get(c.id)],nativeB=wrapped.scene.objs[wrapped.idMap.get(c.id)];
 let calls=0,actualArgs,returned;
 const original=nativeB.onRayIncident;
 nativeB.onRayIncident=function(...args){calls++;actualArgs=args;returned=original.apply(this,args);return returned;};
 const meter=core.observeInterfaceSet(doc,wrapped.scene,wrapped.idMap);
 const ray={p1:{x:-300,y:-30},p2:{x:-280,y:-30},brightness_s:.25,brightness_p:.25,gap:true};
 const a=structuredClone(ray),b=structuredClone(ray),pointA=nativeA.checkRayIntersects(a),pointB=nativeB.checkRayIntersects(b),merge=[];
 const expected=nativeA.onRayIncident(a,7,pointA,[]),observed=nativeB.onRayIncident(b,7,pointB,merge);
 assert.equal(calls,1);assert.equal(actualArgs[0],b);assert.equal(actualArgs[2],pointB);assert.equal(actualArgs[3],merge);
 assert.equal(observed,returned);assert.deepEqual(observed,expected);assert.deepEqual(b,a);
 assert.equal(meter.byId.G1.interactions,1);const snapshot=meter.byId;snapshot.G1.first.from='forged';assert.equal(meter.byId.G1.first.from,'outside');
});

test('multiple explicit rays aggregate native counts without invented source attribution',()=>{
 const r=withoutDetector();for(let i=2;i<=4;i++)r.components.push({id:'S'+i,type:'point-source',parameters:{x:-30,y:i+3,brightness:.5},emission:{mode:'single-ray',directionDeg:0}});
 const doc=prepareScene(r).document,res=evaluateDocument(doc,core).summary;
 assert.equal(res.native.status,'completed');assert.equal(res.native.emitted,4);assert.equal(res.observations.interfacesById.G1.interactions,8);
 assert.equal(res.observations.interfacesById.G1.first.sourceId,undefined);
 r.components.push({id:'S5',type:'point-source',parameters:{x:-30,y:8,brightness:.5},emission:{mode:'single-ray',directionDeg:0}});assert.throws(()=>prepareScene(r));
});

test('shared qualified revisions, exports and fit use complete circle geometry without upgrading original facts',async()=>{
 const doc=prepareScene(request()).document,q=initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:example.interpretation});
 const bundle=await createQualifiedBundle(doc,q,example.requests),raw=JSON.stringify(bundle);
 const changed=structuredClone(doc);changed.physics.components[1].parameters.radius=90;
 const revision=await createQualifiedBundle(changed,recordQualifiedEdit(doc,changed,q),example.requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(revision));assert.equal(reopened.scene.schemaVersion,7);
 assert.equal(reopened.qualification.edits.at(-1).kind,'physics');assert.deepEqual(reopened.qualification.interpretation,example.interpretation);
 assert.equal(JSON.stringify(bundle),raw);
 const points=apparatusPoints(doc);assert.ok(points.some(p=>p.x===-100&&p.y===0));assert.ok(points.some(p=>p.x===100&&p.y===0));
 assert.ok(points.some(p=>p.x===0&&p.y===100));assert.ok(points.some(p=>p.x===0&&p.y===-100));
 for(const [w,h] of [[900,600],[390,300]]){
  const fit=await fitRequestedView(doc,{canonicalSha256:await sceneHash(doc),results:[]},w,h);
  assert.equal(fit.apparatusFits,true);assert.deepEqual(fit.document.physics,doc.physics);
 }
 const tampered=JSON.parse(raw);tampered.scene.physics.components[1].parameters.outsideIndex=2;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(tampered)),/integrity|hash/i);
});

test('circular parameter revisions use the same atomic validator, units and immutable baseline',()=>{
 const doc=make(),before=serializeSave(doc);
 const next=reviseScene(doc,{changes:[{id:'G1',section:'parameters',key:'radius',value:8,unit:'cm'},
  {id:'G1',section:'parameters',key:'outsideIndex',value:1.2}]}).document;
 assert.equal(next.physics.components[1].parameters.radius,80);assert.equal(next.physics.components[1].parameters.outsideIndex,1.2);
 assert.equal(serializeSave(doc),before);
 assert.throws(()=>reviseScene(doc,{changes:[{id:'S1',section:'emission',key:'mode',value:'full-circle'}]}));
 assert.throws(()=>reviseScene(doc,{changes:[{id:'G1',section:'parameters',key:'radius',value:-5,unit:'cm'}]}));
 assert.equal(serializeSave(doc),before);
});

test('native near-critical decisions are preserved with actual completeness gating, not repaired by an analytical critical-angle rule',async()=>{
 for(const factor of [1-1e-7,1,1+1e-7]){
  const doc=make(r=>{source(r).parameters.x=0;source(r).parameters.y=(10/1.5)*factor;});
  const direct=incidents(doc),result=evaluateDocument(doc,core);
  assert.ok(direct.events.length>=1);
  assert.equal(result.summary.native.truncation,direct.sim.totalTruncation);
  assert.equal(result.summary.native.undefinedBehavior,direct.sim.totalUndefinedBehavior);
  const report=await evaluateObservables(doc,[{id:'native',kind:'interface-first-event',componentId:'G1'}],result.summary);
  if(!result.summary.executionPassed){assert.equal(report.results[0].status,'suppressed');assert.equal(report.results[0].value,null);}
  else assert.equal(report.results[0].value.outcome,result.summary.observations.interfacesById.G1.first.outcome);
 }
});
