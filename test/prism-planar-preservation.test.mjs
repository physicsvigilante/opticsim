import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {analyzePlanarAngleQuery} from '../src/planar-angle-queries.js';
const reference=JSON.parse(readFileSync(new URL('./fixtures/prism-planar-legacy-baseline.json',import.meta.url)));
test('shared Snell helper preserves 252 complete pre-extraction planar result fingerprints',()=>{
 assert.equal(reference.sourceBlob,'5831b0358da3952efd15d32b0c04e7260eac1f55');assert.equal(reference.cases.length,252);
 for(const c of reference.cases){
  const physical={format:'opticsim-planar-angular-facts-v1',source:{id:'S',region:0,incidentAngleDeg:c.incidenceAngleDeg,approach:'positive'},
   interfaces:[{id:'I',negativeIndex:c.n1,positiveIndex:c.n2,partialReflection:true}]};
  const query={format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S',branches:[
   {id:'T',events:[{interfaceId:'I',action:'transmit'}]},{id:'R',events:[{interfaceId:'I',action:'reflect'}]}]};
  assert.equal(createHash('sha256').update(JSON.stringify(analyzePlanarAngleQuery(physical,query))).digest('hex'),c.sha256);
 }
});
