// Make a clean Pages repository: index.html is at the inner folder's root.
import {readdir,readFile,lstat,mkdir,open,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditState} from './oge-audit-state.mjs';
import {siteFiles} from './site-files.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'output'),name='school1430-trainer-github.zip';
const allowed=['.github','.gitattributes','.gitignore','README.md','package.json','tests','tools','sources','quality'];
const files=await siteFiles(root);
async function collect(relative){
  const absolute=path.join(root,relative),stat=await lstat(absolute);
  if(stat.isSymbolicLink())throw Error('Links cannot enter the GitHub archive: '+relative);
  if(stat.isDirectory()){
    for(const entry of (await readdir(absolute)).sort())await collect(relative+'/'+entry);
  }else{
    if(!stat.isFile())throw Error('Not a regular source file: '+relative);
    if(relative.startsWith('tests/')&&!/\.(?:cjs|mjs)$/.test(relative))return;
    if(/(?:^|\/)(?:node_modules|output|\.git|\.codex|\.aws)(?:\/|$)|(?:^|\/)\.env(?:\.|$)/.test(relative))throw Error('Unexpected private or generated path: '+relative);
    if(stat.size>=100*1024**2)throw Error('File exceeds the GitHub limit: '+relative);
    files.push({path:relative,bytes:stat.size});
  }
}
for(const relative of allowed)await collect(relative);
const required=['index.html','oge.html','.nojekyll','.github/workflows/pages.yml','quality/oge-audit.json','tests/browser-runtime.cjs','tools/audit-oge.mjs','tools/prepare-pages.mjs'];
for(const file of required)if(!files.some(item=>item.path===file))throw Error('Required source is missing: '+file);
if(files.some(item=>item.path==='server.mjs'||item.path==='start-trainer.cmd'||item.path.startsWith('dist/')))throw Error('The Pages package must have a root index and no application server.');
const audit=JSON.parse(await readFile(path.join(root,'quality/oge-audit.json'),'utf8'));
if(audit.taskCount!==400||audit.passed!==true)throw Error('A passing audit of all 400 tasks is required before packaging.');
if(audit.state?.sha256!==(await auditState()).sha256)throw Error('The audit is stale. Run npm run audit:oge against the current sources.');
// Recheck actual asset bytes as well as source fingerprints before packaging.
await import('./check-pages.mjs');
const table=Uint32Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
await mkdir(output,{recursive:true});
const archive=await open(path.join(output,name),'w'),directory=[];let offset=0;
async function write(buffer){let written=0;while(written<buffer.length){const result=await archive.write(buffer,written,buffer.length-written,offset+written);written+=result.bytesWritten;}offset+=buffer.length;}
try{
  for(const item of files){
    const original=await readFile(path.join(root,item.path)),encodedName=Buffer.from('school1430-trainer/'+item.path,'utf8');
    const compressed=/\.(?:js|mjs|cjs|html|css|svg|md|json|yml|cmd)$/.test(item.path)?deflateRawSync(original,{level:9}):original,method=compressed===original?0:8,crc=crc32(original),start=offset;
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(method,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(original.length,22);header.writeUInt16LE(encodedName.length,26);
    await write(header);await write(encodedName);await write(compressed);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(method,10);central.writeUInt16LE(0x21,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(original.length,24);central.writeUInt16LE(encodedName.length,28);central.writeUInt32LE(start,42);directory.push(central,encodedName);
    item.sha256=createHash('sha256').update(original).digest('hex');
  }
  const start=offset;for(const buffer of directory)await write(buffer);const size=offset-start,end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(start,16);await write(end);
}finally{await archive.close();}
const manifest={archive:name,files:files.length,bytes:offset,sha256:createHash('sha256').update(await readFile(path.join(output,name))).digest('hex'),entries:files};
await writeFile(path.join(output,'github-package-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`GitHub Pages package: output/${name} (${files.length} files, ${(offset/1024**2).toFixed(1)} MiB). Inner folder has index.html at its root; no application server.`);
