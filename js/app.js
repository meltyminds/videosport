/* Поведение страницы: выбор платформы и комплектации, форма предзаказа, цели Метрики. */
(function () {
  'use strict';

  var cfg = window.VS_CONFIG || {};
  var track = window.vsTrack || function () {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NBSP = ' ', THIN = ' ';

  /* ---------- версии и цены: единственный источник цен — data-атрибуты секции #versions ---------- */
  var pricesEl = $('#versions');
  var NAMES = { 'case': 'Только корпус', board: 'Плата + корпус', full: 'Плата + корпус + комплектующие' };
  var VERSIONS = {};
  Object.keys(NAMES).forEach(function (id) {
    VERSIONS[id] = { id: id, price: Number(pricesEl.dataset['price' + id.charAt(0).toUpperCase() + id.slice(1)]), name: NAMES[id] };
  });
  var ORDER = ['case', 'board', 'full'];
  var BOARDS = { pi: 'Raspberry Pi', mister: 'MiSTer' };
  var state = { version: 'board', board: 'pi' };   /* version: case|board|full, board: pi|mister */

  function rub(n, sep) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep || NBSP); }
  function rubEl() { return Object.assign(document.createElement('span'), { className: 'rub', textContent: '₽' }); }
  function setPrice(el, n) { el.textContent = ''; el.append(rub(n, THIN), rubEl()); }
  function platform() { return state.version === 'case' ? 'case' : state.board; }   /* case | pi | mister */

  /* выбор «платформы» (Корпус / Малина / MiSTer) */
  function setPlatform(p) {
    if (p === 'case') { state.version = 'case'; return; }
    state.board = p;
    if (state.version === 'case') state.version = 'board';
  }

  /* ---------- ссылки из config.js ---------- */
  $$('[data-tg]').forEach(function (a) { a.href = cfg.TELEGRAM_URL || '#'; });
  if (cfg.PRIVACY_URL) $$('[data-privacy]').forEach(function (a) { a.href = cfg.PRIVACY_URL; });

  /* ---------- форма: элементы ---------- */
  var dlg = $('#order'), form = $('#orderForm'), done = $('#orderDone');
  var emailEl = $('#email'), consentEl = $('#consent');
  var emailErr = $('#email-err'), consentErr = $('#consent-err'), formErr = $('#formErr');
  var submitBtn = $('#submitBtn'), opener = null, sending = false;

  function checkedRadio(name) { var r = $('input[name=' + name + ']:checked', form); return r ? r.value : ''; }
  function setRadio(name, value) { $$('input[name=' + name + ']', form).forEach(function (r) { r.checked = r.value === value; }); }
  function syncForm() {
    setRadio('version', state.version); setRadio('board', state.board);
    $('#boardLegend').textContent = state.version === 'case' ? 'Корпус под плату' : 'Плата';
  }

  /* радиокнопки версий строим из тех же данных */
  var optsHost = $('#optsVersion');
  ORDER.forEach(function (id) {
    var v = VERSIONS[id];
    var label = document.createElement('label'); label.className = 'opt';
    var input = document.createElement('input'); input.type = 'radio'; input.name = 'version'; input.value = id;
    var body = document.createElement('span'); body.className = 'opt-body';
    var name = document.createElement('span'); name.className = 'opt-name'; name.textContent = v.name;
    var price = document.createElement('span'); price.className = 'opt-price'; setPrice(price, v.price);
    body.append(name, price); label.append(input, body); optsHost.appendChild(label);
  });
  $$('input[name=version]', form).forEach(function (r) {
    r.addEventListener('change', function () { state.version = r.value; render(); });
  });
  $$('input[name=board]', form).forEach(function (r) {
    r.addEventListener('change', function () { state.board = r.value; render(); });
  });

  /* ---------- отрисовка: первый экран, карточки сравнения, форма ---------- */
  var segBtns = $$('.segb[data-pick]');
  var cards = $$('.cfg[data-platform]');
  var kitBoxes = $$('input[data-kit]');
  var delta = VERSIONS.full.price - VERSIONS.board.price;

  function render() {
    var v = VERSIONS[state.version], p = platform();
    $('#heroPrice').textContent = rub(v.price, THIN);
    segBtns.forEach(function (b) {
      var on = b.dataset.pick === p;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (c) {
      var cp = c.dataset.platform;
      c.classList.toggle('sel', cp === p);
      if (cp !== 'case') {
        setPrice($('.bigprice', c), VERSIONS[state.version === 'full' ? 'full' : 'board'].price);
        $('.kit-val', c).textContent = state.version === 'full' ? 'в комплекте' : '—';
      }
    });
    kitBoxes.forEach(function (k) { k.checked = state.version === 'full'; });
    $$('input[name=caseBoard]').forEach(function (r) { r.checked = r.value === state.board; });
    $$('.kit-delta').forEach(function (d) { setPrice(d, delta); d.prepend('+'); });
    syncForm();
    /* схема: корпус под выбранную плату; сама плата внутри — для Малины и MiSTer, у «Корпуса» её нет */
    var withBoard = p !== 'case', vw = window.vsView;
    if (!vw || vw.board !== state.board || vw.withBoard !== withBoard) {
      window.vsView = { board: state.board, withBoard: withBoard };
      window.dispatchEvent(new CustomEvent('vs:platform', { detail: window.vsView }));
    }
  }
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      setPlatform(b.dataset.pick); render();
      track('select_version', { platform: b.dataset.pick, version: state.version });
    });
  });
  kitBoxes.forEach(function (k) {
    k.addEventListener('change', function () {
      var cp = k.closest('.cfg').dataset.platform;
      if (platform() !== cp) setPlatform(cp);
      state.version = k.checked ? 'full' : 'board'; render();
      track('select_version', { platform: platform(), version: state.version });
    });
  });

  /* подвыбор платы в карточке «Только корпус»: взаимоисключающий выбор Малина / MiSTer */
  $$('input[name=caseBoard]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.board = r.value; state.version = 'case'; render();
      track('select_version', { platform: 'case', version: state.version });
    });
  });

  /* выбор платформы кликом по карточке — кроме кнопки «Заказать», галочки комплектующих и подвыбора платы (у них свои действия) */
  cards.forEach(function (c) {
    c.addEventListener('click', function (e) {
      if (e.target.closest('button, a, .kit, .subpick')) return;
      if (platform() === c.dataset.platform) return;
      setPlatform(c.dataset.platform); render();
      track('select_version', { platform: platform(), version: state.version });
    });
  });

  /* ---------- открыть / закрыть форму ---------- */
  function clearErrors() {
    [emailErr, consentErr, formErr].forEach(function (e) { e.hidden = true; e.textContent = ''; });
    emailEl.removeAttribute('aria-invalid'); consentEl.removeAttribute('aria-invalid');
  }

  function openForm(place) {
    render();
    opener = document.activeElement;
    clearErrors();
    form.hidden = false; done.hidden = true; sending = false; submitBtn.disabled = false;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('lock');
    track('form_open', { place: place, version: state.version, board: state.board });
    setTimeout(function () { emailEl.focus(); }, 30);
  }
  function closeForm() {
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }
  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('lock');
    submitBtn.textContent = 'Оформить предзаказ';
    if (opener && opener.focus) opener.focus();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeForm(); });   /* клик по подложке */

  /* все кнопки «Заказать» и цели по data-goal */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-order]');
    if (btn) {
      if (btn.dataset.platform) setPlatform(btn.dataset.platform);
      track('click_order', { place: btn.dataset.place || '', version: state.version, board: state.board });
      openForm(btn.dataset.place || '');
      return;
    }
    if (e.target.closest('[data-close]')) { closeForm(); return; }
    var g = e.target.closest('[data-goal]');
    if (g) track(g.dataset.goal, { place: g.dataset.place || '' });
  });

  /* FAQ: событие toggle не всплывает — ловим в фазе захвата */
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.tagName === 'DETAILS' && d.open) track('faq_open', { question: ($('summary', d) || {}).textContent });
  }, true);

  /* ---------- проверка и отправка ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fail(el, errEl, msg) { errEl.textContent = msg; errEl.hidden = false; el.setAttribute('aria-invalid', 'true'); }

  function validate() {
    clearErrors();
    var ok = true, first = null;
    var email = emailEl.value.trim();
    if (!email) { fail(emailEl, emailErr, 'Укажите e-mail — на него придёт ответ.'); ok = false; first = first || emailEl; }
    else if (!EMAIL_RE.test(email)) { fail(emailEl, emailErr, 'Проверьте e-mail: похоже, в адресе опечатка.'); ok = false; first = first || emailEl; }
    if (!consentEl.checked) { fail(consentEl, consentErr, 'Без согласия на обработку данных заявку отправить нельзя.'); ok = false; first = first || consentEl; }
    if (first) first.focus();
    return ok;
  }

  function utm() {
    var o = {}, p = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'].forEach(function (k) { if (p.get(k)) o[k] = p.get(k); });
    return o;
  }

  function isLocal() { return /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname) || location.protocol === 'file:'; }

  function send(payload) {
    if (!cfg.ORDER_ENDPOINT) {
      if (isLocal()) { console.warn('[order] ORDER_ENDPOINT не задан — заявка не отправлена (локальный режим)', payload); return Promise.resolve(); }
      return Promise.reject(new Error('no-endpoint'));
    }
    return fetch(cfg.ORDER_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error('http-' + r.status); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending || !validate()) return;
    var honeypot = form.elements.company && form.elements.company.value;
    var v = VERSIONS[checkedRadio('version')] || VERSIONS[state.version];
    var board = checkedRadio('board') || state.board;
    var email = emailEl.value.trim();

    sending = true; submitBtn.disabled = true; submitBtn.textContent = 'Отправляю…'; formErr.hidden = true;

    function finish() {
      $('#doneEmail').textContent = email;
      $('#doneSub').textContent = v.name + ' · ' + BOARDS[board] + ' · ' + rub(v.price) + NBSP + '₽';
      form.hidden = true; done.hidden = false;
      var t = $('#doneTitle'); if (t) t.focus();
      form.reset();
      render();   /* reset сбрасывает радиокнопки — возвращаем текущий выбор */
    }

    if (honeypot) { finish(); return; }   /* бот: делаем вид, что приняли, ничего не отправляем и цель не считаем */

    window.vsClientId(function (clientId) {
      var payload = {
        email: email, version: v.id, version_name: v.name, board: board, price: v.price,
        company: honeypot || '',   /* honeypot: сервер тоже проверяет (защита при реплее) */
        consent: true, consent_at: new Date().toISOString(),
        page: location.origin + location.pathname, referrer: document.referrer || '',
        utm: utm(), ym_client_id: clientId
      };
      send(payload).then(function () {
        track('preorder', { version: v.id, board: board, price: v.price });   /* «оформленный предзаказ» — только после успешной отправки */
        finish();
      }).catch(function (err) {
        console.error('[order] ошибка отправки', err);
        sending = false; submitBtn.disabled = false; submitBtn.textContent = 'Оформить предзаказ';
        formErr.textContent = 'Не получилось отправить заявку. Попробуйте ещё раз или напишите нам в Telegram-канале.';
        formErr.hidden = false;
      });
    });
  });

  /* ссылка вида сайт/?platform=mister заранее выбирает платформу (case | pi | mister) */
  var qp = new URLSearchParams(location.search).get('platform');
  if (qp === 'case' || qp === 'pi' || qp === 'mister') setPlatform(qp);

  render();
  /* ссылка вида сайт/#order открывает форму сразу (для рекламы и постов) */
  if (location.hash === '#order') openForm('hash');
})();
