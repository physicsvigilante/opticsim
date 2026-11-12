import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {QualifiedUI} from '../src/qualified-ui.js';
import {canonicalJSON} from '../src/qualified-utils.js';
const demo=JSON.parse(readFileSync(new URL('../evaluation/supported-demos-v1/first-attempt.json',import.meta.url))).cases[0];
function fixture(t){
  const original=globalThis.document,elements=new Map();
  const make=()=>({dataset:{},textContent:'',width:1000,height:500,disabled:false,setAttribute(){},before(){}});
  globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);},createElement:make};
  t.after(()=>{globalThis.document=original;});
  const session={document:prepareScene(demo.request).document,state:'completed',revision:1};
  const ui=new QualifiedUI(session,()=>{});
  ui.fitState={document:canonicalJSON(session.document),width:1000,height:500,note:'Current fit explanation'};
  return {session,ui,elements};
}
test('a rerun of the identical scene and viewport does not erase its fit explanation',t=>{
  const {session,ui,elements}=fixture(t);
  ui.refresh();assert.equal(elements.get('fit-note').textContent,'Current fit explanation');
  session.revision++;session.state='running';ui.refresh();
  assert.equal(elements.get('fit-note').textContent,'Current fit explanation');
  assert.equal(elements.get('fit-results').disabled,true);
  session.state='completed';ui.refresh();
  assert.equal(elements.get('fit-note').textContent,'Current fit explanation');
});
test('changed physics, invalid edits and changed viewport invalidate the fit explanation',t=>{
  const {session,ui,elements}=fixture(t);
  ui.refresh();session.document.physics.components[1].parameters.focalLength=180;
  ui.refresh();assert.equal(ui.fitState,null);assert.equal(elements.get('fit-note').textContent,'');
  ui.fitState={document:canonicalJSON(session.document),width:1000,height:500,note:'old'};
  elements.get('light').width=900;ui.refresh();assert.equal(ui.fitState,null);
  ui.fitState={document:canonicalJSON(session.document),width:900,height:500,note:'old'};
  session.state='invalid';ui.refresh();assert.equal(ui.fitState,null);assert.equal(elements.get('fit-results').disabled,true);
});
