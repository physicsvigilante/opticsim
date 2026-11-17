// R2 follow-up, test-only; see independent review pr-110/reviews/review-01-chat-b.md.
// No physics admission, native modification, image inference, altered cutoffs,
// source-route injection or repair of uncertain ray intersections.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-train.json',import.meta.url),'utf8'));
const make=()=>structuredClone(fixture.physical);
const component=(r,id)=>r.components.find(c=>c.id===id);
const lens=(r,id='L1')=>component(r,id).parameters;
const source=r=>component(r,'S1');
const prepare=r=>prepareScene(r).document;
const execute=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests);
const near=(a,b,eps=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${a} differs from ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sag=(R,a)=>a*a/(R+Math.sqrt(R*R-a*a));
const requests=[{id:'face',kind:'interface-first-event',componentId:'L1'},
 {id:'count',kind:'interface-interactions',componentId:'L1'}];

function single(r=make()){
 r.components=r.components.filter(c=>c.id!=='L2');
 return r;
}
function independentFace(e,p){
 assert.ok(e&&e.pointMm&&e.incidentDirection&&e.faceId,'Actual observed native face required');
 const P=e.pointMm,h=P.y-p.y,a=p.apertureHeight/2;
 const L=p.x-p.centerThickness/2,H=p.x+p.centerThickness/2;
 const leftRim=L+sag(p.frontRadius,a),rightRim=H-sag(p.backRadius,a);
 let n;
 if(e.faceId==='front-arc'||e.faceId==='back-arc'){
  const front=e.faceId==='front-arc',R=front?p.frontRadius:p.backRadius;
  const cx=front?L+R:H-R;
  near(Math.hypot(P.x-cx,h),R,1e-5);
  near(P.x,front?cx-Math.sqrt(R*R-h*h):cx+Math.sqrt(R*R-h*h),1e-5);
  assert.ok(Math.abs(h)<=a+1e-5);
  n={x:(P.x-cx)/R,y:h/R};
 }else{
  assert.ok(['top-rim','bottom-rim'].includes(e.faceId),'Known native rim face');
  const top=e.faceId==='top-rim';
  near(P.y,p.y+(top?a:-a),1e-5);
  assert.ok(P.x>=leftRim-1e-5&&P.x<=rightRim+1e-5);
  n={x:0,y:top?1:-1};
 }
 near(e.outwardNormal.x,n.x,1e-8);
 near(e.outwardNormal.y,n.y,1e-8);
 const projection=dot(e.incidentDirection,n);
 assert.ok(Math.abs(projection)>1e-8,'No ambiguous tangent may qualify');
 const leaving=projection>0,ni=leaving?p.insideIndex:p.outsideIndex;
 const nt=leaving?p.outsideIndex:p.insideIndex;
 assert.equal(e.from,leaving?'inside':'outside');
 near(e.incidentIndex,ni);
 near(e.destinationIndex,nt);
 near(e.incidentAngleDeg,Math.atan2(Math.abs(cross(e.incidentDirection,n)),
  Math.abs(projection))*180/Math.PI,1e-7);
 for(const b of e.branches){
  const outgoingProjection=dot(b.direction,n);
  if(b.kind==='reflected'){
   near(b.direction.x,e.incidentDirection.x-2*projection*n.x,1e-7);
   near(b.direction.y,e.incidentDirection.y-2*projection*n.y,1e-7);
   assert.ok(outgoingProjection*projection<0);
  }else if(b.kind==='transmitted'){
   assert.ok(outgoingProjection*projection>0);
   near(ni*cross(e.incidentDirection,n),nt*cross(b.direction,n),1e-7);
  }else assert.fail('Unqualified grazing native outgoing direction');
 }
 if(e.outcome==='total-internal-reflection'){
  assert.ok(ni>nt,'TIR requires denser to rarer medium');
  const critical=Math.asin(nt/ni)*180/Math.PI;
  assert.ok(e.incidentAngleDeg>critical+1e-6);
  assert.equal(e.transmittedAngleDeg,null);
  assert.ok(e.branches.some(b=>b.kind==='reflected'));
  assert.equal(e.branches.some(b=>b.kind==='transmitted'),false);
 }
 return {point:P,face:e.faceId,normal:n,from:e.from,incidentIndex:ni,
  destinationIndex:nt,incidentAngleDeg:e.incidentAngleDeg,
  outcome:e.outcome,branches:e.branches};
}
async function verifyWithholding(doc,run,what){
 const evaluation=await evaluateObservables(doc,requests,run.summary);
 if(run.summary.native.status==='incomplete'||run.summary.executionPassed===false){
  assert.equal(run.summary.observations,null);
  assert.ok(evaluation.results.every(e=>e.status==='suppressed'&&e.value===null),
   what+': incomplete native results must be withheld');
 }
 return evaluation.results.map(e=>e.status);
}

test('R2-01 reverse illumination actually enters L2 back, exits front, then traverses L1 right-to-left',()=>{
 const r=make();
 Object.assign(source(r).parameters,{x:400,y:10});
 source(r).emission.directionDeg=180;
 Object.assign(component(r,'D1').parameters,{x:-200,y:0,length:400});
 const doc=prepare(r),native=inspectNative(doc);
 const hits=native.trace.filter(x=>x.type==='spherical-lens');
 assert.deepEqual(hits.map(x=>x.id),['L2','L2','L1','L1']);
 const expected=[164.498743710662,135.435871918,14.973863408,-14.996035356];
 const faceIds=['back-arc','front-arc','back-arc','front-arc'];
 hits.forEach((h,i)=>near(h.point.x,expected[i],2e-5));
 const m=native.diagnostic.interfacesById;
 for(const [i,id] of ['L2','L1'].entries()){
  assert.equal(m[id].interactions,2);
  const first=m[id].faces['back-arc'].first,second=m[id].faces['front-arc'].first;
  assert.equal(first.faceId,faceIds[2*i]);
  assert.equal(second.faceId,faceIds[2*i+1]);
  assert.equal(first.from,'outside');assert.equal(second.from,'inside');
  independentFace(first,lens(r,id));independentFace(second,lens(r,id));
 }
 assert.equal(native.diagnostic.detectorsById.D1.crossings,1);
 console.log('V15_R2_REVERSE_NATIVE '+JSON.stringify({
  status:'completed',ids:hits.map(x=>x.id),points:hits.map(x=>x.point),
  firstByLens:Object.fromEntries(['L1','L2'].map(id=>[id,m[id].first]))
 }));
});

test('R2-01 actual top and bottom thin-rim arrivals retain correct native face and media',async()=>{
 for(const sign of [1,-1]){
  const r=single();
  const p=lens(r),a=p.apertureHeight/2;
  p.centerThickness=2*sag(100,a)+1.02; // near one-mm rim, no native vertex targeted
  Object.assign(source(r).parameters,{x:-200,y:sign*55});
  source(r).emission.directionDeg=Math.atan2(-sign*5,200)*180/Math.PI;
  const doc=prepare(r),run=execute(doc,requests);
  const meter=run.report.native.diagnostics.interfacesById.L1;
  assert.ok(meter&&meter.first,'Real pinned native rim hit was required');
  const first=meter.first;
  assert.equal(first.faceId,sign>0?'top-rim':'bottom-rim');
  near(first.pointMm.x,0,1e-4);near(first.pointMm.y,sign*a,1e-4);
  assert.equal(first.outcome,'transmission');
  assert.equal(first.from,'outside');
  const face=independentFace(first,p);
  assert.equal(meter.faces[first.faceId].interactions>=1,true);
  const statuses=await verifyWithholding(doc,run,'rim');
  console.log('V15_R2_RIM_NATIVE '+JSON.stringify({
   sign,status:run.summary.native.status,truncation:run.summary.native.truncation,
   first:face,events:meter.interactions,results:statuses
  }));
 }
});

test('R2-03 controlled just-subcritical and TIR back-arc rays retain native branch semantics',async()=>{
 const critical=Math.asin(1/1.5)*180/Math.PI;
 const controls=[
  {angle:-21.3,expected:41.68015511204903,tir:false},
  {angle:-22,expected:42.03918997342736,tir:true}
 ];
 for(const control of controls){
  const r=single(),p=lens(r),impactY=40;
  const firstX=p.x-p.centerThickness/2+p.frontRadius-
   Math.sqrt(p.frontRadius**2-impactY**2);
  Object.assign(source(r).parameters,{x:-200,
   y:impactY-(firstX+200)*Math.tan(control.angle*Math.PI/180)});
  source(r).emission.directionDeg=control.angle;
  const doc=prepare(r),run=execute(doc,requests),m=run.report.native.diagnostics.interfacesById.L1;
  assert.ok(m&&m.faces['back-arc'].first,'Actual second/back curved-face event required');
  const front=m.faces['front-arc'].first,back=m.faces['back-arc'].first;
  near(front.pointMm.y,40,1e-5);
  independentFace(front,p);const physical=independentFace(back,p);
  near(back.incidentAngleDeg,control.expected,2e-4);
  assert.equal(back.from,'inside');
  assert.ok(control.tir?back.incidentAngleDeg>critical:back.incidentAngleDeg<critical);
  if(control.tir){
   assert.equal(back.outcome,'total-internal-reflection');
   assert.equal(back.branches.some(b=>b.kind==='transmitted'),false);
  }else{
   assert.equal(back.outcome,'transmission');
   assert.ok(back.branches.some(b=>b.kind==='transmitted'));
   near(1.5*Math.sin(back.incidentAngleDeg*Math.PI/180),
    Math.sin(back.transmittedAngleDeg*Math.PI/180),1e-7);
  }
  const statuses=await verifyWithholding(doc,run,'critical');
  console.log('V15_R2_CRITICAL_NATIVE '+JSON.stringify({
   angle:control.angle,critical,case:control.tir?'TIR':'subcritical',
   status:run.summary.native.status,first:front,back:physical,results:statuses,
   truncation:run.summary.native.truncation
  }));
 }
});

test('R2-03 native full Fresnel first event matches independent unpolarized s/p power',async()=>{
 const r=single();
 lens(r).partialReflection=true;
 const doc=prepare(r),run=execute(doc,requests),first=run.report.native.diagnostics.interfacesById.L1.first;
 assert.equal(first.faceId,'front-arc');
 const physical=independentFace(first,lens(r));
 assert.equal(first.partialReflection,true);
 const inc=first.incidentAngleDeg*Math.PI/180;
 const trans=Math.asin(Math.sin(inc)/1.5);
 const Rs=((Math.cos(inc)-1.5*Math.cos(trans))/
   (Math.cos(inc)+1.5*Math.cos(trans)))**2;
 const Rp=((1.5*Math.cos(inc)-Math.cos(trans))/
   (1.5*Math.cos(inc)+Math.cos(trans)))**2;
 const R=(Rs+Rp)/2;
 const reflected=first.branches.find(b=>b.kind==='reflected');
 const transmitted=first.branches.find(b=>b.kind==='transmitted');
 assert.ok(reflected&&transmitted,'Both actual native branches must be observed');
 near(reflected.relativePower/first.incidentRelativePower,R,1e-6);
 near(transmitted.relativePower/first.incidentRelativePower,1-R,1e-6);
 const statuses=await verifyWithholding(doc,run,'fresnel');
 console.log('V15_R2_FRESNEL_NATIVE '+JSON.stringify({
  status:run.summary.native.status,first:physical,reference:{Rs,Rp,R},
  actual:{reflected:reflected.relativePower,transmitted:transmitted.relativePower},
  totalTruncation:run.summary.native.truncation,results:statuses
 }));
});

test('R2-02 extreme spherical parameters instantiate finite native six-point arcs',async()=>{
 const cases=[
  {name:'minimum radius',x:0,apertureHeight:100,centerThickness:90,
   frontRadius:51,backRadius:51,srcX:-200,srcY:10},
  {name:'very flat at origin',x:0,apertureHeight:4,centerThickness:2,
   frontRadius:10000,backRadius:10000,srcX:-200,srcY:0.5},
  {name:'very flat near coordinate limit',x:9998,apertureHeight:4,centerThickness:2,
   frontRadius:10000,backRadius:10000,srcX:9980,srcY:0.5},
  {name:'minimum valid rim',x:0,apertureHeight:100,
   centerThickness:2*sag(100,50)+1.0001,
   frontRadius:100,backRadius:100,srcX:-200,srcY:10}
 ];
 for(const spec of cases){
  const r=single(),p=lens(r),{name,srcX,srcY,...fields}=spec;
  Object.assign(p,fields);
  Object.assign(source(r).parameters,{x:srcX,y:srcY});
  r.components=r.components.filter(c=>c.type!=='ray-detector');
  const doc=prepare(r),loaded=core.loadDocument(doc);
  const native=loaded.scene.objs[loaded.idMap.get('L1')],path=native.path;
  assert.equal(native.constructor.type,'SphericalLens');
  assert.equal(path?.length,6);
  assert.deepEqual(path.map(q=>Boolean(q.arc)),[false,false,true,false,false,true]);
  assert.ok(path.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
  const a=p.apertureHeight/2,left=p.x-p.centerThickness/2,right=p.x+p.centerThickness/2;
  const frontRim=left+sag(p.frontRadius,a),backRim=right-sag(p.backRadius,a);
  for(const i of [0,4])near(path[i].x,frontRim,2e-6);
  for(const i of [1,3])near(path[i].x,backRim,2e-6);
  near(path[2].x,right,1e-6);near(path[5].x,left,1e-6);
  near(path[0].y,-(p.y+a));near(path[4].y,-(p.y-a));
  const run=execute(doc,[{id:'count',kind:'interface-interactions',componentId:'L1'}]);
  if(run.summary.native.status==='completed'){
   assert.ok(run.summary.observations.interfacesById.L1.interactions>=1,
    'On-axis/near-axis directed ray must not silently miss a valid native body');
   independentFace(run.report.native.diagnostics.interfacesById.L1.first,p);
  }else{
   assert.equal(run.summary.executionPassed,false);
   assert.equal(run.summary.observations,null);
  }
  console.log('V15_R2_EXTREME_NATIVE '+JSON.stringify({
   name,status:run.summary.native.status,rawFirst:run.report.native.diagnostics.interfacesById.L1.first,
   path,processed:run.summary.native.processed,
   truncation:run.summary.native.truncation
  }));
 }
});

test('R2-02 conservative adjacent admission boundaries never silently change physical values',()=>{
 const b=make(),L=lens(b),a=L.apertureHeight/2;
 const min=2*sag(100,a)+1;
 for(const delta of [1e-4,1e-3]){
  const yes=make();lens(yes).centerThickness=min+delta;assert.equal(prepare(yes).schemaVersion,15);
  const no=make();lens(no).centerThickness=min-delta;assert.throws(()=>prepare(no));
 }
 for(const [x,admit] of [[30.011,true],[30.009,false]]){
  const r=make();lens(r,'L2').x=x;
  if(admit)assert.equal(prepare(r).schemaVersion,15);
  else assert.throws(()=>prepare(r));
 }
 for(const [distance,admit] of [[0.011,true],[0.009,false]]){
  const src=single();source(src).parameters.x=-15-distance;
  if(admit)assert.equal(prepare(src).schemaVersion,15);
  else assert.throws(()=>prepare(src));
  const det=single();component(det,'D1').parameters.x=15+distance;
  if(admit)assert.equal(prepare(det).schemaVersion,15);
  else assert.throws(()=>prepare(det));
 }
 const firstRim=-15+sag(100,50);
 // The authored guard measures PERPENDICULAR distance to the forward ray,
 // not a horizontal x offset. With this nearly horizontal direction, a
 // +0.02 mm x shift still misses the corner by only ~0.0005 mm and must
 // refuse. The +0.5 mm x control clears the original 0.01 mm guard.
 for(const [delta,admit] of [[0.005,false],[0.02,false],[0.5,true]]){
  const r=single();
  Object.assign(source(r).parameters,{x:-200,y:55});
  source(r).emission.directionDeg=Math.atan2(-5,firstRim+delta+200)*180/Math.PI;
  if(admit)assert.equal(prepare(r).schemaVersion,15);
  else assert.throws(()=>prepare(r),'Forward near-corner authoring must refuse before native tracing');
 }
 console.log('V15_R2_BOUNDARY_EVIDENCE '+JSON.stringify({
  minRimReference:min,justAboveBelow:true,closeLensGap:true,
  sourceDetectorClearance:true,nearCornerControl:true
 }));
});

test('R2-02 near-clearance native rays actually meet both bodies and nearby detectors',async()=>{
 const trials=[
  {name:'0.011-mm interlens axial gap',edit:r=>{
   source(r).parameters.y=0;
   lens(r,'L2').x=30.011;
  },counts:{L1:2,L2:2},detector:1},
  {name:'0.011-mm source-to-front axial entry',edit:r=>{
   single(r);
   Object.assign(source(r).parameters,{x:-15.011,y:0});
  },counts:{L1:2},detector:1},
  {name:'0.011-mm back-face-to-detector crossing',edit:r=>{
   single(r);
   source(r).parameters.y=0;
   component(r,'D1').parameters.x=15.011;
  },counts:{L1:2},detector:1}
 ];
 for(const spec of trials){
  const r=make();spec.edit(r);
  const doc=prepare(r);
  const out=execute(doc,fixture.requests);
  assert.equal(out.summary.native.status,'completed',
   spec.name+' must not silently qualify an incomplete native ray');
  assert.equal(out.summary.executionPassed,true);
  for(const [id,count] of Object.entries(spec.counts)){
   const meter=out.summary.observations.interfacesById[id];
   assert.equal(meter.interactions,count,spec.name+' genuine native lens interactions');
   for(const face of ['front-arc','back-arc'])
    independentFace(meter.faces[face].first,lens(r,id));
  }
  assert.equal(out.summary.observations.detectorsById.D1.crossings,spec.detector);
  console.log('V15_R2_CLEARANCE_NATIVE '+JSON.stringify({
   case:spec.name,status:out.summary.native.status,
   meters:out.summary.observations.interfacesById,
   detectorCrossings:out.summary.observations.detectorsById.D1.crossings
  }));
 }
 const corner=single(make()),p=lens(corner),frontRim=-p.centerThickness/2+
  sag(p.frontRadius,p.apertureHeight/2);
 Object.assign(source(corner).parameters,{x:-200,y:55});
 source(corner).emission.directionDeg=Math.atan2(-5,frontRim+0.5+200)*180/Math.PI;
 const doc=prepare(corner),out=execute(doc,requests);
 const first=out.report.native.diagnostics.interfacesById.L1.first;
 assert.ok(first&&first.faceId==='top-rim','Accepted near-corner ray must really reach the top rim');
 const face=independentFace(first,p);
 const results=await verifyWithholding(doc,out,'accepted near-corner');
 console.log('V15_R2_NEAR_CORNER_NATIVE '+JSON.stringify({
  status:out.summary.native.status,first:face,truncation:out.summary.native.truncation,
  results
 }));
});
