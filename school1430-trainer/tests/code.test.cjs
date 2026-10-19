const {test}=require('node:test'),assert=require('node:assert/strict'),Code=require('../dist/code-view.js');
test('Python highlighting preserves indentation and source characters while escaping markup',()=>{
  const source='    if x <= 12 and name == "<img>": # comment\n        print("ДА")';
  const html=Code.highlight(source);assert.match(html,/^    /);assert.match(html,/py-keyword/);assert.match(html,/py-number/);assert.match(html,/py-string/);assert.match(html,/py-comment/);assert.match(html,/py-builtin/);assert.ok(!html.includes('<img>'));assert.match(html,/&lt;img&gt;/);
  const plain=html.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');assert.equal(plain,source);
});
test('string/comment contents are not highlighted as executable keywords and untrusted text stays inert',()=>{
  assert.equal((Code.highlight('print("if 12") # for 8').match(/py-keyword/g)||[]).length,0);assert.ok(!Code.highlight('<script>alert("x")</script>').includes('<script>'));
});
