/* =====================================================================
   OriginKit.RoundCarousel: a 3D cylinder of two-sided phone cards
   (after originkit.dev/components/roundcarousel), staged for a projector:

   - true CSS 3D ring (perspective, tilt, mirrored + dimmed inner faces)
   - step-and-settle spin: the ring swings one card with a wind-up and a
     soft overshoot, the card that lands in front pops forward with a gold
     rim, a sheen crosses its screen and its name shows in the caption
   - depth: faces turning away dim toward the ground, the inner faces seen
     across the ring are softly blurred (depth of field)
   - a glossy floor: the whole ring mirrored below a glowing orbit line
     with a light that runs round it, fading into the ground
   - the camera breathes (tilt + sway); pointer over the tile steers it;
     drag to spin with momentum, it snaps to the nearest card on release
   DOM + CSS 3D (no canvas), so the screens stay sharp at 4K and in print.

   OriginKit.RoundCarousel.mount(el, {
     items:  [{ src, alt, label }]   (required) phone-shaped images (9:16)
     aspect: 9/16      card width / height
     cardH:  .52       card height as a share of the tile height
     floor:  .735      where the front card's foot (and the floor ellipse's front edge) sits, share of tile height
     spacing: .16      gap between cards, share of card width
     every:  1.7       seconds per step (swing + hold)      move: .9 (swing seconds)
     direction: 'right' | 'left'     tilt: -27 (degrees)    perspective: 3   (x card width)
     innerDim: .34     brightness of the inner faces        radius: 12 (card corner, stage px)
     drag:   true      sensitivity: 1      reflection: true      caption: true
     label:  'Round Carousel' | false
     supersample: 2    cards are laid out at N x size and scaled back by 1/N, so Chrome rasterises
                       the 3D-transformed faces at N x resolution (sharp at 4K instead of upscaled)
   })
   Print / reduced motion: one settled frame (first card in front), projected by hand into 2D.
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit = window.OriginKit || {};
  var C; // core.js may load after this file (the generator loads js/originkit/*.js alphabetically): resolved at mount

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function easeSwing(x) { // ease-in-out-back: a small wind-up, then a small overshoot
    if (x <= 0) return 0; if (x >= 1) return 1;
    var c2 = 0.9 * 1.525;
    return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  }

  function mount(el, o) {
    C = OK._core; if (!C) throw new Error('OriginKit: load js/originkit/core.js first');
    o = o || {};
    var items = o.items || [];
    if (!items.length) throw new Error('RoundCarousel: items[] required');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.classList.add('okx-host', 'okx-carousel');

    var n = items.length, step = 360 / n, dir = o.direction === 'left' ? 1 : -1;
    var aspect = o.aspect || 9 / 16, cardHK = o.cardH || 0.52, floorK = o.floor || 0.7, spacing = o.spacing == null ? 0.16 : o.spacing;
    var tilt0 = o.tilt == null ? -27 : o.tilt, persp = o.perspective || 3, sens = o.sensitivity == null ? 1 : o.sensitivity;
    var EVERY = o.every || 1.7, MOVE = Math.min(o.move || 0.9, EVERY * 0.8);
    var ss = o.supersample == null ? 2 : Math.max(1, o.supersample), inv = ' scale(' + (1 / ss) + ')';
    el.style.setProperty('--okc-dim', o.innerDim == null ? 0.34 : o.innerDim);
    el.style.setProperty('--okc-ss', ss);
    el.style.setProperty('--okc-r', ((o.radius == null ? 12 : o.radius) * ss) + 'px');

    function cardHTML(it, mirror) {
      var alt = mirror ? '' : esc(it.alt || it.label || '');
      return '<div class="okc-face okc-front"' + (mirror ? ' aria-hidden="true"' : '') + '><img src="' + esc(it.src) + '" alt="' + alt + '" draggable="false" decoding="async"><i class="okc-gloss"></i><i class="okc-sheen"></i><i class="okc-island"></i></div>' +
        '<div class="okc-face okc-back" aria-hidden="true"><img src="' + esc(it.src) + '" alt="" draggable="false" decoding="async"></div>';
    }
    function ringOf(cls, mirror) {
      var stage = document.createElement('div'); stage.className = 'okc-stage ' + cls;
      if (mirror) stage.setAttribute('aria-hidden', 'true');
      var ring = document.createElement('div'); ring.className = 'okc-ring';
      stage.appendChild(ring);
      var cards = items.map(function (it) { var c = document.createElement('div'); c.className = 'okc-card'; c.innerHTML = cardHTML(it, mirror); ring.appendChild(c); return c; });
      return { stage: stage, ring: ring, cards: cards };
    }
    var glow = document.createElement('div'); glow.className = 'okc-glow'; glow.setAttribute('aria-hidden', 'true');
    glow.innerHTML = '<i class="okc-halo"></i><i class="okc-pool"></i><i class="okc-orbit"></i>';
    var refl = o.reflection === false ? null : ringOf('okc-refl', true);
    var fog = document.createElement('div'); fog.className = 'okc-fog'; fog.setAttribute('aria-hidden', 'true');
    var main = ringOf('okc-main', false);
    var cap = null;
    if (o.caption !== false) { cap = document.createElement('div'); cap.className = 'okc-cap'; cap.setAttribute('aria-hidden', 'true'); }
    var first = el.firstChild;
    [glow, refl && refl.stage, fog, main.stage, cap].forEach(function (node) { if (node) el.insertBefore(node, first); });
    var lab = C.label(el, o.label === undefined ? 'Round Carousel' : o.label);
    var rings = refl ? [main, refl] : [main];
    main.cards.forEach(function (c) { var im = c.querySelector('img'); if (im && im.decode) im.decode().catch(function () {}); });

    var W = 0, H = 0, cw = 0, chh = 0, rad = 0, cy = 0;
    // angle state: auto swings `from` -> `to`; drag / coast / snap / hold take over while the pointer plays
    var angle = 0, from = 0, to = 0, cycleT0 = 0, tNow = 0, mode = 'auto', vel = 0, dragging = false, lastX = 0, lastT = 0, resumeAt = 0;
    var ptr = { on: false, x: 0, y: 0 }, cam = { yaw: 0, pitch: 0 }, frontIdx = -1;
    var POP_S = 0.07, DRAG_SETTLE = 0.03 / POP_S, BACK_DROP = 0.32; // live pop: front card scale 1.07 at rest, 1.03 max while the hand spins the ring

    function resize() {
      var m = C.measure(el); W = m.w; H = m.h;
      chh = Math.min(H * cardHK, (W * 0.3) / aspect);
      // the name badge (top 20 px + ~34 px tall) must clear the popped front card: shrink the ring until it does
      var capBottom = cap ? 20 + 34 + 12 : 12;
      for (var it = 0; it < 6; it++) {
        cw = chh * aspect; rad = (cw * (1 + spacing)) / (2 * Math.tan(Math.PI / n));
        // drop the ring so the front card's foot lands on the floor line at floorK x the tile height
        cy = 0; cy = H * floorK - project(0, chh / 2, rad, tilt0).y;
        var ft = project(0, -chh / 2 * 1.07, rad + cw * 0.18, tilt0).y; // popped front card's top edge
        if (ft >= capBottom) break;
        chh *= Math.max(0.8, 1 - (capBottom - ft) / (H * floorK - ft + 1));
      }
      rings.forEach(function (r) {
        r.stage.style.perspective = (cw * persp).toFixed(0) + 'px';
        r.stage.style.perspectiveOrigin = '50% ' + (cy - chh * 0.2).toFixed(1) + 'px';
        r.ring.style.top = cy.toFixed(1) + 'px';
        r.cards.forEach(function (c) {
          c.style.width = (cw * ss).toFixed(2) + 'px'; c.style.height = (chh * ss).toFixed(2) + 'px';
          c.style.marginLeft = (-cw * ss / 2).toFixed(2) + 'px'; c.style.marginTop = (-chh * ss / 2).toFixed(2) + 'px';
        });
      });
      el.style.setProperty('--okc-cy', cy.toFixed(1) + 'px');
      floorVars(tilt0);
    }
    // where a ring-space point (x, y down, z toward the viewer; ring centre = 0) lands on the tile, with the
    // same transforms as place(): translateY(rad sin tilt) translateZ(-rad) rotateX(tilt), perspective cw*persp
    function project(x, y, z, tilt) {
      var tr = tilt * Math.PI / 180, P = cw * persp, oy = cy - chh * 0.2;
      var y1 = y * Math.cos(tr) - z * Math.sin(tr) + rad * Math.sin(tr), z1 = y * Math.sin(tr) + z * Math.cos(tr) - rad;
      var k = P / (P - z1);
      return { x: W / 2 + x * k, y: oy + (cy + y1 - oy) * k };
    }
    // the floor: the ellipse the card feet run on (front / back / sides projected), mirrored ring hinged at the front foot
    var lastFloor = '';
    var PS = 1, LIFT = 0; // print only: the flat ring is drawn PS x smaller and LIFT px higher (see placeFlat)
    function floorVars(tilt) {
      var f = project(0, chh / 2, rad, tilt), b = project(0, chh / 2, -rad, tilt), sd = project(rad, chh / 2, 0, tilt);
      if (PS !== 1 || LIFT) { [f, b, sd].forEach(function (p) { p.x = W / 2 + (p.x - W / 2) * PS; p.y = cy + (p.y - cy) * PS - LIFT; }); }
      var key = f.y.toFixed(1) + b.y.toFixed(1) + sd.x.toFixed(1);
      if (key === lastFloor) return; lastFloor = key;
      el.style.setProperty('--okc-floor', f.y.toFixed(1) + 'px');
      el.style.setProperty('--okc-oy', ((f.y + b.y) / 2).toFixed(1) + 'px');
      el.style.setProperty('--okc-ow', (2 * (sd.x - W / 2)).toFixed(1) + 'px');
      el.style.setProperty('--okc-oh', Math.max(4, f.y - b.y).toFixed(1) + 'px');
      el.style.setProperty('--okc-rw', (rad * 2.3).toFixed(1) + 'px');
      if (refl) refl.stage.style.transformOrigin = '50% ' + f.y.toFixed(1) + 'px';
    }

    function faceVals(i) { // card i's angle from the viewer: f = cos (1 front, -1 back), sn = sin
      var a = ((i * step + angle) % 360 + 360) % 360, r = a * Math.PI / 180;
      return { f: Math.cos(r), sn: Math.sin(r) };
    }
    function setFront(i) {
      if (i === frontIdx) return; frontIdx = i;
      rings.forEach(function (r) { r.cards.forEach(function (c, j) { c.classList.toggle('is-front', j === i); }); });
    }
    // name badge: one opaque pill, its text flipped over (never two ghosted pills) when a card has landed in front
    var capIdx = -1, capSpan = null;
    function setCaption(i) {
      if (!cap || i === capIdx) return; capIdx = i;
      if (!capSpan) { capSpan = document.createElement('span'); capSpan.innerHTML = '<b></b><b class="okc-was" aria-hidden="true"></b>'; cap.appendChild(capSpan); }
      var nowB = capSpan.firstChild, wasB = capSpan.lastChild;
      // the pill's width glides between the two measured label widths (~280 ms), so it never snaps while the old name fades
      var tf = W ? el.getBoundingClientRect().width / W : 1, w0 = capSpan.getBoundingClientRect().width / (tf || 1);
      wasB.textContent = nowB.textContent; nowB.textContent = items[i].label || '';
      // the pill itself never fades (auto, drag or coast): only its text cross-fades, the old name out as the new one comes in
      capSpan.classList.remove('flip', 'quick');
      capSpan.style.transition = 'none'; capSpan.style.width = '';
      if (C.isPrint() || C.reduced() || !wasB.textContent) { wasB.textContent = ''; return; }
      var w1 = capSpan.getBoundingClientRect().width / (tf || 1), quick = dragging || mode === 'coast';
      if (w0 > 0 && w1 > 0 && Math.abs(w1 - w0) > 0.5) {
        capSpan.style.width = w0.toFixed(2) + 'px'; void capSpan.offsetWidth;
        capSpan.style.transition = 'width ' + (quick ? '.18s' : '.28s') + ' cubic-bezier(.4, 0, .2, 1)';
        capSpan.style.width = w1.toFixed(2) + 'px';
      }
      void capSpan.offsetWidth; capSpan.classList.add('flip'); if (quick) capSpan.classList.add('quick');
    }

    // Safari / WebKit reduced-motion still: the per-card projection print uses (no shared preserve-3d scene to depend on)
    var UA = navigator.userAgent || '', WK = /AppleWebKit/.test(UA) && !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(UA), stillFlat = false;
    function place(settle) {
      var flat = C.isPrint() || stillFlat;
      el.classList.toggle('okc-print', flat);
      var tilt = tilt0 + cam.pitch, pop = [], fi = 0, best = -2;
      for (var i = 0; i < n; i++) {
        var v = faceVals(i), p = Math.max(0, (v.f - 0.93) / 0.07); // pop: 0..1 as the card reaches the front
        p = p * p * (3 - 2 * p) * settle;
        pop.push(p);
        if (v.f > best) { best = v.f; fi = i; }
        for (var q = 0; q < rings.length; q++) { var c = rings[q].cards[i]; c.style.setProperty('--okc-f', v.f.toFixed(3)); c.style.setProperty('--okc-s', v.sn.toFixed(3)); c.style.setProperty('--okc-p', p.toFixed(3)); }
      }
      setFront(fi);
      setCaption(fi); // the badge swaps the moment a card crosses the front angle (mid-swing), so it lands with its card
      if (flat) { fitFlat(pop, tilt, fi); floorVars(tilt0); return; }
      PS = 1; LIFT = 0; floorVars(tilt);
      // the back arc sits lower than a true circle would put it, so the name badge above the ring has clean space
      var drop = [];
      for (var d = 0; d < n; d++) { var fv = faceVals(d).f; drop.push(fv < 0 ? chh * BACK_DROP * Math.min(1, -fv) : 0); }
      rings.forEach(function (r) {
        for (var j = 0; j < n; j++) {
          r.cards[j].style.transform = 'translateY(' + drop[j].toFixed(2) + 'px) rotateY(' + (j * step).toFixed(3) + 'deg) translateZ(' + (rad + pop[j] * cw * 0.18).toFixed(2) + 'px) scale(' + (1 + pop[j] * POP_S).toFixed(4) + ')' + inv;
          r.cards[j].style.zIndex = ''; r.cards[j].style.visibility = ''; r.cards[j].style.opacity = ''; r.cards[j].classList.remove('okc-flat-back');
        }
        r.ring.style.transform = 'translateY(' + (rad * Math.sin(tilt * Math.PI / 180)).toFixed(2) + 'px) translateZ(' + (-rad).toFixed(2) + 'px) rotateX(' + tilt.toFixed(3) + 'deg) rotateY(' + (angle + cam.yaw).toFixed(3) + 'deg)';
      });
    }
    // print: Chrome's PDF output keeps a single element's own perspective() transform but not a shared
    // preserve-3d scene (no depth sort, no backface culling), so each card is projected on its own:
    // placed and scaled where the ring puts it, then turned in its own perspective (a true trapezoid),
    // stacked by depth; cards on the far side show their mirrored, dimmed inner face
    // print: the front card + its two neighbours, fitted by measurement: the front card fills the band between the name
    // badge and the tile's name pill (12 px clear of the pill, rim included), the neighbours fan out to ~92 % of the tile width
    var SPREAD = 1.4;
    function stageRect(node) { var er = el.getBoundingClientRect(), r = node.getBoundingClientRect(), tf = W ? er.width / W : 1; return { l: (r.left - er.left) / tf, t: (r.top - er.top) / tf, r: (r.right - er.left) / tf, b: (r.bottom - er.top) / tf, h: r.height / tf }; }
    function fitFlat(pop, tilt, fi) {
      PS = 0.92; LIFT = 0; SPREAD = 1.4; placeFlat(pop, tilt);
      var pillTop = H - 58, slot = el.closest && el.closest('.ok-card-slot'), bar = slot && slot.querySelector('.ok-bar, .ok-l');
      if (bar) { var br = stageRect(bar); if (br.h) pillTop = br.t; }
      var capB = 12; if (cap && capSpan) { var crr = stageRect(capSpan); if (crr.h) capB = crr.b; }
      var RIM = 5, top = capB + 10 + RIM, bot = pillTop - 12 - RIM, front = main.cards[fi];
      var fr = stageRect(front); if (!fr.h) return;
      PS *= Math.max(0.8, Math.min(1.4, (bot - top) / fr.h)); placeFlat(pop, tilt);
      fr = stageRect(front); LIFT += (fr.t + fr.b) / 2 - (top + bot) / 2; placeFlat(pop, tilt);
      // neighbours: widen the spread until the fan's outer edges sit ~4 % in from the tile's sides
      var ext = function () { var lo = 1e9, hi = -1e9; main.cards.forEach(function (c) { if (c.style.visibility === 'hidden') return; var q = stageRect(c); lo = Math.min(lo, q.l); hi = Math.max(hi, q.r); }); return [lo, hi]; };
      var e = ext(), half = (e[1] - e[0]) / 2, fh = (fr.r - fr.l) / 2, want = W * 0.46;
      if (half > fh + 1) { SPREAD *= Math.max(1, Math.min(1.8, (want - fh * 0.55) / Math.max(1, half - fh * 0.55))); placeFlat(pop, tilt); }
      e = ext(); if (e[0] < W * 0.03 || e[1] > W * 0.97) { SPREAD *= 0.94; placeFlat(pop, tilt); }
    }
    function placeFlat(pop, tilt) {
      var P = cw * persp, tr = tilt * Math.PI / 180, ty = Math.sin(tr);
      rings.forEach(function (r) {
        r.ring.style.transform = 'none';
        for (var i = 0; i < n; i++) {
          // spread the ring wider than live (x SPREAD) and turn the faces less, so every card reads as its own panel with a gap
          var a = (i * step + angle), ar = a * Math.PI / 180, x = rad * Math.sin(ar) * SPREAD, z = rad * Math.cos(ar) + pop[i] * cw * 0.18;
          var c = r.cards[i], k = P / (P + rad - z), sc = (1 + pop[i] * POP_S) * (pop[i] > 0.5 ? 1 : 1.1); // neighbours a touch larger: the fan reads across the tile
          var ca = Math.cos(ar), back = ca < 0;
          c.classList.toggle('okc-flat-back', back);
          if (back || ca < 0.75) { c.style.visibility = 'hidden'; continue; } // front + the two neighbours only
          c.style.visibility = '';
          c.style.opacity = ca > 0.97 ? '0.999' : '0.9'; // (< 1 on every card: Chrome's PDF otherwise rasterises the front card coarsely)
          c.style.zIndex = String(Math.round(1000 + z));
          var turn = ((back ? a - 180 : a) % 360 + 540) % 360 - 180;
          turn = (turn < 0 ? -1 : 1) * Math.min(Math.abs(turn) * 0.85, 46);
          c.style.transform = 'translate(' + (x * k * PS).toFixed(2) + 'px,' + ((rad - z) * ty * k * PS - LIFT).toFixed(2) + 'px) scale(' + (k * sc * PS).toFixed(4) + ') perspective(' + P.toFixed(0) + 'px) rotateX(' + (tilt * 0.6).toFixed(2) + 'deg) rotateY(' + turn.toFixed(2) + 'deg)' + inv;
        }
      });
    }

    function nearestStop(a, d) { var q = a / step; return (d > 0 ? Math.ceil(q - 0.2) : d < 0 ? Math.floor(q + 0.2) : Math.round(q)) * step; }

    function frame(t, dt) {
      tNow = t;
      // camera: slow breathing, or steered by the pointer
      var ty = ptr.on ? (ptr.x / (W || 1) - 0.5) * 16 : Math.sin(t * 0.7) * 3.5;
      var tp = ptr.on ? (0.5 - ptr.y / (H || 1)) * 12 : Math.sin(t * 0.9 + 1) * 2.6;
      var kk = 1 - Math.pow(0.03, dt || 0);
      cam.yaw += (ty - cam.yaw) * kk; cam.pitch += (tp - cam.pitch) * kk;

      var settle = 1;
      if (dragging) settle = DRAG_SETTLE; // mid-drag the front card pops only a little (scale clamped to ~1.03), so it never crowds its neighbours
      else if (mode === 'coast') {
        angle += vel * dt; vel *= Math.pow(0.04, dt); settle = DRAG_SETTLE;
        if (Math.abs(vel) < 45) { mode = 'snap'; from = angle; to = nearestStop(angle, vel); cycleT0 = t; }
      } else if (mode === 'snap') {
        var q = Math.min(1, (t - cycleT0) / 0.6); angle = from + (to - from) * easeSwing(q);
        settle = Math.max(0, (q - 0.5) * 2);
        if (q >= 1) { mode = 'hold'; resumeAt = ptr.on ? Infinity : t + 1.2; }
      } else if (mode === 'hold') {
        if (t >= resumeAt) { mode = 'auto'; from = angle; to = angle + dir * step; cycleT0 = t; }
      } else { // auto: swing one card, hold, repeat
        var u = t - cycleT0;
        if (u >= EVERY) {
          if (ptr.on) { mode = 'hold'; resumeAt = Infinity; }
          else { from = to; to = from + dir * step; cycleT0 += EVERY; if (t - cycleT0 > EVERY) cycleT0 = t; u = t - cycleT0; }
        }
        angle = from + (to - from) * easeSwing(Math.min(1, u / MOVE));
        settle = u < MOVE ? Math.max(0, Math.min(1, (u - MOVE * 0.6) / (MOVE * 0.4))) : 1;
      }
      glow.style.setProperty('--okc-run', ((t * 70) % 360).toFixed(1) + 'deg');
      place(settle);
    }
    function still() { cam.yaw = 0; cam.pitch = 0; angle = 0; frontIdx = -1; capIdx = -1; stillFlat = WK && !C.isPrint(); place(1); stillFlat = false; }

    function down(e) {
      if (o.drag === false || C.reduced()) return;
      dragging = true; mode = 'drag'; lastX = e.clientX; lastT = performance.now(); vel = 0;
      el.setPointerCapture && el.setPointerCapture(e.pointerId); el.classList.add('is-dragging');
    }
    function move(e) {
      var r = el.getBoundingClientRect(), tf = W ? r.width / W : 1;
      ptr.x = (e.clientX - r.left) / tf; ptr.y = (e.clientY - r.top) / tf; ptr.on = true;
      if (!dragging) return;
      var dx = (e.clientX - lastX) / tf, now = performance.now(), dts = Math.max(0.001, (now - lastT) / 1000);
      var dA = dx / (2 * Math.PI * rad) * 360 * 1.3 * sens;
      angle += dA; vel = vel * 0.6 + (dA / dts) * 0.4; lastX = e.clientX; lastT = now;
    }
    function up() { if (!dragging) return; dragging = false; el.classList.remove('is-dragging'); vel = Math.max(-900, Math.min(900, vel)); mode = 'coast'; }
    function leave() { ptr.on = false; if (mode === 'hold' && resumeAt === Infinity) resumeAt = tNow + 0.5; }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', leave);
    // each time the slide comes in, start again from the first card with a fresh swing
    function restart() { mode = 'auto'; from = -dir * step; to = 0; angle = from; cycleT0 = tNow; }
    var sl = el.closest && el.closest('[data-slide]');
    if (sl) sl.addEventListener('slide:enter', restart);
    restart();

    var R = C.runner({ el: el, frame: frame, still: still, resize: resize });
    return {
      render: function () { R.refit(); },
      destroy: function () {
        R.stop();
        [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['pointerleave', leave]].forEach(function (p) { el.removeEventListener(p[0], p[1]); });
        [glow, refl && refl.stage, fog, main.stage, cap, lab].forEach(function (x) { if (x) x.remove(); });
        el.classList.remove('okx-host', 'okx-carousel', 'okc-print', 'is-dragging');
      }
    };
  }

  OK.RoundCarousel = { mount: mount };
})();
