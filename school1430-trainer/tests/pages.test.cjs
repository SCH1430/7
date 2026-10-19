const {test}=require('node:test');
const assert=require('node:assert/strict');

test('static site works at a repository subpath; links and downloads stay inside it',async()=>{
  const {createServer}=await import('./static-site.mjs');
  const server=createServer({basePath:'/school1430-trainer/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/school1430-trainer/';
  try {
    assert.equal((await fetch(origin+'/school1430-trainer',{redirect:'manual'})).headers.get('location'),'/school1430-trainer/');
    for(const page of ['index.html','oge.html']){
      const response=await fetch(base+page);assert.equal(response.status,200);
      const html=await response.text();
      for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
        const url=new URL(ref,base+page);assert.ok(url.href.startsWith(base));
        assert.equal((await fetch(url)).status,200,url.href);
      }
    }
    for(const file of ['oge-grader-worker.js','oge-program-grader.js','assets/DejaVuSans.ttf','assets/oge-bank/task11-1.zip','assets/oge-bank/practice/table-1.ods']) assert.equal((await fetch(base+file)).status,200,file);
    assert.equal((await fetch(origin+'/core.js')).status,404);
    assert.equal((await fetch(base+'missing.js')).status,404);
    assert.equal((await fetch(base+'Index.html')).status,404,'file names are case-sensitive like GitHub Pages, including on Windows');
    assert.equal((await fetch(origin+'/School1430-trainer/index.html')).status,404,'the repository prefix is case-sensitive');
    assert.notEqual((await fetch(base+'..%5Cpackage.json')).status,200);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('test-only wrapper supports an explicit absolute publication root and static GET/HEAD requests',async()=>{
  const {createServer}=await import('./static-site.mjs');
  assert.throws(()=>createServer({root:'relative/path'}),/absolute path/);
  assert.throws(()=>createServer({basePath:'/../outside/'}),/base path/);
  const server=createServer({basePath:'/fixture/',root:__dirname});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/fixture/`;
  try{
    const response=await fetch(base+'pages.test.cjs');assert.equal(response.status,200);assert.match(await response.text(),/explicit absolute publication root/);
    const head=await fetch(base+'pages.test.cjs',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.ok(Number(head.headers.get('content-length'))>0);
    assert.equal((await fetch(base+'index.html')).status,404,'an explicit root must not fall back to the project root');
    assert.equal((await fetch(base+'Pages.test.cjs')).status,404);
    assert.equal((await fetch(base+'..%5Cindex.html')).status,403);
    assert.equal((await fetch(base+'pages.test.cjs',{method:'POST'})).status,405,'the fixture has no backend endpoints');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
