import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave,setSourceMode} from '../src/contract.js';
import {polygonVertices,polygonFaces,polygonEncounter} from '../src/polygon-dielectric.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView,formatRequestedResult} from '../src/result-preview.js';
import {validateMotion} from '../src/source-motion.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/polygon-dielectric.json',import.meta.url)));
const input=()=>structuredClone(fixture.physical);
const poly=x=>x.components.find(c=>c.type==='polygon-dielectric').parameters;
const src=x=>x.components.find(c=>c.type==='point-source');
const build=(edit=()=>{})=>{const i=input();i.components=i.components.filter(c=>c.type!=='ray-detector');edit(i);return prepareScene(i).document;};
const run=d=>evaluateDocument(d,core).summary;
const meter=r=>r.observations.interfacesById.G1;
const queries=[{id:'count',kind:'interface-interactions',componentId:'G1'},
 {id:'faces',kind:'interface-face-events',componentId:'G1'},
 {id:'first',kind:'interface-first-event',componentId:'G1'}];
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;

test('polygon v9 minimal exact authoring is one native four-edge Glass, not infinite plane stack',()=>{
 const i=input(),original=JSON.stringify(i),d=prepareScene(i).document,c=core.compile(d),p=d.physics.components.find(x=>x.type==='polygon-dielectric');
 assert.equal(d.schemaVersion,9);assert.equal(d.adapterVersion,9);
 assert.equal(d.physics.model,'polygon-dielectric-tracing');
 assert.equal(capabilities().polygonDielectrics.schemaVersion,9);
 assert.deepEqual(capabilities().componentTypes['polygon-dielectric'].faceIds,
  ['face-12','face-23','face-34','face-41']);
 const native=c.native.objs[c.idMap.get('G1')];
 assert.deepEqual(native,{type:'Glass',path:polygonVertices(p.parameters).map(v=>({x:v.x,y:-v.y,arc:false})),
  notDone:false,refIndex:1.5,partialReflect:false});
 assert.equal(c.native.objs.filter(x=>x.type==='PlaneGlass').length,0);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.equal(JSON.stringify(i),original);
 assert.equal(core.loadNative(JSON.parse(core.nativeExport(d))).objs[c.idMap.get('G1')].constructor.type,'Glass');
});
test('legacy v4–v8 cannot acquire polygon glass or use existing motion player',()=>{
 const d=build();
 for(const [version,model] of [[4,'general-component-tracing'],[5,'planar-media-tracing'],
  [6,'curved-mirror-tracing'],[7,'circular-dielectric-tracing'],[8,'triangular-prism-tracing']]){
  const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=version;bad.physics.model=model;
  assert.throws(()=>validate(bad));
 }
 for(const mode of ['directional','full-circle'])assert.throws(()=>setSourceMode(d,'S1',mode));
 assert.throws(()=>validateMotion(d,{format:'opticsim-source-motion-v1',sourceId:'S1',law:'constant-velocity',
  velocity:{x:1,y:0,unit:'mm/s'},durationSeconds:1,samples:2,continuationAssumption:'synthetic'}));
});
test('missing physical vertices, indices or reflection policies are never guessed',()=>{
 for(const key of capabilities().componentTypes['polygon-dielectric'].parameters){
  const x=input();delete poly(x)[key];
  for(const illustration of [false,true])assert.equal(resolveProblemRequest(x,{illustration}).prepared,null,key);
 }
 for(const [key,value] of [['x4',null],['y3','100'],['insideIndex',.9],['outsideIndex',4.1],['partialReflection',0]]){
  const x=input();poly(x)[key]=value;assert.throws(()=>prepareScene(x));
 }
 const d=input();delete src(d).emission.directionDeg;assert.throws(()=>prepareScene(d));
});
test('strict convex finite geometry rejects self-crossing, concave, short-edge and boundary cases',()=>{
 const edits=[
  i=>{poly(i).x3=0;},
  i=>{poly(i).x3=.001;},
  i=>{poly(i).x3=1001;},
  i=>{poly(i).x4=5;poly(i).y4=0;},
  i=>{poly(i).x3=15;poly(i).y3=-10;poly(i).x4=15;poly(i).y4=10;},
  i=>{poly(i).x4=0;poly(i).y4=-10;},
  i=>{src(i).parameters.x=0;},
  i=>{src(i).parameters.y=10;},
  i=>{i.components[2].parameters.x=2;},
  i=>{i.components.push({...i.components[1],id:'G2'});},
  i=>{i.components.push({id:'L1',type:'ideal-lens',parameters:{x:4,focalLength:10,apertureHeight:10}});},
  i=>{src(i).emission={mode:'full-circle'};}
 ];
 for(const [j,edit] of edits.entries()){const x=input();edit(x);assert.throws(()=>prepareScene(x),undefined,'negative '+j);}
});
test('native front and back faces have correct outward normals, indices and refracted ray crossings',async()=>{
 const d=build(),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.interactions,2);
 assert.equal(m.invalidObservations,0);assert.equal(m.totalInternalReflections,0);
 assert.deepEqual(Object.keys(m.faces),['face-12','face-23','face-34','face-41']);
 assert.equal(m.faces['face-12'].first.from,'outside');
 assert.equal(m.faces['face-34'].first.from,'inside');
 assert.deepEqual([m.faces['face-23'].interactions,m.faces['face-41'].interactions],[0,0]);
 for(const e of [m.faces['face-12'].first,m.faces['face-34'].first]){
  const b=e.branches.find(x=>x.kind==='transmitted');
  assert.ok(b);near(e.incidentAngleDeg,0);near(e.transmittedAngleDeg,0);
  near(e.incidentIndex*cross(e.incidentDirection,e.outwardNormal),
    e.destinationIndex*cross(b.direction,e.outwardNormal));
  assert.ok(dot(e.incidentDirection,e.outwardNormal)*dot(b.direction,e.outwardNormal)>0);
 }
 const results=await evaluateObservables(d,queries,s);
 assert.equal(results.results[0].value,2);
 assert.equal(results.results[1].value['face-41'].first,null);
 assert.equal(results.results[2].value.from,'outside');
});
test('synthetic native detector registers a crossing after refraction',async()=>{
 const d=prepareScene(input()).document,s=run(d);
 assert.equal(s.native.status,'completed');
 const results=await evaluateObservables(d,fixture.requests,s);
 assert.equal(results.results[0].value,2);
 assert.equal(results.results[3].value,1);
 assert.equal(results.results[3].method,'native-observation');
 assert.equal(s.observations.detectorsById.D1.crossings,1);
});
test('inside source and source misses do not fabricate entry or transmitted branches',async()=>{
 const inside=build(x=>{src(x).parameters.x=7;}),s=run(inside);
 assert.equal(s.native.status,'completed');assert.equal(meter(s).interactions,1);
 assert.equal(meter(s).first.from,'inside');
 const miss=build(x=>{src(x).parameters.y=20;}),a=run(miss);
 assert.equal(a.native.status,'completed');assert.equal(meter(a).interactions,0);
 const r=await evaluateObservables(miss,queries,a);
 assert.equal(r.results[0].value,0);
 assert.equal(r.results[2].status,'unavailable');
 assert.ok(Object.values(r.results[1].value).every(x=>x.interactions===0&&x.first===null));
});
test('native reflection-only TIR retains native branch rather than synthesizing transmission',async()=>{
 const d=build(x=>{src(x).parameters.x=7;src(x).parameters.y=0;src(x).emission.directionDeg=50;});
 const s=run(d),m=s.observations?.interfacesById?.G1;
 assert.equal(s.native.status,'completed');
 assert.ok(m.totalInternalReflections>=1);
 const tir=Object.values(m.faces).map(x=>x.first).find(x=>x?.outcome==='total-internal-reflection');
 assert.ok(tir);assert.equal(tir.transmittedAngleDeg,null);
 assert.ok(tir.branches.some(x=>x.kind==='reflected'));
 const r=await evaluateObservables(d,queries,s);
 assert.ok(formatRequestedResult(r.results[1]).includes('total-internal-reflection'));
});
test('exact geometry preserves refraction under winding, units, translation, rotation and component order',()=>{
 const reference=meter(run(build())).interactions;
 for(const kind of ['winding','units','translation','rotation','component-order','matching-index']){
  const doc=build(i=>{
   const p=poly(i),source=src(i);
   if(kind==='winding'){
    const v=[[p.x1,p.y1],[p.x4,p.y4],[p.x3,p.y3],[p.x2,p.y2]];
    for(let k=1;k<=4;k++){p['x'+k]=v[k-1][0];p['y'+k]=v[k-1][1];}
   }
   if(kind==='units'){
    i.lengthUnit='mm';source.parameters.x*=10;source.parameters.y*=10;
    for(let k=1;k<=4;k++){p['x'+k]*=10;p['y'+k]*=10;}
   }
   if(kind==='translation'){
    source.parameters.x+=3;source.parameters.y-=5;
    for(let k=1;k<=4;k++){p['x'+k]+=3;p['y'+k]-=5;}
   }
   if(kind==='rotation'){
    const angle=25*Math.PI/180;
    const rotate=(x,y)=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
    [source.parameters.x,source.parameters.y]=rotate(source.parameters.x,source.parameters.y);
    source.emission.directionDeg=25;
    for(let k=1;k<=4;k++)[p['x'+k],p['y'+k]]=rotate(p['x'+k],p['y'+k]);
   }
   if(kind==='component-order')i.components.reverse();
   if(kind==='matching-index')p.insideIndex=p.outsideIndex=1.5;
  });
  const s=run(doc);assert.equal(s.native.status,'completed',kind);assert.equal(meter(s).interactions,reference,kind);
 }
});
test('native observer delegates once and refuses ambiguous vertex evidence',()=>{
 const d=build(),a=core.loadDocument(d),obj=a.scene.objs[a.idMap.get('G1')];
 const p=d.physics.components.find(x=>x.id==='G1');
 assert.equal(polygonEncounter(p,{x:0,y:-100},{x:1,y:0}).invalid,true);
 let calls=0;
 const ray={p1:{x:-10,y:-100},p2:{x:0,y:-100},brightness_s:.1,brightness_p:.1};
 const args=[ray,0,{x:0,y:-100},[]],expected={isAbsorbed:true,isUndefinedBehavior:true};
 obj.onRayIncident=(...actual)=>{calls++;assert.deepEqual(actual,args);actual[0].brightness_s=.04;return expected;};
 const observer=core.observeInterfaceSet(d,a.scene,a.idMap);
 assert.strictEqual(obj.onRayIncident(...args),expected);
 assert.equal(calls,1);assert.equal(ray.brightness_s,.04);
 assert.ok(observer.errors.length>0);assert.ok(observer.byId.G1.invalidObservations>0);
});
test('full Fresnel and native depth limitations suppress all requested values on incomplete runs',async()=>{
 for(const kind of ['full-fresnel','depth-zero']){
  const d=build(kind==='full-fresnel'?x=>{poly(x).partialReflection=true;}:()=>{});
  if(kind==='depth-zero')d.simulation.maxRayDepth=0;
  const s=run(d);
  assert.ok(['incomplete','stopped'].includes(s.native.status),JSON.stringify(s.native));
  assert.equal(s.observations,null);
  const r=await evaluateObservables(d,queries,s);
  assert.ok(r.results.every(x=>x.status==='suppressed'&&x.value===null));
 }
});
test('shared qualified save, physical revisions and Fit preserve all four vertices and provenance',async()=>{
 const d=build(),s=run(d),q=initialQualification(d,null,{inputSha256:'c'.repeat(64),interpretation:fixture.interpretation});
 const original=await createQualifiedBundle(d,q,queries);
 await parseQualifiedBundle(JSON.stringify(original));
 const changed=reviseScene(d,{changes:[{id:'G1',section:'parameters',key:'x3',value:16,unit:'cm'},
  {id:'G1',section:'parameters',key:'x4',value:16,unit:'cm'}]}).document;
 const updated=await createQualifiedBundle(changed,recordQualifiedEdit(d,changed,original.qualification),queries);
 const restored=await parseQualifiedBundle(JSON.stringify(updated));
 assert.equal(restored.scene.physics.components.find(x=>x.id==='G1').parameters.x4,160);
 assert.deepEqual(restored.qualification.interpretation,original.qualification.interpretation);
 const stale=await evaluateObservables(changed,queries,s);
 assert.ok(stale.results.every(x=>x.status==='suppressed'));
 const tampered=structuredClone(updated);tampered.scene.physics.components.find(x=>x.id==='G1').parameters.x4=180;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(tampered)),/integrity/);
 for(const p of polygonVertices(changed.physics.components.find(x=>x.id==='G1').parameters))
  assert.ok(apparatusPoints(changed).some(v=>v.x===p.x&&v.y===p.y));
 const fitted=await fitRequestedView(changed,await evaluateObservables(changed,queries,run(changed)),390,320);
 assert.deepEqual(fitted.document.physics,changed.physics);
});

