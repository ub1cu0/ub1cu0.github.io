import fs from 'fs';
import path from 'path';
import fm from 'front-matter';
import { glob } from 'glob';

// CONFIGURACIÓN: Añade aquí nuevas secciones fácilmente
const SECTIONS = ['pwn', 'htb', 'cve', 'pocs']; 

const SRC_DIR = './src/content';
const OUT_DIR = './public';

// Asegurar directorios de salida
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
SECTIONS.forEach(dir => {
    const p = path.join(OUT_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Copiar Assets estáticos
fs.cpSync('./src/assets', path.join(OUT_DIR, 'assets'), { recursive: true });
fs.cpSync('./src/index.html', path.join(OUT_DIR, 'index.html'));

console.log('⚡ Iniciando build...');

async function processSection(section) {
    const files = await glob(`${SRC_DIR}/${section}/*.md`);
    const indexData = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = fm(content);
        const fileName = path.basename(file);
        
        // AUTOMATIZACIÓN: Conteo de palabras
        const wordCount = parsed.body.split(/\s+/).length;
        
        // AUTOMATIZACIÓN: Fecha (del frontmatter o fecha de modificación del archivo)
        let date = parsed.attributes.date;
        if (!date) {
            const stats = fs.statSync(file);
            date = stats.mtime.toISOString().split('T')[0];
        }

        // AUTOMATIZACIÓN: Asegurar Tags como Array siempre
        let safeTags = parsed.attributes.tags || [];
        if (typeof safeTags === 'string') {
            // Si viene "picoCTF, pwn", convertir a ["picoCTF", "pwn"]
            safeTags = safeTags.split(',').map(t => t.trim());
        }

        indexData.push({
            slug: fileName.replace('.md', ''),
            title: parsed.attributes.title || fileName.replace('.md', ''),
            tags: safeTags, // <--- USAR safeTags AQUÍ
            date: date,
            words: wordCount,
            ...parsed.attributes 
        });

        // Copiamos el MD limpio a public (para que el fetch del frontend funcione)
        // Opcional: Podrías pre-renderizar a HTML aquí, pero mantenemos tu lógica SPA
        // de hacer fetch al .md para no romper tu renderizado de código en cliente.
        fs.copyFileSync(file, path.join(OUT_DIR, section, fileName));
    }

    // Ordenar por fecha descendente
    indexData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Escribir index.json
    fs.writeFileSync(
        path.join(OUT_DIR, section, 'index.json'), 
        JSON.stringify(indexData, null, 2)
    );
    
    console.log(`✅ Sección [${section}] procesada: ${indexData.length} posts.`);
}

// Ejecutar todo
Promise.all(SECTIONS.map(processSection)).then(() => {
    console.log('🚀 Build completado con éxito.');
});