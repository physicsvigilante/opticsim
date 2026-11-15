// RESEARCH FOLLOW-UP ONLY. Check already recorded native "same-object rehit"
// candidates against exact represented-binary64 line intersections on the
// actual authored finite rectangle face. No new native propagation or ray repair.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {exactLineReference} from '../../scripts/exact-line-reference.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
const native=p=>({x:p.x,y:-p.y});
function edges(parameters){
 return [1,2,3,4].map(i=>{
   const j=i===4?1:i+1;
   return {face:'face-'+i+j,p1:{x:parameters['x'+i],y:-parameters['y'+i]},
     p2:{x:parameters['x'+j],y:-parameters['y'+j]}};
 });
}
function residual(p,edge){
 const vx=edge.p2.x-edge.p1.x,vy=edge.p2.y-edge.p1.y,
   len2=vx*vx+vy*vy;
 const raw=((p.x-edge.p1.x)*vx+(p.y-edge.p1.y)*vy)/len2;
 const t=Math.max(0,Math.min(1,raw));
 const dist=Math.hypot(p.x-edge.p1.x-t*vx,p.y-edge.p1.y-t*vy);
 return {...edge,segmentParameter:raw,residualMm:dist};
}
function analyze(input,record,core){
 const candidates=record.instrumented.trace.selfRehits||[];
 const shape=input.request.components.find(x=>x.type==='polygon-dielectric');
 if(!shape)return candidates.map(c=>({candidate:c,reason:'nonpolygon-finite-line-comparison-not-applied'}));
 const faces=edges(shape.parameters),actual=record.instrumented.trace.entries;
 return candidates.map(c=>{
   const prior=actual.find(x=>x.callback===c.earlierCallback),
     next=actual.find(x=>x.callback===c.laterCallback);
   assert.ok(prior?.afterNative&&next?.actualHitPointMm,'Native callback evidence missing');
   assert.equal(prior.rayToken,next.rayToken,'Not the same actual native object');
   const nativeIncident=native(next.actualHitPointMm);
   const best=faces.map(f=>residual(nativeIncident,f)).sort((a,b)=>a.residualMm-b.residualMm)[0];
   // The selected face must actually contain the observed native next hit.
   assert.ok(best.residualMm<.01&&best.segmentParameter>=0&&best.segmentParameter<=1,
     'Cannot ground the native hit on the specific finite face');
   const cutoff=core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED;
   const exact=exactLineReference(prior.afterNative,best,cutoff);
   const p=prior.afterNative.p1;
   const nextStepMm=Math.hypot(nativeIncident.x-p.x,nativeIncident.y-p.y);
   return {sameNativeRayObject:true,earlierCallback:c.earlierCallback,laterCallback:c.laterCallback,
     actualNativeHitPoint:nativeIncident,
     groundedFiniteFace:{id:best.face,p1:best.p1,p2:best.p2,
       segmentParameter:best.segmentParameter,residualMm:best.residualMm},
     cutoffSquaredMm:cutoff,observedNativeStepMm:nextStepMm,
     observedNativeStepBeyondCutoff:nextStepMm**2>cutoff,
     exactRepresentedLines:exact,
     discrepancy:nextStepMm**2>cutoff&&!exact.beyondCutoff,
     limitation:'Exact rational intersection concerns the captured binary64 straight lines and the authored finite edge, not a second optical solver or a universal PhyDemo patch.'};
 });
}
async function main(){
 const folder=resolve(root,process.argv[2]||
   'test-artifacts/llm-authoring/cross-family-critical-native-v1');
 if(process.argv.length>3)throw Error('Usage: node exact-check.mjs [existing-generated-output-directory]');
 const inputText=readFileSync(join(folder,'input.json'),'utf8');
 const source=JSON.parse(inputText),old=JSON.parse(readFileSync(join(folder,'report.json'),'utf8'));
 assert.equal(old.inputsSha256,hash(inputText),'Source input must match frozen run input hash');
 assert.equal(old.capturedCases,source.length);
 const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
 const byId=new Map(source.map(x=>[x.id,x]));
 const findings=old.records.flatMap(r=>{
   const original=byId.get(r.id);
   assert.ok(original,'Missing original problem authoring for native evidence');
   return analyze(original,r,core).map(x=>({id:r.id,family:r.family,
     angleCase:r.angleCase,runStatus:r.canonicalStatus,...x}));
 });
 const count=findings.filter(x=>x.discrepancy).length;
 const report={format:'opticsim-cross-family-rehit-exact-reference-v1',
   follows:'opticsim-cross-family-critical-native-research-v1',
   originalInputSha256:old.inputsSha256,
   originalNativeCases:old.capturedCases,flagsAnalyzed:findings.length,
   discordantWithExactRepresentedLineCutoff:count,findings,
   source:'Post-run, test-only analytical audit of actual retained callback coordinates. Same assistant; not a predeclared blind experiment.',
   limit:'A genuine short physical hit, nonlinear boundary, surface-point representation error, or other ambiguity needs separate assessment. No native ray or source code changed.'};
 const file=join(folder,'exact-reference.json');
 writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 // Pin this observed counterexample as an exposed regression, not an input
 // change designed to make a native answer look correct.
 assert.equal(findings.length,2,'Expected exactly the two recorded quadrilateral near-critical candidates');
 assert.equal(count,2,'Native candidate steps should exceed cutoff although represented exact-line step does not');
 console.log('CRITICAL_EXACT_REFERENCE '+JSON.stringify({status:'pass',candidates:findings.length,
   nonforwardOrBelowCutoff:count,
   examples:findings.map(f=>({id:f.id,face:f.groundedFiniteFace?.id,
     nativeStepMm:f.observedNativeStepMm,
     exactForward:f.exactRepresentedLines?.forward,
     exactBeyondCutoff:f.exactRepresentedLines?.beyondCutoff,
     exactT:f.exactRepresentedLines?.t?.approx})),
   path:file}));
}
await main();
