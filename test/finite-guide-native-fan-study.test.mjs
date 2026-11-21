import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/finite-guide-native-fan-study-v1/frozen.json',import.meta.url)));
const g=frozen.explicitSyntheticGeometry,n=g.coreIndex,rad=Math.PI/180;
const root='test-artifacts/llm-authoring';
mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'finite-guide-native-fan-'));
const point=(x,y)=>({x,y:-y});
const vertex=(x,y)=>({...point(x,y),arc:false});
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,JSON.stringify({actual:a,expected:b}));

function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,length=Math.hypot(dx,dy);
  return {x:dx/length,y:dy/length,heading:Math.atan2(dy,dx)/rad};
}
function face(x,y){
  const matches=[['left',x,0],['right',x,80],['top',y,10],['bottom',y,-10]]
    .filter(([,actual,value])=>Math.abs(actual-value)<1e-8);
  assert.equal(matches.length,1,JSON.stringify({x,y}));
  return matches[0][0];
}
function trace(axis,opening=null){
  const [startX,startY]=g.sourceXYmm;
  const source={type:opening===null?'SingleRay':'AngleSource',p1:point(startX,startY),
    p2:point(startX+20*Math.cos(axis*rad),startY+20*Math.sin(axis*rad)),brightness:g.brightness,
    ...(opening===null?{}:{emisAngle:opening,symmetric:true})};
  const [left,right]=g.leftRightXmm,[bottom,top]=g.bottomTopYmm,d=g.outletDetector;
  const native={version:5,width:1200,height:700,origin:{x:250,y:350},scale:1,mode:'rays',
    rayModeDensity:g.density,maxRayDepth:g.nativeDepth,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
      source,
      {type:'Glass',path:[vertex(left,bottom),vertex(right,bottom),vertex(right,top),vertex(left,top)],
        refIndex:n/g.outsideIndex,partialReflect:g.partialReflection},
      {type:'Detector',p1:point(d.xMm,d.centreYmm-d.heightMm/2),p2:point(d.xMm,d.centreYmm+d.heightMm/2),irradMap:false}
    ]};
  const scene=core.loadNative(native),[emitter,guide,outlet]=scene.objs;
  const byRay=new Map();
  const nativeStart=emitter.onSimulationStart,glassIncident=guide.onRayIncident,detectorIncident=outlet.onRayIncident;
  let starts=0,terminal;
  emitter.onSimulationStart=function(...args){
    const result=nativeStart.apply(this,args);
    starts++;
    for(const ray of result.newRays){
      assert.equal(byRay.has(ray),false);
      byRay.set(ray,{emission:direction(ray),interfaces:[],detectors:[]});
    }
    return result;
  };
  guide.onRayIncident=function(ray,index,hit,...args){
    const record=byRay.get(ray),before=direction(ray),x=hit.x,y=-hit.y;
    assert.ok(record);
    const result=glassIncident.call(this,ray,index,hit,...args);
    assert.ok(!result?.newRays?.length&&!result?.isAbsorbed&&!result?.isUndefinedBehavior);
    record.interfaces.push({face:face(x,y),x,y,before,after:direction(ray)});
    return result;
  };
  outlet.onRayIncident=function(ray,index,hit,...args){
    const record=byRay.get(ray),before=direction(ray);
    assert.ok(record);
    record.detectors.push({x:hit.x,y:-hit.y,before});
    return detectorIncident.call(this,ray,index,hit,...args);
  };
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,1000);
  for(const event of ['simulationComplete','simulationStop'])simulator.on(event,()=>{terminal=event;});
  simulator.updateSimulation();
  const diagnostics=core.diagnostics(scene,simulator,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(starts,1);
  return {native,terminal,diagnostics,status:core.classifyRun(terminal,diagnostics),rays:[...byRay.values()]};
}
function isSideReflection(event){
  return ['top','bottom'].includes(event.face)&&event.before.y*event.after.y<0;
}
function checkNonCritical(outcome,angles,cases){
  assert.equal(outcome.status,'completed');
  assert.equal(outcome.rays.length,angles.length);
  for(const [i,record] of outcome.rays.entries()){
    const expected=cases[i],hits=record.interfaces;
    close(record.emission.heading,angles[i]);
    assert.equal(hits[0].face,'left');
    assert.equal(hits[1].face,expected.side);
    assert.equal(hits.at(-1).face,expected.exit);
    const reflections=hits.filter(isSideReflection);
    assert.equal(reflections.length,expected.tirCount);
    const transverseIn=Math.sin(angles[i]*rad)/n;
    close(hits[0].after.y,transverseIn);
    for(const [j,hit] of reflections.entries()){
      assert.equal(hit.face,j%2===0?expected.side:expected.side==='top'?'bottom':'top');
      close(hit.before.x,hit.after.x);
      close(hit.before.y,-hit.after.y);
      assert.ok(n*Math.abs(hit.before.x)>1.01);
    }
    for(const hit of hits){
      const wallEndClearance=['left','right'].includes(hit.face)?10-Math.abs(hit.y):Math.min(hit.x,80-hit.x);
      assert.ok(wallEndClearance>.5);
    }
    if(expected.exit==='right'){
      assert.equal(record.detectors.length,1);
      close(record.detectors[0].before.heading,angles[i]*(-1)**expected.tirCount);
    }else{
      const escaped=hits.at(-1);
      const x=n*escaped.before.x,y=Math.sign(escaped.before.y)*Math.sqrt(1-x*x);
      close(escaped.after.x,x);
      close(escaped.after.y,y);
      assert.ok(x<.99);
      const outletY=escaped.y+(g.outletDetector.xMm-escaped.x)*y/x;
      assert.equal(record.detectors.length,Math.abs(outletY)<g.outletDetector.heightMm/2?1:0);
      if(record.detectors.length)close(record.detectors[0].y,outletY);
    }
    const single=trace(angles[i]);
    assert.equal(single.status,'completed');
    assert.equal(single.rays.length,1);
    const control=single.rays[0];
    assert.deepEqual(control.interfaces.map(v=>v.face),hits.map(v=>v.face));
    assert.equal(control.detectors.length,record.detectors.length);
    for(const [j,event] of control.interfaces.entries()){
      close(event.x,hits[j].x);
      close(event.y,hits[j].y);
      close(event.after.heading,hits[j].after.heading);
    }
    writeFileSync(join(out,'single-'+angles[i]+'.json'),JSON.stringify(single,null,2),{flag:'wx'});
  }
}

