import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {evidencePanelView,renderEvidencePanel} from '../src/evidence-panel.js';
import {QualifiedUI} from '../src/qualified-ui.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle} from '../src/qualification.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const source=JSON.parse(readFileSync(new URL('../scenes/single-lens-detector.json',import.meta.url)));
const requests=[{id:'emitted',kind:'source-emissions',componentId:'source-1'},
 {id:'crossings',kind:'detector-crossings',componentId:'detector-1'},
 {id:'power',kind:'detector-signed-power',componentId:'detector-1'},
 {id:'image',kind:'ideal-image',componentId:'source-1'},
 {id:'material',kind:'material-index',componentId:'lens-1'}];
const results=requests.map((r,i)=>({...r,status:i<3?'available':i===3?'conditional':'unavailable',
 method:i<3?'native-observation':i===3?'existing-analytical-model':null,
 value:i===0?500:i===1?46:i===2?-23:i===3?{x:150,y:-5}:null}));
function fixture(){
 const doc=structuredClone(source);
 const qualification=initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:{
 source:{caseId:'teaching-fixture',path:'scenes/single-lens-detector.json',sha256:'b'.repeat(64)},
 requestedResult:'Inspect native rays and supported readouts',stated:[],assumptions:[],unknowns:[]}});
 return {doc,qualification,requests:structuredClone(requests),results:structuredClone(results),state:'completed',phase:'ready'};
}
const view=patch=>evidencePanelView({...fixture(),...patch});
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function appendEdit(f,kind,changes){f.qualification.edits.push({kind,changes});}
const change=(path,before,after)=>({path,before,after});

