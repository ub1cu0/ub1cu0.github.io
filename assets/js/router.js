import { $, CONFIG } from './utils.js';

export async function route() {
    const raw = location.hash || '#/';
    const parts = raw.split('/').filter(p => p && p !== '#');
    const root = parts[0] || ''; 
    
    if (root === '') {
        setView('landing');
        return;
    }

    if (root === 'post') {
        const category = parts[1];
        const slug = parts.slice(2).join('/');
        if (CONFIG.SECTIONS[category] && slug) {
            setView('viewer');
            await renderPost(category, decodeURIComponent(slug));
        } else {
            setView('viewer');
            renderError('Post no encontrado.');
        }
        return;
    }

    if (CONFIG.SECTIONS[root]) {
        setView('viewer');
        await renderList(root);
        return;
    }

    setView('viewer');
    renderError('Ruta no encontrada.');
}

function setView(mode) {
    const isLanding = mode === 'landing';
    document.body.classList.remove('mode-landing', 'mode-viewer');
    document.body.classList.add(isLanding ? 'mode-landing' : 'mode-viewer');
    
    const landingGroup = [$('landing-id'), $('landing-panel'), $('about')];
    const viewerGroup = [$('viewer')];

    landingGroup.forEach(el => el && el.classList.toggle('hidden', !isLanding));
    viewerGroup.forEach(el => el && el.classList.toggle('hidden', isLanding));
}

async function renderList(category) {
    const catConfig = CONFIG.SECTIONS[category];
    if($('viewerTitle')) $('viewerTitle').textContent = `${catConfig.title} — ${catConfig.label}`;
    if($('crumbs')) $('crumbs').innerHTML = `<a href="#/">Inicio</a> / ${catConfig.title}`;
    if($('viewerContent')) $('viewerContent').innerHTML = '<p class="muted">Cargando…</p>';
    if($('stats')) $('stats').innerHTML = '';

    try {
        const res = await fetch(`${category}/index.json`, {cache: 'no-store'});
        if(!res.ok) throw new Error('Index not found');
        let posts = await res.json();
        if(!Array.isArray(posts)) posts = [];
        setupFiltersAndRender(posts, category);
    } catch(e) {
        console.error(e);
        renderError(`No se pudo cargar el índice de ${category}.`);
    }
}

