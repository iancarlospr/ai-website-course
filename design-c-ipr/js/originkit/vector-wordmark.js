/* =====================================================================
   OriginKit.VectorWordmark: a wordmark that builds itself like a vector
   file, on a seamless ~4.8 s loop
   (after originkit.dev/components/vector-wordmark and its 02-04 variants:
   dotted vector outline, marquee selection box, bezier pen, raster grid).

   1 PEN      each glyph's real outline is traced on by a pen tip with a
              bezier handle; anchor points and control handles pop in
   2 FILL     a gradient floods up each glyph behind a bright scanline,
              then a sheen crosses the finished word
   3 INSPECT  a marquee selection box hops letter to letter (W x H readout):
              inside it the fill turns back into dotted outline + anchors
   4 RASTER   the fill snaps to a pixel grid and the cells dissolve in a
              wave, leaving the empty artboard the pen starts on again

   Canvas 2D with the real glyph outlines of the deck's headline face
   (Space Grotesk 700, pre-extracted below for "Build today"), so every
   curve is vector-sharp at 4K. Any other text falls back to the font via
   fillText with the same fill / inspect / raster beats.
   Pointer over the tile: the loop holds on the finished word and the
   selection box follows the pointer from letter to letter.
   Print / reduced motion: one composed still (the finished filled word on its type guides, a sheen across it).

   OriginKit.VectorWordmark.mount(el, {
     text:  'Build today'      speed: 1       label: 'Vector Wordmark' | false
     top/shade/accent/pen: colour tokens (defaults: white, --tone-bright, --tone-sky, --c-emph-inv)
   })
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit = window.OriginKit || {};
  var C; // core.js may load after this file (the generator loads js/originkit/*.js alphabetically): resolved at mount

  /* Space Grotesk 700 outlines, font units (1000/em), y down, x from each line's origin.
     [lineWidth, [[char, svgPath, onCurve[x,y..], offCurve[x,y..], handles[ax,ay,cx,cy..]], ...]] */
  var GLYPHS = { 'Build today': {"cap":700,"xh":486,"desc":292,"lines":[[2450,[["B","M46 0V-116H138V-584H46V-700H406Q470 -700 518 -678Q565 -657 592 -618Q618 -578 618 -523V-513Q618 -465 600 -434Q582 -404 558 -388Q533 -371 511 -364V-346Q533 -340 559 -324Q585 -307 604 -276Q622 -245 622 -195V-185Q622 -127 595 -86Q568 -44 520 -22Q473 0 410 0ZM270 -120H394Q437 -120 464 -141Q490 -162 490 -201V-211Q490 -250 464 -271Q438 -292 394 -292H270ZM270 -412H392Q433 -412 460 -433Q486 -454 486 -491V-501Q486 -539 460 -560Q434 -580 392 -580H270Z",[46,0,46,-116,138,-116,138,-584,46,-584,46,-700,406,-700,618,-523,618,-513,511,-364,511,-346,622,-195,622,-185,410,0,270,-120,394,-120,490,-201,490,-211,394,-292,270,-292,270,-412,392,-412,486,-491,486,-501,392,-580,270,-580],[470,-700,565,-657,618,-578,618,-465,582,-404,533,-371,533,-340,585,-307,622,-245,622,-127,568,-44,473,0,437,-120,490,-162,490,-250,438,-292,433,-412,486,-454,486,-539,434,-580],[406,-700,470,-700,618,-523,618,-578,618,-513,618,-465,511,-364,533,-371,511,-346,533,-340,622,-195,622,-245,622,-185,622,-127,410,0,473,0,394,-120,437,-120,490,-201,490,-162,490,-211,490,-250,394,-292,438,-292,392,-412,433,-412,486,-491,486,-454,486,-501,486,-539,392,-580,434,-580]],["u","M923 8Q865 8 822 -18Q778 -45 754 -92Q730 -139 730 -200V-496H856V-210Q856 -154 884 -126Q911 -98 962 -98Q1020 -98 1052 -136Q1084 -175 1084 -244V-496H1210V0H1086V-65H1068Q1056 -40 1023 -16Q990 8 923 8Z",[923,8,730,-200,730,-496,856,-496,856,-210,962,-98,1084,-244,1084,-496,1210,-496,1210,0,1086,0,1086,-65,1068,-65,923,8],[865,8,778,-45,730,-139,856,-154,911,-98,1020,-98,1084,-175,1056,-40,990,8],[923,8,865,8,730,-200,730,-139,856,-210,856,-154,962,-98,911,-98,962,-98,1020,-98,1084,-244,1084,-175,1068,-65,1056,-40,923,8,990,8]],["i","M1350 0V-496H1476V0ZM1413 -554Q1379 -554 1356 -576Q1332 -598 1332 -634Q1332 -670 1356 -692Q1379 -714 1413 -714Q1448 -714 1471 -692Q1494 -670 1494 -634Q1494 -598 1471 -576Q1448 -554 1413 -554Z",[1350,0,1350,-496,1476,-496,1476,0,1413,-554,1332,-634,1413,-714,1494,-634,1413,-554],[1379,-554,1332,-598,1332,-670,1379,-714,1448,-714,1494,-670,1494,-598,1448,-554],[1413,-554,1379,-554,1332,-634,1332,-598,1332,-634,1332,-670,1413,-714,1379,-714,1413,-714,1448,-714,1494,-634,1494,-670,1494,-634,1494,-598,1413,-554,1448,-554]],["l","M1616 0V-700H1742V0Z",[1616,0,1616,-700,1742,-700,1742,0],[],[]],["d","M2082 14Q2023 14 1972 -16Q1920 -45 1889 -102Q1858 -159 1858 -240V-256Q1858 -337 1889 -394Q1920 -451 1971 -480Q2022 -510 2082 -510Q2127 -510 2158 -500Q2188 -489 2207 -473Q2226 -457 2236 -439H2254V-700H2380V0H2256V-60H2238Q2221 -32 2186 -9Q2150 14 2082 14ZM2120 -96Q2178 -96 2217 -134Q2256 -171 2256 -243V-253Q2256 -325 2218 -362Q2179 -400 2120 -400Q2062 -400 2023 -362Q1984 -325 1984 -253V-243Q1984 -171 2023 -134Q2062 -96 2120 -96Z",[2082,14,1858,-240,1858,-256,2082,-510,2236,-439,2254,-439,2254,-700,2380,-700,2380,0,2256,0,2256,-60,2238,-60,2082,14,2120,-96,2256,-243,2256,-253,2120,-400,1984,-253,1984,-243,2120,-96],[2023,14,1920,-45,1858,-159,1858,-337,1920,-451,2022,-510,2127,-510,2188,-489,2226,-457,2221,-32,2150,14,2178,-96,2256,-171,2256,-325,2179,-400,2062,-400,1984,-325,1984,-171,2062,-96],[2082,14,2023,14,1858,-240,1858,-159,1858,-256,1858,-337,2082,-510,2022,-510,2082,-510,2127,-510,2236,-439,2226,-457,2238,-60,2221,-32,2082,14,2150,14,2120,-96,2178,-96,2256,-243,2256,-171,2256,-253,2256,-325,2120,-400,2179,-400,2120,-400,2062,-400,1984,-253,1984,-325,1984,-243,1984,-171,2120,-96,2062,-96]]]],[2868,[["t","M260 0Q211 0 180 -30Q150 -61 150 -112V-392H26V-496H150V-650H276V-496H412V-392H276V-134Q276 -104 304 -104H400V0Z",[260,0,150,-112,150,-392,26,-392,26,-496,150,-496,150,-650,276,-650,276,-496,412,-496,412,-392,276,-392,276,-134,304,-104,400,-104,400,0],[211,0,150,-61,276,-104],[260,0,211,0,150,-112,150,-61,276,-134,276,-104,304,-104,276,-104]],["o","M744 14Q670 14 611 -16Q552 -46 518 -103Q484 -160 484 -240V-256Q484 -336 518 -393Q552 -450 611 -480Q670 -510 744 -510Q818 -510 877 -480Q936 -450 970 -393Q1004 -336 1004 -256V-240Q1004 -160 970 -103Q936 -46 877 -16Q818 14 744 14ZM744 -98Q802 -98 840 -136Q878 -173 878 -243V-253Q878 -323 840 -360Q803 -398 744 -398Q686 -398 648 -360Q610 -323 610 -253V-243Q610 -173 648 -136Q686 -98 744 -98Z",[744,14,484,-240,484,-256,744,-510,1004,-256,1004,-240,744,14,744,-98,878,-243,878,-253,744,-398,610,-253,610,-243,744,-98],[670,14,552,-46,484,-160,484,-336,552,-450,670,-510,818,-510,936,-450,1004,-336,1004,-160,936,-46,818,14,802,-98,878,-173,878,-323,803,-398,686,-398,610,-323,610,-173,686,-98],[744,14,670,14,484,-240,484,-160,484,-256,484,-336,744,-510,670,-510,744,-510,818,-510,1004,-256,1004,-336,1004,-240,1004,-160,744,14,818,14,744,-98,802,-98,878,-243,878,-173,878,-253,878,-323,744,-398,803,-398,744,-398,686,-398,610,-253,610,-323,610,-243,610,-173,744,-98,686,-98]],["d","M1320 14Q1261 14 1210 -16Q1158 -45 1127 -102Q1096 -159 1096 -240V-256Q1096 -337 1127 -394Q1158 -451 1209 -480Q1260 -510 1320 -510Q1365 -510 1396 -500Q1426 -489 1445 -473Q1464 -457 1474 -439H1492V-700H1618V0H1494V-60H1476Q1459 -32 1424 -9Q1388 14 1320 14ZM1358 -96Q1416 -96 1455 -134Q1494 -171 1494 -243V-253Q1494 -325 1456 -362Q1417 -400 1358 -400Q1300 -400 1261 -362Q1222 -325 1222 -253V-243Q1222 -171 1261 -134Q1300 -96 1358 -96Z",[1320,14,1096,-240,1096,-256,1320,-510,1474,-439,1492,-439,1492,-700,1618,-700,1618,0,1494,0,1494,-60,1476,-60,1320,14,1358,-96,1494,-243,1494,-253,1358,-400,1222,-253,1222,-243,1358,-96],[1261,14,1158,-45,1096,-159,1096,-337,1158,-451,1260,-510,1365,-510,1426,-489,1464,-457,1459,-32,1388,14,1416,-96,1494,-171,1494,-325,1417,-400,1300,-400,1222,-325,1222,-171,1300,-96],[1320,14,1261,14,1096,-240,1096,-159,1096,-256,1096,-337,1320,-510,1260,-510,1320,-510,1365,-510,1474,-439,1464,-457,1476,-60,1459,-32,1320,14,1388,14,1358,-96,1416,-96,1494,-243,1494,-171,1494,-253,1494,-325,1358,-400,1417,-400,1358,-400,1300,-400,1222,-253,1222,-325,1222,-243,1222,-171,1358,-96,1300,-96]],["a","M1912 14Q1859 14 1817 -4Q1775 -23 1750 -58Q1726 -94 1726 -145Q1726 -196 1750 -230Q1775 -265 1818 -282Q1862 -300 1918 -300H2054V-328Q2054 -363 2032 -386Q2010 -408 1962 -408Q1915 -408 1892 -386Q1869 -365 1862 -331L1746 -370Q1758 -408 1784 -440Q1811 -471 1856 -490Q1900 -510 1964 -510Q2062 -510 2119 -461Q2176 -412 2176 -319V-134Q2176 -104 2204 -104H2244V0H2160Q2123 0 2099 -18Q2075 -36 2075 -66V-67H2056Q2052 -55 2038 -36Q2024 -16 1994 -1Q1964 14 1912 14ZM1934 -88Q1987 -88 2020 -118Q2054 -147 2054 -196V-206H1927Q1892 -206 1872 -191Q1852 -176 1852 -149Q1852 -122 1873 -105Q1894 -88 1934 -88Z",[1912,14,1726,-145,1918,-300,2054,-300,2054,-328,1962,-408,1862,-331,1746,-370,1964,-510,2176,-319,2176,-134,2204,-104,2244,-104,2244,0,2160,0,2075,-66,2075,-67,2056,-67,1912,14,1934,-88,2054,-196,2054,-206,1927,-206,1852,-149,1934,-88],[1859,14,1775,-23,1726,-94,1726,-196,1775,-265,1862,-300,2054,-363,2010,-408,1915,-408,1869,-365,1758,-408,1811,-471,1900,-510,2062,-510,2176,-412,2176,-104,2123,0,2075,-36,2052,-55,2024,-16,1964,14,1987,-88,2054,-147,1892,-206,1852,-176,1852,-122,1894,-88],[1912,14,1859,14,1726,-145,1726,-94,1726,-145,1726,-196,1918,-300,1862,-300,2054,-328,2054,-363,1962,-408,2010,-408,1962,-408,1915,-408,1862,-331,1869,-365,1746,-370,1758,-408,1964,-510,1900,-510,1964,-510,2062,-510,2176,-319,2176,-412,2176,-134,2176,-104,2204,-104,2176,-104,2160,0,2123,0,2075,-66,2075,-36,2056,-67,2052,-55,1912,14,1964,14,1934,-88,1987,-88,2054,-196,2054,-147,1927,-206,1892,-206,1852,-149,1852,-176,1852,-149,1852,-122,1934,-88,1894,-88]],["y","M2376 200V90H2646Q2674 90 2674 60V-65H2656Q2648 -48 2631 -31Q2614 -14 2585 -3Q2556 8 2511 8Q2453 8 2410 -18Q2366 -45 2342 -92Q2318 -139 2318 -200V-496H2444V-210Q2444 -154 2472 -126Q2499 -98 2550 -98Q2608 -98 2640 -136Q2672 -175 2672 -244V-496H2798V88Q2798 139 2768 170Q2738 200 2688 200Z",[2376,200,2376,90,2646,90,2674,60,2674,-65,2656,-65,2511,8,2318,-200,2318,-496,2444,-496,2444,-210,2550,-98,2672,-244,2672,-496,2798,-496,2798,88,2688,200],[2674,90,2648,-48,2614,-14,2556,8,2453,8,2366,-45,2318,-139,2444,-154,2499,-98,2608,-98,2672,-175,2798,139,2738,200],[2646,90,2674,90,2674,60,2674,90,2656,-65,2648,-48,2511,8,2556,8,2511,8,2453,8,2318,-200,2318,-139,2444,-210,2444,-154,2550,-98,2499,-98,2550,-98,2608,-98,2672,-244,2672,-175,2798,88,2798,139,2688,200,2738,200]]]]]} };

  var LOOP = 4.8;
  // pen starts while the previous loop's raster cells are still dissolving (pen0 < 0 wraps round), so there is no empty beat
  var T = { pen0: -0.75, pen1: 0.9, fill0: 0.75, fill1: 1.65, sheen0: 1.6, sheen1: 2.25, ins0: 1.7, ins1: 3.45, ras0: 3.45, dis0: 3.5, dis1: 4.5 };
  var DIS_W = 0.15; // each raster cell's own dissolve window (share of the wave): short, so letters clear cleanly
  // raster clock: the dissolve runs past the loop seam (into the next loop's first 0.75 s, before its fill), glyph by glyph,
  // each glyph's pixels leaving as the pen re-traces it, so a whole word (pixels, outline or fill) is always on screen
  var PEN_STAGGER = 0.12; // glyph after glyph, in reading order, in step with the raster dissolve of the previous loop

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sstep(a, b, v) { var x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); }
  function easeOutBack(x) { var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function mount(el, o) {
    C = OK._core; if (!C) throw new Error('OriginKit: load js/originkit/core.js first');
    o = o || {};
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.classList.add('okx-host', 'okx-wordmark');
    var cv = document.createElement('canvas');
    cv.className = 'okx-canvas'; cv.setAttribute('role', 'img');
    var text = o.text || 'Build today';
    cv.setAttribute('aria-label', text);
    el.insertBefore(cv, el.firstChild);
    var lab = C.label(el, o.label === undefined ? 'Vector Wordmark' : o.label);
    var g = cv.getContext('2d');
    var family = o.font || getComputedStyle(el).getPropertyValue('--font-headline').trim() || "'Space Grotesk', sans-serif";
    var mono = getComputedStyle(el).getPropertyValue('--font-code').trim() || 'monospace';
    var cTop = C.color(el, o.top || '#FFFFFF'), cShade = C.color(el, o.shade || '--tone-bright', '#7FD0F0');
    var cSky = C.color(el, o.accent || '--tone-sky', '#BFE6F7'), cPen = C.color(el, o.pen || '--c-emph-inv', '#FFB400');
    var cInk = C.color(el, '--c-ink', '#1A1B4A');
    var speed = o.speed == null ? 1 : o.speed;
    var data = GLYPHS[text] || null;

    /* ---------- geometry (font units) prepared once ---------- */
    var glyphs = []; // flat list: { line, ch, path, contours:[{pts:Float32Array, n}], on, off, hd, bb:[x0,y0,x1,y1], i }
    if (data) {
      var svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg'), pe = document.createElementNS(svgNS, 'path');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      svg.appendChild(pe); document.body.appendChild(svg);
      data.lines.forEach(function (ln, li) {
        ln[1].forEach(function (gd) {
          var cs = gd[1].split(/(?=M)/).filter(Boolean).map(function (d) {
            pe.setAttribute('d', d);
            var L = pe.getTotalLength ? pe.getTotalLength() : 0, n = Math.max(24, Math.ceil(L / 9)), pts = new Float32Array((n + 1) * 2);
            for (var k = 0; k <= n; k++) { var p = pe.getPointAtLength(L * k / n); pts[k * 2] = p.x; pts[k * 2 + 1] = p.y; }
            return { pts: pts, n: n };
          });
          var xs = gd[2].concat(gd[3]), bb = [1e9, 1e9, -1e9, -1e9];
          for (var q = 0; q < xs.length; q += 2) { bb[0] = Math.min(bb[0], xs[q]); bb[1] = Math.min(bb[1], xs[q + 1]); bb[2] = Math.max(bb[2], xs[q]); bb[3] = Math.max(bb[3], xs[q + 1]); }
          if (!isFinite(bb[0])) return; // (space)
          glyphs.push({ line: li, ch: gd[0], path: new Path2D(gd[1]), contours: cs, on: gd[2], off: gd[3], hd: gd[4], bb: bb, i: glyphs.length });
        });
      });
      svg.remove();
    }
    var NG = glyphs.length;
    // marquee hops: pairs of neighbouring letters, alternating lines
    var hops = [];
    if (NG) { var byLine = [[], []]; glyphs.forEach(function (gg) { (byLine[gg.line] || (byLine[gg.line] = [])).push(gg.i); });
      var a = byLine[0] || [], b = byLine[1] || [];
      hops = [[a[0]], [b[0], b[1]], [a[1], a[2]], [b[2], b[3], b[4]], [a[3], a[4]]].map(function (h) { return h.filter(function (v) { return v != null; }); }).filter(function (h) { return h.length; });
    }

    /* ---------- layout (stage px) ---------- */
    var W = 0, H = 0, s = 1, k = 1, fs = 0, rows = [], fillL = null, cells = [], cell = 8, grid = null;
    function layer() { var c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; return c; }

    function layout() {
      var lines = data ? data.lines : [[0, []]];
      var capU = data ? data.cap : 700, descU = data ? data.desc : 220, gapU = 1000 * 0.98;
      if (data) {
        var maxW = Math.max.apply(null, lines.map(function (l) { return l[0]; }));
        var blockU = capU + (lines.length - 1) * gapU + descU * 0.9;
        // an even inset: >= 40 px above the cap line, clear of the name pill below, <= 86 % of the tile width
        var inTop = Math.max(40, H * 0.13), inBot = 74, avail = Math.max(40, H - inTop - inBot);
        fs = Math.min(W * 0.8 / (maxW / 1000), avail / (blockU / 1000));
        k = fs / 1000;
        var blockH = blockU * k, top = inTop + (avail - blockH) / 2;
        rows = lines.map(function (l, i) { return { x: (W - l[0] * k) / 2, base: top + capU * k + i * gapU * k }; });
      } else {
        g.font = '700 100px ' + family; var ws = text.split(/\s+/), mw = Math.max.apply(null, ws.map(function (t) { return g.measureText(t).width; }));
        fs = Math.min(100 * W * 0.8 / mw, (H - 72) * 0.42); var t0 = (H - 58 - fs * 1.7) / 2 + fs * 0.72;
        g.font = '700 ' + fs + 'px ' + family;
        rows = ws.map(function (t, i) { return { t: t, x: (W - g.measureText(t).width) / 2, base: t0 + i * fs * 0.98 }; });
      }
    }
    function toStage(gg) { var r = rows[gg.line]; return [r.x + gg.bb[0] * k, r.base + gg.bb[1] * k, r.x + gg.bb[2] * k, r.base + gg.bb[3] * k]; }

    function bake() {
      layout();
      fillL = layer();
      var f = fillL.getContext('2d');
      rows.forEach(function (r, i) {
        var y0 = r.base - fs * 0.74, y1 = r.base + fs * 0.24;
        var lg = f.createLinearGradient(0, y0 * s, 0, y1 * s);
        lg.addColorStop(0, C.rgba(cTop)); lg.addColorStop(0.45, C.rgba(C.mix(cTop, cSky, 0.55))); lg.addColorStop(1, C.rgba(cShade));
        f.fillStyle = lg;
        if (data) {
          f.setTransform(s * k, 0, 0, s * k, r.x * s, r.base * s);
          glyphs.forEach(function (gg) { if (gg.line === i) f.fill(gg.path); });
        } else { f.setTransform(s, 0, 0, s, 0, 0); f.font = '700 ' + fs + 'px ' + family; f.fillText(r.t, r.x, r.base); }
      });
      // raster cells: sample the fill at cell resolution
      cell = Math.max(5.7, fs * 0.083); // chunky, deliberate pixels (1.5x the old mesh, so it never reads as a halftone texture)
      var cw = Math.ceil(W / cell), ch = Math.ceil(H / cell), sm = document.createElement('canvas'); sm.width = cw; sm.height = ch;
      var sx = sm.getContext('2d'); sx.imageSmoothingEnabled = true; sx.drawImage(fillL, 0, 0, cw, ch);
      var px = sx.getImageData(0, 0, cw, ch).data; cells = [];
      var bx0 = 1e9, bx1 = -1e9;
      for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
        var o4 = (y * cw + x) * 4, al = px[o4 + 3] / 255;
        if (al > 0.28) { cells.push({ x: x * cell, y: y * cell, r: px[o4], g: px[o4 + 1], b: px[o4 + 2], h: C.hash(x * 13.1 + y * 7.7) }); bx0 = Math.min(bx0, x * cell); bx1 = Math.max(bx1, x * cell); }
      }
      var midY = rows.length > 1 ? (rows[0].base + rows[1].base - fs * 0.7) / 2 : 1e9;
      cells.forEach(function (c) { var ln = rows.length > 1 && c.y > midY ? 1 : 0, r = rows[ln], lw = data ? data.lines[ln][0] * k : (bx1 - bx0);
        var xn = clamp((c.x - r.x) / Math.max(1, lw)); c.u = xn * 0.72 + ln / Math.max(1, rows.length) * 0.2 + c.h * 0.08; }); // one diagonal gold wave over both lines at once: no line waits as a static mesh
    }

    function resize() {
      var m = C.measure(el); W = m.w; H = m.h;
      s = C.fitCanvas(cv, W, H, m.phys, 10e6);
      if (W && H) bake();
    }

    /* ---------- drawing helpers ---------- */
    function glyphT(i, a0, a1, stagger) { // per-glyph local progress for a staggered phase
      var span = a1 - a0, d = Math.max(0.0001, span - stagger * (NG - 1));
      return function (t) { return clamp((t - a0 - stagger * i) / d); };
    }
    function unitTf(gg) { var r = rows[gg.line]; g.setTransform(s * k, 0, 0, s * k, r.x * s, r.base * s); }
    function stageTf() { g.setTransform(s, 0, 0, s, 0, 0); }

    function drawGridBg(alpha) {
      if (alpha <= 0) return;
      stageTf();
      var step = Math.max(12, fs * 0.216), r = Math.max(0.7, fs * 0.008);
      g.fillStyle = C.rgba(cSky, 0.16 * alpha);
      for (var y = step / 2; y < H; y += step) for (var x = step / 2; x < W; x += step) { g.fillRect(x - r / 2, y - r / 2, r, r); }
    }

    // type-design guides (cap, x-height, baseline, descender) sweep in with the pen and leave with the raster
    function guides(pu, u) {
      var a = sstep(T.pen0, T.pen0 + 0.5, pu) * (1 - sstep(T.ins0, T.ins0 + 0.5, pu) * 0.55) * (pu >= T.ras0 ? 1 - sstep(T.ras0, T.ras0 + 0.28, pu) : 1);
      if (pu < T.pen0 || a <= 0.01) return;
      var grow = sstep(T.pen0, T.pen0 + 0.6, pu);
      stageTf(); g.lineWidth = 1; g.setLineDash([3, 4]);
      rows.forEach(function (r, i) {
        [[-data.cap, 0.5], [-data.xh, 0.32], [0, 0.6], [data.desc, 0.25]].forEach(function (L, j) {
          var y = Math.round(r.base + L[0] * k) + 0.5, x0 = W * (0.5 - 0.5 * grow), x1 = W * (0.5 + 0.5 * grow);
          g.strokeStyle = C.rgba(j === 2 ? cPen : cSky, L[1] * a); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
        });
      });
      g.setLineDash([]);
    }
    function tracePartial(gg, p) { // pen: polyline of each contour up to p, returns the tip of the longest contour
      var tip = null;
      g.beginPath();
      gg.contours.forEach(function (c, ci) {
        var upto = p * c.n, n = Math.floor(upto), f = upto - n, P = c.pts;
        g.moveTo(P[0], P[1]);
        for (var q = 1; q <= n; q++) g.lineTo(P[q * 2], P[q * 2 + 1]);
        if (n < c.n) { var x = P[n * 2] + (P[n * 2 + 2] - P[n * 2]) * f, y = P[n * 2 + 1] + (P[n * 2 + 3] - P[n * 2 + 1]) * f; g.lineTo(x, y);
          if (ci === 0) tip = { x: x, y: y, dx: P[n * 2 + 2] - P[n * 2], dy: P[n * 2 + 3] - P[n * 2 + 1] }; }
      });
      g.stroke();
      return tip;
    }
    function anchors(gg, alpha, withHandles, sparse) {
      if (alpha <= 0.01) return;
      var sq = Math.max(4, fs * 0.054) / k * (sparse ? 1.3 : 1), hr = sq * 0.42;
      // sparse (a finished letter in the full-word outline): a few big on-curve nodes, no handles, so it reads at tile size
      var stride = sparse ? Math.max(1, Math.ceil(gg.on.length / 2 / 4)) * 2 : 2;
      if (withHandles) {
        g.strokeStyle = C.rgba(cSky, 0.55 * alpha); g.lineWidth = 1.3 / k; g.beginPath();
        for (var q = 0; q < gg.hd.length; q += 4) { g.moveTo(gg.hd[q], gg.hd[q + 1]); g.lineTo(gg.hd[q + 2], gg.hd[q + 3]); }
        g.stroke();
        g.fillStyle = C.rgba(cSky, 0.75 * alpha);
        for (q = 0; q < gg.off.length; q += 2) { g.beginPath(); g.arc(gg.off[q], gg.off[q + 1], hr, 0, 6.2832); g.fill(); }
      }
      g.lineWidth = 1.5 / k;
      for (q = 0; q < gg.on.length; q += stride) {
        g.fillStyle = C.rgba(cInk, alpha); g.fillRect(gg.on[q] - sq / 2, gg.on[q + 1] - sq / 2, sq, sq);
        g.strokeStyle = C.rgba(cTop, 0.95 * alpha); g.strokeRect(gg.on[q] - sq / 2, gg.on[q + 1] - sq / 2, sq, sq);
      }
    }
    function dotted(gg, alpha) {
      g.strokeStyle = C.rgba(cTop, 0.95 * alpha); g.lineWidth = Math.max(1.3, fs * 0.016) / k; g.lineCap = 'round';
      g.setLineDash([0.001 / k, Math.max(3.4, fs * 0.036) / k]); g.stroke(gg.path); g.setLineDash([]); g.lineCap = 'butt';
    }

    /* ---------- the loop ---------- */
    var ptr = { on: false, x: 0, y: 0 }, box = { x0: 0, y0: 0, x1: 0, y1: 0, init: false };
    var tNow = 0, tOrigin = 0, sl = el.closest && el.closest('[data-slide]');
    if (sl) sl.addEventListener('slide:enter', function () { tOrigin = tNow; });

    function hopTarget(u) { // u in [0,1] across the inspect phase -> eased box between hop rects
      var n = hops.length, x = u * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
      var from = rectOf(hops[Math.max(0, i - 1)] || hops[0]), to = rectOf(hops[i]);
      var e = i === 0 ? 1 : easeOutBack(clamp(f / 0.42));
      return { r: lerpR(from, to, i === 0 ? clamp(f / 0.3) : e), set: hops[i], appear: i === 0 ? sstep(0, 0.35, f) : 1 };
    }
    function rectOf(set) { var r = [1e9, 1e9, -1e9, -1e9]; set.forEach(function (gi) { var b = toStage(glyphs[gi]); r[0] = Math.min(r[0], b[0]); r[1] = Math.min(r[1], b[1]); r[2] = Math.max(r[2], b[2]); r[3] = Math.max(r[3], b[3]); }); var p = fs * 0.06; return [r[0] - p, r[1] - p, r[2] + p, r[3] + p]; }
    function lerpR(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; }
    function glyphAt(x, y) { var best = -1, bd = 1e9; glyphs.forEach(function (gg) { var b = toStage(gg), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, d = Math.abs(x - cx) + Math.abs(y - cy) * 0.6; if (d < bd) { bd = d; best = gg.i; } }); return best; }

    function draw(t, dt, still) {
      if (!W || !fillL) return;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      var u = still ? T.fill1 + 0.01 : ptr.on && NG ? T.ins0 + 0.6 : (((t - tOrigin) * speed) % LOOP + LOOP) % LOOP;

      var ru = u < T.fill0 ? u + LOOP : u;
      drawGridBg(0.55 + 0.45 * sstep(T.ras0, T.ras0 + 0.3, ru) * (1 - sstep(T.dis1 - 0.6, T.dis1, ru)));

      if (!data) return drawFallback(u);

      var pu = u > T.ras0 + 0.3 ? u - LOOP : u; // pen clock (wraps into the raster tail)
      /* raster floor: from the start of the dissolve until the next pen pass's ghost is in, a solid ~0.2 blueprint of the
         whole word sits behind the pixel cells, so the word stays readable in every frame (never 'ild day' mid-wave).
         It hands over to the pen's own 0.2 ghost (same colour) as that one fades in, so the sum holds at ~0.2 */
      if (!still && ru >= T.dis0 - 0.05 && ru < T.dis1 + 0.1) {
        var penIn = pu < 0 ? sstep(T.pen0 - 0.3, T.pen0 + 0.05, pu) : 0, floorA = 0.2 * sstep(T.dis0 - 0.05, T.dis0 + 0.05, ru) * (1 - penIn);
        if (floorA > 0.005) { g.fillStyle = C.rgba(C.mix(cSky, cTop, 0.5), floorA); glyphs.forEach(function (gg) { unitTf(gg); g.fill(gg.path); }); }
      }
      /* 1 PEN: outline traced glyph by glyph, pen tip + handle, anchors */
      var outlineA = 1 - sstep(T.ins0 - 0.1, T.ins0 + 0.25, pu); // outline fades once the fill is done
      guides(pu, u);
      if (pu < T.ins0 + 0.3 && !still) {
        var tips = [];
        glyphs.forEach(function (gg) {
          var p0 = glyphT(gg.i, T.pen0, T.pen1, PEN_STAGGER)(pu), p = 1 - Math.pow(1 - p0, 2.4); // pen leaves fast, lands soft
          // blueprint: a solid ~0.2 ghost of every letter holds under the pen until the fill floods it, so the word shape
          // always reads on a washed-out projector; letters the pen has not reached also carry a dotted edge
          var appear = sstep(T.pen0 - 0.3, T.pen0 + 0.05, pu), fillP = pu >= T.fill0 ? easeInOut(glyphT(gg.i, T.fill0, T.fill1, 0.05)(pu)) : 0;
          var ghostFill = 0.2 * appear * (1 - fillP), ghostEdge = 0.5 * appear * (1 - sstep(0.4, 0.9, p));
          if (ghostFill > 0.005 || ghostEdge > 0.01) { unitTf(gg); if (ghostFill > 0.005) { g.fillStyle = C.rgba(C.mix(cSky, cTop, 0.5), ghostFill); g.fill(gg.path); } if (ghostEdge > 0.01) dotted(gg, ghostEdge); }
          if (p <= 0) return;
          unitTf(gg);
          // the traced outline: a 2.5 px sky-white line at ~0.88, bright enough to hold up on a projector
          g.strokeStyle = C.rgba(C.mix(cSky, cTop, 0.7), 0.88 * outlineA); g.lineWidth = Math.max(2.5, fs * 0.026) / k; g.lineJoin = 'round';
          var tip = tracePartial(gg, p);
          // handles only on the letter the pen is drawing; finished letters keep a few big on-curve nodes
          anchors(gg, sstep(0.55, 1, p) * outlineA * (1 - sstep(T.fill0 + 0.3, T.ins0, pu) * 0.6), p < 1, p >= 1);
          if (tip && p < 1) tips.push({ gg: gg, tip: tip, p: p });
        });
        // pen tips: gold node + tangent handle with two dots (bezier tool)
        tips.forEach(function (o) {
          unitTf(o.gg);
          var L = Math.hypot(o.tip.dx, o.tip.dy) || 1, hx = o.tip.dx / L * 105, hy = o.tip.dy / L * 105, r = Math.max(2.4, fs * 0.03) / k;
          g.strokeStyle = C.rgba(cPen, 0.9); g.lineWidth = 1.2 / k; g.beginPath(); g.moveTo(o.tip.x - hx, o.tip.y - hy); g.lineTo(o.tip.x + hx, o.tip.y + hy); g.stroke();
          g.fillStyle = C.rgba(cPen, 1);
          g.beginPath(); g.arc(o.tip.x - hx, o.tip.y - hy, r * 0.6, 0, 6.2832); g.arc(o.tip.x + hx, o.tip.y + hy, r * 0.6, 0, 6.2832); g.fill();
          g.beginPath(); g.arc(o.tip.x, o.tip.y, r * 2.4, 0, 6.2832); g.fillStyle = C.rgba(cPen, 0.18); g.fill();
          g.beginPath(); g.arc(o.tip.x, o.tip.y, r, 0, 6.2832); g.fillStyle = C.rgba(cPen, 1); g.fill();
        });
      }

      /* 2 FILL: per-glyph flood from the baseline up, scanline at the level */
      var rasterK = sstep(T.ras0, T.ras0 + 0.22, ru); // fill -> pixel cells crossfade
      if (u >= T.fill0 && u < T.ras0 + 0.25) {
        var fillA = 1 - clamp(rasterK * 2 - 1); // the fill holds until the bright cells are fully in (no half-and-half grey beat)
        glyphs.forEach(function (gg) {
          var p = easeInOut(glyphT(gg.i, T.fill0, T.fill1, 0.05)(u));
          if (p <= 0) return;
          var b = toStage(gg), yTop = b[3] - (b[3] - b[1] + fs * 0.1) * p;
          stageTf(); g.save(); g.beginPath(); g.rect(b[0] - 4, yTop, b[2] - b[0] + 8, b[3] - yTop + 6); g.clip();
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = fillA; g.drawImage(fillL, 0, 0); g.globalAlpha = 1; g.restore();
          if (p < 1) { // scanline
            g.save(); unitTf(gg); g.clip(gg.path); // the gold scanline stays inside the letter
            stageTf(); var lg = g.createLinearGradient(b[0], 0, b[2], 0);
            lg.addColorStop(0, C.rgba(cPen, 0.35)); lg.addColorStop(0.5, C.rgba(cPen, 1)); lg.addColorStop(1, C.rgba(cPen, 0.35));
            g.fillStyle = lg; g.fillRect(b[0] - 2, yTop - 1, b[2] - b[0] + 4, Math.max(2.4, fs * 0.03)); g.restore();
          }
        });
        // sheen across the finished word
        var sh = still ? 0.62 : sstep(T.sheen0, T.sheen1, u);
        if (sh > 0 && sh < 1) {
          var sc = scratchL(); var m = sc.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, sc.width, sc.height);
          m.globalCompositeOperation = 'source-over'; m.drawImage(fillL, 0, 0); m.globalCompositeOperation = 'source-in';
          var x = (-0.3 + 1.6 * sh) * W * s, gl = m.createLinearGradient(x - W * s * 0.18, 0, x + W * s * 0.18, H * s * 0.5);
          gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, C.rgba(cPen, 0.85)); gl.addColorStop(1, 'rgba(255,255,255,0)');
          m.fillStyle = gl; m.fillRect(0, 0, sc.width, sc.height); m.globalCompositeOperation = 'source-over';
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.75 * (1 - rasterK); g.drawImage(sc, 0, 0); g.globalAlpha = 1;
        }
      }

      /* 3 INSPECT: marquee selection box hops letter to letter; inside: dotted outline + anchors */
      var insA = still ? 0 : sstep(T.ins0 - 0.05, T.ins0 + 0.2, u) * (1 - sstep(T.ins1 - 0.22, T.ins1, u));
      if (insA > 0.001 && hops.length) {
        var hv, set;
        if (ptr.on && !still) { var gi = glyphAt(ptr.x, ptr.y); set = [gi]; var tr = rectOf(set); if (!box.init) { box.x0 = tr[0]; box.y0 = tr[1]; box.x1 = tr[2]; box.y1 = tr[3]; box.init = true; } var kk = 1 - Math.pow(0.0005, dt || 0.016); box.x0 += (tr[0] - box.x0) * kk; box.y0 += (tr[1] - box.y0) * kk; box.x1 += (tr[2] - box.x1) * kk; box.y1 += (tr[3] - box.y1) * kk; hv = { r: [box.x0, box.y0, box.x1, box.y1], appear: 1 }; }
        else { box.init = false; hv = hopTarget(clamp((u - T.ins0) / (T.ins1 - T.ins0))); if (still) hv = { r: rectOf(hops[2]), appear: 1 }; }
        var R = hv.r, A = insA * hv.appear;
        // punch the fill inside the box, then draw outline + anchors there
        stageTf(); g.save(); g.beginPath(); g.rect(R[0], R[1], R[2] - R[0], R[3] - R[1]); g.clip();
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.84 * A; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        stageTf(); g.fillStyle = C.rgba(cSky, 0.1 * A); g.fillRect(R[0], R[1], R[2] - R[0], R[3] - R[1]);
        glyphs.forEach(function (gg) { var b = toStage(gg); if (b[2] < R[0] || b[0] > R[2] || b[3] < R[1] || b[1] > R[3]) return; unitTf(gg);
          // a solid outline at ~0.5 under the dotted edge + handles, so the selected letter reads at projector distance
          g.strokeStyle = C.rgba(C.mix(cSky, cTop, 0.6), 0.5 * A); g.lineWidth = Math.max(2, fs * 0.022) / k; g.lineJoin = 'round'; g.stroke(gg.path);
          dotted(gg, A); anchors(gg, A, true); });
        g.restore();
        // the box: dashed sky edge, corner handles, readouts
        stageTf(); var lw = Math.max(1, fs * 0.012);
        g.strokeStyle = C.rgba(cSky, 0.95 * A); g.lineWidth = lw; g.setLineDash([lw * 3, lw * 2.2]); g.lineDashOffset = -(t * 24) % 100;
        g.strokeRect(R[0], R[1], R[2] - R[0], R[3] - R[1]); g.setLineDash([]);
        var hs = Math.max(4.5, fs * 0.06);
        [[R[0], R[1]], [R[2], R[1]], [R[0], R[3]], [R[2], R[3]], [(R[0] + R[2]) / 2, R[1]], [(R[0] + R[2]) / 2, R[3]]].forEach(function (p, ci) {
          g.fillStyle = C.rgba(ci < 4 ? cSky : cTop, A); g.fillRect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
          g.strokeStyle = C.rgba(cInk, A); g.lineWidth = 1; g.strokeRect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
        });
        // readout: the selection's real size in tile px, parked in the gap between the lines (never over a glyph)
        var fz = Math.max(16, Math.min(18, fs * 0.16)), wv = Math.round(R[2] - R[0]), hvv = Math.round(R[3] - R[1]);
        g.font = '600 ' + fz.toFixed(1) + 'px ' + mono; g.textBaseline = 'top'; g.textAlign = 'center';
        var lbl = wv + ' × ' + hvv, tw = g.measureText(lbl).width + fz * 0.9, chH = fz * 1.45, cx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, (R[0] + R[2]) / 2)), ty;
        if (rows.length > 1) {
          var gTop = rows[0].base + 4, gBot = rows[1].base - data.cap * k - 4; // baseline of line 1 .. cap line of line 2
          ty = (gTop + gBot - chH) / 2;
        } else { ty = R[3] + hs * 0.9; if (ty + chH > H - 64) ty = R[1] - hs * 0.9 - chH; }
        roundRect(cx - tw / 2, ty, tw, chH, chH / 2); g.fillStyle = C.rgba(cInk, A); g.fill(); g.lineWidth = 2; g.strokeStyle = C.rgba(cInk, A); g.stroke();
        roundRect(cx - tw / 2 + 1.5, ty + 1.5, tw - 3, chH - 3, chH / 2 - 1.5); g.fillStyle = C.rgba(cSky, A); g.fill();
        g.fillStyle = C.rgba(cInk, A); g.fillText(lbl, cx, ty + (chH - fz) / 2 + fz * 0.04);
        g.textAlign = 'left';
      }

      /* 4 RASTER: fill -> pixel cells -> wave dissolve (gold glints) */
      if (ru >= T.ras0 && ru < T.dis1 + 0.1 && cells.length) {
        var w = clamp((ru - T.dis0) / (T.dis1 - T.dis0));
        stageTf();
        var gap = Math.max(1, cell * 0.13); // a small gap: blocks, not a screen
        for (var q = 0; q < cells.length; q++) {
          var c = cells[q], v = clamp((w * (1 + DIS_W) - c.u) / DIS_W), sz = (cell - gap) * (1 - v * v), a = clamp(rasterK * 2) * (1 - v);
          if (a <= 0.01 || sz <= 0.2) continue;
          // cells stay bright white (a touch of the fill's sky at the foot); only the dissolving edge turns gold, then dims
          var cellK = clamp(rasterK * 2), lead = v > 0 ? clamp(v / 0.45) : 0, fade = v > 0.45 ? cellK * (1 - (v - 0.45) / 0.55) : cellK;
          a = fade; if (a <= 0.01) continue;
          var br = 0.78, cr = 255 * br + c.r * (1 - br), cg = 255 * br + c.g * (1 - br), cb = 255 * br + c.b * (1 - br);
          var glint = v > 0.05 && v < 0.6 && c.h > 0.86;
          if (glint || lead > 0) { var m2 = glint ? 1 : Math.min(1, lead * 1.4); cr += (cPen[0] - cr) * m2; cg += (cPen[1] - cg) * m2; cb += (cPen[2] - cb) * m2; }
          g.fillStyle = 'rgba(' + (cr | 0) + ',' + (cg | 0) + ',' + (cb | 0) + ',' + a.toFixed(3) + ')';
          // the wave front is kinetic: a cell swells gold as the edge reaches it, then shrinks and lifts away
          var pop = v > 0 && v < 0.45 ? Math.sin(v / 0.45 * Math.PI) * 0.22 : 0, szp = sz * (1 + pop);
          var o2 = (cell - szp) / 2; g.fillRect(c.x + o2, c.y + o2 - v * v * cell * 0.9, szp, szp);
        }
      }
    }
    var scratch = null;
    function scratchL() { if (!scratch || scratch.width !== cv.width || scratch.height !== cv.height) scratch = layer(); return scratch; }
    function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function drawFallback(u) {
      var a = sstep(T.fill0, T.fill1, u) * (1 - sstep(T.ras0, T.ras0 + 1.2, u));
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.drawImage(fillL, 0, 0); g.globalAlpha = 1;
    }

    function frame(t, dt) { tNow = t; draw(t, dt, false); }
    function still() { draw(0, 0, true); }

    function onMove(e) { var r = el.getBoundingClientRect(), tf = W ? r.width / W : 1; ptr.x = (e.clientX - r.left) / tf; ptr.y = (e.clientY - r.top) / tf; ptr.on = true; }
    function onLeave() { ptr.on = false; tOrigin = tNow - T.ins0 - 0.6; } // resume from the inspect beat, no jump
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave);

    var R = C.runner({ el: el, frame: frame, still: still, resize: resize });
    if (document.fonts && document.fonts.load) document.fonts.load('700 100px ' + family, text).then(function () { R.refit(); }, function () {});
    return {
      render: function () { R.refit(); },
      destroy: function () { R.stop(); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); cv.remove(); lab && lab.remove(); el.classList.remove('okx-host', 'okx-wordmark'); }
    };
  }

  OK.VectorWordmark = { mount: mount };
})();
