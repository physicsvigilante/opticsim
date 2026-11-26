import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {COMPONENT_REVISION_FORMAT,prepareScene,reviseComponents} from '../src/authoring.js';
import {evaluateObservables} from '../src/observables.js';
import {OPTICAL_BENCH_V40_MODEL,OPTICAL_BENCH_V40_VERSION} from '../src/native-optical-bench.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));

const v40Req=(components,extra={})=>({
  title:'v40 arc clearance & submerged stops test',
  model:OPTICAL_BENCH_V40_MODEL,
  lengthUnit:'mm',
  backgroundIndex:1,
  randomSeed:'v40-option-a-seed',
  components,
  ...extra
});

function snell2D(d,n,ni,nt){
  let nx=n.x,ny=n.y,cosI=-(d.x*nx+d.y*ny);
  if(cosI<0){nx=-nx;ny=-ny;cosI=-cosI;}
  const eta=ni/nt,k=1-eta*eta*(1-cosI*cosI);
  const c=eta*cosI-Math.sqrt(k);
  return {x:eta*d.x+c*nx,y:eta*d.y+c*ny};
}
function reflect2D(d,n){
  const dn=d.x*n.x+d.y*n.y;
  return {x:d.x-2*dn*n.x,y:d.y-2*dn*n.y};
}
function rayVerticalPlane(origin,dir,xTarget){
  const t=(xTarget-origin.x)/dir.x;
  return {x:xTarget,y:origin.y+t*dir.y};
}
function rayHorizontalPlane(origin,dir,yTarget){
  const t=(yTarget-origin.y)/dir.y;
  return {x:origin.x+t*dir.x,y:yTarget};
}
function rayCircleFirstHit(origin,dir,center,radius){
  const ox=origin.x-center.x,oy=origin.y-center.y;
  const b=ox*dir.x+oy*dir.y,c=ox*ox+oy*oy-radius*radius;
  const disc=Math.sqrt(b*b-c),t1=-b-disc,t2=-b+disc;
  const t=t1>1e-9?t1:t2;
  return {x:origin.x+t*dir.x,y:origin.y+t*dir.y};
}

test('v40 exact circular-arc-mirror vs non-silvered dielectric: U7-inspired close glass plate + convex arc mirror matches exact Snell/reflection oracle',async()=>{
  // 1 mm flat glass plate at x in [-50, -49], 49 mm clear of convex circular-arc-mirror at (0, 0)
  // with R = -400 mm, apertureHeight = 120 mm (old hypot(60, 4.525) = 60.17 mm disk falsely blocked this).
  const nG=1.5,R=400,deg=-5*Math.PI/180;
  const s0={x:-120,y:20},d0={x:Math.cos(deg),y:Math.sin(deg)};
  const p1=rayVerticalPlane(s0,d0,-50);
  const d1=snell2D(d0,{x:-1,y:0},1,nG);
  const p2=rayVerticalPlane(p1,d1,-49);
  const d2=snell2D(d1,{x:1,y:0},nG,1);
  // Convex mirror at vertex (0,0), normalDeg=180 (-x), radius=-400 -> center at (+400, 0), radius=400
  const mCenter={x:R,y:0};
  const pM=rayCircleFirstHit(p2,d2,mCenter,R);
  const nM={x:(pM.x-mCenter.x)/R,y:(pM.y-mCenter.y)/R};
  const d3=reflect2D(d2,nM);
  const p4=rayVerticalPlane(pM,d3,-49);
  const d4=snell2D(d3,{x:1,y:0},1,nG);
  const p5=rayVerticalPlane(p4,d4,-50);
  const d5=snell2D(d4,{x:-1,y:0},nG,1);
  const pDet=rayVerticalPlane(p5,d5,-110);

  const {document:doc}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:s0.x,y:s0.y,brightness:0.2},emission:{mode:'single-ray',directionDeg:-5}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-50,y1:-60,x2:-49,y2:-60,x3:-49,y3:60,x4:-50,y4:60,insideIndex:nG,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:-R,apertureHeight:120}},
    {id:'D1',type:'ray-detector',parameters:{x:-110,y:0,orientationDeg:90,length:120}}
  ]));
  assert.equal(doc.schemaVersion,OPTICAL_BENCH_V40_VERSION);

  const reqs=[
    {id:'refl',kind:'mirror-reflections',componentId:'M1'},
    {id:'glass',kind:'interface-interactions',componentId:'G1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const run=await evaluateDocument(doc,core,reqs);
  assert.equal(run.summary.executionPassed,true);
  assert.equal(run.summary.observations.v40EndpointsVerified,true);
  const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
  assert.equal(byId.refl.value,1);
  assert.equal(byId.glass.value,4);
  assert.equal(byId.hits.value.length,2);
  const retHit=byId.hits.value.find(h=>h.incomingUnit.x<0);
  assert.ok(retHit&&Math.abs(retHit.pointMm.y-pDet.y)<1e-6,
    `Expected return hit y=${pDet.y}, got ${retHit?.pointMm?.y}`);

  // ideal-curved-mirror still keeps its conservative apertureHeight/2 (60 mm) bounding disk against dielectrics:
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-50,y1:-60,x2:-49,y2:-60,x3:-49,y3:60,x4:-50,y4:60,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:-200,apertureHeight:120}}
  ])),/Curved mirror bounding disk must lie outside dielectric body/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-61.5,y1:-60,x2:-60.5,y2:-60,x3:-60.5,y3:60,x4:-61.5,y4:60,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:-200,apertureHeight:120}}
  ])));
});

