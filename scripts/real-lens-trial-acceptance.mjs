// Development LLM attempt on six real Lens Formula problems from the user's
// uploaded corpus. NOT blinded: the same assistant previously saw discussion
// of some expected applicability conclusions. Only Problem images were read;
// no Solutions images or gold answer files are used. Pinned PhyDemo physics.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {validate,serializeSave} from '../src/contract.js';
import {predict} from '../src/analysis.js';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=fileURLToPath(new URL('../evaluation/llm-pilot-v1/real-lens-trial/',import.meta.url));
const attempt=JSON.parse(readFileSync(resolve(base,'attempt.json'),'utf8'));
const input=JSON.parse(readFileSync(resolve(base,'native-requests.json'),'utf8'));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
assert.equal(attempt.cases.length,6);
assert.equal(input.cases.length,3);
assert.equal(attempt.attempt.independentModelCall,false);
assert.equal(attempt.attempt.exposedToSolutionImages,false);
const native=[];
const outputDirectory=resolve(root,'test-artifacts/llm-evaluation/real-lens-trial');
mkdirSync(outputDirectory,{recursive:true});
for(const {key,request} of input.cases){
  const prepared=prepareScene(request);
  const canonical=prepared.document;
  assert.equal(validate(canonical),canonical);
  // Openable in existing browser; physical assumptions remain in attempt.json.
  writeFileSync(resolve(outputDirectory,key+'.ray-optics-2d.json'),serializeSave(canonical));
  const run=checkCandidate(serializeSave(canonical),core);
  assert.equal(run.validation.valid,true,key);
  assert.ok(['completed','completed-with-warnings'].includes(run.native.status),
    key+' status='+run.native.status+', error='+run.native.error);
  assert.equal(run.executionPassed,true,key);
  assert.equal(run.analysis.status,'unavailable',key);
  assert.deepEqual(run.roundTrip,{sandbox:true,native:true});
  assert.equal(run.native.sourceEmissions,'complete');
  const measurements=run.native.diagnostics;
  const record={
    requestKey:key,accepted:true,nativeStatus:run.native.status,
    nativeExecuted:true,executionPassed:run.executionPassed,
    generalAnalysis:run.analysis.status,
    emitted:measurements.emitted,
    emissionsById:measurements.emissionsById,
    reflectionsById:measurements.reflectionsById,
    detectorsById:measurements.detectorsById,
    warnings:measurements.warnings,
    truncation:measurements.truncation,
    undefinedBehavior:measurements.undefinedBehavior,
    componentIds:run.components.map(c=>c.id),
    physicalInputs:canonical.physics.components,
    sourceOfNonPhysicalSettings:'illustrativeChoices in attempt.json',
    fidelityToProblem:'conditional or illustrative; see attempt.json for unstated values'
  };
  assert.equal(measurements.truncation,0,key);
  assert.equal(measurements.undefinedBehavior,0,key);
  assert.ok(measurements.emitted>0,key);
  if(key==='L01'){
    const qualified=structuredClone(canonical);
    qualified.physics.model='ideal-thin-lens-geometric';
    validate(qualified);
    // Only the applicability profile changes. Native optical components
    // must remain identical before independently reusing the lens analysis.
    const actual=core.loadDocument(canonical).scene.objs.map(x=>x.serialize());
    const specialized=core.loadDocument(qualified).scene.objs.map(x=>x.serialize());
    assert.deepEqual(actual,specialized);
    const image=predict(qualified);
    assert.equal(image.kind,'finite-real');
    assert.ok(Math.abs(image.x-375)<1e-8);
    assert.ok(Math.abs(image.distance-75)<1e-8);
    const qualifiedRun=checkCandidate(serializeSave(qualified),core);
    assert.equal(qualifiedRun.executionPassed,true);
    assert.equal(qualifiedRun.analysis.status,'available');
    assert.ok(Math.abs(qualifiedRun.analysis.prediction.distance-75)<1e-8);
    record.conditionalAnalyticalPrediction={
      profile:'ideal-thin-lens-geometric',scopeChecked:true,
      nativeObjectsUnchanged:true,status:'available',
      imageDistanceAfterSecondLensMm:image.distance,
      imageXmm:image.x,
      note:'Independent ABCD prediction conditional on ideal-lens arrangement, NOT native image detection'
    };
  }
  native.push(record);
}

