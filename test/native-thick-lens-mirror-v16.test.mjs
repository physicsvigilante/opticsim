// v16 prospective physical composition. All ray paths come from the pinned
// native PhyDemo scene. Expected sequences are post-execution checks only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-mirror-v16.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const comp=(r,id)=>r.components.find(c=>c.id===id);
const prep=r=>prepareScene(r).document;
const exec=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests);
const close=(a,b,epsilon=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const snell=(e,p)=>{
 const left=p.x-p.centerThickness/2,right=p.x+p.centerThickness/2,front=e.point.x<p.x;
 const R=front?p.frontRadius:p.backRadius,cx=front?left+R:right-R;
 const n={x:(e.point.x-cx)/R,y:(e.point.y-p.y)/R};
 close(Math.hypot(e.point.x-cx,e.point.y-p.y),R,1e-5);
 const leaving=dot(e.incoming,n)>0;
 const ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
 assert.equal(e.outgoing.length,1);
 assert.ok(dot(e.outgoing[0],n)*dot(e.incoming,n)>0);
 close(ni*cross(e.incoming,n),nt*cross(e.outgoing[0],n),1e-7);
 return {face:front?'front-arc':'back-arc',from:leaving?'inside':'outside',
  point:e.point,incidentIndex:ni,destinationIndex:nt};
};
test('v16 accepts exactly one finite native spherical lens + one native mirror and traces actual return',async()=>{
 const r=fresh(),before=JSON.stringify(r),d=prep(r);
 assert.equal(JSON.stringify(r),before,'All physical facts preserved exactly');
 assert.equal(d.schemaVersion,16);assert.equal(d.adapterVersion,16);
 assert.equal(d.physics.model,'native-thick-lens-mirror-tracing');
 assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.deepEqual(core.compile(d).native.objs.map(o=>o.type),['SingleRay','SphericalLens','Mirror','Detector']);
 const observed=inspectNative(d),ids=observed.trace.map(x=>x.id);
 assert.deepEqual(ids,['D1','L1','L1','M1','L1','L1','D1']);
 const faces=observed.trace.filter(e=>e.id==='L1').map(e=>snell(e,comp(r,'L1').parameters));
 assert.deepEqual(faces.map(f=>f.face),['front-arc','back-arc','back-arc','front-arc']);
 assert.deepEqual(faces.map(f=>f.from),['outside','inside','outside','inside']);
 const mirror=observed.trace.find(e=>e.id==='M1');
 assert.equal(mirror.outgoing.length,1);
 close(mirror.point.x,130);
 close(mirror.outgoing[0].x,-mirror.incoming.x);
 close(mirror.outgoing[0].y,mirror.incoming.y);
 assert.equal(observed.diagnostic.reflectionsById.M1,1);
 assert.equal(observed.diagnostic.interfacesById.L1.interactions,4);
 assert.equal(observed.diagnostic.interfacesById.L1.faces['front-arc'].interactions,2);
 assert.equal(observed.diagnostic.interfacesById.L1.faces['back-arc'].interactions,2);
 assert.equal(observed.diagnostic.detectorsById.D1.crossings,2);
 const run=exec(d),read=await evaluateObservables(d,fixture.requests,run.summary);
 assert.equal(run.summary.native.status,'completed');
 assert.equal(run.summary.executionPassed,true);
 assert.deepEqual(read.results.map(x=>x.status),Array(fixture.requests.length).fill('qualified'));
 assert.deepEqual(read.results.map(x=>x.value).filter(x=>typeof x==='number'),[4,1,2]);
 assert.ok(read.results.every(x=>x.warnings.some(w=>w.includes('approximation'))));
 const image=(await evaluateObservables(d,[{id:'image',kind:'ideal-image',componentId:'S1'}],run.summary)).results[0];
 assert.equal(image.status,'unavailable');assert.equal(image.value,null);
 console.log('V16_NATIVE_RETURN '+JSON.stringify({
  status:run.summary.native.status,ids,faces,mirror:mirror.point,
  nativeDetectorCrossings:observed.diagnostic.detectorsById.D1.crossings}));
});
test('v16 authentic missed mirror does not imply a prescribed return route',async()=>{
 const r=fresh();comp(r,'M1').parameters.y=500;
 const d=prep(r),obs=inspectNative(d),ids=obs.trace.map(e=>e.id);
 assert.deepEqual(ids,['D1','L1','L1']);
 assert.equal(obs.diagnostic.reflectionsById.M1,0);
 assert.equal(obs.diagnostic.detectorsById.D1.crossings,1);
 const sum=exec(d).summary,read=await evaluateObservables(d,fixture.requests,sum);
 assert.equal(sum.native.status,'completed');
 assert.deepEqual(read.results.map(x=>x.value).filter(x=>typeof x==='number'),[2,0,1]);
 const changed=fresh();
 comp(changed,'M1').parameters.x=130;
 comp(changed,'M1').parameters.y=500;
 assert.deepEqual(changed,r);
 console.log('V16_NATIVE_MISS '+JSON.stringify({ids,status:sum.native.status,
  mirrorReflections:obs.diagnostic.reflectionsById.M1}));
});
test('v16 validates whole mirror segment, lens geometry, detector/source and model isolation',()=>{
 const baseline=fresh();
 const negative=[
  r=>comp(r,'M1').parameters.x=15,
  r=>comp(r,'M1').parameters.x=15.009,
  r=>{comp(r,'M1').parameters.x=40;comp(r,'M1').parameters.length=150;comp(r,'M1').parameters.orientationDeg=30;},
  r=>comp(r,'M1').parameters.x=9999,
  r=>comp(r,'L1').parameters.centerThickness=20,
  r=>comp(r,'L1').parameters.frontRadius=49,
  r=>comp(r,'L1').parameters.apertureHeight=1,
  r=>comp(r,'D1').parameters.x=0,
  r=>comp(r,'S1').parameters.x=0,
  r=>{comp(r,'M1').parameters.x=-200;comp(r,'M1').parameters.y=10;},
  r=>comp(r,'S1').emission.mode='full-circle',
  r=>r.components.push({...structuredClone(comp(r,'L1')),id:'L2',parameters:{...comp(r,'L1').parameters,x:75}}),
  r=>r.components.push({id:'B1',type:'line-blocker',parameters:{x:80,y:0,orientationDeg:90,length:100}}),
  r=>r.components.push({id:'C1',type:'circular-dielectric',parameters:{x:300,y:0,radius:10,insideIndex:1.4,outsideIndex:1,partialReflection:false}})
 ];
 for(const [i,edit] of negative.entries()){
  const r=structuredClone(baseline);edit(r);
  assert.throws(()=>prep(r),undefined,'Invalid v16 case '+i+' must not be repaired');
 }
 const positive=structuredClone(baseline);
 comp(positive,'M1').parameters.x=15.011;
 comp(positive,'S1').parameters.y=0;
 const accepted=prep(positive);
 assert.equal(accepted.schemaVersion,16);
 assert.deepEqual(accepted.physics.components.find(c=>c.id==='M1').parameters,comp(positive,'M1').parameters);
 const v15=structuredClone(accepted);v15.schemaVersion=v15.adapterVersion=15;
 v15.physics.model='native-thick-lens-tracing';
 assert.throws(()=>validate(v15),'Historical v15 must refuse mixed components');
 const v14=structuredClone(accepted);v14.schemaVersion=v14.adapterVersion=14;
 v14.physics.model='two-separated-dielectrics-tracing';
 assert.throws(()=>validate(v14),'Historical v14 must refuse mixed components');
 const existing=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-train.json',import.meta.url),'utf8'));
 assert.equal(prep(existing.physical).schemaVersion,15);
 const noMirror=structuredClone(baseline);noMirror.components=noMirror.components.filter(x=>x.id!=='M1');
 assert.equal(prep(noMirror).schemaVersion,15,'New authoring selection remains backwards-compatible');
 const structural=prep(baseline);
 assert.throws(()=>reviseComponents(structural,{format:'opticsim-component-revision-v1',
  operations:[{op:'remove',id:'M1'}]}),'No implicit downgrade to v15 via structural edit');
 assert.ok(capabilities().composition.profiles.some(p=>p.schemaVersion===16));
});
test('qualified mirror/lens physical revisions preserve native evidence integrity and source identity',async()=>{
 const original=prep(fresh()),q=initialQualification(original,null,{inputSha256:'c'.repeat(64)});
 const evidence=exec(original).summary;
 const revised=reviseScene(original,{changes:[{id:'M1',section:'parameters',key:'y',value:500}]}).document;
 assert.equal(revised.schemaVersion,16);
 const stale=await evaluateObservables(revised,fixture.requests,evidence);
 assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
 const current=exec(revised);
 assert.equal(current.summary.native.status,'completed');
 const read=await evaluateObservables(revised,fixture.requests,current.summary);
 assert.deepEqual(read.results.map(x=>x.status),Array(fixture.requests.length).fill('qualified'));
 const q2=recordQualifiedEdit(original,revised,q);
 const reopened=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(revised,q2,fixture.requests)));
 assert.deepEqual(reopened.scene,revised);
 assert.equal(reopened.scene.physics.components.find(c=>c.id==='M1').parameters.y,500);
 assert.equal(reopened.scene.physics.components.find(c=>c.id==='L1').parameters.insideIndex,1.5);
 assert.throws(()=>reviseScene(original,{changes:[{id:'M1',section:'parameters',key:'x',value:0}]}));
});
test('incomplete thick-lens and mirror native runs suppress all measurements without inventing a route',async()=>{
 const doc=prep(fresh()),limited=structuredClone(doc);
 limited.simulation.maxRayDepth=2;validate(limited);
 const run=exec(limited);
 assert.equal(run.summary.native.status,'incomplete');
 assert.equal(run.summary.executionPassed,false);
 assert.ok((await evaluateObservables(limited,fixture.requests,run.summary)).results.every(x=>x.status==='suppressed'&&x.value===null));
 const fresnel=structuredClone(doc);
 comp({components:fresnel.physics.components},'L1').parameters.partialReflection=true;
 const complete=exec(fresnel);
 assert.ok(['completed','completed-with-warnings','incomplete'].includes(complete.summary.native.status));
 const values=(await evaluateObservables(fresnel,fixture.requests,complete.summary)).results;
 if(complete.summary.native.status==='incomplete')
  assert.ok(values.every(x=>x.status==='suppressed'&&x.value===null));
 console.log('V16_NATIVE_FRESNEL '+JSON.stringify({status:complete.summary.native.status,
  truncation:complete.summary.native.truncation,requested:values.map(x=>x.status)}));
});
