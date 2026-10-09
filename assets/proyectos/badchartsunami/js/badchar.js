/*
 * BadCharTsunami
 *
 * Coge un volcado de depurador y lo compara con el buffer que se envio, que es
 * range(0x100) menos la blacklist. Lo que saca es por donde se corta la secuencia
 * y que le paso a cada byte: desaparecio, se cambio por otro, se convirtio en
 * varios, o a partir de ahi ya no llego nada.
 *
 * El volcado se parsea a ciegas: db, dw, dd, dq, dc, dds, hex pegado, \x41\x42 y
 * cualquier mezcla con direcciones delante y columna ASCII detras. Lo que decide
 * como interpretarlo no es una regla sobre el texto, es cual de las cuatro
 * interpretaciones casa mejor con la referencia, asi que el little endian de un
 * dd y el ensanchado a UTF-16 de un buffer unicode salen solos.
 */

export const TOTAL = 0x100;

export const hexByte = b => b.toString(16).padStart(2, '0');

/* "00 7f ff", "0x00,0x7F", "\x00 \x7f"... todo vale. */
export function parseBadBytes(str) {
    const set = new Set();
    for (const tok of String(str || '').split(/[\s,;{}]+/)) {
        if (!tok) continue;
        const n = parseInt(tok.replace(/^(0x|\\x)/i, ''), 16);
        if (!isNaN(n) && n >= 0 && n <= 0xff) set.add(n);
    }
    return set;
}

/* El buffer que se manda: todos los bytes menos los de la blacklist, en orden.
   Al ser creciente y sin repetidos, cada byte recibido dice por si solo en que
   posicion del buffer estaba, y eso es lo que hace barata la alineacion. */
export function buildReference(badSet) {
    const ref = [];
    for (let b = 0; b < TOTAL; b++) if (!badSet.has(b)) ref.push(b);
    return ref;
}

export function pythonScript({ host, port, prefix, suffix, badSet }) {
    const lista = badSet.size
        ? '{' + [...badSet].sort((a, b) => a - b).map(b => `0x${hexByte(b)}`).join(', ') + '}'
        : 'set()';
    const q = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    // el prefijo y el sufijo van tal cual entre comillas, que es donde los escribe
    const pre = prefix ? `b"${prefix.replace(/"/g, '\\"')}" + ` : '';
    const suf = suffix ? ` + b"${suffix.replace(/"/g, '\\"')}"` : '';
    return `from pwn import *

blacklist = ${lista}

buffer = bytearray(b for b in range(0x100) if b not in blacklist)

p = remote("${q(host)}", ${String(port).replace(/[^0-9]/g, '') || 0})
p.send(${pre}buffer${suf})
`;
}

/* ---------------------------------------------------------------- el parser */

const ES_HEX = /^[0-9a-f]+$/i;

/* Un campo aporta sus tokens si todos son hex de la misma longitud. Un token mas
   largo que un qword es hex pegado ("000102030405...") y se parte en bytes aqui
   mismo, para que acabe midiendo lo mismo que un db.

   El caso del simbolo de dds y dps ("0019f380  0b0a0908 ntdll!RtlFreeHeap") se
   trata aparte: cuenta el valor y se tira el nombre. Lo que no vale es exigir que
   el nombre no tenga hex dentro, porque un "vulnserver+0x1234" lo tiene y
   entonces el campo entero se caia. Lo que se pide es que el valor vaya primero y
   que sea largo, para que un "dd esp" no cuele un 0xdd. */
function tokensDeCampo(campo) {
    const toks = campo
        .replace(/0x/gi, ' ')
        .replace(/\\x/gi, ' ')
        .split(/[\s,+]+/)
        .filter(Boolean);
    if (!toks.length) return null;

    const parte = t => (t.length > 16 ? t.match(/../g) : [t]);
    const esDato = t => ES_HEX.test(t) && t.length % 2 === 0;

    if (toks.every(esDato)) {
        const out = toks.flatMap(parte);
        return new Set(out.map(t => t.length)).size === 1 ? out : null;
    }
    if (esDato(toks[0]) && toks[0].length >= 4 && toks.slice(1).some(t => !esDato(t))) return parte(toks[0]);
    return null;
}

/* WinDbg separa la direccion, los datos y la columna ASCII con dos espacios, y
   dentro de los datos usa uno solo (o el guion del medio que mete db). Eso es lo
   que se aprovecha aqui: la linea se parte en columnas por dos o mas espacios y
   cada columna se mira entera, asi que un "`abcdefghijklmno" de la columna ASCII
   no cuela sus letras hex. */
