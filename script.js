/* Чапаева 17 — interactions (vanilla JS) */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pageLoadedAt = Date.now();

  /* ---------- year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('nav-menu');
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

  /* ---------- hero letter animation (words kept unbreakable) ---------- */
  var title = document.querySelector('[data-letters]');
  if (title) {
    var text = title.textContent.trim();
    title.textContent = '';
    var i = 0;
    var words = text.split(' ');
    words.forEach(function (word, w) {
      var wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.style.whiteSpace = 'nowrap';
      word.split('').forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'ltr';
        span.textContent = ch;
        if (!reduceMotion) {
          span.style.opacity = '0';
          span.style.transform = 'translateY(0.25em)';
          span.style.transition = 'opacity .6s ease, transform .6s ease';
          span.style.transitionDelay = (i * 0.07) + 's';
        }
        wordSpan.appendChild(span);
        i++;
      });
      title.appendChild(wordSpan);
      if (w < words.length - 1) { title.appendChild(document.createTextNode(' ')); i++; }
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

  /* ---------- reveal on scroll ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(
    '.manifesto-inner, .section-head, .direction, .olesya, .olesya-gallery, .trainer-card, .troupe, .gallery > li, .intensive-inner, .contacts-info, .contacts-map, .booking-form'
  ));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- intensive → prefill direction ---------- */
  var directionSelect = document.getElementById('f-direction');
  document.querySelectorAll('[data-prefill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (directionSelect) directionSelect.value = btn.getAttribute('data-prefill');
    });
  });

  /* ---------- lightbox ---------- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
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
  if (lightbox) {
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

  /* ---------- form submit ---------- */
  var form = document.getElementById('booking-form');
  var status = document.getElementById('form-status');
  var thanks = document.getElementById('booking-thanks');

  function setStatus(msg, isError) {
    status.textContent = msg || '';
    status.classList.toggle('is-error', !!isError);
  }
  function showThanks() {
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

      // honeypot + too-fast submission = bot, silently "succeed"
      if (data._honey || (Date.now() - pageLoadedAt) < 2000) {
        showThanks();
        return;
      }
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
          setStatus('Нет связи с сервером. Позвоните: +7 906 276 29 99', true);
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = prevLabel;
        });
    });
  }
})();
