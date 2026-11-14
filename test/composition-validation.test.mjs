import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {validate,serializeSave,mirrorEndpoints} from '../src/contract.js';
import {finiteSurfaceGeometry,segmentsIntersect,pointWithinSupportingLineClearance,
  finiteSurfacesConflict} from '../src/composition-validation.js';
import {finiteGlassFaces,segmentOutsideFiniteGlass} from '../src/finite-glass-geometry.js';
import {compositionCompatibilityCases,compatibilityInput} from './helpers/composition-compatibility.mjs';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const golden=JSON.parse(readFileSync(new URL('./fixtures/composition-compatibility-baseline.json',import.meta.url)));
const hash=text=>createHash('sha256').update(text).digest('hex');
const line=(x1,y1,x2,y2)=>[{x:x1,y:y1},{x:x2,y:y2}];
const surface=(line,aperture=false)=>({line,aperture});
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}

test('all pre-refactor scene/migration, rejection and incomplete-execution fingerprints stay identical',()=>{
  const cases=compositionCompatibilityCases();
  assert.equal(golden.baselineCommit,'4e8d63927283ced8f17a42aaa7b8da36bec0eba8');
  assert.deepEqual(cases.map(c=>c.id),golden.records.map(r=>r.id),'Review new fixtures explicitly; do not auto-refresh baselines');
  for(const [i,entry] of cases.entries()){
    const expected=golden.records[i],doc=compatibilityInput(entry),before=JSON.stringify(doc);
    if(!expected.valid){
      assert.throws(()=>validate(doc),error=>error.path===expected.path&&error.code===expected.code&&error.message===expected.message,entry.id);
    }else{
      assert.equal(validate(doc),doc,entry.id+' validator must retain object identity');
      const text=serializeSave(doc),report=checkCandidate(text,core);
      assert.equal(doc.schemaVersion,expected.version,entry.id);
      assert.equal(doc.physics.model,expected.model,entry.id);
      assert.equal(hash(text),expected.canonical,entry.id+' canonical bytes');
      assert.equal(hash(core.nativeExport(doc)),expected.native,entry.id+' native export');
      assert.equal(hash(JSON.stringify(report)),expected.report,entry.id+' actual native/analytical report');
      assert.equal(report.native.status,expected.status,entry.id+' completion');
    }
    assert.equal(JSON.stringify(doc),before,entry.id+' input must remain unchanged');
  }
});

test('shared finite geometry preserves lens endpoints and transparent aperture gaps without mutations',()=>{
  const lens=freeze({type:'ideal-lens',parameters:{x:4,apertureHeight:6,focalLength:20}});
  assert.deepEqual(finiteSurfaceGeometry(lens,mirrorEndpoints),{line:line(4,-3,4,3),segments:[line(4,-3,4,3)],aperture:false});
  for(const type of ['plane-mirror','ray-detector','line-blocker']){
    const c=freeze({type,parameters:{x:0,y:0,orientationDeg:0,length:10}});
    assert.deepEqual(finiteSurfaceGeometry(c,mirrorEndpoints),{line:line(-5,0,5,0),segments:[line(-5,0,5,0)],aperture:false});
  }
  const stop=freeze({type:'finite-aperture',parameters:{x:0,y:0,orientationDeg:0,length:10,openingLength:4}});
  const g=finiteSurfaceGeometry(stop,mirrorEndpoints);
  assert.deepEqual(g,{line:line(-5,0,5,0),segments:[line(-5,0,-2,0),line(2,0,5,0)],aperture:true});
  for(const arm of g.segments)assert.equal(finiteSurfacesConflict(surface(arm,true),surface(line(0,-1,0,1)),.01),false);
  assert.equal(finiteSurfacesConflict(surface(g.segments[1],true),surface(line(3,-1,3,1)),.01),true);
  assert.throws(()=>finiteSurfaceGeometry({type:'circular-dielectric',parameters:{}},mirrorEndpoints),TypeError);
});

test('shared crossing predicate keeps endpoint, collinear and reversed-segment admission decisions',()=>{
  const a=line(0,0,2,0);
  for(const [b,expected] of [[line(1,-1,1,1),true],[line(2,0,3,1),true],
    [line(1,0,3,0),true],[line(3,0,4,0),false],[line(0,1,2,1),false],
    [line(3,-1,3,1),false],[line(0,1,2,1+1e-13),false]]){
    for(const aa of [a,[...a].reverse()])for(const bb of [b,[...b].reverse()])
      assert.equal(segmentsIntersect(aa,bb),expected);
  }
});

test('aperture clearance is not silently imposed on ordinary mirror/detector segments',()=>{
  const a=surface(line(0,0,2,0));
  for(const gap of [.009,.01,.011]){
    const b=surface(line(0,gap,2,gap));
    assert.equal(finiteSurfacesConflict(a,b,.01),false,'ordinary historical rule');
    assert.equal(finiteSurfacesConflict({...a,aperture:true},b,.01),gap<.01,'unchanged strict cutoff');
    assert.equal(finiteSurfacesConflict(b,{...a,aperture:true},.01),gap<.01,'same pair in reverse order');
  }
  assert.equal(finiteSurfacesConflict(a,surface(line(1,-1,1,1)),.01),true);
});

test('source clearance still applies to the entire supporting line, with caller-selected tolerance',()=>{
  const p={x:0,y:0,orientationDeg:0,length:2};
  for(const y of [0,.009,.01,.011,-.009,-.01])
    assert.equal(pointWithinSupportingLineClearance({x:100,y},p,.01),Math.abs(y)<.01);
  assert.equal(pointWithinSupportingLineClearance({x:0,y:.015},p,.02),true);
  for(const angle of [-90,-37,0,37,90]){
    const a=angle*Math.PI/180,q={x:25,y:-30,orientationDeg:angle};
    for(const distance of [.009,.011]){
      const point={x:q.x+100*Math.cos(a)-distance*Math.sin(a),y:q.y+100*Math.sin(a)+distance*Math.cos(a)};
      assert.equal(pointWithinSupportingLineClearance(point,q,.01),distance<.01);
    }
  }
});

test('triangular and quadrilateral external-segment proofs preserve the old formula across transforms',()=>{
  for(const vertices of [[{x:0,y:0},{x:20,y:0},{x:0,y:20}],
    [{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]]){
    for(const winding of [vertices,[...vertices].reverse()])for(const degrees of [0,37,90])for(const scale of [.1,1,10]){
      const a=degrees*Math.PI/180,transform=p=>({x:250+scale*(p.x*Math.cos(a)-p.y*Math.sin(a)),y:-75+scale*(p.x*Math.sin(a)+p.y*Math.cos(a))});
      const faces=freeze(finiteGlassFaces(winding.map(transform)));
      for(const raw of [line(2,-2,10,-2),line(1,1,2,2),line(-1,1,1,1),line(2,-.01,10,-.01)]){
        const segment=freeze(raw.map(transform)),clearance=.01*scale;
        // Preservation reference, not an independent physical solver.
        const legacy=faces.some(f=>segment.every(q=>(q.x-f.a.x)*f.normal.x+(q.y-f.a.y)*f.normal.y>=clearance));
        assert.equal(segmentOutsideFiniteGlass(faces,segment,clearance),legacy);
      }
    }
  }
});
