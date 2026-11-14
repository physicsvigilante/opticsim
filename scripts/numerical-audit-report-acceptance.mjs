import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Preserve and inspect the actual CLI output; do not infer completion from result availability.
if(process.argv.length>3)throw Error('Usage: node scripts/numerical-audit-report-acceptance.mjs [fresh-output-directory]');
const output=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/numerical-reliability');
  const child=spawnSync(process.execPath,[resolve(root,'scripts/numerical-reliability-audit.mjs'),output],
    {cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(child.status,0,child.error?.message||child.stdout+child.stderr);
  const consoleReport=JSON.parse(child.stdout),saved=JSON.parse(readFileSync(resolve(output,'report.json')));
  writeEvidence(resolve(output,'console-summary.json'),child.stdout);
  assert.equal(consoleReport.records.length,10);assert.equal(saved.records.length,10);
  for(let i=0;i<saved.records.length;i++){
    const record=saved.records[i],printed=consoleReport.records[i];
    const expected=['completed','completed-with-warnings'].includes(record.status);
    assert.equal(record.complete,expected);assert.equal(printed.complete,expected);
    assert.equal(printed.status,record.status);
    assert.equal(record.incompleteResultsWithheld,!expected);
    if(!expected)assert.ok(record.requestedResults.results.every(r=>
      ['suppressed','unavailable'].includes(r.status)&&r.value===null));
  }
  const critical=saved.records.filter(r=>r.name==='exact-derived');assert.equal(critical.length,2);
  for(const r of critical){
    assert.equal(r.complete,false);assert.equal(r.incompleteResultsWithheld,true);
    assert.ok(r.requestedResults.results.some(x=>x.status==='suppressed'));
    assert.ok(r.requestedResults.results.some(x=>x.status==='unavailable'));
  }
  const finished=saved.records.find(r=>r.name==='essential-reflection-only'&&r.mode==='linear');
  assert.equal(finished.complete,true);assert.equal(finished.incompleteResultsWithheld,false);
console.log(JSON.stringify({status:'pass',auditCases:saved.records.length,records:consoleReport.records,report:resolve(output,'report.json')},null,2));
