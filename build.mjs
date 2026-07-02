#!/usr/bin/env node
/**
 * Generador estático de ub1cu0.github.io
 * -------------------------------------------------
 * Convierte los .md + index.json de cada sección en páginas HTML reales
 * (URLs limpias, sin almohadilla) para que Google y las IAs las indexen.
 *
 * - Renderiza el markdown en build (markdown-it + highlight.js), así el
 *   cliente NO necesita descargar esas librerías.
 * - Reutiliza el mismo CSS y la misma estructura de DOM, por lo que el
 *   aspecto es idéntico al SPA original.
 * - Salida en dist/ (lo que se despliega en GitHub Pages).
 *
 *   node build.mjs        (o: npm run build)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const ROOT = import.meta.dirname;
const DIST = join(ROOT, 'dist');

/* ------------------------------------------------------------------ *
 *  Configuración del sitio
 * ------------------------------------------------------------------ */
const SITE_URL = 'https://ub1cu0.github.io';
const AUTHOR = 'ub1cu0';
const DEFAULT_IMG = `${SITE_URL}/assets/img/miniatura.png`;
const GSC_VERIFY = 'TcazwE_vjVsfW2MRMH8DUh7GhoNp-aqNCNdUdudgAgQ'; // Google Search Console

// Secciones y su copy para el <title>/description de cada listado.
const SECTIONS = {
    pwn:       { title: 'PWN',       label: 'Writeups', desc: 'Writeups de explotación de binarios (PWN) paso a paso, en español.' },
    htb:       { title: 'HTB',       label: 'Machines', desc: 'Resolución de máquinas de HackTheBox, en español.' },
    cve:       { title: 'CVEs',      label: 'Research', desc: 'Vulnerabilidades (CVE) y research de seguridad.' },
    poc:       { title: 'POCs',      label: 'Code',     desc: 'Proof-of-Concepts y análisis de vulnerabilidades en C/C++.' },
    proyectos: { title: 'Proyectos', label: 'Personal', desc: 'Proyectos personales y herramientas de seguridad.' },
};

// Tags que cuentan como "plataforma" (para el primer desplegable del filtro).
const ORIGIN_TAGS = ['picoCTF', 'HackTheBox', 'SnakeCTF', 'imaginaryCTF', 'WWCTF', 'ropemporium', 'pwnable', 'NavajaNegra', 'CVE', 'Xpdf', 'sumatrapdfreader'];
const ORIGINS_LOWER = ORIGIN_TAGS.map(t => t.toLowerCase());

// Mapa tag -> imagen de plataforma (marca de agua en el tile).
const FILE_MAP = {
    hackthebox: 'HTB.png', htb: 'HTB.png', picoctf: 'picoCTF.png', navajanegra: 'nn.png',
    snakectf: 'snakeCTF.png', ropemporium: 'RopEmporium.png', pwnable: 'pwnable.png',
    imaginaryctf: 'imaginaryCTF.png', wwctf: 'WWCTF.png', xpdf: 'Xpdf.png',
    sumatrapdfreader: 'sumatrapdfreader.png',
};

/* ------------------------------------------------------------------ *
 *  Utilidades
 * ------------------------------------------------------------------ */

// Convierte un título en un slug de URL. DEBE coincidir con el slugify
// del shim de redirección (assets/js/app.js) para que los enlaces #/... antiguos
// aterricen en la URL nueva.
export function slugify(s) {
    return String(s)
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // fuera acentos
        .toLowerCase()
        .replace(/['"`´’]/g, '')                          // fuera comillas/apóstrofes
        .replace(/[^a-z0-9]+/g, '-')                      // resto -> guiones
        .replace(/^-+|-+$/g, '');                         // recorta guiones
}

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const stripFrontmatter = (md) => md.replace(/^﻿?---[\s\S]*?---\s*/i, '');

// Configuración de markdown-it idéntica a la que usaba el SPA en cliente.
const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre><code class="hljs">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
            } catch (_) { /* fallthrough */ }
        }
        return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    },
});

