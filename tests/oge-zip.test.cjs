const {test}=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),Z=require('../oge-zip.js');
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function zip(files,options={}){
  let offset=0;const locals=[],central=[],positions=[];
  for(const item of files){const name=Buffer.isBuffer(item.name)?item.name:Buffer.from(item.name),data=Buffer.from(item.data||''),method=item.method??8,packed=method===8?zlib.deflateRawSync(data):data,flags=item.flags??0x800,crc=crc32(data),local=Buffer.alloc(30),c=Buffer.alloc(46),descriptor=flags&8?Buffer.alloc(16):Buffer.alloc(0);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);if(!(flags&8)){local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);}local.writeUInt16LE(name.length,26);
    c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
    if(descriptor.length){descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(packed.length,8);descriptor.writeUInt32LE(data.length,12);}positions.push({local:offset,data:offset+30+name.length});locals.push(local,name,packed,descriptor);central.push(c,name);offset+=local.length+name.length+packed.length+descriptor.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22),comment=Buffer.from(options.comment||'');end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(comment.length,20);let cursor=offset;files.forEach((f,i)=>{positions[i].central=cursor;cursor+=46+(Buffer.isBuffer(f.name)?f.name.length:Buffer.byteLength(f.name));});const buffer=Buffer.concat([...locals,directory,end,comment]);return {buffer,positions,end:buffer.length-comment.length-22};
}
test('ZIP reads stored and deflated ODF entries, normalizes paths, handles offset views and descriptors',async()=>{
  const source=zip([{name:'mimetype',data:'application/vnd.oasis.opendocument.text',method:0,flags:0},{name:'content.xml',data:'<text>Привет &amp; код</text>'},{name:'Pictures\\photo.png',data:Buffer.from([0,255,3,5]),flags:0x808},{name:'empty/',data:''}],{comment:'school1430'}),outer=Buffer.concat([Buffer.alloc(11),source.buffer,Buffer.alloc(7)]),result=await Z.read(outer.subarray(11,11+source.buffer.length));
  assert.deepEqual([...result.keys()],['mimetype','content.xml','Pictures/photo.png','empty/']);assert.equal(Buffer.from(result.get('content.xml')).toString(),'<text>Привет &amp; код</text>');assert.deepEqual([...result.get('Pictures/photo.png')],[0,255,3,5]);assert.ok(result.get('content.xml') instanceof Uint8Array);const empty=await Z.read(zip([]).buffer);assert.equal(empty.size,0);
});
test('ZIP supports Node bounded fallback when DecompressionStream is absent',async()=>{const old=global.DecompressionStream;try{global.DecompressionStream=undefined;const file=zip([{name:'content.xml',data:'текст'.repeat(1000)}]);assert.equal(Buffer.from((await Z.read(file.buffer)).get('content.xml')).toString(),'текст'.repeat(1000));const empty=await Z.read(zip([{name:'empty.txt'}]).buffer);assert.equal(empty.get('empty.txt').length,0);}finally{global.DecompressionStream=old;}});
test('ZIP rejects traversal, absolute paths, invalid UTF-8, normalization collisions and encrypted entries',async()=>{
  for(const name of ['../content.xml','x/../content.xml','/content.xml','C:/content.xml','x/./content.xml','x\u0000.xml',Buffer.from([0x82,0xff,0x2e,0x78])])await assert.rejects(Z.read(zip([{name,data:'x'}]).buffer),/ZIP/);
  for(const names of [['x/a','x//a'],['Pictures/a','Pictures\\a'],['ё.xml','ё.xml']])await assert.rejects(Z.read(zip(names.map(name=>({name,data:'x'}))).buffer),/повторяющиеся/);
  for(const flags of [1,0x40,0x2000])await assert.rejects(Z.read(zip([{name:'x',flags,data:'x'}]).buffer),/ZIP/);
});
test('ZIP validates checksums, truncated data, local header consistency and descriptors',async()=>{
  const s=zip([{name:'x',method:0,data:'hello'}]);s.buffer[s.positions[0].data]^=1;await assert.rejects(Z.read(s.buffer),/контрольная сумма/);
  const d=zip([{name:'x',data:'hello',flags:8}]);d.buffer[d.positions[0].central-4]^=1;await assert.rejects(Z.read(d.buffer),/дескриптор/);
  const local=zip([{name:'x',data:'hello'}]);local.buffer.writeUInt32LE(123,local.positions[0].local+22);await assert.rejects(Z.read(local.buffer),/заголов/);
  const corrupt=zip([{name:'x',data:'hello'.repeat(200)}]);corrupt.buffer[corrupt.positions[0].data]=0xff;await assert.rejects(Z.read(corrupt.buffer),/ZIP/);
  for(const data of [Buffer.alloc(0),Buffer.alloc(22),zip([{name:'x'}]).buffer.subarray(0,-1),Buffer.from('not an archive')])await assert.rejects(Z.read(data),/ZIP/);await assert.rejects(Z.read('invalid'),/ZIP/);
});
test('ZIP rejects ZIP64, multidisk, unknown compression, overlapping entries and count abuse',async()=>{
  for(const mutate of [x=>x.buffer.writeUInt16LE(65535,x.end+10),x=>x.buffer.writeUInt32LE(0xffffffff,x.end+12),x=>x.buffer.writeUInt16LE(1,x.end+4),x=>x.buffer.writeUInt16LE(2001,x.end+8)||x.buffer.writeUInt16LE(2001,x.end+10),x=>x.buffer.writeUInt16LE(99,x.positions[0].central+10),x=>x.buffer.writeUInt32LE(x.positions[0].local,x.positions[1].central+42)]){const x=zip([{name:'a',data:'one'},{name:'b',data:'two'}]);mutate(x);await assert.rejects(Z.read(x.buffer),/ZIP/);}
});
test('ZIP checks declared output bounds before inflate and bounds dishonest decompression',async()=>{
  const tooLarge=zip([{name:'a',data:'x'}]);tooLarge.buffer.writeUInt32LE(32*1024*1024+1,tooLarge.positions[0].central+24);await assert.rejects(Z.read(tooLarge.buffer),/лимит/);
  const total=zip([{name:'a',data:'x'},{name:'b',data:'x'},{name:'c',data:'x'}]);for(const p of total.positions){total.buffer.writeUInt32LE(32*1024*1024,p.central+24);total.buffer.writeUInt32LE(32*1024*1024,p.local+22);}await assert.rejects(Z.read(total.buffer),/лимит/);
  const bomb=zip([{name:'a',data:'x'.repeat(1000000)}]);bomb.buffer.writeUInt32LE(10,bomb.positions[0].central+24);bomb.buffer.writeUInt32LE(10,bomb.positions[0].local+22);await assert.rejects(Z.read(bomb.buffer),/размер/);
});
