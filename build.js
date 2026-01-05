import fs from 'fs';
import path from 'path';
import fm from 'front-matter';
import { glob } from 'glob';

// CONFIGURACIÓN
const SECTIONS = ['pwn', 'htb', 'poc', 'cve']; 
const DOMAIN = 'https://ub1cu0.github.io'; // <--- TU DOMINIO EXACTO

const SRC_DIR = './src/content';
const OUT_DIR = './public';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
SECTIONS.forEach(dir => {
    const p = path.join(OUT_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

fs.cpSync('./src/assets', path.join(OUT_DIR, 'assets'), { recursive: true });
fs.cpSync('./src/index.html', path.join(OUT_DIR, 'index.html'));

console.log('⚡ Iniciando build...');

// Array para guardar todas las URLs para el sitemap
let allUrls = [];

async function processSection(section) {
    const files = await glob(`${SRC_DIR}/${section}/*.md`);
    const indexData = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = fm(content);
        const fileName = path.basename(file);
        
        const wordCount = parsed.body.split(/\s+/).length;
        
        let date = parsed.attributes.date;
        if (!date) {
            const stats = fs.statSync(file);
            date = stats.mtime.toISOString().split('T')[0];
        }

        // Asegurar Tags como Array
        let safeTags = parsed.attributes.tags || [];
        if (typeof safeTags === 'string') safeTags = safeTags.split(',').map(t => t.trim());

        const slug = fileName.replace('.md', '');

        indexData.push({
            slug: slug,
            title: parsed.attributes.title || slug,
            tags: safeTags,
            date: date,
            words: wordCount,
            ...parsed.attributes 
        });

        fs.copyFileSync(file, path.join(OUT_DIR, section, fileName));

        // AÑADIR URL AL SITEMAP (Formato Hash Bang para tu SPA)
        allUrls.push({
            loc: `${DOMAIN}/#/post/${section}/${encodeURIComponent(slug)}`,
            lastmod: date
        });
    }

    indexData.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(
        path.join(OUT_DIR, section, 'index.json'), 
        JSON.stringify(indexData, null, 2)
    );
    
    console.log(`✅ Sección [${section}] procesada.`);
}

// Ejecutar todo y generar Sitemap
Promise.all(SECTIONS.map(processSection)).then(() => {
    
    // --- GENERADOR DE SITEMAP ---
    console.log('🗺️  Generando sitemap.xml...');
    
    // Añadir páginas estáticas principales
    const mainUrls = [
        { loc: `${DOMAIN}/`, lastmod: new Date().toISOString().split('T')[0] },
        { loc: `${DOMAIN}/#/pwn`, lastmod: new Date().toISOString().split('T')[0] },
        { loc: `${DOMAIN}/#/htb`, lastmod: new Date().toISOString().split('T')[0] },
        { loc: `${DOMAIN}/#/poc`, lastmod: new Date().toISOString().split('T')[0] },
        { loc: `${DOMAIN}/#/cve`, lastmod: new Date().toISOString().split('T')[0] }
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mainUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
${allUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>`;

    fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml);
    console.log('🚀 Build y Sitemap completados.');
});