function tokensDeLinea(linea) {
    const limpia = linea
        .replace(/([0-9a-f])`([0-9a-f])/gi, '$1$2')   // 00000000`0019f380, 0f0e0d0c`0b0a0908
        .replace(/([0-9a-f])-([0-9a-f])/gi, '$1 $2')  // 00 01 02 03-04 05 06 07
        .replace(/^\s*[0-9a-f]{1,8}\s*:/i, ' ')       // "0000: 00 01 02"
        .replace(/\t/g, '  ');

    const campos = limpia.split(/ {2,}/).map(c => c.trim()).filter(Boolean);
    const aportan = campos.map(tokensDeCampo);

    /* La columna de la izquierda es una direccion si va sola, es larga y la linea
       sigue con mas columnas. Vale igual para db (2 contra 8) que para dq, donde
       la direccion y el dato miden lo mismo.

       Esto se decide sobre las columnas de verdad, no sobre las que han aportado
       datos: mirando solo las que aportan, una linea cuyo campo de datos no se
       reconoce se queda con la direccion como unica candidata y la cuela como si
       fuera el dato de esa linea. */
    const desde = campos.length >= 2 && aportan[0]
        && aportan[0].length === 1 && aportan[0][0].length >= 4 ? 1 : 0;

    const out = [];
    for (let k = desde; k < campos.length; k++) if (aportan[k]) out.push(...aportan[k]);
    return out;
}

function bytesDeTokens(toks, swap) {
    const out = [];
    for (const t of toks) {
        const b = [];
        for (let k = 0; k < t.length; k += 2) b.push(parseInt(t.slice(k, k + 2), 16));
        if (swap) b.reverse();
        out.push(...b);
    }
    return out;
}

/* Un buffer que ha pasado por una API wide se ve como 00 00 01 00 02 00. Si los
   impares son casi todos cero, la version estrecha entra como candidata y es la
   puntuacion la que decide, no esta heuristica. */
function estrecha(bytes) {
    if (bytes.length < 8) return null;
    let ceros = 0, impares = 0;
    for (let k = 1; k < bytes.length; k += 2) { impares++; if (bytes[k] === 0) ceros++; }
    if (!impares || ceros / impares < 0.8) return null;
    const out = [];
    for (let k = 0; k < bytes.length; k += 2) out.push(bytes[k]);
    return out;
}

/* Cuantas parejas seguidas del volcado son tambien parejas seguidas de la
   referencia. Mide lo bien que una interpretacion reproduce el buffer y no
   depende de donde empiece el volcado. */
function puntua(bytes, refIndex) {
    let n = 0;
    for (let k = 0; k + 1 < bytes.length; k++) {
        const p = refIndex[bytes[k]];
        if (p >= 0 && refIndex[bytes[k + 1]] === p + 1) n++;
    }
    return n;
}

export function parseDump(text, refIndex) {
    const lineas = String(text || '').split(/\r\n|\r|\n/);
    const toks = [];
    let conDatos = 0;
    for (const l of lineas) {
        const t = tokensDeLinea(l);
        if (t.length) { conDatos++; toks.push(...t); }
    }
    if (!toks.length) return null;

    // la longitud de token que manda se queda, el resto era adorno
    const cuenta = new Map();
    for (const t of toks) cuenta.set(t.length, (cuenta.get(t.length) || 0) + 1);
    let group = 2, mejor = -1;
    for (const [len, n] of cuenta) if (n > mejor || (n === mejor && len < group)) { mejor = n; group = len; }
    const usados = toks.filter(t => t.length === group);

    const candidatos = [];
    for (const swap of group > 2 ? [false, true] : [false]) {
        const b = bytesDeTokens(usados, swap);
        candidatos.push({ bytes: b, swapped: swap, narrowed: false });
        const n = estrecha(b);
        if (n) candidatos.push({ bytes: n, swapped: swap, narrowed: true });
    }

    let elegido = candidatos[0], score = -1;
    for (const c of candidatos) {
        const s = puntua(c.bytes, refIndex);
        if (s > score) { score = s; elegido = c; }
    }

    return {
        bytes: elegido.bytes,
        group: group / 2,
        swapped: elegido.swapped,
        narrowed: elegido.narrowed,
        lines: conDatos,
        tokens: usados.length,
        score,
    };
}

/* -------------------------------------------------------------- la alineacion */

const VENTANA = 8;

export function analyze(text, badSet) {
    const ref = buildReference(badSet);
    const refIndex = new Int16Array(TOTAL).fill(-1);
    ref.forEach((b, i) => { refIndex[b] = i; });

    const state = new Array(TOTAL).fill(null);
    for (const b of badSet) state[b] = 'skip';

    const fmt = parseDump(text, refIndex);
    if (!fmt) return { ok: false, ref, state, issues: [], cut: null, matched: 0, fmt: null, head: 0 };

    const got = fmt.bytes;
    const issues = [];

    /* Anclaje: el primer sitio donde tres bytes seguidos del volcado son tres
       bytes seguidos de la referencia, y de ahi hacia atras todo lo que siga
       cuadrando. Asi da igual lo que haya delante, un prompt, un registro o la
       cabecera del protocolo. */
    let i = -1, j = -1;
    for (let k = 0; k + 2 < got.length && i < 0; k++) {
        const p = refIndex[got[k]];
        if (p < 0) continue;
        if (refIndex[got[k + 1]] === p + 1 && refIndex[got[k + 2]] === p + 2) { i = p; j = k; }
    }
    if (i < 0) {
        // ni tres bytes seguidos: el volcado no es este buffer
        return { ok: true, ref, state, issues: [], cut: null, matched: 0, fmt, head: -1 };
    }
    while (i > 0 && j > 0 && got[j - 1] === ref[i - 1]) { i--; j--; }

    const head = j;
    /* Los bytes de la referencia que quedan por delante del anclaje no estan en
       el volcado, y eso es un hecho. Por que no estan no se sabe: pueden ser
       bytes que el objetivo se comio, o puede que el volcado empiece mas adentro
       del buffer. Por eso van con su propio tipo y no como comidos. */
    for (let k = 0; k < i; k++) {
        issues.push({ offset: k, byte: ref[k], kind: 'missing', got: [] });
        state[ref[k]] = 'missing';
    }

    /* Reengancha si el byte esta en la referencia a partir de donde vamos y el
       siguiente del volcado le sigue tambien en la referencia. Pedir la pareja
       es lo que impide reenganchar sobre la basura que hay detras del buffer. */
    const reengancha = (k, desde) => {
        const p = refIndex[got[k]];
        if (p < desde) return -1;
        if (k + 1 >= got.length) return p;
        return refIndex[got[k + 1]] === p + 1 ? p : -1;
    };

    let matched = 0, cut = null, cutKind = 'cut';
    while (i < ref.length) {
        if (j < got.length && got[j] === ref[i]) {
            if (!state[ref[i]]) state[ref[i]] = 'ok';
            matched++; i++; j++;
            continue;
        }

        let found = -1, p = -1;
        for (let k = j; k < got.length && k < j + VENTANA; k++) {
            const q = reengancha(k, i);
            if (q >= 0) { found = k; p = q; break; }
        }
        if (found < 0) { cut = i; cutKind = j < got.length ? 'cut' : 'short'; break; }

        const extra = found - j;
        const basura = Array.from(got.slice(j, found));

        if (p === i) {
            /* El byte llego, pero con algo metido por delante. Visto desde el
               byte, es el mismo caso que una expansion (un 0a que llega como
               0d 0a), asi que se cuenta igual y lo que llego se guarda entero. */
            issues.push({ offset: i, byte: ref[i], kind: 'expanded', got: [...basura, ref[i]] });
            state[ref[i]] = 'expanded';
            matched++; i++; j = found + 1;
            continue;
        }

        if (extra === 0) {
            for (let k = i; k < p; k++) {
                issues.push({ offset: k, byte: ref[k], kind: 'eaten', got: [] });
                state[ref[k]] = 'eaten';
            }
        } else if (p - i === 1) {
            const kind = extra === 1 ? 'changed' : 'expanded';
            issues.push({ offset: i, byte: ref[i], kind, got: basura });
            state[ref[i]] = kind;
        } else {
            // varios desaparecidos y encima algo por medio: se cuentan como
            // comidos y lo que llego se cuelga del primero, que es lo unico que
            // se puede decir sin inventar
            for (let k = i; k < p; k++) {
                issues.push({ offset: k, byte: ref[k], kind: 'eaten', got: k === i ? basura : [] });
                state[ref[k]] = 'eaten';
            }
        }
        i = p; j = found;
    }

    if (cut !== null) {
        issues.push({ offset: cut, byte: ref[cut], kind: cutKind, got: Array.from(got.slice(j, j + 4)) });
        state[ref[cut]] = cutKind;
        for (let k = cut + 1; k < ref.length; k++) state[ref[k]] = 'none';
    }

    return { ok: true, ref, state, issues, cut: cut === null ? null : { offset: cut, byte: ref[cut], kind: cutKind }, matched, fmt, head };
}
