import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseQualifiedBundle} from '../src/qualification.js';
import {beamTwoPlaneMirrorSafetyWitness} from '../src/native-beam-two-plane-mirror-v27.js';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-native-two-plane-mirror-v27',format:'opticsim-native-two-plane-slab-mirror-v27-chrome-v1',logPrefix:'NATIVE_TWO_PLANE_MIRROR_V27_CHROME',
 async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
  const pkg=join(root,'test-artifacts/llm-authoring/native-two-plane-mirror-v27/baseline-separated-mirror/qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>s.status==='completed'&&!s.error,'initial viewer');
  await upload(pkg);
  let current=await until(state,s=>s.status==='completed'&&!s.error&&
   s.results?.[0]?.value===8&&s.results?.[1]?.value===16&&
   s.results?.[3]?.value===16&&s.results?.[4]?.value===8&&
   s.results?.[5]?.value===16&&s.results?.[6]?.value?.length===16,
   'import real native v27 Beam through two-plane slab and separated Mirror');
  assert.equal(current.saveDisabled,false);
  check('Qualified v27 Beam imports 8 true rays, 16 encounters at each of two PlaneGlass surfaces, 8 Mirror reflections and 16 detector crossings');
  const controls=await js('({beam:!!document.getElementById("B1-width"),angle:!!document.getElementById("B1-directionDeg"),front:!!document.getElementById("I1-positiveIndex"),rear:!!document.getElementById("I2-negativeIndex"),mirror:!!document.getElementById("M1-x"),detector:!!document.getElementById("D1-x"),fresnel:!!document.getElementById("I2-partialReflection")})');
  assert.ok(Object.values(controls).every(Boolean),JSON.stringify(controls));
  check('Native Beam width/direction, both real glass interfaces, physical index fields, separated finite Mirror and source-side detector controls exist');
  await shot('v27-original-real-return');
  const baseline=(await parseQualifiedBundle(await readFile(pkg,'utf8'))).scene;
  const samples=beamTwoPlaneMirrorSafetyWitness(baseline.physics.components,baseline.simulation.rayDensity).samples;
  for(const [id,upper] of [['M1',Math.max(...samples.map(s=>s.mirrorY))],
    ['D1',Math.max(...samples.map(s=>s.detectorY[0].outbound))]]) {
   const target=baseline.physics.components.find(c=>c.id===id).parameters;
   await edit(id+'-y',upper+.1005-target.length/2);
   await until(state,s=>s.status==='invalid' && s.results===null && s.saveDisabled && s.error.includes('0.001 mm'),id+' numerical endpoint refusal');
   check(id+' endpoint edit inside the numerical reserve refuses and clears prior readings');
   await upload(pkg);
   await until(state,s=>s.status==='completed' && s.results?.[5]?.value===16,'restore baseline after endpoint refusal');
  }
  await edit('B1-width',20);
  current=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===4&&
   s.results?.[1]?.value===8&&s.results?.[3]?.value===8&&
   s.results?.[4]?.value===4&&s.results?.[5]?.value===8,
   'physical Beam width edit must retrace both native slab surfaces and Mirror');
  check('Editing Beam width changes real native source emission and matching return event counts');
  await shot('v27-width20-returns');
  await edit('I1-positiveIndex',1.8);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'changing only first slab interface index must be refused as inconsistent material');
  check('Single-face material edit refuses mismatched slab and clears old qualified readings');
  await edit('I2-negativeIndex',1.8);
  current=await until(state,s=>s.status==='completed'&&s.results?.[4]?.value===4&&
   s.results?.[5]?.value===8&&s.results?.[2]?.value?.destinationIndex===1.8,
   'changing BOTH slab interface indices returns genuine two-plane Snell propagation');
  assert.equal(current.saveDisabled,false);
  check('Coherent two-surface material change retraces actual native slab and mirror return');
  await shot('v27-index1point8');
  await js('document.getElementById("save-qualified").click()');
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
  const exported=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,27);
  assert.equal(bundle.scene.physics.model,'native-parallel-slab-mirror-tracing');
  const byId=id=>bundle.scene.physics.components.find(c=>c.id===id).parameters;
  assert.equal(byId('B1').width,20);
  assert.equal(byId('I1').positiveIndex,1.8);
  assert.equal(byId('I2').negativeIndex,1.8);
  assert.equal(byId('I2').positiveIndex,1);
  assert.equal(byId('I1').partialReflection,false);
  assert.equal(byId('I2').partialReflection,false);
  assert.equal(byId('M1').x,90);
  assert.equal(byId('M1').length,420);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified export retains all true native components and exact edited physical data, not cached ray positions');
  await edit('M1-x',60);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'co-planar touching mirror and rear interface must be rejected');
  check('Mirror directly touching the second PlaneGlass is refused, preventing the raw coincident collision-order anomaly');
  await shot('v27-contact-mirror-refused');
  await upload(exported);
  current=await until(state,s=>s.status==='completed'&&s.results?.[4]?.value===4,
   'restore complete two-plane Mirror after rejected contact');
  await edit('M1-length',72);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'too-short finite Mirror must fail v27 before native output');
  check('Clipped downstream finite Mirror refuses and suppresses stale native readings');
  await shot('v27-clipped-mirror-refused');
  await upload(exported);
  current=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===4&&
   s.results?.[1]?.value===8&&s.results?.[3]?.value===8&&
   s.results?.[4]?.value===4&&s.results?.[5]?.value===8,
   'reopen qualified v27 after invalid edits');
  assert.equal(current.saveDisabled,false);
  check('Reopened qualified v27 scene retraces actual native Beam+Mirror rather than reusing stale measurements');
  await shot('v27-reopen-qualified');
}});
