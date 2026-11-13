import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseScene} from '../src/authoring.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {validate,parseSave,serializeSave,setSourceMode} from '../src/contract.js';
import {predict} from '../src/analysis.js';
import {prismVertices,prismFaces,prismEncounter} from '../src/triangular-prism.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView,formatRequestedResult} from '../src/result-preview.js';
import {validateMotion} from '../src/source-motion.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/triangular-prism.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const prism=r=>r.components.find(c=>c.type==='triangular-prism');
const source=r=>r.components.find(c=>c.type==='point-source');
const make=(edit=()=>{})=>{const r=request();r.components=r.components.filter(c=>c.type!=='ray-detector');edit(r);return prepareScene(r).document;};
const run=doc=>evaluateDocument(doc,core).summary;
const meter=s=>s.observations.interfacesById.P1;
const requests=[{id:'n',kind:'interface-interactions',componentId:'P1'},
 {id:'faces',kind:'interface-face-events',componentId:'P1'},
 {id:'first',kind:'interface-first-event',componentId:'P1'}];
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const heading=d=>Math.atan2(d.y,d.x)*180/Math.PI;
const wrap=x=>((x+180)%360+360)%360-180;

test('prism v8 exposes minimal scalar physical vertices and compiles to a closed native Glass, not three half-planes',()=>{
 const r=request(),before=JSON.stringify(r),d=prepareScene(r).document,c=core.compile(d),native=c.native.objs[c.idMap.get('P1')];
 assert.equal(d.schemaVersion,8);assert.equal(d.adapterVersion,8);assert.equal(d.physics.model,'triangular-prism-tracing');
 assert.equal(capabilities().triangularPrisms.schemaVersion,8);
 assert.equal(capabilities().componentTypes['triangular-prism'].nativeType,'Glass');
 assert.deepEqual(native,{type:'Glass',path:prismVertices(d.physics.components[1].parameters).map(v=>({x:v.x,y:-v.y,arc:false})),notDone:false,refIndex:1.5,partialReflect:false});
 assert.equal(c.native.objs.filter(o=>o.type==='PlaneGlass').length,0);
 assert.equal(JSON.stringify(r),before);assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(core.loadNative(JSON.parse(core.nativeExport(d))).objs[c.idMap.get('P1')].constructor.type,'Glass');
 assert.equal(predict(d).kind,'unavailable');
});
test('prism capability cannot leak into historical schemas or acquire existing mirror/lens motion',()=>{
 const d=make();
 for(const [v,model] of [[4,'general-component-tracing'],[5,'planar-media-tracing'],[6,'curved-mirror-tracing'],[7,'circular-dielectric-tracing']]){
  const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=v;bad.physics.model=model;assert.throws(()=>validate(bad));
 }
 assert.throws(()=>setSourceMode(d,'S1','full-circle'));
 assert.throws(()=>setSourceMode(d,'S1','directional'));
 assert.throws(()=>validateMotion(d,{format:'opticsim-source-motion-v1',sourceId:'S1',law:'constant-velocity',velocity:{x:1,y:0,unit:'mm/s'},durationSeconds:1,samples:2,continuationAssumption:'Synthetic'}));
});
test('all vertices, indices and reflection policy are required even under illustration opt-in',()=>{
 for(const key of capabilities().componentTypes['triangular-prism'].parameters){
  const r=request();delete prism(r).parameters[key];
  for(const illustration of [false,true])assert.equal(resolveProblemRequest(r,{illustration}).prepared,null);
 }
 for(const [key,value] of [['x1',NaN],['x2','10'],['insideIndex',0],['outsideIndex',4.1],['partialReflection',0]]){
  const r=request();prism(r).parameters[key]=value;assert.throws(()=>prepareScene(r));
 }
 const r=request();delete source(r).emission.directionDeg;assert.throws(()=>prepareScene(r));
});
test('finite triangle validation rejects degenerate geometry, boundary sources, corner rays and intersecting detectors',()=>{
 for(const edit of [
  r=>{prism(r).parameters.x3=0;},
  r=>{prism(r).parameters.x3=.001;},
  r=>{prism(r).parameters.x3=1001;},
  r=>{prism(r).parameters.y2=-10;},
  r=>{source(r).parameters.x=0;},
  r=>{source(r).parameters.y=10;},
  r=>{source(r).parameters.y=10.0005;},
  r=>{r.components[2].parameters.x=2;},
  r=>{r.components.push({...prism(r),id:'P2'});},
  r=>{r.components.push({id:'G2',type:'circular-dielectric',parameters:{x:50,y:50,radius:5,insideIndex:1.4,outsideIndex:1,partialReflection:false}});},
  r=>{source(r).emission={mode:'full-circle'};}
 ]){const r=request();edit(r);assert.throws(()=>prepareScene(r));}
 // Backward rays on a vertex's supporting line are not forward corner hits.
 assert.doesNotThrow(()=>make(r=>{source(r).parameters.y=10;source(r).emission.directionDeg=180;}));
});
test('real native entry and exit satisfy signed local Snell law and independent 30-degree prism deviation',()=>{
 const s=run(make()),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.interactions,2);assert.equal(m.invalidObservations,0);
 assert.equal(m.faces['face-12'].first.from,'outside');assert.equal(m.faces['face-23'].first.from,'inside');
 assert.equal(m.faces['face-31'].interactions,0);assert.equal(m.faces['face-31'].first,null);
 for(const f of Object.values(m.faces).filter(f=>f.first)){
  const e=f.first,b=e.branches.find(b=>b.kind==='transmitted');
  near(e.incidentIndex*cross(e.incidentDirection,e.outwardNormal),e.destinationIndex*cross(b.direction,e.outwardNormal));
  assert.ok(dot(e.incidentDirection,e.outwardNormal)*dot(b.direction,e.outwardNormal)>0);
 }
 const exit=m.faces['face-23'].first;
 near(exit.incidentAngleDeg,30);near(exit.transmittedAngleDeg,Math.asin(.75)*180/Math.PI);
 near(heading(exit.branches[0].direction),30-Math.asin(.75)*180/Math.PI);
 assert.equal(s.analysis.status,'unavailable');
});
test('inside sources, immersed indices and equal-index boundaries use the same native model',()=>{
 const inside=run(make(r=>{source(r).parameters.x=2;}));
 assert.equal(inside.native.status,'completed');assert.equal(meter(inside).interactions,1);assert.equal(meter(inside).first.from,'inside');
 for(const [ni,no] of [[2,1.5],[1.5,1.5],[1,1.5]]){
  const s=run(make(r=>{prism(r).parameters.insideIndex=ni;prism(r).parameters.outsideIndex=no;}));
  assert.equal(s.native.status,'completed');assert.equal(meter(s).interactions,2);
  const e=meter(s).faces['face-23'].first;
  near(no*Math.sin(e.transmittedAngleDeg*Math.PI/180),ni*.5);
 }
});
test('native TIR inside a right triangle reflects then exits through a different face; absent transmission is never zero',async()=>{
 const d=make(r=>{prism(r).parameters.x3=20;}),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.totalInternalReflections,1);assert.equal(m.interactions,3);
 const tir=m.faces['face-23'].first;
 assert.equal(tir.outcome,'total-internal-reflection');assert.equal(tir.transmittedAngleDeg,null);
 const reflected=tir.branches.find(b=>b.kind==='reflected').direction;
 near(dot(tir.incidentDirection,tir.outwardNormal),-dot(reflected,tir.outwardNormal));
 near(cross(tir.incidentDirection,tir.outwardNormal),cross(reflected,tir.outwardNormal));
 assert.equal(m.faces['face-31'].first.from,'inside');
 const result=await evaluateObservables(d,requests,s);assert.equal(result.results[1].value['face-23'].first.transmittedAngleDeg,null);
});
test('full Fresnel weak-branch truncation and low native budgets suppress counts AND per-face readings',async()=>{
 for(const [edit,budget] of [[r=>{prism(r).parameters.partialReflection=true;},null],[()=>{},['maxRayDepth',0]],[()=>{},['processedRayLimit',1]]]){
  const d=make(edit);if(budget)d.simulation[budget[0]]=budget[1];
  const s=run(d);assert.ok(['incomplete','stopped'].includes(s.native.status));assert.equal(s.observations,null);
  const values=await evaluateObservables(d,requests,s);assert.ok(values.results.every(r=>r.status==='suppressed'&&r.value===null));
 }
});
test('zero native hits remain an available zero, with three empty face records and unavailable first encounter',async()=>{
 const d=make(r=>{source(r).parameters.y=15;}),s=run(d);
 assert.equal(s.native.status,'completed');assert.equal(meter(s).interactions,0);
 const values=await evaluateObservables(d,requests,s);
 assert.equal(values.results[0].value,0);assert.equal(values.results[2].status,'unavailable');
 for(const f of Object.values(values.results[1].value)){assert.equal(f.interactions,0);assert.equal(f.first,null);}
});
test('triangle winding, translation, rotation, unit conversion and authored order preserve physics',()=>{
 const reference=meter(run(make())).faces['face-23'].first,angle=heading(reference.branches[0].direction);
 for(const kind of ['winding','translation','rotation','units','order','index-scale']){
  let rot=0;
  const d=make(r=>{
   const p=prism(r).parameters,s=source(r).parameters;
   if(kind==='winding'){[p.x2,p.x3]=[p.x3,p.x2];[p.y2,p.y3]=[p.y3,p.y2];}
   if(kind==='translation'){s.x+=17;s.y-=9;for(let i=1;i<=3;i++){p['x'+i]+=17;p['y'+i]-=9;}}
   if(kind==='rotation'){
    rot=37;const a=rot*Math.PI/180,transform=(x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
    [s.x,s.y]=transform(s.x,s.y);source(r).emission.directionDeg=rot;
    for(let i=1;i<=3;i++)[p['x'+i],p['y'+i]]=transform(p['x'+i],p['y'+i]);
   }
   if(kind==='units'){r.lengthUnit='mm';s.x*=10;s.y*=10;for(let i=1;i<=3;i++){p['x'+i]*=10;p['y'+i]*=10;}}
   if(kind==='order')r.components.reverse();
   if(kind==='index-scale'){p.insideIndex*=2;p.outsideIndex*=2;}
  });
  const s=run(d);assert.equal(s.native.status,'completed',kind);const m=meter(s);assert.equal(m.interactions,2);
  const exit=Object.values(m.faces).find(f=>f.first?.from==='inside').first;
  near(exit.incidentAngleDeg,reference.incidentAngleDeg);near(wrap(heading(exit.branches[0].direction)-rot),angle);
 }
});
test('native prism transmission is reversible without replacing a finite surface with an infinite plane',()=>{
 const forward=meter(run(make())),exit=forward.faces['face-23'].first,headingDeg=heading(exit.branches[0].direction),d=exit.branches[0].direction;
 const back=run(make(r=>{source(r).parameters.x=(exit.pointMm.x+200*d.x)/10;source(r).parameters.y=(exit.pointMm.y+200*d.y)/10;source(r).emission.directionDeg=wrap(headingDeg+180);}));
 assert.equal(back.native.status,'completed');const m=meter(back);assert.equal(m.interactions,2);
 const outgoing=m.faces['face-12'].first.branches.find(b=>b.kind==='transmitted').direction;
 near(outgoing.x,-1);near(outgoing.y,0);
});
test('runtime vertex ambiguity is refused as measured evidence without altering native delegation',()=>{
 const d=make(),p=d.physics.components.find(c=>c.id==='P1');
 const e=prismEncounter(p,{x:0,y:-100},{x:1,y:0});assert.equal(e.invalid,true);
 const {scene,idMap}=core.loadDocument(d),o=scene.objs[idMap.get('P1')];
 let calls=0;const ray={p1:{x:-10,y:-100},p2:{x:0,y:-100},brightness_s:.1,brightness_p:.1};
 const args=[ray,0,{x:0,y:-100},[]],returned={isAbsorbed:true,isUndefinedBehavior:true};
 o.onRayIncident=function(...actual){calls++;assert.deepEqual(actual,args);actual[0].brightness_s=.04;return returned;};
 const observer=core.observeInterfaceSet(d,scene,idMap);
 assert.strictEqual(o.onRayIncident(...args),returned);assert.equal(calls,1);assert.equal(ray.brightness_s,.04);
 assert.ok(observer.errors.length>0);assert.ok(observer.byId.P1.invalidObservations>0);
});
test('production prism observer delegates once, preserves native returns/rays and stores bounded independent face records',()=>{
 const d=make(),a=core.loadDocument(d),b=core.loadDocument(d),oa=a.scene.objs[a.idMap.get('P1')],ob=b.scene.objs[b.idMap.get('P1')];
 const original=oa.onRayIncident;let calls=0;
 oa.onRayIncident=function(...args){calls++;return original.apply(this,args);};
 const observed=core.observeInterfaceSet(d,a.scene,a.idMap);
 const ray={p1:{x:-200,y:-20},p2:{x:-180,y:-20},brightness_s:.25,brightness_p:.25,gap:true};
 const ra=structuredClone(ray),rb=structuredClone(ray),hit=oa.checkRayIntersects(ra);
 const expected=ob.onRayIncident(rb,0,structuredClone(hit),[]),actual=oa.onRayIncident(ra,0,structuredClone(hit),[]);
 assert.equal(calls,1);assert.deepEqual(ra,rb);assert.deepEqual(actual,expected);
 assert.equal(observed.byId.P1.interactions,1);assert.equal(Object.keys(observed.byId.P1.faces).length,3);
 const copy=observed.byId;copy.P1.faces['face-12'].first.incidentAngleDeg=99;
 assert.equal(observed.byId.P1.faces['face-12'].first.incidentAngleDeg,0);
});
test('multiple explicitly authored sources aggregate counts without fabricating source-specific paths',()=>{
 const d=make(r=>{const s=structuredClone(source(r));s.id='S2';s.parameters.y=-2;r.components.push(s);}),s=run(d);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,2);assert.equal(meter(s).interactions,4);
 assert.equal(meter(s).faces['face-12'].interactions,2);assert.equal(meter(s).faces['face-23'].interactions,2);
 assert.equal(meter(s).faces['face-23'].first.sourceId,undefined);
});
test('shared qualified packages and atomic vertex revisions preserve assumptions and reject tampering',async()=>{
 const d=make(),s=run(d),q=initialQualification(d,null,{inputSha256:'b'.repeat(64),interpretation:fixture.interpretation});
 const bundle=await createQualifiedBundle(d,q,requests);await parseQualifiedBundle(JSON.stringify(bundle));
 const changed=reviseScene(d,{changes:[{id:'P1',section:'parameters',key:'x3',value:12,unit:'cm'}]}).document;
 const revised=await createQualifiedBundle(changed,recordQualifiedEdit(d,changed,bundle.qualification),requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(revised));assert.equal(reopened.scene.physics.components[1].parameters.x3,120);
 assert.deepEqual(reopened.qualification.interpretation,bundle.qualification.interpretation);
 assert.equal(reopened.qualification.edits.at(-1).kind,'physics');
 const stale=await evaluateObservables(changed,requests,s);assert.ok(stale.results.every(r=>r.status==='suppressed'));
 const tampered=structuredClone(revised);tampered.scene.physics.components[1].parameters.x3=130;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(tampered)),/integrity/);
 assert.throws(()=>reviseScene(d,{changes:[{id:'P1',section:'parameters',key:'x3',value:0,unit:'cm'}]}));
});
test('shared Fit includes all prism vertices, and per-face display never invents a missing transmitted ray',async()=>{
 const d=make(r=>{prism(r).parameters.x3=20;}),report=await evaluateObservables(d,requests,run(d));
 const points=apparatusPoints(d);for(const p of prismVertices(d.physics.components[1].parameters))assert.ok(points.some(q=>q.x===p.x&&q.y===p.y));
 const fit=await fitRequestedView(d,report,390,300);assert.deepEqual(fit.document.physics,d.physics);
 const formatted=formatRequestedResult(report.results[1]);assert.match(formatted,/face-23/);assert.match(formatted,/total-internal-reflection/);assert.match(formatted,/transmission unavailable/);
});