// Independently check the algebraic claims in the LLM-authored development
// attempt; these are not reports of experimental native image detection.
const inverseImage=(sourceX,lensX,f)=>{
  const objectDistance=Math.abs(lensX-sourceX);
  assert.notEqual(objectDistance,f);
  const imageDistance=f*objectDistance/(objectDistance-f);
  return lensX+Math.sign(lensX-sourceX)*imageDistance;
};
const inverseLocations=[6,18].map(lensX=>({
  lensXcm:lensX,
  imageFromFirstSourceCm:inverseImage(0,lensX,9),
  imageFromSecondSourceCm:inverseImage(24,lensX,9)
}));
assert.deepEqual(inverseLocations,[
  {lensXcm:6,imageFromFirstSourceCm:-12,imageFromSecondSourceCm:-12},
  {lensXcm:18,imageFromFirstSourceCm:36,imageFromSecondSourceCm:36}
]);
assert.equal(native.find(x=>x.requestKey==='L02-left').physicalInputs.find(
  x=>x.id==='L1').parameters.x,60);
assert.equal(native.find(x=>x.requestKey==='L02-right').physicalInputs.find(
  x=>x.id==='L1').parameters.x,180);
const combinedFocalCm=1/(1/5-1/10);
assert.equal(combinedFocalCm,10);

// ABCD matrix M = L(f3)*T(5)*L(f2)*T(15)*L(f1).
const multiply=(a,b)=>[
  [a[0][0]*b[0][0]+a[0][1]*b[1][0],a[0][0]*b[0][1]+a[0][1]*b[1][1]],
  [a[1][0]*b[0][0]+a[1][1]*b[1][0],a[1][0]*b[0][1]+a[1][1]*b[1][1]]
];
const T=d=>[[1,d],[0,1]],L=f=>[[1,0],[-1/f,1]];
let matrix=[[1,0],[0,1]];
for(const m of [L(10),T(15),L(-20),T(5),L(9)])
  matrix=multiply(m,matrix);
assert.ok(Math.abs(matrix[1][0])<1e-12);
assert.ok(Math.abs(matrix[1][1]+8/9)<1e-12);
const offaxis=(f,d,incidentHeight)=>{
  const yAtSecond=incidentHeight-3*incidentHeight;
  const thetaAfterSecond=-incidentHeight/f-(yAtSecond-d)/f;
  return yAtSecond+2*f*thetaAfterSecond;
};
for(const y0 of [-3,0,2,5])
  assert.ok(Math.abs(offaxis(10,0.5,y0)-1)<1e-10);
const analyticalChecks={
  L01:{imageDistanceAfterSecondLensCm:7.5,verifiedWithExistingABCD:true},
  L02:{inverseLensLocationsCm:inverseLocations,nativeImageProvenanceUnavailable:true},
  L03:{equivalentFocalLengthCm:combinedFocalCm,
    reductionIsNotTwoPhysicalLensSurfaces:true},
  L04:{ABCD:matrix,outputExactlyCollimatedInParaxialModel:true,
    finiteConvergencePoint:false},
  L05:{status:'not-executed',reason:'nonlinear intensity-dependent refractive index unsupported'},
  L06:{focalPoint:'(5 f, 2 d) relative to first lens centre',
    checkedWithSeveralIncidentHeights:true,
    nativeSourceAndSecondLensTranslationNotAvailable:true}
};
const report={
  reportKind:'nonblind-development-llm-attempt',
  inputArchive:attempt.input,
  model:attempt.attempt.model,
  independence:attempt.attempt,
  attemptedCases:attempt.cases.map(c=>({id:c.id,file:c.file,
    classification:c.classification,sceneKeys:c.requestKeys||(
      c.requestKey?[c.requestKey]:[]),
    physicalInterpretation:c.derived,
    nonphysicalChoices:c.illustrativeChoices||[],
    nonExecutionReason:c.nonExecutionReason||null})),
  native,analyticalChecks,
  counts:{cases:6,illustrativeNativeScenes:3,
    nativeCompleted:native.filter(x=>x.executionPassed).length,
    analyticalClaimsMechanicallyChecked:5,
    casesNotNativeExecuted:4},
  importantLimits:[
    'Nonblind development pass: prior discussion contained applicability notes. No independent model call or unbiased first-attempt accuracy can be inferred.',
    'Native PhyDemo ray execution and independent analytical calculations are separate; there is no automatic multi-source image attribution.',
    'Physical choices for source brightness, full-circle emission and finite lens apertures are illustrative, not facts from the problems.',
    'The original user problem ZIP and all Solutions PNGs were not opened or changed by this execution.'
  ]
};
const dest=resolve(root,'test-artifacts/llm-evaluation/real-lens-trial/report.json');
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log('Real lens development trial PASS: six case decisions, three native traces, conditional ABCD and inverse-geometry checks; NOT a blind independent LLM accuracy score.');
