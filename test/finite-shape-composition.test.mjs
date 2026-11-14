import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseScene,reviseComponents} from '../src/authoring.js';
import {validate,serializeSave,parseSave,UPSTREAM} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {inspectNative,transform} from './helpers/native-composition-inspection.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const fixture=read('examples/prism-mirror-composition.json');
const request=()=>structuredClone(fixture.physical),c=(r,id)=>r.components.find(c=>c.id===id),p=(r,id)=>c(r,id).parameters;
const make=(r=request())=>prepareScene(r).document,run=d=>evaluateDocument(d,core).summary;
const patch=operations=>({format:'opticsim-component-revision-v1',operations});
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const quad=()=>({id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-50,x2:0,y2:50,x3:20,y3:50,x4:20,y4:-50,insideIndex:1.5,outsideIndex:1,partialReflection:false}});
const bundle=d=>createQualifiedBundle(d,initialQualification(d,null,{inputSha256:'c'.repeat(64),interpretation:fixture.interpretation}),fixture.requests);
const child=out=>createQualifiedBundle(out.document,out.qualification,out.observables);

// Independent, test-only scalar construction for this explicitly fixed apparatus.
// Never used by native tracing, authoring, validation or production observations.
function scalarReference(){
 const slope=Math.tan(Math.atan2(2,5)-Math.asin(1.5*2/Math.sqrt(29)));
 const mirrorY=10+44*slope,returnX=(60+104*slope)/(2.5+slope),returnY=2.5*returnX-50;
 return {slope,points:[[0,10],[16,10],[60,mirrorY],[returnX,returnY],[0,returnY],[-20,returnY]],returnY};
}

test('v12 admits one finite shape through the same family and defensive exclusive-region policy',()=>{
 const r=request(),before=structuredClone(r),d=make(r);assert.deepEqual(r,before);
 assert.equal(d.schemaVersion,12);assert.equal(d.adapterVersion,12);assert.equal(d.physics.model,'finite-dielectric-composition');
 assert.equal(d.upstreamCommit,UPSTREAM);assert.deepEqual(parseSave(serializeSave(d)),d);
 assert.deepEqual(read('scenes/prism-mirror-composition.json'),d);
 const cap=capabilities().finiteShapeComposition;
 assert.deepEqual(cap.groups,[{types:['polygon-dielectric','triangular-prism'],min:1,max:1}]);
 cap.groups[0].types.push('circular-dielectric');cap.counts['plane-mirror'].max=99;
 assert.equal(capabilities().finiteShapeComposition.counts['plane-mirror'].max,2);
 assert.equal(capabilities().finiteShapeComposition.groups[0].types.length,2);
 const g=read('scenes/finite-dielectric-composition.json'),newer=structuredClone(g);newer.schemaVersion=newer.adapterVersion=12;
 validate(newer);assert.equal(core.nativeExport(newer),core.nativeExport(g));assert.deepEqual(run(newer).observations,run(g).observations);
 const noMirror=request();noMirror.components=noMirror.components.filter(c=>c.type!=='plane-mirror');assert.equal(make(noMirror).schemaVersion,8);
 assert.equal(prepareScene(read('examples/finite-dielectric-composition.json').physical).document.schemaVersion,10);
 assert.equal(prepareScene(read('examples/finite-glass-two-mirrors.json').physical).document.schemaVersion,11);
});

test('native prism return agrees with independent scalar Snell geometry at every recorded coordinate',()=>{
 const d=make(),actual=run(d),checked=inspectNative(d),ref=scalarReference();assert.equal(actual.native.status,'completed');
 assert.deepEqual(core.loadDocument(d).scene.objs.map(o=>o.constructor.type),['SingleRay','Glass','Mirror','Detector']);
 assert.deepEqual(checked.trace.map(e=>e.id),['P1','P1','M1','P1','P1','D1']);
 checked.trace.forEach((e,i)=>{near(e.point.x,ref.points[i][0]);near(e.point.y,ref.points[i][1]);});
 assert.equal(actual.observations.interfacesById.P1.interactions,4);
 assert.deepEqual(Object.keys(actual.observations.interfacesById.P1.faces),['face-12','face-23','face-31']);
 assert.equal(actual.observations.reflectionsById.M1,1);assert.equal(actual.observations.detectorsById.D1.crossings,1);
 assert.deepEqual(checked.diagnostic.interfacesById,actual.observations.interfacesById);
 assert.equal(actual.analysis.status,'unavailable');
});