test('v40 exact circular-arc-mirror clearance matrix across all 5 dielectric bodies, circle-blocker, and flush curved silvering',()=>{
  const ray={id:'S1',type:'point-source',parameters:{x:-80,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}};

  // 1. Wide-aperture concave arc (R = 10, apertureHeight = 16 -> sag = 4 mm, endpoints at (-4, +/-8), vertex (0,0)):
  //    a small slab at x in [-3.5, -0.5], y in [-2, 2] sits cleanly inside the chord pocket (>= 0.5 mm clear of arc!) -> accepted.
  const concaveArc={id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:10,apertureHeight:16}};
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,concaveArc,
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-3.5,y1:-2,x2:-0.5,y2:-2,x3:-0.5,y3:2,x4:-3.5,y4:2,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])));
  // Moving slab to x2 = -0.005 mm (< 0.01 mm from arc vertex) -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    ray,concaveArc,
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-3.5,y1:-2,x2:-0.005,y2:-2,x3:-0.005,y3:2,x4:-3.5,y4:2,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  // Slab crossing arc endpoint (-4, 8) within 0.005 mm -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    ray,concaveArc,
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-6,y1:8.005,x2:-2,y2:8.005,x3:-2,y3:12,x4:-6,y4:12,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  // Arc completely contained inside a giant polygon -> rejected!
  assert.throws(()=>prepareScene(v40Req([
    ray,concaveArc,
    {id:'G1',type:'polygon-dielectric',parameters:{x1:-20,y1:-20,x2:20,y2:-20,x3:20,y3:20,x4:-20,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);

  // 2. Triangular prism: against convex arc (vertex at (0,0), curves toward +x), vertical face at x = -0.02 is 0.02 mm clear (accepted)
  //    and x = -0.005 is 0.005 mm clear (rejected); against concave arc (R=10, at y=+/-2 arc x = sqrt(96)-10 ~ -0.202),
  //    prism vertical face at x = -0.25 with y in [-2, 2] sits cleanly inside the pocket (accepted), while x = -0.20 collides (rejected)!
  const convexArc={id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:-10,apertureHeight:16}};
  const prismAt=(xRight,h=5)=>({id:'P1',type:'triangular-prism',parameters:{x1:xRight-10,y1:-h,x2:xRight,y2:-h,x3:xRight,y3:h,insideIndex:1.5,outsideIndex:1,partialReflection:false}});
  assert.doesNotThrow(()=>prepareScene(v40Req([ray,convexArc,prismAt(-0.02)])));
  assert.throws(()=>prepareScene(v40Req([ray,convexArc,prismAt(-0.005)])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.doesNotThrow(()=>prepareScene(v40Req([ray,concaveArc,prismAt(-0.25,2)])));
  assert.throws(()=>prepareScene(v40Req([ray,concaveArc,prismAt(-0.20,2)])),/Circular-arc-mirror surface must lie outside dielectric body/);

  // 3. Circular dielectric: concentric outer arc (R=15 vs 10) accepted, concentric inner arc (R=5 vs 10) rejected,
  //    0.005 mm gap rejected, exact flush silvering (R=10) still accepted!
  const circleBody={id:'C1',type:'circular-dielectric',parameters:{x:-10,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,circleBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:5,y:0,normalDeg:180,radius:15,apertureHeight:16}}
  ])));
  assert.throws(()=>prepareScene(v40Req([
    ray,circleBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:-5,y:0,normalDeg:180,radius:5,apertureHeight:6}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    ray,circleBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0.005,y:0,normalDeg:180,radius:10.005,apertureHeight:12}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,circleBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:10,apertureHeight:12}}
  ])));

  // 4. Circular-cap-dielectric (hemisphere base at (0,0), normalDeg=90, R=10 -> dome apex at (0,10), chord [-10,10] at y=0):
  const capRay={id:'S1',type:'point-source',parameters:{x:-80,y:5,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}};
  const capBody={id:'H1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:10,capHeight:10,normalDeg:90,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  // Concentric outer arc R=15 -> accepted; concentric gap 0.005 mm -> rejected; chord gap 0.005 mm -> rejected;
  // intersecting arc -> rejected; arc strictly inside cap -> rejected; exact flush silvering (R=10) -> accepted!
  assert.doesNotThrow(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:15,normalDeg:-90,radius:15,apertureHeight:20}}
  ])));
  assert.throws(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:10.005,normalDeg:-90,radius:10.005,apertureHeight:14}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:-0.005,normalDeg:90,radius:-50,apertureHeight:12}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:8,normalDeg:-90,radius:20,apertureHeight:24}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:6,normalDeg:-90,radius:5,apertureHeight:4}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  assert.doesNotThrow(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:10,normalDeg:-90,radius:10,apertureHeight:16}}
  ])));

  // 5. Spherical-lens (biconvex centered at x=-20, thickness=6 -> AABB x in [-23, -17]):
  //    convex arc mirror at x=0, R=-400, aperture=120 is 17 mm clear of AABB (inside old 60.17 mm disk!) -> accepted;
  //    at x=-16.995 (0.005 mm from AABB) -> rejected; flush curved-silvered back face -> accepted!
  const lens={id:'L1',type:'spherical-lens',parameters:{x:-20,y:0,apertureHeight:20,centerThickness:6,frontRadius:40,backRadius:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,lens,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:-400,apertureHeight:120}}
  ])));
  assert.throws(()=>prepareScene(v40Req([
    ray,lens,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:-16.995,y:0,normalDeg:180,radius:-400,apertureHeight:20}}
  ])),/Circular-arc-mirror surface must lie outside dielectric body/);
  // Flush back-face silvering (backApex = -17, backCenter = -17 - 40 = -57, so mirror vertex (-17, 0), normalDeg=180, radius=+40):
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,lens,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:-17,y:0,normalDeg:180,radius:40,apertureHeight:16}}
  ])));

  // 6. circle-blocker vs circular-arc-mirror uses exact point-to-arc clearance:
  //    circle at (-20, 0) radius 5 is 15 mm clear of M1 at (0, 0), R=-400, aperture=120 (inside old 60.17 mm disk!) -> accepted;
  //    circle at (-5.005, 0) radius 5 (0.005 mm from vertex) -> rejected!
  const bigConvex={id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:0,normalDeg:180,radius:-400,apertureHeight:120}};
  assert.doesNotThrow(()=>prepareScene(v40Req([
    ray,bigConvex,
    {id:'K1',type:'circle-blocker',parameters:{x:-20,y:0,radius:5}}
  ])));
  assert.throws(()=>prepareScene(v40Req([
    ray,bigConvex,
    {id:'K1',type:'circle-blocker',parameters:{x:-5.005,y:0,radius:5}}
  ])),/opaque circle intersects or approaches circular-arc-mirror/);
  // Submerged circle-blocker inside a curved-silvered hemisphere (>= 0.01 mm from silvered arc!) -> accepted!
  assert.doesNotThrow(()=>prepareScene(v40Req([
    capRay,capBody,
    {id:'M1',type:'circular-arc-mirror',parameters:{x:0,y:10,normalDeg:-90,radius:10,apertureHeight:16}},
    {id:'K1',type:'circle-blocker',parameters:{x:0,y:4,radius:2}}
  ])));
});

