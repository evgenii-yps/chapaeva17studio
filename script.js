/* Чапаева 17 — interactions (vanilla JS) */
(function () {
  'use strict';
  var DATA = window.CH17_DATA || { promos: [], directions: [], team: [], troupe: [], faq: [] };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pageLoadedAt = Date.now();

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function rub(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- year ---------- */
  var yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = $('nav-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- логотип → плавно наверх, без #top в URL ---------- */
  var brand = document.querySelector('.site-header .brand');
  if (brand) {
    brand.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (window.history && history.replaceState) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    });
  }

  /* ---------- hero letter animation ---------- */
  var title = document.querySelector('[data-letters]');
  if (title) {
    var text = title.textContent.trim();
    title.textContent = '';
    var i = 0;
    text.split(' ').forEach(function (word, w, arr) {
      var wordSpan = el('span', 'word');
      wordSpan.style.whiteSpace = 'nowrap';
      word.split('').forEach(function (ch) {
        var span = el('span', 'ltr');
        span.textContent = ch;
        if (!reduceMotion) {
          span.style.opacity = '0';
          span.style.transform = 'translateY(0.25em)';
          span.style.transition = 'opacity .6s ease, transform .6s ease';
          span.style.transitionDelay = (i * 0.09) + 's';
        }
        wordSpan.appendChild(span);
        i++;
      });
      title.appendChild(wordSpan);
      if (w < arr.length - 1) { title.appendChild(document.createTextNode(' ')); i++; }
    });
    if (!reduceMotion) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          title.querySelectorAll('.ltr').forEach(function (s) {
            s.style.opacity = '1';
            s.style.transform = 'none';
          });
        });
      });
    }
  }

  /* ============================================================
     ПРОМО-СЧЁТЧИКИ (localStorage)
     ============================================================ */
  var counterEls = {}; // promoId -> [DOM nodes to update текстом N]
  function counterKey(id) { return 'ch17_promo_count_' + id; }

  function getCount(promo) {
    if (!promo.counter) return null;
    var key = counterKey(promo.id);
    var stored = null;
    try { stored = window.localStorage.getItem(key); } catch (e) {}
    var n = stored != null ? parseInt(stored, 10) : NaN;
    if (isNaN(n)) {
      n = promo.counter.current;
      try { window.localStorage.setItem(key, String(n)); } catch (e) {}
    }
    var min = promo.counter.min != null ? promo.counter.min : 1;
    if (n < min) n = min;
    return n;
  }
  function setCount(promo, n) {
    try { window.localStorage.setItem(counterKey(promo.id), String(n)); } catch (e) {}
    (counterEls[promo.id] || []).forEach(function (entry) {
      if (entry.type === 'num') entry.node.textContent = n;
      else if (entry.type === 'bar') entry.node.style.width = (n / promo.counter.total * 100) + '%';
      else if (entry.type === 'marquee') entry.node.textContent = entry.tpl.replace('{N}', n);
    });
  }
  function registerCounter(promoId, entry) {
    (counterEls[promoId] = counterEls[promoId] || []).push(entry);
  }

  function startCounterTicks() {
    DATA.promos.forEach(function (promo) {
      if (!promo.active || !promo.counter) return;
      var min = promo.counter.min != null ? promo.counter.min : 1;
      function tick() {
        var n = getCount(promo);
        if (n > min && Math.random() < 0.3) { setCount(promo, n - 1); }
        if (getCount(promo) > min) {
          setTimeout(tick, 3000 + Math.random() * 2000);
        }
      }
      if (getCount(promo) > min) setTimeout(tick, 3000 + Math.random() * 2000);
    });
  }

  /* ============================================================
     БЕГУЩАЯ СТРОКА
     ============================================================ */
  function renderMarquee() {
    var section = $('marquee');
    var track = $('marquee-track');
    if (!section || !track) return;
    var active = DATA.promos.filter(function (p) { return p.active && p.marquee; });
    if (!active.length) { section.hidden = true; return; }
    section.hidden = false;

    function buildItem(p) {
      var item = el('span', 'marquee-item');
      var raw = p.marquee;
      if (p.counterRef) {
        var ref = DATA.promos.filter(function (x) { return x.id === p.counterRef; })[0];
        var n = ref ? getCount(ref) : 0;
        item.textContent = raw.replace('{N}', n);
        if (ref) registerCounter(ref.id, { type: 'marquee', node: item, tpl: raw });
      } else if (p.emphasis && raw.indexOf(p.emphasis) !== -1) {
        var idx = raw.indexOf(p.emphasis);
        item.appendChild(document.createTextNode(raw.slice(0, idx)));
        item.appendChild(el('span', 'hl', esc(p.emphasis)));
        item.appendChild(document.createTextNode(raw.slice(idx + p.emphasis.length)));
      } else {
        item.textContent = raw;
      }
      return item;
    }

    // одна последовательность = все акции через разделитель
    function buildSequence() {
      var frag = document.createDocumentFragment();
      active.forEach(function (p) {
        frag.appendChild(buildItem(p));
        frag.appendChild(el('span', 'marquee-sep', '·'));
      });
      return frag;
    }

    // дублируем, пока ширина не превысит ~2× окна (минимум 2 копии для бесшовного цикла)
    track.appendChild(buildSequence());
    var guard = 0;
    while (track.scrollWidth < window.innerWidth * 1.5 && guard < 12) {
      track.appendChild(buildSequence());
      guard++;
    }
    // дублируем весь набор ещё раз — вторая половина для бесшовного цикла -50%.
    // N в бегущей строке фиксируется на значении при загрузке (живой апдейт —
    // только в карточке «Не упусти»); сбрасываем мёртвые ссылки на узлы.
    track.innerHTML = track.innerHTML + track.innerHTML;
    counterEls = {};
  }

  /* ============================================================
     НЕ УПУСТИ — карточки
     ============================================================ */
  function renderPromoCards() {
    var section = $('promos');
    var grid = $('promo-grid');
    var countEl = $('promos-count');
    if (!section || !grid) return;
    var active = DATA.promos.filter(function (p) { return p.active && p.title; });
    if (!active.length) { section.hidden = true; return; }
    section.hidden = false;
    if (countEl) countEl.textContent = active.length + ' активных';

    active.forEach(function (p) {
      var card = el('article', 'promo-card' + (p.hot ? ' promo-card--hot' : ''));

      if (p.tag) card.appendChild(el('span', 'promo-tag', esc(p.tag)));

      var titleHtml = esc(p.title);
      if (p.emphasis && p.title.indexOf(p.emphasis) !== -1) {
        titleHtml = esc(p.title).replace(esc(p.emphasis), '<span class="em">' + esc(p.emphasis) + '</span>');
      }
      card.appendChild(el('h3', 'promo-title', titleHtml));

      if (p.description) card.appendChild(el('p', 'promo-desc', esc(p.description)));

      if (p.counter) {
        var n = getCount(p);
        var counterWrap = el('div', 'promo-counter');
        var label = el('p', 'promo-counter-label', '<b>' + n + '</b> ' + esc(p.counter.label));
        var bar = el('div', 'promo-progress');
        var fill = el('span');
        fill.style.width = (n / p.counter.total * 100) + '%';
        bar.appendChild(fill);
        counterWrap.appendChild(label);
        counterWrap.appendChild(bar);
        card.appendChild(counterWrap);
        registerCounter(p.id, { type: 'num', node: label.querySelector('b') });
        registerCounter(p.id, { type: 'bar', node: fill });
      }

      var foot = el('div', 'promo-foot');
      var status = el('p', 'promo-status');
      status.appendChild(el('span', 'dot dot--pulse'));
      status.appendChild(document.createTextNode(p.status || p.meta || ''));
      foot.appendChild(status);

      var cta = el('button', 'promo-cta');
      cta.type = 'button';
      cta.innerHTML = esc(p.ctaText || 'Подробнее') + ' →';
      cta.addEventListener('click', function () { runCtaAction(p.ctaAction); });
      foot.appendChild(cta);

      card.appendChild(foot);
      grid.appendChild(card);
    });
  }

  function runCtaAction(action) {
    if (action === 'scroll-to-prices') scrollToId('prices');
    else if (action === 'scroll-to-form') scrollToId('booking');
    else if (action === 'open-direct') window.open(DATA.directOpenUrl || 'https://instagram.com/chapaeva17_studio', '_blank', 'noopener');
  }
  function scrollToId(id) {
    var t = $(id);
    if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ============================================================
     КОМАНДА
     ============================================================ */
  function renderTeam() {
    var grid = $('team-grid');
    if (!grid) return;
    DATA.team.forEach(function (t) {
      var card = el('li', 'team-card');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', t.name + ' — подробнее о тренере');

      var photo;
      if (t.photoJpg) {
        photo = el('div', 'team-card-photo');
        photo.innerHTML =
          '<picture>' +
          (t.photoWebp ? '<source srcset="' + t.photoWebp + '" type="image/webp">' : '') +
          '<img src="' + t.photoJpg + '" alt="' + esc(t.name) + '" loading="lazy" decoding="async">' +
          '</picture>';
      } else {
        photo = el('div', 'team-card-placeholder', esc(t.initials || ''));
        photo.setAttribute('aria-hidden', 'true');
      }
      card.appendChild(photo);

      var front = el('div', 'team-card-front');
      front.appendChild(el('span', 'team-card-hint', 'наведи ↘'));
      front.appendChild(el('h3', 'team-card-name', esc(t.name)));
      front.appendChild(el('p', 'team-card-role', esc(t.role)));
      card.appendChild(front);

      var back = el('div', 'team-card-back');
      var backInner = el('div');
      backInner.appendChild(el('p', 'team-card-name', esc(t.name)));
      backInner.appendChild(el('p', null, esc(t.bio)));
      back.appendChild(backInner);
      card.appendChild(back);

      card.addEventListener('click', function () { openTeamModal(t, card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTeamModal(t, card); }
      });
      grid.appendChild(card);
    });

    var troupeEl = $('troupe');
    if (troupeEl && DATA.troupe && DATA.troupe.length) {
      troupeEl.textContent = 'Также с нами работают: ' + DATA.troupe.join(' · ') + '.';
    }
  }

  /* ============================================================
     МОДАЛКА ТРЕНЕРА
     ============================================================ */
  var teamModal = $('team-modal');
  var teamModalOpener = null;

  /* Подбор направления формы по специализации тренера (для предзаполнения) */
  function matchDirection(role) {
    var options = ['Пилатес на оборудовании', 'Пилатес на матах', 'Хореография', 'Йога', 'Растяжка', 'Массаж и восстановление', 'Балетный интенсив'];
    var keywordMap = [
      { re: /пилатес/i, value: 'Пилатес на оборудовании' },
      { re: /балет|классик|хореограф|barre/i, value: 'Хореография' },
      { re: /йог|кундалини|виброакустик|хатха/i, value: 'Йога' },
      { re: /растяж|стрейч/i, value: 'Растяжка' },
      { re: /массаж|остеопат|восстановл/i, value: 'Массаж и восстановление' }
    ];
    var parts = String(role || '').split('·');
    for (var i = 0; i < parts.length; i++) {
      for (var k = 0; k < keywordMap.length; k++) {
        if (keywordMap[k].re.test(parts[i]) && options.indexOf(keywordMap[k].value) !== -1) {
          return keywordMap[k].value;
        }
      }
    }
    return null;
  }

  function teamModalFocusable() {
    if (!teamModal) return [];
    return [].slice.call(teamModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) { return !n.hasAttribute('disabled') && n.offsetParent !== null; });
  }

  function openTeamModal(t, opener) {
    if (!teamModal) return;
    teamModalOpener = opener || document.activeElement;

    var photo = $('team-modal-photo');
    if (t.photoJpg) {
      photo.className = 'team-modal-photo';
      photo.innerHTML =
        '<picture>' +
        (t.photoWebp ? '<source srcset="' + t.photoWebp + '" type="image/webp">' : '') +
        '<img src="' + t.photoJpg + '" alt="' + esc(t.name) + '" decoding="async">' +
        '</picture>';
    } else {
      photo.className = 'team-modal-photo team-modal-photo--placeholder';
      photo.innerHTML = '<span aria-hidden="true">' + esc(t.initials || '') + '</span>';
    }

    $('team-modal-name').textContent = t.name;

    var chips = $('team-modal-chips');
    chips.innerHTML = '';
    String(t.role || '').split('·').forEach(function (part) {
      var label = part.trim();
      if (label) chips.appendChild(el('li', 'team-modal-chip', esc(label)));
    });

    $('team-modal-bio').textContent = t.bio || '';

    var cta = $('team-modal-cta');
    var direction = matchDirection(t.role);
    cta.onclick = function () {
      var sel = $('f-direction');
      if (sel && direction) sel.value = direction;
      closeTeamModal(false);
      var target = $('booking');
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      var firstField = $('f-name');
      if (firstField) {
        setTimeout(function () { firstField.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
      }
    };

    teamModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { teamModal.classList.add('is-open'); });
    teamModal.querySelector('.team-modal-close').focus();
  }

  function closeTeamModal(returnFocus) {
    if (!teamModal || teamModal.hidden) return;
    teamModal.classList.remove('is-open');
    var done = function () {
      teamModal.hidden = true;
      teamModal.removeEventListener('transitionend', done);
    };
    if (reduceMotion) done();
    else {
      teamModal.addEventListener('transitionend', done);
      setTimeout(done, 320);
    }
    document.body.style.overflow = '';
    if (returnFocus !== false && teamModalOpener && typeof teamModalOpener.focus === 'function') {
      teamModalOpener.focus();
    }
  }

  if (teamModal) {
    teamModal.querySelector('.team-modal-close').addEventListener('click', closeTeamModal);
    teamModal.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeTeamModal();
    });
    document.addEventListener('keydown', function (e) {
      if (teamModal.hidden) return;
      if (e.key === 'Escape') { closeTeamModal(); return; }
      if (e.key === 'Tab') {
        var f = teamModalFocusable();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ============================================================
     АККОРДЕОНЫ (направления + FAQ)
     ============================================================ */
  function buildAccItem(opts) {
    // opts: num, name, sub, price, panelNodes[], idBase
    var item = el('div', 'acc-item');
    var btn = el('button', 'acc-head');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    var panelId = opts.idBase + '-panel';
    btn.setAttribute('aria-controls', panelId);

    if (opts.num) btn.appendChild(el('span', 'acc-num', opts.num));
    var titles = el('div', 'acc-titles');
    titles.appendChild(el('span', 'acc-name', esc(opts.name)));
    if (opts.sub) titles.appendChild(el('span', 'acc-sub', esc(opts.sub)));
    btn.appendChild(titles);
    if (opts.price) btn.appendChild(el('span', 'acc-price', opts.price));
    btn.appendChild(el('span', 'acc-toggle'));

    var panel = el('div', 'acc-panel');
    panel.id = panelId;
    panel.setAttribute('role', 'region');
    var inner = el('div', 'acc-panel-inner');
    opts.panelNodes.forEach(function (n) { inner.appendChild(n); });
    panel.appendChild(inner);

    item.appendChild(btn);
    item.appendChild(panel);
    return { item: item, btn: btn, panel: panel };
  }

  function wireAccordion(container) {
    var items = [].slice.call(container.querySelectorAll('.acc-item'));
    items.forEach(function (item) {
      var btn = item.querySelector('.acc-head');
      var panel = item.querySelector('.acc-panel');
      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        items.forEach(function (other) {
          if (other === item) return;
          other.classList.remove('is-open');
          other.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
          other.querySelector('.acc-panel').style.maxHeight = '';
        });
        if (isOpen) {
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          panel.style.maxHeight = '';
        } else {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
      });
    });
    // пересчёт высоты при ресайзе для открытого
    window.addEventListener('resize', function () {
      var open = container.querySelector('.acc-item.is-open .acc-panel');
      if (open) open.style.maxHeight = open.scrollHeight + 'px';
    });
  }

  function fmtFormatPrice(f) {
    if (f.price == null) return { text: 'tbd', tbd: true };
    var pre = '';
    if (f.prefix === '~') pre = '~';
    else if (f.prefix) pre = f.prefix + ' ';
    return { text: pre + rub(f.price), tbd: false };
  }

  function renderDirections() {
    var container = $('directions-accordion');
    if (!container) return;
    DATA.directions.forEach(function (d) {
      var desc = el('p', 'acc-desc', esc(d.description));
      var matrix = el('div', 'format-grid');
      (d.formats || []).forEach(function (f) {
        var fc = el('div', 'format-card');
        fc.appendChild(el('span', 'format-name', esc(f.name)));
        var p = fmtFormatPrice(f);
        fc.appendChild(el('span', 'format-price' + (p.tbd ? ' format-price--tbd' : ''), p.text));
        matrix.appendChild(fc);
      });
      var price = d.fixed ? rub(d.rangeFrom) : 'от ' + rub(d.rangeFrom);
      var built = buildAccItem({
        num: d.num, name: d.name, sub: d.sub, price: price,
        panelNodes: [desc, matrix], idBase: 'dir-' + d.id
      });
      container.appendChild(built.item);
    });
    wireAccordion(container);
  }

  function renderFaq() {
    var container = $('faq-accordion');
    if (!container) return;
    DATA.faq.forEach(function (item, idx) {
      var answer = el('p', 'acc-desc', esc(item.a));
      var built = buildAccItem({
        name: item.q, panelNodes: [answer], idBase: 'faq-' + idx
      });
      container.appendChild(built.item);
    });
    wireAccordion(container);
  }

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  renderMarquee();
  renderPromoCards();
  renderTeam();
  renderDirections();
  renderFaq();
  startCounterTicks();

  /* ---------- reveal on scroll ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(
    '.section-head, .promo-card, .about-epigraph, .about-text, .legacy-card, ' +
    '.team-card, .troupe, .acc-item, .space-item, .space-note, .trial-card, ' +
    '.booking-form-col, .booking-info, .contacts-map, .contacts-info'
  ));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (e) { e.classList.add('is-visible'); });
  } else {
    revealEls.forEach(function (e) { e.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (e) { io.observe(e); });
  }

  /* ---------- header theme inversion on dark sections ---------- */
  var header = document.querySelector('.site-header');
  var darkSections = [].slice.call(document.querySelectorAll('[data-header-theme="dark"], .section--dark'));
  if (header && darkSections.length) {
    var onScroll = function () {
      var line = header.offsetHeight * 0.5;
      var dark = darkSections.some(function (s) {
        var r = s.getBoundingClientRect();
        return r.top <= line && r.bottom >= line;
      });
      header.classList.toggle('is-dark', dark);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- prefill direction from CTA ---------- */
  var directionSelect = $('f-direction');
  document.querySelectorAll('[data-prefill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (directionSelect) directionSelect.value = btn.getAttribute('data-prefill');
    });
  });

  /* ---------- lightbox ---------- */
  var lightbox = $('lightbox');
  var lightboxImg = $('lightbox-img');
  var galleryButtons = [].slice.call(document.querySelectorAll('.gallery-item'));
  var currentIndex = 0;
  var lastFocused = null;

  function openLightbox(index) {
    currentIndex = index;
    var btn = galleryButtons[index];
    lightboxImg.src = btn.getAttribute('data-full');
    var img = btn.querySelector('img');
    lightboxImg.alt = img ? img.alt : '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lastFocused = document.activeElement;
    lightbox.querySelector('.lightbox-close').focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }
  function step(dir) {
    currentIndex = (currentIndex + dir + galleryButtons.length) % galleryButtons.length;
    openLightbox(currentIndex);
  }
  if (lightbox && galleryButtons.length) {
    galleryButtons.forEach(function (btn, idx) {
      btn.addEventListener('click', function () { openLightbox(idx); });
    });
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { step(-1); });
    lightbox.querySelector('.lightbox-next').addEventListener('click', function () { step(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------- toast ---------- */
  var toastEl = $('toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { toastEl.hidden = true; }, 320);
    }, 3500);
  }

  /* ---------- form submit ---------- */
  var form = $('booking-form');
  var status = $('form-status');
  var thanks = $('booking-thanks');

  function setStatus(msg, isError) {
    if (!status) return;
    status.textContent = msg || '';
    status.classList.toggle('is-error', !!isError);
  }
  function showThanks() {
    showToast('✓ Заявка отправлена. Напишем в течение часа');
    if (!thanks || !form) return;
    form.hidden = true;
    thanks.hidden = false;
    thanks.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus('');

      var data = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        channel: (form.querySelector('input[name="channel"]:checked') || {}).value || '',
        direction: form.direction.value,
        comment: form.comment.value.trim(),
        _honey: form._honey.value
      };

      if (data._honey || (Date.now() - pageLoadedAt) < 2000) { showThanks(); return; }
      if (data.name.length < 2) { setStatus('Пожалуйста, укажите имя.', true); form.name.focus(); return; }
      if (data.phone.length < 6) { setStatus('Пожалуйста, укажите телефон.', true); form.phone.focus(); return; }

      var submitBtn = form.querySelector('.btn-submit');
      submitBtn.disabled = true;
      var prevLabel = submitBtn.textContent;
      submitBtn.textContent = 'Отправляем…';

      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (res && res.ok) { showThanks(); }
          else { setStatus((res && res.error) || 'Не удалось отправить заявку. Попробуйте позвонить нам.', true); }
        })
        .catch(function () {
          setStatus('Нет связи с сервером. Попробуйте позже или напишите нам в Telegram.', true);
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = prevLabel;
        });
    });
  }
})();
