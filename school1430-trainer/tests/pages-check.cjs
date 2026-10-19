// Run the full existing browser scenarios against a Pages-style repository prefix.
const {spawn}=require('node:child_process');
const {mkdir}=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  await mkdir(path.join(__dirname,'../output'),{recursive:true});
  const {createServer}=await import('../server.mjs');
  const server=createServer({basePath:'/school1430-trainer/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/school1430-trainer/`;
  try{
    for(const [script,url] of [['random-check.cjs',base],['oge-random-check.cjs',base+'oge.html']]){
      console.log(`Browser check: ${script} at ${url}`);
      await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[path.join(__dirname,script)],{stdio:'inherit',windowsHide:true,env:{...process.env,TRAINER_URL:url}});
        child.once('error',reject);
        child.once('exit',code=>code===0?resolve():reject(Error(`${script} failed: ${code}`)));
      });
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
