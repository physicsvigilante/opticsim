import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseScene} from '../src/authoring.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {validate,parseSave,serializeSave,setSourceMode} from '../src/contract.js';
import {predict} from '../src/analysis.js';
import {polygonVertices,polygonFaces,polygonEncounter} from '../src/polygon-glass.js';
import {prismFaces} from '../src/triangular-prism.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView,formatRequestedResult} from '../src/result-preview.js';
import {validateMotion} from '../src/source-motion.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {planProblem} from '../src/problem-workflow.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/glass-polygon.json',import.meta.url)));
const req=()=>structuredClone(fixture.physical);
const polygon=r=>r.components.find(c=>c.type==='glass-polygon');
const source=r=>r.components.find(c=>c.type==='point-source');
const make=(edit=()=>{},keepDetector=false)=>{const r=req();if(!keepDetector)r.components=r.components.filter(c=>c.type!=='ray-detector');edit(r);return prepareScene(r).document;};
const run=d=>evaluateDocument(d,core).summary;
const meter=s=>s.observations.interfacesById.G1;
const requests=[{id:'hits',kind:'interface-interactions',componentId:'G1'},
 {id:'faces',kind:'interface-face-events',componentId:'G1'},
 {id:'first',kind:'interface-first-event',componentId:'G1'}];
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const heading=d=>Math.atan2(d.y,d.x)*180/Math.PI;
const wrap=x=>((x+180)%360+360)%360-180;
const first=m=>m.faces['face-12'].first;
const last=m=>m.faces['face-34'].first;

