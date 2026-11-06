/* Яндекс Метрика: визиты и просмотры считаются автоматически,
   клики — через clickmap + цели ниже, предзаказы — цель «preorder».

   Цели (JavaScript-события, идентификаторы создать в Метрике):
     click_order     — любая кнопка «Заказать»          {place, version}
     select_version  — переключатель версии в первом экране {version}
     form_open       — открыта форма предзаказа          {place, version}
     preorder        — предзаказ ОТПРАВЛЕН (успех)       {version, board, price}
     click_telegram  — клик по ссылке на Telegram-канал  {place}
     viewer_use      — первое касание 3D-схемы           {action}
     faq_open        — раскрыт вопрос в FAQ              {question}
*/
(function () {
  var cfg = window.VS_CONFIG || {};
  var id = Number(cfg.YM_ID) || 0;
  var debug = cfg.DEBUG_ANALYTICS || /[?&]ymdebug\b/.test(location.search);

  /* Безопасная обёртка: не падает, если Метрика не загрузилась или заблокирована. */
  window.vsTrack = function (goal, params) {
    if (debug) console.info('[metrika goal]', goal, params || {});
    try { if (id && typeof window.ym === 'function') window.ym(id, 'reachGoal', goal, params || {}); } catch (e) { /* ignore */ }
  };

  /* clientID связывает предзаказ с визитом в отчётах Метрики. */
  window.vsClientId = function (cb) {
    var done = false;
    function finish(v) { if (!done) { done = true; cb(v || ''); } }
    try { if (id && typeof window.ym === 'function') { window.ym(id, 'getClientID', finish); setTimeout(finish, 800); return; } } catch (e) { /* ignore */ }
    finish('');
  };

  if (!id) return;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  window.ym(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true
  });
})();
