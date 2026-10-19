// One allowlist for validation, Pages publication and the portable archive.
import {readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export async function siteFiles(root=projectRoot){
  const files=[];
  async function collect(relative){
    const absolute=path.join(root,relative),stat=await lstat(absolute);
    if(stat.isSymbolicLink())throw Error('Static files cannot be symbolic links: '+relative);
    if(stat.isDirectory()){
      for(const name of (await readdir(absolute)).sort())await collect(relative+'/'+name);
    }else{
      if(!stat.isFile())throw Error('Not a regular static file: '+relative);
      if(stat.size>=100*1024**2)throw Error('Static file exceeds the GitHub limit: '+relative);
      files.push({path:relative,bytes:stat.size});
    }
  }
  for(const name of (await readdir(root)).sort()){
    if(name==='assets'||name==='.nojekyll'||/\.(?:html|css|js)$/.test(name))await collect(name);
  }
  for(const name of ['index.html','oge.html','.nojekyll']){
    if(!files.some(file=>file.path===name))throw Error('Required Pages file is missing: '+name);
  }
  return files;
}