function setupFiltersAndRender(posts, category) {
    const tagCounts = {};
    const originTags = new Set();
    const typeTags = new Set();
    const originsLower = CONFIG.ORIGIN_TAGS.map(t => t.toLowerCase());

    posts.forEach(p => {
        if (typeof p.tags === 'string') p.tags = p.tags.split(',').map(s=>s.trim());
        if (!Array.isArray(p.tags)) p.tags = [];

        p.tags.forEach(t => {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
            if (originsLower.includes(t.toLowerCase())) originTags.add(t);
            else typeTags.add(t);
        });
        p._isNew = p.date && (Date.now() - Date.parse(p.date) < 86400000);
    });

    const createOptions = (set, label) => {
        const sorted = Array.from(set).sort((a,b) => (tagCounts[b]||0) - (tagCounts[a]||0));
        return `<option value="all">${label}: Todos</option>` + 
               sorted.map(t => `<option value="${t}">${t} (${tagCounts[t]||0})</option>`).join('');
    };

    $('stats').innerHTML = `
        <select id="origenSelect" style="margin-right:10px;">${createOptions(originTags, 'Plataforma')}</select>
        <select id="tipoSelect">${createOptions(typeTags, 'Tags')}</select>
    `;

    let activeOrigin = 'all';
    let activeType = 'all';

    const draw = () => {
        const filtered = posts.filter(p => {
            const tags = p.tags.map(t => t.toLowerCase());
            const oOk = activeOrigin === 'all' || tags.includes(activeOrigin.toLowerCase());
            const tOk = activeType === 'all' || tags.includes(activeType.toLowerCase());
            return oOk && tOk;
        });

        const html = filtered.map(p => {
            const platformTag = p.tags.find(t => originsLower.includes(t.toLowerCase()));
            let imgStyle = '';
            
            if(platformTag) {
                // --- AQUÍ ESTÁ EL CAMBIO DE LIMPIEZA ---
                // Mapeamos el tag (en minúsculas) al nombre EXACTO del archivo en tu carpeta img
                const FILE_MAP = {
                    'hackthebox': 'HTB.png',
                    'htb': 'HTB.png',
                    'picoctf': 'picoCTF.png',
                    'navajanegra': 'nn.png',
                    'snakectf': 'snakeCTF.png',
                    'ropemporium': 'RopEmporium.png',
                    'pwnable': 'pwnable.png',
                    'imaginaryctf': 'imaginaryCTF.png',
                    'wwctf': 'WWCTF.png',
                    'xpdf': 'Xpdf.png',
                    'sumatrapdfreader': 'sumatrapdfreader.png'
                };

                const filename = FILE_MAP[platformTag.toLowerCase()];
                
                if (filename) {
                    // Usamos ruta absoluta (con / al principio) para asegurar que la encuentra
                    imgStyle = `style="--platform-img:url('/assets/img/${filename}');"`;
                }
            }

            const visibleTags = p.tags.filter(t => !originsLower.includes(t.toLowerCase()))
                .map(t => `<span class="pill">${t}</span>`).join(' ');

            return `
                <a class="tile" href="#/post/${category}/${encodeURIComponent(p.slug)}" ${imgStyle}>
                    <h3 style="margin:0;display:flex;align-items:center;gap:8px;">
                        ${p.title || p.slug} 
                        ${p._isNew ? '<span class="new">NEW</span>' : ''}
                    </h3>
                    
                    <div class="tile-tags">${visibleTags}</div>
                    
                    <div class="tile-meta">
                        ${p.words ? `<span class="muted">${Math.ceil(p.words/200)} min</span>` : ''} 
                        ${p.date ? `<span class="muted"> · ${p.date}</span>` : ''}
                    </div>
                </a>`;
        }).join('');
        
        $('viewerContent').innerHTML = `<div class="grid">${html}</div>`;
    };

    draw();

    $('origenSelect').onchange = (e) => { activeOrigin = e.target.value; draw(); };
    $('tipoSelect').onchange = (e) => { activeType = e.target.value; draw(); };
}

async function renderPost(category, slug) {
    const catConfig = CONFIG.SECTIONS[category];
    if($('viewerTitle')) $('viewerTitle').textContent = slug;
    if($('crumbs')) $('crumbs').innerHTML = `<a href="#/">Inicio</a> / <a href="#/${category}">${catConfig.title}</a> / ${slug}`;
    if($('stats')) $('stats').innerHTML = '';
    if($('viewerContent')) $('viewerContent').innerHTML = '<p class="muted">Cargando markdown...</p>';

    if(!window.markdownit) await loadScript('https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js');
    if(!window.hljs) await loadScript('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/common.min.js');

    try {
        const res = await fetch(`${category}/${slug}.md`, {cache: 'no-store'});
        if(!res.ok) throw new Error('Post not found');
        let text = await res.text();
        text = text.replace(/^---[\s\S]*?---\s*/i, ''); 

        const md = window.markdownit({
            html: true,
            linkify: true,
            highlight: (str, lang) => {
                if (lang && window.hljs) {
                    try { return `<pre><code class="hljs">${hljs.highlight(str, {language: lang, ignoreIllegals:true}).value}</code></pre>`; } catch (__) {}
                }
                return `<pre><code class="hljs">${str}</code></pre>`;
            }
        });
        
        $('viewerContent').innerHTML = `<div class="markdown-body">${md.render(text)}</div>`;
    } catch(e) {
        renderError(`No se pudo cargar ${slug}.md`);
    }
}

function renderError(msg) {
    if($('viewerContent')) $('viewerContent').innerHTML = `<p class="muted">${msg}</p>`;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if(document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}