/* =====================================================================
   OriginKit.ButterflyDrift: a swarm of butterflies that flap, wander and
   scatter from the pointer (after originkit.dev/components/butterfly-drift).
   Canvas 2D. Each wing is a pre-painted sprite (gradient, border, veins,
   spots) drawn with a horizontal fold, so wings narrow toward the body as
   they lift: the top-down flap. Thrust pulses on the downbeat, a sideways
   sway runs a quarter phase out of step, one depth value per insect drives
   size, speed, alpha and softness. Near insects fly on a FRONT canvas
   above the tile's content, far ones on a BACK canvas beneath it.

   OriginKit.ButterflyDrift.mount(el, {
     count:    auto (area based, 24..140)     density
     size:     auto (4% of tile height)       wing length of a mid-depth insect, stage px
     speed:    1        flap: 1       wander: 1      depth: 1
     hover:    1        reach: 1      (pointer shove strength / radius)
     vignette: .55      front: .8     (depth above which insects fly over content; 1 = none)
     schemes:  [[base, accent, share], ...]  colours as theme tokens or CSS colours
     label:    'Butterfly Drift' | false
   })
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit = window.OriginKit || {};
  var C; // core.js may load after this file (the generator loads js/originkit/*.js alphabetically): resolved at mount
  var TAU = Math.PI * 2, U = 200, PADX = 10, HY = 1.08 * U; // sprite units, hinge at (PADX, HY)

  function wingSprite(base, accent, ink) {
    var cv = document.createElement('canvas');
    cv.width = PADX + Math.ceil(1.08 * U) + 6; cv.height = Math.ceil(HY + 0.86 * U);
    var g = cv.getContext('2d');
    g.translate(PADX, HY); g.scale(U, U);
    function fore() { g.beginPath(); g.moveTo(0.02, -0.1); g.bezierCurveTo(0.22, -0.72, 0.7, -1.04, 0.97, -0.9); g.bezierCurveTo(1.07, -0.62, 0.9, -0.22, 0.58, -0.04); g.bezierCurveTo(0.38, 0.04, 0.14, 0.03, 0.02, 0.0); g.closePath(); }
    function hind() { g.beginPath(); g.moveTo(0.02, 0.03); g.bezierCurveTo(0.3, -0.02, 0.72, 0.06, 0.76, 0.3); g.bezierCurveTo(0.8, 0.55, 0.55, 0.8, 0.32, 0.76); g.bezierCurveTo(0.14, 0.72, 0.04, 0.46, 0.02, 0.2); g.closePath(); }
    function paint(shape, veins, spots) {
      g.save(); shape(); g.clip();
      var rg = g.createRadialGradient(0, 0, 0, 0, 0, 1.05);
      rg.addColorStop(0, C.rgba(C.mix(base, [255, 255, 255], 0.28)));
      rg.addColorStop(0.28, C.rgba(base));
      rg.addColorStop(0.72, C.rgba(accent));
      rg.addColorStop(1, C.rgba(C.mix(accent, ink, 0.35)));
      g.fillStyle = rg; g.fillRect(-0.2, -1.2, 1.5, 2.2);
      // veins fan out from the hinge
      g.strokeStyle = C.rgba(ink, 0.34); g.lineWidth = 0.014; g.lineCap = 'round';
      veins.forEach(function (p) { g.beginPath(); g.moveTo(0.03, 0); g.quadraticCurveTo(p[0] * 0.55, p[1] * 0.45, p[0], p[1]); g.stroke(); });
      // dark border band inside the edge
      shape(); g.lineWidth = 0.13; g.strokeStyle = C.rgba(C.mix(accent, ink, 0.55), 0.55); g.stroke();
      g.restore();
      shape(); g.lineWidth = 0.028; g.strokeStyle = C.rgba(C.mix(accent, ink, 0.72), 0.95); g.stroke();
      spots.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fillStyle = 'rgba(255,255,255,.88)'; g.fill(); });
    }
    paint(fore, [[0.95, -0.86], [0.99, -0.6], [0.85, -0.32], [0.6, -0.08], [0.5, -0.8]], [[0.86, -0.8, 0.032], [0.93, -0.66, 0.026], [0.9, -0.5, 0.02], [0.74, -0.86, 0.022]]);
    paint(hind, [[0.74, 0.3], [0.6, 0.62], [0.32, 0.75], [0.12, 0.6]], [[0.62, 0.58, 0.024], [0.46, 0.7, 0.02]]);
    return cv;
  }
  function bodySprite(ink, hi) {
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(0.9 * U); cv.height = Math.ceil(1.9 * U);
    var g = cv.getContext('2d');
    g.translate(cv.width / 2, HY * 0.95); g.scale(U, U); // body origin at (w/2, 0.95*HY)
    g.strokeStyle = C.rgba(ink, 0.95); g.lineWidth = 0.018; g.lineCap = 'round';
    [-1, 1].forEach(function (s) { g.beginPath(); g.moveTo(0.012 * s, -0.3); g.quadraticCurveTo(0.08 * s, -0.62, 0.22 * s, -0.8); g.stroke(); g.beginPath(); g.arc(0.22 * s, -0.8, 0.028, 0, TAU); g.fillStyle = C.rgba(ink); g.fill(); });
    g.beginPath(); g.ellipse(0, 0.14, 0.045, 0.46, 0, 0, TAU); g.fillStyle = C.rgba(ink); g.fill();
    g.beginPath(); g.arc(0, -0.3, 0.06, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(-0.012, -0.05, 0.014, 0.2, 0, 0, TAU); g.fillStyle = C.rgba(hi, 0.35); g.fill();
    return cv;
  }

  function mount(el, o) {
    C = OK._core; if (!C) throw new Error('OriginKit: load js/originkit/core.js first');
    o = o || {};
    var cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    el.classList.add('okx-host', 'okx-butterfly');
    var back = document.createElement('canvas'), front = document.createElement('canvas');
    back.className = 'okx-canvas okx-back'; front.className = 'okx-canvas okx-front';
    back.setAttribute('aria-hidden', 'true'); front.setAttribute('aria-hidden', 'true');
    el.insertBefore(back, el.firstChild); el.appendChild(front);
    var lab = C.label(el, o.label === undefined ? 'Butterfly Drift' : o.label);
    var bx = back.getContext('2d'), fx = front.getContext('2d');

    var ink = C.color(el, '--c-ink', '#222222');
    var schemesSpec = o.schemes || [
      ['--tone-mint', '--tone-bright', 0.44],   // mint hinge -> sky tips (the original's cyan -> blue)
      ['--tone-sky', '--tone-teal', 0.26],      // light blue -> teal
      ['--c-emph-inv', '--c-accent', 0.3]       // gold -> orange-red: the brand's hot accent
    ];
    // --c-accent is orange-red on light grounds; resolve it outside any dark scope
    var schemes = schemesSpec.map(function (s) {
      var a = C.color(el, s[0]), b = s[1] === '--c-accent' ? C.color(document.documentElement, s[1], '#888888') : C.color(el, s[1]);
      return { sprite: wingSprite(a, b, ink), share: s[2] || 1 };
    });
    var body = bodySprite(ink, C.color(el, '--tone-sky', '#DDDDDD'));
    var shareSum = schemes.reduce(function (a, s) { return a + s.share; }, 0);

    var speed = o.speed == null ? 1 : o.speed, flapK = o.flap == null ? 1 : o.flap, wander = o.wander == null ? 1 : o.wander;
    var depthK = o.depth == null ? 1 : o.depth, hover = o.hover == null ? 1 : o.hover, reachK = o.reach == null ? 1 : o.reach;
    var vig = o.vignette == null ? 0.55 : o.vignette, frontZ = o.front == null ? 0.86 : o.front;
    var W = 0, H = 0, sb = 1, sf = 1, L0 = 20, flies = [], ptr = { x: -1e4, y: -1e4, on: false };

    function build() {
      var n = o.count || Math.max(24, Math.min(140, Math.round(W * H / 7200)));
      L0 = o.size || Math.max(9, Math.min(34, H * 0.04));
      var old = flies; flies = [];
      for (var i = 0; i < n; i++) {
        // low-discrepancy placement + depth from badly-approximable constants: any count fills every column, near to far
        var z = (i * 0.5698402909980532 + 0.27) % 1;
        var pick = ((i * 0.6180339887 + 0.11) % 1) * shareSum, sc = 0;
        while (pick > schemes[sc].share && sc < schemes.length - 1) { pick -= schemes[sc].share; sc++; }
        var dz = 0.5 + (z - 0.5) * depthK;
        var f = old[i] || {};
        flies.push({
          x: f.x != null && W ? f.x : ((i * 0.6180339887 + 0.13) % 1) * W,
          y: f.y != null && H ? f.y : ((i * 0.7548776662 + 0.41) % 1) * H,
          z: z, dz: dz, s: schemes[sc].sprite,
          L: L0 * (0.4 + 1.0 * dz), alpha: 0.38 + 0.62 * dz,
          h: f.h != null ? f.h : C.hash(i + 1.7) * TAU, seed: i * 1.37 + 0.5,
          ph: C.hash(i + 9.1) * TAU, hz: (2.6 + 1.6 * dz) * flapK * (0.85 + 0.3 * C.hash(i + 3.3)),
          cruise: L0 * (1.1 + 1.5 * dz) * speed, panic: 0, vx: 0, vy: 0
        });
      }
      flies.sort(function (a, b) { return a.z - b.z; });
    }

    function resize() {
      var m = C.measure(el);
      var nw = m.w, nh = m.h;
      sb = C.fitCanvas(back, nw, nh, m.phys, 12e6);
      sf = C.fitCanvas(front, nw, nh, m.phys, 12e6);
      if (nw !== W || nh !== H || !flies.length) {
        if (W && H) flies.forEach(function (f) { f.x *= nw / W; f.y *= nh / H; });
        W = nw; H = nh; build();
      }
    }

    function drawFly(g, s, f, fold) {
      var ch = Math.cos(f.h), sh = Math.sin(f.h), k = f.L / U * s;
      g.globalAlpha = f.alpha;
      var ox = f.x * s, oy = f.y * s;
      // right wing, folded horizontally
      g.setTransform(ch * fold * k, sh * fold * k, -sh * k, ch * k, ox, oy);
      g.drawImage(f.s, -PADX, -HY);
      g.setTransform(-ch * fold * k, -sh * fold * k, -sh * k, ch * k, ox, oy);
      g.drawImage(f.s, -PADX, -HY);
      g.setTransform(ch * k, sh * k, -sh * k, ch * k, ox, oy);
      g.drawImage(body, -body.width / 2, -HY * 0.95);
    }

    function paint(foldOf) {
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, back.width, back.height);
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, front.width, front.height);
      bx.imageSmoothingQuality = fx.imageSmoothingQuality = 'high';
      for (var i = 0; i < flies.length; i++) {
        var f = flies[i];
        if (f.z >= frontZ) drawFly(fx, sf, f, foldOf(f)); else drawFly(bx, sb, f, foldOf(f));
      }
      bx.globalAlpha = 1; fx.globalAlpha = 1;
      if (vig > 0) {
        bx.setTransform(sb, 0, 0, sb, 0, 0);
        var r = Math.hypot(W, H) / 2, vg = bx.createRadialGradient(W / 2, H / 2, r * 0.35, W / 2, H / 2, r);
        vg.addColorStop(0, C.rgba(ink, 0)); vg.addColorStop(1, C.rgba(ink, vig));
        bx.fillStyle = vg; bx.fillRect(0, 0, W, H);
      }
    }

    function wingFold(ph) { var open = 0.5 + 0.5 * Math.cos(ph); return 0.14 + 0.86 * open; }

    function frame(t, dt) {
      var reach = Math.min(W, H) * 0.2 * reachK;
      for (var i = 0; i < flies.length; i++) {
        var f = flies[i];
        f.ph += dt * f.hz * TAU * (1 + f.panic * 1.6);
        // wander: smooth noise steers the heading, gentler for far insects
        f.h += C.vnoise(t * 0.45 + f.seed, f.seed) * 1.9 * wander * dt;
        var thrust = Math.max(0, Math.sin(f.ph)), sway = Math.cos(f.ph + Math.PI / 2) * 0.55;
        var v = f.cruise * (0.35 + 1.15 * thrust) * (1 + f.panic * 1.4);
        var dx = Math.sin(f.h), dy = -Math.cos(f.h);
        f.x += (dx * v + -dy * sway * f.cruise * 0.6) * dt + f.vx * dt;
        f.y += (dy * v + dx * sway * f.cruise * 0.6) * dt + f.vy * dt;
        // pointer: quadratic shove down the outward normal, heading turns to match, panic decays
        if (ptr.on && hover > 0) {
          var px = f.x - ptr.x, py = f.y - ptr.y, d = Math.hypot(px, py);
          if (d < reach && d > 0.001) {
            var q = 1 - d / reach, push = q * q * 900 * hover;
            f.vx += px / d * push * dt; f.vy += py / d * push * dt;
            var want = Math.atan2(px / d, -py / d), diff = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
            f.h += diff * Math.min(1, dt * 8 * q);
            f.panic = Math.min(1, f.panic + q * dt * 6);
          }
        }
        f.vx *= Math.pow(0.04, dt); f.vy *= Math.pow(0.04, dt);
        f.panic *= Math.pow(0.35, dt);
        var m = f.L * 1.4;
        if (f.x < -m) f.x += W + 2 * m; else if (f.x > W + m) f.x -= W + 2 * m;
        if (f.y < -m) f.y += H + 2 * m; else if (f.y > H + m) f.y -= H + 2 * m;
      }
      paint(function (f) { return wingFold(f.ph); });
    }

    function still() {
      // composed frame: wings mostly open (a few mid-beat), so the swarm reads as butterflies on paper
      paint(function (f) { return 0.5 + 0.5 * C.hash(f.seed * 3.1); });
    }

    function onMove(e) { var r = el.getBoundingClientRect(), tf = W ? r.width / W : 1; ptr.x = (e.clientX - r.left) / tf; ptr.y = (e.clientY - r.top) / tf; ptr.on = true; }
    function onLeave() { ptr.on = false; }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    var R = C.runner({ el: el, frame: frame, still: still, resize: resize });
    return {
      render: function () { R.refit(); },
      destroy: function () { R.stop(); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); back.remove(); front.remove(); lab && lab.remove(); el.classList.remove('okx-host', 'okx-butterfly'); }
    };
  }

  OK.ButterflyDrift = { mount: mount };
})();
