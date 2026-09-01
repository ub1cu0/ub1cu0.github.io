import { Keystone, loadKeystone, Const } from './vendor/keystone.mjs';

/*
 * ShellCrafter
 *
 * El bloque se ensambla COMPLETO de una sola pasada, que es lo unico que permite
 * resolver labels y saltos relativos. El desglose por linea se deriva despues
 * ensamblando prefijos y verificando byte a byte que cada prefijo coincide con el
 * bloque final. Si un prefijo no compila (referencia hacia delante) las lineas se
 * agrupan hasta el siguiente corte fiable, asi que lo que se muestra nunca miente.
 */

const el = id => document.getElementById(id);

const asmInput = el('asmInput');
const hexOutput = el('hexOutput');
const archSelect = el('archSelect');
const badCharsInput = el('badCharsInput');
const byteCountLabel = el('byteCount');
const statusBox = el('statusBox');

/* Los avisos que se ven en pantalla van en los dos idiomas. Cual toca lo dice el
   lang del <html>, que lo pone el generador segun de que version sea la pagina. */
const EN = document.documentElement.lang === 'en';
const t = (es, en) => (EN ? en : es);
const presetSelect = el('presetSelect');
const formatSelect = el('formatSelect');
const shellcodeOut = el('shellcodeOut');
const copyFormatBtn = el('copyFormatBtn');

const BE = Const.KS_MODE_BIG_ENDIAN;

/* Arquitecturas candidatas. El WASM de keystone no trae todas compiladas, asi que
   la lista real se decide en runtime probando a abrir cada una. */
const TARGETS = [
    { id: 'x86_16', label: 'x86 (16 bits)', arch: Const.KS_ARCH_X86, mode: Const.KS_MODE_16 },
    { id: 'x86', label: 'x86 (32 bits)', arch: Const.KS_ARCH_X86, mode: Const.KS_MODE_32 },
    { id: 'x64', label: 'x86-64', arch: Const.KS_ARCH_X86, mode: Const.KS_MODE_64 },
    { id: 'arm', label: 'ARM (32 bits)', arch: Const.KS_ARCH_ARM, mode: Const.KS_MODE_ARM },
    { id: 'armbe', label: 'ARM (big endian)', arch: Const.KS_ARCH_ARM, mode: Const.KS_MODE_ARM | BE },
    { id: 'thumb', label: 'ARM Thumb', arch: Const.KS_ARCH_ARM, mode: Const.KS_MODE_THUMB },
    { id: 'thumbbe', label: 'ARM Thumb (big endian)', arch: Const.KS_ARCH_ARM, mode: Const.KS_MODE_THUMB | BE },
    { id: 'arm64', label: 'ARM64 / AArch64', arch: Const.KS_ARCH_ARM64, mode: Const.KS_MODE_LITTLE_ENDIAN },
];

/*
 * Los presets van en la sintaxis que Keystone acepta tal cual, para que carguen
 * igual con la casilla de compatibilidad NASM puesta o quitada. Esa casilla es
 * para el codigo que uno pega de un tutorial, no para esto.
 */
