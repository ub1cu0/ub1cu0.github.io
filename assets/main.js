// --- Scripts extraídos de index.html ---
const METAS_VISIBLE = 5; // cuántas metas visibles sin deslizar
document.getElementById('year').textContent=new Date().getFullYear();
(function(){const r=document.getElementById('rain');const c=Math.floor(window.innerWidth/60);const w=Math.floor(window.innerHeight/24);const h='0123456789abcdef'.split('');let x='';for(let i=0;i<c;i++){for(let j=0;j<w;j++){const ch=h[(i*7+j*13)%h.length];x+=`<i style="left:${i*60+10}px; top:${j*24+6}px;">${ch}</i>`}}r.innerHTML=x})();
function $(id){return document.getElementById(id)}
const PATHS={pwn:'pwn',htb:'htb'}
function setView(showLanding){
  document.body.classList.remove('mode-landing','mode-viewer');
  document.body.classList.add(showLanding?'mode-landing':'mode-viewer');
  const a=$('landing-id'),b=$('landing-panel'),c=$('viewer'),d=$('about');
  if(a){a.classList[showLanding?'remove':'add']('hidden');a.style.display=showLanding?'':'none'}
  if(b){b.classList[showLanding?'remove':'add']('hidden');b.style.display=showLanding?'':'none'}
  if(d){d.classList[showLanding?'remove':'add']('hidden');d.style.display=showLanding?'':'none'}
  if(c){c.classList[showLanding?'add':'remove']('hidden');c.style.display=showLanding?'none':''}
}
function route(){
  const raw=location.hash||'#/',parts=raw.split('/');
  const path=parts[1]||'',a=parts[2],b=parts[3];
  if(path===''){setView(true);return}
  setView(false);
  if(path==='pwn'||path==='htb'){renderList(path)}
  else if(path==='post'&&(a==='pwn'||a==='htb')&&b){renderPost(a,decodeURIComponent(b))}
  else{
    $('viewerTitle')&&($('viewerTitle').textContent='Writeups');
    $('viewerTag')&&($('viewerTag').textContent='');
    $('crumbs')&&($('crumbs').innerHTML='<a href="#/">Inicio</a>');
    $('stats')&&($('stats').innerHTML='');
    $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">Ruta no encontrada.</p>');
  }
}
async function renderList(cat){
  $('viewerTitle')&&($('viewerTitle').textContent=cat.toUpperCase()+' — Writeups');
  $('viewerTag')&&($('viewerTag').textContent='');
  $('viewerStatus')&&($('viewerStatus').classList.add('hidden'));
  $('crumbs')&&($('crumbs').innerHTML=`<a href="#/">Inicio</a> / ${cat.toUpperCase()}`);
  $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">Cargando…</p>');
  $('stats')&&($('stats').innerHTML='');
  try{
    const res=await fetch(`${PATHS[cat]}/index.json`,{cache:'no-store'});
    if(!res.ok)throw new Error('x');
    let posts=await res.json();
    if(!Array.isArray(posts))posts=[];
    const now=Date.now();
    // Contar tags usados
    let tagCount = {};
    let totalMin=0,haveMin=0;
    posts.forEach(p=>{
      (p.tags||[]).forEach(t=>{tagCount[t]=(tagCount[t]||0)+1});
      let m=Number(p.read_minutes);
      if(!m&&p.words)m=Math.ceil(Number(p.words)/200);
      if(m){ totalMin+=m; haveMin++; p._minutes=m }
      p._isNew=false;
      if(p.date){
        const dt=Date.parse(p.date);
        if(!isNaN(dt)&&(now-dt)<86400000)p._isNew=true
      }
    });
    const avg=haveMin?Math.round(totalMin/haveMin):null;
    // Extraer tags de origen y tipo
    const ORIGENES = ["picoCTF", "HackTheBox", "SnakeCTF", "imaginaryCTF", "WWCTF", "ropemporium", "pwnable", "NavajaNegra"];
    let origenTags = new Set();
    let tipoTags = new Set();
    posts.forEach(p => {
      (p.tags||[]).forEach(t => {
        if (ORIGENES.map(x=>x.toLowerCase()).includes(t.toLowerCase())) origenTags.add(t);
        else tipoTags.add(t);
      });
    });
    // Crear desplegables
    let origenOptions = `<option value="all">Plataforma: Todos</option>` + Array.from(origenTags)
      .sort((a,b)=>(tagCount[b]||0)-(tagCount[a]||0))
      .map(t=>`<option value="${t}">${t} (${tagCount[t]||0})</option>`).join('');
    let tipoOptions = `<option value="all">Tags: Todos</option>` + Array.from(tipoTags)
      .sort((a,b)=>(tagCount[b]||0)-(tagCount[a]||0))
      .map(t=>`<option value="${t}">${t} (${tagCount[t]||0})</option>`).join('');
    $('stats').innerHTML = `<select id="origenSelect" style="margin-right:10px;">${origenOptions}</select><select id="tipoSelect">${tipoOptions}</select>`;
    posts.sort((a,b)=>(Date.parse(b.date||0)||0)-(Date.parse(a.date||0)||0));
    // Filtrado
    let activeOrigen = 'all';
    let activeTipo = 'all';
    function renderFiltered(){
      let filtered = posts.filter(p => {
        let tags = p.tags||[];
        let origenOk = activeOrigen==='all' || tags.map(x=>x.toLowerCase()).includes(activeOrigen.toLowerCase());
        let tipoOk = activeTipo==='all' || tags.map(x=>x.toLowerCase()).includes(activeTipo.toLowerCase());
        return origenOk && tipoOk;
      });
      const list=filtered.map(p=>{
        const s=(p.slug||'').replace(/\.md$/i,'');
        const title = s;
  const mins=p._minutes?`<span class=\"muted\">${p._minutes} min</span>`:'';
  const dt=p.date?`<span class=\"muted\"> · ${p.date}</span>`:'';
        const badge=p._isNew?`<span class=\"new\">NEW</span>`:'';
        const tags=(p.tags||[]).filter(t=>!ORIGENES.map(x=>x.toLowerCase()).includes(t.toLowerCase())).map(t=>`<span class=\"pill\">${t}</span>`).join(' ');
        // Imagen de plataforma
        let platform = (p.tags||[]).find(t=>ORIGENES.map(x=>x.toLowerCase()).includes(t.toLowerCase()));
        let img = '';
        if(platform){
          let imgName = platform.replace(/ctf$/i,'CTF').replace(/emporium$/i,'Emporium');
          imgName = imgName.replace(/[^a-zA-Z0-9]/g,'');
          if(imgName==='HackTheBox') imgName='HTB';
          if(imgName==='SnakeCTF') imgName='snakeCTF';
          if(imgName==='WWCTF') imgName='WWCTF';
          if(imgName==='imaginaryCTF') imgName='imaginaryCTF';
          if(imgName==='picoCTF') imgName='picoCTF';
          if(imgName==='pwnable') imgName='pwnable';
          if(imgName==='NavajaNegra') imgName='nn';
          if(imgName==='ropemporium'||imgName==='ropEmporium') imgName='ropEmporium';
          img = `/img/${imgName}.png`;
        }
        const bg = img ? `style=\"--platform-img:url('${img}');\"` : '';
        return `<a class=\"tile\" href=\"#/post/${cat}/${encodeURIComponent(s)}\" ${bg}>
          <h3 style=\"margin:0;display:flex;align-items:center;gap:8px;\">${title} ${badge}</h3>
          <div style=\"margin:6px 0 0 0;display:flex;flex-wrap:wrap;gap:6px;\">${tags}</div>
          <div style=\"margin-top:4px;font-size:.92rem;color:#a7a7b4;\">${mins}${dt}</div>
        </a>`;
      }).join('');
      $('viewerContent')&&($('viewerContent').innerHTML=`<div class=\"grid\">${list}</div>`);
    }
    renderFiltered();
    // Filtrado por cambio en desplegables
    document.getElementById('origenSelect').onchange = function(){
      activeOrigen = this.value;
      renderFiltered();
    };
    document.getElementById('tipoSelect').onchange = function(){
      activeTipo = this.value;
      renderFiltered();
    };
  }catch(e){
    $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">No se pudo cargar el índice.</p>');
  }
}
async function renderPost(cat,slug){
  $('viewerTitle')&&($('viewerTitle').textContent=slug);
  // Ocultar status y subtítulo
  $('viewerTag')&&($('viewerTag').textContent='');
  $('viewerStatus')&&($('viewerStatus').classList.add('hidden'));
  $('crumbs')&&($('crumbs').innerHTML=`<a href="#/">Inicio</a> / <a href="#/${cat}">${cat.toUpperCase()}</a> / ${slug}`);
  $('stats')&&($('stats').innerHTML='');
  $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">Cargando…</p>');
  try{
    if(typeof window.markdownit!=='function'){
      await new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js';s.async=true;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});
    }
    if(typeof window.hljs==='undefined'){
      await new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/common.min.js';s.async=true;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});
    }
    const res=await fetch(`${PATHS[cat]}/${slug}.md`,{cache:'no-store'});
    if(!res.ok)throw new Error('x');
    let text=await res.text();
    // Eliminar frontmatter y espacios extra al inicio
    text = text.replace(/^---[\s\S]*?---\s*/i, '');
    text = text.replace(/^\s+/, '');
    // Si el primer caracter es salto de línea, quitarlo
    if (text[0] === '\n') text = text.slice(1);
    const md=window.markdownit({html:true,linkify:true,highlight:function(str,lang){
      if(lang&&window.hljs&&hljs.getLanguage(lang)){
        try{return '<pre><code class="hljs">'+hljs.highlight(str,{language:lang,ignoreIllegals:true}).value+'</code></pre>'}catch(_){}
      }
      return '<pre><code class="hljs">'+str.replace(/[&<>]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))+'</code></pre>'
    }});
    $('viewerContent')&&($('viewerContent').innerHTML='<div class="markdown-body">'+md.render(text)+'</div>');
    window.hljs&&hljs.highlightAll()
  }catch(e){
    $('viewerContent')&&($('viewerContent').innerHTML=`<p class=\"muted\">No se pudo cargar <code>${slug}.md</code>.</p>`);
  }
}
function metasSliderInit(){
  const vp=document.getElementById('metasViewport');
  const track=document.getElementById('metasTrack');
  if(!vp||!track) return;
  function gapPx(){
    const g=getComputedStyle(track).gap;
    const v=parseInt(g,10);
    return Number.isFinite(v)?v:12;
  }
  function cardEl(){ return track.querySelector('.goal'); }
  function cardH(){
    const c=cardEl();
    return c? c.getBoundingClientRect().height : 64;
  }
  function step(){ return cardH()+gapPx(); }
  function setViewportHeight(){
    const n=Math.max(1, Number(METAS_VISIBLE||3));
    const h=n*cardH()+gapPx()*(n-1);
    vp.style.maxHeight=h+'px';
    vp.style.minHeight=h+'px';
  }
  // Recalcula siempre que la ventana cambie de tamaño o se recargue
  function updateHeightOnReady() {
    setViewportHeight();
    // Si el DOM cambia (por ejemplo tras recarg), recalcula
    setTimeout(setViewportHeight, 100);
  }
  updateHeightOnReady();
  window.addEventListener('resize', updateHeightOnReady);
  vp.addEventListener('wheel',(e)=>{
    e.preventDefault();
    const dir = e.deltaY>0 ? 1 : -1;
    vp.scrollBy({top: dir*step(), behavior:'smooth'});
  }, {passive:false});
  vp.addEventListener('keydown',(e)=>{
    if(e.key==='ArrowDown' || e.key==='PageDown'){ e.preventDefault(); vp.scrollBy({top: step(),behavior:'smooth'}); }
    if(e.key==='ArrowUp'   || e.key==='PageUp'){   e.preventDefault(); vp.scrollBy({top:-step(),behavior:'smooth'}); }
  });
  vp.tabIndex = 0; // para que reciba teclado
}
function init(){
  window.addEventListener('hashchange',route);
  route();
  metasSliderInit();
  // Actualizar contador de writeups en la página principal
  function updateCounts() {
    fetch('pwn/index.json').then(r=>r.json()).then(arr=>{
      document.getElementById('pwnCount').textContent = Array.isArray(arr) ? arr.length : 0;
    });
    fetch('htb/index.json').then(r=>r.json()).then(arr=>{
      document.getElementById('htbCount').textContent = Array.isArray(arr) ? arr.length : 0;
    });
  }
  if (document.getElementById('pwnCount') && document.getElementById('htbCount')) updateCounts();
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
const IO=(function(){if(!('IntersectionObserver'in window))return null;return new IntersectionObserver((ent)=>{ent.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');IO&&IO.unobserve(e.target);}})},{root:null,threshold:0.12})})();
Array.from(document.querySelectorAll('.reveal')).forEach(el=>{if(IO)IO.observe(el);else el.classList.add('in')});
const SNIPPETS={
  c:`#include <stdio.h>
int main(){
  puts("pwned");
  return 0;
}`,
  cpp:`#include <iostream>
int main(){
  std::cout << "pwned" << std::endl;
  return 0;
}`,
  py:`#!/usr/bin/env python3
def main():
    print("pwned")
if __name__ == "__main__":
    main()`,
  sh:`#!/usr/bin/env bash
main(){
  echo "pwned"
}
main`
};
const LANGMAP={c:'c',cpp:'cpp',py:'python',sh:'bash'};
function bootTilesImmediate(){
  // Solo inserta los snippets en los tiles, nunca fuera
  const tiles=Array.from(document.querySelectorAll('.code-tile'));
  tiles.forEach(t=>{
    const lang=t.getAttribute('data-lang');
    const id=`code-${lang}`;
    const el=t.querySelector('code');
    if(!el) return;
    el.className='language-'+(LANGMAP[lang]||'');
    el.textContent=SNIPPETS[lang]||'';
    if(window.hljs){ try{ hljs.highlightElement(el); }catch(_){ }}
  });
}
function runTests(){
  try{
    const langs=['c','cpp','py','sh'];
    langs.forEach(k=>{
      const s=SNIPPETS[k];
      console.assert(typeof s === 'string','snippet string',k);
      const lines=s.replace(/\n+$/,'').split('\n');
      console.assert(lines.length===5,'snippet 5 lines',k,lines.length);
    });
    console.assert(document.querySelectorAll('.code-tile').length===4,'4 tiles exist');
  }catch(e){ console.warn('tests failed', e); }
}
bootTilesImmediate();
runTests();
