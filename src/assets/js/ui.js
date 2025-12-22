import { $, CONFIG } from './utils.js';

export function initRain() {
    const r = $('rain');
    if(!r) return;
    const c = Math.floor(window.innerWidth/60);
    const w = Math.floor(window.innerHeight/24);
    const h = '0123456789abcdef'.split('');
    let x = '';
    for(let i=0; i<c; i++){
        for(let j=0; j<w; j++){
            const ch = h[(i*7+j*13)%h.length];
            x += `<i style="left:${i*60+10}px; top:${j*24+6}px;">${ch}</i>`;
        }
    }
    r.innerHTML = x;
}

export function initMetasSlider() {
    const vp = document.getElementById('metasViewport');
    const track = document.getElementById('metasTrack');
    if(!vp || !track) return;
    
    function gapPx(){
        const g = getComputedStyle(track).gap;
        const v = parseInt(g,10);
        return Number.isFinite(v)?v:12;
    }
    function cardEl(){ return track.querySelector('.goal'); }
    function cardH(){ 
        const c = cardEl(); 
        // Si offsetHeight es 0, es que el elemento no es visible aun
        return c ? c.offsetHeight : 0; 
    }
    
    // Intentar calcular la altura hasta que sea > 0
    function trySetHeight() {
        const hCard = cardH();
        if (hCard > 0) {
            const n = Math.max(1, Number(CONFIG.METAS_VISIBLE||3));
            const hTotal = n * hCard + gapPx() * (n-1);
            vp.style.maxHeight = hTotal+'px';
            vp.style.minHeight = hTotal+'px';
        } else {
            requestAnimationFrame(trySetHeight);
        }
    }
    
    trySetHeight();
    window.addEventListener('resize', trySetHeight);
    
    vp.addEventListener('wheel',(e)=>{
        e.preventDefault();
        const step = cardH() + gapPx();
        if(step > 12) {
            const dir = e.deltaY>0 ? 1 : -1;
            vp.scrollBy({top: dir*step, behavior:'smooth'});
        }
    }, {passive:false});
}

export function bootCodeTiles() {
    const SNIPPETS = {
        c: `#include <stdio.h>\nint main(){\n  puts("pwned");\n  return 0;\n}`,
        cpp: `#include <iostream>\nint main(){\n  std::cout << "pwned" << std::endl;\n  return 0;\n}`,
        py: `#!/usr/bin/env python3\ndef main():\n    print("pwned")\nif __name__ == "__main__":\n    main()`,
        sh: `#!/usr/bin/env bash\nmain(){\n  echo "pwned"\n}\nmain`
    };
    
    const LANG_MAP = { 'c':'c', 'cpp':'cpp', 'py':'python', 'sh':'bash' };

    document.querySelectorAll('.code-tile').forEach(t => {
        const langKey = t.getAttribute('data-lang');
        const el = t.querySelector('code');
        
        if(el && SNIPPETS[langKey]) {
            el.textContent = SNIPPETS[langKey];
            const hljsClass = LANG_MAP[langKey] || langKey;
            el.className = `language-${hljsClass}`; // Clase para highlight.js
            
            // Forzar resaltado si la librería está cargada
            if(window.hljs) {
                hljs.highlightElement(el);
            }
        }
    });
}