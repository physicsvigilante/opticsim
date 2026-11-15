// Public opt-in scene-to-native result acceptance; synthetic controls only.
// This runs the unchanged problem authoring/qualified result workflow.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out=resolve(process.env.OPTICSIM_PROVENANCE_ACCEPTANCE_OUTPUT||
 'test-artifacts/llm-authoring/native-ray-provenance-v1');
mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=(id,x,y,brightness=1)=>({id,type:'point-source',
 parameters:{x,y,brightness},emission:{mode:'single-ray',directionDeg:-45}});
const glass={id:'AirWater',type:'planar-interface',
 parameters:{x:0,y:0,normalDeg:90,negativeIndex:4/3,positiveIndex:1,partialReflection:true}};
const det=(id,x,y,length)=>({id,type:'ray-detector',
 parameters:{x,y,orientationDeg:0,length}});
const physical=()=>({lengthUnit:'mm',title:'Synthetic R2 public native observed parentage',
 components:[source('S1',-100,100),source('S2',-150,100),structuredClone(glass),
  det('Lower',50,-100,400),det('Upper',200,200,500)]});
const requests=[
 {id:'upper',kind:'detector-ray-provenance',componentId:'Upper'},
 {id:'lower',kind:'detector-ray-provenance',componentId:'Lower'},
 {id:'upper-count',kind:'detector-crossings',componentId:'Upper'},
 {id:'lower-count',kind:'detector-crossings',componentId:'Lower'}
];
const record=[];
function check(name,physics,expectedExit,expectedNative){
 const input={format:'opticsim-problem-v1',physical:physics,requests};
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 const path=join(out,name+'.input.json'),folder=join(out,name);
 writeFileSync(path,bytes,{flag:'wx'});
 const run=spawnSync(process.execPath,['scripts/run-problem.mjs',path,'--out',folder],
  {encoding:'utf8',timeout:90000});
 assert.equal(run.status,expectedExit,name+': '+run.stdout+'\n'+run.stderr);
 const report=JSON.parse(readFileSync(join(folder,'report.json'),'utf8'));
 assert.equal(report.inputSha256,hash(bytes),name+': original bytes must be preserved');
 assert.equal(report.native.status,expectedNative,name+': actual native status');
 const upper=report.results.find(r=>r.id==='upper'),lower=report.results.find(r=>r.id==='lower');
 record.push({name,inputSha256:report.inputSha256,status:report.status,
  native:report.native.status,upper:{status:upper.status,reason:upper.reasonCode??null,
    hitCount:upper.value?.crossings?.length??null},
  lower:{status:lower.status,reason:lower.reasonCode??null,
    hitCount:lower.value?.crossings?.length??null}});
 return {report,upper,lower};
}
const clean=check('two-source-fresnel',physical(),0,'completed');
assert.equal(clean.upper.status,'available');assert.equal(clean.lower.status,'available');
assert.equal(clean.upper.value.crossings.length,2);assert.equal(clean.lower.value.crossings.length,2);
assert.equal(clean.upper.value.nodes.length,4);assert.equal(clean.lower.value.nodes.length,2);
assert.equal(clean.report.results.find(r=>r.id==='upper-count').value,2);
assert.equal(clean.report.results.find(r=>r.id==='lower-count').value,2);
assert.doesNotMatch(JSON.stringify(clean.upper.value),/p1|p2|rayIndex|pathLength/);
const miss=physical();miss.components=miss.components.filter(c=>c.id!=='S2'&&c.id!=='Upper');
miss.components.find(c=>c.id==='S1').emission.directionDeg=90;
const missInput={...miss,components:[...miss.components,det('Upper',200,200,500)]};
const empty=check('legitimate-miss',missInput,0,'completed');
assert.deepEqual(empty.upper.value,{nodes:[],crossings:[]});
assert.deepEqual(empty.lower.value,{nodes:[],crossings:[]});
const weak=physical();weak.components.filter(c=>c.type==='point-source').forEach(c=>c.parameters.brightness=.01);
const incomplete=check('weak-fresnel-truncation',weak,2,'incomplete');
assert.ok(incomplete.report.results.every(r=>r.status==='suppressed'));
assert.equal(incomplete.upper.value,null);assert.equal(incomplete.lower.value,null);
// Public physical scope may contain two interfaces, but the new *observable*
// is not allowed to attribute rays in that unsupported arrangement.
const stack=physical();stack.components.find(c=>c.id==='AirWater').parameters.partialReflection=false;
stack.components.push({id:'Extra',type:'planar-interface',
 parameters:{x:0,y:50,normalDeg:90,negativeIndex:1,positiveIndex:1.25,partialReflection:false}});
const unsupported=check('two-interface-unavailable',stack,2,'completed');
assert.equal(unsupported.upper.status,'unavailable');
assert.equal(unsupported.upper.reasonCode,'UNSUPPORTED_PROVENANCE_SCOPE');
writeFileSync(join(out,'acceptance.json'),JSON.stringify({
 format:'opticsim-native-ray-provenance-public-acceptance-v1',
 status:'passed',cases:record,source:'synthetic; existing public native problem workflow',
 originalTextbookTaskSolved:false,independentLLMReview:false,nativeRayHistoryCreated:false
},null,2)+'\n',{flag:'wx'});
console.log('Native observed detector parentage public acceptance PASS: '+record.length+' source-backed JSON invocations.');