test('oblique native entry and exit obey independently checked signed Snell law',()=>{
 const d=build(i=>{src(i).parameters.y=0;src(i).emission.directionDeg=15;}),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');
 assert.equal(m.interactions,2);assert.equal(m.invalidObservations,0);
 for(const e of [m.faces['face-12'].first,m.faces['face-34'].first]){
  const b=e.branches.find(x=>x.kind==='transmitted');
  assert.ok(b);near(e.incidentIndex*cross(e.incidentDirection,e.outwardNormal),
   e.destinationIndex*cross(b.direction,e.outwardNormal));
 }
 near(m.faces['face-12'].first.incidentAngleDeg,15,1e-8);
 near(m.faces['face-12'].first.transmittedAngleDeg,Math.asin(Math.sin(15*Math.PI/180)/1.5)*180/Math.PI,1e-8);
 near(m.faces['face-34'].first.transmittedAngleDeg,15,1e-7);
});
test('reversed ray starts at another face; interface normals and index order follow actual native travel',()=>{
 const d=build(i=>{src(i).parameters.x=20;src(i).parameters.y=0;src(i).emission.directionDeg=180;});
 const s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(m.interactions,2);
 assert.equal(m.faces['face-34'].first.from,'outside');
 assert.equal(m.faces['face-12'].first.from,'inside');
 near(m.faces['face-34'].first.outwardNormal.x,1);near(m.faces['face-12'].first.outwardNormal.x,-1);
});
test('multiple independent native sources aggregate face counts without inventing route attribution',()=>{
 const d=build(i=>{const source=structuredClone(src(i));source.id='S2';source.parameters.y=-1;i.components.push(source);}),s=run(d),m=meter(s);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,2);
 assert.equal(m.interactions,4);
 assert.equal(m.faces['face-12'].interactions,2);assert.equal(m.faces['face-34'].interactions,2);
 assert.equal(m.faces['face-34'].first.sourceId,undefined);
});