test('one common v12 contract verifies both shapes across 108 transformed/material/incidence systems',()=>{
 let total=0;
 for(const shape of ['triangle','quadrilateral'])for(const angle of [-2,2])for(const indices of [[1.5,1],[1.3,1],[2,1.5]])
 for(const rotation of [0,37,-90])for(const scale of [.1,1,10]){
  const r=request();
  if(shape==='quadrilateral'){r.components[1]={...quad(),id:'P1'};p(r,'D1').y=10;}
  Object.assign(p(r,'P1'),{insideIndex:indices[0],outsideIndex:indices[1]});c(r,'S1').emission.directionDeg=angle;
  transform(r,rotation,scale,100,-75);const d=make(r);d.schemaVersion=d.adapterVersion=12;validate(d);
  const {diagnostic}=inspectNative(d);assert.equal(diagnostic.interfacesById.P1.interactions,4);
  assert.equal(diagnostic.reflectionsById.M1,1);total++;
 }assert.equal(total,108);
});

test('finite misses, mirror-first illumination and reversible return are native outcomes, not required routes',()=>{
 for(const [mutate,glass,mirror] of [[r=>{p(r,'M1').y=100;},2,0],
  [r=>{c(r,'S1').emission.directionDeg=180;},0,0],
  [r=>{Object.assign(p(r,'S1'),{x:100,y:10});c(r,'S1').emission.directionDeg=180;},0,1]]){
  const r=request();mutate(r);const o=run(make(r));assert.equal(o.executionPassed,true);
  assert.equal(o.observations.interfacesById.P1.interactions,glass);assert.equal(o.observations.reflectionsById.M1,mirror);
 }
 const reverse=request();p(reverse,'S1').y=scalarReference().returnY;p(reverse,'D1').y=10;
 const reversed=inspectNative(make(reverse));near(reversed.trace.at(-1).point.y,10);
 const inside=request();p(inside,'S1').x=5;assert.equal(inspectNative(make(inside)).diagnostic.interfacesById.P1.interactions,3);
});

test('prism composition retains explicit TIR and matched-index behavior without manufactured transmission',async()=>{
 const r=request();Object.assign(p(r,'P1'),{insideIndex:1,outsideIndex:1.5});
 p(r,'S1').y=10-40*Math.tan(50*Math.PI/180);c(r,'S1').emission.directionDeg=50;
 const d=make(r),s=run(d);inspectNative(d);assert.equal(s.observations.interfacesById.P1.totalInternalReflections,1);
 const t=(await evaluateObservables(d,[{id:'t',kind:'interface-transmission-angle',componentId:'P1'}],s)).results[0];
 assert.equal(t.status,'unavailable');assert.equal(t.value,null);assert.equal(s.observations.reflectionsById.M1,0);
 const internal=request();p(internal,'P1').x3=100;p(internal,'M1').x=200;const inner=inspectNative(make(internal));
 assert.ok(inner.diagnostic.interfacesById.P1.totalInternalReflections>0);
 const matched=request();Object.assign(p(matched,'P1'),{outsideIndex:1.5,partialReflection:true});
 const same=run(make(matched));assert.equal(same.executionPassed,true);assert.equal(same.observations.interfacesById.P1.reflected,0);
});

test('the existing one-or-two mirror rule is shape-independent and every external segment is validated',()=>{
 const r=request();r.components.push({id:'M2',type:'plane-mirror',parameters:{x:-60,y:-8,orientationDeg:45,length:10}});
 const out=inspectNative(make(r));assert.deepEqual(out.diagnostic.reflectionsById,{M1:1,M2:1});
 for(const mutate of [r=>{p(r,'M2').x=10;},r=>{Object.assign(p(r,'M2'),p(r,'M1'));},
  r=>{Object.assign(p(r,'M2'),{x:60.005,y:0,orientationDeg:90,length:60});},
  r=>{r.components.push({...structuredClone(c(r,'M2')),id:'M3'});}]){
  const bad=structuredClone(r);mutate(bad);assert.throws(()=>make(bad));
 }
});

