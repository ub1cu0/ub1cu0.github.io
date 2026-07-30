/*
 * Endian Converter
 *
 * Parte cadenas y valores en palabras de 4 u 8 bytes y genera el bloque de pushes
 * listo para pegar. Cuando un valor lleva bytes prohibidos (por defecto el 00) la
 * instruccion se reescribe con neg, not o xor, de forma que el valor que acaba en
 * la pila es el mismo pero el shellcode no contiene el byte malo.
 */

const PRINTABLE = /[\x20-\x7e]/;

export function parseBadBytes(str) {
    const set = new Set();
    for (const tok of String(str || '').split(/[\s,]+/)) {
        if (!tok) continue;
        const n = parseInt(tok.replace(/^(0x|\\x)/i, ''), 16);
        if (!isNaN(n) && n >= 0 && n <= 0xff) set.add(n);
    }
    return set;
}

/* Texto a bytes (UTF-8) o lista de bytes en hex. */
export function toBytes(input, mode) {
    if (mode === 'hex') {
        const clean = input.replace(/0x|\\x|,/gi, ' ').trim();
        if (!clean) return new Uint8Array(0);
        const toks = clean.split(/\s+/).filter(Boolean);
        const out = [];
        // "41424344" suelto se trata como pares de nibbles
        if (toks.length === 1 && toks[0].length > 2 && toks[0].length % 2 === 0) {
            const t = toks[0];
            for (let i = 0; i < t.length; i += 2) {
                const n = parseInt(t.slice(i, i + 2), 16);
                if (isNaN(n)) return null;
                out.push(n);
            }
            return new Uint8Array(out);
        }
        for (const t of toks) {
            const n = parseInt(t, 16);
            if (isNaN(n) || n < 0 || n > 0xff) return null;
            out.push(n);
        }
        return new Uint8Array(out);
    }
    return new TextEncoder().encode(input);
}

export function hexByte(b) { return b.toString(16).padStart(2, '0'); }

export function hexWord(value, wordSize) {
    return '0x' + value.toString(16).padStart(wordSize * 2, '0');
}

/* Representacion legible de una palabra, con los no imprimibles escapados. */
export function wordChars(bytes) {
    let s = '';
    for (const b of bytes) {
        if (b === 0) s += '\\0';
        else if (b === 0x0a) s += '\\n';
        else if (b === 0x0d) s += '\\r';
        else if (b === 0x09) s += '\\t';
        else if (PRINTABLE.test(String.fromCharCode(b))) s += String.fromCharCode(b);
        else s += '\\x' + hexByte(b);
    }
    return s;
}

function bytesOf(value, wordSize) {
    const out = [];
    for (let i = 0; i < wordSize; i++) out.push(Number((value >> BigInt(i * 8)) & 0xffn));
    return out;   // indice 0 = byte bajo
}

function isClean(value, wordSize, badSet) {
    if (!badSet.size) return true;
    for (const b of bytesOf(value, wordSize)) if (badSet.has(b)) return false;
    return true;
}

/* Bytes prohibidos que lleva un valor, para poder señalarlos donde aparecen. */
export function badBytesOf(value, wordSize, badSet) {
    return bytesOf(value, wordSize).filter(b => badSet.has(b));
}

/*
 * Decide como meter `value` en la pila sin usar bytes prohibidos.
 * Orden: push directo, neg, not y por ultimo xor con una mascara buscada.
 */
export function planPush(value, wordSize, badSet, reg) {
    const mask = (1n << BigInt(wordSize * 8)) - 1n;
    const v = value & mask;
    const hx = x => hexWord(x, wordSize);
    const acc = reg || (wordSize === 8 ? 'rax' : 'eax');

    // En x86-64 no existe push imm64, siempre pasa por registro.
    const direct = wordSize === 8
        ? { kind: 'mov', asm: [`mov ${acc}, ${hx(v)}`, `push ${acc}`] }
        : { kind: 'push', asm: [`push ${hx(v)}`] };

    if (isClean(v, wordSize, badSet)) {
        // Con push imm32 hay que mirar tambien los bytes de la instruccion, no solo del valor
        return { ...direct, value: v, note: null };
    }

    const neg = (-v) & mask;
    if (isClean(neg, wordSize, badSet)) {
        return {
            kind: 'neg', value: v,
            asm: [`mov ${acc}, ${hx(neg)}`, `neg ${acc}`, `push ${acc}`],
            note: `${hx(v)} lleva byte prohibido, uso su negado ${hx(neg)} y lo revierto con neg`,
        };
    }

    const not = (~v) & mask;
    if (isClean(not, wordSize, badSet)) {
        return {
            kind: 'not', value: v,
            asm: [`mov ${acc}, ${hx(not)}`, `not ${acc}`, `push ${acc}`],
            note: `${hx(v)} lleva byte prohibido, uso su complemento ${hx(not)} y lo revierto con not`,
        };
    }

    // xor: se busca una mascara cuyos dos operandos queden limpios
    for (let i = 1; i <= 0xff; i++) {
        let k = 0n;
        for (let j = 0; j < wordSize; j++) k |= BigInt(i) << BigInt(j * 8);
        const a = (v ^ k) & mask;
        if (isClean(k, wordSize, badSet) && isClean(a, wordSize, badSet)) {
            return {
                kind: 'xor', value: v,
                asm: [`mov ${acc}, ${hx(a)}`, `xor ${acc}, ${hx(k)}`, `push ${acc}`],
                note: `${hx(v)} lleva byte prohibido, lo monto con xor ${hx(k)}`,
            };
        }
    }

    return { ...direct, value: v, note: `no he encontrado forma de evitar el byte prohibido en ${hx(v)}` };
}

