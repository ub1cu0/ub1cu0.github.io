import {
    toBytes, parseBadBytes, hexByte,
    buildAsmBlock, suggestPathPadding,
} from './endian.js';

const el = id => document.getElementById(id);

/* Los textos que se ven en pantalla, en los dos idiomas. Cual toca lo dice el
   lang del <html>, que lo pone el generador segun de que version sea la pagina. */
const EN = document.documentElement.lang === 'en';
const t = (es, en) => (EN ? en : es);

const input = el('inputText');
const modeSelect = el('modeSelect');
const wordSelect = el('wordSelect');
const targetSelect = el('targetSelect');
const memOption = el('memOption');
const badInput = el('badInput');
const avoidChk = el('avoidBad');
const termChk = el('terminator');
const hexStream = el('hexStream');
const hexStreamRev = el('hexStreamRev');
const leWords = el('leWords');
const beWords = el('beWords');
const leAsm = el('leAsm');
const beAsm = el('beAsm');
const altBtn = el('altBtn');

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Una caja por instruccion. El mnemonico se separa de los operandos solo para
   pintarlo distinto, y los inmediatos en hex se resaltan. */
function renderAsm(container, lines) {
    const insns = lines.filter(l => l.kind === 'insn');
    if (!insns.length) {
        container.innerHTML = '<div class="chunk-item"><span class="chunk-comment"># escribe para ver el bloque...</span></div>';
        return;
    }
    container.innerHTML = insns.map(l => {
        const m = l.text.trim().match(/^(\S+)\s*(.*)$/);
        const mn = m ? m[1] : l.text.trim();
        const ops = m ? m[2] : '';
        const opsHtml = escapeHtml(ops).replace(/(0x[0-9a-f]+)/gi, '<span class="asm-imm">$1</span>');
        const tags = (l.tags || []).map(t =>
            `<span class="chunk-tag tag-${t.kind}"${t.title ? ` title="${escapeHtml(t.title)}"` : ''}>`
            + `${escapeHtml(t.text)}</span>`).join('');
        return `<div class="chunk-item">
            <span class="asm-text"><span class="asm-mn">${escapeHtml(mn)}</span>${ops ? ' ' + opsHtml : ''}</span>
            ${l.comment ? `<span class="chunk-comment"># ${escapeHtml(l.comment)}</span>` : ''}
            ${tags ? `<span class="tag-row">${tags}</span>` : ''}
        </div>`;
    }).join('');
}

function update() {
    const raw = input.value;
    const mode = modeSelect.value;
    const wordSize = Number(wordSelect.value);
    const target = targetSelect.value;
    const badSet = parseBadBytes(badInput.value);
    const avoidBad = avoidChk.checked;
    const terminator = termChk.checked;

    // El registro destino va en la propia opcion, que es donde importa
    memOption.textContent = `Memoria (mov [${wordSize === 8 ? 'rax' : 'eax'}])`;

    const fill = html => {
        hexStream.textContent = '-';
        hexStreamRev.textContent = '-';
        leWords.innerHTML = html;
        beWords.innerHTML = html;
        leAsm.textContent = '';
        beAsm.textContent = '';
    };
    const empty = () => fill('<div class="chunk-item"><span class="chunk-comment"># escribe para ver el bloque...</span></div>');

    if (!raw) return empty();

    const bytes = toBytes(raw, mode);
    if (bytes === null) {
        input.classList.add('invalid');
        fill(`<div class="chunk-item chunk-error"><span class="asm-text">${t('Hex no válido', 'Not valid hex')}</span>`
            + `<span class="chunk-comment"># ${t('usa bytes en hex, por ejemplo 2f 62 69 6e o 2f62696e', 'use hex bytes, for example 2f 62 69 6e or 2f62696e')}</span></div>`);
        return;
    }
    input.classList.remove('invalid');
    if (!bytes.length) return empty();

    hexStream.textContent = Array.from(bytes).map(hexByte).join(' ');
    hexStreamRev.textContent = Array.from(bytes).reverse().map(hexByte).join(' ');

    const label = mode === 'hex' ? 'el valor' : `"${raw}"`;
    const le = buildAsmBlock(bytes, { wordSize, endian: 'le', badSet, avoidBad, terminator, label, target });
    const be = buildAsmBlock(bytes, { wordSize, endian: 'be', badSet, avoidBad, terminator, label, target });

    renderAsm(leWords, le.lines);
    renderAsm(beWords, be.lines);
    // Ocultos: son la fuente del boton de copiar
    leAsm.textContent = le.text;
    beAsm.textContent = be.text;

    // La ruta alineada sin relleno se ofrece como atajo, no como sermon
    const alt = le.pad && mode === 'text' ? suggestPathPadding(raw, wordSize) : null;
    if (alt) {
        altBtn.textContent = `usar ${alt}`;
        altBtn.dataset.alt = alt;
        altBtn.hidden = false;
    } else {
        altBtn.hidden = true;
    }
}

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

for (const ctl of [input, modeSelect, wordSelect, targetSelect, badInput, avoidChk, termChk]) {
    ctl.addEventListener(ctl === input || ctl === badInput ? 'input' : 'change', update);
}

document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(el(btn.dataset.copy).textContent, btn));
});

modeSelect.addEventListener('change', () => {
    input.placeholder = modeSelect.value === 'hex'
        ? t('Bytes en hex... (ej: 28 67 00 00)', 'Hex bytes... (e.g. 28 67 00 00)')
        : t('Escribe aquí... (ej: /bin/sh)', 'Type here... (e.g. /bin/sh)');
});

altBtn.addEventListener('click', () => {
    input.value = altBtn.dataset.alt || input.value;
    update();
});

update();
