// RESEARCH ONLY: compare immutable original first fixed-native-seed trial report
// with the new separately preregistered second-seed original trial report.
// Same authored scene, same schedule, distinct fresh OS processes, no causal oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const [oldReportPath,newReportPath,outPath]=process.argv.slice(2);
assert.ok(oldReportPath&&newReportPath&&outPath,
 'Usage: node compare.mjs ORIGINAL_PR98_REPORT NEW_SECOND_SEED_REPORT FRESH_COMPARISON_JSON');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const oldBytes=fs.readFileSync(oldReportPath),nowBytes=fs.readFileSync(newReportPath);
const oldHash='b9ea7eb4366fddfd3dcdaf9e8ac6f475e04804bec54b696fbd93eda3814511f2';
assert.equal(digest(oldBytes),oldHash,'First seed PR98 original source report was altered');
const old=JSON.parse(oldBytes),now=JSON.parse(nowBytes);
assert.equal(old.status,'research-complete');
assert.equal(now.status,'research-complete');
assert.equal(old.format,'opticsim-fixed-native-seed-onecase-v1');
assert.equal(now.format,'opticsim-second-fixed-native-seed-onecase-v1');
assert.equal(old.provenance.nativeRandomSeed,'opticsim-fixed-native-seed-v1-20261116');
assert.equal(now.provenance.nativeRandomSeed,'opticsim-fixed-native-seed-v2-20261116');
assert.equal(old.provenance.originalInputsSha256,'caa07af040d0a71b50ea6b69470aa55a545b04d52195994913123a902b434df3');
assert.equal(now.provenance.originalInputsSha256,old.provenance.originalInputsSha256);
assert.equal(old.provenance.originalSceneSha256,'4389fecfe80ad01fa7cb160f22319327ccf9e30bb35c211012cc15599ff422c6');
assert.equal(now.provenance.originalSceneSha256,old.provenance.originalSceneSha256);
assert.equal(old.provenance.scheduleRandomSeed,0x9800A55);
assert.equal(now.provenance.scheduleRandomSeed,old.provenance.scheduleRandomSeed);
assert.deepEqual(now.provenance.profiles,old.provenance.profiles);
assert.deepEqual(now.schedule,old.schedule,'Frozen randomized four-profile 24-slot schedule changed');
assert.equal(old.plannedTrials,24);assert.equal(now.plannedTrials,24);
assert.equal(old.actualTrials,24);assert.equal(now.actualTrials,24);
assert.equal(old.records.length,24);assert.equal(now.records.length,24);
assert.equal(old.errors.length,0);assert.equal(now.errors.length,0);
const modes=['seeded-off','seeded-on','seeded-tap-blackhole','seeded-tap-archive'];
for(const mode of modes){
 assert.equal(old.labelledCounts.byMode[mode],6);
 assert.equal(now.labelledCounts.byMode[mode],6);
}
const h0=old.records[0].nativeConfig;
assert.equal(h0.compiledNativeSha256,'e74e1452bd26402a94b9e0748be38ce8a0720274e5910b68bc65634a72bec1b7');
assert.equal(h0.seededNativeConfigSha256,'24006e61e74d527d74a8acec4b5ec25a4e543f2a384a5e90ab1d50f97c49a109');
const sameUnseeded=h0.compiledNativeSha256;
const newSeeded=now.records[0].nativeConfig.seededNativeConfigSha256;
assert.notEqual(newSeeded,h0.seededNativeConfigSha256,'Seeded config hash identical despite changed native seed');
const byMode=Object.fromEntries(modes.map(mode=>[mode,{firstSeed:{completed:0,failed:0},secondSeed:{completed:0,failed:0},statusSwitched:0,fingerprintSwitched:0}]));
const switched=[];
for(let i=0;i<24;i++){
 const a=old.records[i],b=now.records[i],slot=old.schedule[i];
 assert.equal(a.ordinal,i+1); assert.equal(b.ordinal,i+1);
 assert.deepEqual(a.schedule,slot);assert.deepEqual(b.schedule,slot);
 assert.equal(a.caseId,'critical-shift-neg');assert.equal(b.caseId,a.caseId);
 assert.equal(a.mode,slot.mode);assert.equal(b.mode,a.mode);
 assert.equal(a.sceneSha256,old.provenance.originalSceneSha256);
 assert.equal(b.sceneSha256,a.sceneSha256);
 assert.equal(a.nativeConfig.compiledNativeSha256,sameUnseeded);
 assert.equal(b.nativeConfig.compiledNativeSha256,sameUnseeded);
 assert.equal(a.nativeConfig.seededNativeConfigSha256,h0.seededNativeConfigSha256);
 assert.equal(b.nativeConfig.seededNativeConfigSha256,newSeeded);
 assert.equal(a.nativeConfig.observedNativeSceneSeed,old.provenance.nativeRandomSeed);
 assert.equal(b.nativeConfig.observedNativeSceneSeed,now.provenance.nativeRandomSeed);
 assert.ok(['completed','completed-with-warnings','failed','stopped'].includes(a.native.status));
 assert.ok(['completed','completed-with-warnings','failed','stopped'].includes(b.native.status));
 assert.equal(a.nativeFingerprint,digest(Buffer.from(JSON.stringify(a.native))));
 assert.equal(b.nativeFingerprint,digest(Buffer.from(JSON.stringify(b.native))));
 const c=byMode[a.mode];
 for(const [key,r] of [['firstSeed',a],['secondSeed',b]]) {
   if(r.native.completed)c[key].completed++;
   else c[key].failed++;
 }
 if(a.native.status!==b.native.status)c.statusSwitched++;
 if(a.nativeFingerprint!==b.nativeFingerprint)c.fingerprintSwitched++;
 if(a.native.status!==b.native.status || a.nativeFingerprint!==b.nativeFingerprint){
   switched.push({ordinal:i+1,caseId:slot.caseId,block:slot.block,mode:a.mode,
     firstStatus:a.native.status,secondStatus:b.native.status,
     firstFingerprint:a.nativeFingerprint,secondFingerprint:b.nativeFingerprint});
 }
}
for(const mode of modes)assert.equal(byMode[mode].firstSeed.completed+byMode[mode].firstSeed.failed,6);
for(const mode of modes)assert.equal(byMode[mode].secondSeed.completed+byMode[mode].secondSeed.failed,6);
assert.equal(old.records.filter(r=>r.native.status==='failed').length,24,
 'The prior first-seed experiment must retain all 24 true native failures');
