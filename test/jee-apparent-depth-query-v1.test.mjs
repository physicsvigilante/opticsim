import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {analyzeApparentDepth,apparentDepthCapabilities,
  APPARENT_DEPTH_QUERY_FORMAT} from '../src/planar-apparent-depth-query.js';
import {runApparentDepthEvidence} from '../scripts/planar-apparent-depth-query.mjs';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const base=()=>({format:APPARENT_DEPTH_QUERY_FORMAT,lengthUnit:'mm',
  source:{x:-60,y:0},
  interface:{x:0,y:0,normalDeg:0,sourceIndex:1.5,observerIndex:1},
  observation:{kind:'finite-incidence-angle',incidentAngleDeg:5}});
const near=(x,y,tol=1e-7)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&
  Math.abs(x-y)<=tol,x+' != '+y);
const coord=(a,b,tol=1e-7)=>{near(a.x,b.x,tol);near(a.y,b.y,tol);};
const solve=analyzeApparentDepth;
const out=()=>resolve('test-artifacts/llm-authoring/apparent-depth-typed-'+randomUUID());
const requests=[
  {id:'event',kind:'interface-first-event',componentId:'I1'},
  {id:'hits',kind:'detector-hit-events',componentId:'D1'},
  {id:'crossings',kind:'detector-crossings',componentId:'D1'},
  {id:'emitted',kind:'source-emissions',componentId:'S1'}
];
const nativeInput=angle=>({lengthUnit:'mm',title:'Full explicit synthetic native verification only',
  components:[{id:'S1',type:'point-source',parameters:{x:-60,y:0,brightness:1},
      emission:{mode:'single-ray',directionDeg:angle}},
    {id:'I1',type:'planar-interface',parameters:{x:0,y:0,normalDeg:0,
      negativeIndex:1.5,positiveIndex:1,partialReflection:false}},
    {id:'D1',type:'ray-detector',parameters:{x:100,y:0,length:400,orientationDeg:90}}]
});
const rawQuery=x=>Buffer.from(JSON.stringify(x,null,2)+'\n','utf8');
test('typed finite-angle apparent depth follows exact Snell axis-intercept, not universal paraxial image',()=>{
 const expected=[[2,39.96950186975325],[5,39.80818342387525],
   [12,38.85407850125951],[25,34.13377119352624],[30,30.55050463303894]];
 for(const [angle,depth] of expected){
  const q=base(),before=structuredClone(q);q.observation.incidentAngleDeg=angle;
  const result=solve(q);
  assert.equal(result.format,'opticsim-planar-apparent-depth-result-v1');
  assert.equal(result.status,'conditional');
  assert.equal(result.resultKind,'conditional-axis-intercept');
  assert.equal(result.method,'analytical-snells-law-conditional-axis-intercept');
  assert.equal(result.native.status,'not-run');
  assert.equal(result.native.nativeImageDetected,false);
  near(result.value.apparentDepthMm,depth,1e-8);
  near(result.value.apparentPointMm.x,-depth);
  near(result.value.apparentPointMm.y,0);
  near(result.value.paraxialLimitMm,40);
  assert.equal(result.value.nativeImageDetected,false);
  assert.equal(result.value.incidentAngleDeg,angle);
  assert.match(result.qualification,/not an optical image observation/);
  if(angle===5)assert.deepEqual(before,base());
 }
});
test('positive/negative incidence symmetry, equal indices and denser observer medium are distinct',()=>{
 const plus=solve(base()),minus=base();minus.observation.incidentAngleDeg=-5;
 const other=solve(minus);
 near(plus.value.apparentDepthMm,other.value.apparentDepthMm);
 near(plus.value.interfaceCrossingMm.y,-other.value.interfaceCrossingMm.y);
 near(plus.value.refractedAngleDeg,-other.value.refractedAngleDeg);
 const equal=base();equal.interface.sourceIndex=1;equal.interface.observerIndex=1;
 near(solve(equal).value.apparentDepthMm,60);
 const reverse=base();reverse.interface.sourceIndex=1;reverse.interface.observerIndex=1.5;
 near(solve(reverse).value.apparentDepthMm,90.19115365768965,1e-7);
});
test('translation and rotation are physical coordinate-frame invariants',()=>{
 const q=base(),reference=solve(q),translated=structuredClone(q);
 translated.source.x+=25;translated.source.y-=70;
 translated.interface.x+=25;translated.interface.y-=70;
 const tr=solve(translated);
 near(reference.value.apparentDepthMm,tr.value.apparentDepthMm);
 coord(tr.value.apparentPointMm,{x:reference.value.apparentPointMm.x+25,
   y:reference.value.apparentPointMm.y-70});
 coord(tr.value.interfaceCrossingMm,{x:reference.value.interfaceCrossingMm.x+25,
   y:reference.value.interfaceCrossingMm.y-70});
 const turned=structuredClone(q);
 const rotate=p=>({x:-p.y,y:p.x});
 turned.source=rotate(q.source);
 Object.assign(turned.interface,rotate({x:q.interface.x,y:q.interface.y}));
 turned.interface.normalDeg=90;
 const rot=solve(turned);
 near(reference.value.apparentDepthMm,rot.value.apparentDepthMm);
 coord(rot.value.apparentPointMm,rotate(reference.value.apparentPointMm));
 coord(rot.value.interfaceCrossingMm,rotate(reference.value.interfaceCrossingMm));
});
test('mm/cm/m units yield equivalent geometry and no hidden native scene',()=>{
 const q=base(),ref=solve(q);
 for(const [unit,divisor] of [['cm',10],['m',1000]]){
  const c=structuredClone(q);c.lengthUnit=unit;
  for(const p of [c.source,c.interface]){p.x/=divisor;p.y/=divisor;}
  const r=solve(c);
  coord(r.value.apparentPointMm,ref.value.apparentPointMm);
  coord(r.value.interfaceCrossingMm,ref.value.interfaceCrossingMm);
  assert.equal(r.native.status,'not-run');
 }
});
test('paraxial limit is deliberately requested, never inferred from an on-axis one-ray hit',()=>{
 const q=base();q.observation.incidentAngleDeg=0;
 const axial=solve(q);
 assert.equal(axial.status,'not-identifiable');assert.equal(axial.value,null);
 assert.equal(axial.reasonCode,'AXIAL_SINGLE_RAY');
 const nearAxis=structuredClone(q);nearAxis.observation.incidentAngleDeg=1e-8;
 const r=solve(nearAxis);assert.equal(r.status,'numerically-unstable');
 assert.equal(r.value,null);
 q.observation={kind:'paraxial-limit'};
 const lim=solve(q);
 assert.equal(lim.status,'conditional');assert.equal(lim.resultKind,'paraxial-limit');
 assert.equal(lim.method,'paraxial-snells-law-limit');
 near(lim.value.apparentDepthMm,40);
 near(lim.value.apparentPointMm.x,-40);
 assert.equal(lim.native.nativeImageDetected,false);
 const contradictory=structuredClone(q);contradictory.observation.incidentAngleDeg=0;
 assert.throws(()=>solve(contradictory),/must not disguise/);
});
test('critical boundary, genuine TIR and stable subcritical are distinct typed outcomes',()=>{
 const critical=Math.asin(1/1.5)*180/Math.PI,q=base();
 q.observation.incidentAngleDeg=50;
 const tir=solve(q);assert.equal(tir.status,'TIR-no-transmission');
 assert.equal(tir.reasonCode,'TOTAL_INTERNAL_REFLECTION');assert.equal(tir.value,null);
 for(const shift of [-1e-11,0,1e-11]){
  q.observation.incidentAngleDeg=critical+shift;
  const c=solve(q);assert.equal(c.status,'numerically-unstable');
  assert.equal(c.reasonCode,'NEAR_CRITICAL_NUMERIC');assert.equal(c.value,null);
 }
 q.observation.incidentAngleDeg=critical-1e-5;
 const below=solve(q);assert.equal(below.status,'conditional');
 assert.ok(below.value.refractedAngleDeg<90);
 q.observation.incidentAngleDeg=critical+1e-5;
 assert.equal(solve(q).status,'TIR-no-transmission');
 const grazing=base();grazing.interface.sourceIndex=1;grazing.interface.observerIndex=1;
 grazing.observation.incidentAngleDeg=89.99999999;
 assert.equal(solve(grazing).status,'numerically-unstable');
});
test('required explicit geometry, normal, indices and strict closed schema refuse ambiguity',()=>{
 const variants=[
  q=>{delete q.source.x;},
  q=>{delete q.interface.sourceIndex;},
  q=>{q.interface.observerIndex=null;},
  q=>{q.interface.sourceIndex=0.5;},
  q=>{q.interface.normalDeg=181;},
  q=>{q.source.x=50;},
  q=>{q.source.x=-0.009;},
  q=>{q.source.x=-10001;},
  q=>{q.interface.normalDeg='0';},
  q=>{q.lengthUnit='parsecs';},
  q=>{q.observation.kind='observer-reconstruction';},
  q=>{delete q.observation.incidentAngleDeg;},
  q=>{q.observation.incidentAngleDeg=90;},
  q=>{q.observation.incidentAngleDeg=Infinity;},
  q=>{q.observation.code='eval(Math.sin(5))';},
  q=>{q.observer={x:100,y:0};},
  q=>{q.format='other';}
 ];
 for(const mutate of variants){const q=base();mutate(q);assert.throws(()=>solve(q));}
 const valid=base();valid.source.x=-0.01;
 assert.equal(solve(valid).status,'conditional');
});
test('native single-ray evidence independently verifies angular and detector hit, not native virtual image',async()=>{
 for(const angle of [5,-5,30]){
  const q=base();q.observation.incidentAngleDeg=angle;
  const computed=solve(q);
  const d=prepareScene(nativeInput(angle)).document;
  assert.equal(d.schemaVersion,5);
  const native=evaluateDocument(d,core,requests).summary;
  assert.equal(native.native.status,'completed');
  const summary=(await evaluateObservables(d,requests,native));
  assert.equal(summary.canonicalSha256,native.canonicalSha256);
  const by=Object.fromEntries(summary.results.map(x=>[x.id,x]));
  assert.equal(by.emitted.value,1);
  assert.equal(by.crossings.value,1);
  assert.equal(by.event.method,'native-observation');
  assert.equal(by.hits.method,'native-hit-event-observation');
  assert.equal(by.hits.status,'qualified');
  assert.ok(by.hits.warnings.some(x=>/omits Fresnel/.test(x)));
  assert.equal(native.observations.detectorHitEventsById.D1.observedCount,1);
  assert.equal(by.hits.value.length,1);
  const hit=by.hits.value[0],event=by.event.value;
  assert.equal(event.outcome,'transmission');
  const transmitted=event.branches.filter(x=>x.kind==='transmitted');
  assert.equal(transmitted.length,1);
  near(hit.incomingUnit.x,transmitted[0].direction.x,1e-8);
  near(hit.incomingUnit.y,transmitted[0].direction.y,1e-8);
  near(event.incidentAngleDeg,Math.abs(angle),1e-6);
  near(event.transmittedAngleDeg,Math.abs(computed.value.refractedAngleDeg),1e-6);
  near(hit.pointMm.x,100);
  const expectedY=computed.value.interfaceCrossingMm.y+
    (100-computed.value.interfaceCrossingMm.x)*
     hit.incomingUnit.y/hit.incomingUnit.x;
  near(hit.pointMm.y,expectedY,1e-6);
  // This measured-line extension is used ONLY to check the analytic result:
  const virtualX=hit.pointMm.x-hit.pointMm.y*
    hit.incomingUnit.x/hit.incomingUnit.y;
  near(virtualX,computed.value.apparentPointMm.x,1e-5);
  assert.equal(computed.native.status,'not-run');
 }
});
test('stale and incomplete native measurements do not become evidence of apparent position',async()=>{
 const d=prepareScene(nativeInput(5)).document;
 const old=evaluateDocument(d,core,requests).summary;
 const stale=structuredClone(d);
 stale.physics.components.find(c=>c.type==='point-source').emission.directionDeg=12;
 const staleResult=(await evaluateObservables(stale,requests,old)).results;
 assert.ok(staleResult.every(x=>x.status==='suppressed'&&x.value===null));
 const shallow=structuredClone(d);shallow.simulation.maxRayDepth=0;
 const incomplete=evaluateDocument(shallow,core,requests).summary;
 assert.equal(incomplete.native.status,'incomplete');
 assert.equal(incomplete.observations,null);
 const hidden=(await evaluateObservables(shallow,requests,incomplete)).results;
 assert.ok(hidden.every(x=>x.status==='suppressed'&&x.value===null));
});
test('CLI retains original bytes, SHA-256 and refusals without inventing a native run',()=>{
 const q=base(),raw=rawQuery(q),dir=out();
 const r=runApparentDepthEvidence({queryBytes:raw,outputPath:dir});
 assert.equal(r.status,'conditional');assert.equal(r.exitCode,0);
 assert.equal(r.report.native.status,'not-run');
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),raw);
 const sha=createHash('sha256').update(raw).digest('hex');
 assert.equal(r.report.originalInputSha256,sha);
 const a=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(a.originalInputSha256,sha);
 assert.equal(a.results.value.nativeImageDetected,false);
 assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
 assert.throws(()=>runApparentDepthEvidence({queryBytes:raw,outputPath:dir}),/exists|already/);
 const invalid=Buffer.from('{"format": }'),invalidDir=out();
 const rejected=runApparentDepthEvidence({queryBytes:invalid,outputPath:invalidDir});
 assert.equal(rejected.status,'rejected');assert.equal(rejected.exitCode,1);
 assert.equal(rejected.report.native.status,'not-run');
 assert.deepEqual(readFileSync(resolve(invalidDir,'input.json')),invalid);
 assert.equal(existsSync(resolve(invalidDir,'analytical-result.json')),false);
 const cap=JSON.parse(execFileSync(process.execPath,
  [new URL('../scripts/planar-apparent-depth-query.mjs',import.meta.url).pathname,'capabilities'],{encoding:'utf8'}));
 assert.equal(cap.format,APPARENT_DEPTH_QUERY_FORMAT);
 assert.deepEqual(cap.statuses,apparentDepthCapabilities().statuses);
});
