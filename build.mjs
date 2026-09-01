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
const V_ICO = sello('assets/img/favicon.ico');
const V_GIF = sello('assets/img/favicon.gif');

/* El favicon es el hamster. Van los dos: el .ico lleva 16 y 32 y lo entiende
   cualquier navegador, y el .gif de 32 es el mismo dibujo animado, que Firefox
   si mueve y Chrome deja quieto en el primer fotograma. El gif va el ultimo a
   proposito, porque a igualdad de tamano gana el ultimo declarado. */
const FAVICON = `<link rel="icon" href="${V_ICO}" sizes="16x16 32x32">
  <link rel="icon" type="image/gif" href="${V_GIF}" sizes="32x32">`;

/* El teletipo que va pasando por la barra de abajo. La frase se cambia en la
   tabla T, en `teletipo`, y sale repetida diez veces. Cada copia acaba en
   separador porque el texto gira en bucle y si no se pegarian la ultima palabra
   y la primera. Para un simbolo raro se usa su entidad HTML. */
const teletipo = (lang) => `${T[lang].teletipo} &middot; `.repeat(10);

/* Los colegas del selector de personaje. Para anadir uno: su nombre, su web y
   un sprite recortado en assets/img/. Salen en este orden, y las flechas van
   pasando de uno a otro. Los sprites miden 128x156 con el fondo transparente,
   asi que uno nuevo hay que dejarlo de ese tamano para que no baile: si el suyo
   sale mas alto, hay que crecer el lienzo de todos, no encogerlo a el. */
const AMIGOS = [
  { nombre: 'FOUEN', url: 'https://fouen.blogspot.com/', img: '/assets/img/amigo-fouen.png' },
  { nombre: 'YOSHL', url: 'https://yoshlsec.github.io/', img: '/assets/img/amigo-yoshl.png' },
  { nombre: 'D3B0',  url: 'https://d3bo.eu/',            img: '/assets/img/amigo-d3b0.png' },
  { nombre: 'MARC',  url: 'https://m2rc.net/',           img: '/assets/img/amigo-marc.png' },
  { nombre: 'ANFU',  url: 'https://7anfu.github.io/',    img: '/assets/img/amigo-anfu.png' },
];

/* Cada seccion con su color, que es el mismo del cuadradito del indice.
   `oculta` deja la seccion fuera del menu, del sitemap y de la portada, pero
   sus paginas se siguen generando para no romper enlaces que ya existan. */
const SECCIONES = {
  pwn: { color: 'pwn', oculta: false,
    es: { titulo: 'Writeups PWN', corto: 'PWN', desc: 'Writeups de explotación de binarios (PWN) paso a paso, en español.' },
    en: { titulo: 'PWN Writeups', corto: 'PWN', desc: 'Binary exploitation (PWN) writeups, worked through one step at a time.' } },
  htb: { color: 'htb', oculta: true,
    es: { titulo: 'HackTheBox', corto: 'HTB', desc: 'Resolución de máquinas de HackTheBox, en español.' },
    en: { titulo: 'HackTheBox', corto: 'HTB', desc: 'HackTheBox machines, start to finish.' } },
  cve: { color: 'cve', oculta: false,
    es: { titulo: 'CVEs', corto: 'CVEs', desc: 'Vulnerabilidades (CVE) encontradas y reportadas por mí.' },
    en: { titulo: 'CVEs', corto: 'CVEs', desc: 'Vulnerabilities (CVE) I found and reported myself.' } },
  poc: { color: 'poc', oculta: false,
    es: { titulo: 'POCs', corto: 'POCs', desc: 'Proof of Concept de vulnerabilidades conocidas.' },
    en: { titulo: 'POCs', corto: 'POCs', desc: 'Proof of Concept code for known vulnerabilities.' } },
  proyectos: { color: 'tool', oculta: false,
    es: { titulo: 'Proyectos', corto: 'Proyectos', desc: 'Proyectos personales.' },
    en: { titulo: 'Projects', corto: 'Projects', desc: 'Personal projects.' } },
};

const VISIBLES = Object.keys(SECCIONES).filter(c => !SECCIONES[c].oculta);

/* Los datos de una seccion ya resueltos en un idioma, para no ir arrastrando
   SECCIONES[cat][lang].loquesea por todas las plantillas. */
const sec = (cat, lang) => ({ ...SECCIONES[cat], ...SECCIONES[cat][lang] });

/* ------------------------------------------------------------------ idiomas */

/* El sitio se publica dos veces. El español cuelga de la raiz, igual que
   siempre, asi que ningun enlace que haya por ahi fuera se rompe. El ingles
   cuelga de /en/. Un post tiene version inglesa si al lado de su .md hay un
   .en.md con el mismo nombre, y el selector de la barra de abajo solo sale
   cuando la pagina tiene gemela, asi que nunca puede llevar a un 404. */
const IDIOMAS = ['es', 'en'];
const pref = (lang) => (lang === 'es' ? '' : `/${lang}`);