/*
 * Trocea los bytes en palabras. `endian` decide como se lee cada palabra:
 * 'le' toma el primer byte como el menos significativo, 'be' al contrario.
 */
export function buildWords(bytes, wordSize, endian) {
    const rem = bytes.length % wordSize;
    const pad = rem === 0 ? 0 : wordSize - rem;
    const padded = new Uint8Array(bytes.length + pad);
    padded.set(bytes);

    const words = [];
    for (let i = 0; i < padded.length; i += wordSize) {
        const chunk = padded.slice(i, i + wordSize);
        let value = 0n;
        if (endian === 'le') {
            for (let j = wordSize - 1; j >= 0; j--) value = (value << 8n) | BigInt(chunk[j]);
        } else {
            for (let j = 0; j < wordSize; j++) value = (value << 8n) | BigInt(chunk[j]);
        }
        words.push({ value, chunk, offset: i });
    }
    return { words, pad };
}

/*
 * Bloque de ensamblador completo. Los push van del ultimo trozo al primero porque
 * la pila crece hacia abajo y asi la cadena queda en orden en memoria.
 */
export function buildAsmBlock(bytes, opts) {
    const { wordSize, endian, badSet, avoidBad, terminator, label } = opts;
    const { words, pad } = buildWords(bytes, wordSize, endian);
    const acc = wordSize === 8 ? 'rax' : 'eax';
    const sp = wordSize === 8 ? 'rsp' : 'esp';
    const dst = wordSize === 8 ? 'rdi' : 'ebx';
    const effBad = avoidBad ? badSet : new Set();

    const head = [];
    head.push(`; ${label} en la pila (${wordSize * 8} bits, ${endian === 'le' ? 'little' : 'big'} endian)`);
    if (endian === 'be') head.push(`; valores leidos en orden big endian, para un target big endian`);
    if (pad) head.push(`; ${bytes.length} bytes no es multiplo de ${wordSize}, relleno ${pad} byte(s) nulo(s) al final`);

    const body = [];
    const notes = [];

    // Si la longitud cuadra justo, la cadena no queda terminada y hay que empujar ceros
    if (terminator && pad === 0) {
        body.push({ text: `xor ${acc}, ${acc}`, comment: null });
        body.push({ text: `push ${acc}`, comment: 'terminador nulo' });
    }

    for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        const plan = planPush(w.value, wordSize, effBad, acc);
        if (plan.note) notes.push(plan.note);

        const rewritten = plan.kind === 'neg' || plan.kind === 'not' || plan.kind === 'xor';
        const stuck = plan.note && plan.note.startsWith('no he encontrado');
        const carriesPad = pad > 0 && i === words.length - 1;
        const dirty = badBytesOf(w.value, wordSize, badSet);

        plan.asm.forEach((line, j) => {
            const last = j === plan.asm.length - 1;
            const tags = [];
            if (last && rewritten && !stuck) tags.push({ text: plan.kind, kind: 'fix' });
            if (last && carriesPad) tags.push({ text: `+${pad} de relleno`, kind: 'info' });
            if (last && dirty.length && (!rewritten || stuck)) {
                const uniq = [...new Set(dirty)].map(b => '0x' + hexByte(b)).join(' ');
                tags.push({ text: `${uniq} en el shellcode`, kind: 'danger' });
            }
            body.push({
                text: line,
                comment: last ? `"${wordChars(w.chunk)}"` : null,
                tags,
            });
        });
    }

    body.push({ text: `mov ${dst}, ${sp}`, comment: `${dst} -> ${label}`, tags: [] });

    // El texto plano es lo que se lleva el boton de copiar, con los comentarios alineados
    const width = Math.max(0, ...body.map(l => l.text.length));
    const text = head.concat(body.map(l => l.comment
        ? `${l.text.padEnd(width)}   ; ${l.comment}`
        : l.text)).join('\n');

    // Y esto es lo que se pinta: una caja por instruccion
    const lines = head.map(t => ({ kind: 'comment', text: t }))
        .concat(body.map(l => ({ kind: 'insn', ...l })));

    return { text, lines, words, pad, notes };
}

/* Para rutas, duplicar la primera barra alinea sin meter nulls: /bin/sh -> //bin/sh.
   Solo se sugiere si bastan una o dos barras, con mas deja de ser legible. */
export function suggestPathPadding(text, wordSize) {
    if (!text.startsWith('/')) return null;
    const len = new TextEncoder().encode(text).length;
    const rem = len % wordSize;
    if (rem === 0) return null;
    const need = wordSize - rem;
    if (need > 2) return null;
    return '/'.repeat(need) + text;
}
