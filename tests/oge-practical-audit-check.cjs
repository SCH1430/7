const assert=require('node:assert/strict'),path=require('node:path'),O=require('../oge-core.js'),ZIP=require('../oge-zip.js');
const {chromium,launchOptions}=require('./browser-runtime.cjs');
(async()=>{
  const F=await import('./fixtures-oge.mjs'),P=await import('./fixtures-oge-practice.mjs'),L=await import('./fixtures-oge-levels.mjs');
  const browser=await chromium.launch(launchOptions);
  try{
    const page=await browser.newPage();await page.addScriptTag({path:path.resolve(__dirname,'../oge-zip.js')});await page.addScriptTag({path:path.resolve(__dirname,'../oge-odf-grader.js')});
    const cases=[];
    async function mutate(buffer,file,fn){const entries=await ZIP.read(new Uint8Array(buffer));entries.set(file,Buffer.from(fn(Buffer.from(entries.get(file)).toString('utf8'))));return F.pack(entries);}
    async function grade(name,t,buffer,choice13='13.1',expected=t.max){
      const result=await page.evaluate(async({n,grading,b64,choice13})=>ODFGrader1430.grade(n,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),{grading,choice13}),{n:t.n,grading:t.grading,b64:Buffer.from(buffer).toString('base64'),choice13});
      cases.push({name,points:result.points,expected,checks:result.checks.filter(c=>!c.ok).map(c=>c.id)});return result;
    }
    const office=O.bankById('oge-level-challenge-13-1'),odt=L.buildODT(office.grading),odp=L.buildODP(office.grading);
    await grade('level ODT baseline',office,odt,'13.2');
    await grade('mixed fonts from the same sans category must not receive full marks',office,await mutate(odt,'styles.xml',s=>s.replace(/(style:name="Body"[^>]*><style:text-properties)/,'$1 fo:font-family="Calibri"')),'13.2','below-max');
    await grade('heading line spacing 200% contradicts required 1.15',office,await mutate(odt,'styles.xml',s=>s.replace(/(style:name="Title"[\s\S]*?<style:paragraph-properties)/,'$1 fo:line-height="200%"')),'13.2','below-max');
    await grade('equivalent numeric line spacing is accepted',office,await mutate(odt,'styles.xml',s=>s.replace(/fo:line-height="115%"/g,'fo:line-height="16.1pt"').replace(/(style:name="Title"[\s\S]*?<style:paragraph-properties)/,'$1 fo:line-height="23pt"')),'13.2');
    async function transition(buffer){let next=await mutate(buffer,'styles.xml',s=>s.replace('<office:document-styles ','<office:document-styles xmlns:smil="urn:oasis:names:tc:opendocument:xmlns:smil-compatible:1.0" ').replace('<office:styles>','<office:styles><style:style style:name="AuditTransition" style:family="drawing-page"><style:drawing-page-properties smil:type="barWipe"/></style:style>'));return mutate(next,'content.xml',s=>s.replace('<draw:page ','<draw:page draw:style-name="AuditTransition" '));}
    await grade('level slides detect modern SMIL transition properties',office,await transition(odp),'13.1','below-max');
    const official=O.bankById('oge-fipi-13');
    await grade('original slide checker detects SMIL transition properties',official,await transition(F.buildODP()),'13.1','below-max');
    await grade('title outside slide bounds must not receive full marks',official,await mutate(F.buildODP(),'content.xml',s=>s.replace('svg:x="2cm"','svg:x="100cm"')),'13.1','below-max');
    for(const task of [O.bankById('oge-fipi-14'),O.bankById('oge-authored-14-1'),O.bankById('oge-level-challenge-14-1')]){
      const answer=await P.buildAnswer(task),buffer=answer.buffer;
      await grade(task.bankId+': baseline',task,buffer);
      await grade(task.bankId+': stale formula in source data is rejected',task,await mutate(buffer,'content.xml',s=>s.replace('office:value-type="float"','table:formula="of:=0" office:value-type="float"')),'13.1',0);
      await grade(task.bankId+': valid formula preserving source value is accepted',task,await mutate(buffer,'content.xml',s=>s.replace(/office:value-type="float" office:value="([\d.]+)"/,(_,v)=>`table:formula="of:=${v}" office:value-type="float" office:value="${v}"`)));
      const unsupported=await grade(task.bankId+': unsupported source formula stays unverified',task,await mutate(buffer,'content.xml',s=>s.replace('office:value-type="float"','table:formula="of:=UNKNOWN(1)" office:value-type="float"')),'13.1',0);
      assert.equal(unsupported.incomplete,true);assert.equal(unsupported.unverifiedIds.length,3);
      await grade(task.bankId+': extra participant row cannot change the source dataset',task,await mutate(buffer,'content.xml',s=>{const row='<table:table-row><table:table-cell office:value-type="string"><text:p>Участник 9999</text:p></table:table-cell>'+[1,7,100].map(value=>`<table:table-cell office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`).join('')+'</table:table-row>';let index=-1;return s.replace(/<table:table-row\b[^>]*>[\s\S]*?<\/table:table-row>/g,tr=>++index===(task.grading?.rowCount||1000)?tr+row:tr);}),'13.1',0);
      await grade(task.bankId+': stale chart data formula cannot earn diagram point',task,await mutate(buffer,'Object 1/content.xml',s=>s.replace('office:value-type="float"','table:formula="of:=0" office:value-type="float"')),'13.1',2);
      await grade(task.bankId+': row permutation in chart preserves label-value pairs',task,await mutate(buffer,'Object 1/content.xml',s=>{const rows=[...s.matchAll(/<table:table-row\b[^>]*>[\s\S]*?<\/table:table-row>/g)].map(m=>m[0]);assert.equal(rows.length,4);let index=0;return s.replace(/<table:table-row\b[^>]*>[\s\S]*?<\/table:table-row>/g,()=>[rows[0],rows[3],rows[1],rows[2]][index++]);}));
    }
    console.log(JSON.stringify(cases,null,2));
    for(const c of cases)if(c.expected==='below-max')assert.ok(c.points<2,c.name);else assert.equal(c.points,c.expected,c.name);
    console.log('PASS:',cases.length,'targeted practical audit regression checks.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