/* Todo el texto fijo de la interfaz vive en esta tabla. Para cambiar una frase
   se cambia aqui y sale en las dos versiones, sin ir buscandola por el fichero.
   Lo que no esta aqui es el contenido de los posts, que son los .md. */
const T = {
  es: {
    codigo: 'es',
    // marco
    inicioBarra: 'Inicio', visitas: 'visitas',
    musicaAria: 'Poner o quitar la música', musicaTitulo: 'Música',
    anterior: 'Anterior', siguiente: 'Siguiente', nuevo: 'nuevo',
    teletipo: 'BUSCO TRABAJO',
    idioma: 'Español',
    // ventanas
    indice: 'Índice', links: 'Links', bienvenido: 'Bienvenido', loUltimo: 'Lo último',
    tags: 'Tags', metas: 'Metas', amigos: 'Amigos', ficha: 'Ficha', noEncontrado: 'No encontrado',
    // migas
    migaInicio: 'Inicio', migaTags: 'Tags',
    // unidades
    pal: 'pal.', palabras: 'palabras', deLectura: 'de lectura', min: 'min',
    documentos: (n) => `${n} ${n === 1 ? 'documento' : 'documentos'}`,
    entradas: (n) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`,
    entradasTag: (n) => `${n} ${n === 1 ? 'entrada' : 'entradas'} con este tag`,
    nTags: (n) => `${n} tags`,
    verTags: (n) => `ver los ${n} tags`,
    verTodosTags: 'ver todos los tags',
    seccion: 'sección', fecha: 'fecha', lectura: 'lectura',
    // portada
    portadaTitulo: 'ub1cu0 — Vulnerability Researcher',
    portadaDesc: 'Writeups de PWN, research de CVE y POCs propios en C/C++. Exploit development y programación a bajo nivel, en español.',
    rol: 'vulnerability researcher &amp; low level programmer',
    intro: `Rompo binarios y luego lo cuento. Aquí subo writeups de PWN, research de
          CVE y POCs propios en C/C++. Todo en español, paso a paso y con el debugger
          delante. Miembro del equipo de CTF <b>Caliphal Hounds</b>.`,
    metasLista: [
      ['x', 'eJPTv2', 'hecho'], ['x', 'CEH', 'hecho'], ['x', 'ROP Emporium al 100%', 'hecho'],
      ['x', 'primer CVE propio', '2026'], ['', 'Linux Kernel exploitation', '2026'], ['', 'OSEE', '2027'],
    ],
    // tags
    tagTitulo: (n) => `Tag: ${n}`,
    tagDesc: (n, c) => `Todo lo que he publicado sobre ${n}: ${c} ${c === 1 ? 'entrada' : 'entradas'} entre writeups de PWN, CVEs y POCs.`,
    tagsDesc: 'Todos los temas que toco: técnicas de explotación, plataformas de CTF y librerías analizadas.',
    // 404
    p404a: 'Esa página no está. Puede que la hayas escrito mal o que ya no exista.',
    p404b: 'Desde el índice de la izquierda se llega a todo, o vuelve al <a href="/">inicio</a>.',
    // feed
    feedDesc: 'Writeups de PWN, research de CVE y POCs en C/C++.',
  },
  en: {
    codigo: 'en',
    inicioBarra: 'Start', visitas: 'visits',
    musicaAria: 'Play or mute the music', musicaTitulo: 'Music',
    anterior: 'Previous', siguiente: 'Next', nuevo: 'new',
    teletipo: 'LOOKING FOR WORK',
    idioma: 'English',
    indice: 'Index', links: 'Links', bienvenido: 'Welcome', loUltimo: 'Latest',
    tags: 'Tags', metas: 'Goals', amigos: 'Friends', ficha: 'Details', noEncontrado: 'Not found',
    migaInicio: 'Home', migaTags: 'Tags',
    pal: 'w.', palabras: 'words', deLectura: 'read', min: 'min',
    documentos: (n) => `${n} ${n === 1 ? 'document' : 'documents'}`,
    entradas: (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
    entradasTag: (n) => `${n} ${n === 1 ? 'entry' : 'entries'} tagged this`,
    nTags: (n) => `${n} tags`,
    verTags: (n) => `see all ${n} tags`,
    verTodosTags: 'see all tags',
    seccion: 'section', fecha: 'date', lectura: 'reading',
    portadaTitulo: 'ub1cu0 — Vulnerability Researcher',
    portadaDesc: 'PWN writeups, CVE research and my own C/C++ proof of concept code. Exploit development and low level programming.',
    rol: 'vulnerability researcher &amp; low level programmer',
    intro: `I break binaries and then write down how. Here go my PWN writeups, CVE
          research and proof of concept code in C/C++. Every one of them step by step,
          with the debugger open. Member of the CTF team <b>Caliphal Hounds</b>.`,
    metasLista: [
      ['x', 'eJPTv2', 'done'], ['x', 'CEH', 'done'], ['x', 'ROP Emporium 100%', 'done'],
      ['x', 'first CVE of my own', '2026'], ['', 'Linux kernel exploitation', '2026'], ['', 'OSEE', '2027'],
    ],
    tagTitulo: (n) => `Tag: ${n}`,
    tagDesc: (n, c) => `Everything I have published about ${n}: ${c} ${c === 1 ? 'entry' : 'entries'} across PWN writeups, CVEs and POCs.`,
    tagsDesc: 'Every topic I cover: exploitation techniques, CTF platforms and the libraries I have pulled apart.',
    p404a: 'That page is not here. Either the address has a typo or it is gone.',
    p404b: 'The index on the left gets you everywhere, or head back to the <a href="/en/">start</a>.',
    feedDesc: 'PWN writeups, CVE research and C/C++ proof of concept code.',
  },
};

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

/* En español la fecha va dd/mm/aaaa, que es como se lee aqui. En ingles va en
   ISO, que es lo unico que no se confunde entre un lector britanico y uno
   americano y ademas ocupa lo mismo en la columna. */
const fechaDe = (d, lang) => (!d ? '' : lang === 'es' ? d.split('-').reverse().join('/') : d);

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

  for (const f of readdirSync(dir).filter(f => f.endsWith('.md') && !f.endsWith('.en.md'))) {
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

    /* La version inglesa de un post es un .en.md al lado del .md, con el mismo
       nombre. Si no esta, la entrada existe solo en español: no sale en el sitio
       ingles y su pagina española no lleva selector de idioma. */
    const enPath = join(dir, `${e.slug}.en.md`);
    const rawEn = tieneMd && existsSync(enPath) ? readFileSync(enPath, 'utf8') : '';
    const fmEn = rawEn ? frontmatter(rawEn) : {};

    salida.push({
      ...e,
      raw,
      urlSlug,
      words: tieneMd ? palabras(raw) : 0,
      externa: Boolean(e.url),
      en: rawEn ? {
        title: fmEn.title || e.title,
        raw: rawEn,
        words: palabras(rawEn),
        description: fmEn.description || '',
      } : null,
    });
  }
  return salida.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* El titulo, el texto y la cuenta de palabras de una entrada en el idioma que
   toque. En español siempre hay; en ingles solo si existe el .en.md. */
const ver = (e, lang) => (lang === 'en' && e.en
  ? { title: e.en.title, raw: e.en.raw, words: e.en.words, description: e.en.description }
  : { title: e.title, raw: e.raw, words: e.words, description: e.description || '' });

/* Una entrada tiene sitio en el idioma pedido si esta traducida, o si es un
   enlace de fuera, que no tiene texto mio que traducir. */
const hay = (e, lang) => lang === 'es' || Boolean(e.en) || e.externa;
const enIdioma = (lista, lang) => (lang === 'es' ? lista : lista.filter(e => hay(e, lang)));

/* La direccion de una entrada. Las de fuera se quedan como estan; las de dentro
   se les cuelga el prefijo del idioma. */
const hrefDe = (e, lang) => {
  if (!e.url) return `${pref(lang)}/${e.cat}/${e.urlSlug}/`;
  return e.url.startsWith('/') ? `${pref(lang)}${e.url}` : e.url;
};

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
const chromeArriba = (esPortada, lang = 'es') => `${NUBES}

<button class="musica" id="musica" type="button" aria-pressed="false"
        aria-label="${T[lang].musicaAria}" title="${T[lang].musicaTitulo}" data-video="${VIDEO}">
  <img src="/assets/img/musica.gif" alt="">
  <canvas width="108" height="96" aria-hidden="true"></canvas>
</button>
<div id="reproductor" aria-hidden="true"></div>

<div class="page">

  <header class="banner">
    ${esPortada
      ? '<h1 class="logo">&lt;<b>ub1cu0</b>&gt;</h1>'
      : `<div class="logo"><a href="${pref(lang)}/">&lt;<b>ub1cu0</b>&gt;</a></div>`}
    <div class="sub">VULNERABILITY RESEARCH &middot; EXPLOIT DEV &middot; LOW LEVEL</div>
    <img class="gif mascota" src="/assets/img/banner.gif" alt="" width="139" height="163">
  </header>
`;

/* El selector de idioma, en la barra de abajo y pegado a las visitas. El idioma
   en el que estas no es un enlace, es un boton hundido, porque ya estas ahi. El
   otro si. Solo se dibuja cuando le pasan la direccion de la gemela, asi que una
   pagina sin traducir no ensena el selector y nunca manda a un 404. El español
   va siempre el primero para que los dos botones no bailen al cambiar. */
const selector = (lang, gemela) => {
  if (!gemela) return '';
  const otro = lang === 'es' ? 'en' : 'es';
  const yo = `<span class="lang on" aria-current="true"><i class="bandera ${lang}"></i>${T[lang].idioma}</span>`;
  /* La gemela llega absoluta porque el hreflang de la cabecera la necesita asi.
     El boton, en cambio, va relativo: es lo que hace que la navegacion suave lo
     trate como un enlace de casa y que la vista previa local funcione. */
  const rel = gemela.startsWith(SITE) ? gemela.slice(SITE.length) : gemela;
  const el = `<a class="lang" href="${rel}" hreflang="${otro}" lang="${otro}"><i class="bandera ${otro}"></i>${T[otro].idioma}</a>`;
  return `\n    <div class="idiomas">${lang === 'es' ? yo + el : el + yo}</div>`;
};

const chromeAbajo = (tarea, lang = 'es', gemela = '') => `  <footer class="taskbar">
    <div class="start"><em></em>${T[lang].inicioBarra}</div>
    <div class="tarea">${esc(tarea || 'ub1cu0')}</div>
    <div class="hueco"><span>${teletipo(lang)}</span></div>${selector(lang, gemela)}
    <div class="visitas">${T[lang].visitas} <span id="visitas">001337</span></div>
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

function zonaA(cuentas, lang) {
  const items = VISIBLES.map(c =>
    `          <a href="${pref(lang)}/${c}/"><i class="${SECCIONES[c].color}"></i>${esc(sec(c, lang).titulo)} <span class="n">${cuentas[c]}</span></a>`
  ).join('\n');
  return `    <div class="zone zone-a">
${ventana(T[lang].indice, `\n${items}\n        `, { tag: 'nav', clase: 'menu', pad: '3px' })}

${ventana(T[lang].links, `
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
function nubeTags(entradas, lang, max = 16) {
  const orden = ordenTags(mapaTags(entradas));
  if (!orden.length) return '';
  const top = orden[0].entradas.length;
  const trozos = orden.slice(0, max).map(g => {
    const p = g.entradas.length / top;
    const c = p > 0.7 ? 's4' : p > 0.4 ? 's3' : p > 0.15 ? 's2' : 's1';
    return `<b class="${c}"><a href="${pref(lang)}/tags/${g.slug}/">${esc(g.nombre)}</a> <i>${g.entradas.length}</i></b>`;
  });
  if (orden.length > max) trozos.push(`<span class="todos"><a href="${pref(lang)}/tags/">${T[lang].verTags(orden.length)}</a></span>`);
  return trozos.join('\n          ');
}

const METAS = (lang) => `
          <ul class="metas">
${T[lang].metasLista.map(([hecho, que, cuando]) =>
  `            <li><span class="box${hecho ? ' hecho' : ''}">[${hecho || ' '}]</span> ${esc(que)} <span class="yr">${esc(cuando)}</span></li>`
).join('\n')}
          </ul>
        `;

/* El selector de colegas. Cada uno es un enlace de verdad y estan todos en el
   HTML: el JavaScript solo ensena uno y las flechas cambian cual. Sin JS se ve
   el primero y su enlace funciona igual. */
const AMIGOS_WIN = (lang) => ventana(T[lang].amigos, `
          <div class="isaac" id="isaac">
            <button class="fl" type="button" data-paso="-1" aria-label="${T[lang].anterior}"><img class="flecha" src="/assets/img/flecha.gif" alt=""><span class="mini"><img src="${AMIGOS[AMIGOS.length - 1].img}" alt=""></span></button>
            <div class="fichas">
${AMIGOS.map((a, i) => `              <a class="ficha" href="${a.url}" target="_blank" rel="noopener"${i ? ' hidden' : ''}>
                <span class="nom">${esc(a.nombre)}</span>
                <span class="marco"><img src="${a.img}" alt="${esc(a.nombre)}" width="128" height="156"></span>
              </a>`).join('\n')}
            </div>
            <button class="fl" type="button" data-paso="1" aria-label="${T[lang].siguiente}"><img class="flecha" src="/assets/img/flecha.gif" alt=""><span class="mini"><img src="${AMIGOS[1 % AMIGOS.length].img}" alt=""></span></button>
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
function tabla(entradas, lang) {
  const filas = entradas.map(e => {
    const col = SECCIONES[e.cat].color;
    const fuera = e.externa ? ' target="_blank" rel="noopener noreferrer"' : '';
    const tags = (e.tags || []).slice(0, 4).map(esc).join(' · ');
    const v = ver(e, lang);
    const peso = e.externa ? esc(sec(e.cat, lang).corto.toLowerCase()) : `${v.words} ${T[lang].pal}`;
    return `              <tr>
                <td class="ic"><i class="${col}"></i></td>
                <td class="d">${fechaDe(e.date, lang)}</td>
                <td><a href="${esc(hrefDe(e, lang))}"${fuera}>${esc(v.title)}</a>${tags ? `<div class="tg">${tags}</div>` : ''}</td>
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

function pagina({ titulo, desc, canonical, tipo = 'website', tags = [], jsonld = [], zonaB, zonaC, cuentas, tarea, robots = 'index, follow', shim = false, lang = 'es', gemela = '' }) {
  const ld = jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n  ');
  /* Las dos direcciones de una misma pagina, para que Google sepa que son la
     misma cosa en dos idiomas y no las trate como copiada una de la otra. El
     x-default apunta al español, que es donde vive el sitio de verdad. */
  const es = lang === 'es' ? canonical : gemela;
  const en = lang === 'en' ? canonical : gemela;
  const alternas = gemela ? `
  <link rel="alternate" hreflang="es" href="${es}">
  <link rel="alternate" hreflang="en" href="${en}">
  <link rel="alternate" hreflang="x-default" href="${es}">` : '';
  return `<!DOCTYPE html>
<html lang="${T[lang].codigo}" data-layout="clasico" data-bg="foto" data-pal="estandar" data-grad="azul">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="author" content="${AUTOR}">
  <meta name="robots" content="${robots}">
  ${tags.length ? `<meta name="keywords" content="${esc(tags.join(', '))}">` : ''}
  <link rel="canonical" href="${canonical}">${alternas}
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

  <link rel="alternate" type="application/rss+xml" title="ub1cu0" href="${SITE}${pref(lang)}/feed.xml">
  <link rel="stylesheet" href="${V_CSS}">
  <link rel="stylesheet" href="${V_CSS2}">
  ${FAVICON}
  ${ld}
  ${shim ? SHIM : ''}
</head>
<body>

${chromeArriba(canonical === `${SITE}${pref(lang)}/`, lang)}
  <div class="zones">
${zonaA(cuentas, lang)}

    <div class="zone zone-b">
${zonaB}
    </div>

    <div class="zone zone-c">
${zonaC}

    </div>
  </div>

  <template id="tpl-nuevo"><img class="gif" src="/assets/img/new-new.gif" alt="${T[lang].nuevo}" width="44" height="24"></template>

${chromeAbajo(tarea, lang, gemela)}</body>
</html>
`;
}

/* ----------------------------------------------------------------- paginas  */

function portada(todo, cuentas, lang, gemela) {
  const ultimas = todo.slice(0, 14);
  const total = todo.length;
  const desc = T[lang].portadaDesc;
  const canonical = `${SITE}${pref(lang)}/`;

  const zonaB = `${ventana(T[lang].bienvenido, `
          <h2 style="margin:0 0 3px;font-size:17px;color:var(--acc)">ub1cu0</h2>
          <div class="role">${T[lang].rol}${HAMSTER}</div>
          <div class="chips">
            <span class="on">CEH</span><span class="on">eJPTv2</span>
            <span>C</span><span>C++</span><span>PYTHON</span><span>ASM</span>
          </div>
          <p>${T[lang].intro}</p>
        `, { clase: 'intro conhamster' })}

${ventana(T[lang].loUltimo, `
${tabla(ultimas, lang)}
          <div class="status">
            <span>${T[lang].documentos(total)}</span>
          </div>
        `, { clase: 'flush', pad: '3px' })}`;

  const zonaC = `${ventana(T[lang].tags, `
          ${nubeTags(todo, lang)}
        `, { clase: 'nube-caja' }).replace('<div class="body"', '<div class="body nube"')}

${ventana(T[lang].metas, METAS(lang))}

${AMIGOS_WIN(lang)}`;

  return pagina({
    titulo: T[lang].portadaTitulo,
    desc,
    canonical,
    tipo: 'website',
    cuentas,
    zonaB, zonaC,
    shim: lang === 'es',
    lang, gemela,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'ub1cu0', url: canonical, inLanguage: lang, description: desc },
      { '@context': 'https://schema.org', '@type': 'Person', name: AUTOR, url: canonical, jobTitle: 'Vulnerability Researcher',
        sameAs: ['https://github.com/ub1cu0', 'https://www.linkedin.com/in/moiseshermo/'] },
    ],
  });
}

function listado(cat, entradas, cuentas, lang, gemela) {
  const c = sec(cat, lang);
  const canonical = `${SITE}${pref(lang)}/${cat}/`;

  const zonaB = ventana(esc(c.titulo), `
          <div class="migas"><a href="${pref(lang)}/">${T[lang].migaInicio}</a> / ${esc(c.corto)}</div>
${tabla(entradas, lang)}
          <div class="status">
            <span>${T[lang].entradas(entradas.length)}</span>
            <span>${esc(c.desc)}</span>
          </div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  const zonaC = `${ventana(T[lang].tags, `
          ${nubeTags(entradas, lang)}
        `).replace('<div class="body"', '<div class="body nube"')}

${ventana(T[lang].metas, METAS(lang))}

${AMIGOS_WIN(lang)}`;

  return pagina({
    titulo: `${c.titulo} · ub1cu0`,
    desc: c.desc,
    canonical, tipo: 'website', cuentas, zonaB, zonaC,
    tarea: c.corto, lang, gemela,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: c.titulo, description: c.desc, url: canonical, inLanguage: lang,
      isPartOf: { '@type': 'WebSite', name: 'ub1cu0', url: `${SITE}${pref(lang)}/` },
    }],
  });
}

function post(cat, e, cuentas, lang, gemela) {
  const c = sec(cat, lang);
  const v = ver(e, lang);
  const canonical = `${SITE}${pref(lang)}/${cat}/${e.urlSlug}/`;
  const desc = v.description || resumen(v.raw);
  const tags = (e.tags || []).map(t => `<a class="t" href="${pref(lang)}/tags/${slugify(t)}/">${esc(t)}</a>`).join(' ');

  const zonaB = `      <article class="win flush">
        <h1>${esc(v.title)}${BOTONES}</h1>
        <div class="body" style="padding:3px">
          <div class="migas"><a href="${pref(lang)}/">${T[lang].migaInicio}</a> / <a href="${pref(lang)}/${cat}/">${esc(c.corto)}</a> / ${esc(v.title)}</div>
          <div class="prose">
${md.render(sinFrontmatter(v.raw)).replace(/<(\/?)h1>/g, '<$1h2>')}
          </div>
          <div class="status"><span>${fechaDe(e.date, lang)} · ${v.words} ${T[lang].palabras} · ${minutos(v.words)} ${T[lang].deLectura}</span></div>
        </div>
      </article>`;

  const zonaC = `${ventana(T[lang].ficha, `
          <div class="datos">
            <div>${T[lang].seccion} <b><a href="${pref(lang)}/${cat}/">${esc(c.corto)}</a></b></div>
            <div>${T[lang].fecha} <b>${fechaDe(e.date, lang)}</b></div>
            <div>${T[lang].lectura} <b>${minutos(v.words)}</b></div>
          </div>
          ${tags ? `<div class="tagsficha">${tags}</div>` : ''}
        `)}

${ventana(T[lang].metas, METAS(lang))}

${AMIGOS_WIN(lang)}`;

  return pagina({
    titulo: `${v.title} · ub1cu0`,
    desc, canonical, tipo: 'article', tags: e.tags, cuentas, zonaB, zonaC,
    tarea: v.title, lang, gemela,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: v.title, description: desc, datePublished: e.date, dateModified: e.date,
        author: { '@type': 'Person', name: AUTOR, url: `${SITE}/` },
        publisher: { '@type': 'Person', name: AUTOR },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        url: canonical, inLanguage: lang, keywords: (e.tags || []).join(', ') },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: T[lang].migaInicio, item: `${SITE}${pref(lang)}/` },
          { '@type': 'ListItem', position: 2, name: c.corto, item: `${SITE}${pref(lang)}/${cat}/` },
          { '@type': 'ListItem', position: 3, name: v.title, item: canonical },
        ] },
    ],
  });
}

function paginaTag(g, cuentas, todo, lang, gemela) {
  const canonical = `${SITE}${pref(lang)}/tags/${g.slug}/`;
  const n = g.entradas.length;
  const desc = T[lang].tagDesc(g.nombre, n);

  const zonaB = ventana(esc(T[lang].tagTitulo(g.nombre)), `
          <div class="migas"><a href="${pref(lang)}/">${T[lang].migaInicio}</a> / <a href="${pref(lang)}/tags/">${T[lang].migaTags}</a> / ${esc(g.nombre)}</div>
${tabla(g.entradas, lang)}
          <div class="status">
            <span>${T[lang].entradasTag(n)}</span>
            <span><a href="${pref(lang)}/tags/">${T[lang].verTodosTags}</a></span>
          </div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  const zonaC = `${ventana(T[lang].tags, `
          ${nubeTags(todo, lang)}
        `).replace('<div class="body"', '<div class="body nube"')}

${ventana(T[lang].metas, METAS(lang))}

${AMIGOS_WIN(lang)}`;

  return pagina({
    titulo: `${g.nombre} · ub1cu0`,
    desc, canonical, tipo: 'website', cuentas, zonaB, zonaC,
    tarea: g.nombre, lang, gemela,
    // los tags con dos entradas o menos no aportan nada en un buscador
    robots: n >= 3 ? 'index, follow' : 'noindex, follow',
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: T[lang].tagTitulo(g.nombre), description: desc, url: canonical, inLanguage: lang,
      isPartOf: { '@type': 'WebSite', name: 'ub1cu0', url: `${SITE}${pref(lang)}/` },
    }],
  });
}

function indiceTags(orden, cuentas, lang, gemela) {
  const canonical = `${SITE}${pref(lang)}/tags/`;
  const filas = orden.map(g => `              <tr>
                <td class="d"><a href="${pref(lang)}/tags/${g.slug}/">${esc(g.nombre)}</a></td>
                <td class="s">${g.entradas.length}</td>
              </tr>`).join('\n');

  const zonaB = ventana(T[lang].tags, `
          <div class="migas"><a href="${pref(lang)}/">${T[lang].migaInicio}</a> / ${T[lang].migaTags}</div>
          <div class="sunken">
            <table class="lista tabla-tags">
${filas}
            </table>
          </div>
          <div class="status"><span>${T[lang].nTags(orden.length)}</span></div>
        `, { clase: 'flush', h: 'h1', pad: '3px' });

  return pagina({
    titulo: `${T[lang].tags} · ub1cu0`,
    desc: T[lang].tagsDesc,
    canonical, cuentas, zonaB, zonaC: `${ventana(T[lang].metas, METAS(lang))}\n\n${AMIGOS_WIN(lang)}`,
    tarea: T[lang].tags, lang, gemela,
  });
}

function pagina404(cuentas, lang) {
  const zonaB = ventana(T[lang].noEncontrado, `
          <p>${T[lang].p404a}</p>
          <p>${T[lang].p404b}</p>
        `, { h: 'h1' });
  return pagina({
    titulo: '404 · ub1cu0', desc: lang === 'es' ? 'Página no encontrada.' : 'Page not found.',
    canonical: `${SITE}${pref(lang)}/404.html`, cuentas, zonaB,
    zonaC: `${ventana(T[lang].metas, METAS(lang))}\n\n${AMIGOS_WIN(lang)}`,
    tarea: '404', shim: lang === 'es', lang, robots: 'noindex, follow',
  });
}

/* ------------------------------------------------------------- feed y demas */

function feed(todo, lang) {
  const items = todo.slice(0, 20).map(e => {
    const v = ver(e, lang);
    const url = e.externa ? hrefDe(e, lang) : `${SITE}${hrefDe(e, lang)}`;
    return `    <item>
      <title>${esc(v.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="${!e.externa}">${esc(url)}</guid>
      <pubDate>${e.date ? new Date(e.date + 'T09:00:00Z').toUTCString() : ''}</pubDate>
      <category>${esc(sec(e.cat, lang).corto)}</category>
      <description>${esc(v.raw ? resumen(v.raw, 300) : v.title)}</description>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ub1cu0</title>
    <link>${SITE}${pref(lang)}/</link>
    <atom:link href="${SITE}${pref(lang)}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(T[lang].feedDesc)}</description>
    <language>${T[lang].codigo}</language>
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

  // el navegador pide /favicon.ico solo, sin mirar el <link>, asi que hay copia en la raiz
  cpSync(join(SRC, 'assets/img/favicon.ico'), join(DIST, 'favicon.ico'));

  const porSeccion = {};
  for (const cat of Object.keys(SECCIONES)) porSeccion[cat] = leerSeccion(cat);

  /* Cada idioma tiene su propio mundo: sus entradas, sus cuentas y sus tags. Una
     entrada solo existe en ingles si esta traducida, asi que las cuentas del
     menu y la nube de tags salen distintas en cada version, que es lo correcto:
     el indice ingles no puede prometer 46 writeups si hay tres. */
  const mundo = {};
  for (const lang of IDIOMAS) {
    const secciones = {}, cuentas = {};
    let todo = [];
    for (const cat of Object.keys(SECCIONES)) {
      secciones[cat] = enIdioma(porSeccion[cat], lang);
      cuentas[cat] = secciones[cat].length;
      if (!SECCIONES[cat].oculta) todo = todo.concat(secciones[cat]);
    }
    todo.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const tags = ordenTags(mapaTags(todo));
    mundo[lang] = { secciones, cuentas, todo, tags, slugsTag: new Set(tags.map(g => g.slug)) };
  }

  const urls = [];
  let nPosts = 0, nRotas = 0, nEn = 0;

  for (const lang of IDIOMAS) {
    const otro = lang === 'es' ? 'en' : 'es';
    const M = mundo[lang], O = mundo[otro];
    if (!M.todo.length) continue;

    // el español cuelga de la raiz y el ingles de /en/, tanto en disco como en la URL
    const dest = (...partes) => join(DIST, ...(lang === 'es' ? partes : ['en', ...partes]));
    const url = (ruta) => `${SITE}${pref(lang)}${ruta}`;
    const gemelaDe = (ruta) => `${SITE}${pref(otro)}${ruta}`;

    urls.push({ loc: url('/'), lastmod: HOY });
    escribe(dest('index.html'), portada(M.todo, M.cuentas, lang, gemelaDe('/')));

    for (const cat of Object.keys(SECCIONES)) {
      const entradas = M.secciones[cat];
      if (!entradas.length) continue;
      const oculta = SECCIONES[cat].oculta;

      const gemelaLista = O.secciones[cat].length ? gemelaDe(`/${cat}/`) : '';
      escribe(dest(cat, 'index.html'), listado(cat, entradas, M.cuentas, lang, gemelaLista));
      if (!oculta) {
        const ultima = entradas.map(e => e.date).filter(Boolean).sort().pop();
        urls.push({ loc: url(`/${cat}/`), lastmod: ultima });
      }

      for (const e of entradas) {
        if (e.externa) continue;
        const gemela = hay(e, otro) ? gemelaDe(`/${cat}/${e.urlSlug}/`) : '';
        const html = post(cat, e, M.cuentas, lang, gemela);
        if (!oculta && lang === 'es') nRotas += revisaImagenes(cat, e, html);
        escribe(dest(cat, e.urlSlug, 'index.html'), html);
        if (!oculta) urls.push({ loc: url(`/${cat}/${e.urlSlug}/`), lastmod: e.date });
        if (lang === 'es') nPosts++; else nEn++;
      }
    }

    for (const g of M.tags) {
      const gemela = O.slugsTag.has(g.slug) ? gemelaDe(`/tags/${g.slug}/`) : '';
      escribe(dest('tags', g.slug, 'index.html'), paginaTag(g, M.cuentas, M.todo, lang, gemela));
      if (g.entradas.length >= 3) urls.push({ loc: url(`/tags/${g.slug}/`), lastmod: g.entradas[0].date });
    }
    escribe(dest('tags', 'index.html'), indiceTags(M.tags, M.cuentas, lang, O.tags.length ? gemelaDe('/tags/') : ''));
    urls.push({ loc: url('/tags/'), lastmod: HOY });

    escribe(dest('feed.xml'), feed(M.todo, lang));
  }

  /* Las dos herramientas son paginas sueltas dentro de assets: llevan su propio
     JavaScript y no pasan por pagina(). Aqui se les pega el marco del sitio, se
     les pone la version a las hojas y se publican en /proyectos/<nombre>/, que
     es una direccion de verdad y no un index.html colgando de assets. El JS y el
     wasm se quedan donde estan, sin copiar, porque cada modulo resuelve lo suyo
     contra su propia URL. Si al lado hay un index.en.html, sale tambien en
     /en/proyectos/<nombre>/ y las dos se enlazan entre ellas. En el sitio viejo
     queda un desvio. */
  for (const [t, nombre] of [['shellcrafter', 'ShellCrafter'], ['endian', 'Endian Converter']]) {
    const base = join(DIST, 'assets/proyectos', t);
    const tieneEn = existsSync(join(base, 'index.en.html'));

    for (const lang of IDIOMAS) {
      if (lang === 'en' && !tieneEn) continue;
      const origen = join(base, lang === 'es' ? 'index.html' : 'index.en.html');
      if (!existsSync(origen)) continue;

      const otro = lang === 'es' ? 'en' : 'es';
      const loc = `${SITE}${pref(lang)}/proyectos/${t}/`;
      const gemela = tieneEn ? `${SITE}${pref(otro)}/proyectos/${t}/` : '';
      let html = readFileSync(origen, 'utf8');

      if (!html.includes('<!--ARRIBA-->')) {
        console.warn(`  ! ${t}/${lang === 'es' ? 'index.html' : 'index.en.html'} no trae el hueco del marco, se deja como esta`);
        continue;
      }

      html = html
        .replace('<!--ARRIBA-->', chromeArriba(false, lang))
        .replace(/<!--ABAJO:(.*?)-->/, (m, tarea) => chromeAbajo(tarea, lang, gemela))
        .replace('/assets/css/lab95.css', V_CSS)
        .replace('/assets/css/lab95-variantes.css', V_CSS2)
        .replace('/assets/css/lab95-tool.css', V_TOOL)
        // el script sigue viviendo en assets, asi que desde la URL nueva va absoluto
        .replace(/src="js\//g, `src="/assets/proyectos/${t}/js/`);

      const alternas = gemela ? `
  <link rel="alternate" hreflang="es" href="${lang === 'es' ? loc : gemela}">
  <link rel="alternate" hreflang="en" href="${lang === 'en' ? loc : gemela}">
  <link rel="alternate" hreflang="x-default" href="${lang === 'es' ? loc : gemela}">` : '';

      const d = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, `${nombre}, herramienta de ub1cu0.`])[1];
      html = html.replace('</head>', `  <link rel="canonical" href="${loc}">${alternas}
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
  ${FAVICON}
</head>`);

      escribe(join(DIST, ...(lang === 'es' ? [] : ['en']), 'proyectos', t, 'index.html'), html);
      urls.push({ loc, lastmod: HOY });
    }

    // la direccion vieja lleva tiempo publicada, asi que no se rompe: se desvia
    const viejo = join(base, 'index.html');
    if (existsSync(viejo)) writeFileSync(viejo, desvio(`${SITE}/proyectos/${t}/`, nombre));
    const viejoEn = join(base, 'index.en.html');
    if (existsSync(viejoEn)) rmSync(viejoEn);
  }

  escribe(join(DIST, '404.html'), pagina404(mundo.es.cuentas, 'es'));
  escribe(join(DIST, 'sitemap.xml'), sitemap(urls));
  escribe(join(DIST, 'robots.txt'), robots());

  const ocultas = Object.keys(SECCIONES).filter(c => SECCIONES[c].oculta && porSeccion[c].length);
  const traducibles = mundo.es.todo.filter(e => !e.externa).length;
  console.log(`✓ ${nPosts} posts en español, ${mundo.es.tags.length} tags, ${urls.length} URLs en el sitemap`);
  console.log(`  ${nEn} posts en inglés de ${traducibles} traducibles, ${mundo.en.tags.length} tags`);
  if (nRotas) console.log(`  ${nRotas} imagen(es) rotas en las secciones visibles, arriba tienes cuales`);
  if (ocultas.length) console.log(`  (${ocultas.join(', ')} se generan pero no se enlazan ni van al sitemap)`);
}

build();
