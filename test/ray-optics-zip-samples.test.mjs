// PRIVATE CI post-commit comparison only: three Solution PNGs after first answers were sealed.
// First attempt is already immutable at evaluation/llm-authoring-pilot commit af6fc5dd; no filesystem extraction.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const zip=readFileSync(fileURLToPath(new URL('../08_Ray_Optics_Explanations.zip',import.meta.url)));
const root='08_Ray_Optics_Explanations/';
const wanted=[
'01_Reflection_at_Plane_Surfaces/Solutions/002.png',
'01_Reflection_at_Plane_Surfaces/Solutions/004.png',
'01_Reflection_at_Plane_Surfaces/Solutions/007.png'
].map(x=>root+x);
test('inspect three answer-key images only after first-attempt commit',()=>{
 let end=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-22-65535);i--)
   if(zip.readUInt32LE(i)===0x06054b50){end=i;break;}
 assert.ok(end>=0);
 let pos=zip.readUInt32LE(end+16),count=zip.readUInt16LE(end+10);
 const map=new Map();
 for(let i=0;i<count;i++){
   assert.equal(zip.readUInt32LE(pos),0x02014b50);
   const n=zip.readUInt16LE(pos+28),e=zip.readUInt16LE(pos+30),
     c=zip.readUInt16LE(pos+32),name=zip.subarray(pos+46,pos+46+n).toString('utf8');
   if(wanted.includes(name))map.set(name,{method:zip.readUInt16LE(pos+10),
     usize:zip.readUInt32LE(pos+24),csize:zip.readUInt32LE(pos+20),
     offset:zip.readUInt32LE(pos+42)});
   pos+=46+n+e+c;
 }
 assert.equal(map.size,wanted.length);
 let budget=0;
 for(const name of wanted){
   const e=map.get(name);
   if(e.usize>600000||budget+e.usize>1900000){
     console.log('RAY_OPTICS_SAMPLE_SKIPPED '+JSON.stringify({path:name,bytes:e.usize,reason:'bounded-log-output'}));
     continue;
   }
   const p=e.offset;assert.equal(zip.readUInt32LE(p),0x04034b50);
   const start=p+30+zip.readUInt16LE(p+26)+zip.readUInt16LE(p+28);
   assert.ok(start+e.csize<=zip.length);
   const raw=zip.subarray(start,start+e.csize);
   const data=e.method===0?raw:e.method===8?
      inflateRawSync(raw,{maxOutputLength:600000}):null;
   assert.ok(data&&data.length===e.usize);
   assert.ok(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
   const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
   assert.ok(width>0&&width<10000&&height>0&&height<10000);
   budget+=data.length;
   console.log('RAY_OPTICS_SAMPLE_IMAGE '+JSON.stringify({
     path:name,width,height,data:data.toString('base64')}));
 }
});