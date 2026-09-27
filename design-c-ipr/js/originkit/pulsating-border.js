/* =====================================================================
   OriginKit.PulsatingBorder: coloured light spots drift around a frame's
   edge, with a smoky shimmer and a bloom halo
   (after originkit.dev/components/pulsating-border).
   Canvas 2D: the ring is sampled along its arc length, each sample takes
   the sum of three travelling gaussian spots (tinted from up to five
   theme colours), and the crisp line is re-drawn blurred twice with
   additive blending for the bloom. The canvas is grown past the frame so
   the glow fades out instead of ending square.

   OriginKit.PulsatingBorder.mount(el, {
     target:   element to frame (default: el.querySelector('[data-ok-target]') || el.firstElementChild)
     colors:   up to 5 tokens/colours (default: gold, sky, orange-red, mint)
     thickness: 3 (stage px)   radius: 1 (0 = square corners, 1 = pill)
     intensity: 1   bloom: 1   spread: 1   softness: .5   spotSize: .6   speed: 1
     label:    'Pulsating Border' | false
   })
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit = window.OriginKit || {};
  var C; // core.js may load after this file (the generator loads js/originkit/*.js alphabetically): resolved at mount
  var hasFilter = (function () { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();

  function mount(el, o) {
    C = OK._core; if (!C) throw new Error('OriginKit: load js/originkit/core.js first');
    o = o || {};
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.classList.add('okx-host', 'okx-border');
    var target = o.target || el.querySelector('[data-ok-target]') || el.firstElementChild;
    var cv = document.createElement('canvas'); cv.className = 'okx-canvas okx-ring'; cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    var lab = C.label(el, o.label === undefined ? 'Pulsating Border' : o.label);
    var g = cv.getContext('2d'), line = document.createElement('canvas'), lg = line.getContext('2d');
    var pal = (o.colors || ['--c-emph-inv', '--tone-bright', '--c-accent', '--tone-mint']).map(function (c) {
      return c === '--c-accent' ? C.color(document.documentElement, c) : C.color(el, c);
    });
    if (!o.colors) pal[2] = C.color(document.documentElement, '--c-accent', '#888888');
    var white = [255, 255, 255, 1];
    var thick = o.thickness || 4, radK = o.radius == null ? 1 : o.radius, inten = o.intensity == null ? 1 : o.intensity;
    var bloom = o.bloom == null ? 1 : o.bloom, spread = o.spread == null ? 1 : o.spread, soft = o.softness == null ? 0.5 : o.softness;
    var spot = o.spotSize == null ? 0.6 : o.spotSize, speed = o.speed == null ? 1 : o.speed;

    var s = 1, M = 0, CW = 0, CH = 0, pts = [], per = 0;

    function resize() {
      var m = C.measure(el), er = el.getBoundingClientRect(), tr = target.getBoundingClientRect();
      var tf = m.w ? er.width / m.w : 1;
      var x = (tr.left - er.left) / tf, y = (tr.top - er.top) / tf, w = tr.width / tf, h = tr.height / tf;
      M = Math.min(Math.max(32, Math.min(w, h) * 0.5) * spread, 130);
      CW = w + 2 * M; CH = h + 2 * M;
      cv.style.left = (x - M).toFixed(2) + 'px'; cv.style.top = (y - M).toFixed(2) + 'px';
      s = C.fitCanvas(cv, CW, CH, m.phys, 6e6);
      line.width = cv.width; line.height = cv.height;
      // sample the rounded rect by arc length
      var r = Math.min(w, h) / 2 * Math.max(0, Math.min(1, radK)), x0 = M, y0 = M;
      var segs = [], sx = w - 2 * r, sy = h - 2 * r, q = Math.PI / 2 * r;
      per = 2 * sx + 2 * sy + 4 * q;
      var N = Math.max(160, Math.min(900, Math.round(per / 2.2)));
      pts = [];
      for (var i = 0; i <= N; i++) {
        var d = i / N * per, px, py;
        if ((d -= 0) < sx) { px = x0 + r + d; py = y0; }
        else if ((d -= sx) < q) { var a = -Math.PI / 2 + d / r; px = x0 + w - r + Math.cos(a) * r; py = y0 + r + Math.sin(a) * r; }
        else if ((d -= q) < sy) { px = x0 + w; py = y0 + r + d; }
        else if ((d -= sy) < q) { var a2 = d / r; px = x0 + w - r + Math.cos(a2) * r; py = y0 + h - r + Math.sin(a2) * r; }
        else if ((d -= q) < sx) { px = x0 + w - r - d; py = y0 + h; }
        else if ((d -= sx) < q) { var a3 = Math.PI / 2 + d / r; px = x0 + r + Math.cos(a3) * r; py = y0 + h - r + Math.sin(a3) * r; }
        else if ((d -= q) < sy) { px = x0; py = y0 + h - r - d; }
        else { d -= sy; var a4 = Math.PI + d / Math.max(r, 0.001); px = x0 + r + Math.cos(a4) * r; py = y0 + r + Math.sin(a4) * r; }
        pts.push([px, py, i / N]);
      }
      segs.length = 0;
    }

    function spotColor(k, t) {
      var P = pal.length, c = t * 0.07 * speed + k * 1.37, i = Math.floor(c), f = c - i, e = f * f * (3 - 2 * f);
      return C.mix(pal[((i + k) % P + P) % P], pal[((i + k + 1) % P + P) % P], e);
    }

    function draw(t) {
      if (!pts.length) return;
      var sig = 0.05 + spot * 0.13;
      var centers = [0, 1, 2].map(function (k) { var v = (k / 3 + t * speed * (k === 1 ? -0.043 : 0.061 + k * 0.012)) % 1; return v < 0 ? v + 1 : v; });
      var cols = [0, 1, 2].map(function (k) { return spotColor(k, t); });
      var breath = 0.86 + 0.14 * Math.sin(t * 1.7 * speed);
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, line.width, line.height);
      lg.setTransform(s, 0, 0, s, 0, 0); lg.lineCap = 'round'; lg.lineWidth = thick;
      lg.globalCompositeOperation = 'lighter';
      for (var i = 0; i < pts.length - 1; i++) {
        var p = pts[i], nx = pts[i + 1], u = p[2], r = 0, gg = 0, b = 0, wsum = 0;
        for (var k = 0; k < 3; k++) {
          var d = Math.abs(u - centers[k]); if (d > 0.5) d = 1 - d;
          var wk = Math.exp(-(d / sig) * (d / sig));
          r += cols[k][0] * wk; gg += cols[k][1] * wk; b += cols[k][2] * wk; wsum += wk;
        }
        // smoke: slow noise along the ring makes the light breathe
        var smoke = 0.72 + 0.28 * C.vnoise(u * 11 + t * 0.55 * speed, 3.1) + 0.12 * Math.sin(u * 40 - t * 2.1 * speed);
        var hot = Math.min(1, wsum), base = 0.1;
        var col = wsum > 0.001 ? [r / wsum, gg / wsum, b / wsum] : pal[0];
        col = C.mix(col, white, hot * hot * hot * 0.18);
        var a = Math.min(1, (hot * 0.95 + base) * smoke * inten * breath);
        lg.strokeStyle = C.rgba(col, a.toFixed(3));
        lg.beginPath(); lg.moveTo(p[0], p[1]); lg.lineTo(nx[0], nx[1]); lg.stroke();
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'lighter';
      if (hasFilter && bloom > 0) {
        g.filter = 'blur(' + (M * 0.4 * s).toFixed(1) + 'px)'; g.globalAlpha = Math.min(1, bloom); g.drawImage(line, 0, 0); g.drawImage(line, 0, 0); g.drawImage(line, 0, 0);
        g.filter = 'blur(' + (M * 0.12 * s).toFixed(1) + 'px)'; g.globalAlpha = Math.min(1, 0.85 * bloom); g.drawImage(line, 0, 0);
        g.filter = 'blur(' + (thick * soft * 0.6 * s).toFixed(2) + 'px)'; g.globalAlpha = 1; g.drawImage(line, 0, 0);
        g.filter = 'none';
      } else {
        g.globalAlpha = 1; g.drawImage(line, 0, 0);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }

    var R = C.runner({ el: el, frame: function (t) { draw(t); }, still: function () { draw(3.4); }, resize: resize });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { R.refit(); });
    return {
      render: function () { R.refit(); },
      destroy: function () { R.stop(); cv.remove(); lab && lab.remove(); el.classList.remove('okx-host', 'okx-border'); }
    };
  }

  OK.PulsatingBorder = { mount: mount };
})();
