import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url));
const parse=path=>JSON.parse(read(path));
const frozen=read('../evaluation/perpendicular-dielectric-faces-v1/frozen-protocol.json');
const protocol=JSON.parse(frozen);
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const a17=parse('../examples/two-face-grazing-entry.json'),a19=parse('../examples/two-face-sidewall-acceptance.json');
const numeric=ratio=>({basis:'common-exterior',coreToExteriorRatio:ratio});
const absolute=(entranceIndex,coreIndex,wallExteriorIndex)=>({basis:'absolute-indices',entranceIndex,coreIndex,wallExteriorIndex});
const input=(problem,materials)=>({...problem,physical:{...problem.physical,materials}});
const check=(p,m)=>planProblem(input(p,m)).results[0];
const rad=Math.PI/180;
const near=(x,y,t)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=t,JSON.stringify({actual:x,expected:y,tolerance:t}));
const outputBase='test-artifacts/llm-authoring';
mkdirSync(outputBase,{recursive:true});
const out=mkdtempSync(join(outputBase,'perpendicular-faces-'));
const save=(name,data)=>writeFileSync(join(out,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});

test('versioned public authoring returns source-bound limits and no native scene',async()=>{
  assert.equal(createHash('sha256').update(frozen).digest('hex'),'3a94ace7ddee5d5cecdc8d173a21c180baba08ae89816b38612930cd2cfa2d3f');
  assert.equal(parse('../upstream-pin.json').commit,protocol.pin);
  const catalogue=parse('../evaluation/optical-systems-atlas-v1/review.json');
  for(const [i,example] of ['two-face-grazing-entry','two-face-sidewall-acceptance'].entries()){
    const c=protocol.cases[i],atlas=catalogue.cases.find(x=>x.id===c.id);
    assert.ok(atlas.problemPath.endsWith(c.problem));assert.equal(atlas.imageSha256,c.sha256);
    const evidence=await runProblemEvidence({inputBytes:read('../examples/'+example+'.json'),outputPath:join(out,example)});
    assert.equal(evidence.report.native.status,'not-run');
    const result=evidence.report.results[0];assert.equal(result.status,'conditional');
    if(i===0)assert.equal(result.value.upperRelativeIndex,'sqrt(2)');
    else near(result.value.launchSupremumDeg,Math.asin(Math.sqrt(1.36**2-1))/rad,1e-10);
    assert.equal(problemWorkflowCapabilities().requestKinds[result.kind].route,'conditional-analytical');
  }
});
test('open launch intervals, material ambiguity, and numerical boundaries',()=>{
  assert.equal(check(a17,numeric(1.25)).value.emergenceAngleDeg,Math.asin(.75)/rad);
  assert.equal(check(a17,numeric(1.6)).value.limitingWallOutcome,'total-internal-reflection');
  assert.equal(check(a17,numeric(Math.SQRT2)).status,'numerically-indeterminate');
  assert.equal(check(a19,numeric(1.7)).value.allInteriorLaunches,true);
  const equal=check(a19,absolute(1.5,2.5,2));
  assert.equal(equal.value.launchSupremumDeg,90);assert.ok(equal.value.upperBoundary.includes('critical'));
  assert.equal(check(a19,absolute(1.5,2.5+1e-14,2)).status,'numerically-indeterminate');
  assert.equal(check(a19,numeric(1+Number.EPSILON)).status,'numerically-indeterminate');
  near(check(a19,absolute(1.5,1.6,1.2)).value.launchSupremumDeg,Math.asin(Math.sqrt(1.6**2-1.2**2)/1.5)/rad,1e-10);
  for(const [m,status] of [[absolute(1.5,1.6,1.2),'unavailable'],[{basis:'common-exterior'},'needs-information'],
    [{...numeric(1.25),wallExteriorIndex:1},'invalid-input'],[numeric(0),'invalid-input'],[absolute(2,1.6,1),'unavailable']])
    assert.equal(check(a17,m).status,status);
  const duplicate=structuredClone(a19);duplicate.physical.wallFaceId=duplicate.physical.entryFaceId;
  assert.equal(planProblem(duplicate).results[0].status,'invalid-input');
});
for(const c of protocol.cases)for(const control of c.controls)test(c.id+' native v9 at '+control.angle+' degrees, index '+control.core,()=>{
  const {core:n,angle,outcome}=control,sourceAngle=angle*rad;
  const source={id:'S',type:'point-source',parameters:{x:-5,y:70-5*Math.tan(sourceAngle),brightness:.08},
    emission:{mode:'single-ray',directionDeg:angle}};
  const glass={id:'G',type:'polygon-dielectric',parameters:{x1:0,y1:0,x2:100,y2:0,x3:100,y3:100,x4:0,y4:100,
    insideIndex:n,outsideIndex:1,partialReflection:false}};
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'preview-v1',components:[source,glass]}).document;
  assert.equal(doc.schemaVersion,9);assert.equal(doc.upstreamCommit,protocol.pin);
  const requests=[{id:'faces',kind:'interface-face-events',componentId:'G'}];
  const {summary}=evaluateDocument(doc,core,requests);
  save(c.id+'-'+angle+'-'+n+'.json',{scene:doc,requests,summary,control});
  assert.equal(summary.executionPassed,true);assert.equal(summary.native.status,'completed');
  assert.deepEqual(summary.native.warnings,[]);assert.equal(summary.native.truncation,0);assert.equal(summary.native.undefinedBehavior,0);
  assert.equal(summary.native.emitted,1);
  const glassMeter=summary.observations.interfacesById.G;
  assert.equal(glassMeter.first.faceId,'face-41');
  const entry=glassMeter.faces['face-41'].first,wall=glassMeter.faces['face-34'].first;
  assert.equal(entry.outcome,'transmission');assert.equal(wall.incidentIndex,n);
  const sy=Math.sin(sourceAngle)/n,cx=Math.sqrt(1-sy*sy);
  const close=(x,y)=>near(x,y,protocol.native.unitVectorTolerance);
  close(entry.branches[0].direction.x,cx);close(entry.branches[0].direction.y,sy);
  close(wall.incidentDirection.x,cx);close(wall.incidentDirection.y,sy);
  near(entry.pointMm.x,0,protocol.native.pointToleranceMm);near(entry.pointMm.y,70,protocol.native.pointToleranceMm);
  near(wall.pointMm.x,30*cx/sy,protocol.native.pointToleranceMm);near(wall.pointMm.y,100,protocol.native.pointToleranceMm);
  assert.equal(wall.branches.length,1);
  assert.equal(wall.outcome,outcome==='tir'?'total-internal-reflection':'transmission');
  const outgoing=wall.branches[0].direction;
  close(outgoing.x,outcome==='tir'?cx:n*cx);
  close(outgoing.y,outcome==='tir'?-sy:Math.sqrt(1-(n*cx)**2));
  const prediction=check(c.id==='A17'?a17:a19,numeric(n)).value;
  if(c.id==='A19')assert.equal(angle<prediction.launchSupremumDeg,outcome==='tir');
  else if(outcome==='transmitted')assert.ok(wall.transmittedAngleDeg>prediction.emergenceAngleDeg);
  else assert.equal(prediction.limitingWallOutcome,'total-internal-reflection');
});
