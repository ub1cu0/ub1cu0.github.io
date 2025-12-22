import { route } from './router.js';
import { initRain, initMetasSlider, bootCodeTiles } from './ui.js';
import { $, CONFIG } from './utils.js';

document.getElementById('year').textContent = new Date().getFullYear();

// Inicialización
function init() {
    window.addEventListener('hashchange', route);
    route(); // Ruta inicial
    initRain();
    initMetasSlider();
    bootCodeTiles();
    updateDashboardCounts();
}

// Actualiza los contadores de la Home automáticamente
// Busca cualquier elemento con ID "catCount" (ej: pwnCount)
function updateDashboardCounts() {
    Object.keys(CONFIG.SECTIONS).forEach(sec => {
        const el = $(`${sec}Count`);
        if (el) {
            fetch(`${sec}/index.json`)
                .then(r => r.json())
                .then(arr => el.textContent = Array.isArray(arr) ? arr.length : 0)
                .catch(() => el.textContent = '-');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}