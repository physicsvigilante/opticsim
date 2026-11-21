import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const baseline=read('../examples/curved-entry-beam-v30.json');
const study=read('../evaluation/curved-entry-beam-v1/frozen.json');
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const store=mkdtempSync(join(root,'semicircular-intervals-native-'));
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,JSON.stringify({a,b,tol}));

for(const [i,c] of study.cases.entries())test('A14 full interval encloses native sample range '+c.name,()=>{
  const p=structuredClone(baseline.physical);
  Object.assign(p.components[0].parameters,{y:c.beamY,width:c.width});p.rayDensity=c.density;
  const doc=prepareScene(p).document;
  const launches=[];
  const observed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args),beam=loaded.scene.objs[loaded.idMap.get('B')];
    const start=beam.onSimulationStart;
    beam.onSimulationStart=function(...a){
      const result=start.apply(this,a);
      launches.push(...result.newRays.map(ray=>-ray.p1.y));return result;
    };
    return loaded;
  }};
  const {summary}=evaluateDocument(doc,observed,baseline.requests);
  assert.equal(summary.native.status,'completed');
  assert.equal(summary.observations.v30CurvedBeamVerified,true);
  const range=summary.observations.interfacesById.G.faces['face-flat'].sampledYRangeMm;
  assert.equal(range.count,launches.length);
  function atBase(y){
    const alpha=Math.asin(y/c.radius),beta=Math.asin(y/(1.5*c.radius));
    return y/(1.5*Math.cos(alpha-beta));
  }
  near(range.min,atBase(Math.min(...launches)),1e-6);
  near(range.max,atBase(Math.max(...launches)),1e-6);
  assert.ok(range.min>atBase(c.beamY-c.width/2)&&range.max<atBase(c.beamY+c.width/2));
  writeFileSync(join(store,'a14-'+i+'.json'),JSON.stringify({doc,summary,launches},null,2),{flag:'wx'});
});

for(const t of [-.9,-.7,0,.7,.9])test('A20 native first arc at signed flat coordinate '+t,()=>{
  const [b,g]=structuredClone(baseline.physical.components);
  Object.assign(b.parameters,{x:-40,y:100*t-40,directionDeg:45,width:10,brightness:.04});
  g.parameters.insideIndex=Math.SQRT2;
  const doc=prepareScene({lengthUnit:'mm',components:[b,g]}).document;
  doc.simulation.rayDensity=.1;
  assert.equal(doc.schemaVersion,21);
  const {summary}=evaluateDocument(doc,core,baseline.requests);
  writeFileSync(join(store,'a20-'+t+'.json'),JSON.stringify({doc,summary},null,2),{flag:'wx'});
  assert.equal(summary.native.status,'completed');assert.equal(summary.native.emitted,1);
  assert.deepEqual(summary.native.warnings,[]);
  const faces=summary.observations.interfacesById.G.faces;
  near(faces['face-flat'].first.pointMm.y,t*100,1e-7);
  const arc=faces['face-arc'].first;
  assert.equal(arc.from,'inside');
  near(Math.sin(arc.incidentAngleDeg*Math.PI/180),Math.abs(t)*Math.sqrt(3)/2,1e-8);
  assert.equal(arc.outcome,Math.abs(t)>Math.sqrt(2/3)?'total-internal-reflection':'transmission');
});