test('outside-to-lower-index prism TIR yields a complete reflected ray with no transmission reading',async()=>{
 const d=make(r=>{prism(r).parameters.insideIndex=1;prism(r).parameters.outsideIndex=1.5;source(r).parameters.x=-1;source(r).parameters.y=-1;source(r).emission.directionDeg=60;}),s=run(d);
 assert.equal(s.native.status,'completed');assert.equal(meter(s).interactions,1);assert.equal(meter(s).totalInternalReflections,1);
 const values=await evaluateObservables(d,[...requests,{id:'t',kind:'interface-transmission-angle',componentId:'P1'}],s);
 assert.equal(values.results.at(-1).status,'unavailable');assert.equal(values.results.at(-1).value,null);
});
test('native Snell/reflection checks hold across a family of face angles and input directions, not one prism fixture',()=>{
 for(const angle of [10,20,30,40,50,60])for(const direction of [-14,0,14]){
  const d=make(r=>{prism(r).parameters.x3=20*Math.tan(angle*Math.PI/180);source(r).emission.directionDeg=direction;}),s=run(d);
  assert.equal(s.native.status,'completed',`${angle} / ${direction}: ${JSON.stringify(s.native)}`);
  for(const face of Object.values(meter(s).faces))if(face.first){
   const e=face.first;near(Math.hypot(e.outwardNormal.x,e.outwardNormal.y),1);
   for(const branch of e.branches){
    if(branch.kind==='transmitted')near(e.incidentIndex*cross(e.incidentDirection,e.outwardNormal),e.destinationIndex*cross(branch.direction,e.outwardNormal));
    if(branch.kind==='reflected'){near(dot(e.incidentDirection,e.outwardNormal),-dot(branch.direction,e.outwardNormal));near(cross(e.incidentDirection,e.outwardNormal),cross(branch.direction,e.outwardNormal));}
   }
  }
 }
});
