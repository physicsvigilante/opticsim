import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities} from '../src/authoring.js';
import {validate} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {sceneHash} from '../src/qualified-utils.js';
import {snapshotNativeObservations,NATIVE_OBSERVATION_KEYS} from '../src/native-observations.js';
import {QualifiedUI} from '../src/qualified-ui.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/blocker-detector.json',import.meta.url)));
const base=()=>prepareScene(structuredClone(fixture.physical)).document;
function fullComposition(){
 const components=[];
 for(let i=0;i<4;i++)components.push({id:'S'+i,type:'point-source',parameters:{x:-600-i*10,y:4*i,brightness:.08},emission:{mode:'directional',directionDeg:0,angleDeg:20}});
 for(let i=0;i<4;i++)components.push({id:'L'+i,type:'ideal-lens',parameters:{x:-400+i*80,focalLength:150,apertureHeight:50}});
 for(let i=0;i<4;i++)components.push({id:'M'+i,type:'plane-mirror',parameters:{x:100+i*80,y:200,orientationDeg:90,length:20}});
 for(let i=0;i<2;i++)components.push({id:'B'+i,type:'line-blocker',parameters:{x:100+i*80,y:-200,orientationDeg:90,length:20}});
 for(let i=0;i<2;i++)components.push({id:'D'+i,type:'ray-detector',parameters:{x:500+i*80,y:0,orientationDeg:90,length:100}});
 return {lengthUnit:'mm',components};
}
test('authoring accepts the already-admitted 16-component general scene and still rejects over-counts',()=>{
 const input=fullComposition(),manual=base();manual.physics.components=structuredClone(input.components);
 // Establish that geometry/cardinality is already legal before testing authoring.
 validate(manual);assert.equal(input.components.length,16);
 const before=JSON.stringify(input),doc=prepareScene(input).document;
 assert.equal(doc.physics.components.length,16);assert.equal(JSON.stringify(input),before);
 assert.equal(capabilities().maxComponents,16);
 const over=structuredClone(input);over.components.push({id:'B3',type:'line-blocker',parameters:{x:400,y:-200,orientationDeg:90,length:20}});
 assert.throws(()=>prepareScene(over));
 // A shape with excess sources is not made valid simply by staying under 16.
 const tooMany=structuredClone(input);tooMany.components=tooMany.components.filter(c=>c.type!=='line-blocker');
 tooMany.components.push({id:'S4',type:'point-source',parameters:{x:-700,y:10,brightness:.08},emission:{mode:'full-circle'}});
 assert.throws(()=>prepareScene(tooMany));
});
test('asynchronous observation evaluation snapshots the exact requests and native evidence at invocation',async()=>{
 const doc=base(),execution=evaluateDocument(doc,core).summary;
 const requests=[{id:'abs',kind:'blocker-absorptions',componentId:'B1'}];
 const pending=evaluateObservables(doc,requests,execution);
 // A later revision updates reused caller state while the first digest awaits.
 doc.physics.components.find(c=>c.id==='B1').parameters.y=100;
 requests[0].id='later-request';execution.observations.blockersById.B1.absorptions=0;
 const answer=await pending;
 assert.equal(answer.results[0].id,'abs');assert.equal(answer.results[0].value,6);
 assert.notEqual(answer.canonicalSha256,await sceneHash(doc));
});
test('capability consumers cannot mutate the internal observation type registry',()=>{
 const published=observableCapabilities(),old=structuredClone(published.kinds);
 try{
  published.kinds['blocker-absorptions'].type='point-source';
  published.kinds['interface-interactions'].type.push('line-blocker');
  assert.equal(observableCapabilities().kinds['blocker-absorptions'].type,'line-blocker');
  assert.ok(!observableCapabilities().kinds['interface-interactions'].type.includes('line-blocker'));
 }finally{Object.assign(published.kinds,old);}
});
function fakeUI(t){
 const prior=globalThis.document,elements=new Map();
 const make=()=>({dataset:{},textContent:'',width:1000,height:500,disabled:false,setAttribute(){},before(){}});
 globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);},createElement:make};
 t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
 const session={document:base(),state:'completed',revision:1,data:{emissionsById:{S1:{emitted:6}},blockersById:{B1:{absorptions:6}},warnings:[]}};
 const ui=new QualifiedUI(session,()=>{});ui.requests=[{id:'rays',kind:'source-emissions',componentId:'S1'}];
 return {session,ui,elements};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){if(fn())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Async UI did not settle');}
test('old rejected refresh cannot overwrite newer successful results for the same scene revision',async t=>{
 const {ui,elements}=fakeUI(t),nativeDigest=crypto.subtle.digest;let rejectOld,calls=0;
 crypto.subtle.digest=function(...args){return calls++===0?new Promise((_,reject)=>{rejectOld=reject;}):nativeDigest.apply(this,args);};
 t.after(()=>{crypto.subtle.digest=nativeDigest;});
 ui.refresh();ui.refresh();await until(()=>!!elements.get('observable-results').dataset.results);
 const current=elements.get('observable-results').textContent;
 rejectOld(Error('obsolete render failed'));await tick();await tick();
 assert.equal(elements.get('observable-results').textContent,current);
 assert.equal(JSON.parse(elements.get('observable-results').dataset.results)[0].value,6);
});

test('CLI and qualified viewer share every bounded measurement channel, with independent copies',async t=>{
 const {session,ui,elements}=fakeUI(t);
 const native=evaluateDocument(session.document,core);
 session.data=native.report.native.diagnostics;
 ui.requests=structuredClone(fixture.requests);
 const copied=snapshotNativeObservations(session.data);
 assert.deepEqual(Object.keys(copied),NATIVE_OBSERVATION_KEYS);
 assert.deepEqual(capabilities().observations,[...NATIVE_OBSERVATION_KEYS]);
 assert.deepEqual(copied,native.summary.observations);
 copied.blockersById.B1.absorptions=123;
 assert.equal(session.data.blockersById.B1.absorptions,6);
 assert.equal(native.summary.observations.blockersById.B1.absorptions,6);
 ui.refresh();await until(()=>!!elements.get('observable-results').dataset.results);
 const expected=await evaluateObservables(session.document,ui.requests,native.summary);
 assert.deepEqual(JSON.parse(elements.get('observable-results').dataset.results),expected.results);
 session.state='incomplete';ui.refresh();
 assert.equal(elements.get('observable-results').dataset.results,undefined);
 assert.equal(elements.get('fit-results').disabled,true);
});
test('current refresh errors are shown, but an older error cannot replace invalid-revision suppression',async t=>{
 const {ui,session,elements}=fakeUI(t),digest=crypto.subtle.digest;
 let reject;crypto.subtle.digest=()=>new Promise((_,r)=>reject=r);
 t.after(()=>{crypto.subtle.digest=digest;});
 ui.refresh();reject(Error('current failure'));await tick();
 assert.match(elements.get('observable-results').textContent,/current failure/);
 ui.refresh();session.revision++;session.state='invalid';ui.refresh();
 reject(Error('old failed revision'));await tick();await tick();
 assert.match(elements.get('observable-results').textContent,/suppressed/);
 assert.equal(elements.get('observable-results').dataset.results,undefined);
});
test('a blocker cannot be removed implicitly to produce a lens or mirror ideal-image answer',async()=>{
 for(const optic of [
  {id:'L1',type:'ideal-lens',parameters:{x:-100,focalLength:50,apertureHeight:40}},
  {id:'M1',type:'plane-mirror',parameters:{x:200,y:0,orientationDeg:90,length:80}}
 ]){
  const request=structuredClone(fixture.physical);request.components.push(optic);
  const doc=prepareScene(request).document,original=JSON.stringify(doc),execution=evaluateDocument(doc,core).summary;
  assert.equal(execution.native.status,'completed');
  const answer=await evaluateObservables(doc,[{id:'image',kind:'ideal-image',componentId:'S1'}],execution);
  assert.equal(answer.results[0].status,'unavailable');assert.equal(answer.results[0].value,null);
  assert.equal(JSON.stringify(doc),original);
 }
});
test('real blocker callback is delegated exactly once and native result identity is retained',()=>{
 const doc=base(),{scene,idMap}=core.loadDocument(doc),object=scene.objs[idMap.get('B1')];
 const native=object.onRayIncident;let count=0,nativeResult;
 object.onRayIncident=function(...args){count++;nativeResult=native.apply(this,args);return nativeResult;};
 const meter=core.observeBlockerSet(doc,scene,idMap),ray={p1:{x:-10,y:0},p2:{x:10,y:0},brightness_s:.1,brightness_p:.1};
 const copy=structuredClone(ray),result=object.onRayIncident(ray,0,{x:0,y:0});
 assert.equal(count,1);assert.strictEqual(result,nativeResult);assert.equal(result.isAbsorbed,true);
 assert.deepEqual(ray,copy);assert.equal(meter.byId.B1.absorptions,1);
});
test('near-coincident native encounters remain incomplete and never become qualified blockage measurements',async()=>{
 const input=structuredClone(fixture.physical);input.components.find(c=>c.id==='D1').parameters.x=-1e-7;
 const doc=prepareScene(input).document,execution=evaluateDocument(doc,core).summary;
 assert.equal(execution.native.status,'incomplete');assert.ok(execution.native.undefinedBehavior>0);
 const answers=await evaluateObservables(doc,fixture.requests,execution);
 assert.ok(answers.results.every(r=>r.status==='suppressed'&&r.value===null));
});
test('native absorption conservation and clear-path detector parity hold across 36 rotated/unit/density scenes',()=>{
 let configurations=0;
 const angle=x=>((x+180)%360+360)%360-180;
 for(const rotation of [-75,0,45,150])for(const unit of ['mm','cm','m'])for(const rayDensity of [.05,.2,1]){
  const req=structuredClone(fixture.physical),factor={mm:1,cm:.1,m:.001}[unit],a=rotation*Math.PI/180;
  req.lengthUnit=unit;
  for(const c of req.components){const p=c.parameters,[x,y]=[p.x,p.y];
   p.x=(Math.cos(a)*x-Math.sin(a)*y)*factor;p.y=(Math.sin(a)*x+Math.cos(a)*y)*factor;
   if(p.length!==undefined)p.length*=factor;
   if(p.orientationDeg!==undefined)p.orientationDeg=angle(p.orientationDeg+rotation);
   if(c.emission)c.emission.directionDeg=angle(c.emission.directionDeg+rotation);
  }
  const doc=prepareScene(req).document;doc.simulation.rayDensity=rayDensity;
  const blocked=evaluateDocument(doc,core).summary;
  assert.equal(blocked.native.status,'completed');
  assert.equal(blocked.observations.blockersById.B1.absorptions,blocked.native.emitted);
  assert.equal(blocked.observations.detectorsById.D1.crossings,0);
  const clear=structuredClone(doc),p=clear.physics.components.find(c=>c.id==='B1').parameters;
  p.x-=100*Math.sin(a);p.y+=100*Math.cos(a);
  const away=evaluateDocument(clear,core).summary;
  const free=structuredClone(clear);free.physics.components=free.physics.components.filter(c=>c.id!=='B1');
  const reference=evaluateDocument(free,core).summary;
  assert.equal(away.native.status,'completed');assert.equal(reference.native.status,'completed');
  assert.equal(away.observations.blockersById.B1.absorptions,0);
  assert.equal(away.observations.detectorsById.D1.crossings,reference.observations.detectorsById.D1.crossings);
  assert.equal(away.native.emitted,reference.native.emitted);configurations++;
 }
 assert.equal(configurations,36);
});
