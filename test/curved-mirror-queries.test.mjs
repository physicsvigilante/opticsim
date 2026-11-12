import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeCurvedMirrorQuery as solve,CURVED_QUERY_FORMAT,curvedQueryCapabilities} from '../src/curved-mirror-queries.js';
import {planProblem} from '../src/problem-workflow.js';
const q=kind=>({format:CURVED_QUERY_FORMAT,kind:kind||'curved-mirror-image'});
const base=()=>({format:'opticsim-curved-mirror-facts-v1',model:'spherical-paraxial',signConvention:'real-positive-local',lengthUnit:'cm',focalLength:20,objectDistance:30,objectHeight:2});
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('real/virtual/convex images and normalized magnification use one explicit signed model',()=>{
 for(const [f,u,v,m] of [[20,30,60,-2],[20,10,-20,2],[-20,30,-12,.4],[20,-30,12,.4]]){
  const input={...base(),focalLength:f,objectDistance:u},copy=structuredClone(input),r=solve(input,q());
  assert.equal(r.status,'conditional');close(r.value.imageDistance,v);close(r.value.magnification,m);close(r.value.imageHeight,2*m);
  assert.equal(r.value.imageKind,v>0?'finite-real':'finite-virtual');assert.deepEqual(input,copy);assert.equal(r.native.status,'not-run');
 }
 const b=solve({format:'opticsim-curved-mirror-facts-v1',model:'spherical-paraxial',signConvention:'real-positive-local',curvature:'concave',objectDistanceOverFocalLength:.5},q());
 assert.equal(b.value.imageDistance,null);assert.equal(b.value.lengthUnit,null);close(b.value.magnification,2);
});
test('U2 instantaneous image motion: 40 sqrt(2) axially away and -10 sqrt(2) transverse',()=>{
 const f=JSON.parse(readFileSync(new URL('../evaluation/curved-mirror-v1/followups.json',import.meta.url)));
 const r=planProblem(f.cases[0].request).results[0];assert.equal(r.status,'conditional');
 close(r.value.velocity.axial,40*Math.SQRT2);close(r.value.velocity.transverse,-10*Math.SQRT2);
 close(r.value.imageDistance,100);assert.equal(r.value.magnification,-4);assert.equal(r.nativeObservation,false);
});
test('velocity differentiates image height with changing magnification, not just m times velocity',()=>{
 const p={...base(),objectVelocity:{axial:-3,transverse:4},stationaryMirror:true,fixedFocalLength:true,timeUnit:'s'};
 const r=solve(p,q('curved-mirror-image-velocity'));const dt=1e-5;
 const image=t=>{const u=30-3*t,h=2+4*t;const v=20*u/(u-20);return {v,y:-v/u*h};};
 close(r.value.velocity.axial,(image(dt).v-image(-dt).v)/(2*dt),1e-5);
 close(r.value.velocity.transverse,(image(dt).y-image(-dt).y)/(2*dt),1e-5);
 assert.notEqual(r.value.velocity.transverse,r.value.magnification*4);
 close(r.value.velocity.transverse,-9.2);close(r.value.terms.changingMagnification,-1.2);
});
test('stationary/fixed-focal prerequisites are explicit, with moving-mirror query unavailable',()=>{
 const p={...base(),objectVelocity:{axial:1,transverse:0},timeUnit:'s'};
 assert.throws(()=>solve(p,q('curved-mirror-image-velocity')),/stationaryMirror/);
 const r=solve({...p,stationaryMirror:false,fixedFocalLength:true},q('curved-mirror-image-velocity'));
 assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,'DYNAMIC_MIRROR_UNSUPPORTED');
 assert.throws(()=>solve({...p,stationaryMirror:true,fixedFocalLength:true,objectHeight:undefined},q('curved-mirror-image-velocity')));
});
test('focal infinity is explicit, near focal results are indeterminate and no finite velocity is invented',()=>{
 const exact={...base(),objectDistance:20};const r=solve(exact,q());
 assert.equal(r.status,'conditional');assert.equal(r.value.imageKind,'at-infinity');assert.equal(r.value.imageDistance,null);
 const vel=solve({...exact,objectVelocity:{axial:1,transverse:0},timeUnit:'s',stationaryMirror:true,fixedFocalLength:true},q('curved-mirror-image-velocity'));
 assert.equal(vel.status,'unavailable');assert.equal(vel.value,null);
 for(const d of [-1e-11,1e-11])assert.equal(solve({...exact,objectDistance:20+d},q()).status,'numerically-indeterminate');
 for(const d of [-.01,.01])assert.equal(solve({...exact,objectDistance:20+d},q()).status,'conditional');
});
test('changing dimensional length units scales distances and velocities but not magnification',()=>{
 const p={...base(),objectVelocity:{axial:-3,transverse:4},timeUnit:'s',stationaryMirror:true,fixedFocalLength:true};
 const a=solve(p,q('curved-mirror-image-velocity')).value;
 const b=solve({...p,lengthUnit:'mm',focalLength:200,objectDistance:300,objectHeight:20,objectVelocity:{axial:-30,transverse:40}},q('curved-mirror-image-velocity')).value;
 close(a.magnification,b.magnification);close(b.imageDistance,10*a.imageDistance);close(b.velocity.transverse,10*a.velocity.transverse);
});
test('malformed or contradictory facts reject without formulas, arbitrary symbolic evaluation or silent signs',()=>{
 for(const change of [{focalLength:0},{objectDistance:0},{focalLength:'20'},{curvature:'convex'},{model:'exact-spherical'},{signConvention:'unspecified'},{objectDistanceOverFocalLength:2},{foo:3}])
  assert.throws(()=>solve({...base(),...change},q()));
 assert.throws(()=>solve({...base(),objectVelocity:{speed:1,directionDeg:30,axial:2}},q()));
 assert.throws(()=>solve({...base(),objectVelocity:{speed:-1,directionDeg:30}},q()));
 assert.throws(()=>solve(base(),{...q(),eval:'1+1'}));
 assert.equal(curvedQueryCapabilities().kinds.length,2);
});
test('the calculation bound covers all mirror and refractive families, not just planar refraction',()=>{
 const p={format:'opticsim-problem-v1',physical:base(),requests:Array.from({length:5},(_,i)=>({id:'r'+i,kind:'curved-mirror-image'}))};
 assert.throws(()=>planProblem(p),/At most four/);
});
test('original B03 transcription is 1.5f, height 2.5cm: inverted 5cm image without inventing f',()=>{
 const f=JSON.parse(readFileSync(new URL('../evaluation/curved-mirror-v1/followups.json',import.meta.url)));
 const b=f.cases.find(c=>c.id==='B03');assert.equal(b.request.physical.objectDistanceOverFocalLength,1.5);
 const r=planProblem(b.request).results[0];assert.equal(r.value.magnification,-2);assert.equal(r.value.imageHeight,-5);
 assert.equal(r.value.imageDistance,null);assert.equal(r.value.imageDistanceOverFocalLength,3);
 assert.equal(r.value.orientation,'inverted');
});
