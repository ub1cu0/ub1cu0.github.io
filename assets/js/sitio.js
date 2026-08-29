/* Lo poco que la web necesita en el navegador: el NEW de lo reciente, el reloj
   y el contador. Sin esto la pagina se lee igual, solo pierde esos tres detalles. */

(function () {
  'use strict';

  /* Contador de visitas de este navegador, que es lo unico que se puede contar
     sin servidor. No es el numero de visitas del sitio. Solo sube una vez. */
  var visitas = 1337;
  try {
    visitas = parseInt(localStorage.getItem('hits') || '1337', 10) + 1;
    localStorage.setItem('hits', String(visitas));
  } catch (e) {}

  /* Todo lo que depende del contenido va aqui, porque al navegar sin recargar
     hay que volver a montarlo sobre el HTML nuevo. */
  function montaContenido() {
    /* El NEW no va escrito en ninguna fila: se pone en lo subido hace menos de
       una semana, mirando la fecha de cada una. */
    var tpl = document.getElementById('tpl-nuevo');
    if (tpl) {
      var SEMANA = 7 * 24 * 60 * 60 * 1000;
      var ahora = Date.now();
      [].forEach.call(document.querySelectorAll('.lista tr'), function (tr) {
        var celda = tr.querySelector('.d');
        var hueco = tr.querySelector('td.ic:last-child');
        if (!celda || !hueco) return;
        var t = celda.textContent.trim().split('/');
        if (t.length !== 3) return;
        var fecha = new Date(+t[2], +t[1] - 1, +t[0]);
        if (ahora - fecha.getTime() < SEMANA) hueco.appendChild(tpl.content.cloneNode(true));
      });
    }

    var v = document.getElementById('visitas');
    if (v) v.textContent = String(visitas).padStart(6, '0');

    var reloj = document.getElementById('reloj');
    if (reloj) {
      var tic = function () {
        var d = new Date();
        reloj.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      };
      tic();
      clearInterval(montaContenido.tic);
      montaContenido.tic = setInterval(tic, 20000);
    }
  }
  montaContenido();

  /* ------------------------------------------------- navegar sin recargar
     Al pinchar un enlace del sitio se pide el HTML y se cambia solo lo de
     dentro de .page. El reproductor vive fuera, asi que no se toca y la musica
     no se corta al cambiar de pagina.

     Las paginas siguen siendo ficheros HTML completos: si esto falla o no hay
     JavaScript, el enlace navega como siempre y no se pierde nada. */
  var page = document.querySelector('.page');
  if (page && window.fetch && window.history && window.DOMParser) {
    var yendo = false;

    function pinta(html, url) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var nueva = doc.querySelector('.page');
      if (!nueva) { location.href = url; return; }
      page.innerHTML = nueva.innerHTML;
      document.title = doc.title;
      var can = document.querySelector('link[rel=canonical]');
      var canN = doc.querySelector('link[rel=canonical]');
      if (can && canN) can.href = canN.href;
      montaContenido();
      window.scrollTo(0, 0);
      var h1 = page.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }

    function ve(url, empujar) {
      if (yendo) return;
      yendo = true;
      fetch(url, { headers: { 'X-Soft-Nav': '1' } })
        .then(function (r) { if (!r.ok) throw 0; return r.text(); })
        .then(function (html) {
          if (empujar) history.pushState({ suave: 1 }, '', url);
          pinta(html, url);
        })
        .catch(function () { location.href = url; })
        .then(function () { yendo = false; });
    }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (a.origin !== location.origin) return;
      // las herramientas y los ficheros sueltos se abren como toda la vida
      if (/^\/assets\//.test(a.pathname) || /\.(xml|txt|json|png|jpe?g|gif|pdf)$/.test(a.pathname)) return;
      if (a.pathname === location.pathname) { e.preventDefault(); window.scrollTo(0, 0); return; }
      e.preventDefault();
      ve(a.href, true);
    });

    window.addEventListener('popstate', function () { ve(location.href, false); });
  }

  /* ------------------------------------------------------------- la musica
     Suena desde el reproductor de YouTube, escondido. No se guarda el fichero
     aqui, asi que la reproduccion sigue contando en el video original.

     Los navegadores no dejan que empiece sola con sonido hasta que la persona
     toca algo en la pagina, asi que se intenta y, si no arranca, se queda a la
     espera del primer clic. La eleccion y el segundo por el que iba se guardan,
     para que al cambiar de pagina siga por donde estaba. */
  var boton = document.getElementById('musica');
  if (boton && window.YT !== null) {
    var VIDEO = boton.dataset.video;
    var player = null, listo = false, arrancando = false;
    var VOLUMEN = 18;   // de fondo, no de primer plano
    var suena = function () { player.unMute(); player.setVolume(VOLUMEN); };

    var leer = function (k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
    var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

    var quiere = leer('musica', 'si') === 'si';   // de serie, sonando
    var mudo = false;
    /* Copia el fotograma que se este viendo del gif a un canvas, para poder
       enseñarlo quieto mientras la musica esta parada. */
    var gif = boton.querySelector('img');
    var quieto = boton.querySelector('canvas');
    function congela() {
      if (!quieto || !gif || !gif.naturalWidth) return;
      quieto.width = gif.naturalWidth;
      quieto.height = gif.naturalHeight;
      try {
        quieto.getContext('2d').drawImage(gif, 0, 0);
        boton.classList.add('congelado');
      } catch (e) { /* si no se puede, se queda el gif oscurecido */ }
    }
    if (gif && !gif.complete) gif.addEventListener('load', function () { if (boton.getAttribute('aria-pressed') === 'false') congela(); });

    var pinta = function (on) {
      if (!on) congela();
      boton.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    pinta(false);

    var api = document.createElement('script');
    api.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(api);

    window.onYouTubeIframeAPIReady = function () {
      /* El segundo por el que iba se le pasa al cargar. Saltar despues no vale:
         si el video aun no ha bufferizado, el salto se pierde y empieza de cero. */
      var desde = Math.floor(parseFloat(leer('musica-seg', '0')) || 0);
      player = new YT.Player('reproductor', {
        videoId: VIDEO,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0,
          start: desde > 1 ? desde : 0,
        },
        events: {
          onReady: function () {
            listo = true;
            player.setVolume(VOLUMEN);
            if (quiere) intenta();
          },
          onStateChange: function (e) {
            var sonando = e.data === YT.PlayerState.PLAYING;
            // sonando pero en silencio no cuenta: no se oye nada
            pinta(sonando && !mudo);
            if (sonando) arrancando = false;
            if (e.data === YT.PlayerState.ENDED) { guardar('musica-seg', '0'); if (quiere) player.playVideo(); }
          },
        },
      });
    };

    /* Con el volumen puesto, el navegador no deja arrancar solo hasta que la
       persona toca algo. En silencio si deja. Asi que se intenta con sonido y,
       si no arranca, se pone en silencio para que al menos empiece, y el primer
       toque en cualquier sitio le quita el silencio en vez de empezar de cero. */
    var GESTOS = ['pointerdown', 'touchstart', 'keydown'];
    var alPrimerToque = function () {
      GESTOS.forEach(function (g) { document.removeEventListener(g, alPrimerToque); });
      if (!quiere || !listo) return;
      if (mudo) { suena(); mudo = false; }
      if (player.getPlayerState() !== 1) player.playVideo();
      pinta(player.getPlayerState() === 1);
    };

    function intenta() {
      if (!listo) return;
      arrancando = true;
      mudo = false;
      suena();
      player.playVideo();
      GESTOS.forEach(function (g) { document.addEventListener(g, alPrimerToque); });

      // si en algo mas de un segundo no ha arrancado, es que lo han cortado
      setTimeout(function () {
        if (!quiere || !listo) return;
        if (player.getPlayerState() !== 1) {
          mudo = true;
          player.mute();
          player.playVideo();
        }
      }, 1200);
    }

    boton.addEventListener('click', function () {
      if (!listo) return;
      // si suena en silencio, el boton esta apagado y lo que toca es oirla
      var sonando = player.getPlayerState() === 1 && !mudo;
      quiere = !sonando;
      guardar('musica', quiere ? 'si' : 'no');
      if (quiere) {
        if (mudo) { suena(); mudo = false; pinta(true); }
        else intenta();
      } else {
        player.pauseVideo();
        pinta(false);
      }
    });

    setInterval(function () {
      if (listo && player.getPlayerState() === 1) guardar('musica-seg', String(Math.floor(player.getCurrentTime())));
    }, 2000);
  }

})();
