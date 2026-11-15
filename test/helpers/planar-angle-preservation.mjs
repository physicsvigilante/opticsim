// Deterministic preservation inputs, frozen before extracting shared angle math.
export function planarPreservationCases(){
 const cases=[];
 for(const [n1,n2] of [[1,1.5],[1.5,1],[1.33,1.33],[2,1.25]])
 for(const approach of ['positive','negative'])for(const i of [0,20,45,60,89.999,Math.asin(Math.min(n1,n2)/Math.max(n1,n2))*180/Math.PI]){
  const facts={format:'opticsim-planar-angular-facts-v1',source:{id:'S',region:approach==='positive'?0:1,incidentAngleDeg:i,approach},
   interfaces:[{id:'I',negativeIndex:n1,positiveIndex:n2,partialReflection:false}]};
  for(const action of ['transmit','reflect'])cases.push({facts,query:{format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S',branches:[{id:'B',events:[{interfaceId:'I',action}]}]}});
 }
 for(const [a,b,c] of [[1.6,1.8,1.3],[1.5,2,1],[1,1.5,1.3]])for(const approach of ['positive','negative']){
  const facts={format:'opticsim-planar-angular-facts-v1',source:{id:'S',region:approach==='positive'?0:2},interfaces:[{id:'I1',negativeIndex:a,positiveIndex:b},{id:'I2',negativeIndex:b,positiveIndex:c}]};
  cases.push({facts,query:{format:'opticsim-planar-angle-query-v1',kind:'critical-input-angle',sourceId:'S',boundaryId:approach==='positive'?'I2':'I1',approach,tangentSide:'positive'}});
 }
 return cases;
}
