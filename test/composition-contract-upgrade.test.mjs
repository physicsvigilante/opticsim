import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {reviseComponents} from '../src/authoring.js';
import {prepareQualifiedStructure,qualifiedStructureCapabilities} from '../src/qualified-structure.js';
import {createQualifiedBundle,initialQualification,recordQualifiedEdit,parseQualifiedBundle} from '../src/qualification.js';
import {prepareExplorationProposal,explorationContext,EXPLORATION_PROPOSAL} from '../src/exploration.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const mirror={id:'M2',type:'plane-mirror',parameters:{x:60,y:20,orientationDeg:135,length:16}};
const operation=()=>({op:'add',lengthUnit:'mm',component:structuredClone(mirror)});
const observations=[{id:'glass',kind:'interface-interactions',componentId:'G1'},
 {id:'first',kind:'mirror-reflections',componentId:'M1'},
 {id:'second',kind:'mirror-reflections',componentId:'M2'},
 {id:'detector',kind:'detector-crossings',componentId:'D1'}];
function baseScene(){
 const d=read('scenes/finite-dielectric-composition.json');
 Object.assign(d.physics.components.find(c=>c.id==='M1').parameters,{orientationDeg:45,length:16});
 Object.assign(d.physics.components.find(c=>c.id==='D1').parameters,{x:-20,y:20,length:20});return validate(d);
}
async function bundle(d=baseScene()){
 const q=initialQualification(d,null,{inputSha256:'b'.repeat(64),interpretation:{
  assumptions:['Synthetic regression apparatus; Fresnel partial reflections explicitly omitted.'],
  unknowns:['No independent source-interpretation certification.']}});
 q.origin.preparationStatus='unknown';
 q.assumptions.push({componentId:'S1',section:'parameters',key:'brightness',value:1,unit:'relative',purpose:'Synthetic source brightness'});
 const next=structuredClone(d);next.presentation.grid=!d.presentation.grid;
 return createQualifiedBundle(next,recordQualifiedEdit(d,next,q),observations);
}
const patch=b=>({format:'opticsim-component-revision-v1',expectedSha256:b.sceneSha256,
 expectedIntegritySha256:b.integritySha256,upgradeToSchemaVersion:11,operations:[operation()]});
const hasCode=code=>e=>e.issues?.some(x=>x.code===code);
const save=result=>createQualifiedBundle(result.document,result.qualification,result.observables);
const proposal=(b,p)=>({format:EXPLORATION_PROPOSAL,expectedIntegritySha256:b.integritySha256,
 intent:'Explicitly extend this saved v10 apparatus by adding the stated second mirror.',action:'structure',patch:p});
const proposalPatch=()=>({format:'opticsim-component-revision-v1',upgradeToSchemaVersion:11,operations:[operation()]});

test('explicit qualified v10 to v11 extension preserves untouched apparatus and complete provenance atomically',async()=>{
 const b=await bundle(),before=structuredClone(b),p=patch(b),originalPatch=structuredClone(p);
 const out=await prepareQualifiedStructure(b,p),child=await save(out);
 assert.deepEqual(b,before);assert.deepEqual(p,originalPatch);
 assert.equal(child.scene.schemaVersion,11);assert.equal(child.scene.adapterVersion,11);
 assert.deepEqual(child.scene.physics.components.slice(0,-1),b.scene.physics.components);
 assert.deepEqual(child.scene.physics.components.at(-1),mirror);
 assert.deepEqual(child.scene.simulation,b.scene.simulation);assert.deepEqual(child.scene.presentation,b.scene.presentation);
 assert.equal(child.scene.upstreamCommit,b.scene.upstreamCommit);assert.equal(child.scene.physics.model,b.scene.physics.model);
 for(const key of ['origin','assumptions','interpretation','interpretationAssessment'])assert.deepEqual(child.qualification[key],b.qualification[key]);
 assert.deepEqual(child.qualification.edits.slice(0,-1),b.qualification.edits);
 const edit=child.qualification.edits.at(-1);assert.equal(edit.kind,'physics');
 assert.deepEqual(edit.changes.map(c=>c.path),['$.schemaVersion','$.adapterVersion','$.physics.components']);
 assert.deepEqual(child.observables,b.observables);assert.equal(out.parentIntegritySha256,b.integritySha256);
 assert.equal(out.contractUpgrade.toSchemaVersion,11);assert.equal(out.summary,undefined);
 assert.notEqual(child.sceneSha256,b.sceneSha256);assert.notEqual(child.integritySha256,b.integritySha256);
 assert.deepEqual(await parseQualifiedBundle(JSON.stringify(child)),child);
});