test('readout summary distinguishes native, conditional and unavailable without calculating values',()=>{
 const x=view();
 assert.equal(x.summary,'3 native sampled readouts · 1 conditional prediction · 1 unavailable quantity');
 assert.match(x.resultLimits,/Unavailable: material \(material-index\)/);
 assert.match(x.resultLimits,/not native image detections/);
 assert.match(x.resultLimits,/not continuous irradiance/);
 assert.equal(x.state,'ready');
});
test('zero native results and negative relative power remain available readouts',()=>{
 const f=fixture();f.results[0].value=0;f.results[1].value=0;
 assert.equal(evidencePanelView(f).summary,view().summary);
 assert.equal(f.results[2].value,-23);
});
test('qualified native measurements retain their warning qualification in the summary',()=>{
 const f=fixture();f.results[1].status='qualified';f.results[1].warnings=['native warning'];
 const x=evidencePanelView(f);
 assert.match(x.summary,/3 native sampled readouts/);
 assert.match(x.resultLimits,/1 native readout qualified by warnings/);
});
test('invalid, incomplete, stopped and running states do not count old completed results',()=>{
 for(const state of ['invalid','incomplete','stopped','running','failed']){
  const x=view({state});assert.equal(x.state,'suppressed');
  assert.match(x.summary,/Current readouts suppressed/);assert.doesNotMatch(x.summary,/3 native/);
 }
 assert.match(view({state:'invalid'}).provenance,/last accepted scene/);
});
test('no-answer scene and no accepted scene have different truthful states',()=>{
 assert.equal(view({requests:[],results:[]}).summary,'No requested readouts — native scene only.');
 assert.equal(view({doc:null,requests:[],results:[]}).state,'suppressed');
});
test('checking and current errors never reuse successful counts',()=>{
 assert.equal(view({phase:'checking'}).state,'waiting');
 assert.match(view({phase:'error'}).summary,/evaluation failed/);
 assert.equal(view({results:results.slice(0,2)}).state,'waiting');
 assert.doesNotMatch(view({phase:'checking'}).summary,/3 native/);
});
test('suppressed and unknown individual statuses are not silently counted as accepted',()=>{
 const f=fixture();f.results[0].status='suppressed';f.results[1].status='unexpected';
 const x=evidencePanelView(f);
 assert.match(x.summary,/1 native sampled readout/);
 assert.match(x.summary,/1 suppressed readout/);assert.match(x.summary,/1 other result state/);
});
test('source reference and exact source hash are visible but never certified',()=>{
 const x=view();assert.match(x.source,/teaching-fixture.*scenes\/single-lens-detector.json/);
 assert.equal(x.sourceHash,'Source SHA-256: '+'b'.repeat(64));
 assert.match(x.provenance,/author-provided, not independently verified/);
 assert.match(view({qualification:null}).source,/unknown/);
 assert.match(view({qualification:null}).physical,/no qualified history/);
 const f=fixture();delete f.qualification.interpretation.source;
 assert.match(evidencePanelView(f).source,/not supplied/);
});
test('latest physical edit remains discoverable after numerical and presentation edits',()=>{
 const f=fixture();f.doc.physics.components[1].parameters.focalLength=150;
 appendEdit(f,'physics',[change('$.physics.components[1].parameters.focalLength',100,150)]);
 appendEdit(f,'numerics',[change('$.simulation.rayDensity',1,0.25)]);
 appendEdit(f,'presentation',[change('$.presentation.view.zoom',1,0.6)]);
 const x=evidencePanelView(f);
 assert.equal(x.physical,'Latest physical edit (#1): lens-1.focalLength: 100 → 150 mm.');
 assert.equal(x.numerical,'Latest numerical edit (#2): $.simulation.rayDensity: 1 → 0.25.');
 assert.doesNotMatch(x.physical,/zoom/);
});
test('mixed edits show both physical and numerical fields even if the saved category is physics',()=>{
 const f=fixture();appendEdit(f,'physics',[
  change('$.physics.components[1].parameters.focalLength',100,150),
  change('$.simulation.rayDensity',1,0.25)]);
 const x=evidencePanelView(f);assert.match(x.physical,/100 → 150 mm/);assert.match(x.numerical,/1 → 0.25/);
});
test('historical array indices are not relabelled with a wrong component ID after structural changes',()=>{
 const f=fixture();appendEdit(f,'physics',[change('$.physics.components[1].parameters.focalLength',100,150)]);
 appendEdit(f,'physics',[change('$.physics.components[1].id','lens-1','replacement')]);
 // The latest selected event below is a numerical edit with a component change
 // in its retained records; inspect the old field together with the ID edit.
 f.qualification.edits[1].changes.push(change('$.physics.components[1].parameters.focalLength',150,160));
 f.doc.physics.components[1].id='replacement';
 const x=evidencePanelView(f);
 assert.match(x.physical,/\$\.physics\.components\[1\]\.parameters\.focalLength: 150 → 160 mm/);
 assert.doesNotMatch(x.physical,/replacement\.focalLength/);
});
test('long multi-field histories are bounded and explicitly point to retained package details',()=>{
 const f=fixture();appendEdit(f,'physics',Array.from({length:6},(_,i)=>
  change('$.physics.components[1].parameters.focalLength',i,i+1)));
 assert.match(evidencePanelView(f).physical,/2 more changes in the qualified package/);
});
test('presentation reads do not mutate the scene, history, requested quantities or result bytes',()=>{
 const f=fixture(),before=JSON.stringify(f);freeze(f);
 const x=evidencePanelView(f);assert.equal(x.state,'ready');assert.equal(JSON.stringify(f),before);
});
test('imported source and history text are written only as textContent, never HTML',()=>{
 const f=fixture();f.qualification.interpretation.source.path='<img src=x onerror=alert(1)>';
 const nodes=new Map();const dom={getElementById(id){if(!nodes.has(id))nodes.set(id,{
  dataset:{},textContent:'',set innerHTML(_){throw Error('HTML is forbidden');}});return nodes.get(id);}};
 renderEvidencePanel(dom,evidencePanelView(f));
 assert.match(nodes.get('evidence-source').textContent,/<img src=x onerror=alert\(1\)>/);
 assert.equal(nodes.get('evidence-summary').dataset.state,'ready');
});
function fakeUI(t){
 const old=globalThis.document,nodes=new Map();
 const node=()=>({dataset:{},textContent:'',width:1000,height:500,disabled:false,setAttribute(){},before(){}});
 globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 t.after(()=>{if(old===undefined)delete globalThis.document;else globalThis.document=old;});
 const f=fixture(),native=evaluateDocument(f.doc,core);
 const session={document:f.doc,state:'completed',revision:1,data:native.report.native.diagnostics};
 const ui=new QualifiedUI(session,()=>{});ui.qualification=f.qualification;ui.requests=f.requests;
 return {ui,session,nodes};
}
const tick=()=>new Promise(ok=>setImmediate(ok));
async function settled(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(ok=>setTimeout(ok,5));}throw Error('UI did not settle');}
test('actual qualified refresh publishes summary only after current native evidence is evaluated',async t=>{
 const {ui,session,nodes}=fakeUI(t),before=JSON.stringify([session.document,session.data,ui.qualification,ui.requests]);
 ui.refresh();assert.equal(nodes.get('evidence-summary').dataset.state,'waiting');
 await settled(()=>nodes.get('evidence-summary').dataset.state==='ready');
 assert.equal(nodes.get('evidence-summary').textContent,view().summary);
 assert.equal(JSON.stringify([session.document,session.data,ui.qualification,ui.requests]),before);
 session.state='incomplete';ui.refresh();assert.equal(nodes.get('evidence-summary').dataset.state,'suppressed');
 assert.equal(nodes.get('observable-results').dataset.results,undefined);
});
test('a late successful result cannot overwrite an invalid revision summary',async t=>{
 const {ui,session,nodes}=fakeUI(t),original=crypto.subtle.digest;let resume;
 crypto.subtle.digest=(...args)=>new Promise(ok=>{resume=()=>original.apply(crypto.subtle,args).then(ok);});
 t.after(()=>{crypto.subtle.digest=original;});
 ui.refresh();session.revision++;session.state='invalid';ui.refresh();
 const snapshot=nodes.get('evidence-summary').textContent;
 crypto.subtle.digest=original;await resume();await tick();await tick();
 assert.equal(nodes.get('evidence-summary').textContent,snapshot);
 assert.equal(nodes.get('evidence-summary').dataset.state,'suppressed');
});
test('current result errors are displayed but obsolete rejections cannot replace a newer summary',async t=>{
 const {ui,nodes}=fakeUI(t),original=crypto.subtle.digest;let reject;
 crypto.subtle.digest=()=>new Promise((_,bad)=>{reject=bad;});
 t.after(()=>{crypto.subtle.digest=original;});
 ui.refresh();reject(Error('current failure'));await tick();
 assert.equal(nodes.get('evidence-summary').dataset.state,'error');
 ui.refresh();const obsolete=reject;crypto.subtle.digest=original;ui.refresh();
 await settled(()=>nodes.get('evidence-summary').dataset.state==='ready');
 const current=nodes.get('evidence-summary').textContent;obsolete(Error('obsolete failure'));await tick();
 assert.equal(nodes.get('evidence-summary').textContent,current);
});
test('a raw scene import clears earlier source/history rather than inheriting its qualification',async t=>{
 const {ui,session,nodes}=fakeUI(t);
 ui.refresh();await settled(()=>nodes.get('evidence-summary').dataset.state==='ready');
 const imported=await ui.read(JSON.stringify(source));
 session.document=imported.document;session.revision++;
 ui.commit(ui.prepare(imported.document,imported));
 assert.equal(ui.qualification,null);assert.equal(ui.requests.length,0);
 assert.match(nodes.get('evidence-source').textContent,/unknown/);
 assert.match(nodes.get('evidence-physical-change').textContent,/no qualified history/);
 assert.match(nodes.get('evidence-summary').textContent,/No requested readouts/);
});
