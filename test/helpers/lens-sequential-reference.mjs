// Test-only rational Gaussian conjugates, independent of production ABCD code.
// No native ray generation. Homogeneous u/v pairs avoid division by an
// intermediate infinite image or an intermediate image coincident with a lens.
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a||1n;};
const fraction=(n,d=1n)=>{if(d===0n)throw Error('Reference division by zero');const g=gcd(n,d),s=d<0n?-1n:1n;return[n/g*s,d/g*s];};
const add=([a,b],[c,d])=>fraction(a*d+c*b,b*d);
const neg=([a,b])=>[-a,b];
const mul=([a,b],[c,d])=>fraction(a*c,b*d);
const div=([a,b],[c,d])=>fraction(a*d,b*c);
const number=([a,b])=>Number(a)/Number(b);
const rat=x=>{if(!Number.isInteger(x))throw Error('Exact reference takes integer mm test facts');return [BigInt(x),1n];};
export function sequentialLensReference(objectX,lenses,objectHeight){
  const ls=[...lenses].sort((a,b)=>a.x-b.x);
  let u=rat(ls[0].x-objectX),vn=0n,vd=1n;
  for(let i=0;i<ls.length;i++){
    const f=BigInt(ls[i].focalLength);
    if(!Number.isInteger(ls[i].focalLength))throw Error('Reference focal length must be integer');
    // u=U/V; v=f*U/(U-f*V). Keep raw homogeneous pairs through infinity.
    const [U,V]=u;
    const nextDen=U-f*V;
    vn=f*U;vd=nextDen;
    // Total magnification handled independently below by exact two-rays map:
    // products of ordinary per-lens m are indeterminate at intermediate focus.
    if(i+1<ls.length){
      const gap=BigInt(ls[i+1].x-ls[i].x);
      u=[gap*vd-vn,vd];
    }
  }
  if(vd===0n)return {kind:'at-infinity',distance:null,x:null,magnification:null};
  const v=fraction(vn,vd);
  // Exact two paraxial test rays, with initial heights 0 and 1 at the object.
  // Ray slope is independently updated by -y/f at each stated thin lens.
  const ray=(height,slope)=>{
    let y=rat(height),s=rat(slope),last=objectX;
    for(const l of ls){y=add(y,mul(rat(l.x-last),s));s=add(s,neg(div(y,rat(l.focalLength))));last=l.x;}
    return add(y,mul(v,s));
  };
  const zero=ray(0,1);if(zero[0]!==0n)throw Error('Reference rays do not focus');
  const m=ray(1,0);
  return {kind:number(v)>=0?'finite-real':'finite-virtual',distance:number(v),x:number(add(rat(ls.at(-1).x),v)),magnification:number(m),
    ...(objectHeight===undefined?{}:{y:number(mul(m,rat(objectHeight)))})};
}
