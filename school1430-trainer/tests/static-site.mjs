// Test-only HTTP fixture for exercising the static site at a GitHub Pages path.
// Import createServer from a browser test; this file has no application CLI.
import http from 'node:http';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const projectRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.zip':'application/zip','.json':'application/json; charset=utf-8','.ods':'application/vnd.oasis.opendocument.spreadsheet','.odt':'application/vnd.oasis.opendocument.text','.odp':'application/vnd.oasis.opendocument.presentation','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const inside=(root,target)=>{const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};

export function createServer({basePath='/',root=process.env.TEST_SITE_ROOT||projectRoot}={}){
  if(typeof basePath!=='string')throw Error('Invalid test base path');
  const prefix='/'+basePath.split('/').filter(Boolean).join('/');
  if(!/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(prefix))throw Error('Invalid test base path');
  if(typeof root!=='string'||!path.isAbsolute(root))throw Error('The test site root must be an absolute path');
  const mount=prefix==='/'?'':prefix,siteRoot=path.resolve(root);
  return http.createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
      const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
      if(pathname.includes('\\')||pathname.includes('\0')){res.writeHead(403).end();return;}
      if(mount&&pathname===mount){res.writeHead(301,{Location:mount+'/'+url.search}).end();return;}
      if(mount&&!pathname.startsWith(mount+'/')){res.writeHead(404).end();return;}
      pathname=pathname.slice(mount.length);
      const target=path.resolve(siteRoot,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
      if(!inside(siteRoot,target)){res.writeHead(403).end();return;}
      // Windows resolves wrong-case file names. Require the exact spelling so
      // local checks catch paths that would fail on GitHub Pages/Linux.
      let directory=siteRoot;
      for(const part of path.relative(siteRoot,target).split(path.sep).filter(Boolean)){
        if(!(await readdir(directory)).includes(part)){res.writeHead(404).end();return;}
        directory=path.join(directory,part);
      }
      if(!inside(await realpath(siteRoot),await realpath(target))){res.writeHead(403).end();return;}
      const content=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':content.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:content);
    }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Страница не найдена');}
  });
}