test('shared finite-face helpers retain raw native observer behavior and independent copies',()=>{
 const d=build(i=>{src(i).emission.directionDeg=12;poly(i).partialReflection=true;}),a=core.loadDocument(d),b=core.loadDocument(d),
  oa=a.scene.objs[a.idMap.get('G1')],ob=b.scene.objs[b.idMap.get('G1')],native=oa.onRayIncident;
 let calls=0;oa.onRayIncident=function(...args){calls++;return native.apply(this,args);};
 const observer=core.observeInterfaceSet(d,a.scene,a.idMap);
 const r={p1:{x:-200,y:-10},p2:{x:-180,y:-10-20*Math.tan(12*Math.PI/180)},brightness_s:.05,brightness_p:.05,gap:true};
 const ra=structuredClone(r),rb=structuredClone(r),hit=oa.checkRayIntersects(ra);
 const expected=ob.onRayIncident(rb,0,structuredClone(hit),[]),actual=oa.onRayIncident(ra,0,structuredClone(hit),[]);
 assert.equal(calls,1);assert.deepEqual(actual,expected);assert.deepEqual(ra,rb);
 assert.equal(observer.byId.G1.interactions,1);assert.equal(Object.keys(observer.byId.G1.faces).length,4);
 const copy=observer.byId;copy.G1.faces['face-12'].first.branches[0].direction.x=99;
 assert.notEqual(observer.byId.G1.faces['face-12'].first.branches[0].direction.x,99);
});
test('nonrectangular four-face geometries satisfy local Snell and reflection invariants across rotations and index ratios',()=>{
 let completed=0,tir=0;
 for(const skew of [-20,0,30])for(const rotation of [-67,0,23])for(const heading of [-12,0,16])for(const [ni,no] of [[1.5,1],[1,1.6]]){
  const d=build(i=>{
   i.lengthUnit='mm';const p=poly(i),s=src(i),v=[[0,-100],[skew,100],[150+skew,100],[150,-100]];
   const a=rotation*Math.PI/180,rot=(x,y)=>[Math.cos(a)*x-Math.sin(a)*y,Math.sin(a)*x+Math.cos(a)*y];
   for(let k=1;k<=4;k++)[p['x'+k],p['y'+k]]=rot(...v[k-1]);
   [s.parameters.x,s.parameters.y]=rot(-250,11);s.emission.directionDeg=rotation+heading;
   p.insideIndex=ni;p.outsideIndex=no;
  }),s=run(d);
  assert.equal(s.native.status,'completed',JSON.stringify({skew,rotation,heading,ni,no,native:s.native}));completed++;
  const m=meter(s);assert.equal(m.invalidObservations,0);assert.ok(m.interactions>0);tir+=m.totalInternalReflections;
  for(const f of Object.values(m.faces))if(f.first){const e=f.first;
   for(const b of e.branches){
    if(b.kind==='transmitted')near(e.incidentIndex*cross(e.incidentDirection,e.outwardNormal),e.destinationIndex*cross(b.direction,e.outwardNormal));
    if(b.kind==='reflected'){
     near(dot(e.incidentDirection,e.outwardNormal),-dot(b.direction,e.outwardNormal));
     near(cross(e.incidentDirection,e.outwardNormal),cross(b.direction,e.outwardNormal));
    }
   }
  }
 }
 assert.equal(completed,54);
});