const PRESETS = {
    x86_16: [{
        name: 'BIOS teletipo + salida a DOS',
        code: `; BIOS teletipo + salida a DOS
mov ah, 0x0e
mov al, 0x68
int 0x10
mov al, 0x69
int 0x10
mov ax, 0x4c00
int 0x21`,
    }],

    x86: [{
        name: 'execve /bin//sh (25 B, sin nulls)',
        code: `; execve("/bin//sh", ["/bin//sh"], NULL) - 25 bytes, sin null bytes
xor eax, eax
push eax          ; terminador de la cadena
push 0x68732f2f   ; "//sh"
push 0x6e69622f   ; "/bin"
mov ebx, esp      ; ebx -> "/bin//sh"
push eax
mov edx, esp      ; envp = NULL
push ebx
mov ecx, esp      ; argv = { ruta, NULL }
mov al, 0xb       ; __NR_execve
int 0x80`,
    }, {
        name: 'jmp/call/pop (labels)',
        code: `; la direccion de la cadena sale del call, sin hardcodearla
jmp go
shell:
pop ebx           ; ebx -> "/bin/sh"
xor eax, eax
push eax
push ebx
mov ecx, esp
xor edx, edx
mov al, 0xb
int 0x80
go:
call shell
.asciz "/bin/sh"`,
    }],

    x64: [{
        name: 'execve /bin//sh (25 B, sin nulls)',
        code: `; execve("/bin//sh", NULL, NULL) - 25 bytes, sin null bytes
xor rsi, rsi
push rsi
mov rdi, 0x68732f2f6e69622f
push rdi
push rsp
pop rdi           ; rdi -> "/bin//sh"
xor rdx, rdx
push 0x3b         ; __NR_execve
pop rax
syscall`,
    }, {
        name: 'jmp/call/pop (labels)',
        code: `; la direccion de la cadena sale del call, sin hardcodearla
jmp go
shell:
pop rdi           ; rdi -> "/bin/sh"
xor rsi, rsi
xor rdx, rdx
push 0x3b
pop rax
syscall
go:
call shell
.asciz "/bin/sh"`,
    }],

    arm: [{
        name: 'ARM a Thumb + execve',
        code: `; salta a Thumb y ejecuta execve("/bin/sh")
.code 32
add r3, pc, #1
bx r3
.code 16
mov r0, pc
adds r0, #8
subs r1, r1, r1
subs r2, r2, r2
movs r7, #11
svc #1
.ascii "/bin/sh"`,
    }],

    thumb: [{
        name: 'execve /bin/sh',
        code: `; Thumb: execve("/bin/sh", NULL, NULL)
mov r0, pc
adds r0, #8
subs r1, r1, r1
subs r2, r2, r2
movs r7, #11
svc #1
.ascii "/bin/sh"`,
    }],

    arm64: [{
        name: 'execve /bin/sh',
        code: `; AArch64: execve("/bin/sh", NULL, NULL)
mov x8, #221      ; __NR_execve
adr x0, cmd
mov x1, xzr
mov x2, xzr
svc #0
cmd:
.asciz "/bin/sh"`,
    }],
};

PRESETS.armbe = PRESETS.arm;
PRESETS.thumbbe = PRESETS.thumb;

const presetsFor = id => PRESETS[id] || [];
const isPresetLoaded = code => {
    const t = code.trim();
    return !t || Object.values(PRESETS).some(list => list.some(p => p.code.trim() === t));
};

let handles = new Map();   // id -> instancia de Keystone reutilizada
let available = [];
let debounceTimer = null;
let lastBytes = new Uint8Array(0);

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setStatus(msg, kind) {
    if (!msg) { statusBox.style.display = 'none'; return; }
    statusBox.textContent = msg;
    statusBox.className = 'status-bar ' + (kind === 'error' ? 'status-error' : kind === 'warn' ? 'status-warn' : 'status-ok');
    statusBox.style.display = 'block';
}

/*
 * Quita los comentarios respetando lo que va entre comillas.
 *
 * Hay que hacerlo aqui porque Keystone no es coherente entre arquitecturas:
 * en x86 el comentario es "#" y el ";" separa instrucciones ("nop; nop" son dos
 * nop). En ARM no vale ninguno detras de una instruccion, y en ARM64 un "//" al
 * final se come la instruccion entera y devuelve cero bytes sin dar error.
 * Limpiandolos antes, aqui valen ";", "#" y "//" en todas, y "@" en ARM.
 *
 * El unico cuidado es que en ARM "#" prefija inmediatos (mov r0, #1), asi que
 * ahi solo cuenta como comentario si abre la linea o si le sigue un espacio.
 */
function stripComment(line, armSyntax) {
    let out = '', quote = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            out += c;
            if (c === '\\' && i + 1 < line.length) { out += line[++i]; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; out += c; continue; }
        if (c === ';') break;
        if (c === '/' && line[i + 1] === '/') break;
        if (c === '@' && armSyntax) break;
        if (c === '#') {
            const next = line[i + 1];
            if (!armSyntax || !out.trim() || next === undefined || next === ' ' || next === '\t') break;
        }
        out += c;
    }
    return out.trimEnd();
}

/* Traduce la sintaxis NASM que se ve en todo el material de shellcoding a la que
   entiende Keystone (LLVM MC). "jmp short x" y "db" no los acepta tal cual. */
