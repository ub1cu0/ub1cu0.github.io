/*
 * app.js — mejoras de cliente (progressive enhancement).
 * Ya no hay SPA ni routing por almohadilla: cada página es HTML real.
 * Este script solo añade los efectos y la interactividad opcional.
 */
(function () {
  'use strict';

  /* Año del footer */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Lluvia de hex de fondo */
  (function rain() {
    var r = document.getElementById('rain');
    if (!r) return;
    var cols = Math.floor(window.innerWidth / 60);
    var rows = Math.floor(window.innerHeight / 24);
    var hex = '0123456789abcdef';
    var out = '';
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        out += '<i style="left:' + (i * 60 + 10) + 'px;top:' + (j * 24 + 6) + 'px;">' +
          hex[(i * 7 + j * 13) % 16] + '</i>';
      }
    }
    r.innerHTML = out;
  })();

  /* Contadores de la home (badges) */
  (function counts() {
    var badges = document.querySelectorAll('[data-count]');
    badges.forEach(function (el) {
      var sec = el.getAttribute('data-count');
      fetch('/' + sec + '/index.json')
        .then(function (r) { return r.json(); })
        .then(function (a) { el.textContent = Array.isArray(a) ? a.length : 0; })
        .catch(function () { el.textContent = '-'; });
    });
  })();

  /* Tarjetas de código de la landing (se resaltan si hljs está disponible) */
  (function codeTiles() {
    var tiles = document.querySelectorAll('.code-tile');
    if (!tiles.length) return;
    var SN = {
      c: '#include <stdio.h>\nint main(){\n  puts("pwned");\n  return 0;\n}',
      cpp: '#include <iostream>\nint main(){\n  std::cout << "pwned" << std::endl;\n  return 0;\n}',
      py: '#!/usr/bin/env python3\ndef main():\n    print("pwned")\nif __name__ == "__main__":\n    main()',
      sh: '#!/usr/bin/env bash\nmain(){\n  echo "pwned"\n}\nmain'
    };
    var LANG = { c: 'c', cpp: 'cpp', py: 'python', sh: 'bash' };
    tiles.forEach(function (t) {
      var k = t.getAttribute('data-lang');
      var code = t.querySelector('code');
      if (!code || !SN[k]) return;
      code.textContent = SN[k];
      code.className = 'language-' + (LANG[k] || k);
      if (window.hljs) { try { window.hljs.highlightElement(code); } catch (e) { } }
    });
  })();

  /* Slider vertical de metas (scroll con snap) */
  (function metas() {
    var vp = document.getElementById('metasViewport');
    var track = document.getElementById('metasTrack');
    if (!vp || !track) return;
    var VISIBLE = 5;
    function gap() { var g = parseInt(getComputedStyle(track).gap, 10); return isFinite(g) ? g : 12; }
    function cardH() { var c = track.querySelector('.goal'); return c ? c.offsetHeight : 0; }
    function fit() {
      var h = cardH();
      if (h > 0) {
        var total = VISIBLE * h + gap() * (VISIBLE - 1);
        vp.style.maxHeight = total + 'px';
        vp.style.minHeight = total + 'px';
      } else {
        requestAnimationFrame(fit);
      }
    }
    fit();
    window.addEventListener('resize', fit);
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var step = cardH() + gap();
      if (step > 12) vp.scrollBy({ top: (e.deltaY > 0 ? 1 : -1) * step, behavior: 'smooth' });
    }, { passive: false });
  })();

  /* Filtro de la vista de listado (opera sobre los tiles ya renderizados) */
  (function filter() {
    var origin = document.getElementById('origenSelect');
    var type = document.getElementById('tipoSelect');
    if (!origin || !type) return;
    var tiles = Array.prototype.slice.call(document.querySelectorAll('.grid .tile'));
    function draw() {
      var o = origin.value.toLowerCase();
      var t = type.value.toLowerCase();
      tiles.forEach(function (el) {
        var tags = (el.getAttribute('data-tags') || '').split(',');
        var ok = (o === 'all' || tags.indexOf(o) !== -1) && (t === 'all' || tags.indexOf(t) !== -1);
        el.style.display = ok ? '' : 'none';
      });
    }
    origin.addEventListener('change', draw);
    type.addEventListener('change', draw);
  })();
})();