test('pinned AngleSource samples guided and leaked rays through one finite Glass rectangle',()=>{
  const c=frozen.upperFan,result=trace(c.axisDeg,c.openingDeg);
  checkNonCritical(result,c.sampledIncidenceDeg,c.predicted);
  writeFileSync(join(out,'upper.json'),JSON.stringify(result,null,2),{flag:'wx'});
});

test('mirrored meridional control has the same supported branch data with reversed transverse signs',()=>{
  const c=frozen.lowerFan,result=trace(c.axisDeg,c.openingDeg);
  const expected=[...frozen.upperFan.predicted].reverse().map(p=>({...p,side:'bottom',exit:p.exit==='top'?'bottom':p.exit}));
  checkNonCritical(result,c.sampledIncidenceDeg,expected);
  writeFileSync(join(out,'lower.json'),JSON.stringify(result,null,2),{flag:'wx'});
});

test('a sampled sidewall critical limit remains outside whole-fan qualification',()=>{
  const limit=Math.asin(Math.sqrt(n*n-1))/rad,opening=frozen.criticalFan.openingDeg;
  const result=trace(limit-opening/2,opening);
  const nearLimit=result.rays[0];
  close(nearLimit.emission.heading,limit);
  const firstWall=nearLimit.interfaces[1];
  assert.equal(firstWall.face,'top');
  close(n*Math.abs(firstWall.before.x),1,1e-12);
  // Preserve the actual represented experiment without certifying its branch.
  writeFileSync(join(out,'critical.json'),JSON.stringify({qualification:'withheld-critical-sample',...result},null,2),{flag:'wx'});
});
