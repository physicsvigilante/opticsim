// Test-only qualification of separately declared apparatuses. Never called by
// the public reduced-facts service; never supplies native outgoing rays.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {analyzePrismAngleQuery,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {prismNativeFixture,inspectPrismNative,verifyDirectPrismTrace} from '../test/helpers/prism-native-inspection.mjs';
import {prismVectorReference} from '../test/helpers/prism-vector-reference.mjs';
import {evaluateDocument} from './author-scene.mjs';import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const out=resolve('test-artifacts/llm-authoring/prism-native-facts-v1');mkdirSync(out);
const f=(A,i,n,n0)=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',apexAngleDeg:A,incidenceAngleDeg:i,insideIndex:n,outsideIndex:n0});
const q=kind=>({format:PRISM_QUERY_FORMAT,kind}),forward=facts=>analyzePrismAngleQuery(facts,q('prism-transmission-angles'));
const rows=[],record=(id,data)=>{writeFileSync(resolve(out,id+'.json'),JSON.stringify(data,null,2)+'\n',{flag:'wx'});rows.push({id,status:data.native?.status??data.execution?.native?.status,claim:data.claim});};
for(const [family,facts]of [['acute-air',f(60,50,1.5,1)],['immersed',f(35,25,1.8,1.33)]])for(const rotation of [0,37,-90])for(const scale of [.1,1,10]){
 const predicted=forward(facts),scene=prismNativeFixture(facts,{rotation,scale}),native=inspectPrismNative(scene);
 assert.equal(predicted.status,'conditional');verifyDirectPrismTrace(scene,native,predicted.value);
 record(family+'-'+rotation+'-'+scale,{claim:'Direct branch independently checked against actual native angles and continuity.',facts,transformation:{rotation,scale},scene,predicted,native});
}
const ambiguity={...f(40,30,1.5,1.5),deviationDeg:5,deviationConvention:'magnitude'};delete ambiguity.insideIndex;
const inverse=analyzePrismAngleQuery(ambiguity,q('prism-index-from-deviation'));assert.equal(inverse.status,'multiple-solutions');
for(const [i,c]of inverse.candidates.entries()){
 const scene=prismNativeFixture({...ambiguity,insideIndex:c.insideIndex}),native=inspectPrismNative(scene);verifyDirectPrismTrace(scene,native,c);
 record('magnitude-candidate-'+(i+1),{claim:'Distinct explicitly instantiated native material supports one ambiguous sign branch.',facts:ambiguity,inverse,candidate:c,scene,native});
}
for(const [id,facts]of [['entry-tir',f(60,60,1,1.5)],['exit-tir',f(60,0,1.5,1)]]){
 const predicted=forward(facts),scene=prismNativeFixture(facts),native=inspectPrismNative(scene);
 assert.equal(predicted.reasonCode,'TOTAL_INTERNAL_REFLECTION');assert.ok(native.diagnostic.interfacesById.P.totalInternalReflections>0);
 record(id,{claim:'TIR is observed natively; the requested direct transmitted branch remains unavailable.',facts,scene,predicted,native});
}
{
 const facts=f(60,40,1.5,1),predicted=forward(facts),scene=prismNativeFixture(facts,{entryDepth:190}),native=inspectPrismNative(scene);
 assert.ok(native.diagnostic.interfacesById.P.faces['face-23'].interactions>0);assert.throws(()=>verifyDirectPrismTrace(scene,native,predicted.value));
 record('different-finite-face',{claim:'Counterexample: same angular facts do not establish actual finite-face reach. Not a direct-branch agreement.',facts,scene,predicted,native});
}
for(const fullFresnel of [false,true]){
 const facts=f(60,50,1.5,1),scene=prismNativeFixture(facts,{partialReflection:fullFresnel});if(!fullFresnel)scene.simulation.maxRayDepth=1;
 const execution=evaluateDocument(scene,core).summary,requests=[{id:'faces',kind:'interface-face-events',componentId:'P'}];
 assert.equal(execution.native.status,'incomplete');const observations=await evaluateObservables(scene,requests,execution);
 assert.ok(observations.results.every(r=>r.status==='suppressed'&&r.value===null));
 record(fullFresnel?'full-fresnel-incomplete':'depth-incomplete',{claim:'Incomplete native execution withholds accepted native readings; separate conditional math does not override it.',facts,scene,execution,observations});
}
const math=[];
for(const A of [15,30,45,60,75,110])for(const i of [0,12,30,45,68])for(const [n,n0]of [[1.5,1],[1.8,1.33],[1,1.5],[1.5,1.5],[4,1],[2,2.5]]){
 const facts=f(A,i,n,n0),predicted=forward(facts),ref=prismVectorReference(A,i,n,n0);let inversion=null;
 if(predicted.status==='conditional'){
  assert.equal(ref.kind,'transmission');assert.ok(Math.abs(predicted.value.signedDeviationDeg-ref.deviation)<1e-8);
  if(n>1&&n<4&&ref.r1>1e-7&&ref.r2>1e-7&&ref.e>1e-7){const v={...facts,deviationDeg:ref.deviation,deviationConvention:'signed'};delete v.insideIndex;
   inversion=analyzePrismAngleQuery(v,q('prism-index-from-deviation'));
   if(ref.deviation!==0&&Math.abs(ref.deviation)<=1e-8)assert.equal(inversion.reasonCode,'UNRESOLVED_SMALL_DEVIATION');
   else{assert.equal(inversion.status,'conditional');assert.ok(Math.abs(inversion.value.insideIndex-n)<1e-10);}
  }
 }
 math.push({facts,result:predicted,independentVector:ref,inversion});
}
writeFileSync(resolve(out,'mathematical-reference.json'),JSON.stringify(math,null,2)+'\n',{flag:'wx'});
const count=items=>items.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
const files=['src/angular-math.js','src/planar-angle-queries.js','src/prism-angle-queries.js','src/problem-workflow.js','test/helpers/prism-native-inspection.mjs','test/helpers/prism-vector-reference.mjs','upstream-pin.json'];
const report={format:'opticsim-prism-native-qualification-v1',runtime:{node:process.version,checkoutSha:process.env.GITHUB_SHA??null},nativeRuns:rows.length,nativeStatusCounts:count(rows),rows,
 mathematicalInputs:math.length,forwardStatuses:count(math.map(r=>r.result)),inverseStatuses:count(math.filter(r=>r.inversion).map(r=>r.inversion)),inverseNotAttempted:math.filter(r=>!r.inversion).length,
 sourceSha256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 provenance:'Same-assistant engineering checks; 18 direct transformed controls, two ambiguity materials, two TIR, one third-face counterexample, two incomplete controls. These are not 25 direct-transmission successes.'};
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Prism native qualification PASS: '+rows.length+' separately authored traces; 180 vector-reference inputs.');
