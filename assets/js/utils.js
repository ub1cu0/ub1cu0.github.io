export const CONFIG = {
    // Definir aquí las secciones habilitadas y sus nombres visuales
    SECTIONS: {
        'pwn': { title: 'PWN', label: 'Writeups' },
        'htb': { title: 'HTB', label: 'Machines' },
        'cve': { title: 'CVEs', label: 'Research' }, // Ejemplo de nueva sección
        'poc': { title: 'POCs', label: 'Code' }     // Ejemplo de nueva sección
    },
    // Tags que se consideran "Origen" para el filtro (copiado de tu lógica)
    ORIGIN_TAGS: ["picoCTF", "HackTheBox", "SnakeCTF", "imaginaryCTF", "WWCTF", "ropemporium", "pwnable", "NavajaNegra", "CVE", "Xpdf", "sumatrapdfreader"],
    METAS_VISIBLE: 5
};

export function $(id) { return document.getElementById(id); }