const result={
 format:'opticsim-two-native-seeds-comparison-research-v1',
 purpose:'Descriptive comparison of original fully frozen source case under two test-only native RNG seeds',
 source:{firstSeedOriginalPr98Sha:'477db82058dde2aba4627a51c8d991e24dce6015',
  firstSeedOriginalReportSha256:oldHash,secondSeedOriginalReportSha256:digest(nowBytes),
  originalPhysicalSceneSha256:old.provenance.originalSceneSha256,
  originalPr96InputsSha256:old.provenance.originalInputsSha256,
  identicalSourceAndSchedule:true,sharedOriginalUnseededCompiledNativeSha256:sameUnseeded,
  firstSeedCompiledTestNativeSha256:h0.seededNativeConfigSha256,
  secondSeedCompiledTestNativeSha256:newSeeded},
 comparedFreshProcessPositions:24,byMode,statusOrFingerprintChanges:switched,
 statusChangedPositions:switched.filter(x=>x.firstStatus!==x.secondStatus).length,
 fingerprintChangedPositions:switched.filter(x=>x.firstFingerprint!==x.secondFingerprint).length,
 researchBoundaries:{isMatchedSameNativeEvent:false,causalRNGEffectProven:false,
  provesIdealCriticalAngleBranch:false,numericalErrorToleranceCertified:false,
  productionNativeOrStage2ChangeAuthorized:false,
  bothSeedsUseTestOnlyNativeConstruction:true},
};
fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('SECOND_NATIVE_SEED_COMPARISON '+JSON.stringify({
 compared:result.comparedFreshProcessPositions,
 firstSeedFailed:24,
 secondSeedNativeStates:Object.fromEntries(modes.map(mode=>[mode,byMode[mode].secondSeed])),
 statusChangedPositions:result.statusChangedPositions,
 fingerprintChangedPositions:result.fingerprintChangedPositions,
 sourceAndScheduleIdentical:true}));
