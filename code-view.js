(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PracticumCode=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=/(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|else|elif|for|in|while|and|or|not|True|False|break|continue)\b|\b(?:print|range|int|input|len)\b|\b\d+(?:\.\d+)?\b|==|<=|>=|!=|\/\/|[+*%=/<>-])/g;
  function highlight(source){let out='',cursor=0;for(const match of source.matchAll(token)){out+=escape(source.slice(cursor,match.index));const value=match[0],type=value[0]==='#'?'comment':/^["']/.test(value)?'string':/^\d/.test(value)?'number':/^(print|range|int|input|len)$/.test(value)?'builtin':/^\w/.test(value)?'keyword':'operator';out+=`<span class="py-${type}">${escape(value)}</span>`;cursor=match.index+value.length;}return out+escape(source.slice(cursor));}
  let size=16,initialized=false;
  function initialize(){if(initialized)return;initialized=true;try{const stored=Number(localStorage.getItem('1430.practicum.v1.codeFont'));if(Number.isInteger(stored)&&stored>=14&&stored<=22)size=stored;}catch{}document.documentElement.style.setProperty('--code-font-size',size+'px');}
  function enhance(container){
    initialize();
    for(const pre of container.querySelectorAll('pre.python')){
      const source=pre.textContent.replace(/\r\n?/g,'\n'),lines=source.split('\n'),panel=document.createElement('figure');panel.className='code-panel';panel.codeSource=source;
      panel.innerHTML=`<figcaption class="code-header"><div><span class="code-language">Python</span><span>Код программы</span></div><div class="code-tools"><button type="button" data-action="code-smaller" aria-label="Уменьшить шрифт кода">A−</button><span class="code-font-label" aria-label="Размер шрифта">${size}</span><button type="button" data-action="code-larger" aria-label="Увеличить шрифт кода">A+</button><button type="button" data-action="code-wrap" aria-pressed="false">Перенос</button></div></figcaption><div class="code-scroll" tabindex="0" role="region" aria-label="Код Python. Горизонтальная прокрутка доступна с клавиатуры."><pre class="code-lines"><code>${lines.map((line,i)=>`<span class="code-line"><span class="code-line-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="code-text">${highlight(line)}</span></span>`).join('\n')}</code></pre></div><div class="code-caption">Отступы — часть программы. Номера строк в код не входят.</div>`;
      pre.replaceWith(panel);
    }
  }
  function setSize(delta){initialize();size=Math.max(14,Math.min(22,size+delta));document.documentElement.style.setProperty('--code-font-size',size+'px');document.querySelectorAll('.code-font-label').forEach(el=>el.textContent=size);try{localStorage.setItem('1430.practicum.v1.codeFont',String(size));}catch{}}
  function toggleWrap(button){const panel=button.closest('.code-panel');if(!panel)return;const wrapped=panel.classList.toggle('code-wrapped');button.setAttribute('aria-pressed',String(wrapped));}
  return {highlight,enhance,setSize,toggleWrap};
});
