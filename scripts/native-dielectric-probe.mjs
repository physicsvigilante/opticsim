// Test-only pinned native surface probe. No Opticsim canonical dielectric claim.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
const root=fileURLToPath(new URL('../',import.meta.url)),core=createRequire(import.meta.url)('../dist/test-core.cjs');
const base=prepareScene({lengthUnit:'mm',components:[
 {id:'S1',type:'point-source',parameters:{x:-300,y:30,brightness:.1},emission:{mode:'single-ray',directionDeg:0}},
 {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:100,apertureHeight:180}}
]}).document;
assert.equal(base.schemaVersion,6);
assert.equal(base.upstreamCommit,'811f508d2b070898c241a568b0c167dcb8645251');
const seed=core.compile(base).native;
const unit=r=>{const x=r.p2.x-r.p1.x,y=r.p2.y-r.p1.y,n=Math.hypot(x,y);return {x:x/n,y:y/n};};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,a+' != '+b);
function run(optic,start,direction=0,depth=8){
 const a=direction*Math.PI/180,original=structuredClone(seed);
 original.objs=[{type:'SingleRay',p1:{x:start.x,y:-start.y},
  p2:{x:start.x+20*Math.cos(a),y:-start.y-20*Math.sin(a)},brightness:.1},optic];
 original.maxRayDepth=depth;
 const scene=core.loadNative(original),hit=scene.objs[1];assert.equal(hit.constructor.type,optic.type);
 const events=[];let status='no-event',native=hit.onRayIncident;
 hit.onRayIncident=function(...args){
  const before=unit(args[0]),point={x:args[2].x,y:args[2].y};
  const result=native.apply(this,args);
  events.push({point,before,after:result?.isAbsorbed?null:unit(args[0]),
   returnedUndefined:result===undefined,undefinedBehavior:!!result?.isUndefinedBehavior});
  return result;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 sim.on('simulationComplete',()=>status='completed');sim.on('simulationStop',()=>status='stopped');
 sim.updateSimulation();
 return {status,events,truncation:sim.totalTruncation,undefinedBehavior:sim.totalUndefinedBehavior,
  errors:[sim.error,scene.error].filter(Boolean)};
}
const circle={type:'CircleGlass',p1:{x:0,y:0},p2:{x:100,y:0},refIndex:1.5,partialReflect:false};
const normal=run(circle,{x:-300,y:0});
assert.equal(normal.status,'completed');assert.equal(normal.events.length,2);
assert.equal(normal.truncation,0);assert.equal(normal.undefinedBehavior,0);
for(const e of normal.events){near(e.before.x,1);near(e.after.x,1);near(e.after.y,0);}
const oblique=run(circle,{x:-300,y:30});
assert.equal(oblique.status,'completed');assert.equal(oblique.events.length,2);
assert.equal(oblique.truncation,0);assert.equal(oblique.undefinedBehavior,0);
const first=oblique.events[0],normalAtFirst={x:first.point.x/100,y:first.point.y/100};
near(Math.abs(cross(first.before,normalAtFirst)),1.5*Math.abs(cross(first.after,normalAtFirst)));
assert.ok(Math.abs(first.after.y)>0.02,'Actual native oblique ray must bend');
const inside=run(circle,{x:0,y:80},0,3);
assert.ok(inside.events.length>=1,'Ray inside circle must hit boundary');
const tir=inside.events[0],tn={x:tir.point.x/100,y:tir.point.y/100};
assert.ok(dot(tir.before,tn)>0.5&&dot(tir.after,tn)<0,'Native total internal reflection must reverse radial sign');
near(dot(tir.before,tn),-dot(tir.after,tn));
assert.ok(inside.truncation>0,'A bounded repeatedly reflecting TIR ray must report truncated native brightness');
// Full-Fresnel branching is a distinct numerical experiment, not a claim of
// complete transmitted/reflected ray energy within the fixed depth budget.
const fresnel=run({...circle,partialReflect:true},{x:-300,y:30});
assert.ok(fresnel.events.length>=2,'Native Fresnel mode must still reach the circle');
assert.ok(fresnel.truncation>=0,'Native Fresnel truncation must be observable');
const prism=run({type:'Glass',notDone:false,
 path:[{x:-100,y:-100,arc:false},{x:0,y:0,arc:false},{x:-100,y:100,arc:false}],
 refIndex:1.25,partialReflect:false},{x:-300,y:20});
assert.equal(prism.status,'completed');
assert.ok(prism.events.length>=2,'Nonparallel prism must have two native surface hits');
assert.equal(prism.truncation,0);assert.equal(prism.undefinedBehavior,0);
assert.ok(Math.abs(prism.events.at(-1).after.y)>0.02,'Actual prism exit direction must deviate');
const report={format:'opticsim-native-dielectric-feasibility-v1',pin:base.upstreamCommit,
 note:'Only ephemeral TEST-ONLY native objects, no new canonical authoring support or image detection',
 normalCircle:normal,obliqueCircle:oblique,internalTIR:inside,fullFresnelCircle:fresnel,polygonPrism:prism,
 approximation:'Initial normal/oblique/prism probes explicitly use partialReflect=false. Native TIR at depth 3 has nonzero truncated brightness; full-Fresnel mode is recorded separately but neither represents complete unbounded light.'};
const dir=resolve(root,'test-artifacts/native-dielectric-probe');mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Pinned PhyDemo native CircleGlass and Glass geometric feasibility PASS.');
