/* =================================================================
   deck.js — one HTML file that is both a scroll-snap website and a 16:9 deck
   Classic script (works from file:// and GitHub Pages). Global: window.Deck
   Requires deck.css (auto-injected next to this script if missing).
   ================================================================= */
(function (root) {
  'use strict';

  var STAGE_W = 1920, STAGE_H = 1080;
  var de = document.documentElement;
  var scriptSrc = (document.currentScript && document.currentScript.src) || '';

  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isTyping(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  function emit(target, name, detail) {
    var ev; try { ev = new CustomEvent(name, { detail: detail, bubbles: true }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, detail); }
    target.dispatchEvent(ev);
  }

  var S = {
    o: null, slides: [], index: 0, present: false, overview: false,
    notesWin: null, startTime: 0, idleT: null, ui: {}, listeners: {},
    leaving: [] // pending {sec, t} leave timers from present-mode advances
  };
  var LEAVE_MS = 520;

  function ensureCSS() {
    if ($all('link[href*="deck.css"]').length || document.getElementById('deck-css-auto')) return;
    if (!scriptSrc) return;
    var l = document.createElement('link');
    l.id = 'deck-css-auto'; l.rel = 'stylesheet';
    l.href = scriptSrc.replace(/deck\.js(\?.*)?$/, 'deck.css');
    document.head.appendChild(l);
  }

  /* -- Structure --------------------------------------------------- */
  function wrapStage(sec, i) {
    sec.setAttribute('data-deck-num', pad(i + 1));
    if (!sec.id) sec.id = 's' + (i + 1);
    var stage = null;
    for (var c = sec.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains('deck-stage')) { stage = c; break; }
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'deck-stage';
      var move = [];
      for (var n = sec.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1 && (n.hasAttribute('data-bleed') || n.hasAttribute('data-notes') || n.hasAttribute('data-outside-stage') || (n.tagName === 'ASIDE' && n.classList.contains('notes')))) continue;
        move.push(n);
      }
      move.forEach(function (n) { stage.appendChild(n); });
      sec.appendChild(stage);
    }
    // slide numbers
    $all('[data-slide-number]', sec).forEach(function (el) { el.textContent = pad(i + 1); });
    // print posters for videos
    $all('video', sec).forEach(function (v) {
      var poster = v.getAttribute('poster');
      if (!poster || (v.previousElementSibling && v.previousElementSibling.classList.contains('deck-print-poster'))) return;
      var img = document.createElement('img');
      img.className = (v.getAttribute('class') || '') + ' deck-print-poster';
      if (v.getAttribute('style')) img.setAttribute('style', v.getAttribute('style'));
      img.loading = 'lazy'; img.src = poster; img.alt = v.getAttribute('aria-label') || ''; img.decoding = 'async';
      v.parentNode.insertBefore(img, v);
    });
    // stagger + delays
    $all('[data-stagger]', sec).forEach(function (p) {
      var step = parseFloat(p.getAttribute('data-stagger')) || 80;
      var base = parseFloat(p.getAttribute('data-delay')) || 0;
      var kids = Array.prototype.slice.call(p.children);
      kids.forEach(function (k, j) {
        if (!k.hasAttribute('data-animate')) k.setAttribute('data-animate', p.getAttribute('data-stagger-animate') || 'fade-up');
        if (!k.hasAttribute('data-delay')) k.setAttribute('data-delay', base + j * step);
      });
    });
    $all('[data-animate]', sec).forEach(function (el) {
      var d = el.getAttribute('data-delay'); if (d) el.style.setProperty('--d', parseFloat(d) + 'ms');
      var dur = el.getAttribute('data-duration'); if (dur) el.style.setProperty('--reveal-dur', parseFloat(dur) + 'ms');
      if (el.getAttribute('data-animate') === 'draw' && el.getTotalLength) {
        try { el.style.setProperty('--len', Math.ceil(el.getTotalLength())); } catch (e) {}
      }
    });
  }

  function title(sec) {
    if (sec.getAttribute('data-title')) return sec.getAttribute('data-title');
    var h = sec.querySelector('h1, h2, h3');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Slide ' + (S.slides.indexOf(sec) + 1);
  }
  function notes(sec) {
    var n = sec.querySelector('aside[data-notes], aside.notes');
    if (n) return n.innerHTML;
    return sec.getAttribute('data-notes') || '';
  }

  /* -- Layout ------------------------------------------------------- */
  function layout() {
    var W = de.clientWidth || window.innerWidth, H = window.innerHeight;
    var o = S.o, s, slideH;
    de.classList.toggle('deck-reflow', !!(o.reflow && W < o.reflow && !S.present));
    if (S.present) {
      s = Math.min(W / STAGE_W, H / STAGE_H);
      slideH = H;
    } else if (W / H >= 1.2) {
      s = Math.min(W / STAGE_W, H / STAGE_H);
      slideH = H;
      de.classList.remove('deck-portrait');
    } else {
      s = W / STAGE_W;
      slideH = Math.round(STAGE_H * s);
      de.classList.add('deck-portrait');
    }
    de.style.setProperty('--deck-scale', s.toFixed(5));
    // physical scale: stage px -> device px. Design JS can upgrade photos to their hi-res files when > 1.
    var phys = s * (window.devicePixelRatio || 1);
    de.style.setProperty('--deck-physical-scale', phys.toFixed(4));
    de.style.setProperty('--deck-slide-h', slideH + 'px');
    if (S.overview) {
      var first = S.slides[0];
      if (first) de.style.setProperty('--deck-thumb-scale', (first.getBoundingClientRect().width / STAGE_W).toFixed(5));
    }
    emit(document, 'deck:layout', { scale: s, physical: phys });
  }

  /* -- Reveal ------------------------------------------------------- */
  function countUp(el, instant) {
    var to = parseFloat(el.getAttribute('data-count'));
    if (isNaN(to)) return;
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
    var fmt = function (v) { return pre + v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf; };
    if (instant || reduced()) { el.textContent = fmt(to); return; }
    var from = parseFloat(el.getAttribute('data-from') || '0');
    var dur = parseFloat(el.getAttribute('data-count-duration') || '1400');
    var delay = parseFloat(el.getAttribute('data-delay') || '0');
    var t0 = null;
    el.textContent = fmt(from);
    var step = function (now) {
      if (t0 === null) t0 = now + delay;
      var p = Math.max(0, Math.min(1, (now - t0) / dur));
      var e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function enter(sec) {
    if (sec.classList.contains('is-in')) return;
    sec.classList.add('is-in');
    var els = $all('[data-animate]', sec);
    // double rAF so the initial state is committed before transitioning
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      els.forEach(function (el) {
        el.classList.add('is-in');
        var a = el.getAttribute('data-animate');
        if (a === 'mask' || a === 'mask-up') {
          var done = function (e) { if (e.propertyName === 'clip-path' && el.classList.contains('is-in')) el.classList.add('deck-done'); };
          el.addEventListener('transitionend', done);
          if (reduced()) el.classList.add('deck-done');
        }
      });
    }); });
    $all('[data-count]', sec).forEach(function (el) { countUp(el); });
    // reduced motion: autoplay loops stay on their poster frame (a deck can still offer a play button)
    if (!reduced()) $all('video[data-autoplay]', sec).forEach(function (v) { try { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} });
    emit(sec, 'slide:enter', { index: S.slides.indexOf(sec), slide: sec });
  }
  function leave(sec) {
    var replay = S.o.replay === 'always' || (S.o.replay === 'present' && S.present);
    $all('video[data-autoplay]', sec).forEach(function (v) { try { v.pause(); } catch (e) {} });
    if (!replay || !sec.classList.contains('is-in')) return;
    sec.classList.remove('is-in');
    $all('[data-animate]', sec).forEach(function (el) { el.classList.remove('is-in', 'deck-done'); });
    $all('[data-step]', sec).forEach(function (el) { el.classList.remove('step-on'); });
    emit(sec, 'slide:leave', { index: S.slides.indexOf(sec), slide: sec });
  }

  /* -- State / navigation ------------------------------------------ */
  function setCurrent(i, fromScroll) {
    i = Math.max(0, Math.min(S.slides.length - 1, i));
    var prev = S.index;
    S.index = i;
    S.slides.forEach(function (s, j) {
      s.classList.toggle('is-active', j === i);
      s.classList.toggle('is-before', j < i);
      s.classList.toggle('is-after', j > i);
    });
    var sec = S.slides[i];
    // full-bleed art can opt out of the progress bar: <section data-slide data-no-progress>
    de.classList.toggle('deck-no-progress', !!(sec && sec.hasAttribute('data-no-progress')));
    if (S.o.hash && sec) {
      var h = '#' + sec.id;
      if (location.hash !== h) try { history.replaceState(null, '', h + (S.present ? '' : '')); } catch (e) {}
    }
    updateUI();
    updateNotes();
    if (prev !== i || !fromScroll) emit(document, 'deck:change', { index: i, prev: prev, slide: sec, total: S.slides.length });
  }

  function go(i, opts) {
    opts = opts || {};
    if (typeof i === 'string') {
      var el = document.getElementById(i.replace(/^#/, ''));
      i = el ? S.slides.indexOf(el.closest('[data-slide]')) : parseInt(i, 10) - 1;
    }
    if (isNaN(i) || i < 0) i = 0;
    i = Math.min(S.slides.length - 1, i);
    if (S.present) {
      var prev = S.slides[S.index];
      // a pending leave() for the slide we are going back to would blank it: cancel it
      cancelLeave(S.slides[i]);
      if (prev && prev !== S.slides[i]) {
        prev.classList.add('is-leaving');
        scheduleLeave(prev);
      }
      setCurrent(i);
      enter(S.slides[i]);
    } else {
      setCurrent(i);
      var target = S.slides[i];
      if (target) {
        var y = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: y, behavior: opts.instant || reduced() ? 'auto' : 'smooth' });
      }
    }
  }

  function scheduleLeave(p) {
    cancelLeave(p);
    var rec = { sec: p, t: 0 };
    rec.t = setTimeout(function () {
      S.leaving = S.leaving.filter(function (r) { return r !== rec; });
      p.classList.remove('is-leaving');
      // never strip the slide that is on screen (quick back / forward)
      if (S.present && !S.overview && S.slides[S.index] === p) return;
      leave(p);
    }, LEAVE_MS);
    S.leaving.push(rec);
  }
  /** Cancel pending leave timers for one slide (or all when sec is omitted). */
  function cancelLeave(sec) {
    S.leaving = S.leaving.filter(function (r) {
      if (sec && r.sec !== sec) return true;
      clearTimeout(r.t); r.sec.classList.remove('is-leaving');
      return false;
    });
  }

  function stepsOf(sec) {
    return $all('[data-step]', sec).sort(function (a, b) { return (+a.getAttribute('data-step') || 0) - (+b.getAttribute('data-step') || 0); });
  }
  function next() {
    var sec = S.slides[S.index];
    if (S.present && sec) {
      var pending = stepsOf(sec).filter(function (el) { return !el.classList.contains('step-on'); });
      if (pending.length) {
        var n = pending[0].getAttribute('data-step');
        pending.filter(function (el) { return el.getAttribute('data-step') === n; }).forEach(function (el) { el.classList.add('step-on'); });
        emit(sec, 'slide:step', { step: n });
        return;
      }
    }
    go(S.index + 1);
  }
  function prev() {
    var sec = S.slides[S.index];
    if (S.present && sec) {
      var on = stepsOf(sec).filter(function (el) { return el.classList.contains('step-on'); });
      if (on.length) {
        var n = on[on.length - 1].getAttribute('data-step');
        on.filter(function (el) { return el.getAttribute('data-step') === n; }).forEach(function (el) { el.classList.remove('step-on'); });
        return;
      }
    }
    go(S.index - 1);
  }

  /* -- Presentation mode ------------------------------------------- */
  function setPresent(on, opts) {
    opts = opts || {};
    on = on == null ? !S.present : !!on;
    if (on === S.present) return;
    if (S.overview) setOverview(false);
    S.present = on;
    de.classList.toggle('deck-present', on);
    if (on) {
      if (!S.startTime) S.startTime = Date.now();
      if (opts.fullscreen !== false && S.o.fullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
        var p = de.requestFullscreen && de.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      }
      layout();
      S.slides.forEach(function (s, j) { if (j !== S.index) leave(s); });
      go(S.index);
      armIdle();
    } else {
      cancelLeave();
      if (document.fullscreenElement && document.exitFullscreen) { var q = document.exitFullscreen(); if (q && q.catch) q.catch(function () {}); }
      de.classList.remove('deck-idle');
      layout();
      $all('[data-step]').forEach(function (el) { el.classList.add('step-on'); });
      var target = S.slides[S.index];
      if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
      S.slides.forEach(function (s) { if (isInView(s)) enter(s); });
    }
    updateUI();
    emit(document, 'deck:mode', { present: on });
  }

  function armIdle() {
    de.classList.remove('deck-idle');
    clearTimeout(S.idleT);
    S.idleT = setTimeout(function () { de.classList.add('deck-idle'); }, S.present ? 2500 : 4000);
  }

  /* -- Overview ------------------------------------------------------ */
  function setOverview(on) {
    on = on == null ? !S.overview : !!on;
    if (on === S.overview) return;
    S.overview = on;
    de.classList.toggle('deck-overview', on);
    if (on) {
      cancelLeave();
      // thumbnails show every slide in its final state, with every photo loaded
      S.slides.forEach(function (s) {
        s.classList.add('is-in');
        $all('[data-animate]', s).forEach(function (el) {
          el.classList.add('is-in');
          var a = el.getAttribute('data-animate');
          if (a === 'mask' || a === 'mask-up') el.classList.add('deck-done');
        });
        $all('[data-count]', s).forEach(function (el) { countUp(el, true); });
      });
      $all('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
      layout();
      var cur = S.slides[S.index];
      if (cur) cur.scrollIntoView({ block: 'center' });
    } else {
      layout();
      if (S.present) go(S.index);
      else { var t = S.slides[S.index]; if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY); }
    }
    emit(document, 'deck:overview', { on: on });
  }

  /* -- Speaker notes window ---------------------------------------- */
  /** Absolute URL of a brand font file, resolved from where deck.js (and tokens.css) live. */
  function brandURL(rel) {
    var base = scriptSrc;
    if (!base) { var l = document.querySelector('link[href*="tokens.css"]'); base = l ? l.href : location.href; }
    try { return new URL(rel, base).href; } catch (e) { return rel; }
  }
  function notesFontFaces() {
    var f = function (fam, file, w) {
      return '@font-face{font-family:"' + fam + '";src:url("' + brandURL('fonts/' + file) + '") format("woff2");font-weight:' + w + ';font-style:normal;font-display:swap}';
    };
    return f('Geist Mono', 'GeistMono-Variable.woff2', '100 900') +
      f('Barlow Condensed', 'BarlowCondensed-500.woff2', 500) +
      f('Barlow Condensed', 'BarlowCondensed-700.woff2', 700) +
      f('Barlow Condensed', 'BarlowCondensed-800.woff2', 800) +
      f('Permanent Marker', 'PermanentMarker-latin.woff2', 400);
  }
  var NOTES_CSS =
    ':root{--void:#080808;--deep:#150d12;--line:#3a2733;--mid:#8f6f83;--base:#FFB2EF;--light:#FDF0F8;--fs:1}' +
    '*{box-sizing:border-box}html,body{margin:0;height:100%}' +
    'body{background:radial-gradient(1200px 600px at 85% -10%,rgba(255,178,239,.13),transparent 60%),var(--void);color:var(--light);' +
      'font:400 16px/1.55 "Geist Mono",ui-monospace,Menlo,monospace;display:grid;grid-template-rows:auto 3px minmax(0,1fr) auto;-webkit-font-smoothing:antialiased}' +
    '.top{display:flex;align-items:center;gap:18px;padding:16px 28px;border-bottom:1px solid var(--line)}' +
    '.brand{display:flex;align-items:baseline;gap:12px;min-width:0}' +
    '.num{font:800 34px/1 "Barlow Condensed",Impact,sans-serif;color:var(--base);letter-spacing:.02em;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.num small{font-size:22px;color:var(--mid);font-weight:500}' +
    '.deck-name{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}' +
    '.sp{flex:1}.btns{display:flex;gap:8px}' +
    'button{background:#1c1419;color:var(--light);border:1px solid #4c3043;border-radius:10px;padding:9px 14px;font:500 14px/1 "Geist Mono",monospace;cursor:pointer;min-height:38px;white-space:nowrap}' +
    '.clock{white-space:nowrap}' +
    'button:hover,button:focus-visible{border-color:var(--base);outline:none;color:var(--base)}' +
    '.time{display:flex;align-items:baseline;gap:12px;cursor:pointer;user-select:none}' +
    '.timer{font:700 38px/1 "Geist Mono",monospace;color:var(--base);font-variant-numeric:tabular-nums;letter-spacing:-.02em}' +
    '.timer.paused{opacity:.45}.clock{font-size:14px;color:var(--mid);font-variant-numeric:tabular-nums}' +
    '.bar{background:#241820}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c86bb5,var(--base));transition:width .35s ease}' +
    'main{overflow:auto;min-height:0;padding:26px 28px 56px}' +
    '.lbl{display:block;font:600 12px/1 "Geist Mono",monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--base);margin-bottom:10px}' +
    '.cur{margin:0 0 20px;font:800 calc(clamp(30px,4.4vw,58px)*var(--fs))/1.02 "Barlow Condensed",Impact,sans-serif;letter-spacing:-.005em;text-wrap:balance}' +
    '.notes{max-width:68ch;font-size:calc(clamp(19px,2.2vw,28px)*var(--fs));line-height:1.6;color:#f6e6f0}' +
    '.notes p{margin:0 0 .8em}.notes b,.notes strong{color:var(--base);font-weight:700}.notes em{font-family:"Permanent Marker",cursive;font-style:normal;color:var(--base)}' +
    '.notes .empty{color:var(--mid)}' +
    '.next{display:flex;align-items:center;gap:18px;padding:14px 28px 16px;background:var(--deep);border-top:1px solid var(--line)}' +
    '.next .lbl{margin:0;color:var(--mid)}' +
    '.nx{flex:1;min-width:0;font:700 calc(clamp(20px,2.4vw,30px)*var(--fs))/1.1 "Barlow Condensed",Impact,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.fs{display:flex;gap:6px}.fs button{padding:8px 11px;min-width:42px}' +
    '.hint{font-size:12px;color:var(--mid);white-space:nowrap}' +
    'body>*{min-width:0}' +
    '@media (max-width:1000px){.hint{display:none}.clock{display:none}}' +
    '@media (max-width:640px){.hint,.deck-name{display:none}.top{flex-wrap:wrap}}' +
    '@media (prefers-reduced-motion:reduce){.bar i{transition:none}}';

  /**
   * Optional notes-window theme (Deck.init({ notesTheme })). Omitted = the original look, unchanged.
   * notesTheme: { void, deep, line, mid, base, light, text, bar, button, buttonLine,   (any CSS colours / gradient for bar)
   *               fontBody, fontDisplay, displayWeight, displayCase, fontHand, fontFaces, css } (fontFaces: @font-face CSS, absolute URLs;
   *               css: extra rules appended last)
   */
  function notesThemeCSS() {
    var t = S.o && S.o.notesTheme; if (!t) return '';
    var v = ['void', 'deep', 'line', 'mid', 'base', 'light'].filter(function (k) { return t[k]; }).map(function (k) { return '--' + k + ':' + t[k]; }).join(';');
    var css = (t.fontFaces || '') + (v ? ':root{' + v + '}' : '');
    css += 'body{background:var(--void)' + (t.fontBody ? ';font-family:' + t.fontBody : '') + '}';
    if (t.fontBody) css += 'button,.timer,.lbl{font-family:' + t.fontBody + '}.timer{font-weight:700}';
    if (t.fontDisplay) css += '.num,.cur,.nx{font-family:' + t.fontDisplay + ';font-weight:' + (t.displayWeight || 400) + ';text-transform:' + (t.displayCase || 'none') + ';letter-spacing:.01em}.num small{font-weight:' + (t.displayWeight || 400) + '}';
    if (t.text) css += '.notes{color:' + t.text + '}';
    if (t.fontHand) css += '.notes em{font-family:' + t.fontHand + '}';
    css += '.bar{background:var(--deep)}.bar i{background:' + (t.bar || 'var(--base)') + '}';
    css += 'button{background:' + (t.button || 'var(--deep)') + ';border-color:' + (t.buttonLine || 'var(--line)') + '}';
    if (t.css) css += t.css; // optional extra rules from the deck (list markers, labels); omitted = unchanged
    return css;
  }

  function openNotes() {
    if (S.notesWin && !S.notesWin.closed) { S.notesWin.focus(); return S.notesWin; }
    var w = window.open('', 'deck-notes', 'width=1100,height=720');
    if (!w) return null;
    S.notesWin = w;
    if (!S.startTime) S.startTime = Date.now();
    var deckTitle = (document.title || 'Slides').replace(/[<>&]/g, '');
    w.document.open();
    w.document.write('<!doctype html><html lang="' + (de.getAttribute('lang') || 'en') + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Speaker notes · ' + deckTitle + '</title>' +
      '<style>' + notesFontFaces() + NOTES_CSS + notesThemeCSS() + '</style></head><body>' +
      '<div class="top"><div class="brand"><span class="num" id="n"></span><span class="deck-name">Speaker notes · ' + deckTitle + '</span></div><span class="sp"></span>' +
      '<span class="btns"><button id="p" type="button" title="Previous (←)">&larr; Prev</button><button id="x" type="button" title="Next (→)">Next &rarr;</button></span>' +
      '<span class="time" id="tm" title="Click: pause / resume. Double-click: reset"><span class="timer" id="t">00:00</span><span class="clock" id="c"></span></span></div>' +
      '<div class="bar" aria-hidden="true"><i id="pg"></i></div>' +
      '<main><span class="lbl">Now</span><h1 class="cur" id="h"></h1><div class="notes" id="b"></div></main>' +
      '<div class="next"><span class="lbl">Up next</span><span class="nx" id="nx"></span>' +
      '<span class="hint">A&minus; / A+ text size</span><span class="fs"><button id="fm" type="button" aria-label="Smaller text">A&minus;</button><button id="fp" type="button" aria-label="Larger text">A+</button></span></div>' +
      '</body></html>');
    w.document.close();
    var d = w.document, fs = 1;
    var setFs = function (v) { fs = Math.max(0.7, Math.min(1.8, v)); d.documentElement.style.setProperty('--fs', fs.toFixed(2)); };
    try { var saved = parseFloat(localStorage.getItem('deck-notes-fs')); if (saved) setFs(saved); } catch (e) {}
    var bump = function (dv) { setFs(fs + dv); try { localStorage.setItem('deck-notes-fs', String(fs)); } catch (e) {} };
    d.getElementById('p').onclick = function () { prev(); };
    d.getElementById('x').onclick = function () { next(); };
    d.getElementById('fm').onclick = function () { bump(-0.1); };
    d.getElementById('fp').onclick = function () { bump(0.1); };
    var tm = d.getElementById('tm');
    tm.onclick = function () {
      if (S.pausedAt) { S.startTime += Date.now() - S.pausedAt; S.pausedAt = 0; } else S.pausedAt = Date.now();
      updateNotesClock();
    };
    tm.ondblclick = function () { S.startTime = Date.now(); S.pausedAt = S.pausedAt ? Date.now() : 0; updateNotesClock(); };
    d.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); bump(0.1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); bump(-0.1); return; }
      if (e.key === 's' || e.key === 'S') return; // S from the notes window must not reopen itself
      onKey(e);
    });
    updateNotes();
    if (!S.notesTimer) S.notesTimer = setInterval(updateNotesClock, 1000);
    return w;
  }
  function updateNotesClock() {
    var w = S.notesWin;
    if (!w || w.closed) { clearInterval(S.notesTimer); S.notesTimer = null; return; }
    var s = Math.max(0, Math.floor(((S.pausedAt || Date.now()) - S.startTime) / 1000));
    var t = w.document.getElementById('t'), c = w.document.getElementById('c');
    if (t) {
      t.textContent = (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % (s >= 3600 ? 60 : 1000)) + ':' + pad(s % 60);
      t.classList.toggle('paused', !!S.pausedAt);
    }
    if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function updateNotes() {
    var w = S.notesWin;
    if (!w || w.closed) return;
    var sec = S.slides[S.index], nx = S.slides[S.index + 1], n = S.slides.length;
    var d = w.document;
    d.getElementById('n').innerHTML = pad(S.index + 1) + ' <small>/ ' + pad(n) + '</small>';
    d.getElementById('h').textContent = sec ? title(sec) : '';
    d.getElementById('b').innerHTML = (sec && notes(sec)) || '<span class="empty">No notes for this slide.</span>';
    d.getElementById('nx').textContent = nx ? title(nx) : 'End of deck. Take a bow!';
    var pg = d.getElementById('pg'); if (pg) pg.style.width = (n > 1 ? S.index / (n - 1) * 100 : 100) + '%';
    var m = d.querySelector('main'); if (m) m.scrollTop = 0;
    updateNotesClock();
  }

  /* -- UI ---------------------------------------------------------- */
  function buildUI() {
    if (!S.o.ui) return;
    var prog = document.createElement('div');
    prog.className = 'deck-ui deck-progress'; prog.setAttribute('aria-hidden', 'true');
    prog.innerHTML = '<i></i>';
    var hud = document.createElement('div');
    hud.className = 'deck-ui deck-hud';
    hud.innerHTML =
      '<button class="deck-btn" type="button" data-deck-act="overview" title="Overview (O)">Grid <kbd>O</kbd></button>' +
      '<button class="deck-btn deck-btn--primary" type="button" data-deck-act="present" title="Present (P)"><span class="lbl">Present</span> <kbd>P</kbd></button>' +
      '<span class="deck-counter" aria-live="polite"><b>01</b> / 01</span>';
    var help = document.createElement('div');
    help.className = 'deck-ui deck-help';
    help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'Keyboard shortcuts');
    help.innerHTML = '<div><h4>Keyboard</h4><dl>' +
      '<dt><kbd>&rarr;</kbd><kbd>Space</kbd><kbd>PgDn</kbd></dt><dd>Next</dd>' +
      '<dt><kbd>&larr;</kbd><kbd>&#8679; Space</kbd><kbd>PgUp</kbd></dt><dd>Previous</dd>' +
      '<dt><kbd>Home</kbd><kbd>End</kbd></dt><dd>First / last slide</dd>' +
      '<dt><kbd>P</kbd></dt><dd>Present mode (16:9, one slide at a time)</dd>' +
      '<dt><kbd>F</kbd></dt><dd>Fullscreen</dd>' +
      '<dt><kbd>O</kbd></dt><dd>Overview grid (arrows move, Enter opens)</dd>' +
      '<dt><kbd>S</kbd></dt><dd>Speaker notes window</dd>' +
      '<dt><kbd>L</kbd></dt><dd>Chlo&eacute;&rsquo;s laser</dd>' +
      '<dt><kbd>?</kbd></dt><dd>This list</dd>' +
      '<dt><kbd>Esc</kbd></dt><dd>Close this, leave fullscreen, then present mode</dd>' +
      '<dt><kbd>Swipe</kbd></dt><dd>Next / previous on a touchscreen</dd>' +
      '</dl></div>';
    var ovt = document.createElement('div');
    ovt.className = 'deck-ui deck-overview-title';
    ovt.innerHTML = '<span>' + (document.title || 'Slides') + ' &middot; overview</span><span>Click a slide &middot; Esc to close</span>';
    document.body.appendChild(prog); document.body.appendChild(hud); document.body.appendChild(help); document.body.appendChild(ovt);
    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-deck-act]'); if (!b) return;
      var a = b.getAttribute('data-deck-act');
      if (a === 'present') setPresent();
      if (a === 'overview') setOverview();
    });
    help.addEventListener('click', function () { help.classList.remove('is-on'); });
    S.ui = { prog: prog, hud: hud, help: help, counter: hud.querySelector('.deck-counter'), presentLbl: hud.querySelector('[data-deck-act=present] .lbl') };
  }
  function updateUI() {
    var n = S.slides.length, i = S.index;
    de.style.setProperty('--deck-progress', n > 1 ? (i / (n - 1)).toFixed(4) : '1');
    $all('[data-slide-current]').forEach(function (el) { el.textContent = pad(i + 1); });
    if (!S.ui.counter) return;
    S.ui.counter.innerHTML = '<b>' + pad(i + 1) + '</b> / ' + pad(n);
    if (S.ui.presentLbl) S.ui.presentLbl.textContent = S.present ? 'Exit' : 'Present';
  }

  /* -- Input ------------------------------------------------------- */
  function onKey(e) {
    if (!S.o.keys || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    var k = e.key;
    // present mode: key presses never wake the HUD (the audience would see it on every advance);
    // only pointer movement does. Website mode keeps the old behaviour.
    if (!S.present) armIdle();
    if (S.overview) {
      var ovTo = function (n) { e.preventDefault(); setCurrent(n); S.slides[S.index].scrollIntoView({ block: 'nearest' }); };
      if (k === 'Escape' || k === 'o' || k === 'O') { e.preventDefault(); setOverview(false); }
      else if (k === 'ArrowRight') ovTo(S.index + 1);
      else if (k === 'ArrowLeft') ovTo(S.index - 1);
      else if (k === 'ArrowDown') ovTo(S.index + overviewCols());
      else if (k === 'ArrowUp') ovTo(S.index - overviewCols());
      else if (k === 'Home') ovTo(0);
      else if (k === 'End') ovTo(S.slides.length - 1);
      else if (k === 'Enter') { e.preventDefault(); setOverview(false); }
      return;
    }
    // Space on a focused control (keyboard focus only) toggles that control instead of advancing
    if ((k === ' ' || k === 'Spacebar') && e.target && e.target.closest && e.target.closest('button,[role=button],input,summary,a,[role=checkbox],[role=switch]')) {
      var fv = false; try { fv = e.target.matches(':focus-visible'); } catch (err) {}
      if (fv) return;
    }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Spacebar':
        if (k === ' ' && e.shiftKey) { e.preventDefault(); prev(); break; }
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(S.slides.length - 1); break;
      case 'p': case 'P': e.preventDefault(); setPresent(); break;
      case 'o': case 'O': e.preventDefault(); setOverview(); break;
      case 's': case 'S': e.preventDefault(); openNotes(); break;
      case 'f': case 'F':
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen(); else if (de.requestFullscreen) { var p = de.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }
        break;
      case '?': e.preventDefault(); if (S.ui.help) S.ui.help.classList.toggle('is-on'); break;
      case 'Escape':
        // one step per press: help, then fullscreen (the browser usually eats that press), then present mode
        if (S.ui.help && S.ui.help.classList.contains('is-on')) S.ui.help.classList.remove('is-on');
        else if (document.fullscreenElement) { if (document.exitFullscreen) { var xq = document.exitFullscreen(); if (xq && xq.catch) xq.catch(function () {}); } }
        else if (S.present) setPresent(false);
        break;
    }
  }

  /** Columns in the overview grid, measured from the laid-out thumbnails. */
  function overviewCols() {
    var top0 = S.slides[0] && S.slides[0].getBoundingClientRect().top, n = 0;
    for (var i = 0; i < S.slides.length && Math.abs(S.slides[i].getBoundingClientRect().top - top0) < 4; i++) n++;
    return Math.max(1, n);
  }

  function bindInput() {
    document.addEventListener('keydown', onKey);
    // swipe + wheel in present mode
    var tx = 0, ty = 0;
    document.addEventListener('touchstart', function (e) { if (!S.present) return; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!S.present) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
      else if (Math.abs(dy) > 60) { if (dy < 0) next(); else prev(); }
    }, { passive: true });
    var wheelLock = 0;
    window.addEventListener('wheel', function (e) {
      if (!S.present || S.overview) return;
      e.preventDefault();
      var now = Date.now();
      if (now - wheelLock < 650 || Math.abs(e.deltaY) < 12) return;
      wheelLock = now;
      if (e.deltaY > 0) next(); else prev();
    }, { passive: false });
    document.addEventListener('mousemove', armIdle, { passive: true });
    document.addEventListener('touchstart', function () { if (!S.present) armIdle(); }, { passive: true });
    window.addEventListener('scroll', function () { if (!S.present && de.classList.contains('deck-idle')) armIdle(); }, { passive: true });
    // overview click
    document.addEventListener('click', function (e) {
      if (!S.overview) return;
      var s = e.target.closest('[data-slide]');
      if (!s) return;
      e.preventDefault();
      S.index = S.slides.indexOf(s);
      setOverview(false);
    }, true);
    window.addEventListener('resize', function () { layout(); });
    document.addEventListener('fullscreenchange', function () {
      layout();
      if (!document.fullscreenElement && S.present && S.o.exitWithFullscreen) setPresent(false);
    });
    window.addEventListener('hashchange', function () {
      var el = location.hash && document.getElementById(location.hash.slice(1));
      var sec = el && el.closest('[data-slide]');
      if (sec && S.slides.indexOf(sec) !== S.index) go(S.slides.indexOf(sec));
    });
    window.addEventListener('beforeprint', function () { preparePrintSync(); });
  }

  function isInView(s) {
    var r = s.getBoundingClientRect();
    return r.bottom > window.innerHeight * 0.25 && r.top < window.innerHeight * 0.75;
  }

  function observe() {
    if (!window.IntersectionObserver) { S.slides.forEach(enter); return; }
    var ratios = new Map();
    var io = new IntersectionObserver(function (entries) {
      if (S.present || S.overview) return;
      entries.forEach(function (en) {
        ratios.set(en.target, en.intersectionRatio);
        if (en.isIntersecting && (en.intersectionRatio >= 0.3 || en.intersectionRect.height >= window.innerHeight * 0.3)) enter(en.target); /* tall reflowed slides can never reach 30% */
        else if (!en.isIntersecting) leave(en.target);
      });
      var best = -1, bi = S.index;
      S.slides.forEach(function (s, i) { var r = ratios.get(s) || 0; if (r > best + 0.01) { best = r; bi = i; } });
      if (best > 0 && bi !== S.index) setCurrent(bi, true);
    }, { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    S.slides.forEach(function (s) { io.observe(s); });
  }

  /* -- Print ------------------------------------------------------- */
  function preparePrintSync() {
    S.slides.forEach(function (s) {
      s.classList.add('is-in');
      $all('[data-animate]', s).forEach(function (el) { el.classList.add('is-in', 'deck-done'); });
      $all('[data-count]', s).forEach(function (el) { countUp(el, true); });
      $all('[data-step]', s).forEach(function (el) { el.classList.add('step-on'); });
    });
    if (root.BgShaders && root.BgShaders.renderStills && !root.BgShaders.printing) root.BgShaders.renderStills({ width: S.o.printWidth });
  }
  /** Freeze everything at final state and wait for fonts/images. Use before page.pdf() or window.print(). */
  function preparePrint() {
    preparePrintSync();
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    $all('img').forEach(function (img) {
      if (img.loading === 'lazy') img.loading = 'eager';
      if (!img.complete) waits.push(new Promise(function (r) { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }));
      else if (img.decode) waits.push(img.decode().catch(function () {}));
    });
    return Promise.all(waits).then(function () { return true; });
  }

  /* -- Init -------------------------------------------------------- */
  function init(opts) {
    if (S.o) return Deck;
    S.o = Object.assign({
      root: null,             // element holding the slides (default: parent of first [data-slide])
      selector: '[data-slide]',
      ui: true,               // progress bar + HUD (counter, Present, Grid)
      keys: true,
      hash: true,             // #<slide id> in URL
      replay: 'present',      // replay reveals on re-enter: 'present' | 'always' | 'never'
      reflow: 0,              // px width under which slides un-scale (opt-in responsive layout)
      fullscreen: true,       // request fullscreen when entering present mode
      exitWithFullscreen: false, // Esc #1 leaves fullscreen, Esc #2 leaves present mode
      printWidth: 3840        // BgShaders still width for print
    }, opts || {});
    ensureCSS();
    S.slides = $all(S.o.selector, S.o.root || document);
    if (!S.slides.length) return Deck;
    var rootEl = S.o.root || S.slides[0].parentElement;
    rootEl.classList.add('deck-root');
    de.classList.add('deck-js');
    S.slides.forEach(wrapStage);
    $all('[data-slide-total]').forEach(function (el) { el.textContent = pad(S.slides.length); });
    buildUI();
    layout();
    armIdle();
    bindInput();
    observe();
    // initial slide from hash
    var start = 0;
    if (location.hash) {
      var el = document.getElementById(location.hash.slice(1));
      var sec = el && el.closest(S.o.selector);
      if (sec) start = S.slides.indexOf(sec);
      else if (/^#\d+$/.test(location.hash)) start = parseInt(location.hash.slice(1), 10) - 1;
    }
    S.index = Math.max(0, Math.min(S.slides.length - 1, start));
    setCurrent(S.index);
    if (/[?&](present|mode=present)\b/.test(location.search)) setPresent(true, { fullscreen: false });
    else if (start) go(start, { instant: true });
    emit(document, 'deck:ready', { total: S.slides.length });
    return Deck;
  }

  var Deck = {
    STAGE_W: STAGE_W, STAGE_H: STAGE_H,
    init: init,
    go: go, next: next, prev: prev,
    get index() { return S.index; },
    get slides() { return S.slides.slice(); },
    get isPresenting() { return S.present; },
    current: function () { return S.slides[S.index] || null; },
    present: function (on) { setPresent(on == null ? true : on); return Deck; },
    togglePresent: function () { setPresent(); return Deck; },
    overview: function (on) { setOverview(on); return Deck; },
    notes: openNotes,
    layout: layout,
    enter: enter,
    preparePrint: preparePrint,
    /**
     * Subscribe to a deck event. deck:change / deck:mode fire once during init(), usually before a
     * design's scripts subscribe; pass { now: true } to also get a call right away with the current state.
     */
    on: function (name, fn, opts) {
      document.addEventListener(name, function (e) { fn(e.detail, e); });
      if (opts && opts.now && S.o && S.slides.length) {
        if (name === 'deck:change') fn({ index: S.index, prev: S.index, slide: S.slides[S.index], total: S.slides.length, initial: true }, null);
        else if (name === 'deck:mode') fn({ present: S.present, initial: true }, null);
        else if (name === 'deck:ready') fn({ total: S.slides.length, initial: true }, null);
      }
      return Deck;
    },
    get isOverview() { return S.overview; },
    /** Viewport rect of the present-mode HUD (null when hidden), so overlays can keep clear of it. */
    hudRect: function () { var h = S.ui && S.ui.hud; if (!h) return null; var r = h.getBoundingClientRect(); return r.width ? r : null; }
  };

  root.Deck = Deck;
})(window);
