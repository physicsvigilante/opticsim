// Metadata-only inspection of an untrusted problem archive. Nothing is
// extracted, executed, parsed as PDF, or imported into the simulator.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../01_problems.zip',import.meta.url));
test('report JEE ZIP central-directory inventory without extracting or trusting entries',()=>{
  const b=readFileSync(path);
  assert.ok(b.length<20*1024*1024,'Archive exceeds inventory bound');
  let end=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-22-65535);i--)
    if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
  assert.ok(end!==-1,'ZIP end of central directory not found');
  const count=b.readUInt16LE(end+10),offset=b.readUInt32LE(end+16),bytes=b.readUInt32LE(end+12);
  assert.ok(count<=20000,'More than 20,000 entries; manual review required');
  assert.ok(offset+bytes<=end,'ZIP central directory out of bounds');
  const entries=[];let pos=offset;
  for(let i=0;i<count;i++){
    assert.equal(b.readUInt32LE(pos),0x02014b50,'Bad central directory signature');
    const method=b.readUInt16LE(pos+10),csize=b.readUInt32LE(pos+20),
      usize=b.readUInt32LE(pos+24),nameLen=b.readUInt16LE(pos+28),
      extraLen=b.readUInt16LE(pos+30),commentLen=b.readUInt16LE(pos+32),
      localOffset=b.readUInt32LE(pos+42);
    assert.ok(pos+46+nameLen+extraLen+commentLen<=end,'Entry exceeds directory');
    const name=b.subarray(pos+46,pos+46+nameLen).toString('utf8');
    assert.ok(localOffset<b.length,'Local header outside archive');
    entries.push({name,method,compressed:csize,uncompressed:usize,
      isDirectory:name.endsWith('/'),dangerous:/(^|\/)\.\.(\/|$)|^\//.test(name)||name.includes('\\')});
    pos+=46+nameLen+extraLen+commentLen;
  }
  const files=entries.filter(e=>!e.isDirectory),
    clean=files.filter(e=>!/^__MACOSX\//.test(e.name)&&!/\.DS_Store$/.test(e.name)),
    extCounts={},roots={};
  for(const f of clean){
    const ext=extname(f.name).toLowerCase()||'(none)';
    extCounts[ext]=(extCounts[ext]||0)+1;
    const root=f.name.split('/')[0];
    roots[root]=(roots[root]||0)+1;
  }
  const large=[...clean].sort((a,b)=>b.uncompressed-a.uncompressed).slice(0,15);
  const report={
    source:'evaluation/jee-problems:01_problems.zip',
    zipSha256:createHash('sha256').update(b).digest('hex'),
    zipBytes:b.length,entryCount:count,files:files.length,
    logicalFiles:clean.length,directories:entries.length-files.length,
    uncompressedBytes:clean.reduce((n,e)=>n+e.uncompressed,0),
    extensions:Object.entries(extCounts).sort((a,b)=>b[1]-a[1]),
    topLevelGroups:Object.entries(roots).sort((a,b)=>b[1]-a[1]).slice(0,40),
    compressionMethods:[...new Set(entries.map(e=>e.method))],
    suspiciousPaths:entries.filter(e=>e.dangerous).map(e=>e.name).slice(0,20),
    largestFiles:large.map(e=>({name:e.name,size:e.uncompressed})),
    samplePaths:clean.slice(0,300).map(e=>e.name),
    samplePathsTruncated:clean.length>300
  };
  console.log('PROBLEM_ZIP_INVENTORY_START');
  console.log(JSON.stringify(report,null,2));
  console.log('PROBLEM_ZIP_INVENTORY_END');
});