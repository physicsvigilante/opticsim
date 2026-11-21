import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {qualifyRunnerSummary} from '../src/native-observations.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=file=>JSON.parse(readFileSync(new URL(file,import.meta.url)));
const fixture=read('../examples/curved-entry-beam-v30.json');
const study=read('../evaluation/curved-entry-beam-v1/frozen.json');

for(const [i,c] of study.cases.entries())test('public curved-entry Beam '+c.name, async()=>{
  const p=structuredClone(fixture.physical);
  const b=p.components[0].parameters,g=p.components[1].parameters;
  Object.assign(b,{x:330,y:c.beamY-80,width:c.width});
  Object.assign(g,{x:130,y:-80,radius:c.radius});
  p.rayDensity=c.density;
  const doc=prepareScene(p).document;
  assert.deepEqual(parseSave(serializeSave(doc)),doc);
  assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['Beam','Glass']);
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  assert.equal(summary.observations?.v30CurvedBeamVerified,true);
  const {results}=await evaluateObservables(doc,fixture.requests,summary);
  const range=results[0].value['face-flat'].sampledYRangeMm;
  assert.equal(range.count,c.density*c.width);
  const extrema=[[-32.145125913,32.145125913],[-33.023013661,33.023013661],[1.666724564,25.218444346]][i];
  assert.ok(Math.abs(range.min+80-extrema[0])<1e-6 && Math.abs(range.max+80-extrema[1])<1e-6);
});

test('v30 excludes ambiguous samples, extra optics, unsafe geometry and Fresnel branches',()=>{
  for(const edit of [
    p=>delete p.model,p=>p.components[0].parameters.directionDeg=0,
    p=>p.components.push({...p.components[0],id:'B2'}),p=>p.components[1].parameters.partialReflection=true,
    p=>p.components[1].parameters.insideIndex=1.61,p=>p.components[1].parameters.insideIndex=1,
    p=>p.components[0].parameters.x=100.99,p=>p.components[0].parameters.y=.001,
    p=>p.rayDensity=.205,p=>p.components[0].parameters.brightness=.21,
    p=>p.components[1].parameters.radius=1001,p=>p.components[0].parameters.width=0
  ]){
    const p=structuredClone(fixture.physical);edit(p);assert.throws(()=>prepareScene(p));
  }
});

test('stopped or unverified runs withhold curved-entry measurements',async()=>{
  const doc=prepareScene(fixture.physical).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v30CurvedBeamVerified;
  assert.equal(qualifyRunnerSummary(doc,summary).observations,null);
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('G')].onRayIncident=()=>({isAbsorbed:true});
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  doc.simulation.processedRayLimit=1;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});
