#!/usr/bin/env node
/**
 * Generador de ub1cu0.github.io, version Win95.
 * ---------------------------------------------------------------------------
 * Mismo trato que el generador anterior: el contenido son ficheros .md dentro
 * de la carpeta de su seccion. Para publicar algo nuevo se deja el .md ahi y se
 * corre esto. El index.json sigue valiendo para ordenar y para las entradas que
 * no tienen .md (proyectos que apuntan fuera), pero ya no hace falta tocarlo:
 * si aparece un .md que no esta listado, se coge su frontmatter y entra igual.
 *
 * Lo que ya no hay que mantener a mano:
 *   - el numero de palabras, que sale de contar el propio markdown
 *   - el resaltado de codigo, que va en el CSS del sitio y no en un CDN
 *
 *   node build.mjs [--src <repo>] [--out <dir>]
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const ROOT = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
/* Si este fichero vive dentro del repo de la web, el contenido esta al lado.
   Si vive fuera (mientras es un prototipo), se apunta al repo con --src. */
const SRC = arg('--src', existsSync(join(ROOT, 'pwn', 'index.json')) ? ROOT : '/home/ub1cu0/Escritorio/Proyectos/ub1cu0.github.io');
const DIST = arg('--out', join(ROOT, 'dist'));

const SITE = 'https://ub1cu0.github.io';
const AUTOR = 'ub1cu0';
const IMG_SOCIAL = `${SITE}/assets/img/miniatura.png`;
const GSC = 'TcazwE_vjVsfW2MRMH8DUh7GhoNp-aqNCNdUdudgAgQ';
const VIDEO = 'Maw3A8zUJyM';   // la cancion que suena de fondo, desde YouTube
const HOY = new Date().toISOString().slice(0, 10);

/* GitHub Pages manda cache-control de diez minutos en todo. Asi que al subir un
   cambio hay una ventana en la que el navegador ya tiene el HTML nuevo pero
   sigue con el CSS o el JS viejo del cache, y la pagina se ve rota sin motivo.
   Colgandole al final un trozo del hash del fichero, la direccion cambia
   cuando cambia el contenido y el navegador se lo baja solo. */
const sello = (rel) => {
  try {
    const h = createHash('sha1').update(readFileSync(join(SRC, rel))).digest('hex').slice(0, 8);
    return `/${rel}?v=${h}`;
  } catch (e) {
    console.warn(`  ! no encuentro ${rel} para sellarlo, va sin version`);
    return `/${rel}`;
  }
};
const V_CSS = sello('assets/css/lab95.css');
const V_CSS2 = sello('assets/css/lab95-variantes.css');
const V_JS = sello('assets/js/sitio.js');
const V_TOOL = sello('assets/css/lab95-tool.css');

/* El teletipo que va pasando por la barra de abajo. Se cambia aqui y ya esta.
   Termina en separador porque el texto se repite en bucle y si no, se pegan la
   ultima palabra y la primera. Para un simbolo raro se usa su entidad HTML. */
const TELETIPO = 'BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; BUSCO TRABAJO &middot; ';

/* Los colegas del selector de personaje. Para anadir uno: su nombre, su web y
   un sprite recortado en assets/img/. Salen en este orden, y las flechas van
   pasando de uno a otro. Los sprites miden 128x152 con el fondo transparente,
   asi que uno nuevo hay que dejarlo de ese tamano para que no baile. */
const AMIGOS = [
  { nombre: 'FOUEN', url: 'https://fouen.blogspot.com/', img: '/assets/img/amigo-fouen.png' },
  { nombre: 'YOSHL', url: 'https://yoshlsec.github.io/', img: '/assets/img/amigo-yoshl.png' },
  { nombre: 'D3B0',  url: 'https://d3bo.eu/',            img: '/assets/img/amigo-d3b0.png' },
  { nombre: 'MARC',  url: 'https://m2rc.net/',           img: '/assets/img/amigo-marc.png' },
];

/* Cada seccion con su color, que es el mismo del cuadradito del indice.
   `oculta` deja la seccion fuera del menu, del sitemap y de la portada, pero
   sus paginas se siguen generando para no romper enlaces que ya existan. */
