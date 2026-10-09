import {
    analyze, parseBadBytes, pythonScript, hexByte, TOTAL,
} from './badchar.js';

const el = id => document.getElementById(id);

/* Los textos que se ven en pantalla, en los dos idiomas. Cual toca lo dice el
   lang del <html>, que lo pone el generador segun de que version sea la pagina. */
const EN = document.documentElement.lang === 'en';
const t = (es, en) => (EN ? en : es);

const badInput = el('badInput');
const hostInput = el('hostInput');
const portInput = el('portInput');
const preInput = el('preInput');
const sufInput = el('sufInput');
const pyScript = el('pyScript');
const dump = el('dumpInput');
const fmtTag = el('fmtTag');
const incList = el('incList');
const incCount = el('incCount');
const mapa = el('mapa');

/* Un tipo de incidencia por etiqueta. El texto es corto a proposito: la fila ya
   lleva el byte y lo que llego, asi que la etiqueta solo tiene que decir que le
   paso. */
const TAGS = {
    eaten: [t('COMIDO', 'EATEN'), 'tag-danger', t('se envió y no está en el volcado', 'sent and not in the dump')],
    changed: [t('CAMBIADO', 'CHANGED'), 'tag-danger', t('llegó otro byte en su sitio', 'another byte arrived in its place')],
    expanded: [t('EXPANDIDO', 'EXPANDED'), 'tag-fix', t('llegó convertido en varios bytes', 'arrived turned into several bytes')],
    missing: [t('NO ESTÁ', 'MISSING'), 'tag-fix', t('no está en el volcado, pero va antes del primer byte reconocido: puede que el volcado empiece más adentro', 'not in the dump, but it sits before the first byte recognised: the dump may start further in')],
    cut: [t('CORTE', 'CUT'), 'tag-danger', t('a partir de aquí el volcado ya no es el buffer', 'from here on the dump is no longer the buffer')],
    short: [t('SE ACABA', 'ENDS'), 'tag-info', t('el volcado se termina aquí, no hay nada detrás que mirar', 'the dump ends here, there is nothing behind to look at')],
};