const renderMarkdown = (raw) => md.render(stripFrontmatter(raw));

// Saca una descripción de ~155 chars a partir del markdown, para el <meta description>.
function excerpt(raw, max = 155) {
    let t = stripFrontmatter(raw)
        .replace(/```[\s\S]*?```/g, ' ')      // bloques de código
        .replace(/`[^`]*`/g, ' ')             // código inline
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')// imágenes
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // enlaces -> texto
        .replace(/<[^>]+>/g, ' ')             // html
        .replace(/^[#>\-*+]+\s*/gm, ' ')      // marcadores markdown
        .replace(/[*_~#>`]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')      // sin espacio antes de puntuación
        .trim();
    if (t.length <= max) return t;
    t = t.slice(0, max);
    return t.slice(0, t.lastIndexOf(' ') > 40 ? t.lastIndexOf(' ') : max).trim() + '…';
}

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Normaliza una entrada de index.json.
function normalize(entry) {
    let tags = entry.tags;
    if (typeof tags === 'string') tags = tags.split(',').map(s => s.trim());
    if (!Array.isArray(tags)) tags = [];
    return { ...entry, tags, urlSlug: slugify(entry.slug) };
}

const readMin = (words) => (words ? `${Math.ceil(words / 200)} min` : '');
const isNew = (date) => date && (Date.now() - Date.parse(date) < 86400000);

/* ------------------------------------------------------------------ *
 *  Plantillas
 * ------------------------------------------------------------------ */

