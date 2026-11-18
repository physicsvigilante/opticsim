// Strict, bounded JSON input for the NEW B1a pair workflow only.
// Ordinary JSON.parse silently drops duplicate keys. We inspect the original
// UTF-8 text first, at every nesting level, including escaped key equivalence.
export class PairInputError extends Error {
  constructor(status,reasonCode,message){
    super(message);this.name='PairInputError';this.status=status;this.reasonCode=reasonCode;
  }
}
const reject=(code,message,status='invalid-input')=>{
  throw new PairInputError(status,code,message);
};
export function parsePairJSON(inputBytes){
  if(!(inputBytes instanceof Uint8Array)||inputBytes.length>1024*1024)
    reject('INVALID_ENVELOPE','The original request must contain at most 1 MiB of bytes.');
  let source;
  try{source=new TextDecoder('utf-8',{fatal:true}).decode(inputBytes);}
  catch{reject('INVALID_ENVELOPE','Request is not valid UTF-8.');}
  const length=source.length;
  let i=0;
  const white=()=>{while(i<length&&/[\u0009\u000a\u000d\u0020]/.test(source[i]))i++;};
  function stringToken(){
    const start=i;
    if(source[i]!=='"')reject('INVALID_ENVELOPE','Expected JSON string.');
    i++;
    while(i<length){
      const c=source[i++];
      if(c==='"'){
        try{return JSON.parse(source.slice(start,i));}
        catch{reject('INVALID_ENVELOPE','Malformed JSON string.');}
      }
      if(c==='\\'){
        if(i>=length)break;
        const escaped=source[i++];
        if(escaped==='u'){
          if(!/^[a-fA-F0-9]{4}$/.test(source.slice(i,i+4)))
            reject('INVALID_ENVELOPE','Invalid JSON Unicode escape.');
          i+=4;
        }else if(!'"\\/bfnrt'.includes(escaped))
          reject('INVALID_ENVELOPE','Invalid JSON escape.');
      }else if(c.charCodeAt(0)<32)
        reject('INVALID_ENVELOPE','Unescaped control character in JSON string.');
    }
    reject('INVALID_ENVELOPE','Unterminated JSON string.');
  }
  const NUMBER=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  function value(depth){
    if(depth>40)reject('INVALID_ENVELOPE','Request JSON nesting exceeds the 40-level bound.');
    white();
    const ch=source[i];
    if(ch==='"'){stringToken();return;}
    if(ch==='{'){
      i++;white();
      const keys=new Set();
      if(source[i]==='}'){i++;return;}
      while(true){
        white();const key=stringToken();
        if(keys.has(key))reject('DUPLICATE_JSON_KEY','Repeated object member "'+key+'" is not permitted.');
        keys.add(key);white();
        if(source[i++]!==':')reject('INVALID_ENVELOPE','Missing JSON object separator.');
        value(depth+1);white();
        const next=source[i++];
        if(next==='}')return;
        if(next!==',')reject('INVALID_ENVELOPE','Expected JSON object comma or close.');
      }
    }
    if(ch==='['){
      i++;white();if(source[i]===']'){i++;return;}
      while(true){
        value(depth+1);white();
        const next=source[i++];
        if(next===']')return;
        if(next!==',')reject('INVALID_ENVELOPE','Expected JSON array comma or close.');
      }
    }
    for(const literal of ['true','false','null'])
      if(source.startsWith(literal,i)){i+=literal.length;return;}
    NUMBER.lastIndex=i;
    const hit=NUMBER.exec(source);
    if(hit){i=NUMBER.lastIndex;return;}
    reject('INVALID_ENVELOPE','Malformed JSON value.');
  }
  value(0);white();
  if(i!==length)reject('INVALID_ENVELOPE','Trailing or malformed JSON input.');
  try{return JSON.parse(source);}
  catch{reject('INVALID_ENVELOPE','Malformed JSON input.');}
}