test('native tracing verifies an upgraded apparatus afresh; parent evidence cannot qualify the child',async()=>{
 const b=await bundle(),parent=evaluateDocument(b.scene,core),out=await prepareQualifiedStructure(b,patch(b));
 assert.equal(parent.summary.observations.interfacesById.G1.interactions,2);
 assert.ok((await evaluateObservables(out.document,observations,parent.summary)).results.every(r=>r.status==='suppressed'&&r.value===null));
 const actual=evaluateDocument(out.document,core);assert.equal(actual.summary.executionPassed,true);
 assert.equal(actual.summary.observations.interfacesById.G1.interactions,4);
 assert.deepEqual(actual.summary.observations.reflectionsById,{M1:1,M2:1});
 assert.equal(actual.summary.observations.detectorsById.D1.crossings,1);
 const results=await evaluateObservables(out.document,observations,actual.summary);
 assert.equal(results.results[2].value,1);assert.equal(actual.summary.analysis.status,'unavailable');
});

test('plain structural edits and save parsing never silently upgrade historical contracts',async()=>{
 const b=await bundle(),p=patch(b);delete p.upgradeToSchemaVersion;
 await assert.rejects(()=>prepareQualifiedStructure(b,p),/one external plane mirror/);
 assert.throws(()=>reviseComponents(b.scene,proposalPatch()),/unsupported|contract/i);
 assert.equal(parseSave(serializeSave(b.scene)).schemaVersion,10);
 const plain=await prepareQualifiedStructure(b,{format:p.format,expectedSha256:b.sceneSha256,operations:[
  {op:'add',lengthUnit:'mm',component:{id:'S2',type:'point-source',parameters:{x:-50,y:1,brightness:.5},emission:{mode:'single-ray',directionDeg:0}}}]});
 assert.equal(plain.document.schemaVersion,10);assert.equal(plain.contractUpgrade,undefined);
});

test('contract upgrade requires both hashes and rejects metadata-only stale qualification',async()=>{
 const b=await bundle();
 for(const key of ['expectedSha256','expectedIntegritySha256'])for(const value of [undefined,'0'.repeat(64)]){
  const p=patch(b);if(value===undefined)delete p[key];else p[key]=value;
  await assert.rejects(()=>prepareQualifiedStructure(b,p),hasCode(key==='expectedSha256'?'STALE_REVISION':'STALE_QUALIFICATION'));
 }
 const q=structuredClone(b.qualification);q.interpretation.assumptions.push('A newer author note.');
 const other=await createQualifiedBundle(b.scene,q,b.observables);assert.equal(other.sceneSha256,b.sceneSha256);
 await assert.rejects(()=>prepareQualifiedStructure(other,patch(b)),hasCode('STALE_QUALIFICATION'));
 const requests=await createQualifiedBundle(b.scene,b.qualification,[]);
 await assert.rejects(()=>prepareQualifiedStructure(requests,patch(b)),hasCode('STALE_QUALIFICATION'));
});

