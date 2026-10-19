const {test}=require('node:test');
const assert=require('node:assert/strict');

test('static site works at a repository subpath; links and downloads stay inside it',async()=>{
  const {createServer}=await import('../server.mjs');
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
    assert.notEqual((await fetch(base+'..%5Cpackage.json')).status,200);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