// <head> común con todo el SEO por página.
function head({ title, description, canonical, ogType = 'article', tags = [], jsonld = [] }) {
    const desc = esc(description || SECTIONS.pwn.desc);
    const ld = jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n  ');
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${desc}" />
  <meta name="author" content="${AUTHOR}" />
  <meta name="robots" content="index, follow" />
  ${tags.length ? `<meta name="keywords" content="${esc(tags.join(', '))}" />` : ''}
  <link rel="canonical" href="${canonical}" />
  <meta name="google-site-verification" content="${GSC_VERIFY}" />

  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${DEFAULT_IMG}" />
  <meta property="og:site_name" content="ub1cu0" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${DEFAULT_IMG}" />

  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E💀%3C/text%3E%3C/svg%3E">
  ${ld}
</head>`;
}

const shell = (headHtml, bodyHtml, { landing = false } = {}) => `${headHtml}
<body class="${landing ? 'mode-landing' : 'mode-viewer'}">
  <div class="rain" aria-hidden="true" id="rain"></div>
  <main class="wrap">
${bodyHtml}
  </main>
  <footer><span>©</span><span id="year"></span><span>ub1cu0</span></footer>
  <script src="/assets/js/app.js" defer></script>
</body>
</html>`;

// Un tile de la rejilla (mismo markup que generaba el router en cliente).
function tile(cat, e) {
    const platformTag = e.tags.find(t => ORIGINS_LOWER.includes(t.toLowerCase()));
    const file = platformTag ? FILE_MAP[platformTag.toLowerCase()] : null;
    const imgStyle = file ? ` style="--platform-img:url('/assets/img/${file}');"` : '';
    const visibleTags = e.tags.filter(t => !ORIGINS_LOWER.includes(t.toLowerCase()))
        .map(t => `<span class="pill">${esc(t)}</span>`).join(' ');
    const href = e.url ? e.url : `/${cat}/${e.urlSlug}/`;
    const target = e.target ? ` target="${esc(e.target)}"` : '';
    const dataTags = e.tags.map(t => t.toLowerCase()).join(',');
    const min = readMin(e.words);
    return `        <a class="tile" href="${href}"${target}${imgStyle} data-tags="${esc(dataTags)}">
          <h3 style="margin:0;display:flex;align-items:center;gap:8px;">${esc(e.title || e.slug)} ${isNew(e.date) ? '<span class="new">NEW</span>' : ''}</h3>
          <div class="tile-tags">${visibleTags}</div>
          <div class="tile-meta">${min ? `<span class="muted">${min}</span>` : ''}${e.date ? ` <span class="muted"> · ${esc(e.date)}</span>` : ''}</div>
        </a>`;
}

// Desplegables del filtro (plataforma / tags), replicando la lógica original.
function filterSelects(entries) {
    const counts = {}, origin = new Set(), type = new Set();
    entries.forEach(e => e.tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
        (ORIGINS_LOWER.includes(t.toLowerCase()) ? origin : type).add(t);
    }));
    const opts = (set, label) => `<option value="all">${label}: Todos</option>` +
        Array.from(set).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
            .map(t => `<option value="${esc(t)}">${esc(t)} (${counts[t] || 0})</option>`).join('');
    return `<select id="origenSelect" style="margin-right:10px;">${opts(origin, 'Plataforma')}</select>` +
        `<select id="tipoSelect">${opts(type, 'Tags')}</select>`;
}

// Página de listado de una sección.
function listPage(cat, entries) {
    const c = SECTIONS[cat];
    const canonical = `${SITE_URL}/${cat}/`;
    const title = `${c.title} — ${c.label} · ub1cu0`;
    const body = `    <section class="id" aria-label="Cabecera categoría">
      <div><div class="name">${c.title} — ${c.label}</div></div>
      <span class="status">Status: reading...</span>
    </section>
    <section class="panel" aria-label="Lista">
      <div class="breadcrumbs"><a href="/">Inicio</a> / ${c.title}</div>
      <div class="stats">${filterSelects(entries)}</div>
      <div id="viewerContent" style="margin-top:12px">
        <div class="grid">
${entries.map(e => tile(cat, e)).join('\n')}
        </div>
      </div>
    </section>`;
    const jsonld = [{
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: `${c.title} — ${c.label}`, description: c.desc, url: canonical, inLanguage: 'es',
        isPartOf: { '@type': 'WebSite', name: 'ub1cu0', url: `${SITE_URL}/` },
    }];
    return shell(head({ title, description: c.desc, canonical, ogType: 'website', jsonld }), body);
}

// Página de un post concreto (markdown renderizado).
function postPage(cat, e, raw) {
    const c = SECTIONS[cat];
    const canonical = `${SITE_URL}/${cat}/${e.urlSlug}/`;
    const title = `${e.title || e.slug} · ub1cu0`;
    const description = e.description || excerpt(raw);
    const min = readMin(e.words);
    const metaLine = [min, e.date].filter(Boolean).map(x => `<span class="muted">${esc(x)}</span>`).join(' · ');
    const visibleTags = e.tags.filter(t => !ORIGINS_LOWER.includes(t.toLowerCase()))
        .map(t => `<span class="pill">${esc(t)}</span>`).join(' ');
    const body = `    <section class="id" aria-label="Cabecera post">
      <div><div class="name">${esc(e.title || e.slug)}</div></div>
      <span class="status">Status: reading...</span>
    </section>
    <section class="panel" aria-label="Contenido">
      <div class="breadcrumbs"><a href="/">Inicio</a> / <a href="/${cat}/">${c.title}</a> / ${esc(e.title || e.slug)}</div>
      <div class="stats">${metaLine}${visibleTags ? ` · ${visibleTags}` : ''}</div>
      <article id="viewerContent" style="margin-top:12px">
        <div class="markdown-body">${renderMarkdown(raw)}</div>
      </article>
    </section>`;
    const jsonld = [
        {
            '@context': 'https://schema.org', '@type': 'BlogPosting',
            headline: e.title || e.slug, description,
            datePublished: e.date, dateModified: e.date,
            author: { '@type': 'Person', name: AUTHOR, url: `${SITE_URL}/` },
            publisher: { '@type': 'Person', name: AUTHOR },
            mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
            url: canonical, inLanguage: 'es',
            keywords: e.tags.join(', '),
        },
        {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
                { '@type': 'ListItem', position: 2, name: c.title, item: canonical.replace(`${e.urlSlug}/`, '') },
                { '@type': 'ListItem', position: 3, name: e.title || e.slug, item: canonical },
            ],
        },
    ];
    return shell(head({ title, description, canonical, ogType: 'article', tags: e.tags, jsonld }), body);
}

/* ------------------------------------------------------------------ *
 *  Sitemap / robots / 404
 * ------------------------------------------------------------------ */
function sitemap(urls) {
    const body = urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

function notFound() {
    const body = `    <section class="id"><div><div class="name">404</div></div><span class="status">Status: lost</span></section>
    <section class="panel"><p class="muted">Esta página no existe. Vuelve al <a href="/">inicio</a>.</p></section>`;
    // shim por si llega un enlace #/... antiguo a una ruta inexistente
    const shim = `<script>(function(){var h=location.hash;if(!h)return;var p=h.replace(/^#\\/?/,'').split('/').filter(Boolean);function sl(s){return decodeURIComponent(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/['"\`´’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}var u=null;if(p[0]==='post'&&p[1]&&p[2]){u='/'+p[1].toLowerCase()+'/'+sl(p.slice(2).join('/'))+'/';}else if(p[0]){u='/'+p[0].toLowerCase()+'/';}if(u)location.replace(u);})();</script>`;
    const h = head({ title: '404 · ub1cu0', description: 'Página no encontrada.', canonical: `${SITE_URL}/404.html`, ogType: 'website' })
        .replace('</head>', `  ${shim}\n</head>`);
    return shell(h, body);
}

/* ------------------------------------------------------------------ *
 *  Build
 * ------------------------------------------------------------------ */
function build() {
    rmSync(DIST, { recursive: true, force: true });
    mkdirSync(DIST, { recursive: true });

    // Estáticos: assets + .nojekyll
    cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
    if (existsSync(join(ROOT, '.nojekyll'))) cpSync(join(ROOT, '.nojekyll'), join(DIST, '.nojekyll'));

    const urls = [{ loc: `${SITE_URL}/`, lastmod: new Date().toISOString().slice(0, 10) }];
    let nPosts = 0;

    for (const cat of Object.keys(SECTIONS)) {
        const idxPath = join(ROOT, cat, 'index.json');
        if (!existsSync(idxPath)) continue;
        const entries = readJSON(idxPath).map(normalize);

        // Listado (+ el index.json, que la home usa para los contadores)
        mkdirSync(join(DIST, cat), { recursive: true });
        writeFileSync(join(DIST, cat, 'index.html'), listPage(cat, entries));
        cpSync(idxPath, join(DIST, cat, 'index.json'));
        const latest = entries.map(e => e.date).filter(Boolean).sort().pop();
        urls.push({ loc: `${SITE_URL}/${cat}/`, lastmod: latest });

        // Posts (solo entradas internas, sin url externa)
        for (const e of entries) {
            if (e.url) continue;
            const mdPath = join(ROOT, cat, `${e.slug}.md`);
            if (!existsSync(mdPath)) { console.warn(`  ! falta ${cat}/${e.slug}.md`); continue; }
            const raw = readFileSync(mdPath, 'utf8');
            mkdirSync(join(DIST, cat, e.urlSlug), { recursive: true });
            writeFileSync(join(DIST, cat, e.urlSlug, 'index.html'), postPage(cat, e, raw));
            urls.push({ loc: `${SITE_URL}/${cat}/${e.urlSlug}/`, lastmod: e.date });
            nPosts++;
        }
    }

    // Landing (index.html ya es la versión final) + sitemap + robots + 404
    cpSync(join(ROOT, 'index.html'), join(DIST, 'index.html'));
    writeFileSync(join(DIST, 'sitemap.xml'), sitemap(urls));
    writeFileSync(join(DIST, 'robots.txt'), robots());
    writeFileSync(join(DIST, '404.html'), notFound());

    console.log(`✓ build OK -> dist/  (${nPosts} posts, ${urls.length} URLs en sitemap)`);
}

build();
