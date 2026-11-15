// Synthetic native qualification, separate from the zero-native analytical workflow.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from './author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {analyzePrismAngleQuery} from '../src/prism-angle-queries.js';
import {nativePrismRequest,inspectPrismNative,checkNativeSnell,vectorPrismReference} from '../test/helpers/prism-angular-reference.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=resolve('test-artifacts/llm-authoring/prism-angular-native-v1');mkdirSync(root,{recursive:true});
const cases=[
 {id:'isosceles-direct',A:60,i:45,n0:1,n:1.5,status:'completed',analytical:'conditional'},
 {id:'scalene-immersed',A:45,i:25,n0:1.5,n:1.25,left:160,right:80,status:'completed',analytical:'conditional'},
 {id:'obtuse-direct',A:110,i:60,n0:1,n:1.05,status:'completed',analytical:'conditional'},
 {id:'entry-tir',A:60,i:60,n0:1.5,n:1,status:'completed',analytical:'unavailable'},
 {id:'exit-tir',A:60,i:0,n0:1,n:1.5,status:'completed',analytical:'unavailable'},
 {id:'different-finite-exit',A:60,i:45,n0:1,n:1.5,left:120,right:50,entryY:-105,status:'completed',analytical:'conditional'},
 {id:'full-fresnel',A:60,i:45,n0:1,n:1.5,fresnel:true,status:'incomplete',analytical:'conditional'},
 {id:'depth-limited',A:60,i:45,n0:1,n:1.5,depth:1,status:'incomplete',analytical:'conditional'}
];
const rows=[];
for(const c of cases){
 const request=nativePrismRequest(c);if(c.fresnel)request.components[1].parameters.partialReflection=true;
 const doc=prepareScene(request).document;if(c.depth)doc.simulation.maxRayDepth=c.depth;
 const run=evaluateDocument(doc,core),inspected=inspectPrismNative(doc,core);assert.equal(run.summary.native.status,c.status,c.id);assert.equal(inspected.status,c.status,c.id);
 const facts={format:'opticsim-prism-angular-facts-v1',model:'homogeneous-prism',branch:'direct-two-face-transmission',angleConvention:'normal-angles-signed-deviation',prismAngleDeg:c.A,incidenceAngleDeg:c.i,outsideIndex:c.n0,insideIndex:c.n};
 const analytic=analyzePrismAngleQuery(facts,{format:'opticsim-prism-angular-query-v1',kind:'prism-direct-angles'});assert.equal(analytic.status,c.analytical);
 const requests=[{id:'hits',kind:'interface-interactions',componentId:'P'},{id:'angle',kind:'interface-transmission-angle',componentId:'P'}];
 const results=await evaluateObservables(doc,requests,run.summary);
 if(c.status==='completed'){
  checkNativeSnell(doc,inspected.trace);assert.deepEqual(run.summary.observations.interfacesById,inspected.diagnostic.interfacesById);
  if(c.id.endsWith('direct')||c.id==='scalene-immersed'){
   assert.deepEqual(inspected.trace.map(e=>e.face),[0,2]);const ref=vectorPrismReference(c.A,c.i,c.n0,c.n),last=inspected.trace.at(-1).outgoing;
   assert.ok(Math.hypot(last.x-ref.outgoing.x,last.y-ref.outgoing.y)<1e-8);
  }
  if(c.id==='different-finite-exit')assert.notDeepEqual(inspected.trace.map(e=>e.face),[0,2]);
 }else{assert.equal(run.summary.observations,null);assert.ok(results.results.every(r=>r.status==='suppressed'&&r.value===null));}
 const evidence={request,doc,derivedAngularFacts: facts,analytic,canonicalExecution:run,readOnlyDiagnosticExecution:inspected,requestedNativeResults:results};
 writeFileSync(resolve(root,c.id+'.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
 rows.push({id:c.id,status:c.status,analyticalStatus:analytic.status,faces:inspected.trace.map(e=>e.face??null),nativeExecutions:2});
}
const paths=['src/adapter.js','src/planar-media.js','src/prism-angle-queries.js','test/helpers/prism-angular-reference.mjs','upstream-pin.json'];
writeFileSync(resolve(root,'report.json'),JSON.stringify({format:'opticsim-prism-native-acceptance-v1',runtime:{node:process.version,checkoutSha:process.env.GITHUB_SHA??null},sourceSha256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 counts:{syntheticApparatuses:cases.length,canonicalNativeRuns:cases.length,readOnlyDiagnosticRuns:cases.length,completed:6,incomplete:2},
 scope:'Separate declared synthetic native apparatuses, NOT scenes created by angular requests. Repeated diagnostic traces are not additional independent cases.',rows},null,2)+'\n',{flag:'wx'});
console.log('Prism native acceptance PASS: eight apparatuses, six complete and two incomplete; each canonical run has a separate read-only diagnostic replay.');
