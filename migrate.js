import fs from 'fs';
import path from 'path';

// Tus datos originales recuperados
const DATA = {
    'htb': [
        {"slug": "EscapeTwo", "tags": ["HackTheBox", "windows", "active directory", "mssql"], "date": "2025-05-14"},
        {"slug":"Nocturnal","tags":["HackTheBox", "linux","web","command injection","ispcfg"],"date":"2025-05-16"},
        {"slug":"Timelapse","tags":["HackTheBox","windows", "active directory","laps","pfx"],"date":"2025-05-15"},
        {"slug":"Jeeves","tags":["HackTheBox", "windows", "jenkins","seimpersonate","juicypotato"],"date":"2025-05-13"}
    ],
    'pwn': [
        {"slug": "Buffer overflow 1", "tags": ["picoCTF", "buffer overflow"], "date": "2025-07-14"},
        {"slug": "Buffer overflow 2", "tags": ["picoCTF", "buffer overflow", "ret2win"], "date": "2025-07-14"},
        {"slug": "Flag leak", "tags": ["picoCTF", "format string"], "date": "2025-07-14"},
        {"slug": "Hijacking", "tags": ["picoCTF", "sudo", "python module hijack"], "date": "2025-07-14"},
        {"slug": "RSP", "tags": ["picoCTF", "string injection", "input validation"], "date": "2025-07-14"},
        {"slug": "X sixty what", "tags": ["picoCTF", "buffer overflow", "ret2win"], "date": "2025-07-14"},
        {"slug": "two-sum", "tags": ["picoCTF", "integer overflow"], "date": "2025-07-15"},
        {"slug": "VNE", "tags": ["picoCTF", "env"], "date": "2025-07-15"},
        {"slug": "Local target", "tags": ["picoCTF", "buffer overflow"], "date": "2025-07-15"},
        {"slug": "Picker IV", "tags": ["picoCTF", "ret2win"], "date": "2025-07-16"},
        {"slug": "Format string 1", "tags": ["picoCTF", "format string"], "date": "2025-07-16"},
        {"slug": "Heap 1", "tags": ["picoCTF", "heap", "buffer overflow"], "date": "2025-07-16"},
        {"slug": "Heap 2", "tags": ["picoCTF", "heap", "buffer overflow", "function pointer"], "date": "2025-07-17"},
        {"slug": "Heap 3", "tags": ["picoCTF", "use after free", "heap"], "date": "2025-07-17"},
        {"slug": "Format string 2", "tags": ["picoCTF", "format string"], "date": "2025-07-18"},
        {"slug": "Echo valley", "tags": ["picoCTF", "format string", "PIE", "canary"], "date": "2025-07-19"},
        {"slug": "Format string 3", "tags": ["picoCTF", "format string", "GOT overwrite"], "date": "2025-07-20"},
        {"slug": "Pie time 2", "tags": ["picoCTF", "PIE", "format string"], "date": "2025-07-21"},
        {"slug": "Ropfu", "tags": ["picoCTF", "ROP", "buffer overflow", "ret2syscall"], "date": "2025-07-22"},
        {"slug": "Here's a libc", "tags": ["picoCTF", "ret2libc", "ROP"], "date": "2025-07-23"},
        {"slug": "Buffer overflow 3", "tags": ["picoCTF", "buffer overflow", "canary", "ret2win"], "date": "2025-07-24"},
        {"slug": "Function overwrite", "tags": ["picoCTF", "function overwrite", "array indexing"], "date": "2025-07-25"},
        {"slug": "Guessing game 2", "tags": ["picoCTF", "format string", "canary", "ret2libc"], "date": "2025-07-31"},
        {"slug": "Unsubscriptions are free", "tags": ["picoCTF", "use after free", "function pointer"], "date": "2025-08-03"},
        {"slug": "Tic-tac", "tags": ["picoCTF", "race condition"], "date": "2025-08-04"},
        {"slug": "Cache me outside", "tags": ["picoCTF", "tcache", "heap"], "date": "2025-09-16"},
        {"slug": "Filtered shellcode", "tags": ["picoCTF", "shellcode"], "date": "2025-09-18"},
        {"slug": "Affirmation bot", "tags": ["WWCTF", "format string", "buffer overflow"], "date": "2025-07-29"},
        {"slug": "Callme (x64)", "tags": ["RopEmporium", "ROP"], "date": "2025-08-07"},
        {"slug": "Write4 (x64)", "tags": ["RopEmporium", "ROP"], "date": "2025-08-08"},
        {"slug": "Badchars (x64)", "tags": ["RopEmporium", "ROP", "badchars"], "date": "2025-08-09"},
        {"slug": "Fluff (x64)", "tags": ["RopEmporium", "ROP"], "date": "2025-08-11"},
        {"slug": "Pivot (x64)", "tags": ["RopEmporium", "ROP", "stack pivot"], "date": "2025-08-12"},
        {"slug": "Ret2csu (x64)", "tags": ["RopEmporium", "ROP", "ret2csu"], "date": "2025-09-14"},
        {"slug": "Saving the environment", "tags": ["snakeCTF", "seccomp", "timing", "shellcode"], "date": "2025-09-08"},
        {"slug": "Addition", "tags": ["imaginaryCTF", "got", "ret2libc"], "date": "2025-09-07"},
        {"slug": "Start", "tags": ["pwnable", "shellcode", "ret2shellcode"], "date": "2025-10-14"},
        {"slug": "Armeria", "tags": ["NavajaNegra", "ret2win"], "date": "2025-10-17"},
        {"slug": "4enRaya", "tags": ["NavajaNegra", "OOB", "got"], "date": "2025-10-17"},
        {"slug": "Input Injection 1", "tags": ["picoCTF", "buffer overflow"], "date": "2025-12-09"},
        {"slug": "Input Injection 2", "tags": ["picoCTF", "buffer overflow", "heap"], "date": "2025-12-09"},
        {"slug": "Wine", "tags": ["picoCTF", "buffer overflow", "ret2win", "windows"], "date": "2025-12-11"},
        {"slug": "Stack Cache", "tags": ["picoCTF", "stack leak", "ROP"], "date": "2025-12-11"},
        {"slug": "Babygame02", "tags": ["picoCTF", "OOB"], "date": "2025-12-14"},
        {"slug": "Handoff", "tags": ["picoCTF", "OOB", "ret2reg", "shellcode"], "date": "2025-12-17"},
        {"slug": "Zero_to_hero", "tags": ["picoCTF", "tcache", "null byte", "ret2libc", "heap"], "date": "2025-12-20"}
    ]
};

const BASE_DIR = './src/content';

function migrate() {
    console.log('🔄 Iniciando migración de metadatos a Frontmatter...');

    for (const [section, items] of Object.entries(DATA)) {
        console.log(`📂 Procesando sección: ${section}`);
        
        for (const item of items) {
            const filePath = path.join(BASE_DIR, section, `${item.slug}.md`);
            
            if (fs.existsSync(filePath)) {
                let content = fs.readFileSync(filePath, 'utf8');
                
                // Verificar si ya tiene frontmatter
                if (content.startsWith('---')) {
                    console.log(`⚠️  ${item.slug}.md ya tiene cabecera. Saltando.`);
                    continue;
                }

                // Crear cabecera YAML
                const frontmatter = [
                    '---',
                    `title: "${item.slug}"`,
                    `date: "${item.date}"`,
                    `tags: [${item.tags.map(t => `"${t}"`).join(', ')}]`,
                    '---',
                    '',
                    ''
                ].join('\n');

                // Inyectar al principio del archivo
                fs.writeFileSync(filePath, frontmatter + content);
                console.log(`✅ ${item.slug}.md actualizado.`);
            } else {
                console.log(`❌ No encontrado: ${filePath}`);
            }
        }
    }
}

migrate();