function nasmCompat(line, notes) {
    let out = line;

    const noShort = out.replace(/\b(j[a-z]{1,3}|loop[a-z]{0,2})\s+(short|near)\s+/gi, (m, op, kw) => {
        notes.add(`"${kw}" ${t('no existe en Keystone, lo he quitado (el salto corto ya se elige solo)', 'does not exist in Keystone, so I dropped it (the short jump is picked automatically)')}`);
        return op + ' ';
    });
    out = noShort;

    const m = out.match(/^(\s*)(db|dw|dd|dq)\s+(.+)$/i);
    if (m) {
        const dir = { db: '.byte', dw: '.short', dd: '.long', dq: '.quad' }[m[2].toLowerCase()];
        const rest = m[3].trim();
        if (/^["']/.test(rest)) {
            // db "cadena", 0  ->  .ascii "cadena" + .byte 0
            const parts = splitArgs(rest);
            const strs = parts.filter(p => /^["']/.test(p));
            const nums = parts.filter(p => p && !/^["']/.test(p));
            out = `${m[1]}.ascii ${strs.join(', ')}`;
            if (nums.length) out += `\n${m[1]}.byte ${nums.join(', ')}`;
            notes.add(`"${m[2]}" ${t('con cadena traducido a .ascii/.byte', 'with a string turned into .ascii/.byte')}`);
        } else {
            out = `${m[1]}${dir} ${rest}`;
            notes.add(`"${m[2]}" ${t('traducido a', 'turned into')} "${dir}"`);
        }
    }
    return out;
}

function splitArgs(s) {
    const parts = [];
    let cur = '', quote = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            cur += c;
            if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; cur += c; continue; }
        if (c === ',') { parts.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

function getHandle(target) {
    if (handles.has(target.id)) return handles.get(target.id);
    const k = new Keystone(target.arch, target.mode);
    handles.set(target.id, k);
    return k;
}

function parseBadChars(str) {
    const set = new Set();
    for (const tok of str.split(/[\s,]+/)) {
        if (!tok) continue;
        const n = parseInt(tok.replace(/^(0x|\\x)/i, ''), 16);
        if (!isNaN(n) && n >= 0 && n <= 0xff) set.add(n);
    }
    return set;
}

/*
 * Ensambla el bloque y devuelve los bytes finales mas el reparto por lineas.
 * cuts[i] = offset dentro del bloque justo despues de la linea i, o null si no se
 * ha podido determinar de forma fiable.
 */
function assembleBlock(k, lines) {
    const full = k.asm(lines.join('\n'));
    const cuts = new Array(lines.length).fill(null);

    for (let i = 0; i < lines.length - 1; i++) {
        let p;
        try {
            p = k.asm(lines.slice(0, i + 1).join('\n'));
        } catch (e) {
            continue;   // referencia hacia delante: este corte no se puede fijar
        }
        if (p.length > full.length) continue;
        let same = true;
        for (let j = 0; j < p.length && same; j++) if (p[j] !== full[j]) same = false;
        if (same) cuts[i] = p.length;
    }
    if (lines.length) cuts[lines.length - 1] = full.length;

    const groups = [];
    let start = 0, prev = 0;
    for (let i = 0; i < lines.length; i++) {
        if (cuts[i] === null) continue;
        groups.push({ from: start, to: i, bytes: full.subarray(prev, cuts[i]) });
        prev = cuts[i];
        start = i + 1;
    }
    return { full, groups };
}

/* Cuando el bloque entero no compila, se prueba cada linea por su cuenta para
   señalar la que tiene el fallo real. Las que solo fallan por un label se ignoran. */
function findBadLines(k, lines) {
    const bad = [];
    for (let i = 0; i < lines.length; i++) {
        const src = lines[i].trim();
        if (!src || src.endsWith(':') || src.startsWith('.')) continue;
        try {
            k.asm(lines[i]);
        } catch (e) {
            const msg = String(e.message || '');
            const looksLikeLabel = /symbol|operand|fixup|relocation/i.test(msg);
            bad.push({ line: i, msg: msg.replace('Failed to assemble, error: ', ''), soft: looksLikeLabel });
        }
    }
    return bad;
}

function fmtByte(b) { return b.toString(16).padStart(2, '0'); }

function renderBytes(bytes, badChars) {
    let html = '';
    for (const b of bytes) {
        const cls = badChars.has(b) ? 'byte-bad' : (b === 0 ? 'byte-null' : 'byte-ok');
        html += `<span class="${cls}">${fmtByte(b)}</span> `;
    }
    return html;
}

function formatShellcode(bytes, fmt) {
    const arr = Array.from(bytes);
    const esc = arr.map(b => '\\x' + fmtByte(b)).join('');
    switch (fmt) {
        case 'escaped': return `"${esc}"`;
        case 'raw': return esc;
        case 'hex': return arr.map(fmtByte).join('');
        case 'hexspace': return arr.map(fmtByte).join(' ');
        case 'python': return `shellcode = b"${esc}"`;
        case 'c': {
            const lines = [];
            for (let i = 0; i < arr.length; i += 12) {
                lines.push('    "' + arr.slice(i, i + 12).map(b => '\\x' + fmtByte(b)).join('') + '"');
            }
            return `unsigned char shellcode[] =\n${lines.join('\n') || '    ""'};\nsize_t shellcode_len = ${arr.length};`;
        }
        case 'carray': return `unsigned char shellcode[${arr.length}] = { ${arr.map(b => '0x' + fmtByte(b)).join(', ')} };`;
        default: return esc;
    }
}

function assemble() {
    const target = available.find(t => t.id === archSelect.value) || available[0];
    if (!target) return;

    const badChars = parseBadChars(badCharsInput.value || '');
    const armSyntax = target.arch === Const.KS_ARCH_ARM || target.arch === Const.KS_ARCH_ARM64;
    const rawLines = asmInput.value.split('\n');
    const notes = new Set();
    const srcLines = rawLines.map(l => nasmCompat(stripComment(l, armSyntax), notes));

    if (!asmInput.value.trim()) {
        hexOutput.innerHTML = `<div class="output-line"><span class="line-num">-</span><span class="hex-bytes empty">${t('Escribe ensamblador para ver los bytes...', 'Write some assembly to see the bytes...')}</span></div>`;
        byteCountLabel.textContent = '0 bytes';
        shellcodeOut.textContent = '';
        lastBytes = new Uint8Array(0);
        setStatus(null);
        return;
    }

    let k;
    try {
        k = getHandle(target);
    } catch (e) {
        setStatus(`${t('Esta arquitectura no esta compilada en el WASM', 'This architecture is not compiled into the WASM')}: ${e.message}`, 'error');
        return;
    }

    let result;
    try {
        result = assembleBlock(k, srcLines);
    } catch (e) {
        // El bloque no compila. Se marca la linea culpable.
        const bad = findBadLines(k, srcLines);
        const hard = bad.filter(b => !b.soft);
        const show = hard.length ? hard : bad;
        let html = '';
        rawLines.forEach((line, i) => {
            const fail = show.find(b => b.line === i);
            html += `<div class="output-line${fail ? ' line-failed' : ''}"><span class="line-num">${i + 1}</span>`;
            html += fail
                ? `<span class="hex-bytes err">${escapeHtml(fail.msg)}</span>`
                : `<span class="hex-bytes empty">·</span>`;
            html += '</div>';
        });
        hexOutput.innerHTML = html;
        byteCountLabel.textContent = 'error';
        shellcodeOut.textContent = '';
        lastBytes = new Uint8Array(0);
        const global = String(e.message || '').replace('Failed to assemble, error: ', '');
        setStatus(show.length
            ? `${t('No ensambla. Revisa la linea', 'It does not assemble. Check line')} ${show[0].line + 1}: ${show[0].msg}`
            : `${t('No ensambla', 'It does not assemble')}: ${global}`, 'error');
        return;
    }

    const { full, groups } = result;
    lastBytes = full;

    let html = '';
    for (const g of groups) {
        const multi = g.to > g.from;
        const num = multi ? `${g.from + 1}-${g.to + 1}` : `${g.from + 1}`;
        const text = rawLines.slice(g.from, g.to + 1).map(s => s.trim()).filter(Boolean).join(' · ');
        const isMeta = !g.bytes.length;
        html += `<div class="output-line${multi ? ' line-group' : ''}"><span class="line-num">${num}</span>`;
        if (isMeta) {
            html += `<span class="hex-bytes empty" title="${escapeHtml(text)}">·</span>`;
        } else {
            html += `<span class="hex-bytes">${renderBytes(g.bytes, badChars)}</span>`;
            if (multi) {
                html += `<span class="group-note" title="${t('El salto apunta hacia delante, asi que el corte por linea no se puede fijar', 'The jump points forward, so the split by line cannot be pinned down')}">${g.to - g.from + 1} ${t('lineas', 'lines')}</span>`;
            }
        }
        html += '</div>';
    }
    hexOutput.innerHTML = html || `<div class="output-line"><span class="line-num">-</span><span class="hex-bytes empty">${t('Sin bytes', 'No bytes')}</span></div>`;

    byteCountLabel.textContent = `${full.length} bytes`;

    // Resumen de bad chars encontrados
    shellcodeOut.textContent = formatShellcode(full, formatSelect.value);

    if (notes.size) setStatus([...notes].join('. '), 'warn');
    else setStatus(null);
}

function scheduleAssemble() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(assemble, 120);
}

async function copyText(text, btn) {
    const original = btn.textContent;
    try {
        await navigator.clipboard.writeText(text);
        btn.textContent = t('Copiado', 'Copied');
    } catch (e) {
        // Fallback para contextos sin permiso de portapapeles
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); btn.textContent = t('Copiado', 'Copied'); }
        catch (e2) { btn.textContent = 'Error'; }
        document.body.removeChild(ta);
    }
    setTimeout(() => { btn.textContent = original; }, 1200);
}

async function init() {
    setStatus(t('Cargando el ensamblador (WASM)...', 'Loading the assembler (WASM)...'), 'ok');
    try {
        await loadKeystone();
    } catch (e) {
        setStatus(t('No he podido cargar Keystone: ', 'I could not load Keystone: ') + e.message, 'error');
        asmInput.placeholder = '; el ensamblador no ha cargado';
        return;
    }

    // Se prueba de verdad cada arquitectura. El WASM no trae MIPS, PPC, SPARC,
    // SystemZ ni Hexagon compilados, asi que no se ofrecen opciones que no van.
    const unsupported = [];
    for (const t of TARGETS) {
        try {
            const k = new Keystone(t.arch, t.mode);
            k.asm('');
            handles.set(t.id, k);
            available.push(t);
        } catch (e) {
            unsupported.push(t.label);
        }
    }

    archSelect.innerHTML = available
        .map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`)
        .join('');
    if (available.some(t => t.id === 'x86')) archSelect.value = 'x86';
    fillPresets(archSelect.value);

    const v = Keystone.version();
    let msg = `Keystone ${v.major}.${v.minor} ${t('listo', 'ready')}. ${available.length} ${t('arquitecturas disponibles', 'architectures available')}.`;
    if (unsupported.length) msg += ` Sin soporte en este build: ${unsupported.join(', ')}.`;
    setStatus(msg, 'ok');
    setTimeout(() => { if (statusBox.classList.contains('status-ok')) setStatus(null); }, 6000);

    asmInput.placeholder = '; escribe tu ensamblador aqui...';
    if (!asmInput.value.trim()) asmInput.value = presetsFor(archSelect.value)[0]?.code || '';
    syncPresetSelect();
    assemble();
}

asmInput.addEventListener('input', () => { syncPresetSelect(); scheduleAssemble(); });
badCharsInput.addEventListener('input', scheduleAssemble);
formatSelect.addEventListener('change', () => { shellcodeOut.textContent = formatShellcode(lastBytes, formatSelect.value); });

/* Rellena el desplegable con los presets de la arquitectura activa. */
function fillPresets(id) {
    const list = presetsFor(id);
    presetSelect.innerHTML = '<option value="">Cargar preset…</option>'
        + list.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
    presetSelect.disabled = !list.length;
}

/* El desplegable muestra el preset que hay cargado, y vuelve al texto de por
   defecto en cuanto el codigo deja de coincidir con el. Asi tambien se puede
   volver a elegir el mismo preset despues de haberlo tocado. */
function syncPresetSelect() {
    const list = presetsFor(archSelect.value);
    const cur = asmInput.value.trim();
    const idx = list.findIndex(p => p.code.trim() === cur);
    presetSelect.value = idx >= 0 ? String(idx) : '';
}

archSelect.addEventListener('change', () => {
    const id = archSelect.value;
    // Si lo que hay es un preset (o nada), se cambia por el de la arquitectura nueva.
    // Si es codigo escrito a mano no se toca.
    const replace = isPresetLoaded(asmInput.value);
    fillPresets(id);
    if (replace) asmInput.value = presetsFor(id)[0]?.code || '';
    syncPresetSelect();
    assemble();
});

presetSelect.addEventListener('change', () => {
    const p = presetsFor(archSelect.value)[Number(presetSelect.value)];
    if (!p) return;
    asmInput.value = p.code;
    assemble();
});

copyFormatBtn.addEventListener('click', () => copyText(shellcodeOut.textContent, copyFormatBtn));

init();
