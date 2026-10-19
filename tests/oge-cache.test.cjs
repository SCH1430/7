const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../oge-grading.js'),ODF=require('../oge-odf-grader.js');
test('cached office checks expire when their actual ODF grader changes',()=>{
  assert.equal(ODF.version,'1.1.0');
  for(const n of [13,14]){
    assert.equal(G.isCurrent(null,n,ODF.version),false);
    assert.equal(G.isCurrent({engine:'1430-odf',version:'1.0.0'},n,ODF.version),false);
    assert.equal(G.isCurrent({engine:'1430-odf',version:ODF.version},n,ODF.version),true);
    assert.equal(G.isCurrent({engine:'1430-odf',version:ODF.version},n,undefined),false);
    assert.equal(G.isCurrent({engine:'legacy-odf',version:ODF.version},n,ODF.version),false);
  }
  assert.equal(G.isCurrent({engine:'bounded-python',version:'1.0.0'},16,ODF.version),true);
  assert.equal(G.isCurrent({engine:'bounded-kumir-robot',version:'1.0.0'},15,ODF.version),true);
});
