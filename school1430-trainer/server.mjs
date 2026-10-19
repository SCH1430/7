import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf','.zip':'application/zip','.json':'application/json; charset=utf-8','.ods':'application/vnd.oasis.opendocument.spreadsheet','.ttf':'font/ttf'};
export function createServer({basePath='/'}={}) {
  const prefix='/' + basePath.split('/').filter(Boolean).join('/');
  if (!/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(prefix)) throw Error('Invalid BASE_PATH');
  const mount=prefix==='/'?'':prefix;
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      let pathname=decodeURIComponent(url.pathname);
      if(mount&&pathname===mount){res.writeHead(301,{Location:mount+'/'+url.search}).end();return;}
      if(mount&&!pathname.startsWith(mount+'/')){res.writeHead(404).end();return;}
      pathname=pathname.slice(mount.length);
      const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
      if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const content=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(content);
    } catch {
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
      res.end('Страница не найдена');
    }
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||1430),basePath=process.env.BASE_PATH||'/';
  createServer({basePath}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/${basePath.split('/').filter(Boolean).join('/')}${basePath==='/'?'':'/'}`));
}
