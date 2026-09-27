/* =================================================================
   Design A — "Cinematic Editorial" runtime
   Classic script (file:// safe). Uses globals from the shared kit:
   Deck (deck.js), Chloe (chloe.js), BgShaders + Dither (bg-shaders.js),
   CONTENT (js/content.js), qrcode (js/vendor/qrcode.js, MIT).
   ================================================================= */
(function () {
  'use strict';

  var de = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var CONTENT = window.CONTENT || { slides: [], blocks: {} };
  var byId = {};
  CONTENT.slides.forEach(function (s) { byId[s.id] = s; });

  /* ---------------------------------------------------------------
     Boot the deck (website scroll + present + print)
     --------------------------------------------------------------- */
  Deck.init({ reflow: 820, replay: 'present', printWidth: 3840 });
  // First WebGL context creation can block the main thread for a second or more on some
  // drivers; mount the shader backgrounds after the first paint instead of during parse.
  if (window.BgShaders) {
    var mountShaders = function () { if (!mountShaders.done) { mountShaders.done = true; BgShaders.autoMount(); } };
    requestAnimationFrame(function () { setTimeout(mountShaders, 30); });
    window.addEventListener('beforeprint', mountShaders);
  }

  /* ---------------------------------------------------------------
     Dither seams between slides (static, exact Bayer 8x8)
     --------------------------------------------------------------- */
  function paintSeams() {
    if (!window.Dither) return;
    $$('.seam').forEach(function (cv) {
      var sec = cv.parentElement;
      var px = Math.max(2, Math.round(4 * Math.min(1.5, sec.clientWidth / 1920)));
      Dither.paint(cv, { color: '#080808', bg: 'transparent', pixel: px, direction: 'up', width: sec.clientWidth, height: 36 });
      // split slides: the ink dither only shows over the photo half, so it fades out over 80px before
      // the split seam instead of stopping dead there
      var hp = sec.querySelector('.half-photo'), sr = sec.getBoundingClientRect();
      if (hp && sr.width && !de.classList.contains('deck-reflow')) {
        var hr = hp.getBoundingClientRect(), k = sr.width / 1920, f = 80 * k;
        var m = hp.classList.contains('hp-r')
          ? 'linear-gradient(90deg, transparent ' + Math.round(hr.left - sr.left) + 'px, #000 ' + Math.round(hr.left - sr.left + f) + 'px)'
          : 'linear-gradient(90deg, #000 ' + Math.round(hr.right - sr.left - f) + 'px, transparent ' + Math.round(hr.right - sr.left) + 'px)';
        cv.style.webkitMaskImage = m; cv.style.maskImage = m;
      } else { cv.style.webkitMaskImage = ''; cv.style.maskImage = ''; }
    });
  }
  paintSeams();
  Deck.on('deck:layout', function () { paintSeams(); fitReflow(); });

  /* ---------------------------------------------------------------
     Parallax on bleed photos (website mode only)
     --------------------------------------------------------------- */
  var slides = Deck.slides;
  var ticking = false;
  function parallax() {
    ticking = false;
    if (reduced || Deck.isPresenting || de.classList.contains('deck-overview') || de.classList.contains('deck-reflow')) return;
    var vh = window.innerHeight;
    slides.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.bottom < -vh * 0.2 || r.top > vh * 1.2) return;
      var p = Math.max(-1, Math.min(1, r.top / vh));
      s.style.setProperty('--p', p.toFixed(4));
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
  parallax();

  /* ---------------------------------------------------------------
     Navbar: active group, auto-hide, slides menu, burger, actions
     --------------------------------------------------------------- */
  var nav = $('.topnav');
  var navMap = { intro: 'cover', collect: 'chapter-collect', prompt: 'chapter-prompt', build: 'chapter-build', ship: 'chapter-ship', example: 'example-1', home: 'teach-at-home', recap: 'recap', outro: 'recap' };
  function markNav(i) {
    var s = slides[i]; if (!s) return;
    var target = navMap[s.getAttribute('data-section')];
    $$('.nav-links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === target); });
    $$('.slide-list a').forEach(function (a, j) { a.classList.toggle('on', j === i); });
  }
  markNav(Deck.index);
  var menu = $('.slides-menu');
  var lastY = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (!nav) return;
    var keep = nav.classList.contains('menu-open') || pointerY < 80 || (menu && menu.classList.contains('open'));
    if (y > lastY + 6 && y > 120 && !keep) nav.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 40) nav.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });
  var pointerY = 999;
  document.addEventListener('mousemove', function (e) { pointerY = e.clientY; if (nav && e.clientY < 70) nav.classList.remove('is-hidden'); }, { passive: true });

  if (menu) {
    var mb = $('button', menu);
    mb.addEventListener('click', function (e) { e.stopPropagation(); var on = !menu.classList.contains('open'); menu.classList.toggle('open', on); mb.setAttribute('aria-expanded', on); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) { menu.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  }
  var burger = $('.nav-burger');
  if (burger) burger.addEventListener('click', function () { var on = !nav.classList.contains('menu-open'); nav.classList.toggle('menu-open', on); burger.setAttribute('aria-expanded', on); });
  $$('.topnav a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1); var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (menu) menu.classList.remove('open');
      nav.classList.remove('menu-open');
      Deck.go('#' + id);
    });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'present') Deck.present(true);
    if (act === 'pdf') printDeck();
  });

  /* ---------------------------------------------------------------
     Copy buttons
     --------------------------------------------------------------- */
  var toastEl = $('.toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (err) { rej(err); } ta.remove();
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy], [data-copy-text]'); if (!b) return;
    var key = b.getAttribute('data-copy');
    var text = key ? (CONTENT.blocks[key] && CONTENT.blocks[key].text) : b.getAttribute('data-copy-text');
    if (!text) return;
    copyText(text).then(function () {
      b.classList.add('done');
      var lbl = $('span', b); var old = lbl && lbl.textContent;
      if (lbl && key) lbl.textContent = 'Copied!';
      setTimeout(function () { b.classList.remove('done'); if (lbl && key) lbl.textContent = old; }, 1600);
      toast(key ? 'Copied! Paste it anywhere' : 'Copied ' + text);
      if (chloe) chloe.setState('celebrating', 1400);
    }, function () { toast('Select the text and copy it by hand'); });
  });

  /* ---------------------------------------------------------------
     Videos: 4K hero on big screens; play only what is on screen
     --------------------------------------------------------------- */
  $$('video[data-hires]').forEach(function (v) {
    var big = (window.screen ? Math.max(screen.width, screen.height) : 1920) * (window.devicePixelRatio || 1) >= 2600;
    if (!big) return;
    var name = v.getAttribute('data-hires');
    var srcs = $$('source', v);
    if (srcs[0]) srcs[0].src = '../shared/video/' + name + '.webm';
    if (srcs[1]) srcs[1].src = '../shared/video/' + name + '.mp4';
    v.load();
  });
  // design-local derived clips (video/*) carry their own 4K variant
  $$('video[data-hires-local]').forEach(function (v) {
    var big = (window.screen ? Math.max(screen.width, screen.height) : 1920) * (window.devicePixelRatio || 1) >= 2600;
    var name = v.getAttribute('data-hires-local');
    $$('source[data-src]', v).forEach(function (s) {
      var src = s.getAttribute('data-src');
      s.src = big ? src.replace(/arena-stage\./, name + '.') : src;
    });
    v.load();
    // load() aborts any pending play(): retry once the new source can play
    v.addEventListener('loadeddata', function () { syncVideos(); }, { once: true });
  });
  function play(v) { if (!v.paused) return; try { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  function pause(v) { try { if (!v.paused) v.pause(); } catch (e) {} }
  var vids = $$('.sl video');
  var vidVisible = new Map();
  if (window.IntersectionObserver) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        vidVisible.set(en.target, en.isIntersecting && en.intersectionRatio >= 0.35);
        if (Deck.isPresenting) return;
        if (vidVisible.get(en.target) && !reduced) play(en.target); else pause(en.target);
      });
    }, { threshold: [0, 0.35, 0.7] });
    vids.forEach(function (v) { vio.observe(v); });
  }
  function syncVideos() {
    if (!Deck.isPresenting) { vids.forEach(function (v) { if (vidVisible.get(v) && !reduced) play(v); else pause(v); }); return; }
    var cur = Deck.current();
    vids.forEach(function (v) { if (cur && cur.contains(v) && !reduced) play(v); else pause(v); });
  }
  if (reduced) vids.forEach(function (v) { v.removeAttribute('autoplay'); pause(v); });

  /* ---------------------------------------------------------------
     Present-mode dither wipe (chapter dividers only).
     The OUTGOING slide stays on screen under the wipe: the new divider is revealed behind a
     moving clip edge, and a true Bayer 8x8 dithered front (7px cells, --gs-base at the leading
     edge, --gs-mid behind it) eats the old slide into the new one. 650ms, ease-out; the giant
     word lands about 150ms after the wipe clears (its data-delay).
     --------------------------------------------------------------- */
  var BAYER = [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]];
  var wipe = $('.dither-wipe'), wipeRAF = 0, wipeEnd = null;
  // --gs-mid (oklch .35 .05 340) and --gs-base (#FFB2EF) in sRGB, for ImageData
  var WIPE_MID = [76, 52, 68], WIPE_BASE = [255, 178, 239];
  function ditherWipe(dir, from, to) {
    if (!wipe || reduced) return;
    if (wipeEnd) wipeEnd();
    var W = window.innerWidth, H = window.innerHeight;
    var cell = Math.max(6, Math.min(8, Math.round(7 * Math.max(W / 1920, 1))));
    var cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    wipe.width = cols; wipe.height = rows;
    wipe.style.display = 'block';
    var ctx = wipe.getContext('2d');
    var img = ctx.createImageData(cols, rows), d = img.data;
    var mid = WIPE_MID, base = WIPE_BASE;
    var BAND = 0.2; // width of the dithered front, in screen widths
    var t0 = performance.now(), DUR = 650;
    if (from && from !== to) from.classList.add('wipe-out');
    if (to) { to.classList.add('wipe-in'); to.style.clipPath = dir < 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'; }
    var tr = to ? to.getBoundingClientRect() : { left: 0, width: W };
    wipeEnd = function () {
      cancelAnimationFrame(wipeRAF); wipeEnd = null;
      wipe.style.display = 'none';
      if (from) from.classList.remove('wipe-out');
      if (to) { to.classList.remove('wipe-in'); to.style.clipPath = ''; }
    };
    cancelAnimationFrame(wipeRAF);
    var step = function (now) {
      var t = Math.min(1, (now - t0) / DUR);
      var e = 1 - Math.pow(1 - t, 3);                      // ease-out: fast bite, soft landing
      var front = -BAND + e * (1 + 2 * BAND);          // leading edge position, 0..1 across the screen
      var edge = front - BAND * 0.5;                   // the clip edge runs through the middle of the band
      if (to) {
        var lx = Math.max(0, Math.min(1, ((dir < 0 ? 1 - edge : edge) * W - tr.left) / (tr.width || W)));
        to.style.clipPath = dir < 0 ? 'inset(0 0 0 ' + (lx * 100).toFixed(2) + '%)' : 'inset(0 ' + ((1 - lx) * 100).toFixed(2) + '% 0 0)';
      }
      for (var y = 0; y < rows; y++) {
        var by = BAYER[y & 7];
        for (var x = 0; x < cols; x++) {
          var u = dir < 0 ? 1 - x / cols : x / cols;
          var k = (y * cols + x) * 4;
          var q = (front - u) / BAND;                    // <0 not reached (old slide), 0..1 inside the band, >1 revealed
          var th = (by[x & 7] + 0.5) / 64;
          if (q < 0 || q > 1 || th < q) { d[k + 3] = 0; continue; }
          var c = th < q + (1 - q) * 0.45 ? base : mid; // pink at the leading edge, --gs-mid behind it
          d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (t < 1) wipeRAF = requestAnimationFrame(step);
      else wipeEnd();
    };
    wipeRAF = requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------
     Domain typing effect
     --------------------------------------------------------------- */
  function typeUrl(sec) {
    var el = $('.type-url', sec); if (!el || reduced) return;
    var full = el.getAttribute('data-type'), i = 0;
    clearInterval(el._t);
    el.textContent = '';
    setTimeout(function () {
      el._t = setInterval(function () { el.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(el._t); }, 95);
    }, 600);
  }

  /* ---------------------------------------------------------------
     Chloé: ONE floating ghost.
     - Rests docked in the bottom-right corner beside the HUD (never on a slide edge
       mid-height), with open eyes.
     - To fire she flies to a perch chosen by scoring every spot on the slide: text,
       [data-chloe-avoid] (titles, stats, notes, cards) and faces under her sprite, and
       text crossed by her BEAM on the way to the target all cost. A per-slide
       data-chloe-perch is only a hint that wins when it is clean.
     - Cover only: a 3x Chloé and a sustained 2.5s beam that lights up TONIGHT.
     - Phones: small, bottom-right, hidden until you scroll past the cover.
     --------------------------------------------------------------- */
  var chloe = null;
  function narrow() { return window.innerWidth < 700 || window.innerHeight < 420; }
  function reflowOn() { return de.classList.contains('deck-reflow'); }
  /** Slide-space scale: present = fitted stage; website = the current slide's stage width. */
  function curK() {
    if (Deck.isPresenting) return Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var c = Deck.current(), r = c && stageRect(c);
    return r && r.width ? r.width / 1920 : window.innerWidth / 1920;
  }
  // her footprint is fixed in SLIDE px (about 70 x 92 at 1920), so a smaller screen never lets her cover more copy
  function chloeSize() { return reflowOn() || narrow() ? 32 : Math.max(28, Math.round(70 * curK())); }
  function stageRect(sec) { var st = $('.deck-stage', sec); return st ? st.getBoundingClientRect() : null; }
  function stageK(sec) { var r = stageRect(sec); return r ? r.width / 1920 : 1; }
  function stagePt(sec, x, y) { var r = stageRect(sec); if (!r) return null; var k = r.width / 1920; return { x: r.left + x * k, y: r.top + y * k }; }
  function hudRect() { var h = $('.deck-hud'); if (!h) return null; var r = h.getBoundingClientRect(); return r.width ? r : null; }
  function dockSpot(w, h) {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (narrow()) return { x: vw - w - 14, y: vh - h - 22 };
    var hr = hudRect();
    var right = hr ? hr.left - 14 : vw - 24;
    return { x: Math.round(right - w), y: Math.round(vh - h - 10) };
  }
  function chloeHome(w) { return dockSpot(w, w * 42 / 32); }

  /* ---- obstacle map (8px cells, viewport px) ---- */
  var CELL = 8;
  var AVOID = '[data-chloe-avoid], .ch-n, .stat, .lk, .copy, .marker, .sticky, .qr-card, .move, .div-tag, .kicker, .tracker, .meta, .hp-url, .ok-chip, .uichip, .pg-live, .draft, .howto, .dl';
  var CARDS = '.glass, .draft, .ing, .wire-wrap, .pal-row, .phone, .pin-card, .vid-stage, .bw, .st-screen';
  function buildMap(secs, target) {
    var roots = Array.isArray(secs) ? secs : [secs];
    var vw = window.innerWidth, vh = window.innerHeight;
    var cols = Math.ceil(vw / CELL), rows = Math.ceil(vh / CELL);
    var body = new Float32Array(cols * rows), beam = new Float32Array(cols * rows), hard = new Uint8Array(cols * rows);
    // hard: copy line boxes the BEAM may never cross (1 = someone else's copy, 2 = the target's own words)
    function paintHard(r, v) {
      var pd = 6 * (window.innerWidth / 1920 > 0.5 ? window.innerWidth / 1920 : 0.5); // a beam never grazes a word
      var x0 = Math.max(0, Math.floor((r.left - pd) / CELL)), x1 = Math.min(cols - 1, Math.floor((r.right + pd) / CELL));
      var y0 = Math.max(0, Math.floor((r.top - pd) / CELL)), y1 = Math.min(rows - 1, Math.floor((r.bottom + pd) / CELL));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var i = y * cols + x; if (!hard[i] || v < hard[i]) hard[i] = v; }
    }
    function paint(r, w, wb) {
      var x0 = Math.max(0, Math.floor(r.left / CELL)), x1 = Math.min(cols - 1, Math.floor((r.right - 1) / CELL));
      var y0 = Math.max(0, Math.floor(r.top / CELL)), y1 = Math.min(rows - 1, Math.floor((r.bottom - 1) / CELL));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var i = y * cols + x;
        if (w > body[i]) body[i] = w;
        if (wb > beam[i]) beam[i] = wb;
      }
    }
    var inT = function (el) { return target && (target === el || target.contains(el) || el.contains(target)); };
    var rg = document.createRange();
    roots.forEach(function (sec) {
    // text line boxes
    var tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, null, false), n = 0;
    while (tw.nextNode() && n < 5000) {
      var tn = tw.currentNode; n++;
      if (!/\S/.test(tn.nodeValue)) continue;
      var pe = tn.parentElement;
      // giant divider words: their text box runs far above the caps; the element box (line-height .8) is the real footprint
      if (!pe || pe.closest('aside, script, style, noscript, svg, .chloe-layer, .div-word')) continue;
      var cs = getComputedStyle(pe);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      rg.selectNodeContents(tn);
      var rs = rg.getClientRects(), own = target && target.contains(tn) && !target._zapPoint;
      for (var i = 0; i < rs.length; i++) { paint(rs[i], 1, own ? 0 : 1); if (target) paintHard(rs[i], own ? 2 : 1); }
    }
    $$(AVOID, sec).forEach(function (el) {
      // titles are full-measure blocks: their no-go area is the words, not the empty run to the right
      if (el.matches('.title') && !inT(el)) { $$('.w', el).forEach(function (w) { var q = w.getBoundingClientRect(); if (q.width > 1) paint({ left: q.left - 8, top: q.top - 8, right: q.right + 8, bottom: q.bottom + 8 }, 1.3, 0.6); }); return; }
      var r = el.getBoundingClientRect(); if (r.width < 2) return;
      paint(r, 1.3, inT(el) ? 0 : 0.6);
    });
    // chart dots and orbit satellites: she never sits on a data point
    $$('.jdot, .orb-sat', sec).forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width < 2) return;
      paint({ left: r.left - 14, top: r.top - 14, right: r.right + 14, bottom: r.bottom + 14 }, 2, 0);
    });
    // small chips (copy-link labels, link chips, UI chips) count as copy for the beam too
    if (target) $$('.ok-copy, .lk, .uichip, .copy, .pal-c', sec).forEach(function (el) { if (inT(el)) return; var r = el.getBoundingClientRect(); if (r.width > 2) paintHard(r, 1); });
    // CTAs and the Bolt arrow get 32px of clear air: a near-miss tangent reads as a mistake
    var kk = stageK(sec);
    $$('.cheat-btn, .enh-wrap, .enh-arrow, .quote-copy', sec).forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width < 2) return;
      paint({ left: r.left - 32 * kk, top: r.top - 32 * kk, right: r.right + 32 * kk, bottom: r.bottom + 32 * kk }, 1.3, inT(el) ? 0 : 0.3);
    });
    // thin diagram strokes (agenda leader lines, journey line): never sit on them
    $$('.lead-line, .jline, .flow', sec).forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width < 2 && r.height < 2) return;
      paint({ left: r.left - 10, top: r.top - 10, right: r.right + 10, bottom: r.bottom + 10 }, 1.3, 0);
    });
    });
    // never park on the thing being zapped
    if (target) { var trr = target.getBoundingClientRect(); paint({ left: trr.left - 6, top: trr.top - 6, right: trr.right + 6, bottom: trr.bottom + 6 }, 2.5, 0); }
    roots.forEach(function (sec) {
    $$(CARDS, sec).forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width < 2 || r.width * r.height > vw * vh * 0.5) return;
      paint(r, 0.3, 0.04);
    });
    });
    roots.forEach(function (sec) {
    // faces: stage rects (x,y,w,h|...) she must never sit on
    var st = stageRect(sec), k = st ? st.width / 1920 : 1;
    (sec.getAttribute('data-chloe-faces') || '').split('|').forEach(function (z) {
      var a = z.split(',').map(Number); if (a.length !== 4 || !st) return;
      paint({ left: st.left + a[0] * k, top: st.top + a[1] * k, right: st.left + (a[0] + a[2]) * k, bottom: st.top + (a[1] + a[3]) * k }, 2, 0.5);
    });
    });
    // deck UI: HUD, progress bar, website navbar
    var hr = hudRect(); if (hr) paint({ left: hr.left - 8, top: hr.top - 8, right: hr.right + 8, bottom: hr.bottom + 8 }, 3, 0);
    paint({ left: 0, top: 0, right: vw, bottom: 14 }, 3, 0);
    if (nav && !Deck.isPresenting && !nav.classList.contains('is-hidden')) paint(nav.getBoundingClientRect(), 3, 0);
    // summed-area table for O(1) box sums
    var sat = new Float32Array((cols + 1) * (rows + 1));
    for (var y = 1; y <= rows; y++) { var run = 0; for (var x = 1; x <= cols; x++) { run += body[(y - 1) * cols + x - 1]; sat[y * (cols + 1) + x] = sat[(y - 1) * (cols + 1) + x] + run; } }
    // and one for copy cells alone (any text, the target's included): her BODY never sits on words
    var sath = new Float32Array((cols + 1) * (rows + 1));
    for (var y2 = 1; y2 <= rows; y2++) { var run2 = 0; for (var x2 = 1; x2 <= cols; x2++) { run2 += hard[(y2 - 1) * cols + x2 - 1] ? 1 : 0; sath[y2 * (cols + 1) + x2] = sath[(y2 - 1) * (cols + 1) + x2] + run2; } }
    return { cols: cols, rows: rows, body: body, beam: beam, hard: hard, sat: sat, sath: sath };
  }
  function boxSum(m, l, t, r, b) {
    var x0 = Math.max(0, Math.floor(l / CELL)), x1 = Math.min(m.cols, Math.ceil(r / CELL));
    var y0 = Math.max(0, Math.floor(t / CELL)), y1 = Math.min(m.rows, Math.ceil(b / CELL));
    if (x1 <= x0 || y1 <= y0) return 0;
    var W = m.cols + 1;
    return m.sat[y1 * W + x1] - m.sat[y0 * W + x1] - m.sat[y1 * W + x0] + m.sat[y0 * W + x0];
  }
  /** Copy cells a beam segment crosses: {other: someone else's words, own: the target's own words}. */
  function beamHits(m, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy), o = 0, w = 0, last = -1;
    var steps = Math.max(1, Math.floor(len / (CELL * 0.5)));
    for (var i = 1; i < steps; i++) {
      var f = i / steps, cx = Math.floor((ax + dx * f) / CELL), cy = Math.floor((ay + dy * f) / CELL);
      if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) continue;
      var k = cy * m.cols + cx; if (k === last) continue; last = k;
      if (m.hard[k] === 1) o++; else if (m.hard[k] === 2) w++;
    }
    return { other: o, own: w };
  }
  function hardBox(m, l, t, r, b) {
    var x0 = Math.max(0, Math.floor(l / CELL)), x1 = Math.min(m.cols, Math.ceil(r / CELL));
    var y0 = Math.max(0, Math.floor(t / CELL)), y1 = Math.min(m.rows, Math.ceil(b / CELL));
    if (x1 <= x0 || y1 <= y0 || !m.sath) return 0;
    var W = m.cols + 1;
    return m.sath[y1 * W + x1] - m.sath[y0 * W + x1] - m.sath[y1 * W + x0] + m.sath[y0 * W + x0];
  }
  function beamSum(m, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy), s = 0;
    var steps = Math.max(1, Math.floor(len / (CELL * 0.75)));
    for (var i = 1; i < steps; i++) {
      var f = i / steps, x = ax + dx * f, y = ay + dy * f;
      var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) continue;
      s += m.beam[cy * m.cols + cx];
    }
    return s * CELL * 0.75;
  }
  /**
   * Where the beam lands (same geometry for scoring and drawing). The beam never parks on small text:
   * - a [data-zap-point] child (status dot, swatch, tape, icon) or a button's own icon: a tiny wiggle on it
   * - data-zap-mode="under" (default): an underline sweep just below the target
   * - "top": inside the top band (colour swatches), "mid": through the middle (giant words only),
   *   "full": the whole width through the middle (the cover's TONIGHT)
   */
  function zapPath(el, sec, eye) {
    var K = stageK(sec), r = el.getBoundingClientRect();
    var pt = el.querySelector('[data-zap-point]') || (el.matches('.lk, .copy, .enh-btn, .cheat-btn') ? el.querySelector('.ico') : null);
    if (pt) {
      var q = pt.getBoundingClientRect(), c = { x: q.left + q.width / 2, y: q.top + q.height / 2 }, w = Math.min(q.width * 0.3, 8 * K);
      if (eye) {
        // the beam stops 10px OUTSIDE the glyph, on the side facing her, and wiggles along that edge:
        // the icon / label it points at stays readable
        var dx = eye.x - c.x, dy = eye.y - c.y, L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
        var hx = q.width / 2, hy = q.height / 2;
        var t = Math.min(Math.abs(dx) > 1e-3 ? hx / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-3 ? hy / Math.abs(dy) : 1e9) + 10 * K;
        var e = { x: c.x + dx * t, y: c.y + dy * t }, px = -dy * 6 * K, py = dx * 6 * K;
        return { a: { x: e.x - px, y: e.y - py }, b: { x: e.x + px, y: e.y + py }, point: true };
      }
      return { a: { x: c.x - w, y: c.y }, b: { x: c.x + w, y: c.y }, point: true };
    }
    var mode = el.getAttribute('data-zap-mode') || 'under', dy = (+el.getAttribute('data-zap-dy') || 0) * K;
    var sw = mode === 'full' ? r.width * 0.96 : Math.min(r.width * (+el.getAttribute('data-zap-w') || 0.8), 620 * K), sx = r.left + (r.width - sw) / 2;
    var y = mode === 'mid' || mode === 'full' ? r.top + r.height / 2 : mode === 'top' ? r.top + 34 * K : r.bottom + 12 * K;
    if (mode === 'base') {
      // along the glyphs' baseline: a zero-height inline-block sits exactly on it
      var bl = el.querySelector('.zap-base');
      if (!bl) { bl = document.createElement('i'); bl.className = 'zap-base'; bl.setAttribute('aria-hidden', 'true'); el.appendChild(bl); }
      y = bl.getBoundingClientRect().top;
    }
    return { a: { x: sx, y: y + dy }, b: { x: sx + sw, y: y + dy } };
  }
  function sweepPts(el, sec, eye) {
    var z = zapPath(el, sec, eye);
    return [0, 0.25, 0.5, 0.75, 1].map(function (f) { return { x: z.a.x + (z.b.x - z.a.x) * f, y: z.a.y + (z.b.y - z.a.y) * f }; });
  }
  /** Best top-left for a W x H ghost firing at el. Returns {x,y,score}. */
  function findPerch(sec, el, W, H, o) {
    o = o || {};
    el._zapPoint = !!(el.querySelector('[data-zap-point]') || (el.matches('.lk, .copy, .enh-btn, .cheat-btn') && el.querySelector('.ico')));
    var m = buildMap(sec, el), K = stageK(sec);
    el._zapPoint = false;
    var st = stageRect(sec), vw = window.innerWidth, vh = window.innerHeight;
    var tr = el.getBoundingClientRect(), tc = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
    var pts = sweepPts(el, sec);
    // point targets: the beam really ends 10px outside the glyph on the side facing her, so the hard
    // test uses that end point per candidate (a beam to an icon must not cross its own button label)
    var ptEl = el.querySelector('[data-zap-point]') || (el.matches('.lk, .copy, .enh-btn, .cheat-btn') ? el.querySelector('.ico') : null);
    var pq = ptEl ? ptEl.getBoundingClientRect() : null;
    // a sweep THROUGH a giant word (mid / full) crosses its strokes on purpose: no own-text cost then
    var ownW = /^(mid|full|base)$/.test(el.getAttribute('data-zap-mode') || '') ? 0 : 4000;
    function pointEnd(ex, ey) {
      var c = { x: pq.left + pq.width / 2, y: pq.top + pq.height / 2 }, dx = ex - c.x, dy = ey - c.y, Ln = Math.sqrt(dx * dx + dy * dy) || 1; dx /= Ln; dy /= Ln;
      var t = Math.min(Math.abs(dx) > 1e-3 ? pq.width / 2 / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-3 ? pq.height / 2 / Math.abs(dy) : 1e9) + 10 * K;
      return [{ x: c.x + dx * t, y: c.y + dy * t }];
    }
    // stay inside the 96px side gutters every other element respects
    var L = Math.max(8, st.left + 96 * K), T = Math.max(22, st.top + 22), R = Math.min(vw - 8, st.left + 1824 * K) - W, B = Math.min(vh - 8, st.bottom - 8) - H;
    var bob = 10 * K, step = Math.max(10, Math.round(16 * K));
    var hint = null, hs = (sec.getAttribute('data-chloe-perch') || '').split(',');
    if (hs.length === 2 && !o.ignoreHint) hint = stagePt(sec, +hs[0], +hs[1]);
    var best = null;
    function score(x, y) {
      var body = boxSum(m, x - 6, y - bob - 4, x + W + 6, y + H + 6) * CELL * CELL;
      var onText = hardBox(m, x - 4, y - bob - 2, x + W + 4, y + H + 4);
      var ring = 40 * K; body += boxSum(m, x - ring, y - bob - ring, x + W + ring, y + H + ring) * CELL * CELL * 0.25;
      var ex = x + W * 15.5 / 32, ey = y + H * 14 / 42, bm = 0, hardHits = 0, ownHits = 0;
      for (var i = 0; i < pts.length; i++) bm += beamSum(m, ex, ey, pts[i].x, pts[i].y);
      bm = bm / pts.length * 60 * K;
      // HARD rule: neither eye's beam may cross anyone else's copy at any point of the sweep. The target's
      // own words are a heavy (not absolute) cost, so an underline sweep still prefers a beam from the side.
      var e1 = x + W * 9.5 / 32, e2 = x + W * 21.5 / 32;
      var zp = pq ? pointEnd(ex, ey) : pts;
      for (var j = 0; j < zp.length; j++) {
        var h1 = beamHits(m, e1, ey, zp[j].x, zp[j].y), h2 = beamHits(m, e2, ey, zp[j].x, zp[j].y);
        hardHits += h1.other + h2.other; ownHits += h1.own + h2.own;
      }
      var dx = tc.x - ex, dy = tc.y - ey, d = Math.sqrt(dx * dx + dy * dy) / K;
      var dp = (d < 140 ? (140 - d) * 90 : 0) + Math.max(0, d - 380) * 10 + (d > 760 ? (d - 760) * 30 : 0);
      // keep off the kicker / progress band and the footer band
      var yb = (y - st.top) / K;
      var band = (yb < 110 ? (110 - yb) * 120 : 0) + (yb + H / K > 1000 ? (yb + H / K - 1000) * 120 : 0);
      var bub = 0;
      if (o.say) {
        // the speech bubble must fit somewhere clean too: best of her bubble placements
        var bw = 640 * K, bh = 80 * K; bub = Infinity;
        BUB_ORDER.forEach(function (pl) { var q = bubbleRect(pl, x, y, W, H, bw, bh); if (q.l < 8 || q.t < 8 || q.r > vw - 8 || q.b > vh - 8) return; bub = Math.min(bub, boxSum(m, q.l, q.t, q.r, q.b) * CELL * CELL); });
        if (bub === Infinity) bub = 1e7;
      }
      var hp = hint ? Math.sqrt((x - hint.x) * (x - hint.x) + (y - hint.y) * (y - hint.y)) / K * 6 : 0;
      if (o.explainOut) o.explainOut.push({ x: x, y: y, body: body, bm: bm, dp: dp, band: band, bub: bub, hp: hp, hard: hardHits, own: ownHits });
      return body * 1.0 + bm + dp + band + bub + hp + (hardHits + onText) * 1e6 + ownHits * ownW;
    }
    if (R < L || B < T) return null;
    for (var y = T; y <= B; y += step) for (var x = L; x <= R; x += step) {
      var sc = score(x, y);
      if (!best || sc < best.score) best = { x: x, y: y, score: sc };
    }
    if (hint) { var hx = Math.min(Math.max(hint.x, L), R), hy = Math.min(Math.max(hint.y, T), B), hsc = score(hx, hy); if (hsc <= best.score * 1.08 + 400) best = { x: hx, y: hy, score: hsc, hint: true }; else best.hintScore = hsc; }
    if (o.explain) { o.explainOut = []; o.explain.forEach(function (q) { score(stagePt(sec, q[0], q[1]).x, stagePt(sec, q[0], q[1]).y); }); best.explain = o.explainOut; }
    return best;
  }

  /* ---- speech bubble placements (above-left, above-right, left, right, below-left, below-right) ---- */
  var BUB_ORDER = ['a', 'ar', 'l', 'r', 'b', 'br'];
  function bubbleRect(pl, x, y, W, H, bw, bh) {
    var l, t, g = 16 * Math.max(.6, curK());
    if (pl === 'l' || pl === 'r') { l = pl === 'l' ? x - bw - g : x + W + g; t = y + H * 0.55 - bh / 2; }
    else { l = x + W / 2 - bw * (pl === 'ar' || pl === 'br' ? 0.2 : 0.8); t = pl === 'b' || pl === 'br' ? y + H + 18 : y - bh - 18; }
    return { l: l, t: t, r: l + bw, b: t + bh };
  }
  /** First clean placement for the bubble at her current spot, or null (then she keeps quiet). */
  /** Optional per-slide horizontal zone (stage x0,x1) the bubble must stay inside, e.g. clear of a split seam. */
  function bubbleZone(sec) {
    var z = (sec && sec.getAttribute('data-chloe-bzone') || '').split(','), st = sec && stageRect(sec);
    if (z.length !== 2 || !st) return null;
    var k = st.width / 1920; return { l: st.left + +z[0] * k, r: st.left + +z[1] * k };
  }
  function clampZone(q, zone) {
    if (!zone) return q;
    var w = q.r - q.l, l = Math.min(Math.max(q.l, zone.l), zone.r - w);
    return { l: l, t: q.t, r: l + w, b: q.b };
  }
  function pickBubble(sec, bw, bh, pos) {
    var m = buildMap(sec, null), vw = window.innerWidth, vh = window.innerHeight, W = chloe.cssW, H = chloe.cssH;
    var pref = sec.getAttribute('data-chloe-bubble'), order = pref ? [pref].concat(BUB_ORDER.filter(function (q) { return q !== pref; })) : BUB_ORDER;
    var best = null, zone = bubbleZone(sec), gap = 40 * stageK(sec);
    // first choice: a placement with 40px of clear air on every side
    for (var j = 0; j < order.length; j++) {
      var q0 = clampZone(bubbleRect(order[j], pos.x, pos.y, W, H, bw, bh), zone);
      if (q0.l < 8 || q0.t < 8 || q0.r > vw - 8 || q0.b > vh - 8) continue;
      if (boxSum(m, q0.l - gap, q0.t - gap, q0.r + gap, q0.b + gap) < 0.01) return order[j];
    }
    for (var i = 0; i < order.length; i++) {
      var q = clampZone(bubbleRect(order[i], pos.x, pos.y, W, H, bw, bh), zone);
      if (q.l < 8 || q.t < 8 || q.r > vw - 8 || q.b > vh - 8) continue;
      var sc = boxSum(m, q.l - 4, q.t - 6, q.r + 4, q.b + 6);
      if (sc < 0.01) return order[i];
      if (!best || sc < best.sc) best = { pl: order[i], sc: sc };
    }
    // only glass panels (weight .3) behind a few cells is tolerable; text never is
    return best && best.sc < 12 ? best.pl : null;
  }
  /** Resting spot: the same no-go map as the zaps, scored around the slide's rest hint. */
  function restHint(sec) {
    var h = (sec.getAttribute('data-chloe-rest') || '').split(',');
    return h.length === 2 ? { x: +h[0], y: +h[1] } : { x: 1740, y: 872 };
  }
  function visibleSecs() {
    var vh = window.innerHeight;
    return slides.filter(function (s) { var r = s.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
  }
  function findRest(sec, W, H) {
    var st = stageRect(sec); if (!st || !st.width) return null;
    var K = st.width / 1920, vw = window.innerWidth, vh = window.innerHeight;
    var m = buildMap(Deck.isPresenting ? [sec] : visibleSecs(), null);
    var top = Deck.isPresenting ? 0 : (nav && !nav.classList.contains('is-hidden') ? nav.getBoundingClientRect().bottom + 8 : 8);
    var L = Math.max(8, st.left + 96 * K), R = Math.min(vw - 8, st.left + 1824 * K) - W;
    var T = Math.max(top, 8, st.top + 110 * K), B = Math.min(vh - 8, st.top + 990 * K) - H;
    if (R < L || B < T) return null;
    var hint = restHint(sec), hx = st.left + hint.x * K, hy = st.top + hint.y * K;
    var bob = 10 * K, step = Math.max(6, Math.round(12 * K)), best = null;
    var score = function (x, y) {
      var body = boxSum(m, x - 8 * K, y - bob - 6 * K, x + W + 8 * K, y + H + 8 * K);
      var near = boxSum(m, x - 40 * K, y - bob - 40 * K, x + W + 40 * K, y + H + 40 * K);
      var d = Math.sqrt((x - hx) * (x - hx) + (y - hy) * (y - hy)) / K;
      body = body < 0.01 ? 0 : body; near = near < 0.01 ? 0 : near;
      return { s: body * 4000 + near * 60 + d, clean: body === 0 };
    };
    for (var y = T; y <= B; y += step) for (var x = L; x <= R; x += step) {
      var sc = score(x, y);
      if (!best || sc.s < best.s) best = { x: x, y: y, s: sc.s, clean: sc.clean };
    }
    var cx = Math.min(Math.max(hx, L), R), cy = Math.min(Math.max(hy, T), B), hs = score(cx, cy);
    if (hs.clean && hs.s <= best.s + 1) best = { x: cx, y: cy, s: hs.s, clean: true };
    return best;
  }
  /** Phones: a small ghost in the right gutter, on the lowest spot with no copy under her. */
  function dockMobile(W, H) {
    var vw = window.innerWidth, vh = window.innerHeight, m = buildMap(visibleSecs(), null), x = vw - W - 8;
    for (var y = vh - H - 16; y > vh * 0.3; y -= 8) if (boxSum(m, x - 4, y - 8, x + W + 4, y + H + 4) < 0.01) return { x: x, y: y, clean: true };
    return { x: x, y: vh - H - 16, clean: false };
  }
  function ensureSize() {
    de.style.setProperty('--ck', (reflowOn() || narrow() ? 0.7 : curK()).toFixed(3));
    if (!chloe || bigOn || chloe.zapping) return;
    var w = chloeSize();
    if (Math.abs(w - (+chloe.o.size)) > 1) { chloe.o.size = w; chloe._resize(false); }
  }

  if (window.Chloe) {
    var cw = chloeSize();
    chloe = Chloe.mount({
      size: cw,
      home: chloeHome(cw),
      interval: 0,            // auto-lasers are scheduled below so they use the perch logic
      roam: 0,                // no darting across content
      approach: false,        // never auto-perch next to a target (that is where the text is)
      hotkey: null,           // L is handled below
      zapQuipChance: 0,
      zIndex: narrow() ? 900 : null,
      state: 'chat',
      targets: function () {
        var cur = Deck.current(); if (!cur || de.classList.contains('deck-overview')) return [];
        return $$('[data-zap]', cur);
      }
    });
    // resting face: open eyes (the idle frame blinks every 2s, which read as asleep on a projector)
    // a new flight must settle the one it replaces, or a fire sequence waiting on it hangs forever
    var _moveTo = chloe.moveTo;
    chloe.moveTo = function (x, y, d) {
      if (this.tween && this.tween.done) { var od = this.tween.done; this.tween = null; od(); }
      return _moveTo.call(this, x, y, d);
    };
    var _setState = chloe.setState;
    chloe.setState = function (s, ms) { return _setState.call(this, s === 'idle' ? 'chat' : s, ms); };
    /* Speech: the bubble's final size is measured BEFORE it opens (a hidden copy of the whole line
       holds the box), then the words type into that fixed box. Its placement is tested against the
       same no-go map as her perch; with no clean placement she keeps quiet. */
    chloe.say = function (text, ms) {
      var self = this; if (!text) return this;
      var b = this.bubble, cur = Deck.current();
      var free = !!(cur && (cur.classList.contains('sl-div') || cur.hasAttribute('data-chloe-free')) && !narrow() && !reflowOn());
      b.classList.toggle('b-free', free);
      // per-slide free-type size / measure (stage px): data-chloe-free="fontSize,maxWidth"
      var fz = (cur && cur.getAttribute('data-chloe-free') || '').split(',');
      if (fz.length === 2) { b.style.setProperty('--bfs', fz[0]); b.style.setProperty('--bbw', fz[1]); } else { b.style.removeProperty('--bfs'); b.style.removeProperty('--bbw'); }
      b.classList.toggle('b-ink', !!(cur && cur.hasAttribute('data-chloe-ink')));
      b.innerHTML = '<span class="chloe-who">' + this.o.name + '</span><span class="chloe-text"><span class="ct-ghost"></span><span class="ct-live"></span></span>';
      b.querySelector('.ct-ghost').textContent = text;
      var live = b.querySelector('.ct-live');
      var sec = Deck.current(), pl = 'a';
      if (sec && !narrow() && !reflowOn()) pl = pickBubble(sec, b.offsetWidth, b.offsetHeight, this.pos);
      if (!pl) { b.classList.remove('is-on'); return this; }
      this._bubPlace = pl;
      b.classList.remove('bp-a', 'bp-ar', 'bp-l', 'bp-r', 'bp-b', 'bp-br'); b.classList.add('bp-' + pl, 'bp-' + pl.charAt(0));
      b.style.setProperty('--tail', /r$/.test(pl) ? '20%' : '80%');
      placeBubble();
      b.classList.add('is-on');
      if (this._typeIv) clearInterval(this._typeIv);
      if (reduced) live.textContent = text;
      else {
        var i = 0; live.textContent = '';
        this._typeIv = setInterval(function () { i += 1; live.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(self._typeIv); self._typeIv = null; } }, 22);
      }
      if (this._sayT) clearTimeout(this._sayT);
      this._sayT = setTimeout(function () { b.classList.remove('is-on'); }, ms || Math.max(2800, 1400 + text.length * 55));
      return this;
    };
    function placeBubble() {
      var b = chloe.bubble; if (!b || !chloe._bubPlace) return;
      var m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(chloe.el.style.transform || '');
      var x = m ? +m[1] : chloe.pos.x, y = m ? +m[2] : chloe.pos.y;
      var q = clampZone(bubbleRect(chloe._bubPlace, x, y, chloe.cssW, chloe.cssH, b.offsetWidth, b.offsetHeight), bubbleZone(Deck.current()));
      var vw = window.innerWidth, vh = window.innerHeight;
      // the tail keeps pointing at her when the zone shifts the box
      if (!/^[lr]$/.test(chloe._bubPlace) && b.offsetWidth) b.style.setProperty('--tail', Math.round(Math.min(92, Math.max(8, (x + chloe.cssW / 2 - q.l) / b.offsetWidth * 100))) + '%');
      b.style.left = Math.round(Math.min(Math.max(8, q.l), vw - 8 - b.offsetWidth)) + 'px';
      b.style.top = Math.round(Math.min(Math.max(8, q.t), vh - 8 - b.offsetHeight)) + 'px';
      if (/^[lr]$/.test(chloe._bubPlace)) b.style.setProperty('--tail', '50%');
    }
    // the shared loop positions the bubble above-left every frame; re-place it after, per the chosen spot
    var _loop = chloe._loop;
    chloe._loop = function (now) { _loop.call(chloe, now); if (chloe.bubble.classList.contains('is-on')) placeBubble(); };
    var homeT;
    window.addEventListener('resize', function () {
      clearTimeout(homeT);
      homeT = setTimeout(function () {
        if (!chloe || chloe.zapping || bigOn) return;
        ensureSize();
        if (chloe.layer) chloe.layer.style.zIndex = narrow() ? 900 : '';
        goHome(0);
      }, 250);
    });
  }
  var zapAbort = false, zapped = {}, dwellT = null, autoT = null, busy = false, bigOn = false, flight = 0, busyT = null;
  function syncChloeVisibility(sec) {
    de.classList.toggle('chloe-off', !!(sec && sec.hasAttribute('data-chloe-hide') && !de.classList.contains('deck-overview')));
  }
  /**
   * Rest / idle spot. Never a fixed corner: the spot is scored on the same no-go map as the zaps
   * (text, titles, cards, faces, HUD, footer and top bands), around the slide's data-chloe-rest hint.
   * Phones: a small ghost in the right gutter wherever no copy sits under her, else dimmed.
   */
  function goHome(dur) {
    if (!chloe || chloe.zapping) return;
    flight++;
    ensureSize();
    var cur = Deck.current(), p = null;
    if (reflowOn() || narrow()) p = dockMobile(chloe.cssW, chloe.cssH);
    else if (cur) { try { p = findRest(cur, chloe.cssW, chloe.cssH); } catch (e) { p = null; } }
    if (!p) p = chloeHome(chloe.cssW || 64);
    chloe.o.home = { x: p.x, y: p.y };
    de.classList.toggle('chloe-dim', p.clean === false && (reflowOn() || narrow()));
    chloe.moveTo(p.x, p.y, dur == null ? 700 : dur);
  }
  function setBig(on, sec) {
    if (!chloe || bigOn === on) return;
    bigOn = on;
    chloe.o.size = on ? Math.round(184 * stageK(sec)) : chloeSize();
    chloe._resize(false);
  }
  /** Laser at el: lock, then sweep across it (clamped so the beam never swings past it). */
  function fire(sec, el, o) {
    o = o || {};
    if (!chloe.laser || !chloe._eyes) return chloe.zap(el, { silent: true, stay: true, approach: false });
    var inCard = !!el.closest('.glass, .wire-wrap, .draft, .ing, .codewin, .pal-row');
    var isPoint = !!(el.querySelector('[data-zap-point]') || (el.matches('.lk, .copy, .enh-btn, .cheat-btn') && el.querySelector('.ico')));
    var sparks = o.sparks != null ? o.sparks : (inCard || isPoint ? 1 : 2);
    return new Promise(function (res) {
      chloe.zapping = true; chloe.setState('scanning'); chloe.laser.show(true);
      el.classList.remove('chloe-zapped'); void el.offsetWidth; el.classList.add('chloe-zapped');
      if (o.lit) o.lit.classList.add('lit');
      var letters = o.letters ? $$('.lt', el) : null;
      if (letters) letters.forEach(function (lt) { lt._on = false; lt.classList.remove('lit'); });
      var LOCK = reduced ? 700 : 420, SWEEP = reduced ? 0 : (o.sweep || 1100), t0 = performance.now(), last = 0;
      var done = function () {
        chloe.laserTarget = null; chloe.laser.show(false); chloe.laser.sparks = []; chloe.zapping = false;
        if (o.lit) setTimeout(function () { o.lit.classList.remove('lit'); }, 350);
        if (letters) setTimeout(function () { letters.forEach(function (lt) { lt.classList.remove('lit'); }); }, o.hold || 1400);
        chloe.setState('celebrating', 1400); res(true);
      };
      var step = function (now) {
        if ((Deck.current() !== sec && Deck.isPresenting) || zapAbort) return done();
        var ey = chloe._eyes(), eye = { x: (ey[0].x + ey[1].x) / 2, y: ey[0].y };
        var t = now - t0, pts = sweepPts(el, sec, eye), a = pts[0], b = pts[4];
        var tgt, power = 1;
        if (t < LOCK) { tgt = { x: a.x, y: a.y }; power = Math.min(1, t / 160); }
        else if (t < LOCK + SWEEP) { var u = (t - LOCK) / SWEEP, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; tgt = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; power = u > 0.85 ? 1 - (u - 0.85) / 0.15 * 0.5 : 1; }
        else return done();
        if (!reduced && sparks && now - last > 70) {
          var n0 = chloe.laser.sparks.length; chloe.laser.burst(tgt.x, tgt.y, sparks); last = now;
          // small targets sit among copy: their sparks stay a tight fizz instead of drifting onto words
          if (inCard || isPoint) for (var si = n0; si < chloe.laser.sparks.length; si++) { var sp = chloe.laser.sparks[si]; sp.vx *= 0.35; sp.vy *= 0.35; sp.life = 0.55; }
        }
        // letter-by-letter: each letter lights as the beam passes its centre
        if (letters) letters.forEach(function (lt) { if (!lt._on) { var q = lt.getBoundingClientRect(); if (tgt.x >= q.left + q.width * 0.45) { lt._on = true; lt.classList.add('lit'); } } });
        chloe.laserTarget = tgt; chloe.laserPower = power; chloe.flipped = false;
        chloe.laser.draw(chloe._eyes(), tgt, chloe.k, power);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  /** Fly to the best perch for this target, fire, maybe speak, then dock. */
  function fireAt(sec, el, say) {
    if (!chloe || !sec || !el || busy || chloe.zapping) return Promise.resolve(false);
    if (sec.hasAttribute('data-chloe-hide') || narrow() || reflowOn() || !stageRect(sec) || de.classList.contains('chloe-scrolling')) return Promise.resolve(false);
    de.classList.remove('chloe-transit');
    busy = true;
    clearTimeout(busyT); busyT = setTimeout(function () { busy = false; }, 9000); // watchdog
    var my = ++flight;
    // authored (fixed) perches and the big cover moment assume the slide sits squarely in view;
    // in website mode, once the slide has scrolled, she scores a perch like everywhere else
    var aligned = Deck.isPresenting || Math.abs(sec.getBoundingClientRect().top) < 24;
    var big = aligned && sec.hasAttribute('data-chloe-big') && (Deck.isPresenting || !zapped['big:' + sec.id]);
    if (big) { zapped['big:' + sec.id] = true; setBig(true, sec); }
    var p = null;
    if (aligned && sec.hasAttribute('data-chloe-fixed') && sec.getAttribute('data-chloe-perch')) {
      // choreographed perches (cover pocket, divider walls) are used as authored: they were placed
      // clear of faces, the word and the bubble zone, and the scorer would trade them for a "cleaner" spot
      var hp = sec.getAttribute('data-chloe-perch').split(','); p = stagePt(sec, +hp[0], +hp[1]);
    } else {
      try { p = findPerch(sec, el, chloe.cssW, chloe.cssH, { say: !!say }); } catch (err) { p = null; }
    }
    fireAt.last = p;
    var go = p ? chloe.moveTo(p.x, p.y, big ? 1100 : 900) : Promise.resolve();
    return go.then(function () {
      if (Deck.current() !== sec || my !== flight) return false;
      return fire(sec, el, big ? { sweep: 1250, sparks: 4, letters: true, hold: 2600 } : null);
    }).then(function (ok) {
      busy = false;
      if (ok && say && Deck.current() === sec && !reduced) {
        chloe.say(say, 4600);
        clearTimeout(fireAt._home);
        fireAt._home = setTimeout(function () { if (big) setBig(false, sec); if (Deck.current() === sec) goHome(); }, 4900);
      } else if (big && ok) {
        // hold the big moment a beat while TONIGHT glows, then shrink back to the dock
        clearTimeout(fireAt._home);
        fireAt._home = setTimeout(function () { setBig(false, sec); if (Deck.current() === sec) goHome(); }, 1700);
      } else { if (big) setBig(false, sec); goHome(); }
      return ok;
    }, function () { busy = false; if (big) setBig(false, sec); goHome(); });
  }
  function keyZap(sec) {
    if (!chloe || !sec || de.classList.contains('deck-overview')) return;
    if (!Deck.isPresenting && (zapped[sec.id] || narrow())) return;
    var sel = sec.getAttribute('data-chloe-zap');
    var el = sel && $(sel, sec);
    if (!el) return;
    zapped[sec.id] = true;
    sec.classList.add('unclip');
    fireAt(sec, el, sec.getAttribute('data-chloe-say'));
  }
  function randomZap() {
    var sec = Deck.current(); if (!sec) return;
    var list = $$('[data-zap]', sec).filter(function (el) { var r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < window.innerHeight; });
    if (list.length) fireAt(sec, list[Math.floor(Math.random() * list.length)]);
  }
  function scheduleAuto() {
    clearTimeout(autoT);
    autoT = setTimeout(function () { if (!narrow() && !document.hidden) randomZap(); scheduleAuto(); }, 22000 + Math.random() * 8000);
  }
  if (chloe && !reduced) scheduleAuto();
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !e.key || e.key.toLowerCase() !== 'l') return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); randomZap();
  });
  /** Leaving a slide: drop any line she was saying about it and send her home. */
  var settleT = null;
  function chloeReset() {
    if (!chloe) return;
    if (chloe._typeIv) { clearInterval(chloe._typeIv); chloe._typeIv = null; }
    if (chloe.bubble) chloe.bubble.classList.remove('is-on');
    clearTimeout(fireAt._home);
    if (chloe.zapping) return;
    if (bigOn) setBig(false);
    if (Deck.isPresenting) {
      // the new slide is still mid transition (its words are still rising): fade her out, and pick the
      // rest spot on the SETTLED layout, then fade her back in there
      de.classList.add('chloe-transit');
      clearTimeout(settleT);
      settleT = setTimeout(function () { if (!chloe.zapping) goHome(0); de.classList.remove('chloe-transit'); }, reduced ? 200 : 1450);
    } else goHome();
  }
  /* Website + phone scroll: she hides while the page moves under her, and re-docks on a clean spot
     800ms after scrolling stops. */
  var scrollT = null;
  window.addEventListener('scroll', function () {
    if (!chloe || Deck.isPresenting) return;
    // the page moving under a zap would drag her beam across the copy: cut it short
    if (chloe.zapping) zapAbort = true;
    if (busy) flight++; // a flight on its way to a perch is cancelled too
    de.classList.add('chloe-scrolling');
    if (chloe.bubble) chloe.bubble.classList.remove('is-on');
    clearTimeout(fireAt._home);
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      zapAbort = false; de.classList.remove('chloe-scrolling');
      if (chloe.zapping) return;
      if (bigOn) setBig(false);
      goHome(0);
    }, 800);
  }, { passive: true });
  // phones: parked bottom-right, and out of the way until you scroll past the cover
  function parkCheck() {
    if (!chloe) return;
    var cov = document.getElementById('cover');
    var hide = narrow() && cov && cov.getBoundingClientRect().bottom > window.innerHeight * 0.35;
    de.classList.toggle('chloe-park', !!hide);
  }
  window.addEventListener('scroll', parkCheck, { passive: true });
  parkCheck();
  window.CinematicChloe = { pickBubble: pickBubble, bubbleRect: bubbleRect, buildMap: buildMap, boxSum: boxSum, findRest: findRest, findPerch: findPerch, fireAt: fireAt, keyZap: keyZap, lastPerch: function () { return fireAt.last; } };

  /* ---------------------------------------------------------------
     Slide changes
     --------------------------------------------------------------- */
  Deck.on('deck:change', function (d) {
    markNav(d.index);
    syncVideos();
    syncChloeVisibility(d.slide);
    de.classList.toggle('on-divider', !!(d.slide && d.slide.hasAttribute('data-wipe')));
    if (d.prev !== d.index) chloeReset();
    // the dither wipe is reserved for the four chapter dividers
    if (Deck.isPresenting && d.prev !== d.index && d.slide && d.slide.hasAttribute('data-wipe')) ditherWipe(d.index > d.prev ? 1 : -1, slides[d.prev], d.slide);
    else if (wipeEnd) wipeEnd();
    clearTimeout(dwellT);
    if (chloe && !reduced) scheduleAuto(); // auto-lasers only after a long dwell, never on arrival
    var sec = d.slide;
    dwellT = setTimeout(function () { keyZap(sec); }, Deck.isPresenting ? 1800 : 2200);
  });
  document.addEventListener('slide:enter', function (e) {
    var sec = e.detail && e.detail.slide; if (!sec) return;
    if (sec.id === 'step-11-domain') typeUrl(sec);
    clearTimeout(sec._unclip);
    sec._unclip = setTimeout(function () { sec.classList.add('unclip'); }, reduced ? 0 : 2000);
  });
  document.addEventListener('slide:leave', function (e) {
    var sec = e.detail && e.detail.slide; if (!sec) return;
    clearTimeout(sec._unclip); sec.classList.remove('unclip');
  });
  Deck.on('deck:mode', function () {
    // present mode scales with a transform, so srcset picks from the LAYOUT width: on a 1440p/4K screen
    // swap every photo to its 3840 file, as print does
    if (Deck.isPresenting && (window.screen ? screen.width : 1920) * (window.devicePixelRatio || 1) >= 2560) hiRes();
    syncVideos(); parallax(); syncChloeVisibility(Deck.current()); setTimeout(function () { goHome(0); }, 60); if (!Deck.isPresenting) { $$('.sl').forEach(function (s) { s.style.removeProperty('--p'); }); parallax(); } });
  syncChloeVisibility(Deck.current());
  // deep link / reload straight into present mode: the observer ignores present mode and the init-time
  // deck:change fired before these listeners existed, so start the current slide's clip here
  syncVideos(); setTimeout(syncVideos, 400);
  de.classList.toggle('on-divider', !!(Deck.current() && Deck.current().hasAttribute('data-wipe')));
  /* Present HUD: dimmed from the start; a mouse move (never a key press) shows it for 2.5s */
  var hudT = null, lastMX = -1, lastMY = -1;
  document.addEventListener('mousemove', function (e) {
    if (Math.abs(e.clientX - lastMX) + Math.abs(e.clientY - lastMY) < 3) return;
    lastMX = e.clientX; lastMY = e.clientY;
    de.classList.add('hud-wake'); clearTimeout(hudT);
    hudT = setTimeout(function () { de.classList.remove('hud-wake'); }, 2500);
  }, { passive: true });
  /* Overview: ArrowUp / ArrowDown move a whole row (the shared deck only pages left / right there).
     The grid's column count is measured from the laid-out thumbnails. SHARED-TODO: move into deck.js. */
  window.addEventListener('keydown', function (e) {
    if (!de.classList.contains('deck-overview') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault(); e.stopImmediatePropagation();
    var all = Deck.slides, top0 = all[0] && all[0].getBoundingClientRect().top, cols = 0;
    for (var i = 0; i < all.length && Math.abs(all[i].getBoundingClientRect().top - top0) < 4; i++) cols++;
    cols = Math.max(1, cols);
    var key = e.key === 'ArrowDown' ? 'ArrowRight' : 'ArrowLeft';
    var steps = e.key === 'ArrowDown' ? Math.min(cols, all.length - 1 - Deck.index) : Math.min(cols, Deck.index);
    for (var k = 0; k < steps; k++) document.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
  }, true);
  /* Overview: every thumbnail needs its photo, lazy or not */
  function eagerAll() { $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; }); }
  Deck.on('deck:overview', function (d) { if (!d || d.on !== false) eagerAll(); });
  // after first paint settles, fetch + decode every divider / half photo so the overview grid never shows black tiles
  window.addEventListener('load', function () {
    setTimeout(function () {
      $$('.bg-photo img, .half-photo img').forEach(function (im) { im.loading = 'eager'; if (im.decode) im.decode().catch(function () {}); });
    }, 1200);
  });
  if (de.classList.contains('deck-overview')) eagerAll();
  /* Speaker notes window: keep the last lines clear of the "Up next" bar */
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !e.key || e.key.toLowerCase() !== 's') return;
    setTimeout(function () {
      var w = Deck.notes && Deck.notes(); if (!w || w.closed) return;
      var d = w.document; if (!d || d.getElementById('cin-notes-fix')) return;
      var st = d.createElement('style'); st.id = 'cin-notes-fix';
      st.textContent = 'body{grid-template-rows:auto 3px minmax(0,1fr) auto!important}main{min-height:0;padding-bottom:calc(var(--next-h,72px) + 24px)!important}';
      d.head.appendChild(st);
      var nx = d.querySelector('.next'); if (nx) d.documentElement.style.setProperty('--next-h', nx.offsetHeight + 'px');
    }, 80);
  });
  if (Deck.isPresenting && (window.screen ? screen.width : 1920) * (window.devicePixelRatio || 1) >= 2560) hiRes();
  // first slide: zap the headline once the page has settled
  setTimeout(function () { goHome(0); }, 50);
  setTimeout(function () { if (!busy) goHome(); }, 1500); // again on the settled layout
  setTimeout(function () { keyZap(Deck.current()); }, 3000);

  /* ---------------------------------------------------------------
     QR on the closing slide. Encodes the course home page (the chooser, which links
     both decks and the cheat sheets): the build-time target when one is set, else the
     live address, but ONLY on a real host. A dev server (localhost, 127.x, LAN, *.local)
     keeps the Chloé placeholder, so nobody in the room scans a dead link.
     --------------------------------------------------------------- */
  (function () {
    var box = $('.qr[data-qr-target]'); if (!box || typeof qrcode !== 'function') return;
    var target = box.getAttribute('data-qr-target');
    var url = '';
    var h = location.hostname || '';
    var local = !h || /^(localhost|0\.0\.0\.0|\[?::1\]?)$/.test(h) || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /\.local$/.test(h);
    if (target && !/TBD/.test(target)) url = target;
    else if (/^https?:$/.test(location.protocol) && !local) url = new URL('../', location.href).href;
    if (!url) return;
    try {
      var q = qrcode(0, 'M'); q.addData(url); q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
      if (box.parentElement) box.parentElement.classList.add('has-qr');
      box.setAttribute('title', url);
      var svg = $('svg', box); if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR code for ' + url); }
    } catch (e) { /* keep fallback */ }
  })();

  /* ---------------------------------------------------------------
     Reflow (narrow screens): shrink fixed-size mockups to fit
     --------------------------------------------------------------- */
  var VIZ = '.phone, .stitch, .qr-card, .dl, .sticky';
  function fitReflow() {
    var on = de.classList.contains('deck-reflow');
    $$(VIZ).forEach(function (el) {
      el.style.zoom = ''; el.style.removeProperty('--z');
      if (!on) return;
      var host = el.closest('.deck-stage'); if (!host) return;
      var avail = host.clientWidth - 40;
      var w = el.scrollWidth || el.offsetWidth;
      if (w > avail) { el.style.zoom = (avail / w).toFixed(4); el.style.setProperty('--z', (avail / w).toFixed(4)); }
    });
  }
  fitReflow();

  /* ---------------------------------------------------------------
     Print / PDF: swap in 3840px photos, freeze final state, print
     --------------------------------------------------------------- */
  function hiRes() {
    $$('img[data-hi]').forEach(function (img) {
      var hi = img.getAttribute('data-hi');
      if (img.getAttribute('src') === hi) return;
      img.loading = 'eager';
      img.removeAttribute('srcset');
      img.src = hi;
    });
  }
  function printDeck() {
    toast('Preparing a 4K PDF…');
    if (Deck.isPresenting) Deck.present(false);
    hiRes();
    var p = Deck.preparePrint ? Deck.preparePrint() : Promise.resolve();
    var timeout = new Promise(function (r) { setTimeout(r, 12000); });
    Promise.race([p, timeout]).then(function () { setTimeout(function () { window.print(); }, 250); });
  }
  window.addEventListener('beforeprint', hiRes);
  window.CinematicDeck = { printDeck: printDeck, ditherWipe: ditherWipe, chloe: function () { return chloe; } };
})();
