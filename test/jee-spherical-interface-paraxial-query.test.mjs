import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {analyzeSphericalInterface,sphericalInterfaceCapabilities,
 SPHERICAL_INTERFACE_QUERY_FORMAT} from '../src/spherical-interface-paraxial-query.js';
import {runSphericalInterfaceEvidence} from '../scripts/spherical-interface-query.mjs';

const power=()=>({format:SPHERICAL_INTERFACE_QUERY_FORMAT,
 kind:'surface-power',signConvention:'positive-along-incident-light',
 lengthUnit:'cm',incidentIndex:1,transmittedIndex:4/3,signedRadius:10});
const conjugate=()=>({format:SPHERICAL_INTERFACE_QUERY_FORMAT,
 kind:'real-object-conjugate',signConvention:'positive-along-incident-light',
 lengthUnit:'cm',incidentIndex:1.5,transmittedIndex:1,
 signedRadius:-15,signedObjectDistance:-10});
function near(got,expected,tolerance=1e-8){
 assert.ok(Number.isFinite(got)&&Math.abs(got-expected)<=tolerance,
  String(got)+' != '+String(expected));
}
function rayIntercept(R,n1,n2,u,h){
 // Independently computed finite-height meridional Snell ray. This is test
 // mathematics, not PhyDemo propagation or any claim of a detected image.
 const x=R-Math.sign(R)*Math.sqrt(R*R-h*h);
 const normal=Math.atan2(-Math.sign(R)*h,Math.abs(R-x));
 const thetaIncoming=u===null?0:Math.atan2(h,x-u);
 const transmitted=normal+Math.asin((n1/n2)*Math.sin(thetaIncoming-normal));
 return x-h/Math.tan(transmitted);
}
test('J15: one stated convex interface gives +10/3 D and a 40 cm image-side focal distance',()=>{
 const q=power(),before=structuredClone(q),r=analyzeSphericalInterface(q);
 assert.equal(r.status,'conditional');
 assert.equal(r.kind,'surface-power');
 near(r.value.powerDiopters,10/3);
 near(r.value.signedImageSpaceFocalDistance,40);
 near(r.value.signedObjectSpaceFocalDistance,-30);
 assert.equal(r.value.nativeImageDetected,false);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.model,'single-spherical-refracting-interface-paraxial');
 assert.deepEqual(q,before);
 near(rayIntercept(100,1,4/3,null,0.01),
  r.value.signedImageSpaceFocalDistanceMm,0.00001);
});
test('J16: curved bubble apparent position is distinct from the planar depth shortcut',()=>{
 const q=conjugate(),r=analyzeSphericalInterface(q);
 assert.equal(r.status,'conditional');
 assert.equal(r.value.imageKind,'virtual');
 near(r.value.signedObjectDistance,-10);
 near(r.value.signedImageDistance,-60/7,1e-10);
 near(r.value.signedParaxialMagnification,9/7,1e-10);
 assert.ok(Math.abs(r.value.signedImageDistance-(-10/1.5))>1);
 near(rayIntercept(-150,1.5,1,-100,0.01),
  r.value.signedImageDistanceMm,0.00001);
 assert.equal(r.native.nativeImageDetected,false);
 assert.match(r.qualification,/not a native/);
});
test('signed curvature, material reversal, negative power and no-contrast boundary are explicit',()=>{
 const q=power();
 q.transmittedIndex=1;q.incidentIndex=1.5;
 let r=analyzeSphericalInterface(q);
 near(r.value.powerDiopters,-5);
 near(r.value.signedImageSpaceFocalDistance,-20);
 q.signedRadius=-10;
 r=analyzeSphericalInterface(q);
 near(r.value.powerDiopters,5);
 near(r.value.signedImageSpaceFocalDistance,20);
 q.incidentIndex=1;q.transmittedIndex=1;
 r=analyzeSphericalInterface(q);
 assert.equal(r.status,'conditional');
 assert.equal(r.value.powerDiopters,0);
 assert.equal(r.value.focalStatus,'afocal');
 assert.equal(r.value.signedImageSpaceFocalDistance,null);
 const c=conjugate();c.transmittedIndex=1.5;
 const v=analyzeSphericalInterface(c);
 assert.equal(v.status,'conditional');
 near(v.value.signedImageDistance,-10);
 near(v.value.signedParaxialMagnification,1);
});
test('mm/cm/m translations preserve signed canonical geometry and power',()=>{
 const q=conjugate(),a=analyzeSphericalInterface(q);
 for(const [unit,factor] of [['mm',10],['m',.01]]){
  const b=structuredClone(q);b.lengthUnit=unit;
  b.signedRadius*=factor;b.signedObjectDistance*=factor;
  const x=analyzeSphericalInterface(b);
  near(x.value.signedImageDistanceMm,a.value.signedImageDistanceMm,1e-9);
  near(x.value.powerDiopters,a.value.powerDiopters,1e-12);
  near(x.signedRadiusMm,a.signedRadiusMm,1e-9);
 }
});
test('strict essential facts, sign, field and unit validation refuse unsupported apparatus',()=>{
 const variants=[
  q=>{delete q.incidentIndex;},q=>{delete q.signedRadius;},
  q=>{q.transmittedIndex=undefined;},q=>{q.transmittedIndex=4.1;},
  q=>{q.incidentIndex=0.9;},q=>{q.signedRadius=0;},
  q=>{q.signedRadius=0.05;},q=>{q.signedRadius=1001;},
  q=>{q.signedRadius=Infinity;},q=>{q.signedRadius='10';},
  q=>{q.signConvention='object-is-positive';},
  q=>{q.lengthUnit='feet';},q=>{q.kind='full-sphere-imaging';},
  q=>{q.signedObjectDistance=-1;},
  q=>{q.partialReflection=false;},q=>{q.format='other';}
 ];
 for(const mutate of variants){
  const q=power();mutate(q);
  assert.throws(()=>analyzeSphericalInterface(q));
 }
 const c=conjugate();delete c.signedObjectDistance;
 assert.throws(()=>analyzeSphericalInterface(c),/requires/);
 for(const object of [0,0.1,-.0001,-1001,'-10',null,Infinity]){
  c.signedObjectDistance=object;
  assert.throws(()=>analyzeSphericalInterface(c));
 }
});
test('weak index contrast and near-infinite conjugates are not reported as finite',()=>{
 const q=power();q.transmittedIndex=1+1e-13;
 let r=analyzeSphericalInterface(q);
 assert.equal(r.status,'numerically-indeterminate');
 assert.equal(r.reasonCode,'NEAR_EQUAL_INDICES');assert.equal(r.value,null);
 const c=power();c.kind='real-object-conjugate';
 c.incidentIndex=1;c.transmittedIndex=1.5;c.signedRadius=10;
 c.signedObjectDistance=-20;
 r=analyzeSphericalInterface(c);
 assert.equal(r.status,'numerically-indeterminate');
 assert.equal(r.reasonCode,'NEAR_FOCAL_CONJUGATE');
 for(const d of [-20-1e-10,-20+1e-10]){
  c.signedObjectDistance=d;
  r=analyzeSphericalInterface(c);
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.value,null);
 }
 c.signedObjectDistance=-30;
 r=analyzeSphericalInterface(c);
 assert.equal(r.status,'conditional');
 assert.equal(r.value.imageKind,'real');
 near(r.value.signedImageDistance,90);
});
test('CLI preserves original bytes and source hash, isolates analysis and rejects invalid input',()=>{
 const q=power(),raw=Buffer.from(JSON.stringify(q,null,2)+'\n','utf8');
 const dir=resolve('test-artifacts/llm-authoring/spherical-interface-'+randomUUID());
 const r=runSphericalInterfaceEvidence({queryBytes:raw,outputPath:dir});
 assert.equal(r.status,'conditional');assert.equal(r.exitCode,0);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),raw);
 const sha=createHash('sha256').update(raw).digest('hex');
 assert.equal(r.report.originalInputSha256,sha);
 const a=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(a.originalInputSha256,sha);
 assert.equal(a.results.native.status,'not-run');
 assert.equal(a.results.native.nativeImageDetected,false);
 assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
 assert.throws(()=>runSphericalInterfaceEvidence({queryBytes:raw,outputPath:dir}));
 const bad=Buffer.from('{"format": }'),badDir=resolve(
  'test-artifacts/llm-authoring/spherical-interface-'+randomUUID());
 const refused=runSphericalInterfaceEvidence({queryBytes:bad,outputPath:badDir});
 assert.equal(refused.status,'rejected');assert.equal(refused.exitCode,1);
 assert.deepEqual(readFileSync(resolve(badDir,'input.json')),bad);
 assert.equal(existsSync(resolve(badDir,'analytical-result.json')),false);
 const caps=JSON.parse(execFileSync(process.execPath,
  [new URL('../scripts/spherical-interface-query.mjs',import.meta.url).pathname,
   'capabilities'],{encoding:'utf8'}));
 assert.deepEqual(caps.kinds,sphericalInterfaceCapabilities().kinds);
 assert.equal(caps.native.startsWith('not-run'),true);
});
