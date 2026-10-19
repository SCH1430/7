// Copy only browser resources into the exact GitHub Pages upload directory.
import {mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot,siteFiles} from './site-files.mjs';

export const pagesDirectory=path.join(projectRoot,'output','pages-site');
export async function preparePages(){
  const files=await siteFiles();
  const output=path.resolve(projectRoot,'output'),destination=path.resolve(pagesDirectory);
  if(path.dirname(destination)!==output||path.basename(destination)!=='pages-site')throw Error('Unexpected Pages staging path');
  for(const directory of [output,destination]){
    const stat=await lstat(directory).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
    if(stat?.isSymbolicLink())throw Error('Pages output cannot be a symbolic link: '+directory);
  }
  await rm(destination,{recursive:true,force:true});
  await mkdir(destination,{recursive:true});
  for(const file of files){
    const target=path.join(destination,file.path);
    await mkdir(path.dirname(target),{recursive:true});
    await copyFile(path.join(projectRoot,file.path),target);
  }
  console.log(`Static Pages folder: output/pages-site (${files.length} files, index.html at its root).`);
  return destination;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await preparePages();
