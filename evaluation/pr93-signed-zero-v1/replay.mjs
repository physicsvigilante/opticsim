// TEST-ONLY: replay pinned native binary64 determinant on original PR92 JSON.
// No PhyDemo execution; this emits reproducible IEEE754 bit patterns for Python comparison.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=process.argv[2],output=process.argv[3];
assert.ok(dir&&output,'usage: node replay.mjs ORIGINAL_PR92_DIR output.json');
const hashes={
 'inputs.json':'79be6692d8e107ed5fa2198abbcfe56a0fb97633aac55db573eec021ea37fc45',
 'report.json':'bc0fee95fe8e0d61176aed8adf96081324cfa0ea1846caf1997e9fbc51570960',
 'exact-reference.json':'9e3d386abceaa907063f0c01b3b40fc399e8a6e764da231a1959e6d24c1145ee'
};
for(const [file,digest] of Object.entries(hashes)){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+file)).digest('hex'),digest,file);
}
const report=JSON.parse(fs.readFileSync(dir+'/report.json','utf8'));
function bits(x){const b=Buffer.alloc(8);b.writeDoubleBE(x);return b.toString('hex');}
function native(p1,p2,a,b){
 const A=p2.x*p1.y-p1.x*p2.y;
 const B=b.x*a.y-a.x*b.y;
 const xa=p2.x-p1.x;
 const xb=b.x-a.x;
 const ya=p2.y-p1.y;
 const yb=b.y-a.y;
 return {x:(A*xb-B*xa)/(xa*yb-xb*ya),y:(A*yb-B*ya)/(xa*yb-xb*ya)};
}
function distance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}
const result=[];
for(const row of report.records){
 if(row.mode!=='single-owner-tap') continue;
 for(let index=0;index<row.actualNativeHitCoordinates.length;index++){
  const hit=row.actualNativeHitCoordinates[index];
  // Archived vertices are authored y-UP; native ray/incident are y-DOWN.
  const candidates=row.nativeFaceVertices.map(f=>({
   id:f.id,a:{x:f.a.x,y:-f.a.y},b:{x:f.b.x,y:-f.b.y}
  })).filter(f=>distance(hit.incident,f.a,f.b)<=1e-5);
  assert.equal(candidates.length,1,'one source-grounded finite face');
  const face=candidates[0];
  const point=native(hit.p1,hit.p2,face.a,face.b);
  // JS assert.strictEqual distinguishes -0 from +0 via Object.is;
  // this step explicitly checks numerical == and leaves bit identity to bytes below.
  assert.ok(point.x===hit.incident.x,'numeric x mismatch');
  assert.ok(point.y===hit.incident.y,'numeric y mismatch');
  result.push({
   ordinal:row.ordinal,hitIndex:index,faceId:face.id,
   point:[point.x,point.y],pointBits:[bits(point.x),bits(point.y)],
   recordedBits:[bits(hit.incident.x),bits(hit.incident.y)]
  });
 }
}
assert.equal(result.length,87);
const signs=result.filter(x=>x.pointBits.some((b,i)=>b!==x.recordedBits[i]));
assert.equal(signs.length,12,'Direct native-JS vs serialized JSON sign-only count changed');
fs.writeFileSync(output,JSON.stringify({
 format:'opticsim-research-js-number-signed-zero-v1',
 count:result.length,numericEqual:true,
 signedZeroDifferencesVsSerializedJSON:signs.length,
 events:result
},null,2)+'\n');
console.log('JS_NATIVE_NUMBER_REPLAY '+JSON.stringify({count:result.length,signedZeroVsSerialized:signs.length}));