const SECCIONES = {
  pwn:       { titulo: 'Writeups PWN', corto: 'PWN',       color: 'pwn',  desc: 'Writeups de explotación de binarios (PWN) paso a paso, en español.' },
  htb:       { titulo: 'HackTheBox',   corto: 'HTB',       color: 'htb',  desc: 'Resolución de máquinas de HackTheBox, en español.', oculta: true },
  cve:       { titulo: 'CVEs',         corto: 'CVEs',      color: 'cve',  desc: 'Vulnerabilidades (CVE) encontradas y reportadas por mí.' },
  poc:       { titulo: 'POCs',         corto: 'POCs',      color: 'poc',  desc: 'Proof of Concept de vulnerabilidades conocidas, en C/C++.' },
  proyectos: { titulo: 'Proyectos',    corto: 'Proyectos', color: 'tool', desc: 'Proyectos personales y herramientas de seguridad.' },
};

const VISIBLES = Object.keys(SECCIONES).filter(c => !SECCIONES[c].oculta);

/* --------------------------------------------------------------- utilidades */

export function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['"`´’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const sinFrontmatter = (md) => md.replace(/^﻿?---[\s\S]*?---\s*/i, '');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre><code class="hljs">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch { /* cae al escape de abajo */ }
    }
    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

/* Texto plano del markdown, sin codigo. Sirve para la descripcion y para contar
   palabras: el codigo no se lee, asi que no deberia inflar el tiempo de lectura. */