test('only the exact declared v10 to v11 transition is accepted and version-only upgrades are rejected',async()=>{
 const b=await bundle();
 for(const value of [10,12,9,'11',null,false]){const p=patch(b);p.upgradeToSchemaVersion=value;
  await assert.rejects(()=>prepareQualifiedStructure(b,p),hasCode('UNSUPPORTED_CONTRACT_UPGRADE'));}
 const already=await save(await prepareQualifiedStructure(b,patch(b)));
 await assert.rejects(()=>prepareQualifiedStructure(already,patch(already)),hasCode('UNSUPPORTED_CONTRACT_UPGRADE'));
 const other=await bundle(read('scenes/general-source-detector.json'));
 await assert.rejects(()=>prepareQualifiedStructure(other,patch(other)),hasCode('UNSUPPORTED_CONTRACT_UPGRADE'));
 const noMirror=baseScene();noMirror.schemaVersion=noMirror.adapterVersion=9;noMirror.physics.model='polygon-dielectric-tracing';
 noMirror.physics.components=noMirror.physics.components.filter(c=>c.type!=='plane-mirror');const older=await bundle(noMirror);
 await assert.rejects(()=>prepareQualifiedStructure(older,patch(older)),hasCode('UNSUPPORTED_CONTRACT_UPGRADE'));
 const p=patch(b);p.operations=[{op:'remove',id:'D1'}];
 await assert.rejects(()=>prepareQualifiedStructure(b,p),hasCode('UPGRADE_REQUIRES_SECOND_MIRROR'));
});

test('upgraded geometry and all structural operations remain strict and atomic',async()=>{
 const b=await bundle(),before=structuredClone(b);
 for(const alter of [p=>{p.operations[0].component.parameters.x=10;},p=>{delete p.operations[0].component.parameters.orientationDeg;},
  p=>{p.operations[0].component.id='M1';},p=>{p.operations.push({...operation(),component:{...mirror,id:'M3'}});},
  p=>{p.operations[0].component.type='ideal-lens';},p=>{p.simulation={maxRayDepth:100};},p=>{p.operations=[];}]){
  const p=patch(b);alter(p);await assert.rejects(()=>prepareQualifiedStructure(b,p));assert.deepEqual(b,before);
 }
 const cm=patch(b);cm.operations[0].lengthUnit='cm';for(const k of ['x','y','length'])cm.operations[0].component.parameters[k]/=10;
 assert.deepEqual((await prepareQualifiedStructure(b,cm)).document.physics.components.at(-1),mirror);
});

test('contract upgrade cannot resurrect an identity recorded before the transition',async()=>{
 const b=await bundle();
 const added=await prepareQualifiedStructure(b,{format:'opticsim-component-revision-v1',expectedSha256:b.sceneSha256,
  operations:[{op:'add',lengthUnit:'mm',component:{id:'M2',type:'ray-detector',parameters:{x:110,y:100,orientationDeg:90,length:20}}}]});
 const a=await save(added),removed=await prepareQualifiedStructure(a,{format:'opticsim-component-revision-v1',expectedSha256:a.sceneSha256,operations:[{op:'remove',id:'M2'}]});
 const old=await save(removed);assert.equal(old.scene.schemaVersion,10);
 await assert.rejects(()=>prepareQualifiedStructure(old,patch(old)),hasCode('RETIRED_COMPONENT_ID'));
 const fresh=patch(old);fresh.operations[0].component.id='M3';const out=await prepareQualifiedStructure(old,fresh);
 assert.equal(out.observables.find(r=>r.id==='second').componentId,'M2');
 const results=await evaluateObservables(out.document,out.observables,evaluateDocument(out.document,core).summary);
 assert.equal(results.results[2].status,'unavailable');assert.equal(results.results[2].value,null);
});

test('upgrade snapshots caller inputs before asynchronous verification and rejects tampered bundles',async()=>{
 const b=await bundle(),p=patch(b),pending=prepareQualifiedStructure(b,p);
 p.operations[0].component.parameters.x=10;b.qualification.interpretation.assumptions[0]='Late mutation';
 const out=await pending;assert.equal(out.document.physics.components.at(-1).parameters.x,60);
 assert.notEqual(out.qualification.interpretation.assumptions[0],'Late mutation');
 await assert.rejects(()=>prepareQualifiedStructure(b,patch(b)),/integrity mismatch/);
});