const ESTADOS = {
    ok: t('llega', 'arrives'),
    skip: t('fuera', 'out'),
    none: t('sin ver', 'unseen'),
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const hx = b => '0x' + hexByte(b);
const lista = bs => bs.map(hexByte).join(' ');

/* ------------------------------------------------------------- la blacklist */

function badSetActual() {
    return parseBadBytes(badInput.value);
}

function escribeBlacklist(set) {
    badInput.value = [...set].sort((a, b) => a - b).map(hexByte).join(' ');
    update();
}

function anade(bytes) {
    const set = badSetActual();
    for (const b of bytes) set.add(b);
    escribeBlacklist(set);
}

function alterna(byte) {
    const set = badSetActual();
    if (set.has(byte)) set.delete(byte); else set.add(byte);
    escribeBlacklist(set);
}

/* -------------------------------------------------------------- las salidas */

/* Las incidencias seguidas del mismo tipo y sin bytes recibidos se juntan en una
   fila con su rango. Si no, un volcado que empieza mas adentro del buffer suelta
   treinta filas iguales y tapa la que importa. */
function agrupa(issues) {
    const out = [];
    for (const it of issues) {
        const ult = out[out.length - 1];
        const juntable = ult && ult.kind === it.kind && !it.got.length && !ult.got.length
            && it.offset === ult.offset + ult.bytes.length;
        if (juntable) { ult.bytes.push(it.byte); continue; }
        out.push({ ...it, bytes: [it.byte] });
    }
    return out;
}

function renderIncidencias(r) {
    if (!r.ok) {
        incList.innerHTML = `<div class="inc"><span class="chunk-comment"># ${t('pega el volcado para ver dónde se corta...', 'paste the dump to see where it breaks...')}</span></div>`;
        return;
    }
    if (r.head === -1) {
        incList.innerHTML = `<div class="inc inc-corte"><span class="inc-byte">?</span>`
            + `<span class="chunk-tag tag-danger">${t('OTRA COSA', 'NOT IT')}</span>`
            + `<span class="inc-got">${t('en el volcado no hay tres bytes seguidos de este buffer', 'the dump has no three consecutive bytes of this buffer')}</span></div>`;
        return;
    }

    const filas = agrupa(r.issues).map(it => {
        const [texto, clase, ayuda] = TAGS[it.kind];
        const rango = it.bytes.length > 1
            ? `${hx(it.bytes[0])}-${hx(it.bytes[it.bytes.length - 1])}`
            : hx(it.byte);
        const donde = it.bytes.length > 1
            ? `${it.bytes.length} ${t('bytes', 'bytes')}`
            : `+${hx(it.offset)}`;
        const llego = it.got.length
            ? `<span class="inc-got">${t('llegó', 'got')} <b>${lista(it.got)}</b></span>` : '';
        return `<div class="inc${it.kind === 'cut' ? ' inc-corte' : ''}">
            <span class="inc-byte">${rango}</span>
            <span class="inc-off">${donde}</span>
            <span class="chunk-tag ${clase}" title="${escapeHtml(ayuda)}">${texto}</span>
            ${llego}
            <button class="btn inc-add" data-bytes="${it.bytes.join(',')}" title="${t('añadir a la blacklist y rehacer el buffer', 'add to the blacklist and rebuild the buffer')}">blacklist</button>
        </div>`;
    });

    // sin incidencias no se escribe nada: el contador de la cabecera y el mapa en
    // verde ya lo dicen, y una linea de "todo bien" solo ocupa sitio
    incList.innerHTML = filas.join('');
}

function renderMapa(r) {
    const nib = '0123456789abcdef';
    const celdas = [`<span class="mcab"></span>`];
    for (const n of nib) celdas.push(`<span class="mcab">${n}</span>`);
    for (let fila = 0; fila < 16; fila++) {
        celdas.push(`<span class="mcab">${nib[fila]}_</span>`);
        for (let col = 0; col < 16; col++) {
            const b = fila * 16 + col;
            const est = r.state[b];
            const inc = r.issues.find(x => x.byte === b);
            const tag = est && TAGS[est] ? TAGS[est][0] : (ESTADOS[est] || '');
            const llego = inc && inc.got.length ? ` · ${t('llegó', 'got')} ${lista(inc.got)}` : '';
            celdas.push(`<button type="button" class="celda ${est || 'pend'}" data-byte="${b}"`
                + ` title="${hx(b)}${tag ? ` · ${escapeHtml(tag)}` : ''}${escapeHtml(llego)}">${hexByte(b)}</button>`);
        }
    }
    mapa.innerHTML = celdas.join('');
}

function renderFormato(fmt) {
    if (!fmt) { fmtTag.textContent = '-'; fmtTag.removeAttribute('title'); return; }
    const partes = [`${fmt.group}b`];
    if (fmt.swapped) partes.push('LE');
    if (fmt.narrowed) partes.push('UTF-16');
    fmtTag.textContent = `${partes.join(' ')} · ${fmt.bytes.length} bytes`;
    fmtTag.title = t(
        `grupos de ${fmt.group} byte(s), ${fmt.swapped ? 'leídos del revés' : 'leídos tal cual'}`
        + `${fmt.narrowed ? ', quitando el relleno de UTF-16' : ''}, sobre ${fmt.lines} línea(s)`,
        `groups of ${fmt.group} byte(s), ${fmt.swapped ? 'read backwards' : 'read as they are'}`
        + `${fmt.narrowed ? ', dropping the UTF-16 padding' : ''}, over ${fmt.lines} line(s)`);
}

function update() {
    const badSet = badSetActual();

    pyScript.textContent = pythonScript({
        host: hostInput.value || '127.0.0.1',
        port: portInput.value || '0',
        prefix: preInput.value,
        suffix: sufInput.value,
        badSet,
    });

    const r = analyze(dump.value, badSet);
    renderFormato(r.fmt);
    renderIncidencias(r);
    renderMapa(r);
    incCount.textContent = `${r.matched}/${TOTAL - badSet.size}`;
}

/* ------------------------------------------------------------------ eventos */

async function copyText(text, btn) {
    if (!text) return;
    const original = btn.textContent;
    try {
        await navigator.clipboard.writeText(text);
        btn.textContent = t('Copiado', 'Copied');
    } catch (e) {
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

for (const ctl of [badInput, hostInput, portInput, preInput, sufInput, dump]) {
    ctl.addEventListener('input', update);
}

document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(el(btn.dataset.copy).textContent, btn));
});

el('clearBtn').addEventListener('click', () => { dump.value = ''; update(); });
el('resetBtn').addEventListener('click', () => escribeBlacklist(new Set()));

incList.addEventListener('click', ev => {
    const btn = ev.target.closest('.inc-add');
    if (btn) anade(btn.dataset.bytes.split(',').map(Number));
});

mapa.addEventListener('click', ev => {
    const celda = ev.target.closest('.celda');
    if (celda) alterna(Number(celda.dataset.byte));
});

update();
