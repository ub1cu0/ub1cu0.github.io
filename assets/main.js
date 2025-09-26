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
    $('viewerTag')&&($('viewerTag').textContent='Estadísticas y listado');
    $('crumbs')&&($('crumbs').innerHTML='<a href="#/">Inicio</a>');
    $('stats')&&($('stats').innerHTML='');
    $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">Ruta no encontrada.</p>');
  }
}
async function renderList(cat){
  $('viewerTitle')&&($('viewerTitle').textContent=cat.toUpperCase()+' — Writeups');
  $('viewerTag')&&($('viewerTag').textContent='Conteo por dificultad, lectura media y listado');
  $('crumbs')&&($('crumbs').innerHTML=`<a href="#/">Inicio</a> / ${cat.toUpperCase()}`);
  $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">Cargando…</p>');
  $('stats')&&($('stats').innerHTML='');
  try{
    const res=await fetch(`${PATHS[cat]}/index.json`,{cache:'no-store'});
    if(!res.ok)throw new Error('x');
    let posts=await res.json();
    if(!Array.isArray(posts))posts=[];
    const now=Date.now();
    const diffs={easy:0,medium:0,hard:0,insane:0};
    let totalMin=0,haveMin=0;
    posts.forEach(p=>{
      const t=Array.isArray(p.tags)?p.tags:[];
      const d=t.find(z=>/^diff:/.test(z));
      const v=d?d.split(':')[1]:null;
      if(v&&diffs.hasOwnProperty(v))diffs[v]++;
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
    const chips=[];
    chips.push(`<span class="chip">Total: ${posts.length}</span>`);
    Object.entries(diffs).forEach(([k,v])=>chips.push(`<span class="chip">${k}: ${v}</span>`));
    chips.push(`<span class="chip">Lectura media: ${avg?avg+' min':'—'}</span>`);
    $('stats')&&($('stats').innerHTML=chips.join(''));
    posts.sort((a,b)=>(Date.parse(b.date||0)||0)-(Date.parse(a.date||0)||0));
    const list=posts.map(p=>{
      const s=(p.slug||'').replace(/\.md$/i,'');
      const mins=p._minutes?`<span class="muted"> · ${p._minutes} min</span>`:'';
      const dt=p.date?`<span class="muted"> · ${p.date}</span>`:'';
      const badge=p._isNew?`<span class="new">NEW</span>`:'';
      return `<li class="post-item"><div class="post-left">${badge}<a href=\"#/post/${cat}/${encodeURIComponent(s)}\">${p.title}</a>${mins}${dt}</div><div class=\"muted\">${(p.tags||[]).filter(x=>!x.startsWith('diff:')).slice(0,3).join(' · ')}</div></li>`;
    }).join('');
    $('viewerContent')&&($('viewerContent').innerHTML=`<ul class="post-list">${list}</ul>`);
  }catch(e){
    $('viewerContent')&&($('viewerContent').innerHTML='<p class="muted">No se pudo cargar el índice.</p>');
  }
}
async function renderPost(cat,slug){
  $('viewerTitle')&&($('viewerTitle').textContent=(cat.toUpperCase())+' — '+slug);
  $('viewerTag')&&($('viewerTag').textContent='Writeup');
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
    const text=await res.text();
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
    // Si el DOM cambia (por ejemplo tras recargar), recalcula
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
