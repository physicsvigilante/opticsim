// General, bounded diagnostic replay for a qualified v5 planar-media package.
// Never changes, signs, or exports an alternative canonical/qualified scene.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
import {serializeSave} from '../src/contract.js';
import {evaluateObservables} from '../src/observables.js';
import {nativeNumericalReplay,NATIVE_REPLAY_MODES} from '../src/numerical-reliability.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const [path,modeFlag,mode,outFlag,out,...extra]=process.argv.slice(2);
if(!path||modeFlag!=='--mode'||!Object.hasOwn(NATIVE_REPLAY_MODES,mode)||
   outFlag!=='--out'||!out||extra.length){
  console.error('Usage: node scripts/native-numerical-replay.mjs <qualified-scene.json> --mode default|linear --out test-artifacts/llm-authoring/<fresh>');
  process.exit(1);
}
const input=readFileSync(resolve(path));
if(input.length>1024*1024)throw Error('Qualified input exceeds the 1 MB bound');
const bundle=await parseQualifiedBundle(input.toString('utf8'));
const canonicalHash=hash(serializeSave(bundle.scene));
if(canonicalHash!==bundle.sceneSha256)throw Error('Qualified scene hash disagrees with serialized canonical document');
const folder=reserveAuthoringOutput(out,root);
writeEvidence(folder.input,input);
writeEvidence(resolve(folder.directory,'native-mode.json'),
  JSON.stringify({mode,colorMode:mode,cutoff:NATIVE_REPLAY_MODES[mode].weakReflectedRayCutoff},null,2)+'\n');
execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
  {cwd:root,stdio:['ignore','pipe','pipe']});
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const replay=nativeNumericalReplay(bundle.scene,core,mode);
const execution={
  canonicalSha256:canonicalHash,
  executionPassed:replay.complete,
  native:{status:replay.status,warnings:replay.diagnostic.warnings||[]},
  observations:replay.observations
};
const results=await evaluateObservables(bundle.scene,bundle.observables,execution);
const report={
  format:'opticsim-native-numerical-replay-report-v1',
  canonicalSceneSha256:bundle.sceneSha256,
  qualifiedIntegritySha256:bundle.integritySha256,
  exactInputSha256:hash(input),
  nativeMode:mode,
  nativeColorMode:replay.nativeSceneColorMode,
  nativeReflectedBranchCutoff:replay.nativeWeakBranchThreshold,
  alteredNativeProperties:replay.alteredNativeProperties,
  nativeStatus:replay.status,
  complete:replay.complete,
  nativeDiagnostics:replay.diagnostic,
  requestedResults:results,
  qualificationOrigin:bundle.qualification?.origin||null,
  approximationWarning:'This is an explicit native numerical color-mode variant; results are diagnostic, not a replacement for the original default-mode run or a certified source-question answer.',
  canonicalInputWasUnchanged:true,
  didNotCreateQualifiedVariant:true,
  questionSupport:'not-assessed-by-engine'
};
writeEvidence(folder.report,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({format:report.format,mode,status:replay.status,
  complete:replay.complete,report:folder.report,qualifiedSceneNotModified:true},null,2));
if(!replay.complete)process.exitCode=2;
