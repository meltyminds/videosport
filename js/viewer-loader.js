/* Ленивая загрузка 3D-вьювера: сразу виден статичный постер (assets/poster.webp).
   Мобильный (≤760 px): three.js и данные моделей грузятся только по первому
   касанию схемы — тяжёлый JS не тормозит первую отрисовку страницы.
   Десктоп: загрузка в момент простоя после window load, либо по первому
   взаимодействию — что наступит раньше. */
(function () {
  'use strict';

  var host = document.getElementById('viewer');
  if (!host) return;

  var started = false;

  function load(src, isModule) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      if (isModule) s.type = 'module';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('load: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function start() {
    if (started) return;
    started = true;
    var status = document.getElementById('vstatus');
    if (status) { status.textContent = 'Загружаю детали…'; status.hidden = false; }
    load('assets/meshes.js')
      .then(function () { return load('js/viewer.js', true); })
      .catch(function (err) {
        console.error(err);
        if (status) status.textContent = 'Не удалось загрузить 3D-схему';
      });
  }

  /* Первое взаимодействие с блоком схемы или её управлением — грузим немедленно. */
  host.addEventListener('pointerdown', start, { once: true });
  var ctl = document.getElementById('vctl');
  if (ctl) ctl.addEventListener('pointerdown', start, { once: true });

  /* На мобильном — только по касанию (см. комментарий в шапке). */
  var isMobile = window.matchMedia('(max-width: 760px)').matches;
  if (isMobile) return;

  /* На десктопе — в простое после полной загрузки страницы. */
  function arm() {
    if (started) return;
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 });
    else setTimeout(start, 0);
  }
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
})();
