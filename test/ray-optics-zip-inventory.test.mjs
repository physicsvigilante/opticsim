// Private, inspection-only ZIP central-directory metadata audit.
// No extraction, document rendering, file execution, or mutation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const archive=readFileSync(fileURLToPath(new URL('../08_Ray_Optics_Explanations.zip',import.meta.url)));

test('inventory uploaded ray-optics explanations archive by metadata only',()=>{
  assert.ok(archive.length<100*1024*1024,'Archive exceeds inspection size limit');
  let end=-1;
  for(let i=archive.length-22;i>=Math.max(0,archive.length-22-65535);i--)
    if(archive.readUInt32LE(i)===0x06054b50&&i+22+archive.readUInt16LE(i+20)===archive.length){
      end=i;break;
    }
  assert.ok(end>=0,'ZIP end of central directory not found');
  const count=archive.readUInt16LE(end+10),offset=archive.readUInt32LE(end+16),
    directoryLength=archive.readUInt32LE(end+12);
  assert.ok(count>0&&count<20000,'Invalid/bounded entry count');
  assert.ok(offset+directoryLength<=end,'ZIP directory exceeds archive');
  const entries=[];let pos=offset;
  for(let i=0;i<count;i++){
    assert.equal(archive.readUInt32LE(pos),0x02014b50,'Bad ZIP directory signature');
    const nameLen=archive.readUInt16LE(pos+28),
      extraLen=archive.readUInt16LE(pos+30),commentLen=archive.readUInt16LE(pos+32);
    assert.ok(pos+46+nameLen+extraLen+commentLen<=end,'ZIP directory overrun');
    const name=archive.subarray(pos+46,pos+46+nameLen).toString('utf8');
    entries.push({name,method:archive.readUInt16LE(pos+10),
      encrypted:(archive.readUInt16LE(pos+8)&1)!==0,
      compressed:archive.readUInt32LE(pos+20),
      size:archive.readUInt32LE(pos+24),
      dangerous:/^\/|(^|\/)\.\.(\/|$)/.test(name)||name.includes('\\'),
      directory:name.endsWith('/')});
    pos+=46+nameLen+extraLen+commentLen;
  }
  const files=entries.filter(x=>!x.directory);
  const groups={};
  const ext={};
  let potentialSolutions=0,potentialProblems=0;
  for(const f of files){
    const x=extname(f.name).toLowerCase()||'(none)';
    ext[x]=(ext[x]??0)+1;
    const parts=f.name.split('/');
    for(let depth=1;depth<=Math.min(3,parts.length);depth++){
      const label=parts.slice(0,depth).join('/');
      groups[label]=(groups[label]??0)+1;
    }
    if(/solution|answer|explanation|worked/i.test(f.name))potentialSolutions++;
    if(/problem|question|exercise/i.test(f.name))potentialProblems++;
  }
  const report={
    source:'main:08_Ray_Optics_Explanations.zip',
    zipSha256:createHash('sha256').update(archive).digest('hex'),
    zipBytes:archive.length,entryCount:count,
    files:files.length,directories:entries.length-files.length,
    unpackedBytes:files.reduce((n,x)=>n+x.size,0),
    fileTypes:Object.entries(ext).sort((a,b)=>b[1]-a[1]),
    topGroups:Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,70),
    solutionNameHints:potentialSolutions,questionNameHints:potentialProblems,
    dangerousNames:entries.filter(x=>x.dangerous).map(x=>x.name).slice(0,25),
    encryptedCount:files.filter(x=>x.encrypted).length,
    compressionMethods:[...new Set(files.map(x=>x.method))],
    largest:files.toSorted((a,b)=>b.size-a.size).slice(0,18)
      .map(x=>({name:x.name,unpackedBytes:x.size,compressedBytes:x.compressed})),
    samplePaths:files.slice(0,180).map(x=>x.name),pathsTruncated:files.length>180
  };
  console.log('RAY_OPTICS_ZIP_INVENTORY_START');
  console.log(JSON.stringify(report,null,2));
  console.log('RAY_OPTICS_ZIP_INVENTORY_END');
});