test('existing copy-paste exploration preview displays both version fields before execution and binds current metadata',async()=>{
 const b=await bundle(),before=structuredClone(b),raw=proposal(b,proposalPatch());
 const result=await prepareExplorationProposal(b,raw);assert.equal(result.status,'validated-not-executed');assert.deepEqual(b,before);
 assert.deepEqual(result.changes.slice(0,2),[{componentId:'scene',field:'schemaVersion',before:10,after:11},
  {componentId:'scene',field:'adapterVersion',before:10,after:11}]);
 assert.equal(result.changes[2].componentId,'M2');assert.equal(result.changes[2].field,'add component');
 assert.equal(result.child.results,undefined);assert.equal(result.child.execution,undefined);
 await assert.rejects(()=>prepareExplorationProposal(result.child,raw),/Stale proposal/);
 const omit=proposalPatch();delete omit.upgradeToSchemaVersion;
 await assert.rejects(()=>prepareExplorationProposal(b,proposal(b,omit)),/one external plane mirror/);
 const c=await explorationContext(b,'Add the explicitly described M2.');assert.match(c.responseContract.patch,/upgradeToSchemaVersion/);
 assert.equal(c.qualifiedStructure.upgrade.toSchemaVersion,11);
 const cap=qualifiedStructureCapabilities();cap.upgrade.toSchemaVersion=100;cap.upgrade.requiredHashes.pop();
 assert.equal(qualifiedStructureCapabilities().upgrade.toSchemaVersion,11);
 assert.equal(qualifiedStructureCapabilities().upgrade.requiredHashes.length,2);
});

test('opt-in upgrade does not turn incomplete Fresnel or low-budget runs into accepted measurements',async()=>{
 for(const change of [d=>{d.physics.components.find(c=>c.id==='G1').parameters.partialReflection=true;},d=>{d.simulation.maxRayDepth=2;}]){
  const d=baseScene();change(d);const b=await bundle(d),out=await prepareQualifiedStructure(b,patch(b));
  assert.deepEqual(out.document.simulation,b.scene.simulation);assert.deepEqual(out.document.physics.components[1],b.scene.physics.components[1]);
  const execution=evaluateDocument(out.document,core);assert.equal(execution.summary.native.status,'incomplete');
  assert.ok((await evaluateObservables(out.document,observations,execution.summary)).results.every(r=>r.status==='suppressed'&&r.value===null));
 }
});

test('qualified structure CLI executes an explicit upgrade and rejects stale qualification before native build',async()=>{
 const b=await bundle(),directory=resolve('test-artifacts/llm-authoring');mkdirSync(directory,{recursive:true});
 const folder=mkdtempSync(resolve(directory,'contract-upgrade-')),input=resolve(folder,'baseline.json'),proposalFile=resolve(folder,'patch.json');
 const bytes=JSON.stringify(b);writeFileSync(input,bytes);writeFileSync(proposalFile,JSON.stringify(patch(b)));
 const out=resolve(folder,'accepted');
 const run=(dest)=>spawnSync(process.execPath,['scripts/qualified-scene.mjs','structure',input,proposalFile,'--out',dest],{encoding:'utf8',timeout:60000});
 const ok=run(out);assert.equal(ok.status,0,ok.stdout+'\n'+ok.stderr);
 const report=JSON.parse(readFileSync(resolve(out,'report.json')));assert.equal(report.summary.structuralRevision.contractUpgrade.toSchemaVersion,11);
 assert.equal(report.summary.requestedResults.results[2].value,1);
 const reopened=await parseQualifiedBundle(readFileSync(resolve(out,'qualified-scene.json'),'utf8'));assert.equal(reopened.scene.schemaVersion,11);
 assert.equal(readFileSync(input,'utf8'),bytes);
 const stale=patch(b);stale.expectedIntegritySha256='0'.repeat(64);writeFileSync(proposalFile,JSON.stringify(stale));
 const rejected=resolve(folder,'rejected'),bad=run(rejected);assert.equal(bad.status,1);
 const failure=JSON.parse(readFileSync(resolve(rejected,'report.json')));assert.equal(failure.summary.native.status,'not-run');
 assert.equal(failure.summary.issues[0].code,'STALE_QUALIFICATION');assert.equal(existsSync(resolve(rejected,'qualified-scene.json')),false);
});
