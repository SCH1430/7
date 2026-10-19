const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/oge-program-grader.js');
const python=`c = 0
x = int(input())
while x > 0:
    if x % 8 == 5 and 511 < x < 4096:
        c += 1
    x = int(input())
print(c)`;
const robot=`использовать Робот
алг
нач
| Поднимаемся к вершине
нц пока не справа свободно
    закрасить
    вверх
    вправо
кц
закрасить
вправо
вниз
нц пока слева стена
    закрасить
    вправо
    вниз
кц
кон`;
test('OGE 16: official solution gets 2 and passes official plus boundary cases',()=>{const r=G.grade16(python,{filename:'answer.py'});assert.equal(r.points,2);assert.equal(r.supported,true);assert.equal(r.officialPassed,3);assert.equal(r.diagnosticPassed,r.diagnosticTotal);assert.equal(r.errors.length,0);assert.ok(r.caveats.length);assert.ok(r.testResults.some(t=>t.input.length===1001));});
test('OGE 16: alternative loops, break, continue, elif, oct and string indexing are interpreted',()=>{const s=`c = 0
for i in range(1001):
    x = int(input())
    if x == 0:
        break
    elif x < 512 or x >= 4096:
        continue
    if len(oct(x)[2:]) == 4 and oct(x)[-1] == '5':
        c = c + 1
print(c)`;const r=G.grade16(s);assert.equal(r.points,2,JSON.stringify(r.errors));assert.equal(r.diagnosticPassed,5);});
test('OGE 16: exactly one official failure gives 1, other errors give 0',()=>{const one=G.grade16(python.replace('x % 8 == 5 and','(x % 8 == 5 or x == 535) and'));assert.equal(one.officialPassed,2);assert.equal(one.points,1);const zero=G.grade16(python.replace('x % 8','x % 10'));assert.equal(zero.points,0);assert.ok(zero.errors.length>0);});
test('OGE 16: diagnostic boundaries expose an error without rewriting FIPI test points',()=>{const r=G.grade16(python.replace('511 < x','500 < x'));assert.equal(r.points,2);assert.equal(r.officialPassed,3);assert.ok(r.testResults.find(t=>t.id==='boundaries').ok===false);assert.ok(r.errors.some(e=>e.includes('boundaries')));assert.match(r.scoreBasis,/не меняют/);});
test('OGE 16: comparisons preserve Python types, structural list equality and bool-number equality',()=>{const bad=G.grade16(python.replace('x % 8 == 5 and 511 < x < 4096',"'511' < x < '4096' and x % 8 == 5"));assert.equal(bad.points,0);assert.equal(bad.supported,true);assert.ok(bad.testResults.filter(t=>t.official).every(t=>t.code==='runtime'));const list=G.grade16(python.replace('x % 8 == 5 and 511 < x < 4096','[x % 8, 512 <= x < 4096] == [5, True]'));assert.equal(list.points,2,JSON.stringify(list.errors));assert.equal(list.diagnosticPassed,5);const bool=G.grade16(python.replace('x % 8 == 5 and 511 < x < 4096','[x % 8 == 5, 512 <= x < 4096] == [1, 1]'));assert.equal(bool.points,2);const membership=G.grade16(python.replace('x % 8 == 5 and 511 < x < 4096','[x % 8, 512 <= x < 4096] in [[5, True]]'));assert.equal(membership.points,2);const invalidIn=G.grade16(python.replace('x % 8 == 5','5 in oct(x)'));assert.equal(invalidIn.points,0);assert.ok(invalidIn.testResults.filter(t=>t.official).every(t=>t.code==='runtime'));});
test('OGE 16: constant sample output and infinite loops do not pass',()=>{const hard=G.grade16('print(3)');assert.equal(hard.points,0);assert.equal(hard.officialPassed,1);const loop=G.grade16('while True:\n    pass',{stepLimit:1000});assert.equal(loop.points,0);assert.ok(loop.testResults.every(t=>t.code==='timeout'));assert.ok(loop.testResults.every(t=>t.steps<=1001));});
test('OGE 16: imports, host APIs and other languages are explicit unsupported cases',()=>{globalThis.__ogeProgramTest=0;for(const s of ["import os\nprint(1)","open('answer.txt')","__import__('os').system('echo x')","globalThis.__ogeProgramTest = 99"]){const r=G.grade16(s);assert.equal(r.supported,false,s);}assert.equal(globalThis.__ogeProgramTest,0);assert.equal(G.grade16(python,{filename:'a.cpp'}).supported,false);delete globalThis.__ogeProgramTest;const comments=G.grade16('# import os; open; globalThis\n'+python+'\n# network is never called');assert.equal(comments.points,2);});
test('OGE 16: recursion and oversized input are bounded; extra output is a real error',()=>{const deep='print('+'('.repeat(100)+'1'+')'.repeat(100)+')';assert.equal(G.grade16(deep).supported,false);const nested=Array.from({length:40},(_,i)=>' '.repeat(i)+'if True:').join('\n')+'\n'+' '.repeat(40)+'print(0)';assert.equal(G.grade16(nested).supported,false);assert.equal(G.grade16('x'.repeat(100001)).supported,false);assert.equal(G.grade16(python.replace('input()','input("Введите число")')).points,0);});
test('OGE 15: official algorithm succeeds on all shapes with unequal heights',()=>{const r=G.grade15(robot);assert.equal(r.points,2,JSON.stringify(r.errors));assert.equal(r.supported,true);assert.ok(r.testResults.length>=20);assert.ok(r.testResults.every(t=>t.ok));assert.ok(r.testResults.some(t=>t.up===512&&t.down===1));assert.ok(r.testResults.some(t=>t.up===1&&t.down===512));assert.match(r.caveats[0],/конечному/);});
test('OGE 15: at most ten missing cells is 1, omitting a whole long side is 0',()=>{const one=G.grade15(robot.replace('закрасить\nвправо\nвниз\nнц','вправо\nвниз\nнц'));assert.equal(one.points,1,JSON.stringify(one.errors));assert.ok(one.testResults.every(t=>t.missing===1&&t.terminated));const omit=G.grade15(robot.replace('    закрасить\n    вправо\n    вниз','    вправо\n    вниз'));assert.equal(omit.points,0);assert.ok(omit.testResults.some(t=>t.missing>10));});
test('OGE 15: collisions and nontermination are diagnosed, not executed on the host',()=>{const collision=G.grade15('вправо');assert.equal(collision.points,0);assert.ok(collision.testResults.every(t=>t.code==='collision'));const loop=G.grade15('нц пока справа стена\nзакрасить\nкц',{stepLimit:1000});assert.equal(loop.points,0);assert.ok(loop.testResults.every(t=>t.code==='timeout'));assert.equal(G.grade15('fetch("https://example.com")').supported,false);});
test('OGE 15: boolean sensors and CDATA source extraction preserve the algorithm',()=>{const s=robot.replace('не справа свободно','(справа стена) и (не сверху стена)').replace('слева стена','не (слева свободно)');assert.equal(G.grade15(s).points,2);assert.equal(G.grade15('<?xml version="1.0"?><program><source><![CDATA['+robot+']]></source></program>').points,2);assert.equal(G.grade15('<binary><blob>not source</blob></binary>').supported,false);});