function texto(raw) {
  return sinFrontmatter(raw)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[#>\-*+]+\s*/gm, ' ')
    .replace(/[*_~#>`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const palabras = (raw) => texto(raw).split(' ').filter(Boolean).length;
const minutos = (n) => (n ? `${Math.max(1, Math.ceil(n / 200))} min` : '');

function resumen(raw, max = 155) {
  let t = texto(raw).replace(/\s+([.,;:!?])/g, '$1');
  if (t.length <= max) return t;
  t = t.slice(0, max);
  const corte = t.lastIndexOf(' ');
  return t.slice(0, corte > 40 ? corte : max).trim() + '…';
}

const fechaES = (d) => (d ? d.split('-').reverse().join('/') : '');

/* Lee el frontmatter de un .md sin dependencias: title, date y tags. */
function frontmatter(raw) {
  const m = raw.match(/^﻿?---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const out = {};
  for (const linea of m[1].split('\n')) {
    const kv = linea.match(/^\s*([a-z_]+)\s*:\s*(.*)$/i);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    if (v.startsWith('[')) {
      v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    out[kv[1].toLowerCase()] = v;
  }
  return out;
}

/* ------------------------------------------------------------- el contenido */

/* Junta lo que dice index.json con los .md que haya en la carpeta. Si un .md no
   esta en el json, entra igual con lo que diga su frontmatter. */
function leerSeccion(cat) {
  const dir = join(SRC, cat);
  if (!existsSync(dir)) return [];

  const idx = join(dir, 'index.json');
  const listadas = existsSync(idx) ? JSON.parse(readFileSync(idx, 'utf8')) : [];
  const porSlug = new Map();

  for (const e of listadas) {
    const tags = Array.isArray(e.tags) ? e.tags : String(e.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    porSlug.set(e.slug, { ...e, tags, cat });
  }

  for (const f of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const slug = f.slice(0, -3);
    if (porSlug.has(slug)) continue;
    const fm = frontmatter(readFileSync(join(dir, f), 'utf8'));
    if (!fm.title && !fm.date) continue;          // sin frontmatter no es un post
    porSlug.set(slug, {
      slug, cat,
      title: fm.title || slug,
      date: fm.date || '',
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      suelto: true,
    });
    console.log(`  + ${cat}/${f} entra por su frontmatter, no estaba en index.json`);
  }

  const salida = [];
  const vistos = new Map();
  for (const e of porSlug.values()) {
    const mdPath = join(dir, `${e.slug}.md`);
    const tieneMd = !e.url && existsSync(mdPath);
    if (!tieneMd && !e.url) { console.warn(`  ! ${cat}/${e.slug}.md no existe, la entrada se salta`); continue; }
    const raw = tieneMd ? readFileSync(mdPath, 'utf8') : '';

    /* Dos ficheros distintos pueden dar la misma URL ("A - B.md" y "A B.md").
       Se queda el que esta en index.json y se avisa del otro, que si no uno
       pisaria al otro en silencio y el listado mostraria la entrada dos veces. */
    const urlSlug = slugify(e.slug);
    if (vistos.has(urlSlug)) {
      const antes = vistos.get(urlSlug);
      const fuera = e.suelto ? e : antes;
      const queda = e.suelto ? antes : e;
      console.warn(`  ! ${cat}/${fuera.slug}.md y ${cat}/${queda.slug}.md dan la misma URL (/${cat}/${urlSlug}/). Se publica ${queda.slug}.md`);
      if (!e.suelto) { const i = salida.findIndex(x => x.urlSlug === urlSlug); if (i >= 0) salida.splice(i, 1); }
      else continue;
    }
    vistos.set(urlSlug, e);

    salida.push({
      ...e,
      raw,
      urlSlug,
      words: tieneMd ? palabras(raw) : 0,
      href: e.url || `/${cat}/${slugify(e.slug)}/`,
      externa: Boolean(e.url),
    });
  }
  return salida.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ------------------------------------------------------------------ trozos  */

const NUBES = `<div class="cielo" aria-hidden="true">${
  Array(8).fill('<img src="/assets/img/kumo.gif" alt="">').join('')
}</div>`;

const BOTONES = '<span class="ctrl" aria-hidden="true"><b>_</b><b>&#9633;</b><b>&#10005;</b></span>';

/* El hamster va solo en la portada, pegado a donde acaba la linea del rol. Va
   dentro de ese mismo div a proposito: asi se coloca solo donde termine el
   texto, mida lo que mida con la tipografia de cada uno. */
const HAMSTER = '<img class="gif hamster-esq" src="/assets/img/hamster.gif" alt="" width="230" height="243">';

/* El marco que rodea a todas las paginas: nubes, radiocasete, banda de arriba y
   barra de tareas. Vive aqui suelto porque las dos herramientas, que son ficheros
   estaticos y no pasan por pagina(), se lo pegan tambien. Asi el teletipo, la
   cancion y las nubes se cambian en un sitio y valen para todo. */
const chromeArriba = (esPortada) => `${NUBES}

<button class="musica" id="musica" type="button" aria-pressed="false"
        aria-label="Poner o quitar la música" title="Música" data-video="${VIDEO}">
  <img src="/assets/img/musica.gif" alt="">
  <canvas width="108" height="96" aria-hidden="true"></canvas>
</button>
<div id="reproductor" aria-hidden="true"></div>

<div class="page">

  <header class="banner">
    ${esPortada
      ? '<h1 class="logo">&lt;<b>ub1cu0</b>&gt;</h1>'
      : '<div class="logo"><a href="/">&lt;<b>ub1cu0</b>&gt;</a></div>'}
    <div class="sub">VULNERABILITY RESEARCH &middot; EXPLOIT DEV &middot; LOW LEVEL</div>
    <img class="gif mascota" src="/assets/img/banner.gif" alt="" width="139" height="163">
  </header>
`;

const chromeAbajo = (tarea) => `  <footer class="taskbar">
    <div class="start"><em></em>Inicio</div>
    <div class="tarea">${esc(tarea || 'ub1cu0')}</div>
    <div class="hueco"><span>${TELETIPO}</span></div>
    <div class="visitas">visitas <span id="visitas">001337</span></div>
    <div class="reloj" id="reloj">--:--</div>
  </footer>

</div>

<script src="${V_JS}" defer></script>
`;

const ventana = (titulo, cuerpo, { tag = 'section', clase = '', h = 'h2', pad = '' } = {}) =>
  `      <${tag} class="win ${clase}">
        <${h}>${titulo}${BOTONES}</${h}>
        <div class="body"${pad ? ` style="padding:${pad}"` : ''}>${cuerpo}</div>
      </${tag}>`;

function zonaA(cuentas) {
  const items = VISIBLES.map(c =>
    `          <a href="/${c}/"><i class="${SECCIONES[c].color}"></i>${esc(SECCIONES[c].titulo)} <span class="n">${cuentas[c]}</span></a>`
  ).join('\n');
  return `    <div class="zone zone-a">
${ventana('Índice', `\n${items}\n        `, { tag: 'nav', clase: 'menu', pad: '3px' })}

${ventana('Links', `
          <a href="https://github.com/ub1cu0" rel="me noopener" target="_blank">GitHub</a>
          <a href="https://www.linkedin.com/in/moiseshermo/" rel="me noopener" target="_blank">LinkedIn</a>
        `, { clase: 'menu', pad: '3px' })}

      <img class="gif pegado escritorio" src="/assets/img/escritorio.gif" alt="">
    </div>`;
}

/* Agrupa los tags ignorando mayusculas y acentos, porque "OOB" y "oob" son el
   mismo tag escrito de dos maneras. Se queda con el nombre que mas se repite. */
function mapaTags(entradas) {
  const m = new Map();
  for (const e of entradas) {
    for (const t of e.tags || []) {
      const k = slugify(t);
      if (!k) continue;
      if (!m.has(k)) m.set(k, { slug: k, nombres: new Map(), entradas: [] });
      const g = m.get(k);
      g.nombres.set(t, (g.nombres.get(t) || 0) + 1);
      if (!g.entradas.includes(e)) g.entradas.push(e);
    }
  }
  for (const g of m.values()) {
    g.nombre = [...g.nombres.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    g.entradas.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  return m;
}

const ordenTags = (m) => [...m.values()]
  .sort((a, b) => b.entradas.length - a.entradas.length || a.nombre.localeCompare(b.nombre, 'es'));

/* La nube de tags. Cada uno lleva a su pagina, que es lo que faltaba. */
function nubeTags(entradas, max = 16) {
  const orden = ordenTags(mapaTags(entradas));
  if (!orden.length) return '';
  const top = orden[0].entradas.length;
  const trozos = orden.slice(0, max).map(g => {
    const p = g.entradas.length / top;
    const c = p > 0.7 ? 's4' : p > 0.4 ? 's3' : p > 0.15 ? 's2' : 's1';
    return `<b class="${c}"><a href="/tags/${g.slug}/">${esc(g.nombre)}</a> <i>${g.entradas.length}</i></b>`;
  });
  if (orden.length > max) trozos.push(`<span class="todos"><a href="/tags/">ver los ${orden.length} tags</a></span>`);
  return trozos.join('\n          ');
}

const METAS = `
          <ul class="metas">
            <li><span class="box hecho">[x]</span> eJPTv2 <span class="yr">hecho</span></li>
            <li><span class="box hecho">[x]</span> CEH <span class="yr">hecho</span></li>
            <li><span class="box hecho">[x]</span> ROP Emporium al 100% <span class="yr">hecho</span></li>
            <li><span class="box hecho">[x]</span> primer CVE propio <span class="yr">2026</span></li>
            <li><span class="box">[ ]</span> Linux Kernel exploitation <span class="yr">2026</span></li>
            <li><span class="box">[ ]</span> OSEE <span class="yr">2027</span></li>
          </ul>
        `;

/* El selector de colegas. Cada uno es un enlace de verdad y estan todos en el
   HTML: el JavaScript solo ensena uno y las flechas cambian cual. Sin JS se ve
   el primero y su enlace funciona igual. */
const AMIGOS_WIN = ventana('Amigos', `
          <div class="isaac" id="isaac">
            <button class="fl" type="button" data-paso="-1" aria-label="Anterior"><img class="flecha" src="/assets/img/flecha.gif" alt=""><span class="mini"><img src="${AMIGOS[AMIGOS.length - 1].img}" alt=""></span></button>
            <div class="fichas">
${AMIGOS.map((a, i) => `              <a class="ficha" href="${a.url}" target="_blank" rel="noopener"${i ? ' hidden' : ''}>
                <span class="nom">${esc(a.nombre)}</span>
                <span class="marco"><img src="${a.img}" alt="${esc(a.nombre)}" width="128" height="152"></span>
              </a>`).join('\n')}
            </div>
            <button class="fl" type="button" data-paso="1" aria-label="Siguiente"><img class="flecha" src="/assets/img/flecha.gif" alt=""><span class="mini"><img src="${AMIGOS[1 % AMIGOS.length].img}" alt=""></span></button>
          </div>
        `, { clase: 'amigos', pad: '7px 4px 9px' });

/* Pagina de una linea que manda a otra direccion. Se queda donde vivia la
   herramienta antes, para que los enlaces de fuera y lo que tenga guardado
   Google sigan llegando. No se indexa, y el canonical apunta al sitio nuevo. */
const desvio = (destino, nombre) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(nombre)} se ha mudado</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${destino}">
<meta http-equiv="refresh" content="0; url=${destino}">
<script>location.replace(${JSON.stringify(destino)});</script>
</head>
<body><p>${esc(nombre)} está ahora en <a href="${destino}">${destino}</a>.</p></body>
</html>
`;

/* Una tabla de entradas, que es la pieza que se repite en portada y listados. */
function tabla(entradas) {
  const filas = entradas.map(e => {
    const col = SECCIONES[e.cat].color;
    const fuera = e.externa ? ' target="_blank" rel="noopener noreferrer"' : '';
    const tags = (e.tags || []).slice(0, 4).map(esc).join(' · ');
    const peso = e.externa ? esc(SECCIONES[e.cat].corto.toLowerCase()) : `${e.words} pal.`;
    return `              <tr>
                <td class="ic"><i class="${col}"></i></td>
                <td class="d">${fechaES(e.date)}</td>
                <td><a href="${esc(e.href)}"${fuera}>${esc(e.title)}</a>${tags ? `<div class="tg">${tags}</div>` : ''}</td>
                <td class="s">${peso}</td>
                <td class="ic"></td>
              </tr>`;
  }).join('\n');
  return `          <div class="sunken">
            <table class="lista">
${filas}
            </table>
          </div>`;
}

/* --------------------------------------------------------------- plantilla  */

/* Antes la web era una SPA con URLs de almohadilla. Si a alguien le queda un
   enlace viejo del tipo #/post/pwn/Handoff, el navegador pide la portada y la
   almohadilla se queda en el cliente, asi que se traduce aqui a la URL nueva. */
const SHIM = `<script>(function(){var h=location.hash;if(!h||h.length<2)return;var p=h.replace(/^#\\/?/,'').split('/').filter(Boolean);function sl(s){return decodeURIComponent(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/['"\`\u00b4\u2019]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}var u=null;if(p[0]==='post'&&p[1]&&p[2]){u='/'+p[1].toLowerCase()+'/'+sl(p.slice(2).join('/'))+'/';}else if(p[0]){u='/'+p[0].toLowerCase()+'/';}if(u)location.replace(u);})();</script>`;

function pagina({ titulo, desc, canonical, tipo = 'website', tags = [], jsonld = [], zonaB, zonaC, cuentas, tarea, robots = 'index, follow', shim = false }) {
  const ld = jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n  ');
  return `<!DOCTYPE html>
<html lang="es" data-layout="clasico" data-bg="foto" data-pal="estandar" data-grad="azul">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="author" content="${AUTOR}">
  <meta name="robots" content="${robots}">
  ${tags.length ? `<meta name="keywords" content="${esc(tags.join(', '))}">` : ''}
  <link rel="canonical" href="${canonical}">
  <meta name="google-site-verification" content="${GSC}">

  <meta property="og:type" content="${tipo}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${IMG_SOCIAL}">
  <meta property="og:site_name" content="ub1cu0">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(titulo)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${IMG_SOCIAL}">

  <link rel="alternate" type="application/rss+xml" title="ub1cu0" href="${SITE}/feed.xml">
  <link rel="stylesheet" href="${V_CSS}">
  <link rel="stylesheet" href="${V_CSS2}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E🖥%3C/text%3E%3C/svg%3E">
  ${ld}
  ${shim ? SHIM : ''}
</head>
<body>

${chromeArriba(canonical === `${SITE}/`)}
  <div class="zones">
${zonaA(cuentas)}

    <div class="zone zone-b">
${zonaB}
    </div>

    <div class="zone zone-c">
${zonaC}

    </div>
  </div>

  <template id="tpl-nuevo"><img class="gif" src="/assets/img/new-new.gif" alt="nuevo" width="44" height="24"></template>

${chromeAbajo(tarea)}</body>
</html>
`;
}

/* ----------------------------------------------------------------- paginas  */

function portada(todo, cuentas) {
  const ultimas = todo.slice(0, 14);
  const total = todo.length;
  const desc = 'Writeups de PWN, research de CVE y POCs propios en C/C++. Exploit development y programación a bajo nivel, en español.';

  const zonaB = `${ventana('Bienvenido', `
          <h2 style="margin:0 0 3px;font-size:17px;color:var(--acc)">ub1cu0</h2>
          <div class="role">vulnerability researcher &amp; low level programmer${HAMSTER}</div>
          <div class="chips">
            <span class="on">CEH</span><span class="on">eJPTv2</span>
            <span>C</span><span>C++</span><span>PYTHON</span><span>ASM</span>
          </div>
          <p>Rompo binarios y luego lo cuento. Aquí subo writeups de PWN, research de
          CVE y POCs propios en C/C++. Todo en español, paso a paso y con el debugger
          delante. Miembro del equipo de CTF <b>Caliphal Hounds</b>.</p>
        `, { clase: 'intro conhamster' })}

${ventana('Lo último', `
${tabla(ultimas)}
          <div class="status">
            <span>${total} documentos</span>
          </div>
        `, { clase: 'flush', pad: '3px' })}`;

  const zonaC = `${ventana('Tags', `
          ${nubeTags(todo)}
        `, { clase: 'nube-caja' }).replace('<div class="body"', '<div class="body nube"')}

${ventana('Metas', METAS)}

${AMIGOS_WIN}`;

  return pagina({
    titulo: 'ub1cu0 — Vulnerability Researcher',
    desc,
    canonical: `${SITE}/`,
    tipo: 'website',
    cuentas,
    zonaB, zonaC,
    shim: true,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'ub1cu0', url: `${SITE}/`, inLanguage: 'es', description: desc },
      { '@context': 'https://schema.org', '@type': 'Person', name: AUTOR, url: `${SITE}/`, jobTitle: 'Vulnerability Researcher',
        sameAs: ['https://github.com/ub1cu0', 'https://www.linkedin.com/in/moiseshermo/'] },
    ],
  });
}

function listado(cat, entradas, cuentas) {
  const c = SECCIONES[cat];
  const canonical = `${SITE}/${cat}/`;

  const zonaB = ventana(esc(c.titulo), `
          <div class="migas"><a href="/">Inicio</a> / ${esc(c.corto)}</div>
${tabla(entradas)}
          <div class="status">
            <span>${entradas.length} ${entradas.length === 1 ? 'entrada' : 'entradas'}</span>
            <span>${esc(c.desc)}</span>
          </div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  const zonaC = `${ventana('Tags', `
          ${nubeTags(entradas)}
        `).replace('<div class="body"', '<div class="body nube"')}

${ventana('Metas', METAS)}

${AMIGOS_WIN}`;

  return pagina({
    titulo: `${c.titulo} · ub1cu0`,
    desc: c.desc,
    canonical, tipo: 'website', cuentas, zonaB, zonaC,
    tarea: c.corto,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: c.titulo, description: c.desc, url: canonical, inLanguage: 'es',
      isPartOf: { '@type': 'WebSite', name: 'ub1cu0', url: `${SITE}/` },
    }],
  });
}

function post(cat, e, cuentas) {
  const c = SECCIONES[cat];
  const canonical = `${SITE}/${cat}/${e.urlSlug}/`;
  const desc = e.description || resumen(e.raw);
  const tags = (e.tags || []).map(t => `<a class="t" href="/tags/${slugify(t)}/">${esc(t)}</a>`).join(' ');

  const zonaB = `      <article class="win flush">
        <h1>${esc(e.title)}${BOTONES}</h1>
        <div class="body" style="padding:3px">
          <div class="migas"><a href="/">Inicio</a> / <a href="/${cat}/">${esc(c.corto)}</a> / ${esc(e.title)}</div>
          <div class="prose">
${md.render(sinFrontmatter(e.raw)).replace(/<(\/?)h1>/g, '<$1h2>')}
          </div>
          <div class="status"><span>${fechaES(e.date)} · ${e.words} palabras · ${minutos(e.words)} de lectura</span></div>
        </div>
      </article>`;

  const zonaC = `${ventana('Ficha', `
          <div class="datos">
            <div>sección <b><a href="/${cat}/">${esc(c.corto)}</a></b></div>
            <div>fecha <b>${fechaES(e.date)}</b></div>
            <div>lectura <b>${minutos(e.words)}</b></div>
          </div>
          ${tags ? `<div class="tagsficha">${tags}</div>` : ''}
        `)}

${ventana('Metas', METAS)}

${AMIGOS_WIN}`;

  return pagina({
    titulo: `${e.title} · ub1cu0`,
    desc, canonical, tipo: 'article', tags: e.tags, cuentas, zonaB, zonaC,
    tarea: e.title,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: e.title, description: desc, datePublished: e.date, dateModified: e.date,
        author: { '@type': 'Person', name: AUTOR, url: `${SITE}/` },
        publisher: { '@type': 'Person', name: AUTOR },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        url: canonical, inLanguage: 'es', keywords: (e.tags || []).join(', ') },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: c.corto, item: `${SITE}/${cat}/` },
          { '@type': 'ListItem', position: 3, name: e.title, item: canonical },
        ] },
    ],
  });
}

function paginaTag(g, cuentas, todo) {
  const canonical = `${SITE}/tags/${g.slug}/`;
  const n = g.entradas.length;
  const desc = `Todo lo que he publicado sobre ${g.nombre}: ${n} ${n === 1 ? 'entrada' : 'entradas'} entre writeups de PWN, CVEs y POCs.`;

  const zonaB = ventana(`Tag: ${esc(g.nombre)}`, `
          <div class="migas"><a href="/">Inicio</a> / <a href="/tags/">Tags</a> / ${esc(g.nombre)}</div>
${tabla(g.entradas)}
          <div class="status">
            <span>${n} ${n === 1 ? 'entrada' : 'entradas'} con este tag</span>
            <span><a href="/tags/">ver todos los tags</a></span>
          </div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  const zonaC = `${ventana('Tags', `
          ${nubeTags(todo)}
        `).replace('<div class="body"', '<div class="body nube"')}

${ventana('Metas', METAS)}

${AMIGOS_WIN}`;

  return pagina({
    titulo: `${g.nombre} · ub1cu0`,
    desc, canonical, tipo: 'website', cuentas, zonaB, zonaC,
    tarea: g.nombre,
    // los tags con dos entradas o menos no aportan nada en un buscador
    robots: n >= 3 ? 'index, follow' : 'noindex, follow',
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: `Tag: ${g.nombre}`, description: desc, url: canonical, inLanguage: 'es',
      isPartOf: { '@type': 'WebSite', name: 'ub1cu0', url: `${SITE}/` },
    }],
  });
}

function indiceTags(orden, cuentas) {
  const canonical = `${SITE}/tags/`;
  const filas = orden.map(g => `              <tr>
                <td class="d"><a href="/tags/${g.slug}/">${esc(g.nombre)}</a></td>
                <td class="s">${g.entradas.length}</td>
              </tr>`).join('\n');

  const zonaB = ventana('Tags', `
          <div class="migas"><a href="/">Inicio</a> / Tags</div>
          <div class="sunken">
            <table class="lista tabla-tags">
${filas}
            </table>
          </div>
          <div class="status"><span>${orden.length} tags</span></div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  return pagina({
    titulo: 'Tags · ub1cu0',
    desc: 'Todos los temas que toco: técnicas de explotación, plataformas de CTF y librerías analizadas.',
    canonical, cuentas, zonaB, zonaC: `${ventana('Metas', METAS)}\n\n${AMIGOS_WIN}`, tarea: 'Tags',
  });
}

function pagina404(cuentas) {
  const zonaB = ventana('No encontrado', `
          <p>Esa página no está. Puede que la hayas escrito mal o que ya no exista.</p>
          <p>Desde el índice de la izquierda se llega a todo, o vuelve al <a href="/">inicio</a>.</p>
        `, { h: 'h1' });
  return pagina({
    titulo: '404 · ub1cu0', desc: 'Página no encontrada.',
    canonical: `${SITE}/404.html`, cuentas, zonaB, zonaC: `${ventana('Metas', METAS)}\n\n${AMIGOS_WIN}`, tarea: '404', shim: true,
  });
}

/* ------------------------------------------------------------- feed y demas */

function feed(todo) {
  const items = todo.slice(0, 20).map(e => `    <item>
      <title>${esc(e.title)}</title>
      <link>${e.externa ? esc(e.href) : `${SITE}${e.href}`}</link>
      <guid isPermaLink="${!e.externa}">${e.externa ? esc(e.href) : `${SITE}${e.href}`}</guid>
      <pubDate>${e.date ? new Date(e.date + 'T09:00:00Z').toUTCString() : ''}</pubDate>
      <category>${esc(SECCIONES[e.cat].corto)}</category>
      <description>${esc(e.raw ? resumen(e.raw, 300) : e.title)}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ub1cu0</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Writeups de PWN, research de CVE y POCs en C/C++.</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

const sitemap = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

/* ------------------------------------------------------------------ build   */

/* Las imagenes locales que no existen se publican rotas y nadie se entera hasta
   que alguien abre la pagina. Esto las canta al construir. */
function revisaImagenes(cat, e, html) {
  const rotas = [];
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    const rel = src.startsWith('/') ? join(SRC, src.slice(1)) : join(SRC, cat, src);
    const enDist = src.startsWith('/') ? join(DIST, src.slice(1)) : null;
    if (!existsSync(rel) && !(enDist && existsSync(enDist))) rotas.push(src);
  }
  if (rotas.length) console.warn(`  ! ${cat}/${e.slug}: ${rotas.length} imagen(es) que no existen -> ${rotas.slice(0, 3).join(', ')}`);
  return rotas.length;
}

function escribe(ruta, contenido) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
}

function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // estaticos del repo (imagenes de plataforma y las dos herramientas)
  cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
  if (existsSync(join(SRC, '.nojekyll'))) cpSync(join(SRC, '.nojekyll'), join(DIST, '.nojekyll'));

  const porSeccion = {}, cuentas = {};
  let todo = [];
  for (const cat of Object.keys(SECCIONES)) {
    porSeccion[cat] = leerSeccion(cat);
    cuentas[cat] = porSeccion[cat].length;
    if (!SECCIONES[cat].oculta) todo = todo.concat(porSeccion[cat]);
  }
  todo.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const urls = [{ loc: `${SITE}/`, lastmod: HOY }];
  let nPosts = 0, nRotas = 0;

  for (const cat of Object.keys(SECCIONES)) {
    const entradas = porSeccion[cat];
    if (!entradas.length) continue;
    const oculta = SECCIONES[cat].oculta;

    escribe(join(DIST, cat, 'index.html'), listado(cat, entradas, cuentas));
    if (!oculta) {
      const ultima = entradas.map(e => e.date).filter(Boolean).sort().pop();
      urls.push({ loc: `${SITE}/${cat}/`, lastmod: ultima });
    }

    for (const e of entradas) {
      if (e.externa) continue;
      const html = post(cat, e, cuentas);
      if (!oculta) nRotas += revisaImagenes(cat, e, html);
      escribe(join(DIST, cat, e.urlSlug, 'index.html'), html);
      if (!oculta) urls.push({ loc: `${SITE}/${cat}/${e.urlSlug}/`, lastmod: e.date });
      nPosts++;
    }
  }

  /* Las dos herramientas son paginas sueltas dentro de assets: llevan su propio
     JavaScript y no pasan por pagina(). Aqui se les pega el marco del sitio, se
     les pone la version a las hojas y se publican en /proyectos/<nombre>/, que
     es una direccion de verdad y no un index.html colgando de assets. El JS y el
     wasm se quedan donde estan, sin copiar, porque cada modulo resuelve lo suyo
     contra su propia URL. En el sitio viejo queda un desvio. */
  for (const [t, nombre] of [['shellcrafter', 'ShellCrafter'], ['endian', 'Endian Converter']]) {
    const origen = join(DIST, 'assets/proyectos', t, 'index.html');
    if (!existsSync(origen)) continue;
    const loc = `${SITE}/proyectos/${t}/`;
    let html = readFileSync(origen, 'utf8');

    if (!html.includes('<!--ARRIBA-->')) {
      console.warn(`  ! ${t}/index.html no trae el hueco del marco, se deja como esta`);
      continue;
    }

    html = html
      .replace('<!--ARRIBA-->', chromeArriba(false))
      .replace(/<!--ABAJO:(.*?)-->/, (m, tarea) => chromeAbajo(tarea))
      .replace('/assets/css/lab95.css', V_CSS)
      .replace('/assets/css/lab95-variantes.css', V_CSS2)
      .replace('/assets/css/lab95-tool.css', V_TOOL)
      // el script sigue viviendo en assets, asi que desde la URL nueva va absoluto
      .replace(/src="js\//g, `src="/assets/proyectos/${t}/js/`);

    const d = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, `${nombre}, herramienta de ub1cu0.`])[1];
    html = html.replace('</head>', `  <link rel="canonical" href="${loc}">
  <meta name="author" content="${AUTOR}">
  <meta name="google-site-verification" content="${GSC}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(nombre)} · ub1cu0">
  <meta property="og:description" content="${esc(d)}">
  <meta property="og:url" content="${loc}">
  <meta property="og:image" content="${IMG_SOCIAL}">
  <meta property="og:site_name" content="ub1cu0">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(nombre)} · ub1cu0">
  <meta name="twitter:description" content="${esc(d)}">
  <meta name="twitter:image" content="${IMG_SOCIAL}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E🖥%3C/text%3E%3C/svg%3E">
</head>`);

    escribe(join(DIST, 'proyectos', t, 'index.html'), html);
    urls.push({ loc, lastmod: HOY });

    // la direccion vieja lleva tiempo publicada, asi que no se rompe: se desvia
    writeFileSync(origen, desvio(loc, nombre));
  }

  // paginas de tag
  const tags = ordenTags(mapaTags(todo));
  for (const g of tags) {
    escribe(join(DIST, 'tags', g.slug, 'index.html'), paginaTag(g, cuentas, todo));
    if (g.entradas.length >= 3) urls.push({ loc: `${SITE}/tags/${g.slug}/`, lastmod: g.entradas[0].date });
  }
  escribe(join(DIST, 'tags', 'index.html'), indiceTags(tags, cuentas));
  urls.push({ loc: `${SITE}/tags/`, lastmod: HOY });

  escribe(join(DIST, 'index.html'), portada(todo, cuentas));
  escribe(join(DIST, '404.html'), pagina404(cuentas));
  escribe(join(DIST, 'sitemap.xml'), sitemap(urls));
  escribe(join(DIST, 'robots.txt'), robots());
  escribe(join(DIST, 'feed.xml'), feed(todo));

  const ocultas = Object.keys(SECCIONES).filter(c => SECCIONES[c].oculta && porSeccion[c].length);
  console.log(`✓ ${nPosts} posts, ${tags.length} tags, ${urls.length} URLs en el sitemap, ${todo.length} entradas visibles`);
  if (nRotas) console.log(`  ${nRotas} imagen(es) rotas en las secciones visibles, arriba tienes cuales`);
  if (ocultas.length) console.log(`  (${ocultas.join(', ')} se generan pero no se enlazan ni van al sitemap)`);
}

build();