test('v40 submerged line-blocker and ray-detector: U2-inspired water tank shadow + exact Snell hit oracle',async()=>{
  const nW=4/3,rad=-45*Math.PI/180,dAir={x:Math.cos(rad),y:Math.sin(rad)};
  const dWater=snell2D(dAir,{x:0,y:1},1,nW);

  // Source 1 enters water at x = -40 (from (-60, 20) at -45 deg), misses submerged pole at x=0, hits submerged detector at y=-38:
  const pEntry1={x:-40,y:0};
  const pBottom1=rayHorizontalPlane(pEntry1,dWater,-38);
  assert.ok(pBottom1.x<-10,'Ray 1 should reach bottom well left of pole at x=0');

  // Source 2 enters water at x = -10 (from (-30, 20) at -45 deg), refracts into pole at x = 0:
  const yPoleHit=0+(10/dWater.x)*dWater.y;
  assert.ok(yPoleHit<-5&&yPoleHit>-35,'Ray 2 should hit submerged pole y in (-35, -5)');

  const waterTank={id:'W1',type:'polygon-dielectric',parameters:{x1:-100,y1:-40,x2:100,y2:-40,x3:100,y3:0,x4:-100,y4:0,insideIndex:nW,outsideIndex:1,partialReflection:false}};
  const pole={id:'K1',type:'line-blocker',parameters:{x:0,y:-20,orientationDeg:90,length:30}}; // y in [-35, -5]
  const bottomDet={id:'D1',type:'ray-detector',parameters:{x:0,y:-38,orientationDeg:0,length:160}}; // x in [-80, 80]

  // Case A: Unblocked ray hits submerged detector at exact Snell x, 0 blocker absorptions
  const {document:docHit}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-60,y:20,brightness:0.2},emission:{mode:'single-ray',directionDeg:-45}},
    waterTank,pole,bottomDet
  ]));
  const reqs=[
    {id:'abs',kind:'blocker-absorptions',componentId:'K1'},
    {id:'cross',kind:'detector-crossings',componentId:'D1'},
    {id:'hits',kind:'detector-hit-events',componentId:'D1'}
  ];
  const runHit=await evaluateDocument(docHit,core,reqs);
  assert.equal(runHit.summary.executionPassed,true);
  assert.equal(runHit.summary.observations.v40EndpointsVerified,true);
  const resHit=Object.fromEntries((await evaluateObservables(docHit,reqs,runHit.summary)).results.map(r=>[r.id,r]));
  assert.equal(resHit.abs.value,0);
  assert.equal(resHit.cross.value,1);
  assert.equal(resHit.hits.value.length,1);
  assert.ok(Math.abs(resHit.hits.value[0].pointMm.x-pBottom1.x)<1e-6,
    `Expected submerged hit x=${pBottom1.x}, got ${resHit.hits.value[0].pointMm.x}`);
  assert.ok(Math.abs(resHit.hits.value[0].pointMm.y-(-38))<1e-6);

  // Case B: Ray hits submerged pole K1 -> absorbed inside water, 0 crossings on submerged bottom detector
  const {document:docBlocked}=prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:-30,y:20,brightness:0.2},emission:{mode:'single-ray',directionDeg:-45}},
    waterTank,pole,bottomDet
  ]));
  const runBlocked=await evaluateDocument(docBlocked,core,reqs);
  assert.equal(runBlocked.summary.executionPassed,true);
  assert.equal(runBlocked.summary.observations.v40EndpointsVerified,true);
  const resBlocked=Object.fromEntries((await evaluateObservables(docBlocked,reqs,runBlocked.summary)).results.map(r=>[r.id,r]));
  assert.equal(resBlocked.abs.value,1);
  assert.equal(resBlocked.cross.value,0);
});

