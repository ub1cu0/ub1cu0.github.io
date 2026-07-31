/*
 * Endian Converter
 *
 * Parte cadenas y valores en palabras de 4 u 8 bytes y genera el bloque listo para
 * pegar, en la pila con push o en memoria con mov [reg + off]. Cuando un valor lleva
 * bytes prohibidos (por defecto el 00) la instruccion se reescribe con neg, not o xor,
 * de forma que el valor que acaba en memoria es el mismo pero el shellcode no contiene
 * el byte malo.
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

const uniqHex = list => [...new Set(list)].map(b => '0x' + hexByte(b)).join(' ');

/*
 * Busca una forma limpia de expresar un valor: el valor tal cual, su negado, su
 * complemento, o un xor con una mascara de byte repetido. Devuelve null si ninguna
 * sale limpia. `imm` es lo que se carga y `fix` la instruccion que lo revierte.
 */
function findClean(v, wordSize, badSet) {
    const mask = (1n << BigInt(wordSize * 8)) - 1n;

    if (isClean(v, wordSize, badSet)) return { kind: 'direct', imm: v, fix: null };

    const neg = (-v) & mask;
    if (isClean(neg, wordSize, badSet)) return { kind: 'neg', imm: neg, fix: r => `neg ${r}` };

    const not = (~v) & mask;
    if (isClean(not, wordSize, badSet)) return { kind: 'not', imm: not, fix: r => `not ${r}` };

    for (let i = 1; i <= 0xff; i++) {
        let k = 0n;
        for (let j = 0; j < wordSize; j++) k |= BigInt(i) << BigInt(j * 8);
        const a = (v ^ k) & mask;
        if (isClean(k, wordSize, badSet) && isClean(a, wordSize, badSet)) {
            return { kind: 'xor', imm: a, fix: r => `xor ${r}, ${hexWord(k, wordSize)}` };
        }
    }
    return null;
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

    const c = findClean(v, wordSize, badSet);
    if (!c) return { ...direct, value: v, overhead: [], stuck: true };
    if (c.kind === 'direct') return { ...direct, value: v, overhead: [], stuck: false };

    return {
        kind: c.kind, value: v, overhead: [], stuck: false,
        asm: [`mov ${acc}, ${hx(c.imm)}`, c.fix(acc), `push ${acc}`],
    };
}

/*
 * Bytes que el ensamblador emite alrededor del inmediato en un `mov [reg + off], ...`,
 * medidos contra Keystone. Importan porque pueden meter un byte prohibido por su cuenta:
 * `mov dword ptr [eax], imm32` es c7 00 imm32 y ese 00 esta ahi aunque el valor este limpio.
 * La forma con registro, `mov dword ptr [eax], ecx`, es 89 08 y se libra.
 */
export function storeOverhead(wordSize, offset, viaReg) {
    const mod = offset === 0 ? 0x00 : offset <= 127 ? 0x40 : 0x80;
    const out = [];
    if (wordSize === 8) out.push(0x48);                  // REX.W
    if (viaReg) out.push(0x89, mod | 0x08);              // reg destino = rcx
    else out.push(0xc7, mod);                            // /0, inmediato
    if (offset === 0) return out;
    if (offset <= 127) { out.push(offset); return out; }
    for (let i = 0; i < 4; i++) out.push((offset >> (i * 8)) & 0xff);
    return out;
}

/*
 * A partir de 127 el desplazamiento ya no cabe en un byte y el ensamblador emite un
 * disp32, que arrastra nulls. La salida es adelantar el propio puntero: `add eax, 124`
 * se codifica 83 c0 7c y esta limpia. Devuelve cuanto adelantar, o 0 si no compensa.
 */
