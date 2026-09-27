/* =================================================================
   Design B "Bento Playground" — interactions
   Classic script (file:// safe). Depends on: Deck, Chloe, Dither, qrcode.
   ================================================================= */
(function () {
  'use strict';

  var de = document.documentElement;
  var NAV_H = 64;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function stageScale(el) {
    var st = el.closest('.deck-stage');
    if (!st || de.classList.contains('deck-reflow')) return 1;
    var r = st.getBoundingClientRect();
    return r.width / 1920 || 1;
  }

  /* -- Toast ------------------------------------------------------ */
  var toastEl = $('.b-toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }

  /* -- Chloé sprites inside tiles (vector SVG, crisp at 4K) --------- */
  $$('.chloe-slot').forEach(function (slot) {
    try {
      Chloe.createSprite({
        state: slot.getAttribute('data-chloe') || 'idle',
        size: parseFloat(slot.getAttribute('data-size')) || 80,
        animate: true,
        float: slot.hasAttribute('data-float'),
        flipped: slot.hasAttribute('data-flip'),
        glow: slot.hasAttribute('data-float'),
        renderer: 'svg',
        mount: slot
      });
    } catch (e) {}
  });

  /* -- Dither strips (exact AlphaScan DitherTitlebar) --------------- */
  function paintDithers() {
    $$('[data-dither]').forEach(function (wrap) {
      var cv = wrap.querySelector('canvas');
      if (!cv) { cv = document.createElement('canvas'); wrap.appendChild(cv); }
      var w = wrap.offsetWidth, h = wrap.offsetHeight || 28;
      if (!w || cv.__w === w) return;
      cv.__w = w;
      try { Dither.paint(cv, { color: '#FFB2EF', bg: 'transparent', pixel: 3, direction: 'down', width: w, height: h }); } catch (e) {}
    });
  }

  /* -- QR (closing) ------------------------------------------------
     Only drawn when the deck knows a real address: content.json's qr.target, or the
     page's own URL when it is served from a real host. Otherwise the tile shows the
     cheat-sheet fallback (never a placeholder token). */
  $$('[data-qr]').forEach(function (box) {
    var target = window.DECK_URL || box.getAttribute('data-qr') || '';
    if (!target && /^https?:/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) target = location.origin + location.pathname;
    if (!target || target === 'DECK_URL_TBD') return;
    try {
      var qr = qrcode(0, 'M'); qr.addData(target); qr.make();
      var n = qr.getModuleCount(), d = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      box.innerHTML = '<svg viewBox="-1 -1 ' + (n + 2) + ' ' + (n + 2) + '" shape-rendering="crispEdges" role="img" aria-label="QR code for ' + target + '"><path d="' + d + '" fill="oklch(0.2 0.035 330)"/></svg>';
      box.setAttribute('data-zap', '');
      var tile = box.closest('.qr-tile'); if (tile) { tile.classList.add('has-qr'); var u = $('[data-qr-url]', tile); if (u && !u.textContent) u.textContent = target.replace(/^https?:\/\//, '').replace(/\/(index\.html)?$/, ''); }
    } catch (e) {}
  });

  /* -- Auto-fit titles so nothing is clipped inside its tile --------
     Only the headline shrinks (never below 64px); body copy keeps its 28px floor. */
  function fitTitles() {
    if (de.classList.contains('deck-reflow')) { $$('.b-title[data-fit]').forEach(function (h) { h.style.fontSize = ''; h.removeAttribute('data-fit'); }); return; }
    $$('.b-title').forEach(function (h) {
      var tile = h.closest('.tile'); if (!tile) return;
      h.style.fontSize = '';
      var fs = parseFloat(getComputedStyle(h).fontSize), guard = 0;
      var over = function () { return tile.scrollHeight > tile.clientHeight + 1 || h.scrollWidth > h.clientWidth + 2; };
      while (over() && fs > 64 && guard++ < 40) { fs -= 4; h.style.fontSize = fs + 'px'; h.setAttribute('data-fit', ''); }
    });
  }

  /* -- Deck --------------------------------------------------------- */
  Deck.init({ reflow: 900, replay: 'present', printWidth: 3840, exitWithFullscreen: false }); // Esc #1 leaves fullscreen, Esc #2 leaves present mode

  /* -- Stale-leave guard (SHARED-TODO: fix in shared/brand/deck.js go()) ----------
     deck.js schedules leave(prev) 520ms after an advance and never cancels it. Go back
     inside that window (or open the overview) and the stale timer strips 'is-in' from the
     slide you are looking at, blanking every tile. leave() emits 'slide:leave'
     synchronously, so we restore the classes in the same task: no frame is ever painted
     blank and no transition restarts. */
  function restoreIn(sec) {
    sec.classList.add('is-in');
    sec.classList.remove('is-leaving');
    $$('[data-animate]', sec).forEach(function (el) {
      el.classList.add('is-in');
      if (/^mask/.test(el.getAttribute('data-animate') || '')) el.classList.add('deck-done');
    });
    if (!de.classList.contains('deck-overview')) $$('video[data-autoplay]', sec).forEach(function (v) { if (!v.__userPaused) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
  }
  document.addEventListener('slide:leave', function (e) {
    var sec = e.target;
    if (!sec || !sec.matches || !sec.matches('[data-slide]')) return;
    if (de.classList.contains('deck-overview') || (Deck.isPresenting && sec === Deck.current())) restoreIn(sec);
  });
  Deck.on('deck:change', function (d) { if (d && d.slide && Deck.isPresenting) d.slide.classList.remove('is-leaving'); });

  // Fit the 1920x1080 stage BELOW the fixed navbar in website mode.
  function fit() {
    if (Deck.isPresenting || de.classList.contains('deck-overview') || de.classList.contains('deck-reflow')) return;
    var W = de.clientWidth || window.innerWidth, H = window.innerHeight, s;
    if (W / H >= 1.2) {
      s = Math.min(W / 1920, (H - NAV_H) / 1080);
    } else {
      s = W / 1920;
      de.style.setProperty('--deck-slide-h', Math.round(1080 * s + NAV_H) + 'px');
    }
    de.style.setProperty('--deck-scale', s.toFixed(5));
  }
  Deck.on('deck:layout', fit);
  // measure only once the deck has positioned the 1920 stages
  fitTitles(); paintDithers();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitTitles(); });
  window.addEventListener('resize', function () { clearTimeout(window.__pdT); window.__pdT = setTimeout(paintDithers, 200); });
  var wasReflow = de.classList.contains('deck-reflow');
  Deck.on('deck:layout', function () { var r = de.classList.contains('deck-reflow'); if (r !== wasReflow) { wasReflow = r; fitTitles(); paintDithers(); } });
  Deck.on('deck:mode', function () { setTimeout(fit, 0); });
  fit();

  /* -- Responsive image sizes from the real rendered box -------------
     object-fit:cover images are drawn wider (or taller) than their tile, and the
     stage is scaled, so a static vw "sizes" under-asks at 4K. Measure instead. */
  function fixSizes() {
    $$('img[srcset]').forEach(function (im) {
      // layout size (not the rect, which is scaled mid-transition) times the settled stage scale
      var st = im.closest('.deck-stage'), w = im.offsetWidth, h = im.offsetHeight, k = 1;
      if (!w || !h) return;
      if (st && !de.classList.contains('deck-reflow')) k = Deck.isPresenting ? Math.min(window.innerWidth / 1920, window.innerHeight / 1080) : (parseFloat(getComputedStyle(de).getPropertyValue('--deck-scale')) || st.getBoundingClientRect().width / 1920 || 1);
      var ar = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 3 / 2;
      var need = Math.ceil(Math.max(w, h * ar) * k);
      var cur = parseInt(im.getAttribute('sizes'), 10);
      if (!(cur >= need)) im.setAttribute('sizes', need + 'px');
    });
  }
  $$('img[srcset]').forEach(function (im) { if (!im.complete) im.addEventListener('load', fixSizes, { once: true }); });
  Deck.on('deck:layout', function () { setTimeout(fixSizes, 60); });
  Deck.on('deck:change', function () { setTimeout(fixSizes, 60); });
  window.addEventListener('load', fixSizes);
  // Print / PDF: ask for up to 2x the stage size so photos stay crisp on a 16x9in page.
  function printSizes() {
    $$('img[srcset]').forEach(function (im) {
      if (im.loading === 'lazy') im.loading = 'eager';
      var st = im.closest('.deck-stage'), k = st ? (st.getBoundingClientRect().width / 1920 || 1) : 1;
      var w = im.offsetWidth || im.getBoundingClientRect().width / k, h = im.offsetHeight || im.getBoundingClientRect().height / k;
      if (!w || !h) return;
      var ar = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 16 / 9;
      // 2x the stage box, capped at the 1920 source: tile photos never span more than half the page,
      // so this stays ~200dpi while keeping the PDF near the README's size (the 3840 files triple it).
      im.setAttribute('sizes', Math.min(1900, Math.ceil(Math.max(w, h * ar) * 2)) + 'px');
    });
  }
  /* Print uses local JPEG copies of the photos: Chrome re-encodes WebP losslessly into a PDF (~3 MB a photo),
     JPEG passes straight through. The screen srcset comes back after printing. */
  function printJpegs(on) {
    $$('img[srcset]').forEach(function (im) {
      var m = /\/((?:A|C)\d\d-[a-z0-9-]+)-\d+\.webp/.exec(im.getAttribute('srcset') || '');
      if (!m) return;
      if (on && !im.__scr) { im.__scr = [im.getAttribute('srcset'), im.getAttribute('src'), im.getAttribute('sizes')]; im.removeAttribute('srcset'); im.src = 'media/print/' + m[1] + '.jpg'; }
    });
    if (!on) $$('img').forEach(function (im) { if (im.__scr) { im.setAttribute('src', im.__scr[1]); im.setAttribute('sizes', im.__scr[2]); im.setAttribute('srcset', im.__scr[0]); im.__scr = null; } });
  }
  function printFit(on) { de.classList.toggle('deck-print', on); fitTitles(); }
  window.addEventListener('beforeprint', function () { printFit(true); });
  window.addEventListener('afterprint', function () { printJpegs(false); printFit(false); });
  var basePreparePrint = Deck.preparePrint;
  Deck.preparePrint = function () {
    printFit(true); printSizes(); printJpegs(true);
    return new Promise(function (r) { setTimeout(r, 60); }).then(function () { return basePreparePrint.apply(Deck, arguments); });
  };
  setTimeout(fixSizes, 300);

  /* -- Present HUD: shown only while the mouse moves (never on a key press), gone 1.5s later -- */
  var hudT = null, lastPtr = null;
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (lastPtr && Math.abs(e.clientX - lastPtr[0]) + Math.abs(e.clientY - lastPtr[1]) < 3) return; // synthetic / jitter
    lastPtr = [e.clientX, e.clientY];
    de.classList.add('b-hud-on'); clearTimeout(hudT);
    hudT = setTimeout(function () { de.classList.remove('b-hud-on'); }, 1500);
  }, { passive: true });

  /* -- Navbar -------------------------------------------------------- */
  var nav = $('.site-nav');
  var sectionOf = { intro: 'cover', collect: 'step-01-pinterest', prompt: 'step-05-spec', build: 'step-07-arena', ship: 'step-11-publish', example: 'example-1', home: 'teach-at-home', recap: 'recap', outro: 'recap' };
  function markNav(slide) {
    if (!slide) return;
    var key = sectionOf[slide.getAttribute('data-section')] || '';
    $$('.site-nav .links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === key); });
  }
  $$('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      Deck.go('#' + a.getAttribute('data-nav'));
      nav.classList.remove('open');
      var t = $('[data-nav-toggle]'); if (t) t.setAttribute('aria-expanded', 'false');
    });
  });
  var tog = $('[data-nav-toggle]');
  if (tog) tog.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    tog.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('[data-present]').forEach(function (b) { b.addEventListener('click', function () { Deck.present(true); }); });
  $$('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () {
      toast('Preparing the PDF…');
      Deck.preparePrint().then(function () { setTimeout(function () { window.print(); }, 150); });
    });
  });
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      var g = b.getAttribute('data-go');
      if (g === 'next') Deck.next(); else Deck.go(parseInt(g, 10) || 0);
    });
  });

  /* -- Spring tilt on tiles ----------------------------------------- */
  function Spring(k, c) { this.x = 0; this.v = 0; this.t = 0; this.k = k; this.c = c; }
  Spring.prototype.step = function (dt) { var a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; };
  Spring.prototype.rest = function () { return Math.abs(this.x - this.t) < 0.001 && Math.abs(this.v) < 0.001; };
  if (!REDUCED && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    $$('.tile[data-tilt]').forEach(function (tile) {
      var rx = new Spring(170, 13), ry = new Spring(170, 13), sc = new Spring(210, 14);
      var raf = null, last = 0;
      function tick(now) {
        var dt = Math.min(0.032, (now - (last || now)) / 1000 || 0.016); last = now;
        rx.step(dt); ry.step(dt); sc.step(dt);
        var ang = Math.sqrt(rx.x * rx.x + ry.x * ry.x);
        tile.style.rotate = ang > 0.01 ? (rx.x / ang).toFixed(4) + ' ' + (ry.x / ang).toFixed(4) + ' 0 ' + ang.toFixed(3) + 'deg' : '';
        tile.style.scale = sc.x > 0.0005 ? (1 + sc.x).toFixed(4) : '';
        if (rx.rest() && ry.rest() && sc.rest()) { raf = null; last = 0; if (!rx.t && !ry.t) tile.classList.remove('is-tilting'); return; }
        raf = requestAnimationFrame(tick);
      }
      function kick() { if (!raf) raf = requestAnimationFrame(tick); }
      tile.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || de.classList.contains('deck-overview')) return;
        var r = tile.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        var maxDeg = Math.max(2.5, 7 - r.width / 300);
        rx.t = -py * maxDeg; ry.t = px * maxDeg; sc.t = 0; /* no scale: a lifted tile must never cross the 80px safe margin */ tile.classList.add('is-tilting');
        kick();
      });
      tile.addEventListener('pointerleave', function () { rx.t = 0; ry.t = 0; sc.t = 0; rx.v += 20; kick(); });
    });
  }

  /* -- Stickers: click to boing ------------------------------------- */
  $$('.sticker-wrap').forEach(function (w) {
    w.addEventListener('click', function () {
      w.classList.remove('boing'); void w.offsetWidth; w.classList.add('boing');
      burst(w, 14);
    });
  });

  /* -- Mini confetti burst (DOM, used by tips/stickers) ------------- */
  var BURST_COLORS = ['#FFB2EF', 'oklch(0.935 0.15 121)', 'oklch(0.8 0.095 276)', 'oklch(0.69 0.19 38)', '#FFE45C'];
  function burst(el, n) {
    if (REDUCED || !el) return;
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < (n || 18); i++) {
      var p = document.createElement('i');
      var size = 6 + Math.random() * 7;
      p.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + cy + 'px;width:' + size + 'px;height:' + (size * (Math.random() < .5 ? 1 : .45)) + 'px;border-radius:' + (Math.random() < .4 ? '50%' : '2px') + ';background:' + BURST_COLORS[i % BURST_COLORS.length] + ';z-index:960;pointer-events:none;';
      document.body.appendChild(p);
      var a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
      var anim = p.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + (Math.cos(a) * d) + 'px), calc(-50% + ' + (Math.sin(a) * d + 40) + 'px)) rotate(' + (Math.random() * 540 - 270) + 'deg)', opacity: 0 }
      ], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' });
      anim.onfinish = (function (q) { return function () { q.remove(); }; })(p);
    }
  }

  /* -- Try-this check (remembered per viewer) ---------------------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  $$('.tip-check').forEach(function (b) {
    var id = b.getAttribute('data-tip-id');
    if (id && store('b-try:' + id) === '1') b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (id) store('b-try:' + id, on ? '1' : null);
      if (on) { burst(b, 22); toast('Nice! One step closer.'); }
    });
  });

  /* -- Copy buttons ------------------------------------------------- */
  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = $(btn.getAttribute('data-copy'));
      if (!src) return;
      var lbl = btn.querySelector('span');
      copyText(src.getAttribute('data-copy-text') || src.textContent).then(function () {
        btn.classList.add('done'); if (lbl) lbl.textContent = 'Copied!';
        burst(btn, 16); toast('Copied to your clipboard');
        setTimeout(function () { btn.classList.remove('done'); if (lbl) lbl.textContent = btn.getAttribute('data-copy-label') || 'Copy'; }, 1800);
      }, function () { toast('Select the text and copy it by hand'); });
    });
  });

  /* -- Step 05 template: hint <-> blank highlighting ----------------- */
  $$('[data-hint]').forEach(function (h) {
    var i = h.getAttribute('data-hint');
    var sec = h.closest('[data-slide]');
    var on = function (v) {
      h.classList.toggle('hot', v);
      $$('.blank[data-blank="' + i + '"]', sec).forEach(function (b) { b.classList.toggle('hot', v); });
    };
    h.addEventListener('pointerenter', function () { on(true); });
    h.addEventListener('pointerleave', function () { on(false); });
  });
  $$('.blank').forEach(function (b) {
    var i = b.getAttribute('data-blank'), sec = b.closest('[data-slide]');
    b.addEventListener('pointerenter', function () { var h = $('[data-hint="' + i + '"]', sec); if (h) h.classList.add('hot'); b.classList.add('hot'); });
    b.addEventListener('pointerleave', function () { var h = $('[data-hint="' + i + '"]', sec); if (h) h.classList.remove('hot'); b.classList.remove('hot'); });
  });

  /* -- Step 03 palette picker (recolors the slide) ------------------ */
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var f = function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  $$('[data-palette-picker]').forEach(function (picker) {
    var scope = picker.closest('[data-palette-scope]');
    function apply(cols) {
      cols.forEach(function (c, i) { scope.style.setProperty('--p' + (i + 1), c); });
      $$('[data-swatch]', scope).forEach(function (sw) {
        var i = +sw.getAttribute('data-swatch') - 1;
        sw.querySelector('[data-hex]').textContent = cols[i]; sw.setAttribute('aria-label', 'Copy ' + cols[i] + ' (' + sw.querySelector('.role').textContent + ')');
        sw.style.color = lum(cols[i]) > 0.35 ? cols[0] : cols[1];
      });
    }
    $$('[data-palette]', picker).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('[data-palette]', picker).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        apply(btn.getAttribute('data-palette').split(','));
        if (window.__chloe && !REDUCED && Math.random() < 0.5) window.__chloe.say('Ooh, ' + btn.querySelector('.name').textContent + '! Very stylish.', 2200);
      });
    });
    var first = $('[data-palette][aria-pressed="true"]', picker);
    if (first) apply(first.getAttribute('data-palette').split(','));
    $$('[data-swatch]', scope).forEach(function (sw) {
      var go = function () {
        var hex = sw.querySelector('[data-hex]').textContent;
        copyText(hex).then(function () { toast('Copied ' + hex); }, function () {});
        sw.classList.add('flash'); setTimeout(function () { sw.classList.remove('flash'); }, 900);
      };
      sw.addEventListener('click', go);
      sw.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  });

  /* -- Step 04 drag-to-reorder wireframe ---------------------------- */
  $$('[data-sortable]').forEach(function (list) {
    var tile = list.closest('.tile');
    var status = $('[data-wire-status]', tile);
    var okHTML = status ? status.innerHTML : '';
    function renumber() {
      var items = $$('.wire-item', list);
      items.forEach(function (it, i) { it.querySelector('.n').textContent = i + 1; it.setAttribute('aria-label', it.querySelector('.nm').textContent + ', position ' + (i + 1)); });
      var ok = items[0] && items[0].getAttribute('data-key') === 'navbar' && items[1] && items[1].getAttribute('data-key') === 'hero';
      if (!status) return;
      status.classList.toggle('bad', !ok);
      status.innerHTML = ok ? okHTML : '<span>Oops! Navbar first, then Hero</span>';
      if (ok && list.__wasBad) { burst(status, 20); if (window.__chloe) window.__chloe.say('Perfect order!', 1800); }
      list.__wasBad = !ok;
    }
    function flip(mutate) {
      var items = $$('.wire-item', list);
      var before = items.map(function (it) { return it.getBoundingClientRect().top; });
      mutate();
      if (REDUCED) return;
      var s = stageScale(list);
      items.forEach(function (it, i) {
        if (it.classList.contains('is-drag')) return;
        var dy = (before[i] - it.getBoundingClientRect().top) / s;
        if (Math.abs(dy) > 0.5) it.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      });
    }
    var drag = null;
    list.addEventListener('pointerdown', function (e) {
      var it = e.target.closest('.wire-item'); if (!it || e.button > 0) return;
      e.preventDefault();
      it.setPointerCapture(e.pointerId);
      drag = { it: it, y0: e.clientY, s: stageScale(list), id: e.pointerId };
      it.classList.add('is-drag');
    });
    list.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var it = drag.it;
      var dy = (e.clientY - drag.y0) / drag.s;
      it.style.transform = 'translateY(' + dy + 'px) rotate(' + Math.max(-2, Math.min(2, dy / 60)) + 'deg)';
      var r = it.getBoundingClientRect(), mid = r.top + r.height / 2;
      var prev = it.previousElementSibling, next = it.nextElementSibling;
      if (prev && mid < prev.getBoundingClientRect().top + prev.getBoundingClientRect().height / 2) {
        var h = (prev.getBoundingClientRect().height / drag.s) + 10;
        flip(function () { list.insertBefore(it, prev); });
        drag.y0 -= h * drag.s; it.style.transform = 'translateY(' + ((e.clientY - drag.y0) / drag.s) + 'px)';
        renumber();
      } else if (next && mid > next.getBoundingClientRect().top + next.getBoundingClientRect().height / 2) {
        var h2 = (next.getBoundingClientRect().height / drag.s) + 10;
        flip(function () { list.insertBefore(next, it); });
        drag.y0 += h2 * drag.s; it.style.transform = 'translateY(' + ((e.clientY - drag.y0) / drag.s) + 'px)';
        renumber();
      }
    });
    var end = function (e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var it = drag.it; drag = null;
      it.classList.remove('is-drag');
      var cur = it.style.transform; it.style.transform = '';
      if (!REDUCED && cur) it.animate([{ transform: cur }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      renumber();
    };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    // keyboard: Alt/Option + ArrowUp/Down moves the focused item
    list.addEventListener('keydown', function (e) {
      var it = e.target.closest('.wire-item'); if (!it) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!e.altKey) return;
      e.preventDefault(); e.stopPropagation();
      flip(function () {
        if (e.key === 'ArrowUp' && it.previousElementSibling) list.insertBefore(it, it.previousElementSibling);
        if (e.key === 'ArrowDown' && it.nextElementSibling) list.insertBefore(it.nextElementSibling, it);
      });
      it.focus(); renumber();
    });
    var sh = $('[data-shuffle]', tile);
    if (sh) sh.addEventListener('click', function () {
      flip(function () {
        var items = $$('.wire-item', list);
        for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = items[i]; items[i] = items[j]; items[j] = t; }
        if (items[0].getAttribute('data-key') === 'navbar' && items[1].getAttribute('data-key') === 'hero') items.push(items.shift());
        items.forEach(function (x) { list.appendChild(x); });
      });
      renumber();
    });
  });

  /* -- Step 06 Enhance prompt toggle -------------------------------- */
  $$('[data-enhance-btn]').forEach(function (btn) {
    var tile = btn.closest('.tile');
    var box = $('[data-enhance]', tile), cnt = $('[data-enh-count]', tile);
    var before = box.getAttribute('data-before'), after = box.getAttribute('data-after');
    var timer = null;
    function set(on) {
      clearInterval(timer);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      box.classList.toggle('is-before', !on);
      if (!on) { box.textContent = before; cnt.textContent = box.getAttribute('data-wc-before') + ' words'; return; }
      cnt.textContent = box.getAttribute('data-wc-before') + ' → ' + box.getAttribute('data-wc-after') + ' words';
      if (REDUCED || de.classList.contains('deck-print')) { box.textContent = after; return; }
      var i = 0; box.textContent = '';
      var caret = document.createElement('span'); caret.className = 'caret';
      timer = setInterval(function () {
        i = Math.min(after.length, i + 6);
        box.textContent = after.slice(0, i); box.appendChild(caret);
        box.scrollTop = box.scrollHeight;
        if (i >= after.length) { clearInterval(timer); caret.remove(); burst(cnt, 14); }
      }, 16);
    }
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      if (on && window.__chloe && !REDUCED) window.__chloe.zap(btn, { approach: false, silent: true });
      set(on);
    });
    btn.__set = set;
  });

  /* -- Step 08 pick a favorite -------------------------------------- */
  $$('[data-drafts]').forEach(function (g) {
    $$('[data-draft]', g).forEach(function (d) {
      d.addEventListener('click', function () {
        $$('[data-draft]', g).forEach(function (x) { x.setAttribute('aria-pressed', x === d ? 'true' : 'false'); });
        burst(d, 18);
      });
    });
  });

  /* -- Step 11 checklist ------------------------------------------- */
  $$('[data-checklist]').forEach(function (ul) {
    var tile = ul.closest('.tile');
    var meter = $('[data-check-meter]', tile), count = $('[data-check-count]', tile);
    var items = $$('.ck', ul);
    function upd() {
      var n = items.filter(function (li) { return li.getAttribute('aria-checked') === 'true'; }).length;
      if (meter) meter.style.setProperty('--v', n / items.length);
      if (count) count.textContent = n + ' / ' + items.length;
      if (n === items.length) { burst(meter, 30); toast('Published! Your site is live.'); if (window.__chloe) window.__chloe.setState('celebrating', 2500); }
    }
    items.forEach(function (li) {
      var t = function () { li.setAttribute('aria-checked', li.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); upd(); };
      li.addEventListener('click', t);
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
    });
    upd();
  });

  /* -- Pinterest "Save" -------------------------------------------- */
  $$('.pin .save').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = !b.classList.contains('saved');
      b.classList.toggle('saved', on); b.textContent = on ? 'Saved' : 'Save';
      if (on) burst(b, 10);
    });
  });

  /* -- Address bar typer --------------------------------------------- */
  $$('[data-typer]').forEach(function (el) {
    var word = el.getAttribute('data-typer');
    if (REDUCED) { el.textContent = word; return; }
    el.textContent = word; // final state is the default (print, no JS timing)
    // reserve the full word's width so nothing (Chloé included) ever settles where the word will be
    var reserve = function () {
      try {
        var t = document.createElement('span'); t.textContent = word; t.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
        el.parentNode.appendChild(t);
        var fs0 = parseFloat(getComputedStyle(t).fontSize) || 16, w = t.getBoundingClientRect().width / stageScale(el);
        t.remove();
        el.style.display = 'inline-block'; el.style.minWidth = (w / fs0).toFixed(3) + 'em';
      } catch (e) {}
    };
    reserve(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
    // Type the word once when its slide comes in, then keep it (only the caret blinks).
    var sec = el.closest('[data-slide]'), iv = null;
    function type() {
      clearInterval(iv); var i = 0; el.textContent = '';
      iv = setInterval(function () { i++; el.textContent = word.slice(0, i); if (i >= word.length) { clearInterval(iv); iv = null; } }, 80);
    }
    sec.addEventListener('slide:enter', function () { if (Deck.isPresenting && !de.classList.contains('deck-print')) type(); });
    Deck.on('deck:mode', function () { clearInterval(iv); el.textContent = word; });
  });

  /* -- Video: IntersectionObserver play/pause (deck also handles active slide) */
  /* Reduced motion: no autoplay anywhere. Poster + a play button instead. */
  if (REDUCED) {
    $$('video[data-autoplay]').forEach(function (v) {
      v.removeAttribute('data-autoplay'); v.removeAttribute('autoplay'); v.loop = false; try { v.pause(); } catch (e) {}
      // keep the (finished) poster on screen until Play: no preloaded first frame replaces it
      v.preload = 'none'; v.removeAttribute('data-start');
      { var srcs = $$('source', v).map(function (s) { return [s, s.getAttribute('src')]; }); srcs.forEach(function (x) { x[0].removeAttribute('src'); }); v.load(); srcs.forEach(function (x) { x[0].setAttribute('src', x[1]); }); v.__rmReload = true; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'rm-play'; b.setAttribute('aria-label', 'Play video');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
      b.addEventListener('click', function () { if (v.__rmReload) { v.__rmReload = false; v.load(); } v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); b.remove(); });
      var slot0 = v.closest('.tile') && v.closest('.tile').querySelector('[data-vid-slot]'); if (slot0) b.classList.add('in-foot'); (slot0 || v.parentNode).appendChild(b);
    });
  }
  if ('IntersectionObserver' in window && !REDUCED) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && en.intersectionRatio > 0.35) {
          if (Deck.isPresenting && !v.closest('[data-slide]').classList.contains('is-active')) return;
          v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else { try { v.pause(); } catch (e) {} }
      });
    }, { threshold: [0, 0.35, 0.6] });
    $$('video').forEach(function (v) { vio.observe(v); });
  }

  /* -- 4K projectors: swap to the native 2x clip when the frame is drawn wider than the 1.5x file -- */
  function hiClips() {
    $$('video[data-hi]').forEach(function (v) {
      if (v.__hi) return;
      var fr = v.parentNode.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (fr.width * dpr <= (parseFloat(v.getAttribute('data-hi-w')) || 1920) * 1.05) return;
      var b = v.getAttribute('data-hi'), t = v.currentTime || 0, play = !v.paused;
      v.__hi = true;
      $$('source', v).forEach(function (s) { s.src = b + (/webm/.test(s.type) ? '.webm' : '.mp4'); });
      v.load();
      if (t) v.addEventListener('loadedmetadata', function () { try { v.currentTime = t; } catch (e) {} }, { once: true });
      if (play && !REDUCED) { var q = v.play(); if (q && q.catch) q.catch(function () {}); }
    });
  }
  Deck.on('deck:layout', function () { setTimeout(hiClips, 120); });
  Deck.on('deck:change', function () { setTimeout(hiClips, 400); });
  window.addEventListener('load', hiClips);

  /* -- Clips that start on a finished frame (cover: the whole site, not an empty browser) */
  $$('video[data-start]').forEach(function (v) {
    var t0 = parseFloat(v.getAttribute('data-start')) || 0, done = false;
    var seek = function () { if (done) return; done = true; try { v.currentTime = t0; } catch (e) {} };
    if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
  });

  /* -- Confetti (closing) ------------------------------------------- */
  var confCanvas = $('[data-confetti-canvas]');
  var confRunning = false;
  function confetti() {
    if (!confCanvas || REDUCED || confRunning) return;
    if (!confCanvas.offsetParent && getComputedStyle(confCanvas).display === 'none') { burst($('[data-confetti]') || confCanvas.parentNode, 40); return; }
    var ctx = confCanvas.getContext('2d');
    var s = stageScale(confCanvas), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 1920, H = 1080, k = Math.max(0.5, s * dpr);
    confCanvas.width = Math.round(W * k); confCanvas.height = Math.round(H * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    var cols = ['#FFB2EF', '#E4F58C', '#A9B4F5', '#F2804E', '#FFE45C', '#FFFFFF'];
    var P = [];
    for (var i = 0; i < 260; i++) {
      var fromLeft = i % 2 === 0;
      P.push({
        x: fromLeft ? -20 : W + 20, y: H * (0.55 + Math.random() * 0.4),
        vx: (fromLeft ? 1 : -1) * (8 + Math.random() * 16), vy: -(14 + Math.random() * 18),
        w: 10 + Math.random() * 14, h: 6 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
        c: cols[i % cols.length], shape: Math.random() < .25 ? 1 : 0, life: 0
      });
    }
    confRunning = true;
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      var alive = 0;
      P.forEach(function (p) {
        p.vy += 0.42; p.vx *= 0.992; p.vy *= 0.992;
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        if (p.y < H + 40) alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.shape) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.4, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.life * 0.18)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      });
      if (alive && now - t0 < 6000) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); confRunning = false; }
    })(t0);
  }
  $$('[data-confetti]').forEach(function (b) { b.addEventListener('click', function () { confetti(); if (window.__chloe) window.__chloe.setState('celebrating', 2400); }); });


  /* -- Overview: thumbnails load every photo and show video posters ---- */
  /* Overview: land on a row boundary under the fixed header (one row of context above the
     current slide), so no thumbnail row is ever half hidden behind the header. */
  function alignOverview() {
    var cur = Deck.current(), hd = $('.deck-overview-title');
    if (!cur || !de.classList.contains('deck-overview')) return;
    var H0 = (hd ? hd.getBoundingClientRect().bottom : 64) + 24;
    var tops = []; Deck.slides.forEach(function (s) { var t = Math.round(s.getBoundingClientRect().top + window.scrollY); if (tops.indexOf(t) < 0) tops.push(t); });
    tops.sort(function (a, b) { return a - b; });
    var ci = tops.indexOf(Math.round(cur.getBoundingClientRect().top + window.scrollY));
    var want = tops[Math.max(0, ci - 1)] - H0;
    var maxS = document.documentElement.scrollHeight - window.innerHeight;
    var ok = tops.map(function (t) { return t - H0; }).filter(function (y) { return y <= maxS + 1; });
    var y = ok.length ? ok.reduce(function (b, v) { return Math.abs(v - want) < Math.abs(b - want) ? v : b; }, ok[0]) : 0;
    window.scrollTo(0, Math.max(0, y));
  }
  Deck.on('deck:overview', function (d) {
    if (!d || !d.on) return;
    setTimeout(alignOverview, 30);
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; im.decoding = 'sync'; });
    $$('video').forEach(function (v) { try { v.pause(); if (v.currentTime > 0.05 && v.getAttribute('poster')) v.load(); } catch (e) {} });
  });

  /* -- Media tiles: click (or Enter on the chip) pauses / plays the loop ---- */
  if (!REDUCED) $$('.media video').forEach(function (v) {
    var tile = v.closest('.tile'); if (!tile) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vid-toggle'; b.setAttribute('aria-label', 'Pause video'); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
    function sync() { var p = v.paused && v.__userPaused; b.setAttribute('aria-pressed', p ? 'true' : 'false'); b.setAttribute('aria-label', p ? 'Play video' : 'Pause video'); }
    function toggle() {
      if (v.paused) { v.__userPaused = false; var q = v.play(); if (q && q.catch) q.catch(function () {}); }
      else { v.__userPaused = true; v.pause(); }
      sync();
    }
    b.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    v.addEventListener('click', toggle);
    v.addEventListener('play', function () { if (v.__userPaused) v.pause(); sync(); });
    var slot = tile.querySelector('[data-vid-slot]');
    (slot || tile).appendChild(b);
  });
  /* -- Chloé: floating screenmate --------------------------------------
     Rules (design B, round 3):
     1. Present mode: she sits exactly on the slide's authored data-chloe-spot (stage px).
        Website mode: we search the visible stage for a spot where she covers no text,
        numerals, controls or [data-keep-clear] (hard no-go), preferring the authored spot.
     2. She never glides across a slide: every move is a quick fade-out / jump / fade-in.
     3. Her line waits for the build-in (1.4s), shows in one go in present mode, stays up
        >= 4s, and sits on whichever side of her is free of text. No free side = no bubble.
        Slides marked data-no-autozap get no line and no auto laser.
     4. Lasers only hit [data-zap] anchors on the CURRENT slide, from a perch whose beam
        crosses no text. Changing slides kills any laser that is planned or still drawing. */
  var GW = (window.Chloe && Chloe.GRID_W) || 32, GH = (window.Chloe && Chloe.GRID_H) || 42;
  // 64px at a 1920 viewport (scales with it), small enough to live in the 72-80px slide margins.
  // She scales with the stage (64px on the 1920 stage), so every authored spot means the same thing in
  // present mode, website mode and at 4K.
  function chloeSize() {
    if (narrow()) return 'auto';
    var k = Math.min(window.innerWidth / 1920, (window.innerHeight - (Deck.isPresenting ? 0 : NAV_H)) / 1080);
    // round 7: 96px on the 1920 stage (was 64): she has to read from the back row on light tiles too
    return Math.round(Math.max(56, Math.min(192, 96 * k)));
  }
  var chloe = window.__chloe = Chloe.mount({
    size: chloeSize(),
    interval: [24000, 32000],
    firstZap: 12000,
    home: 'bottom-right',
    roam: 0,
    zapQuipChance: 0,
    targets: function () { return zapTargets(true); }
  });

  function narrow() { return window.innerWidth < 700 || window.innerHeight < 420; }
  function topInset() { return Deck.isPresenting ? 0 : NAV_H; }
  function visibleSlides() {
    var cur = Deck.current();
    if (Deck.isPresenting || !cur) return cur ? [cur] : [];
    var vh = window.innerHeight;
    var l = Deck.slides.filter(function (s) { var r = s.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
    return l.length ? l : [cur];
  }
  function stageOf(sl) { return sl && (sl.querySelector('.deck-stage') || sl); }
  /** Stage -> viewport mapping. In present mode use the settled geometry (not the rect,
      which is mid-transition right after an advance). */
  function stageBox(sl) {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (Deck.isPresenting) {
      var k = Math.min(vw / 1920, vh / 1080);
      return { left: (vw - 1920 * k) / 2, top: (vh - 1080 * k) / 2, k: k, right: (vw + 1920 * k) / 2, bottom: (vh + 1080 * k) / 2 };
    }
    var st = stageOf(sl), r = st ? st.getBoundingClientRect() : { left: 0, top: 0, width: vw, right: vw, bottom: vh };
    return { left: r.left, top: r.top, k: (r.width / 1920) || 1, right: r.right, bottom: r.bottom };
  }

  /** Things Chloé and her bubble must not cover / beams must not cross.
      kind: 'text' (glyph boxes), 'solid' (numerals, controls, keep-clear), 'media' (photos, video). */
  var SOLID = '.browser .view, .demo-stage, .giant-circle, .pal-chips, .folder, button, a.b-link, a.b-btn, .sticker-wrap, .circle, .swatch, .wire-item, .draft, .ck, .qr-box svg, .url-xl, .typed, .stat-num, .giant-num, .ab, .tag-sticker, .badge, .tl-arrow, .rb-arrow, .blank, [data-keep-clear]';
  function obstacles(slides) {
    var out = [], vw = window.innerWidth, vh = window.innerHeight, rg = document.createRange();
    function push(q, kind, el) {
      if (q.width < 2 || q.height < 2 || q.right < 0 || q.bottom < 0 || q.left > vw || q.top > vh) return;
      out.push({ l: q.left, t: q.top, r: q.right, b: q.bottom, kind: kind, text: kind === 'text', el: el });
    }
    (slides || visibleSlides()).forEach(function (sc) {
      var tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT, null, false), n = 0;
      while (tw.nextNode() && n < 6000) {
        var tn = tw.currentNode; n++;
        if (!/\S/.test(tn.nodeValue)) continue;
        var pe = tn.parentElement;
        if (!pe || pe.closest('aside, script, style, [data-notes]')) continue;
        var cs = getComputedStyle(pe);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        rg.selectNodeContents(tn);
        var rs = rg.getClientRects();
        for (var i = 0; i < rs.length; i++) push(rs[i], 'text', pe);
      }
      // hand-drawn arrows: follow the stroke, not the (mostly empty) bounding box
      $$('.b-deco .arrow path', sc).forEach(function (pth) {
        try {
          var L = pth.getTotalLength(), M = pth.getScreenCTM(); if (!M) return;
          for (var d = 0; d <= L; d += 12) { var pt = pth.getPointAtLength(d), x = M.a * pt.x + M.c * pt.y + M.e, y = M.b * pt.x + M.d * pt.y + M.f; push({ left: x - 10, top: y - 10, right: x + 10, bottom: y + 10, width: 20, height: 20 }, 'solid', pth); }
        } catch (e) {}
      });
      $$(SOLID, sc).forEach(function (m) {
        var r = m.getBoundingClientRect();
        if (r.width * r.height > vw * vh * 0.4) return;
        push(r, 'solid', m);
      });
      $$('img, video', sc).forEach(function (m) {
        if (m.closest('.sticker-wrap')) return;
        var r = m.getBoundingClientRect();
        if (r.width * r.height > vw * vh * 0.5) return;
        // demo clips, pins and mocks are content: hard. Only a photo tile's backdrop is soft.
        push(r, m.closest('.tile.photo') && m.tagName === 'IMG' ? 'media' : 'solid', m);
      });
    });
    return out;
  }
  function ov(a, o) {
    var x = Math.min(a.r, o.r) - Math.max(a.l, o.l); if (x <= 0) return 0;
    var y = Math.min(a.b, o.b) - Math.max(a.t, o.t); return y > 0 ? x * y : 0;
  }
  /** Hard overlap (text/solid) and soft (media) of a rect. */
  function hit(box, obs) {
    var h = 0, m = 0;
    for (var i = 0; i < obs.length; i++) { var a = ov(box, obs[i]); if (!a) continue; if (obs[i].kind === 'media') m += a; else h += a; }
    return { hard: h, soft: m };
  }
  function spriteBox(x, y, pad) {
    var W = chloe.cssW, H = chloe.cssH, bob = 10 * (W / 64); pad = pad == null ? 8 : pad;
    return { l: x - pad, t: y - bob - pad, r: x + W + pad, b: y + H + pad };
  }
  /** Free resting spots in the visible stage, best first. s = 0 means no hard overlap. */
  function spots(obs, pref) {
    var W = chloe.cssW, H = chloe.cssH, k = W / 64, bob = 10 * k;
    var vw = window.innerWidth, vh = window.innerHeight, m = 12;
    var sr = safeRect(Deck.current()), tiles = tileRects(Deck.current(), 10 * sr.k);
    var x0 = Math.max(m, sr.l), x1 = Math.min(vw - m, sr.r) - W;
    var y0 = Math.max(m + topInset(), sr.t + bob), y1 = Math.min(vh - m, sr.b) - H;
    var list = [], step = 20;
    PBC = { sl: Deck.current(), S0: sr, tiles: tileRects(Deck.current(), 14 * sr.k) };
    function score(x, y) { var h = hit(spriteBox(x, y), obs); return (h.hard * 50 + h.soft) / (W * H); }
    if (pref) {
      var px = Math.min(Math.max(pref.x, x0), x1), py = Math.min(Math.max(pref.y, y0), y1);
      list.push({ x: px, y: py, s: score(px, py), pref: true });
    }
    for (var y = y0; y <= y1; y += step) for (var x = x0; x <= x1; x += step) list.push({ x: x, y: y, s: score(x, y) });
    list.forEach(function (c) {
      var d = pref ? Math.hypot(c.x - pref.x, c.y - pref.y) : 0;
      // a spot that also leaves room for her line wins over one that doesn't
      var bub = bubbleFits(c.x, c.y, obs) ? 0 : 0.6;
      var sb = spriteBox(c.x, c.y, 0), gutter = inAnyTile(sb, tiles) ? 0 : 0.8; // she sits inside a tile, not on a gutter
      c.rank = c.s * 40 + d / 600 + bub + gutter;
    });
    PBC = null;
    list.sort(function (a, b) { return a.rank - b.rank; });
    return list;
  }
  function prefSpot() {
    var cur = Deck.current();
    if (!cur) return null;
    var v = (cur.getAttribute('data-chloe-spot') || '').split(',').map(Number);
    if (v.length !== 2 || isNaN(v[0])) return null;
    var b = stageBox(cur);
    return { x: b.left + v[0] * b.k, y: b.top + v[1] * b.k };
  }
  function navDock() {
    var b = $('.site-nav .brand'), a = $('.site-nav .actions');
    var br = b ? b.getBoundingClientRect() : { right: 0 }, ar = a ? a.getBoundingClientRect() : { left: window.innerWidth };
    var gap = ar.left - br.right;
    // dock in the navbar only where she fits between the wordmark and the buttons; otherwise she
    // floats in the bottom-right corner, always below the sticky header (never over the wordmark)
    // phones: always the bottom-right corner, above the safe-area inset (never across the sticky header)
    if (!narrow() && gap > chloe.cssW + 24 && chloe.cssH + 16 <= NAV_H) return { x: br.right + (gap - chloe.cssW) / 2, y: Math.max(0, (NAV_H - chloe.cssH) / 2) };
    return { x: window.innerWidth - chloe.cssW - 12, y: Math.max(NAV_H + 8, window.innerHeight - chloe.cssH - 26) };
  }
  function restSpot() {
    if (!chloe) return { x: 0, y: 0 };
    if (narrow()) return navDock();
    var pref = prefSpot();
    if (Deck.isPresenting && pref) return pref; // authored spot is law in present mode
    // website mode: the same authored spot (audited at present geometry) when it is on screen and clear
    if (pref) {
      try {
        var sb0 = spriteBox(pref.x, pref.y, 0), vh0 = window.innerHeight;
        var ob0 = obstacles();
        if (sb0.t >= topInset() + 4 && sb0.b <= vh0 - 4 && !hit(spriteBox(pref.x, pref.y, 4), ob0).hard && bubbleFits(pref.x, pref.y, ob0)) return pref;
      } catch (e) {}
    }
    try { var l = spots(obstacles(), pref); if (l.length) return { x: l[0].x, y: l[0].y }; } catch (e) {}
    return { x: window.innerWidth - chloe.cssW - 24, y: window.innerHeight - chloe.cssH - 24 };
  }

  /* ---- speech bubble placement: the free side of her, or nowhere ---- */
  var BUB = { w: 460, h: 150, side: null };
  function bubbleRects(x, y, bw, bh) {
    var W = chloe.cssW, H = chloe.cssH, bob = 10 * (W / 64), g = 16;
    var cx = x + W / 2;
    return [
      { side: 'tl', tail: 0.82, l: cx - bw * 0.82, t: y - bob - bh - g },
      { side: 'tr', tail: 0.18, l: cx - bw * 0.18, t: y - bob - bh - g },
      { side: 'l', tail: null, l: x - bw - g, t: y + H / 2 - bh / 2 },
      { side: 'r', tail: null, l: x + W + g, t: y + H / 2 - bh / 2 },
      { side: 'bl', tail: 0.82, l: cx - bw * 0.82, t: y + H + g, below: true },
      { side: 'br', tail: 0.18, l: cx - bw * 0.18, t: y + H + g, below: true }
    ].map(function (c) { c.r = c.l + bw; c.b = c.t + bh; return c; });
  }
  /** The slide whose stage holds viewport point (x, y) (present mode: the current slide). */
  function slideAt(x, y) {
    if (Deck.isPresenting) return Deck.current();
    var l = visibleSlides();
    for (var i = 0; i < l.length; i++) { var r = stageOf(l[i]).getBoundingClientRect(); if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) return l[i]; }
    return Deck.current();
  }
  /** Safe frame: the slide's 80px (left/right) / 72px (top/bottom) outer margin, in viewport px. */
  function safeRect(sl) {
    var b = stageBox(sl), vw = window.innerWidth, vh = window.innerHeight;
    return { l: Math.max(4, b.left + 80 * b.k), t: Math.max(topInset() + 4, b.top + 72 * b.k), r: Math.min(vw - 4, b.right - 80 * b.k), b: Math.min(vh - 4, b.bottom - 72 * b.k), k: b.k };
  }
  /** Tile boxes of a slide, shrunk by an inner margin so a bubble never kisses a tile edge. */
  function tileRects(sl, inset) {
    // a tile made of inner cards (data-subtiles="<selector>") counts as those cards: Chloé's bubble never spans two
    var list = [];
    $$('.tile', sl).forEach(function (t) { var sub = t.getAttribute('data-subtiles'); if (sub) list = list.concat($$(sub, t)); else list.push(t); });
    return list.map(function (t) { var r = t.getBoundingClientRect(); return { l: r.left + inset, t: r.top + inset, r: r.right - inset, b: r.bottom - inset }; });
  }
  function inside(q, t) { return q.l >= t.l - 0.5 && q.t >= t.t - 0.5 && q.r <= t.r + 0.5 && q.b <= t.b + 0.5; }
  function inAnyTile(q, tiles) { for (var i = 0; i < tiles.length; i++) if (inside(q, tiles[i])) return true; return false; }
  /** Bubble side rule: inside the slide's safe frame, clear of text by 16 stage px, and the
      whole bubble inside ONE tile (never straddling a gutter). Present mode: the tile rule is
      hard. Website mode: preferred (tiles are smaller there), the safe frame is still hard. */
  var PBC = null; // per-search cache (spots() scores thousands of candidates)
  function pickBubble(x, y, obs, bw, bh) {
    var sl = PBC ? PBC.sl : slideAt(x + chloe.cssW / 2, y + chloe.cssH / 2);
    var S0 = PBC ? PBC.S0 : safeRect(sl), pad = 16 * S0.k;
    var tiles = PBC ? PBC.tiles : tileRects(sl, 14 * S0.k);
    var c = bubbleRects(x, y, bw, bh).filter(function (q) { return inside(q, S0); });
    var ok = [];
    for (var i = 0; i < c.length; i++) {
      var h = hit({ l: c[i].l - pad, t: c[i].t - pad, r: c[i].r + pad, b: c[i].b + pad }, obs);
      if (h.hard) continue;
      c[i].inTile = inAnyTile(c[i], tiles);
      if (c[i].inTile) return c[i];
      ok.push(c[i]);
    }
    return null; // no side keeps the whole bubble inside one tile: she stays quiet
  }
  function bubbleFits(x, y, obs) { var k = PBC ? Math.max(0.6, PBC.S0.k) : 1; return !!pickBubble(x, y, obs, BUB.w * k, BUB.h * k); }
  /** Place the bubble once per line (static, not bobbing); returns false if no side is free. */
  function placeBubble() {
    PBC = null;
    var b = chloe.bubble, obs = obstacles(Deck.isPresenting ? null : visibleSlides()), q = null, bw, bh;
    // measure at the layer origin: an absolutely positioned box near the right edge shrinks to fit
    b.style.left = '0px'; b.style.top = '0px';
    // widest bubble first; narrower (taller) ones when that is what fits inside a tile
    var widths = ['', '380', '310'], bk = parseFloat(getComputedStyle(de).getPropertyValue('--bk')) || 1;
    for (var wi = 0; wi < widths.length && !q; wi++) {
      b.style.maxWidth = widths[wi] ? (widths[wi] * bk) + 'px' : '';
      bw = b.offsetWidth || BUB.w; bh = b.offsetHeight || BUB.h;
      q = pickBubble(chloe.pos.x, chloe.pos.y, obs, bw, bh);
    }
    if (!q) { BUB.side = null; return false; }
    BUB.side = q; BUB.dx = q.l - chloe.pos.x; BUB.dy = q.t - chloe.pos.y;
    b.setAttribute('data-side', q.side);
    if (q.tail != null) { b.style.setProperty('--tail', (q.tail * 100) + '%'); b.style.setProperty('--ox', (q.tail * 100) + '%'); }
    return true;
  }

  /* ---- movement: fade, jump, fade (never glide over content) ---- */
  var jumpT = null, jumpRes = null;
  function jumpTo(x, y) {
    if (!chloe) return Promise.resolve();
    clearTimeout(jumpT);
    // a superseded jump still settles, so nothing waiting on it (a planned zap) hangs forever
    if (jumpRes) { var pr = jumpRes; jumpRes = null; chloe.el.style.opacity = '1'; pr(); }
    if (Math.hypot(x - chloe.pos.x, y - chloe.pos.y) < 3) return Promise.resolve();
    if (REDUCED || entering) return chloe.moveTo(x, y, 0);
    var el = chloe.el;
    el.style.transition = 'opacity .16s ease';
    el.style.opacity = '0';
    return new Promise(function (res) {
      jumpRes = res;
      jumpT = setTimeout(function () {
        jumpRes = null;
        chloe.moveTo(x, y, 0);
        el.style.opacity = '1';
        res();
      }, 170);
    });
  }
  /* Present mode: on a new slide she stays invisible while the tiles build, then floats in
     (12px rise + fade, 400ms) just before her line. */
  var entering = false, enterFx = null;
  function enterChloe(x, y) {
    var el = chloe.el;
    clearTimeout(jumpT); clearTimeout(enterFx);
    if (jumpRes) { var pr = jumpRes; jumpRes = null; pr(); }
    el.style.transition = 'none'; el.style.opacity = '0'; el.style.translate = REDUCED ? '' : '0 12px';
    entering = true;
    chloe.moveTo(x, y, 0);
    enterFx = setTimeout(function () {
      entering = false;
      el.style.transition = REDUCED ? 'none' : 'opacity .4s ease-out, translate .4s cubic-bezier(.22, 1, .36, 1)';
      el.style.opacity = '1'; el.style.translate = '0 0';
    }, REDUCED ? 0 : 950);
  }
  function goHome() { if (!chloe || chloe.zapping) return; var h = restSpot(); return jumpTo(h.x, h.y); }

  /* ---- laser planning ---- */
  var AUTO_OK = '.ab-row, .url-xl, .sticker-wrap, .tag-sticker, .badge-wrap, .qr-doc, .qr-box, .pal-chips, .circle, .ab-l, .ab-vs, .live-dot, .o3-folder, .sw-tag, .tl-arrow';
  function zapTargets(auto) {
    var cur = Deck.current();
    if (!cur) return [];
    if (auto && cur.hasAttribute('data-no-autozap')) return [];
    return $$('[data-zap]', cur).filter(function (el) {
      if (el.closest('[data-zap-no]')) return false;
      // her own timer only hits decoration (stickers, badges, circles, icons): beams never slice text the room
      // is reading. Manual L / double-click may hit any [data-zap] anchor.
      if (auto && !el.matches(AUTO_OK)) return false;
      var r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && r.top > topInset() && r.bottom < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    });
  }
  function segHits(x1, y1, x2, y2, o, pad) {
    var l = o.l - pad, t = o.t - pad, r = o.r + pad, b = o.b + pad;
    var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy], q = [x1 - l, r - x1, y1 - t, b - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { var u = q[i] / p[i]; if (p[i] < 0) { if (u > t1) return false; if (u > t0) t0 = u; } else { if (u < t0) return false; if (u < t1) t1 = u; } }
    }
    return true;
  }
  function beamClear(perch, el, obs) {
    var W = chloe.cssW, H = chloe.cssH, k = W / 64, r = el.getBoundingClientRect();
    // both eyes, at the top and bottom of her float bob
    var eyes = [], bob = 10 * k;
    [0, -bob].forEach(function (dy) { eyes.push({ x: perch.x + 9.5 / GW * W, y: perch.y + 14 / GH * H + dy }, { x: perch.x + 21.5 / GW * W, y: perch.y + 14 / GH * H + dy }); });
    var cy = r.top + r.height / 2, sw = Math.min(r.width * 0.9, 900), sx = r.left + (r.width - sw) / 2, pts = [];
    for (var i = 0; i <= 8; i++) pts.push({ x: sx + sw * i / 8, y: cy });
    pts.push({ x: sx + sw + 30 * k, y: cy - 50 * k });
    var pad = 10 * k + 6; // beam girth + glow
    for (var j = 0; j < obs.length; j++) {
      var o = obs[j];
      var blocks = o.text || o.kind === 'solid' || o.kind === 'media'; // beams never cross text, clips or photos
      if (!blocks || el.contains(o.el) || o.el.contains(el)) continue;
      if (o.el.tagName === 'path') continue; // hand-drawn arrows are decor, beams may cross them
      var tcx = r.left + r.width / 2, tcy = r.top + r.height / 2;
      if (o.kind !== 'text' && tcx > o.l && tcx < o.r && tcy > o.t && tcy < o.b) continue; // the target sits on this surface
      for (var e = 0; e < eyes.length; e++) for (var p = 0; p < pts.length; p++) if (segHits(eyes[e].x, eyes[e].y, pts[p].x, pts[p].y, o, pad)) return false;
    }
    return true;
  }
  function planZap(el, auto) {
    var cands = el ? [el] : zapTargets(auto);
    if (!cands.length) return null;
    var obs = obstacles(), home = restSpot();
    var ptiles = tileRects(Deck.current(), 10 * stageBox(Deck.current()).k);
    var free = spots(obs, null).filter(function (c) { return c.s < 0.01; });
    // perches inside a tile first (same rule as her resting spot); any free perch in the safe frame after that
    var tiers = [free.filter(function (c) { return inAnyTile(spriteBox(c.x, c.y, 0), ptiles); }).slice(0, 400), free.slice(0, 500)];
    cands = cands.slice().sort(function () { return Math.random() - 0.5; });
    for (var t = 0; t < tiers.length; t++) {
      var perches = tiers[t].slice(); perches.unshift({ x: home.x, y: home.y, s: 0 });
      for (var i = 0; i < cands.length; i++) {
        var r = cands[i].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        // a perch in the target's own tile wins: the beam never has to cross a gutter or another tile
        var tt = null; ptiles.forEach(function (q) { if (cx >= q.l && cx <= q.r && cy >= q.t && cy <= q.b) tt = q; });
        var ranked = perches.map(function (p) { var d = Math.hypot(p.x + chloe.cssW / 2 - cx, p.y - cy); var same = tt && inside(spriteBox(p.x, p.y, 0), tt); return { p: p, d: d, rank: Math.abs(d - 420) + (d < 150 ? 1e4 : 0) + (p === perches[0] ? -260 : 0) + (tt && !same ? 400 : 0) }; })
          .sort(function (a, b) { return a.rank - b.rank; });
        for (var j = 0; j < ranked.length; j++) if (beamClear(ranked[j].p, cands[i], obs)) return { el: cands[i], x: ranked[j].p.x, y: ranked[j].p.y };
      }
    }
    return null;
  }

  /* ---- laser kill switch: nothing planned on one slide may draw on the next ---- */
  var laserDead = false, inflight = null;
  function killLaser() {
    if (!chloe) return;
    laserDead = true;
    try { chloe.laser.show(false); chloe.laser.sparks = []; } catch (e) {}
    chloe.laserTarget = null;
    $$('.is-zap-target').forEach(function (x) { x.classList.remove('is-zap-target'); });
  }
  function onStage(el) { var cur = Deck.current(); return !!(el && el.isConnected && cur && cur.contains(el) && el.getClientRects().length); }

  if (chloe) {
    // gate the shared laser layer: once killed (or the target left the slide) it draws nothing
    var L = chloe.laser, baseDraw = L.draw.bind(L), baseBurst = L.burst.bind(L), curTarget = null;
    L.draw = function () { if (laserDead || (curTarget && !onStage(curTarget))) { L.show(false); return; } return baseDraw.apply(L, arguments); };
    L.burst = function () { if (laserDead) return; return baseBurst.apply(L, arguments); };

    var baseZap = chloe.zap.bind(chloe);
    chloe.zap = function (el, opts) {
      opts = opts || {};
      if (inflight || chloe.zapping) return inflight || Promise.resolve(false);
      if (narrow()) return Promise.resolve(false); // phones: she stays docked, no beams across content
      var at = Deck.index, plan = null;
      try { plan = planZap(el || null, !el && !opts.manual); } catch (e) { plan = null; }
      if (!plan) {
        de.setAttribute('data-zap-skipped', String(Date.now()));
        // manual L / double-click never feels dead: a wiggle and a one-line quip instead of a beam
        if (opts.manual) {
          chloe.setState('mischief', 1400);
          if (!REDUCED && chloe.canvas && chloe.canvas.animate) chloe.canvas.animate([{ rotate: '0deg' }, { rotate: '-12deg' }, { rotate: '10deg' }, { rotate: '-6deg' }, { rotate: '0deg' }], { duration: 620, easing: 'ease-in-out' });
          var q = ['Nothing to zap here. I\u2019ll behave.', 'Laser on standby. This slide is too pretty.', 'Saving my laser for the next slide.'];
          chloe.say(q[Math.floor(Math.random() * q.length)], 2600);
        }
        return Promise.resolve(false);
      }
      var stale = function () { return Deck.index !== at || !onStage(plan.el); };
      if (chloe.bubble) chloe.bubble.classList.remove('is-on');
      inflight = jumpTo(plan.x, plan.y).then(function () {
        if (stale()) return false;
        laserDead = false; curTarget = plan.el;
        $$('.is-zap-target').forEach(function (x) { x.classList.remove('is-zap-target'); });
        plan.el.classList.add('is-zap-target');
        de.setAttribute('data-zap-hit', (plan.el.className && plan.el.className.baseVal == null ? String(plan.el.className) : plan.el.tagName).slice(0, 60));
        return baseZap(plan.el, { approach: false, silent: true });
      }).then(function (r) {
        inflight = null; curTarget = null;
        setTimeout(function () { plan.el.classList.remove('is-zap-target'); if (!chloe.zapping && !inflight) goHome(); }, 900);
        return r;
      }, function () { inflight = null; curTarget = null; return false; });
      return inflight;
    };
    chloe.home = function () { return goHome() || Promise.resolve(); };
    chloe._home = restSpot;

    // say(): full line at once in present mode (fast type elsewhere), >= 4s after it completes,
    // bubble placed on her free side; no free side -> no bubble.
    var baseSay = chloe.say.bind(chloe);
    chloe.say = function (text, ms) {
      if (!text || narrow()) return chloe;
      var fast = true; // the whole line lands at once in every mode (a half-typed bubble reads as broken)
      var typeMs = fast ? 0 : Math.min(600, text.length * 22);
      var hold = Math.max(ms || 0, typeMs + 4200 + text.length * 18);
      var b = chloe.bubble;
      // the bubble scales with the stage (a 4K projector at 100% zoom gets a 4K-sized bubble)
      var sk = stageBox(Deck.current()).k; de.style.setProperty('--bk', Math.max(0.6, Math.min(2, sk)).toFixed(3));
      // measure with the full text first so placement knows the real size
      b.innerHTML = '<span class="chloe-who">' + chloe.o.name + '</span><span class="chloe-text"></span>';
      b.querySelector('.chloe-text').textContent = text;
      b.style.visibility = 'hidden'; b.classList.add('is-on');
      var ok = placeBubble();
      b.style.visibility = '';
      if (!ok) { b.classList.remove('is-on'); de.setAttribute('data-quip-skipped', String(Date.now())); return chloe; }
      if (fast) {
        if (chloe._typeIv) { clearInterval(chloe._typeIv); chloe._typeIv = null; }
        clearTimeout(chloe._sayT);
        chloe._sayT = setTimeout(function () { b.classList.remove('is-on'); }, hold);
        return chloe;
      }
      baseSay(text, hold);
      // speed the shared typewriter up so the whole line lands within ~600ms
      if (chloe._typeIv) {
        clearInterval(chloe._typeIv);
        var t = b.querySelector('.chloe-text'), i = 0, step = Math.max(1, Math.ceil(text.length / 27));
        t.textContent = '';
        chloe._typeIv = setInterval(function () { i += step; t.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(chloe._typeIv); chloe._typeIv = null; } }, 22);
      }
      return chloe;
    };
    // keep the bubble where we placed it (the shared loop would re-center it every frame)
    var baseLoop = chloe._loop;
    chloe._loop = function (now) {
      baseLoop.call(chloe, now);
      if (BUB.side && chloe.bubble.classList.contains('is-on')) {
        chloe.bubble.style.left = Math.round(chloe.pos.x + BUB.dx) + 'px';
        chloe.bubble.style.top = Math.round(chloe.pos.y + BUB.dy) + 'px';
      }
    };

    // L key: our planner instead of Chloé's built-in hotkey (same key, safe targets only)
    chloe.o.hotkey = null;
    window.addEventListener('keydown', function (e) {
      if ((e.key !== 'l' && e.key !== 'L') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault(); chloe.zap(null, { manual: true });
    });
    if (chloe._onDbl) { chloe.el.removeEventListener('dblclick', chloe._onDbl); chloe.el.addEventListener('dblclick', function () { chloe.zap(null, { manual: true }); }); }
    try { var h0 = restSpot(); chloe.moveTo(h0.x, h0.y, 0); } catch (e) {}
    window.addEventListener('resize', function () {
      var want = chloeSize(); if (want !== chloe.o.size) { chloe.o.size = want; chloe._resize(false); }
      clearTimeout(window.__chT); window.__chT = setTimeout(function () { if (!chloe.zapping) goHome(); }, 250);
    });
    window.addEventListener('scroll', function () { if (Deck.isPresenting) return; clearTimeout(window.__chS); window.__chS = setTimeout(function () { if (!chloe.zapping && !inflight && !Deck.isPresenting) goHome(); }, 260); }, { passive: true });
    Deck.on('deck:mode', function () { setTimeout(function () { var want = chloeSize(); if (want !== chloe.o.size) { chloe.o.size = want; chloe._resize(false); } killLaser(); goHome(); }, 80); });
  }

  // QA hook (read-only helpers for the spot audit script)
  window.__bentoChloe = { beamClear: beamClear, planZap: planZap, zapTargets: zapTargets, obstacles: obstacles, pickBubble: pickBubble, spriteBox: spriteBox, hit: hit, stageBox: stageBox, restSpot: restSpot, bub: BUB };

  // On entering a slide: jump to the spot now, then (after the build-in) say the line,
  // and maybe fire at the slide's hero anchor.
  var enterT = [], lastZapAt = 0;
  function clearEnter() { enterT.forEach(clearTimeout); enterT = []; }
  function buildInMs(sl) {
    var m = 0;
    // tiles (and what is inside them) must have settled before the bubble is placed; deco pops may still run
    $$('.b-grid [data-animate]', sl).forEach(function (el) { var d = parseFloat(el.getAttribute('data-delay')) || 0, u = parseFloat(el.getAttribute('data-duration')) || 900; if (d + u > m) m = d + u; });
    if (Deck.isPresenting) m += 180; // present mode: the incoming slide starts after the outgoing one fades
    return Math.min(2100, Math.max(Deck.isPresenting ? 1400 : 1200, m));
  }
  var lastEnter = { sl: null, at: 0 };
  function onDeckChange(d) {
    if (d.slide && lastEnter.sl === d.slide && Date.now() - lastEnter.at < 1200) return; // already entered (initial load)
    lastEnter = { sl: d.slide, at: Date.now() };
    markNav(d.slide);
    clearEnter();
    if (chloe) {
      killLaser();
      if (chloe.bubble) chloe.bubble.classList.remove('is-on'); // never carry a line onto the next slide
      clearTimeout(chloe._sayT);
    }
    if (Deck.isPresenting) setTimeout(fitTitles, 30);
    if (!d.slide || de.classList.contains('deck-overview') || !chloe) return;
    if (d.slide.id === 'closing') enterT.push(setTimeout(function () { if (Deck.current() === d.slide) confetti(); }, 900));
    if (Deck.isPresenting) { var hs = restSpot(); enterChloe(hs.x, hs.y); } // authored spot, known before layout settles
    var quiet = d.slide.hasAttribute('data-no-autozap');
    var sel = d.slide.getAttribute('data-zap-enter');
    var ln0 = d.slide.getAttribute('data-chloe-line');
    if (!chloe.__q0) chloe.__q0 = chloe.o.quips;
    chloe.o.quips = ln0 ? [ln0] : chloe.__q0;
    var zapDelay = d.slide.id === 'cover' ? 1000 : 6400; // the cover fires early: the room sees it first
    var wait = buildInMs(d.slide);
    enterT.push(setTimeout(function () {
      if (Deck.current() !== d.slide) return;
      if (!chloe.zapping && !inflight && !Deck.isPresenting) goHome();
      var line = d.slide.getAttribute('data-chloe-line');
      // she speaks unprompted only on beat slides (data-chloe-speak); elsewhere a click on her gives the line
      var speak = d.slide.hasAttribute('data-chloe-speak');
      var trySay = function (n) {
        if (Deck.current() !== d.slide) return;
        var hs0 = Deck.isPresenting ? restSpot() : null, away = hs0 && Math.hypot(hs0.x - chloe.pos.x, hs0.y - chloe.pos.y) > 4;
        if (chloe.zapping || inflight || away) { if (n < 24) enterT.push(setTimeout(function () { trySay(n + 1); }, 250)); return; }
        chloe.say(line);
      };
      if (line && speak && !quiet && !narrow()) enterT.push(setTimeout(function () { trySay(0); }, (d.slide.id === 'cover' && sel && !REDUCED) ? 1300 : (Deck.isPresenting ? 0 : 260))); // cover: laser first, then her line
      if (sel && !quiet && !REDUCED && Date.now() - lastZapAt > 8000) {
        var el = d.slide.querySelector(sel);
        if (el) { lastZapAt = Date.now(); enterT.push(setTimeout(function () { if (Deck.current() === d.slide && !chloe.zapping) chloe.zap(el, { silent: true }); }, zapDelay)); }
      }
    }, wait));
  }
  Deck.on('deck:change', onDeckChange);
  // the first slide never gets a deck:change: enter it once the page is up (the cover's line and its early laser)
  setTimeout(function () { var c = Deck.current(); if (c && lastEnter.sl !== c) onDeckChange({ slide: c, index: Deck.index }); }, 120);
  markNav(Deck.current());

  /* Keyboard: Space / Enter on a focused control activates the control; it never turns the slide.
     Listeners on the containers run before deck.js's document-level key handler. */
  var CTRL = 'button, a[href], input, select, textarea, [role="button"], [role="checkbox"], [role="listitem"][tabindex], [tabindex]:not([tabindex="-1"]):not([data-slide]):not(pre)';
  [$('#s-main'), $('.site-nav')].forEach(function (box) {
    if (!box) return;
    box.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      var t = e.target;
      var fv = true; try { fv = t.matches(':focus-visible'); } catch (x) {}
      // only a keyboard-focused control (a mouse click leaves no focus ring, so Space still advances)
      if (t && t !== box && t.matches && t.matches(CTRL) && fv) e.stopPropagation();
    });
  });
})();
