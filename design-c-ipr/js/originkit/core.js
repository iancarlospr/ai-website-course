/* =====================================================================
   OriginKit recreations: shared runtime (classic script, no modules)
   design-c-ipr/js/originkit/core.js   (load BEFORE the component files)

   Framework-free re-builds of four originkit.dev components for the
   course deck. OriginKit's licence (originkit.dev/docs/licensing) allows
   use in courses and teaching, needs no attribution, and forbids
   redistributing the components as a kit. These are clean-room
   recreations used as live illustrations on one slide; do not ship
   this folder as a component library.

   Every component: window.OriginKit.<Name>.mount(el, opts) -> handle
     handle.destroy()   stops the loop, removes listeners and nodes
     handle.render()    forces one frame (used by print)
   Shared behaviour handled here:
     - devicePixelRatio x deck transform scale for crisp canvases (4K)
     - pauses when offscreen (IntersectionObserver) or the tab is hidden
     - prefers-reduced-motion -> one composed static frame, no loop
     - print (media query, beforeprint) -> static frame at >= 2.5x
   Colours come from the client theme's SEMANTIC tokens (theme.css §2),
   resolved through a probe element so var() chains work.
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit = window.OriginKit || {};
  if (OK._core) return;

  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqPrint = window.matchMedia ? window.matchMedia('print') : null;
  var printing = false;

  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function isPrint() { return printing || !!(mqPrint && mqPrint.matches); }

  /* Resolve a CSS colour (token name like '--tone-mint', or any colour) to [r,g,b,a] in el's scope */
  function color(el, token, fallback) {
    var probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;';
    var v = token && token.indexOf('--') === 0 ? 'var(' + token + (fallback ? ',' + fallback : '') + ')' : (token || fallback);
    probe.style.color = fallback || '#000';
    probe.style.color = v;
    (el || document.body).appendChild(probe);
    var c = getComputedStyle(probe).color;
    probe.parentNode.removeChild(probe);
    var m = c.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/);
    if (!m) return [0, 0, 0, 1];
    var a = m[4] == null ? 1 : (m[4].indexOf('%') > 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return [+m[1], +m[2], +m[3], a];
  }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? (c[3] == null ? 1 : c[3]) : a) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }

  /* Layout size in stage px (untransformed) and the stage->device pixel ratio */
  function measure(el) {
    var w = el.offsetWidth || el.clientWidth || 0, h = el.offsetHeight || el.clientHeight || 0;
    var r = el.getBoundingClientRect();
    var tf = w ? r.width / w : 1;
    if (!isFinite(tf) || tf <= 0) tf = 1;
    tf = Math.min(tf, 4); // tile tilt can inflate the rect a touch; never over-allocate
    var phys = tf * (window.devicePixelRatio || 1);
    if (isPrint()) phys = Math.max(phys, 2.5);
    return { w: w, h: h, phys: Math.max(1, phys) };
  }

  /* Size a canvas to cover w x h stage px at `phys`, capped by a pixel budget. Returns the scale used. */
  function fitCanvas(cv, w, h, phys, budget) {
    budget = budget || 14e6;
    var s = phys;
    if (w * h * s * s > budget) s = Math.sqrt(budget / (w * h));
    var W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    return s;
  }

  /* Print: Chrome can print a transparent 2D canvas as an opaque white box, so in print each
     canvas is swapped for an <img> snapshot of its still frame (same box, same stacking). */
  function snapshot(spec) {
    var cvs = spec.el.querySelectorAll('canvas.okx-canvas');
    Array.prototype.forEach.call(cvs, function (cv) {
      var img = cv._okSnap;
      if (!img) { img = cv._okSnap = document.createElement('img'); img.alt = ''; img.setAttribute('aria-hidden', 'true'); }
      img.className = cv.className + ' okx-snap';
      img.style.cssText = cv.style.cssText; img.style.visibility = 'visible';
      try { img.src = cv.toDataURL('image/png'); } catch (e) { return; }
      if (img.parentNode !== cv.parentNode) cv.parentNode.insertBefore(img, cv.nextSibling);
      cv.style.visibility = 'hidden';
    });
  }
  function unsnap(spec) {
    Array.prototype.forEach.call(spec.el.querySelectorAll('canvas.okx-canvas'), function (cv) {
      if (cv._okSnap && cv._okSnap.parentNode) cv._okSnap.parentNode.removeChild(cv._okSnap);
      cv.style.visibility = '';
    });
  }
  function still(spec) {
    spec.still();
    if (isPrint()) snapshot(spec); else unsnap(spec);
  }

  /* The loop controller. spec: { el, frame(t, dt), still(), resize() }  */
  var all = [];
  function runner(spec) {
    var R = { raf: 0, last: 0, t: spec.t0 || 0, visible: true, dead: false, spec: spec };
    function active() { return !R.dead && R.visible && !document.hidden && !reduced() && !isPrint(); }
    function tick(now) {
      R.raf = 0;
      if (!active()) return;
      var dt = R.last ? Math.min(0.05, (now - R.last) / 1000) : 0;
      R.last = now; R.t += dt;
      spec.frame(R.t, dt);
      R.raf = requestAnimationFrame(tick);
    }
    R.sync = function () {
      if (R.dead) return;
      if (active()) { if (!R.raf) { R.last = 0; R.raf = requestAnimationFrame(tick); } }
      else {
        if (R.raf) { cancelAnimationFrame(R.raf); R.raf = 0; }
        if (reduced() || isPrint()) { spec.resize && spec.resize(); still(spec); }
      }
    };
    R.refit = function () { if (R.dead) return; spec.resize && spec.resize(); if (!active()) { if (reduced() || isPrint()) still(spec); else { unsnap(spec); spec.frame(R.t, 0); } } else unsnap(spec); };
    if ('IntersectionObserver' in window) {
      R.io = new IntersectionObserver(function (es) { R.visible = es[es.length - 1].isIntersecting; R.sync(); }, { rootMargin: '120px' });
      R.io.observe(spec.el);
    }
    if ('ResizeObserver' in window) { R.ro = new ResizeObserver(function () { R.refit(); }); R.ro.observe(spec.el); }
    R.stop = function () { unsnap(spec); R.dead = true; if (R.raf) cancelAnimationFrame(R.raf); R.io && R.io.disconnect(); R.ro && R.ro.disconnect(); var i = all.indexOf(R); if (i >= 0) all.splice(i, 1); };
    all.push(R);
    spec.resize && spec.resize();
    if (reduced() || isPrint()) still(spec); else spec.frame(R.t, 0);
    R.sync();
    return R;
  }
  function syncAll() { all.slice().forEach(function (R) { R.sync(); }); }
  function refitAll() { all.slice().forEach(function (R) { R.refit(); }); }
  function onMq(mq, fn) { if (!mq) return; if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }
  onMq(mqReduce, function () { refitAll(); syncAll(); });
  onMq(mqPrint, function () { refitAll(); syncAll(); });
  window.addEventListener('beforeprint', function () { printing = true; refitAll(); syncAll(); });
  window.addEventListener('afterprint', function () { printing = false; refitAll(); syncAll(); });
  document.addEventListener('visibilitychange', syncAll);
  document.addEventListener('deck:layout', function () { refitAll(); });
  document.addEventListener('deck:overview', function () { setTimeout(refitAll, 60); });

  /* Small caption pill with the component name (opts.label: string | false) */
  function label(el, text) {
    if (text === false || text == null) return null;
    var s = document.createElement('span');
    s.className = 'okx-label';
    s.textContent = text;
    el.appendChild(s);
    return s;
  }

  /* Deterministic hash noise + smooth value noise (no Math.random: static frames are identical every load) */
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
  function vnoise(x, seed) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i + seed * 57.3) * (1 - u) + hash(i + 1 + seed * 57.3) * u) * 2 - 1; }

  OK._core = { reduced: reduced, isPrint: isPrint, color: color, rgba: rgba, mix: mix, measure: measure, fitCanvas: fitCanvas, runner: runner, label: label, hash: hash, vnoise: vnoise, refitAll: refitAll };
})();
