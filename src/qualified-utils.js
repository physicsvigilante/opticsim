// Browser/Node shared integrity helpers. Hashes detect mismatches, not truth.
import {serializeSave} from './contract.js';
export async function sha256Text(text){
  const result=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
export const sceneHash=doc=>sha256Text(serializeSave(doc));
export function canonicalJSON(value,depth=0){
  if(depth>40)throw Error('Metadata nesting exceeds 40 levels');
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(v=>canonicalJSON(v,depth+1)).join(',')+']';
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k],depth+1)).join(',')+'}';
  throw Error('Only finite JSON data is supported');
}
export const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function boundedText(value,label,max=1200){
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+' must be nonempty bounded text');
  return value;
}
