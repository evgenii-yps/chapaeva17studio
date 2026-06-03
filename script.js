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
  /* Letters are wrapped per word-group so the gap between «Чапаева» and
     «17» (margin on .hero-title-num) survives the per-letter splitting. */
  var title = document.querySelector('[data-letters]');
  if (title) {
    var groups = title.querySelectorAll(':scope > span');
    var i = 0;
    groups.forEach(function (group) {
      var word = group.textContent.trim();
      group.textContent = '';
      group.style.whiteSpace = 'nowrap';
      word.split('').forEach(function (ch) {
        var span = el('span', 'ltr');
        span.textContent = ch;
        if (!reduceMotion) {
          span.style.opacity = '0';
          span.style.transform = 'translateY(0.25em)';
          span.style.transition = 'opacity .6s ease, transform .6s ease';
          span.style.transitionDelay = (i * 0.09) + 's';
        }
        group.appendChild(span);
        i++;
      });
      i++; // stagger across the space between groups
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

  /* ---------- hero slider ---------- */
  (function () {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('.hero-dot'));
    if (slides.length < 2) return;

    var INTERVAL = 5000;
    var current = 0;
    var timer = null;

    function show(next) {
      if (next === current) return;
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      dots[current].removeAttribute('aria-current');
      current = next;
      slides[current].classList.add('is-active');
      dots[current].classList.add('is-active');
      dots[current].setAttribute('aria-current', 'true');
    }

    function advance() { show((current + 1) % slides.length); }

    function start() {
      if (reduceMotion || timer) return;
      timer = setInterval(advance, INTERVAL);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function restart() { stop(); start(); }

    dots.forEach(function (dot, idx) {
      dot.addEventListener('click', function () {
        show(idx);
        restart();
      });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') stop();
      else start();
    });

    start();
  })();

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
     НЕ УПУСТИ — карточки
     ============================================================ */
  function renderPromoCards() {
    var section = $('promos');
    var grid = $('promo-grid');
    var countEl = $('promos-count');
    if (!section || !grid) return;
    var trialCard = $('trial-promo-card');
    var active = DATA.promos.filter(function (p) { return p.active && p.title; });
    if (!active.length && !trialCard) { section.hidden = true; return; }
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
      if (trialCard) grid.insertBefore(card, trialCard);
      else grid.appendChild(card);
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

  /* ---------- equipment modal ---------- */
  (function () {
    var modal = $('equipment-modal');
    var trigger = document.querySelector('.space-tile[aria-controls="equipment-modal"]');
    var listEl = $('equipment-list');
    var closeBtn = modal && modal.querySelector('.equipment-modal-close');
    if (!modal || !trigger || !listEl) return;

    var opener = null;
    var items = (DATA.equipment || []);

    // render list
    listEl.innerHTML = items.map(function (it, idx) {
      var media = it.image
        ? '<picture class="equipment-slide-pic">' +
            (it.imageWebp ? '<source srcset="' + it.imageWebp + '" type="image/webp">' : '') +
            '<img src="' + it.image + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async">' +
          '</picture>'
        : '<div class="equipment-slide-soon" aria-hidden="true"><span>СКОРО</span></div>';
      var count = it.count > 1
        ? '<span class="equipment-slide-count">×' + it.count + '</span>'
        : '';
      return (
        '<li class="equipment-slide" data-index="' + (idx + 1) + '">' +
          '<div class="equipment-slide-media">' + media + '</div>' +
          '<div class="equipment-slide-body">' +
            '<h4 class="equipment-slide-name">' + esc(it.name) + count + '</h4>' +
            '<p class="equipment-slide-desc">' + esc(it.description || '') + '</p>' +
          '</div>' +
        '</li>'
      );
    }).join('');

    /* counter via IntersectionObserver */
    var counterEl = $('equipment-modal-counter');
    var total = items.length;
    if (counterEl) counterEl.textContent = '1 / ' + total;

    var io = null;
    function setupCounter() {
      if (io) io.disconnect();
      var slides = listEl.querySelectorAll('.equipment-slide');
      if (!slides.length || !('IntersectionObserver' in window)) return;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            var idx = entry.target.getAttribute('data-index');
            if (counterEl && idx) counterEl.textContent = idx + ' / ' + total;
          }
        });
      }, { root: listEl, threshold: [0.5, 0.75] });
      slides.forEach(function (s) { io.observe(s); });
    }

    function focusable() {
      if (!modal) return [];
      return Array.prototype.slice.call(
        modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return !el.hasAttribute('disabled'); });
    }

    function open(e) {
      if (e) e.preventDefault();
      opener = document.activeElement;
      modal.hidden = false;
      requestAnimationFrame(function () {
        modal.classList.add('is-open');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
        // сброс на первый слайд при каждом открытии (без плавной анимации)
        var prevBehavior = listEl.style.scrollBehavior;
        listEl.style.scrollBehavior = 'auto';
        listEl.scrollTop = 0;
        listEl.style.scrollBehavior = prevBehavior;
        if (counterEl) counterEl.textContent = '1 / ' + total;
        setupCounter();
      });
      document.body.style.overflow = 'hidden';
    }

    function close() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      var dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
      setTimeout(function () {
        modal.hidden = true;
        if (io) { io.disconnect(); io = null; }
        if (opener && typeof opener.focus === 'function') {
          opener.focus({ preventScroll: true });
        }
      }, dur);
    }

    trigger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var f = focusable();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  })();

  /* ---------- studio modal (gallery + lightbox) ---------- */
  (function () {
    var modal = $('studio-modal');
    var triggers = document.querySelectorAll('.space-tile[aria-controls="studio-modal"]');
    var galleryEl = $('studio-gallery');
    var closeBtn = modal && modal.querySelector('.studio-modal-close');
    if (!modal || !triggers.length || !galleryEl) return;

    var items = (DATA.studioPhotos || []);
    var opener = null;

    // render thumbnails
    galleryEl.innerHTML = items.map(function (it, idx) {
      return (
        '<li class="studio-thumb">' +
          '<button type="button" class="studio-thumb-btn" data-index="' + idx + '" aria-label="Открыть фото: ' + esc(it.alt) + '">' +
            '<picture>' +
              '<source srcset="' + it.imageWebp + '" type="image/webp">' +
              '<img src="' + it.image + '" alt="' + esc(it.alt) + '" loading="lazy" decoding="async">' +
            '</picture>' +
          '</button>' +
        '</li>'
      );
    }).join('');

    // lightbox elements
    var lb = $('studio-lightbox');
    var lbImg = $('studio-lightbox-img');
    var lbCounter = $('studio-lightbox-counter');
    var lbPrev = lb && lb.querySelector('.studio-lightbox-prev');
    var lbNext = lb && lb.querySelector('.studio-lightbox-next');
    var lbClose = lb && lb.querySelector('.studio-lightbox-close');
    var lbIndex = 0;

    function showLightbox(idx) {
      if (idx < 0 || idx >= items.length) return;
      lbIndex = idx;
      var it = items[idx];
      if (lbImg) {
        lbImg.src = it.image;
        lbImg.alt = it.alt;
      }
      if (lbCounter) lbCounter.textContent = (idx + 1) + ' / ' + items.length;
      if (lb) {
        lb.hidden = false;
        lb.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () { lb.classList.add('is-open'); });
      }
    }
    function hideLightbox() {
      if (!lb) return;
      lb.classList.remove('is-open');
      var dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
      setTimeout(function () {
        lb.hidden = true;
        lb.setAttribute('aria-hidden', 'true');
      }, dur);
    }
    function lightboxOpen() {
      return lb && !lb.hidden;
    }

    // thumbnail clicks
    galleryEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.studio-thumb-btn');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) showLightbox(idx);
    });

    // lightbox controls
    if (lbPrev) lbPrev.addEventListener('click', function () {
      showLightbox((lbIndex - 1 + items.length) % items.length);
    });
    if (lbNext) lbNext.addEventListener('click', function () {
      showLightbox((lbIndex + 1) % items.length);
    });
    if (lbClose) lbClose.addEventListener('click', hideLightbox);
    if (lb) lb.addEventListener('click', function (e) {
      // клик мимо изображения и контролов закрывает lightbox
      if (e.target === lb) hideLightbox();
    });

    // modal open/close
    function focusable() {
      if (!modal) return [];
      return Array.prototype.slice.call(
        modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return !el.hasAttribute('disabled'); });
    }
    function open(e) {
      if (e) e.preventDefault();
      opener = document.activeElement;
      modal.hidden = false;
      requestAnimationFrame(function () {
        modal.classList.add('is-open');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
      });
      document.body.style.overflow = 'hidden';
    }
    function close() {
      if (lightboxOpen()) { hideLightbox(); return; }
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      var dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
      setTimeout(function () {
        modal.hidden = true;
        if (opener && typeof opener.focus === 'function') {
          opener.focus({ preventScroll: true });
        }
      }, dur);
    }
    triggers.forEach(function (t) { t.addEventListener('click', open); });
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (lightboxOpen()) {
        if (e.key === 'Escape') { hideLightbox(); return; }
        if (e.key === 'ArrowLeft')  { showLightbox((lbIndex - 1 + items.length) % items.length); return; }
        if (e.key === 'ArrowRight') { showLightbox((lbIndex + 1) % items.length); return; }
        return;
      }
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var f = focusable();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  })();

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

  function buildPriceMatrix(prices) {
    var grid = el('div', 'format-grid');
    (prices || []).forEach(function (p) {
      var fc = el('div', 'format-card');
      fc.appendChild(el('span', 'format-name', esc(p.format)));
      var isTbd = !p.price || String(p.price).toLowerCase() === 'tbd';
      fc.appendChild(el('span', 'format-price' + (isTbd ? ' format-price--tbd' : ''), isTbd ? 'tbd' : esc(p.price)));
      grid.appendChild(fc);
    });
    return grid;
  }

  function buildPriceBlock(info) {
    var box = el('div', 'acc-price-box');
    box.appendChild(el('span', 'acc-price-eyebrow', info.label || 'Стоимость'));
    box.appendChild(el('span', 'acc-price-value', info.value || ''));
    box.appendChild(el('span', 'acc-price-sub', info.note || 'зависит от формата и длительности — уточняйте'));
    return box;
  }

  function renderDirections() {
    var container = $('directions-accordion');
    if (!container) return;
    DATA.directions.forEach(function (d) {
      var detail = el('div', 'acc-detail');

      var photo = el('div', 'acc-photo');
      if (d.image) {
        photo.innerHTML =
          '<picture>' +
          (d.imageWebp ? '<source srcset="' + d.imageWebp + '" type="image/webp">' : '') +
          '<img src="' + d.image + '" alt="' + esc(d.name) + '" loading="lazy" decoding="async">' +
          '</picture>';
      } else {
        photo.className = 'acc-photo acc-photo--placeholder';
        photo.innerHTML = '<span aria-hidden="true">' + esc(d.num || '') + '</span>';
      }
      detail.appendChild(photo);

      var content = el('div', 'acc-content');
      var desc = el('div', 'acc-desc-rich');
      String(d.longDescription || '').split('\n').forEach(function (line) {
        var t = line.trim();
        if (t) desc.appendChild(el('p', null, esc(t)));
      });
      content.appendChild(desc);
      if (d.priceNote && typeof d.priceNote === 'object') {
        content.appendChild(buildPriceBlock(d.priceNote));
      } else if (d.priceNote) {
        content.appendChild(el('p', 'acc-price-note', esc(d.priceNote)));
      } else {
        content.appendChild(buildPriceMatrix(d.prices));
      }

      var cta = el('button', 'btn btn-primary acc-cta', 'Записаться');
      cta.type = 'button';
      cta.addEventListener('click', function () {
        var sel = $('f-direction');
        if (sel) sel.value = d.name;
        var target = $('booking');
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        var firstField = $('f-name');
        if (firstField) {
          setTimeout(function () { firstField.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
        }
      });
      content.appendChild(cta);
      detail.appendChild(content);

      var price = d.fixed ? rub(d.rangeFrom) : (d.priceNote ? '' : 'от ' + rub(d.rangeFrom));
      var built = buildAccItem({
        num: d.num, name: d.name, price: price,
        panelNodes: [detail], idBase: 'dir-' + d.id
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
  renderPromoCards();
  renderTeam();
  renderDirections();
  renderFaq();
  startCounterTicks();

  /* ---------- reveal on scroll ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(
    '.section-head, .promo-card, .about-epigraph, .about-text, ' +
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

  /* ---------- transparent header over hero ---------- */
  (function () {
    var hdr = document.querySelector('.site-header');
    var hero = document.querySelector('.hero');
    if (!hdr || !hero) return;
    var threshold = 0;
    function measure() {
      var hh = hdr.offsetHeight;
      hero.style.marginTop = (-hh) + 'px';
      threshold = hero.offsetHeight - hh - 20;
    }
    function update() {
      hdr.classList.toggle('is-scrolled', window.scrollY > threshold);
    }
    var ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function () { update(); ticking = false; });
        ticking = true;
      }
    }
    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); });
  })();

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

  /* ---------- booking ---------- */
  // Запись ведётся виджетом YClients (iframe в секции #booking).
  // Прежняя форма #booking-form и serverless-обработчик /api/submit удалены.
})();
