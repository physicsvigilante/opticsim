// Temporary, hash-checked materialization of reviewed local changes.
// Deleted before producing the final source tree. No branch ref is written.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
function edit(file,changes){let s=readFileSync(file,'utf8');for(const [a,b] of changes){if(!s.includes(a))throw Error(file+' missing '+a.slice(0,100));s=s.replaceAll(a,b);}writeFileSync(file,s);}
edit('src/contract.js',[
 ["import {CURVED_PARAMETERS", "import {CIRCULAR_TYPE,CIRCULAR_PARAMETERS,validateCircularGeometry} from './circular-dielectric.js';\nimport {CURVED_PARAMETERS"],
 ["[PLANAR_TYPE]: [...PLANAR_PARAMETERS], ...CURVED_PARAMETERS", "[PLANAR_TYPE]: [...PLANAR_PARAMETERS], [CIRCULAR_TYPE]: [...CIRCULAR_PARAMETERS], ...CURVED_PARAMETERS"],
 ["[PLANAR_TYPE]: Object.freeze({min:0,max:4}),", "[PLANAR_TYPE]: Object.freeze({min:0,max:4}),\n  [CIRCULAR_TYPE]: Object.freeze({min:0,max:1}),"],
 ["doc?.schemaVersion===6?6", "doc?.schemaVersion===7?7:doc?.schemaVersion===6?6"],
 ["const models = version===6?", "const models = version===7?['circular-dielectric-tracing']:version===6?"],
 ["&&(version>=6||!isCurved(t)))", "&&(version>=6||!isCurved(t))&&(version>=7||t!==CIRCULAR_TYPE))"],
 ["['negativeIndex','positiveIndex'].includes(key)","['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)"],
 ["version===6?['single-ray','full-circle','directional']:version===5?['single-ray']", "version===6?['single-ray','full-circle','directional']:(version===5||version===7)?['single-ray']"],
 ["  if(p.model==='curved-mirror-tracing'){", "  if(p.model==='circular-dielectric-tracing'){\n    validateCircularGeometry(p.components,mirrorEndpoints,fail);\n    validateMixedTraceScope(opticalComponents.filter(c=>c.type!==CIRCULAR_TYPE),true);\n  }\n  else if(p.model==='curved-mirror-tracing'){"],
 ["// V4 is preserved exactly; new planar scenes alone use explicit V5.","// Legacy v4/v5/v6 stay isolated; only finite circular dielectric scenes use v7."],
 ["if (key === 'radius' && Math.abs(value) < 2)", "if (key === 'radius' && (c.type===CIRCULAR_TYPE?value<2:Math.abs(value)<2))"]
]);
edit('src/authoring.js',[
 ["import {isCurved,curvedPoints}","import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';\nimport {isCurved,curvedPoints}"],
 ["'circular-arc-mirror':'arc-mirror'", "'circular-arc-mirror':'arc-mirror',[CIRCULAR_TYPE]:'dielectric'"],
 ["    curvedMirrors:{", "    circularDielectric:{schemaVersion:7,model:'circular-dielectric-tracing',scope:'Exactly one stationary circular region; 1–4 explicit single rays inside or outside; 0–2 external detectors; no other optics or nested regions',indices:'Required inside/outside absolute indices [1,4]; native ratio inside/outside',radius:'Positive radius >=2 mm; complete circle within coordinate bounds',partialReflection:'Required boolean; false explicitly omits Fresnel partial reflections, not TIR',clearance:'0.01 mm source/boundary and detector/circle separation; initial forward near-tangent rays within 0.01 mm are unsupported'},\n    curvedMirrors:{"],
 ["      counts:{...GENERAL_SCOPE[type]},", "      ...(type===CIRCULAR_TYPE?{booleanParameters:['partialReflection'],nativeType:'CircleGlass',indices:['insideIndex','outsideIndex'],geometry:'Finite 2D circle, not an ideal thin lens or a truncated sphere'}:{}),\n      counts:{...GENERAL_SCOPE[type]},"],
 ["planarOnlyMode:'single-ray'", "planarOnlyMode:'single-ray',circularOnlyMode:'single-ray'"],
 ["['negativeIndex','positiveIndex'].includes(key)", "['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)"],
 ["    else if(isCurved(c.type))vertices", "    else if(c.type===CIRCULAR_TYPE)vertices.push(...circularExtents(p));\n    else if(isCurved(c.type))vertices"],
 ["const planar=components.some", "const circular=components.some(c=>c.type===CIRCULAR_TYPE);\n  const planar=components.some"],
 ["schemaVersion:curved?6:planar?5:4,adapterVersion:curved?6:planar?5:4", "schemaVersion:circular?7:curved?6:planar?5:4,adapterVersion:circular?7:curved?6:planar?5:4"],
 ["model:curved?'curved-mirror-tracing'", "model:circular?'circular-dielectric-tracing':curved?'curved-mirror-tracing'"],
 ["document.schemaVersion===5?['single-ray']", "(document.schemaVersion===5||document.schemaVersion===7)?['single-ray']"],
 ["const number=(key,value,path)=>", "const number=(key,value,path,type=null)=>"],
 ["(key==='radius'&&Math.abs(n)<2)","(key==='radius'&&(type===CIRCULAR_TYPE?n<2:Math.abs(n)<2))"],
 ["number(key,c.parameters[key],path+'.parameters.'+key);", "number(key,c.parameters[key],path+'.parameters.'+key,c.type);"]
]);
edit('src/adapter.js',[
 ["import {compileCurved", "import {compileCircular} from './circular-dielectric.js';\nimport {compileCurved"],
 ["const compilers = {", "const compilers = {\n  'circular-dielectric':compileCircular,"]
]);
edit('src/planar-media.js',[
 ["export const PLANAR_TYPE", "import {CIRCULAR_TYPE,circularEncounter} from './circular-dielectric.js';\nexport const PLANAR_TYPE"],
 ["filter(c=>c.type===PLANAR_TYPE).map(component=>", "filter(c=>c.type===PLANAR_TYPE||c.type===CIRCULAR_TYPE).map(component=>"],
 ["const native=scene.objs[idMap.get(component.id)],original=native.onRayIncident,n=interfaceNormal(component.parameters);", "const native=scene.objs[idMap.get(component.id)],original=native.onRayIncident;\n    const circular=component.type===CIRCULAR_TYPE;"],
 ["      const incomingSign=incoming?Math.sign", "      const encounter=circular?circularEncounter(component,args[2],incoming):null;\n      const n=encounter?.normal||interfaceNormal(component.parameters);\n      const incomingSign=incoming?Math.sign"],
 ["      const incomingSign=incoming?Math.sign(incoming.x*n.x+incoming.y*n.y):0;", "      const incomingSign=incoming?Math.sign(incoming.x*n.x+incoming.y*n.y):0;\n      if(circular&&(!incoming||![n.x,n.y,encounter.point.x,encounter.point.y].every(Number.isFinite)||\n        Math.abs(incoming.x*n.x+incoming.y*n.y)<1e-10))meter.invalidObservations++;"],
 ["from:incomingSign>0?'negative':'positive',", "...(encounter?{pointMm:encounter.point,outwardNormal:encounter.normal}:{}),\n        from:encounter?.from??(incomingSign>0?'negative':'positive'),"],
 ["incidentIndex:incomingSign>0?component.parameters.negativeIndex:component.parameters.positiveIndex,", "incidentIndex:encounter?.incidentIndex??(incomingSign>0?component.parameters.negativeIndex:component.parameters.positiveIndex),"],
 ["destinationIndex:incomingSign>0?component.parameters.positiveIndex:component.parameters.negativeIndex,", "destinationIndex:encounter?.destinationIndex??(incomingSign>0?component.parameters.positiveIndex:component.parameters.negativeIndex),"],
 ["// In this audited PlaneGlass implementation", "// In the pinned PlaneGlass/CircleGlass implementations"],
 ["errors(){return entries.filter(([,m])=>m.invalidObservations).map(([id])=>id+': native interface emitted nonfinite branch evidence');}", "errors(){return entries.filter(([,m])=>m.invalidObservations).map(([id])=>id+': native interface emitted nonfinite or indeterminate encounter evidence');}"]
]);
edit('src/observables.js',[
 ["type:'planar-interface'", "type:['planar-interface','circular-dielectric']"],
 ["c=>c.type==='planar-interface'&&!c.parameters.partialReflection", "c=>['planar-interface','circular-dielectric'].includes(c.type)&&!c.parameters.partialReflection"],
 ["if(spec.type==='planar-interface'){", "if(r.kind.startsWith('interface-')){"],
 ["'A requested result does not certify interpretation of its source question.'", "'A requested result does not certify interpretation of its source question.',\n      'Circular dielectric angles are relative to the local normal at the first actual native hit, not a whole path or detected image.'"]
]);
edit('src/analysis.js',[
 ["    case 'planar-media-tracing':", "    case 'circular-dielectric-tracing': return {kind:'unavailable',reason:'Finite circular dielectric exposes native boundary observations, not an image solver or a 3D sphere model.'};\n    case 'planar-media-tracing':"]
]);
edit('src/result-preview.js',[
 ["import {isCurved", "import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';\nimport {isCurved"],
 ["    if(isCurved(c.type))", "    if(c.type===CIRCULAR_TYPE)return circularExtents(p);\n    if(isCurved(c.type))"]
]);
edit('src/app.js',[
 ["  const planar = session.document.physics.model === 'planar-media-tracing';", "  const planar = session.document.physics.model === 'planar-media-tracing';\n  const circular = session.document.physics.model === 'circular-dielectric-tracing';"],
 ["c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type));", "c.type==='ideal-lens'||c.type==='plane-mirror'||c.type==='circular-dielectric'||isCurved(c.type));"],
 ["session.document?.physics.model === 'planar-media-tracing' ?", "['planar-media-tracing','circular-dielectric-tracing'].includes(session.document?.physics.model) ?"],
 ["radius:'Signed curvature radius'", "radius:circular?'Circle radius (positive)':'Signed curvature radius',insideIndex:'Inside refractive index',outsideIndex:'Outside refractive index'"],
 ["['negativeIndex','positiveIndex'].includes(key)", "['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)"],
 ["    if(component.type==='planar-interface'){", "    if(component.type==='circular-dielectric'){\n      const note=document.createElement('p');note.className='muted';\n      note.textContent='One homogeneous circular region, 2D cross section. Both indices are explicit; native CircleGlass uses their ratio. Fresnel off omits partial reflections, not TIR. No detected-image or 3D-sphere claim.';fieldset.append(note);\n    }\n    if(component.type==='planar-interface'){"],
 ["note.textContent = planar ?", "note.textContent = (planar||circular) ?"],
 ["$('model-label').textContent = curved?", "$('model-label').textContent = circular?'Circular dielectric · native local-normal refraction':curved?"],
 ["${curved?'1–2 curved mirrors", "${circular?'One circular region; 1–4 exact rays inside or outside; up to two external detectors. Explicit inside/outside indices and positive radius.':curved?'1–2 curved mirrors"],
 ["$('physical-note').textContent = curved?", "$('physical-note').textContent = circular?'Native CircleGlass chooses intersections and refracts at the actual local normal. Fresnel-off is an explicit approximation; TIR remains active. Truncated or undefined runs suppress requested readings, even after a native completion callback. No image solver, nested media, cap geometry, light speed or 3D imaging is implied.':curved?"],
 ["session.document.schemaVersion===5?[", "[5,7].includes(session.document.schemaVersion)?["]
]);
edit('public/index.html',[[ '<option value="" disabled hidden>Loaded sandbox', '<option value="circular-dielectric">20 / Synthetic: circular dielectric</option><option value="" disabled hidden>Loaded sandbox' ]]);
const {prepareScene}=await import('./src/authoring.js');
writeFileSync('scenes/circular-dielectric.json',JSON.stringify(prepareScene(JSON.parse(readFileSync('examples/circular-dielectric.json')).physical).document,null,2)+'\n');
const expected={
 'src/adapter.js':'4884656b35fdb976bb052f4b5252723133f6d327',
 'src/analysis.js':'fd648c0f13bc0c1b29c93e8ac38ee9c7ae60fd0b',
 'src/app.js':'ccb2eb62a0e5523cc9265308e19f7f34273f37c7',
 'src/authoring.js':'bb913f74c580e39723809a50635b04b9bfa4abdf',
 'src/circular-dielectric.js':'16a6fafdb0866acd8dde0157086515850e271b44',
 'src/contract.js':'89152218a287dcbc0776bb95b4c911873dcb0e6c',
 'src/observables.js':'da857b51c63238e589e64a6f568c7afd76cc4067',
 'src/planar-media.js':'a4eaacf3974431b524cbcc729613ecd25bfd0f83',
 'src/result-preview.js':'fd5575a5c653897f69560b3ee8c4214613307c7c',
 'public/index.html':'301dd3ece6f8bf6c30adccd513944aa815719647',
 'scenes/circular-dielectric.json':'43f79d8df4c984fef615034158f1a422e0785f80'
};
for(const [path,sha] of Object.entries(expected)){
 const bytes=readFileSync(path),actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(actual!==sha)throw Error('Local-reviewed source blob mismatch: '+path+' '+actual);
}
writeFileSync('README.md',readFileSync('README.md','utf8')+'\n## Finite circular dielectric (v7)\n\nA strict `circular-dielectric` component now reuses pinned native `CircleGlass`\nwith explicit centre, positive radius, inside/outside indices and Fresnel\npolicy. One finite circular region supports 1–4 explicitly directed native\nsingle rays and up to two external passive detectors. It reuses the minimal\nauthoring request, unified problem command, boundary observations, qualified\nedits, main viewer and exports. It does not add a new ray tracer, image detector,\nprism/cap geometry, nested media, or circular-region motion playback.\n\nSee [scope and usage](docs/CIRCULAR-DIELECTRIC.md) and the fully declared\n[synthetic request](examples/circular-dielectric.json). The existing scene menu\nincludes **Synthetic: circular dielectric**. Full-Fresnel or trapped-ray\ntruncation remains incomplete; explicit Fresnel-off is labelled as an\napproximation, not a numerical repair. Earlier sealed evaluations are not\nrewritten or counted as new successes.\n');
writeFileSync('AGENTS.md',readFileSync('AGENTS.md','utf8')+'- Circular dielectric v7 is separate from v4/v5/v6: exactly one stationary\n  `circular-dielectric`, 1–4 explicit single rays inside/outside, 0–2 external\n  detectors. Require centre, positive radius and absolute inside/outside\n  indices plus partialReflection. Compile to pinned CircleGlass with the\n  index ratio; no custom refraction, image detection, circle motion, other\n  optics or nested finite media. Reuse boundary observations with the actual\n  local outward normal; counts span the entire circle and first-event is\n  simulator-order, not source attribution. Keep Fresnel/trapped-TIR truncation\n  incomplete, explicit Fresnel-off qualified, and initial near tangencies\n  rejected conservatively. Read docs/CIRCULAR-DIELECTRIC.md for bounds.\n');
unlinkSync('.github/workflows/circle-dev-snapshot.yml');
unlinkSync('.github/workflows/circle-integrate.yml');
unlinkSync('.circle-build.mjs');
console.log('Applied source matches all 11 locally tested Git blob identities. No ref updated.');
