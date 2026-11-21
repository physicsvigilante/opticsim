// Exact arithmetic on the represented values supplied by a finite binary64.
export function absolute(value){return value<0n?-value:value;}

function rational(n,d=1n){
  if(d===0n)throw Error('Zero rational denominator');
  if(d<0n){n=-n;d=-d;}
  let a=absolute(n),b=d;
  while(b){const r=a%b;a=b;b=r;}
  return {n:n/a,d:d/a};
}

export function fromBinary64(x){
  if(!Number.isFinite(x))throw Error('Expected finite binary64');
  const view=new DataView(new ArrayBuffer(8));
  view.setFloat64(0,x);
  const bits=view.getBigUint64(0),exp=Number(bits>>52n&2047n);
  let significand=bits&((1n<<52n)-1n);
  if(exp)significand+=1n<<52n;
  if(bits>>63n)significand=-significand;
  const e=exp?exp-1075:-1074;
  return e<0?rational(significand,1n<<BigInt(-e)):rational(significand<<BigInt(e));
}

export const add=(a,b)=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
export const subtract=(a,b)=>rational(a.n*b.d-b.n*a.d,a.d*b.d);
export const multiply=(a,b)=>rational(a.n*b.n,a.d*b.d);
export const divide=(a,b)=>rational(a.n*b.d,a.d*b.n);
export const compare=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
