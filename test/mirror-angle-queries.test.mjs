import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzePlaneMirrorAngleQuery,mirrorAngularCapabilities,MIRROR_FACTS_FORMAT,MIRROR_QUERY_FORMAT} from '../src/mirror-angle-queries.js';
const fixture=JSON.parse(readFileSync(new URL('../evaluation/mirror-angular-v1/first-followup.json',import.meta.url)));
const kind='mirror-incidence-from-output-direction';
const q=(ref='M1',relation='parallel')=>({format:MIRROR_QUERY_FORMAT,kind,referenceMirrorId:ref,outgoingRelation:relation,angleConvention:'from-normal'});
const facts=(angles,names=['M1','M2'])=>({format:MIRROR_FACTS_FORMAT,mirrorIds:names,consecutiveInclinationsDeg:angles});
const run=(x,y=q())=>analyzePlaneMirrorAngleQuery(x,y);
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,'Expected '+a+' to equal '+b);
function reflectVector(ray,tangentDeg){
  const a=tangentDeg*Math.PI/180,n=[-Math.sin(a),Math.cos(a)],dot=ray[0]*n[0]+ray[1]*n[1];
  return [ray[0]-2*dot*n[0],ray[1]-2*dot*n[1]];
}
test('separate U1 follow-up never changes the sealed initial authoring record or invents native geometry',()=>{
  assert.equal(fixture.source.originalTrialCanonicalSha256,'9e43d4300832d543ecb9cca3610f3756ecbbc3a74667f3116e84db9ad828b4d6');
  assert.equal(fixture.request.physical.format,MIRROR_FACTS_FORMAT);
  assert.deepEqual(fixture.request.physical.consecutiveInclinationsDeg,[70]);
  assert.ok(fixture.source.problemPath.includes('/Problems/'));
  assert.equal(fixture.source.problemPath.includes('/Solutions/'),false);
  assert.equal(Object.hasOwn(fixture.request.physical,'components'),false);
});
test('U1 inverse enumerates both mirror orientations and parallel ray directions, yielding 50 degrees from normal',()=>{
  const physical=structuredClone(fixture.request.physical),query=q();
  const snapshot=structuredClone(physical),result=run(physical,query);
  assert.equal(result.status,'conditional');near(result.value.incidenceAngleDeg,50);
  near(result.value.complementarySurfaceAngleDeg,40);
  assert.equal(result.enumeratedCases.length,4);assert.equal(result.orientationConfigurations,2);
  assert.equal(result.native.status,'not-run');
  assert.ok(result.enumeratedCases.every(v=>v.finiteMirrorHitsVerified===false));
  assert.deepEqual(physical,snapshot);
});
test('independent two-dimensional vector reflection agrees with every enumerated route',()=>{
  for(const angles of [[70],[15],[30],[45],[10,20,30],[35,70,40]]){
    const ids=Array.from({length:angles.length+1},(_,i)=>'M'+(i+1)),result=run(facts(angles,ids));
    for(const c of result.enumeratedCases){
      let ray=[Math.cos(c.inputHeadingRelativeDeg*Math.PI/180),Math.sin(c.inputHeadingRelativeDeg*Math.PI/180)];
      for(let i=0;i<ids.length;i++){
        const a=c.mirrorOrientationsRelativeDeg[i]*Math.PI/180;
        const incidentFromNormal=Math.atan2(Math.abs(ray[0]*Math.cos(a)+ray[1]*Math.sin(a)),
          Math.abs(ray[0]*(-Math.sin(a))+ray[1]*Math.cos(a)))*180/Math.PI;
        near(c.steps[i].incidenceFromNormalDeg,incidentFromNormal);
        ray=reflectVector(ray,c.mirrorOrientationsRelativeDeg[i]);
      }
      near(ray[0],Math.cos(c.outgoingHeadingRelativeDeg*Math.PI/180));
      near(ray[1],Math.sin(c.outgoingHeadingRelativeDeg*Math.PI/180));
    }
  }
});
test('independent two-mirror inclinations 30 and 45 yield incidence 30 and 0 degrees',()=>{
  near(run(facts([30])).value.incidenceAngleDeg,30);
  near(run(facts([45])).value.incidenceAngleDeg,0);
  near(run(facts([70]),q('M1','perpendicular')).value.incidenceAngleDeg,40);
});
test('four mirrors can have genuinely multiple solutions: enumerate rather than choose',()=>{
  const r=run(facts([10,20,30],['M1','M2','M3','M4']));
  assert.equal(r.status,'multiple-solutions');assert.equal(r.value,null);
  assert.deepEqual(r.candidateIncidenceAnglesDeg,[10,50]);
  assert.equal(r.reasonCode,'AMBIGUOUS_INCIDENCE');
  assert.equal(r.orientationConfigurations,8);
});
test('parallel grazing configurations are unavailable, not a valid reflected-ray result',()=>{
  for(const angle of [0,90]){
    const r=run(facts([angle]));
    assert.equal(r.status,'unavailable');assert.equal(r.value,null);
    assert.equal(r.reasonCode,'NO_NONGRAZING_SOLUTION');
    assert.equal(r.enumeratedCases.length,0);assert.ok(r.discardedGrazingCases.length>0);
  }
  assert.equal(run(facts([70]),q('M2')).status,'unavailable');
});
test('input validation rejects unsupported code, angles, duplicate/missing fields and arbitrary conventions',()=>{
  assert.throws(()=>run({...facts([70]),eval:'1+1'}),/Invalid plane-mirror facts/);
  assert.throws(()=>run(facts([NaN])),/Consecutive mirror inclination/);
  assert.throws(()=>run(facts([120])),/Consecutive mirror inclination/);
  assert.throws(()=>run(facts(['70'])),/Consecutive mirror inclination/);
  assert.throws(()=>run(facts([70],['M1','M1'])),/Duplicate plane mirror ID/);
  assert.throws(()=>run(facts([70],['M1','M2','M3'])),/one unsigned inclination/);
  assert.throws(()=>run(facts([70]),{...q(),eval:'x'}),/Invalid mirror angular query/);
  assert.throws(()=>run(facts([70]),{...q(),referenceMirrorId:'none'}),/Unknown reference mirror/);
  assert.throws(()=>run(facts([70]),{...q(),angleConvention:'from-surface'}),/from mirror normal/);
  assert.throws(()=>run(facts([70]),{...q(),outgoingRelation:'unknown'}),/Unsupported outgoing/);
  assert.throws(()=>run(facts([70]),{format:MIRROR_QUERY_FORMAT,kind}),/Invalid mirror angular query/);
  assert.equal(mirrorAngularCapabilities().kinds[0],kind);
});