test('shape rules and exclusive region counts reject unsupported geometry before any native run',()=>{
 for(const mutate of [r=>r.components.push(quad()),r=>r.components.push({...structuredClone(c(r,'P1')),id:'P2'}),
  r=>{r.components=r.components.filter(c=>c.type!=='triangular-prism');},
  r=>{p(r,'P1').x3=0;},r=>{p(r,'P1').x3=.1;},r=>{p(r,'P1').x3=10001;},
  r=>{Object.assign(p(r,'M1'),{x:0,y:0});},r=>{Object.assign(p(r,'M1'),{x:10,y:10,orientationDeg:0});},
  r=>{p(r,'D1').x=5;},r=>{p(r,'S1').x=0;},r=>{p(r,'S1').y=0;},
  r=>{c(r,'S1').emission.mode='full-circle';},r=>{delete p(r,'P1').outsideIndex;},
  r=>{delete p(r,'M1').orientationDeg;},r=>{p(r,'P1').partialReflection='false';},
  r=>{r.components.push({id:'L',type:'ideal-lens',parameters:{x:80,focalLength:20,apertureHeight:10}});}] ){
  const r=request();mutate(r);const before=structuredClone(r);
  // Removing the region from a minimal request legitimately selects another
  // family; a saved v12 apparatus may not silently change family that way.
  if(!r.components.some(c=>c.type==='triangular-prism')){const d=make();d.physics.components=d.physics.components.filter(c=>c.type!=='triangular-prism');assert.throws(()=>validate(d));}
  else assert.throws(()=>make(r));assert.deepEqual(r,before);
 }
 const invalidQuad=make();invalidQuad.physics.components[1]=quad();invalidQuad.physics.components[1].parameters.x3=-5;assert.throws(()=>validate(invalidQuad));
});

test('old v8-v11 contracts and the existing qualified upgrade remain explicit and unchanged',async()=>{
 const d=make();for(const version of [4,5,6,7,8,9,10,11,13,'12']){
  const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=version;assert.throws(()=>validate(bad));
 }
 const old=read('scenes/triangular-prism.json');assert.throws(()=>reviseComponents(old,patch([{op:'add',lengthUnit:'mm',component:c(request(),'M1')}] )));
 const b=await bundle(read('scenes/finite-dielectric-composition.json'));
 await assert.rejects(()=>prepareQualifiedStructure(b,{...patch([{op:'add',lengthUnit:'mm',component:{...c(request(),'M1'),id:'M2'}}]),
  expectedSha256:b.sceneSha256,expectedIntegritySha256:b.integritySha256,upgradeToSchemaVersion:12}),e=>e.issues?.some(i=>i.code==='UNSUPPORTED_CONTRACT_UPGRADE'));
 // Retain the legacy error for a v10 model missing its mandatory region.
 const missing=structuredClone(b.scene);missing.physics.components=missing.physics.components.filter(c=>c.type!=='polygon-dielectric');
 assert.throws(()=>validate(missing),/Polygon scope/);
});

test('atomic v12 shape replacement preserves unchanged apparatus, retired identities and old readout targets',async()=>{
 const b=await bundle(make()),before=structuredClone(b);
 const out=await prepareQualifiedStructure(b,{...patch([{op:'remove',id:'P1'},{op:'add',lengthUnit:'mm',component:quad()}]),expectedSha256:b.sceneSha256});
 const saved=await parseQualifiedBundle(JSON.stringify(await child(out)));assert.deepEqual(b,before);assert.equal(saved.scene.schemaVersion,12);
 for(const id of ['S1','M1','D1'])assert.deepEqual(saved.scene.physics.components.find(c=>c.id===id),b.scene.physics.components.find(c=>c.id===id));
 assert.deepEqual(saved.qualification.origin,b.qualification.origin);assert.deepEqual(saved.qualification.interpretation,b.qualification.interpretation);
 const executed=run(saved.scene);assert.equal(executed.executionPassed,true);
 const values=(await evaluateObservables(saved.scene,[...saved.observables,{id:'new-glass',kind:'interface-interactions',componentId:'G1'}],executed)).results;
 assert.equal(values[0].status,'unavailable');assert.equal(values[0].value,null);assert.equal(values.at(-1).value,4);
 await assert.rejects(()=>prepareQualifiedStructure(saved,{...patch([{op:'remove',id:'G1'},{op:'add',lengthUnit:'mm',component:c(request(),'P1')}]),expectedSha256:saved.sceneSha256}),e=>e.issues?.some(i=>i.code==='RETIRED_COMPONENT_ID'));
});