test('v40 pinned PhyDemo interior-index preservation: pass-through submerged ray-detector preserves exact exit Snell refraction in all 4 admitted bodies',async()=>{
  const nG=1.5;

  // 1. polygon-dielectric (slab x in [0, 40], y in [-40, 40]): ray at 25 deg hits submerged D_mid at x=20, exits at x=40, hits D_out at x=70
  {
    const rad=25*Math.PI/180,d0={x:Math.cos(rad),y:Math.sin(rad)};
    const s0={x:-20,y:-10};
    const pIn=rayVerticalPlane(s0,d0,0);
    const dIn=snell2D(d0,{x:-1,y:0},1,nG);
    const pMid=rayVerticalPlane(pIn,dIn,20);
    const pOut=rayVerticalPlane(pIn,dIn,40);
    const dOut=snell2D(dIn,{x:1,y:0},nG,1);
    const pDet=rayVerticalPlane(pOut,dOut,70);

    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:s0.x,y:s0.y,brightness:0.2},emission:{mode:'single-ray',directionDeg:25}},
      {id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-40,x2:40,y2:-40,x3:40,y3:40,x4:0,y4:40,insideIndex:nG,outsideIndex:1,partialReflection:false}},
      {id:'D_mid',type:'ray-detector',parameters:{x:20,y:0,orientationDeg:90,length:60}},
      {id:'D_out',type:'ray-detector',parameters:{x:70,y:0,orientationDeg:90,length:100}}
    ]));
    const reqs=[
      {id:'mid',kind:'detector-hit-events',componentId:'D_mid'},
      {id:'out',kind:'detector-hit-events',componentId:'D_out'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true);
    assert.equal(run.summary.observations.v40EndpointsVerified,true);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.ok(Math.abs(byId.mid.value[0].pointMm.y-pMid.y)<1e-6);
    assert.ok(Math.abs(byId.out.value[0].pointMm.y-pDet.y)<1e-6);
    assert.ok(Math.abs(byId.out.value[0].incomingUnit.x-d0.x)<1e-6,'Exit direction must match original 25 deg after crossing submerged detector');
    assert.ok(Math.abs(byId.out.value[0].incomingUnit.y-d0.y)<1e-6);
  }

  // 2. circular-dielectric (center (0,0), R=20): horizontal ray at y=8 enters circle, passes submerged D_mid at x=0, exits circle, hits D_out at x=40
  {
    const R=20,s0={x:-40,y:8},d0={x:1,y:0};
    const pIn=rayCircleFirstHit(s0,d0,{x:0,y:0},R);
    const dIn=snell2D(d0,{x:pIn.x/R,y:pIn.y/R},1,nG);
    const pMid=rayVerticalPlane(pIn,dIn,0);
    const pOut=rayCircleFirstHit(pMid,dIn,{x:0,y:0},R);
    const dOut=snell2D(dIn,{x:-pOut.x/R,y:-pOut.y/R},nG,1);
    const pDet=rayVerticalPlane(pOut,dOut,40);

    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:s0.x,y:s0.y,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:R,insideIndex:nG,outsideIndex:1,partialReflection:false}},
      {id:'D_mid',type:'ray-detector',parameters:{x:0,y:0,orientationDeg:90,length:30}},
      {id:'D_out',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:80}}
    ]));
    const reqs=[
      {id:'mid',kind:'detector-hit-events',componentId:'D_mid'},
      {id:'out',kind:'detector-hit-events',componentId:'D_out'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true);
    assert.equal(run.summary.observations.v40EndpointsVerified,true);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.ok(Math.abs(byId.mid.value[0].pointMm.y-pMid.y)<1e-6);
    assert.ok(Math.abs(byId.out.value[0].pointMm.y-pDet.y)<1e-6);
  }

  // 3. circular-cap-dielectric (hemisphere base (0,0), normalDeg=0, R=20): horizontal ray at y=6 enters flat x=0, passes submerged D_mid at x=8, exits curved arc, hits D_out at x=40
  {
    const R=20,s0={x:-20,y:6},d0={x:1,y:0};
    const pMid={x:8,y:6};
    const pOut=rayCircleFirstHit(pMid,d0,{x:0,y:0},R);
    const dOut=snell2D(d0,{x:-pOut.x/R,y:-pOut.y/R},nG,1);
    const pDet=rayVerticalPlane(pOut,dOut,40);

    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:s0.x,y:s0.y,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'H1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:R,capHeight:R,normalDeg:0,insideIndex:nG,outsideIndex:1,partialReflection:false}},
      {id:'D_mid',type:'ray-detector',parameters:{x:8,y:0,orientationDeg:90,length:24}},
      {id:'D_out',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:80}}
    ]));
    const reqs=[
      {id:'mid',kind:'detector-hit-events',componentId:'D_mid'},
      {id:'out',kind:'detector-hit-events',componentId:'D_out'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true);
    assert.equal(run.summary.observations.v40EndpointsVerified,true);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.ok(Math.abs(byId.mid.value[0].pointMm.y-6)<1e-6);
    assert.ok(Math.abs(byId.out.value[0].pointMm.y-pDet.y)<1e-6);
  }

  // 4. triangular-prism (vertices (0,-20), (20,-20), (0,20)): horizontal ray at y=-5 enters vertical face x=0, passes submerged D_mid at x=5, exits hypotenuse 2x+y=20 (incidence 26.57 deg < TIR), hits D_out at x=50
  {
    const s0={x:-20,y:-5},d0={x:1,y:0};
    // Hypotenuse from (20,-20) to (0,20) has 2x + y = 20 -> at y = -5, x = 12.5; outward normal (2,1)/sqrt(5)
    const pOut={x:12.5,y:-5};
    const invS5=1/Math.sqrt(5);
    const dOut=snell2D(d0,{x:-2*invS5,y:-invS5},nG,1);
    const pDet=rayVerticalPlane(pOut,dOut,50);

    const {document:doc}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:s0.x,y:s0.y,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
      {id:'P1',type:'triangular-prism',parameters:{x1:0,y1:-20,x2:20,y2:-20,x3:0,y3:20,insideIndex:nG,outsideIndex:1,partialReflection:false}},
      {id:'D_mid',type:'ray-detector',parameters:{x:5,y:-5,orientationDeg:90,length:12}},
      {id:'D_out',type:'ray-detector',parameters:{x:50,y:-20,orientationDeg:90,length:80}}
    ]));
    const reqs=[
      {id:'mid',kind:'detector-hit-events',componentId:'D_mid'},
      {id:'out',kind:'detector-hit-events',componentId:'D_out'}
    ];
    const run=await evaluateDocument(doc,core,reqs);
    assert.equal(run.summary.executionPassed,true);
    assert.equal(run.summary.observations.v40EndpointsVerified,true);
    const byId=Object.fromEntries((await evaluateObservables(doc,reqs,run.summary)).results.map(r=>[r.id,r]));
    assert.equal(byId.mid.value.length,1);
    assert.equal(byId.out.value.length,1);
    assert.ok(Math.abs(byId.mid.value[0].pointMm.y-(-5))<1e-6);
    assert.ok(Math.abs(byId.out.value[0].pointMm.y-pDet.y)<1e-6);
  }
});