test('v9 convex four-vertex glass keeps the authoring contract minimal, native Glass and stable IDs',()=>{
 const r=req(),before=JSON.stringify(r),d=prepareScene(r).document,c=core.compile(d),obj=c.native.objs[c.idMap.get('G1')];
 assert.equal(d.schemaVersion,9);assert.equal(d.adapterVersion,9);assert.equal(d.physics.model,'polygon-glass-tracing');
 assert.equal(capabilities().finitePolygonGlass.schemaVersion,9);
 assert.deepEqual(capabilities().componentTypes['glass-polygon'].faceIds,['face-12','face-23','face-34','face-41']);
 assert.deepEqual(obj,{type:'Glass',path:polygonVertices(d.physics.components[1].parameters).map(v=>({x:v.x,y:-v.y,arc:false})),
  notDone:false,refIndex:1.5,partialReflect:false});
 assert.equal(c.native.objs.filter(x=>x.type==='PlaneGlass').length,0);
 assert.equal(JSON.stringify(r),before);assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(core.loadNative(JSON.parse(core.nativeExport(d))).objs[c.idMap.get('G1')].constructor.type,'Glass');
 assert.equal(predict(d).kind,'unavailable');
});
test('v9 glass is isolated from historical v4–v8 and from source/mirror/lens motion',()=>{
 const d=make();for(const [v,model] of [[4,'general-component-tracing'],[5,'planar-media-tracing'],[6,'curved-mirror-tracing'],[7,'circular-dielectric-tracing'],[8,'triangular-prism-tracing']]){
  const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=v;bad.physics.model=model;
  assert.throws(()=>validate(bad),`${v} must reject v9 optics`);
 }
 assert.throws(()=>setSourceMode(d,'S1','full-circle'));
 assert.throws(()=>setSourceMode(d,'S1','directional'));
 assert.throws(()=>validateMotion(d,{format:'opticsim-source-motion-v1',sourceId:'S1',law:'constant-velocity',velocity:{x:1,y:0,unit:'mm/s'},durationSeconds:1,samples:2,continuationAssumption:'Synthetic'}));
});
test('all four vertices, both indices, explicit reflection mode and source direction are essential facts',()=>{
 for(const key of capabilities().componentTypes['glass-polygon'].parameters){
  const r=req();delete polygon(r).parameters[key];
  for(const illustration of [false,true])assert.equal(resolveProblemRequest(r,{illustration}).prepared,null,key);
 }
 for(const [key,value] of [['x1',NaN],['x4','12'],['insideIndex',.8],['outsideIndex',4.1],['partialReflection',0]]){
  const r=req();polygon(r).parameters[key]=value;assert.throws(()=>prepareScene(r),key);
 }
 const r=req();delete source(r).emission.directionDeg;assert.throws(()=>prepareScene(r));
});
test('reject concave, bowtie, degenerate, short edges and excessive coordinates before native setup',()=>{
 for(const edit of [
  r=>{const p=polygon(r).parameters;p.x3=4;p.y3=0;}, // concave
  r=>{const p=polygon(r).parameters;[p.x3,p.x4]=[p.x4,p.x3];[p.y3,p.y4]=[p.y4,p.y3];}, // crossing
  r=>{const p=polygon(r).parameters;p.x3=p.x2;p.y3=p.y2;}, // duplicate
  r=>{const p=polygon(r).parameters;p.x3=.01;}, // narrowing / near collinear
  r=>{polygon(r).parameters.x4=1001;},
  r=>{const p=polygon(r).parameters;p.x4=p.x1;p.y4=p.y1;},
  r=>{polygon(r).parameters.y3=8.01;polygon(r).parameters.y4=8.02;},
 ]){const r=req();edit(r);assert.throws(()=>prepareScene(r));}
});
test('bounded quadrilateral scope rejects nesting, intersecting finite optics and bad source/detector clearances',()=>{
 for(const edit of [
  r=>{polygon(r).parameters.x2=0;source(r).parameters.x=0;},
  r=>{source(r).parameters.x=-.0005;source(r).parameters.y=0;},
  r=>{source(r).parameters.x=-20;source(r).parameters.y=8;source(r).emission.directionDeg=0;},
  r=>{r.components.find(c=>c.type==='ray-detector').parameters.x=3;},
  r=>{r.components.push({...polygon(r),id:'G2'});},
  r=>{r.components.push({id:'P2',type:'triangular-prism',parameters:{x1:25,y1:-8,x2:25,y2:8,x3:30,y3:-8,insideIndex:1.5,outsideIndex:1,partialReflection:false}});},
  r=>{r.components.push({id:'C2',type:'circular-dielectric',parameters:{x:30,y:30,radius:4,insideIndex:1.4,outsideIndex:1,partialReflection:false}});},
  r=>{r.components.push({id:'M2',type:'plane-mirror',parameters:{x:30,y:0,orientationDeg:90,length:8}});},
  r=>{source(r).emission={mode:'full-circle'};},
  r=>{source(r).emission={mode:'directional',directionDeg:8,angleDeg:10};},
 ]){const r=req();edit(r);assert.throws(()=>prepareScene(r));}
 // Backward ray near the vertex supporting line is safe when it points away.
 assert.doesNotThrow(()=>make(r=>{source(r).parameters.y=8;source(r).emission.directionDeg=180;}));
});
test('one native Glass returns the correct entry/exit faces and independent signed Snell invariants',()=>{
 const d=make(),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.interactions,2);assert.equal(m.invalidObservations,0);
 assert.deepEqual(Object.keys(m.faces),['face-12','face-23','face-34','face-41']);
 assert.equal(first(m).from,'outside');assert.equal(last(m).from,'inside');
 assert.equal(m.faces['face-23'].interactions,0);assert.equal(m.faces['face-41'].interactions,0);
 for(const f of [first(m),last(m)]){
  const b=f.branches.find(x=>x.kind==='transmitted');assert.ok(b);
  near(f.incidentIndex*cross(f.incidentDirection,f.outwardNormal),f.destinationIndex*cross(b.direction,f.outwardNormal));
  assert.ok(dot(f.incidentDirection,f.outwardNormal)*dot(b.direction,f.outwardNormal)>0);
 }
 near(first(m).incidentAngleDeg,8);near(first(m).transmittedAngleDeg,Math.asin(Math.sin(8*Math.PI/180)/1.5)*180/Math.PI);
 near(last(m).transmittedAngleDeg,8);near(heading(last(m).branches[0].direction),8);
});
test('inside source can totally internally reflect at upper face then exit through a different face',async()=>{
 const d=make(r=>{source(r).parameters.x=3;source(r).parameters.y=6;source(r).emission.directionDeg=25;}),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.totalInternalReflections,1);
 const tir=m.faces['face-23'].first;
 assert.equal(tir.outcome,'total-internal-reflection');assert.equal(tir.transmittedAngleDeg,null);
 const reflected=tir.branches.find(b=>b.kind==='reflected').direction;
 near(dot(tir.incidentDirection,tir.outwardNormal),-dot(reflected,tir.outwardNormal));
 near(cross(tir.incidentDirection,tir.outwardNormal),cross(reflected,tir.outwardNormal));
 assert.equal(m.faces['face-34'].first.from,'inside');
 const rows=await evaluateObservables(d,requests,s);
 assert.equal(rows.results[1].value['face-23'].first.transmittedAngleDeg,null);
 assert.match(formatRequestedResult(rows.results[1]),/transmission unavailable/);
});
test('native matches both vertex windings, rotation, translation, mm unit, component order and index ratio',()=>{
 const reference=meter(run(make())),ray=last(reference).branches[0].direction;
 for(const kind of ['winding','translate','rotate','units','order','index-scale']){
  let rot=0;
  const d=make(r=>{const p=polygon(r).parameters,s=source(r).parameters;
   if(kind==='winding'){[p.x2,p.x4]=[p.x4,p.x2];[p.y2,p.y4]=[p.y4,p.y2];}
   if(kind==='translate'){s.x+=14;s.y-=7;for(let i=1;i<=4;i++){p['x'+i]+=14;p['y'+i]-=7;}}
   if(kind==='rotate'){
    rot=29;const a=rot*Math.PI/180,tf=(x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
    [s.x,s.y]=tf(s.x,s.y);source(r).emission.directionDeg+=rot;
    for(let i=1;i<=4;i++)[p['x'+i],p['y'+i]]=tf(p['x'+i],p['y'+i]);
   }
   if(kind==='units'){r.lengthUnit='mm';s.x*=10;s.y*=10;for(let i=1;i<=4;i++){p['x'+i]*=10;p['y'+i]*=10;}}
   if(kind==='order')r.components.reverse();
   if(kind==='index-scale'){p.insideIndex*=2;p.outsideIndex*=2;}
  });
  const s=run(d),m=meter(s);
  assert.equal(s.native.status,'completed',kind);assert.equal(m.interactions,2,kind);
  const exit=Object.values(m.faces).find(f=>f.first?.from==='inside').first;
  near(exit.incidentAngleDeg,last(reference).incidentAngleDeg);
  near(wrap(heading(exit.branches[0].direction)-rot),heading(ray));
 }
});
test('native transmission is reversible and does not replace finite geometry with infinite half-planes',()=>{
 const s=run(make()),e=last(meter(s)),b=e.branches.find(x=>x.kind==='transmitted'),d=b.direction;
 const backwards=make(r=>{source(r).parameters.x=(e.pointMm.x+180*d.x)/10;source(r).parameters.y=(e.pointMm.y+180*d.y)/10;
  source(r).emission.directionDeg=wrap(heading(d)+180);});
 const reversed=run(backwards);assert.equal(reversed.native.status,'completed');assert.equal(meter(reversed).interactions,2);
 const out=first(meter(reversed)).branches.find(x=>x.kind==='transmitted').direction;
 near(out.x,-Math.cos(8*Math.PI/180));near(out.y,-Math.sin(8*Math.PI/180));
});
test('source within higher index, matched media and reversed material contrast preserve explicit native semantics',()=>{
 for(const [inside,outside] of [[2,1.5],[1.5,1.5],[1,1.5]]){
  const s=run(make(r=>{polygon(r).parameters.insideIndex=inside;polygon(r).parameters.outsideIndex=outside;}));
  assert.equal(s.native.status,'completed');assert.equal(meter(s).interactions,2);
  const e=last(meter(s));
  near(outside*Math.sin(e.transmittedAngleDeg*Math.PI/180),inside*Math.sin(e.incidentAngleDeg*Math.PI/180));
 }
});
test('complete native misses remain zero, not unknown image or fictitious transmitted angle',async()=>{
 const d=make(r=>{source(r).parameters.y=15;}),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.interactions,0);
 const result=await evaluateObservables(d,[...requests,{id:'transmit',kind:'interface-transmission-angle',componentId:'G1'}],s);
 assert.equal(result.results[0].value,0);assert.equal(result.results[2].status,'unavailable');assert.equal(result.results[3].status,'unavailable');
 assert.ok(Object.values(result.results[1].value).every(f=>f.interactions===0&&f.first===null));
});
test('full native Fresnel, depth and processed segment limits never masquerade as complete measurements',async()=>{
 for(const [edit,budget] of [[r=>{polygon(r).parameters.partialReflection=true;},null],[()=>{},['maxRayDepth',0]],[()=>{},['processedRayLimit',1]]]){
  const d=make(edit);if(budget)d.simulation[budget[0]]=budget[1];
  const s=run(d);assert.ok(['incomplete','stopped'].includes(s.native.status),JSON.stringify(s.native));
  assert.equal(s.observations,null);
  const result=await evaluateObservables(d,requests,s);
  assert.ok(result.results.every(r=>r.status==='suppressed'&&r.value===null));
 }
});
test('outside ray in lower-index glass may TIR with absent transmission (no numeric zero)',async()=>{
 const d=make(r=>{polygon(r).parameters.insideIndex=1;polygon(r).parameters.outsideIndex=1.5;
  source(r).parameters.x=-1;source(r).parameters.y=5;source(r).emission.directionDeg=60;}),s=run(d);
 assert.equal(s.native.status,'completed');assert.equal(meter(s).totalInternalReflections,1);
 const rows=await evaluateObservables(d,[...requests,{id:'transmission',kind:'interface-transmission-angle',componentId:'G1'}],s);
 assert.equal(rows.results.at(-1).status,'unavailable');assert.equal(rows.results.at(-1).value,null);
});
test('invalid native corner evidence suppresses readings without changing native delegate identity',()=>{
 const d=make(),g=d.physics.components.find(c=>c.id==='G1');
 assert.equal(polygonEncounter(g,{x:0,y:-80},{x:1,y:0}).invalid,true);
 const {scene,idMap}=core.loadDocument(d),o=scene.objs[idMap.get('G1')];
 let calls=0;const ray={p1:{x:-10,y:-80},p2:{x:0,y:-80},brightness_s:.1,brightness_p:.1};
 const args=[ray,0,{x:0,y:-80},[]],returned={isAbsorbed:true,isUndefinedBehavior:true};
 o.onRayIncident=function(...a){calls++;assert.deepEqual(a,args);a[0].brightness_s=.04;return returned;};
 const monitor=core.observeInterfaceSet(d,scene,idMap);
 assert.strictEqual(o.onRayIncident(...args),returned);assert.equal(calls,1);
 assert.equal(ray.brightness_s,.04);assert.ok(monitor.errors.length>0);
 assert.ok(monitor.byId.G1.invalidObservations>0);
});
test('real native observer delegates exactly once, preserves mutated rays/returns and face record defensive cloning',()=>{
 const d=make(),a=core.loadDocument(d),b=core.loadDocument(d),oa=a.scene.objs[a.idMap.get('G1')],ob=b.scene.objs[b.idMap.get('G1')];
 const original=oa.onRayIncident;let calls=0;oa.onRayIncident=function(...args){calls++;return original.apply(this,args);};
 const monitor=core.observeInterfaceSet(d,a.scene,a.idMap);
 const ray={p1:{x:-200,y:10},p2:{x:-180,y:7.188},brightness_s:.25,brightness_p:.25,gap:true};
 const ra=structuredClone(ray),rb=structuredClone(ray),hit=oa.checkRayIntersects(ra);
 assert.ok(hit);
 const expected=ob.onRayIncident(rb,0,structuredClone(hit),[]),actual=oa.onRayIncident(ra,0,structuredClone(hit),[]);
 assert.equal(calls,1);assert.deepEqual(ra,rb);assert.deepEqual(actual,expected);
 assert.equal(monitor.byId.G1.interactions,1);assert.equal(Object.keys(monitor.byId.G1.faces).length,4);
 const copy=monitor.byId;copy.G1.faces['face-12'].first.incidentAngleDeg=99;
 assert.notEqual(monitor.byId.G1.faces['face-12'].first.incidentAngleDeg,99);
});
test('several independently authored rays share polygon but no invented source-specific event lineage',()=>{
 const d=make(r=>{const s=structuredClone(source(r));s.id='S2';s.parameters.y=-2;r.components.push(s);}),s=run(d);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,2);assert.equal(meter(s).interactions,4);
 assert.equal(meter(s).faces['face-12'].interactions,2);assert.equal(meter(s).faces['face-34'].interactions,2);
 assert.equal(meter(s).faces['face-34'].first.sourceId,undefined);
});
test('qualified packages, atomic vertex/index revisions, stale hashes and edits preserve provenance',async()=>{
 const d=make(),s=run(d),qualification=initialQualification(d,null,{inputSha256:'e'.repeat(64),interpretation:fixture.interpretation});
 const bundle=await createQualifiedBundle(d,qualification,requests);await parseQualifiedBundle(JSON.stringify(bundle));
 const revised=reviseScene(d,{changes:[{id:'G1',section:'parameters',key:'x3',value:13,unit:'cm'}]}).document;
 const edited=await createQualifiedBundle(revised,recordQualifiedEdit(d,revised,bundle.qualification),requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(edited));
 assert.equal(reopened.scene.physics.components[1].parameters.x3,130);
 assert.equal(reopened.qualification.edits.at(-1).kind,'physics');
 assert.deepEqual(reopened.qualification.interpretation,fixture.interpretation);
 const stale=await evaluateObservables(revised,requests,s);assert.ok(stale.results.every(x=>x.status==='suppressed'));
 const tampered=structuredClone(edited);tampered.scene.physics.components[1].parameters.x3=140;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(tampered)),/integrity/);
 assert.throws(()=>reviseScene(d,{changes:[{id:'G1',section:'parameters',key:'x3',value:0,unit:'cm'}]}));
});
test('shared Fit covers all four vertices; parameter sweeps retain invalid intermediate configurations',async()=>{
 const d=make(),s=run(d),result=await evaluateObservables(d,requests,s);
 const points=apparatusPoints(d),verts=polygonVertices(d.physics.components.find(c=>c.id==='G1').parameters);
 for(const v of verts)assert.ok(points.some(p=>p.x===v.x&&p.y===v.y));
 const fit=await fitRequestedView(d,result,400,320);assert.deepEqual(fit.document.physics,d.physics);
 const q=initialQualification(d,null,{inputSha256:'f'.repeat(64),interpretation:fixture.interpretation});
 const saved=await createQualifiedBundle(d,q,requests);
 const sweep=await runParameterSweep(saved,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:saved.sceneSha256,
  parameter:{id:'G1',section:'parameters',key:'x3',unit:'cm'},values:[12,13,0],
  observables:[{id:'faces',kind:'interface-face-events',componentId:'G1'}]}, {execute:doc=>evaluateDocument(doc,core)});
 assert.equal(sweep.samples.length,3);assert.equal(sweep.samples[2].status,'invalid-input');
 assert.equal(sweep.samples[0].status,'completed');
});
test('unified problem preflight uniquely targets polygon interface and does not invent source geometry',()=>{
 const input=structuredClone(fixture);input.requests=[{id:'faces',kind:'interface-face-events'}];
 const plan=planProblem(input);
 assert.equal(plan.native.canRun,true);assert.equal(plan.nativeRequests[0].componentId,'G1');
 assert.deepEqual(plan.targetBindings.map(x=>x.componentId),['G1']);
 assert.equal(plan.scene.schemaVersion,9);assert.equal(plan.questionSupport,'not-assessed-by-engine');
});
test('shared prism observers retain exactly the original three face IDs when v9 is available',()=>{
 const r=JSON.parse(readFileSync(new URL('../examples/triangular-prism.json',import.meta.url)));
 const d=prepareScene(r.physical).document,s=run(d);
 assert.equal(d.schemaVersion,8);assert.equal(s.native.status,'completed');
 assert.deepEqual(prismFaces(d.physics.components.find(c=>c.type==='triangular-prism').parameters).map(f=>f.id),['face-12','face-23','face-31']);
 assert.equal(Object.keys(s.observations.interfacesById.P1.faces).length,3);
});