test('stale, stopped, corner-ambiguous and incomplete prism runs never publish accepted native values',async()=>{
 for(const [edit,status] of [[d=>d.physics.components[1].parameters.partialReflection=true,'incomplete'],
  [d=>d.simulation.maxRayDepth=2,'incomplete'],[d=>d.simulation.processedRayLimit=1,'stopped'],
  [d=>d.physics.components.find(c=>c.id==='M1').parameters.x=(36-10/scalarReference().slope)/2,'failed']]){
  const d=make();edit(d);validate(d);const s=run(d);assert.equal(s.native.status,status);
  assert.equal(s.observations,null);assert.ok((await evaluateObservables(d,fixture.requests,s)).results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const d=make(),s=run(d),changed=reviseScene(d,{changes:[{id:'M1',section:'parameters',key:'y',value:100}]}).document;
 assert.ok((await evaluateObservables(changed,fixture.requests,s)).results.every(r=>r.status==='suppressed'));
 const image=(await evaluateObservables(d,[{id:'image',kind:'ideal-image',componentId:'S1'}],s)).results[0];assert.equal(image.status,'unavailable');
});

test('unchanged eight-interaction limit counts detector encounters for both complete and truncated compositions',async()=>{
 const r=request();r.components.push({id:'D2',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:60}});
 const eight=make(r),s=run(eight);assert.equal(eight.simulation.maxRayDepth,8);assert.equal(s.executionPassed,true);
 assert.equal(s.observations.detectorsById.D2.crossings,2);near(s.observations.detectorsById.D2.signedPower,0);
 p(r,'D1').y=0;p(r,'D1').length=60;const nine=make(r),incomplete=run(nine);assert.equal(incomplete.native.status,'incomplete');
 assert.ok((await evaluateObservables(nine,fixture.requests,incomplete)).results.every(r=>r.status==='suppressed'&&r.value===null));
});

test('units, vertex winding, input order and multiple sources retain native evidence without route attribution',()=>{
 const baseline=run(make());
 for(const unit of ['cm','m']){const r=request();r.lengthUnit=unit;const factor=unit==='cm'?10:1000;
  for(const c of r.components)for(const key of capabilities().lengthParameters)if(key in c.parameters)c.parameters[key]/=factor;
  r.components.reverse();const o=run(make(r));assert.equal(o.executionPassed,true);assert.equal(o.observations.interfacesById.P1.interactions,4);
  assert.equal(o.observations.detectorsById.D1.crossings,1);
 }
 const r=request(),g=p(r,'P1');[g.x2,g.x3]=[g.x3,g.x2];[g.y2,g.y3]=[g.y3,g.y2];
 const reversed=inspectNative(make(r));assert.equal(reversed.diagnostic.interfacesById.P1.interactions,4);
 const many=request();for(let i=2;i<=4;i++)many.components.push({id:'S'+i,type:'point-source',parameters:{x:-40,y:9+i,brightness:.5},emission:{mode:'single-ray',directionDeg:0}});
 const o=run(make(many));assert.equal(o.executionPassed,true);assert.equal(o.observations.interfacesById.P1.interactions,16);
 assert.equal(o.observations.reflectionsById.M1,4);assert.equal(o.observations.emissionsById.S4.emitted,1);
 assert.equal(baseline.observations.interfacesById.P1.interactions,4);
});

test('qualified prism sweeps retain their invalid sample and do not alter the source baseline',async()=>{
 const b=await bundle(make()),before=structuredClone(b);
 const sweep=await runParameterSweep(b,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:b.sceneSha256,
  parameter:{id:'M1',section:'parameters',key:'x',unit:'mm'},values:[60,100,5],observables:fixture.requests},{execute:d=>evaluateDocument(d,core)});
 assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');assert.deepEqual(b,before);
});