function advanceStep(off, cursor, wordSize, badSet) {
    if (badSet.has(0x83) || badSet.has(0xc0)) return 0;      // el propio add ya ensucia
    const max = Math.min(Math.floor(127 / wordSize) * wordSize, off - cursor);
    for (let d = max; d >= wordSize; d -= wordSize) {
        if (badSet.has(d)) continue;
        if (!storeOverhead(wordSize, off - cursor - d, true).some(b => badSet.has(b))) return d;
    }
    return 0;
}

/*
 * Igual que planPush pero escribiendo en memoria, en [dst + offset]. La forma corta
 * con inmediato solo se usa si su codificacion sale limpia, si no se pasa por el
 * registro auxiliar, que en x86 tiene un ModRM distinto y suele salvarse.
 */
export function planStore(value, wordSize, badSet, dst, offset, scratch) {
    const mask = (1n << BigInt(wordSize * 8)) - 1n;
    const v = value & mask;
    const hx = x => hexWord(x, wordSize);
    const sc = scratch || (wordSize === 8 ? 'rcx' : 'ecx');
    const mem = `${wordSize === 8 ? 'qword' : 'dword'} ptr [${dst}${offset ? ` + ${offset}` : ''}]`;

    const immOver = storeOverhead(wordSize, offset, false);
    const regOver = storeOverhead(wordSize, offset, true);
    const dirty = bs => bs.some(b => badSet.has(b));

    // En x86-64 no hay mov [mem], imm64: la palabra completa siempre pasa por registro.
    const immOk = wordSize === 4 && !dirty(immOver);

    const c = findClean(v, wordSize, badSet);
    if (!c) {
        return immOk
            ? { kind: 'store', value: v, asm: [`mov ${mem}, ${hx(v)}`], overhead: immOver, stuck: true }
            : { kind: 'mov', value: v, asm: [`mov ${sc}, ${hx(v)}`, `mov ${mem}, ${sc}`], overhead: regOver, stuck: true };
    }

    if (c.kind === 'direct') {
        if (immOk) return { kind: 'store', value: v, asm: [`mov ${mem}, ${hx(v)}`], overhead: immOver, stuck: false };
        // El valor estaba limpio, quien ensuciaba era la instruccion corta
        return {
            kind: 'mov', value: v, overhead: regOver, stuck: false,
            asm: [`mov ${sc}, ${hx(v)}`, `mov ${mem}, ${sc}`],
            viaReg: wordSize === 4 && dirty(immOver) ? immOver : null,
        };
    }

    return {
        kind: c.kind, value: v, overhead: regOver, stuck: false,
        asm: [`mov ${sc}, ${hx(c.imm)}`, c.fix(sc), `mov ${mem}, ${sc}`],
    };
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
 * Bloque de ensamblador completo.
 *
 * En la pila los push van del ultimo trozo al primero, porque la pila crece hacia
 * abajo y asi la cadena queda en orden en memoria. En memoria es al reves: se escribe
 * de la primera palabra a la ultima, con el desplazamiento subiendo.
 */
export function buildAsmBlock(bytes, opts) {
    const { wordSize, endian, badSet, avoidBad, terminator, label, target } = opts;
    const { words, pad } = buildWords(bytes, wordSize, endian);
    const mem = target === 'mem';

    const acc = wordSize === 8 ? 'rax' : 'eax';          // acumulador de los push
    const sp = wordSize === 8 ? 'rsp' : 'esp';
    const ptrReg = wordSize === 8 ? 'rdi' : 'ebx';       // donde se deja el puntero
    const base = wordSize === 8 ? 'rax' : 'eax';         // destino en modo memoria
    const scratch = wordSize === 8 ? 'rcx' : 'ecx';      // auxiliar en modo memoria
    const effBad = avoidBad ? badSet : new Set();

    const body = [];

    /* Los bytes prohibidos que de verdad acaban en el shellcode: los del valor cuando
       no se ha reescrito, mas los de la codificacion de la propia instruccion. */
    const dangerTag = (plan, w) => {
        // Si se ha reescrito con neg/not/xor el valor original nunca llega al codigo
        const rewritten = ['neg', 'not', 'xor'].includes(plan.kind);
        const all = (rewritten ? [] : badBytesOf(w.value, wordSize, badSet))
            .concat((plan.overhead || []).filter(b => badSet.has(b)));
        return all.length ? [{ text: `${uniqHex(all)} en el shellcode`, kind: 'danger' }] : [];
    };

    const emit = (plan, w, extra) => {
        plan.asm.forEach((line, j) => {
            const last = j === plan.asm.length - 1;
            const tags = [];
            if (last) {
                if (['neg', 'not', 'xor'].includes(plan.kind)) tags.push({ text: plan.kind, kind: 'fix' });
                else if (plan.viaReg) tags.push({
                    text: `via ${scratch}`, kind: 'fix',
                    title: `con inmediato se codifica ${plan.viaReg.map(hexByte).join(' ')}, que lleva `
                        + `${uniqHex(plan.viaReg.filter(b => badSet.has(b)))}`,
                });
                tags.push(...(extra || []), ...dangerTag(plan, w));
            }
            body.push({ text: line, comment: last ? `"${wordChars(w.chunk)}"` : null, tags });
        });
    };

    if (mem) {
        // Cuanto se ha adelantado ya el registro base, para que el desplazamiento siga cabiendo
        let cursor = 0;
        const relative = off => {
            if (effBad.size && storeOverhead(wordSize, off - cursor, true).some(b => effBad.has(b))) {
                const d = advanceStep(off, cursor, wordSize, effBad);
                if (d) {
                    body.push({ text: `add ${base}, ${d}`, comment: null, tags: [] });
                    cursor += d;
                }
            }
            return off - cursor;
        };

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const extra = pad > 0 && i === words.length - 1 ? [{ text: `+${pad} de relleno`, kind: 'info' }] : [];
            emit(planStore(w.value, wordSize, effBad, base, relative(i * wordSize), scratch), w, extra);
        }
        // Si la longitud cuadra justo, la cadena no queda terminada y hay que escribir ceros
        if (terminator && pad === 0 && words.length) {
            const rel = relative(words.length * wordSize);
            const over = storeOverhead(wordSize, rel, true).filter(b => badSet.has(b));
            body.push({ text: `xor ${scratch}, ${scratch}`, comment: null, tags: [] });
            body.push({
                text: `mov ${wordSize === 8 ? 'qword' : 'dword'} ptr [${base}${rel ? ` + ${rel}` : ''}], ${scratch}`,
                comment: 'terminador nulo',
                tags: over.length ? [{ text: `${uniqHex(over)} en el shellcode`, kind: 'danger' }] : [],
            });
        }
    } else {
        if (terminator && pad === 0 && words.length) {
            body.push({ text: `xor ${acc}, ${acc}`, comment: null, tags: [] });
            body.push({ text: `push ${acc}`, comment: 'terminador nulo', tags: [] });
        }
        for (let i = words.length - 1; i >= 0; i--) {
            const w = words[i];
            const extra = pad > 0 && i === words.length - 1 ? [{ text: `+${pad} de relleno`, kind: 'info' }] : [];
            emit(planPush(w.value, wordSize, effBad, acc), w, extra);
        }
        body.push({ text: `mov ${ptrReg}, ${sp}`, comment: `${ptrReg} -> ${label}`, tags: [] });
    }

    // El texto plano es lo que se lleva el boton de copiar, con los comentarios alineados.
    // El marcador es # y no ;, porque en x86 Keystone trata el ; como separador de
    // instrucciones y se traga el comentario como si fuera codigo.
    const width = Math.max(0, ...body.map(l => l.text.length));
    const text = body.map(l => l.comment
        ? `${l.text.padEnd(width)}   # ${l.comment}`
        : l.text).join('\n');

    // Y esto es lo que se pinta: una caja por instruccion
    const lines = body.map(l => ({ kind: 'insn', ...l }));

    return { text, lines, words, pad };
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
