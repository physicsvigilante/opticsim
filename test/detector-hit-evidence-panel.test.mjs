// Presentation regression discovered in the first published Chrome screenshots.
// These synthetic result objects do not execute or certify native ray physics.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evidencePanelView} from '../src/evidence-panel.js';
const doc=JSON.parse(readFileSync(new URL('./fixtures/detector-hit-plate.json',import.meta.url)));
const hit=(status='qualified',value=[])=>({id:'hits',kind:'detector-hit-events',
 method:'native-hit-event-observation',status,value});
const panel=(results,state='completed')=>evidencePanelView({doc,state,phase:'ready',
 requests:results.map(({id,kind})=>({id,kind})),results});

test('evidence summary classifies hit-event lists and legacy counts as two native readouts',()=>{
 for(const status of ['available','qualified']){
  const results=[hit(status,[{pointMm:{x:5,y:50},incomingUnit:{x:1,y:0},distanceFromP1Mm:230}]),
   {id:'count',kind:'detector-crossings',method:'native-observation',status,value:1}];
  const before=structuredClone(results),view=panel(results);
  assert.match(view.summary,/^2 native sampled readouts/);
  assert.doesNotMatch(view.summary,/other result state/);
  if(status==='qualified')assert.match(view.resultLimits,/2 native readouts qualified by warnings/);
  else assert.doesNotMatch(view.resultLimits,/qualified by warnings/);
  assert.deepEqual(results,before);
 }
});

test('an accepted empty native hit list is a readout rather than missing evidence',()=>{
 const view=panel([hit('available',[])]);
 assert.equal(view.summary,'1 native sampled readout · 0 conditional predictions · 0 unavailable quantities');
});

test('unavailable, suppressed, unknown-method and incomplete results are not promoted to native evidence',()=>{
 const results=[hit('unavailable',null),{...hit('suppressed',null),id:'stale'},
  {...hit('available',[]),id:'unknown',method:'unrecognized-method'}];
 const view=panel(results);
 assert.equal(view.summary,'0 native sampled readouts · 0 conditional predictions · 1 unavailable quantity · 1 suppressed readout · 1 other result state');
 assert.match(view.resultLimits,/Unavailable: hits \(detector-hit-events\)/);
 for(const state of ['running','incomplete','failed','stopped','invalid']){
  const blocked=panel([hit('available',[])],state);
  assert.equal(blocked.state,'suppressed');
  assert.match(blocked.summary,/Current readouts suppressed/);
 }
});