test('v40 submerged circle-blocker positive witnesses, negative boundary/lens/aperture controls, runtime audit, and structural deletion closure',async()=>{
  // 1. Positive witnesses: submerged circle-blocker absorbs rays cleanly inside all 4 admitted dielectric bodies
  const bodiesAndStops=[
    ['circular-dielectric',
      {id:'B1',type:'circular-dielectric',parameters:{x:0,y:0,radius:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
      {id:'K1',type:'circle-blocker',parameters:{x:0,y:0,radius:4}},
      {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}],
    ['circular-cap-dielectric',
      {id:'B1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:20,capHeight:20,normalDeg:0,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
      {id:'K1',type:'circle-blocker',parameters:{x:8,y:0,radius:3}},
      {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}],
    ['triangular-prism',
      {id:'B1',type:'triangular-prism',parameters:{x1:0,y1:-20,x2:40,y2:-20,x3:0,y3:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
      {id:'K1',type:'circle-blocker',parameters:{x:8,y:-8,radius:3}},
      {id:'S1',type:'point-source',parameters:{x:-20,y:-8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}],
    ['polygon-dielectric',
      {id:'B1',type:'polygon-dielectric',parameters:{x1:0,y1:-20,x2:40,y2:-20,x3:40,y3:20,x4:0,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
      {id:'K1',type:'circle-blocker',parameters:{x:20,y:0,radius:4}},
      {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}}]
  ];
  for(const [label,body,stop,src] of bodiesAndStops){
    const {document:doc}=prepareScene(v40Req([src,body,stop]));
    const run=await evaluateDocument(doc,core,[{id:'abs',kind:'blocker-absorptions',componentId:'K1'}]);
    assert.equal(run.summary.executionPassed,true,label);
    assert.equal(run.summary.observations.v40EndpointsVerified,true,label);
    assert.equal(run.summary.observations.blockersById.K1.absorptions,1,label);
  }

  // 2. Negative controls: boundary-crossing, < 0.01 mm inner wall clearance, spherical-lens interior, finite-aperture interior,
  //    and submerged stop-vs-source / stop-vs-detector overlaps
  const slab={id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-20,x2:40,y2:-20,x3:40,y3:20,x4:0,y4:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const lens={id:'L1',type:'spherical-lens',parameters:{x:20,y:0,apertureHeight:30,centerThickness:12,frontRadius:40,backRadius:40,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
  const srcOut={id:'S1',type:'point-source',parameters:{x:-30,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}};

  // Boundary-crossing line-blocker, ray-detector, circle-blocker -> rejected
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'K1',type:'line-blocker',parameters:{x:0,y:0,orientationDeg:0,length:10}}])),
    /line-blocker must lie strictly outside or strictly inside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'D1',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:0,length:10}}])),
    /ray-detector must lie strictly outside or strictly inside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'K1',type:'circle-blocker',parameters:{x:2,y:0,radius:3}}])),
    /opaque circle must lie outside dielectric body/);

  // < 0.01 mm inner-wall clearance (0.005 mm) -> rejected for polygon, circle, and cap
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'K1',type:'line-blocker',parameters:{x:0.005,y:0,orientationDeg:90,length:10}}])),
    /line-blocker must lie strictly outside or strictly inside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'D1',type:'ray-detector',parameters:{x:20,y:0,orientationDeg:90,length:39.99}}])),
    /ray-detector must lie strictly outside or strictly inside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'K1',type:'circle-blocker',parameters:{x:5.005,y:0,radius:5}}])),
    /opaque circle must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    srcOut,
    {id:'C1',type:'circular-dielectric',parameters:{x:20,y:0,radius:10,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'K1',type:'circle-blocker',parameters:{x:25,y:0,radius:4.995}}
  ])),/opaque circle must lie outside dielectric body/);
  assert.throws(()=>prepareScene(v40Req([
    srcOut,
    {id:'H1',type:'circular-cap-dielectric',parameters:{x:0,y:0,radius:20,capHeight:20,normalDeg:0,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
    {id:'K1',type:'circle-blocker',parameters:{x:3.005,y:0,radius:3}}
  ])),/opaque circle must lie outside dielectric body/);

  // spherical-lens stays exterior-only for line-blocker, ray-detector, circle-blocker
  assert.throws(()=>prepareScene(v40Req([srcOut,lens,{id:'K1',type:'line-blocker',parameters:{x:20,y:0,orientationDeg:90,length:4}}])),
    /line-blocker must lie outside spherical-lens body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,lens,{id:'D1',type:'ray-detector',parameters:{x:20,y:0,orientationDeg:90,length:4}}])),
    /ray-detector must lie outside spherical-lens body/);
  assert.throws(()=>prepareScene(v40Req([srcOut,lens,{id:'K1',type:'circle-blocker',parameters:{x:20,y:0,radius:2}}])),
    /opaque circle must lie outside spherical-lens body/);

  // finite-aperture stays exterior-only
  assert.throws(()=>prepareScene(v40Req([srcOut,slab,{id:'A1',type:'finite-aperture',parameters:{x:20,y:0,orientationDeg:90,length:20,openingLength:6}}])),
    /finite segment must lie outside dielectric body/);

  // Submerged stop overlapping submerged source or submerged detector -> rejected
  assert.throws(()=>prepareScene(v40Req([
    {id:'S1',type:'point-source',parameters:{x:10,y:0,brightness:0.2},emission:{mode:'single-ray',directionDeg:0}},
    slab,
    {id:'K1',type:'line-blocker',parameters:{x:10.005,y:0,orientationDeg:90,length:10}}
  ])),/each source must be at least 0\.01 mm from finite segment/);
  assert.throws(()=>prepareScene(v40Req([
    srcOut,slab,
    {id:'K1',type:'line-blocker',parameters:{x:20,y:0,orientationDeg:90,length:10}},
    {id:'D1',type:'ray-detector',parameters:{x:20,y:0,orientationDeg:0,length:10}}
  ])),/finite segments intersect or nearly touch/);

  // 3. Runtime audit fails closed on a refracted ray grazing a submerged detector endpoint (< 0.01 mm)
  {
    // Launch a single ray at 25 deg from (-20, -10) into slab x in [0, 40] (n = 1.5).
    // Its refracted path inside the slab reaches yRefract at x = 20, well clear of the unrefracted line in air,
    // so admission passes while the runtime audit catches the 0.004 mm graze on submerged D1's top endpoint!
    const rad=25*Math.PI/180,d0={x:Math.cos(rad),y:Math.sin(rad)};
    const pIn=rayVerticalPlane({x:-20,y:-10},d0,0);
    const dIn=snell2D(d0,{x:-1,y:0},1,1.5);
    const yRefract=rayVerticalPlane(pIn,dIn,20).y;
    const {document:docGraze}=prepareScene(v40Req([
      {id:'S1',type:'point-source',parameters:{x:-20,y:-10,brightness:0.2},emission:{mode:'single-ray',directionDeg:25}},
      slab,
      {id:'D1',type:'ray-detector',parameters:{x:20,y:yRefract-5+0.004,orientationDeg:90,length:10}}
    ]));
    const runGraze=await evaluateDocument(docGraze,core,[{id:'cross',kind:'detector-crossings',componentId:'D1'}]);
    assert.equal(runGraze.summary.observations,null);
    assert.equal(runGraze.summary.executionPassed,false);
    assert.match(runGraze.summary.native.errors.join(' '),/within 0\.01 mm of a finite component endpoint/);
  }

  // 4. Structural deletion closure (reviseComponents): deleting host dielectric leaves submerged stop/detector valid in ambient medium
  {
    const slab12={...slab,parameters:{...slab.parameters,outsideIndex:1.2}};
    const {document:baseDoc}=prepareScene(v40Req([
      srcOut,slab12,
      {id:'K1',type:'circle-blocker',parameters:{x:12,y:10,radius:2}},
      {id:'K2',type:'line-blocker',parameters:{x:12,y:-10,orientationDeg:90,length:6}},
      {id:'D1',type:'ray-detector',parameters:{x:25,y:0,orientationDeg:90,length:20}}
    ],{backgroundIndex:1.2,randomSeed:'closure-seed-v40'}));
    const revised=reviseComponents(baseDoc,{
      format:COMPONENT_REVISION_FORMAT,
      operations:[{op:'remove',id:'G1'}]
    }).document;
    assert.equal(revised.physics.backgroundIndex,1.2);
    assert.equal(revised.simulation.randomSeed,'closure-seed-v40');
    assert.equal(revised.physics.components.some(c=>c.id==='G1'),false);
    const runRev=await evaluateDocument(revised,core,[{id:'cross',kind:'detector-crossings',componentId:'D1'}]);
    assert.equal(runRev.summary.executionPassed,true);
    assert.equal(runRev.summary.observations.v40EndpointsVerified,true);
    assert.equal(runRev.summary.observations.detectorsById.D1.crossings,1);
  }
});
