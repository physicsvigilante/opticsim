// Bounded, opt-in sample reader for visual review in a PRIVATE CI run.
// Copies a few selected PNGs into base64 log markers. No ZIP paths are
// trusted for filesystem writes; no other content is extracted or executed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const buf=readFileSync(fileURLToPath(new URL('../01_problems.zip',import.meta.url)));
const root='14_Geometrical_Optics_Part1/';
const wanted=[
'01_Reflection_Plane_Mirror/Problems/asc_004.png',
'01_Reflection_Plane_Mirror/Problems/bmc_004.png',
'01_Reflection_Plane_Mirror/Problems/cnt_005.png',
'02_Reflection_Spherical_Mirror/Problems/asc_004.png',
'02_Reflection_Spherical_Mirror/Problems/dmt_004.png',
'03_Refraction_Plane_Surface_1/Problems/asc_004.png',
'04_Refraction_Plane_Surface_2/Problems/bmc_004.png',
'05_Prism/Problems/asc_004.png',
'05_Prism/Problems/cnt_004.png'
].map(n=>root+n);
test('selected corpus images are PNGs; emit bounded private visual samples',()=>{
 let end=-1;
 for(let i=buf.length-22;i>=Math.max(0,buf.length-22-65535);i--)
   if(buf.readUInt32LE(i)===0x06054b50){end=i;break;}
 assert.ok(end>=0);
 const count=buf.readUInt16LE(end+10);let at=buf.readUInt32LE(end+16);
 const entries=new Map();
 for(let i=0;i<count;i++){
   assert.equal(buf.readUInt32LE(at),0x02014b50);
   const nl=buf.readUInt16LE(at+28),el=buf.readUInt16LE(at+30),
     cl=buf.readUInt16LE(at+32),name=buf.subarray(at+46,at+46+nl).toString('utf8');
   if(wanted.includes(name))entries.set(name,{
     method:buf.readUInt16LE(at+10),uncompressed:buf.readUInt32LE(at+24),
     compressed:buf.readUInt32LE(at+20),offset:buf.readUInt32LE(at+42)});
   at+=46+nl+el+cl;
 }
 assert.equal(entries.size,wanted.length);
 for(const name of wanted){
   const e=entries.get(name);
   assert.ok(e.uncompressed>0&&e.uncompressed<=200000,'Image exceeds 200 KB bound');
   const start=e.offset;assert.equal(buf.readUInt32LE(start),0x04034b50);
   const off=start+30+buf.readUInt16LE(start+26)+buf.readUInt16LE(start+28);
   assert.ok(off+e.compressed<=buf.length);
   const data=buf.subarray(off,off+e.compressed);
   const png=e.method===0?data: e.method===8?
     inflateRawSync(data,{maxOutputLength:200000}):null;
   assert.ok(png,'Unsupported ZIP compression');
   assert.equal(png.length,e.uncompressed);
   assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
   const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
   assert.ok(width>0&&width<10000&&height>0&&height<10000);
   console.log('PROBLEM_ZIP_IMAGE '+JSON.stringify({path:name,width,height,
     data:png.toString('base64')}));
 }
});