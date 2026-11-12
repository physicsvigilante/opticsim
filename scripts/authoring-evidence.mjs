// Local CLI evidence storage. Each attempt owns a fresh directory; existing
// evidence is never deleted, overwritten, or paired with a later rejection.
// This is not a sandbox against a hostile process concurrently replacing dirs.
import {lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {AuthoringError} from '../src/authoring.js';
const fail=(code,message)=>{throw new AuthoringError([{path:'--out',code,message}]);};
function stat(path){
  try{return lstatSync(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
function checkedDirectory(path,create){
  let info=stat(path);
  if(!info&&create){
    try{mkdirSync(path);}catch(e){if(e.code!=='EEXIST')throw e;}
    info=stat(path);
  }
  if(info&&(info.isSymbolicLink()||!info.isDirectory()))
    fail('UNSAFE_OUTPUT','Output ancestors must be real directories, not symbolic links or files');
  return info;
}
export function reserveAuthoringOutput(prefix,root){
  if(prefix===null||prefix===undefined)return null;
  if(typeof prefix!=='string'||!prefix.trim())fail('INVALID_OUTPUT','A fresh output directory is required');
  root=resolve(root);
  const target=resolve(prefix),allowed=resolve(root,'test-artifacts/llm-authoring');
  if(!target.startsWith(allowed+sep))
    fail('INVALID_OUTPUT','Output must be a new directory beneath this repo test-artifacts/llm-authoring/');
  const pieces=relative(root,target).split(sep);
  checkedDirectory(root,false);
  // Inspect all existing ancestors before creating anything. In particular,
  // lexical containment alone does not prevent a symlink escape.
  let path=root;
  for(const part of pieces){path=resolve(path,part);checkedDirectory(path,false);}
  if(stat(target))fail('OUTPUT_EXISTS','Output already exists; choose a fresh attempt directory');
  path=root;
  for(const part of pieces.slice(0,-1)){path=resolve(path,part);checkedDirectory(path,true);}
  try{mkdirSync(target);}catch(e){
    if(e.code==='EEXIST')fail('OUTPUT_EXISTS','Another attempt already reserved this directory');
    throw e;
  }
  return {directory:target,input:resolve(target,'input.json'),
    changes:resolve(target,'changes.json'),scene:resolve(target,'scene.ray-optics-2d.json'),
    report:resolve(target,'report.json')};
}
export function writeEvidence(path,content){
  // Exclusive writes also reject existing final-path symbolic links.
  writeFileSync(path,content,{flag:'wx'});
}
