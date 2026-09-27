/* =================================================================
   chloe.js — Chloé the pixel ghost (vanilla port)
   Ported from MarketingAlphaAudit/apps/web/components/chloe/
     chloe-sprite.tsx      32x42 grid, 9 states, wavy tails, blink
     chloe-screenmate.tsx  float / roam darts / drag / quips
     laser-beams.tsx       rainbow tapered beams + eye orbs (rAF tracked)
   Classic script (no modules) so it works from file://.
   Globals: window.Chloe
   ================================================================= */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------
     Sprite data (exact port)
     --------------------------------------------------------------- */
  var GRID_W = 32;
  var GRID_H = 42;
  var STATES = ['idle', 'scanning', 'found', 'critical', 'smug', 'chat', 'sleeping', 'mischief', 'celebrating'];
  var COLORS = {
    body: '#FFF0FA', shade: '#FFCAF3', outline: '#1A161A', eyes: '#FFB2EF',
    eyeHighlight: '#FFFFFF', glow: '#FFB2EF', blush: '#FFD4E8', sleep: '#4A3844', alert: '#FFB84D'
  };
  // Single-letter codes: . empty, o outline, b body, s shade, e eyes, h eyeHighlight, l blush
  var BASE = [
    '...........oooooooooo...........',
    '.........oobbbbbbbbbboo.........',
    '........obbbbbbbbbbbbbbo........',
    '.......obbbbbbbbbbbbbbbbo.......',
    '......obbbbbbbbbbbbbbbbbbo......',
    '.....obbbbbbbbbbbbbbbbbbbbo.....',
    '....obbbbbbbbbbbbbbbbbbbbbbo....',
    '....obbbbbbbbbbbbbbbbbbbbbbo....',
    '...obbbbbbbbbbbbbbbbbbbbbbbbo...',
    '...obbbbbbbbbbbbbbbbbbbbbbbbo...',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbeeebbbbbbbbbeeebbbbbbo..',
    '..obbbbeeeeebbbbbbbeeeeebbbbbo..',
    '..obbbbeeheebbbbbbbeeheebbbbbo..',
    '..obbbbeeeeebbbbbbbeeeeebbbbbo..',
    '..obbbbbeeebbbbbbbbbeeebbbbbbo..',
    '..obbblbbbbbbbbbbbbbbbbblbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbooooooobbbbbbbbbo..'.slice(0, 13) + 'oooooo' + 'bbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbsbbbbbbbbbbsbbbbbbbo..',
    '..obbbbbbbbsbbbbbbbbsbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbbbbbbbbbbbbbbbbbbbbbbbbo..',
    '..obbbsbbbbbbsbbbbsbbbbbbsbbbo..',
    '..obbsbbbobbsbbbosbbbobbsbbbo...',
    '...osbbo..osbbo..obbo..obboo....',
    '....obo....obo....oo....oo......',
    '.....o......o...................',
    '................................'
  ];
  var CODE = { o: 'outline', b: 'body', s: 'shade', e: 'eyes', h: 'eyeHighlight', l: 'blush' };

  function baseGrid() {
    var g = new Array(GRID_H);
    for (var y = 0; y < GRID_H; y++) {
      var row = new Array(GRID_W);
      var src = BASE[y];
      for (var x = 0; x < GRID_W; x++) {
        var ch = src.charAt(x);
        row[x] = CODE[ch] || null;
      }
      g[y] = row;
    }
    return g;
  }

  /** Exact port of getStateGrid(state, frame). Returns 42 rows x 32 cols of color keys (or null). */
  function getStateGrid(state, frame) {
    frame = frame | 0;
    var grid = baseGrid();
    var waveOffset = [0, 1, 1, 0, -1, -1, 0, 1][((frame % 8) + 8) % 8];
    for (var r = 36; r <= 40; r++) {
      var row = grid[r];
      var shift = waveOffset * (r >= 39 ? 2 : 1);
      if (shift === 0) continue;
      var nr = new Array(GRID_W).fill(null);
      for (var c = 0; c < GRID_W; c++) {
        var s = c - shift;
        if (s >= 0 && s < GRID_W) nr[c] = row[s];
      }
      grid[r] = nr;
    }
    var i, c2, rr;
    function closeEyes() {
      for (rr = 12; rr <= 16; rr++) {
        for (c2 = 7; c2 <= 11; c2++) grid[rr][c2] = rr === 14 ? 'outline' : 'body';
        for (c2 = 19; c2 <= 23; c2++) grid[rr][c2] = rr === 14 ? 'outline' : 'body';
      }
    }
    function wideEyes() {
      grid[11][8] = 'eyes'; grid[11][9] = 'eyes'; grid[11][10] = 'eyes';
      grid[11][20] = 'eyes'; grid[11][21] = 'eyes'; grid[11][22] = 'eyes';
    }
    switch (state) {
      case 'idle':
        if (frame % 4 === 3) closeEyes();
        break;
      case 'scanning':
      case 'found':
        wideEyes();
        break;
      case 'critical':
        for (i = 3; i <= 6; i++) { grid[13][i] = 'eyes'; grid[14][i] = 'eyes'; }
        for (i = 25; i <= 28; i++) { grid[13][i] = 'eyes'; grid[14][i] = 'eyes'; }
        break;
      case 'smug':
        for (i = 7; i <= 11; i++) grid[12][i] = 'body';
        for (i = 19; i <= 23; i++) grid[12][i] = 'body';
        grid[19][14] = 'body'; grid[19][15] = 'outline'; grid[19][16] = 'outline'; grid[19][17] = 'outline';
        break;
      case 'chat':
        grid[17][5] = 'blush'; grid[17][6] = 'blush'; grid[17][25] = 'blush'; grid[17][24] = 'blush';
        break;
      case 'sleeping':
        closeEyes();
        for (i = 13; i <= 18; i++) grid[19][i] = 'body';
        break;
      case 'mischief':
        for (rr = 12; rr <= 16; rr++) {
          for (i = 7; i <= 9; i++) grid[rr][i] = 'body';
          for (i = 19; i <= 21; i++) grid[rr][i] = 'body';
        }
        for (rr = 13; rr <= 15; rr++) { grid[rr][10] = 'eyes'; grid[rr][11] = 'eyes'; grid[rr][22] = 'eyes'; grid[rr][23] = 'eyes'; }
        grid[19][12] = 'outline'; grid[19][19] = 'outline';
        break;
      case 'celebrating':
        wideEyes();
        grid[19][14] = 'outline'; grid[19][15] = 'outline'; grid[19][16] = 'outline'; grid[19][17] = 'outline';
        grid[20][14] = 'outline'; grid[20][17] = 'outline';
        grid[21][14] = 'outline'; grid[21][15] = 'outline'; grid[21][16] = 'outline'; grid[21][17] = 'outline';
        break;
    }
    return grid;
  }

  /** Draw a grid to a 2D context with integer cell size (device px). */
  function mergeColors(c) { return c && c !== COLORS ? Object.assign({}, COLORS, c) : COLORS; }

  function drawGrid(ctx, grid, cell, flipped, colors) {
    colors = mergeColors(colors);
    ctx.clearRect(0, 0, GRID_W * cell, GRID_H * cell);
    for (var y = 0; y < GRID_H; y++) {
      var row = grid[y];
      // merge horizontal runs of the same color: fewer fillRects, no seams
      var x = 0;
      while (x < GRID_W) {
        var k = row[flipped ? GRID_W - 1 - x : x];
        if (!k) { x++; continue; }
        var start = x;
        while (x + 1 < GRID_W && row[flipped ? GRID_W - 2 - x : x + 1] === k) x++;
        ctx.fillStyle = colors[k];
        ctx.fillRect(start * cell, y * cell, (x - start + 1) * cell, cell);
        x++;
      }
    }
  }

  /** Vector SVG string of a sprite frame. Crisp at any DPR, prints perfectly. */
  function toSVG(state, frame, opts) {
    opts = opts || {};
    var grid = getStateGrid(state || 'idle', frame || 0);
    var flipped = !!opts.flipped;
    var colors = mergeColors(opts.colors);
    // one <path> per color: shared edges inside a path never show hairline seams (PDF/print safe)
    var paths = {};
    for (var y = 0; y < GRID_H; y++) {
      var row = grid[y];
      var x = 0;
      while (x < GRID_W) {
        var k = row[flipped ? GRID_W - 1 - x : x];
        if (!k) { x++; continue; }
        var start = x;
        while (x + 1 < GRID_W && row[flipped ? GRID_W - 2 - x : x + 1] === k) x++;
        (paths[k] = paths[k] || []).push('M' + start + ' ' + y + 'h' + (x - start + 1) + 'v1h-' + (x - start + 1) + 'z');
        x++;
      }
    }
    var parts = Object.keys(paths).map(function (k) { return '<path fill="' + colors[k] + '" d="' + paths[k].join('') + '"/>'; });
    var w = opts.width ? ' width="' + opts.width + '"' : '';
    var h = opts.height ? ' height="' + opts.height + '"' : '';
    var title = opts.title === false ? '' : '<title>Chloé the ghost — ' + (state || 'idle') + '</title>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + GRID_W + ' ' + GRID_H + '"' + w + h +
      ' shape-rendering="crispEdges" role="img">' + title + parts.join('') + '</svg>';
  }

  /* ---------------------------------------------------------------
     Environment helpers
     --------------------------------------------------------------- */
  var hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
  function reducedMotion() {
    return hasDOM && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function dpr() { return (hasDOM && window.devicePixelRatio) || 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function easeOutBack(t) { var c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function easeOutQuad(p) { return p * (2 - p); }
  function snap(v) { var d = dpr(); return Math.round(v * d) / d; }

  var STYLE_ID = 'chloe-js-style';
  function injectStyle() {
    if (!hasDOM || document.getElementById(STYLE_ID)) return;
    var css = [
      '.chloe-layer{position:fixed;inset:0;pointer-events:none;z-index:var(--z-chloe,700);contain:layout style}',
      '.chloe{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform}',
      '.chloe:active{cursor:grabbing}',
      '.chloe canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;position:relative}',
      '.chloe-glow{position:absolute;left:50%;top:50%;width:200%;height:170%;transform:translate(-50%,-50%);pointer-events:none;border-radius:50%;',
      'background:radial-gradient(ellipse at center,rgba(var(--chloe-glow-rgb,255,178,239),.34) 0%,rgba(var(--chloe-glow-rgb,255,178,239),.12) 35%,rgba(var(--chloe-glow-rgb,255,178,239),0) 68%);transition:opacity .4s}',
      '.chloe[data-state=scanning] .chloe-glow,.chloe[data-state=critical] .chloe-glow{opacity:1.6;background:radial-gradient(ellipse at center,rgba(var(--chloe-glow-rgb,255,178,239),.55) 0%,rgba(var(--chloe-glow-rgb,255,178,239),.2) 38%,rgba(var(--chloe-glow-rgb,255,178,239),0) 70%)}',
      '.chloe-zzz{position:absolute;right:-18%;top:-22%;font-family:var(--font-personality,"Permanent Marker",cursive);color:var(--gs-mid,#4A3844);white-space:nowrap;pointer-events:none;animation:chloe-float 3s ease-in-out infinite}',
      '.chloe-zzz span{margin-left:.1em}',
      '.chloe-bang{position:absolute;left:50%;top:-30%;transform:translateX(-50%);font:800 1em/1 var(--font-system,monospace);color:var(--gs-warning,#FFB84D);text-shadow:0 0 6px var(--gs-warning,#FFB84D);pointer-events:none;animation:chloe-bounce .6s ease-in-out infinite alternate}',
      /* bubble: projector-legible by default (24px Marker, 14px label, 460px measure, scaled by --chloe-bubble-scale) */
      '.chloe-bubble{--bs:var(--chloe-bubble-scale,1);position:absolute;left:0;top:0;max-width:min(calc(460px * var(--bs)),calc(100vw - 32px));min-width:calc(140px * var(--bs));',
      'padding:calc(16px * var(--bs)) calc(22px * var(--bs)) calc(18px * var(--bs));border-radius:calc(18px * var(--bs));pointer-events:auto;',
      'background:var(--gs-light,#FDF0F8);color:var(--gs-void,#080808);font:400 max(16px,calc(24px * var(--bs)))/1.25 var(--font-personality,"Permanent Marker",cursive);text-wrap:balance;',
      'box-shadow:0 0 0 2px var(--gs-void,#080808),0 0 0 4px var(--chloe-ring,var(--gs-base,#FFB2EF)),0 14px 36px rgba(0,0,0,.4),0 0 40px rgba(var(--chloe-glow-rgb,255,178,239),.25);',
      'opacity:0;visibility:hidden;transform:translateY(6px) scale(.96);transform-origin:var(--ox,80%) 100%;transition:opacity .25s var(--ease-out,ease),transform .35s var(--ease-spring,ease),visibility 0s linear .25s;z-index:2}',
      '.chloe-bubble.is-on{opacity:1;visibility:visible;transform:none;transition:opacity .25s var(--ease-out,ease),transform .35s var(--ease-spring,ease),visibility 0s}',
      /* tail: under the box (above placements), on top (below placements), on the side (left / right placements) */
      '.chloe-bubble::after{content:"";position:absolute;bottom:-12px;left:var(--tail,80%);width:14px;height:14px;transform:translateX(-50%);',
      'background:linear-gradient(135deg,var(--gs-light,#FDF0F8) 50%,transparent 50%);clip-path:polygon(0 0,100% 0,0 100%);',
      'filter:drop-shadow(2px 2px 0 var(--gs-void,#080808))}',
      '.chloe-bubble[data-place=b]::after,.chloe-bubble[data-place=br]::after{bottom:auto;top:-12px;transform:translateX(-50%) scaleY(-1)}',
      '.chloe-bubble[data-place=l]::after,.chloe-bubble[data-place=r]::after{bottom:auto;top:calc(50% - 7px);left:auto;transform:none;clip-path:none;width:0;height:0;background:none;filter:none;border:9px solid transparent}',
      '.chloe-bubble[data-place=l]::after{right:-17px;border-left-color:var(--gs-light,#FDF0F8)}',
      '.chloe-bubble[data-place=r]::after{left:-17px;border-right-color:var(--gs-light,#FDF0F8)}',
      '.chloe-bubble .chloe-who{display:block;font:600 max(12px,calc(14px * var(--bs)))/1 var(--font-system,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--chloe-who,oklch(0.55 0.16 340));margin-bottom:calc(8px * var(--bs))}',
      /* the full line is laid out invisibly first, so the box never grows while it types */
      ':where(.chloe-bubble .chloe-text){display:grid}:where(.chloe-bubble .ct-ghost,.chloe-bubble .ct-live){grid-area:1/1}:where(.chloe-bubble .ct-ghost){visibility:hidden}',
      /* free type: no box, marker type with a soft dark glow, for full-bleed photo slides */
      '.chloe-bubble.is-free{background:none;box-shadow:none;padding:0;color:#fff;font-size:max(18px,calc(30px * var(--bs)));',
      'text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 14px rgba(0,0,0,.75),0 0 30px rgba(0,0,0,.55)}',
      '.chloe-bubble.is-free::after,.chloe-bubble.is-free .chloe-who{display:none}',
      '.chloe.has-shadow canvas{filter:drop-shadow(0 2px 0 rgba(26,22,26,.35)) drop-shadow(0 0 10px rgba(var(--chloe-glow-rgb,255,178,239),.7))}',
      '.chloe-layer.is-hidden{visibility:hidden}',
      '.chloe{transition:opacity .3s}.chloe.is-dim{opacity:.35}.chloe.is-away{opacity:0}',
      '.chloe-laser{position:fixed;left:0;top:0;pointer-events:none;z-index:var(--z-laser,9999);display:none}',
      '.chloe-zapped{animation:chloe-zap .9s ease-out}',
      '@keyframes chloe-zap{0%{filter:none}18%{filter:brightness(1.35) drop-shadow(0 0 18px var(--chloe-zap,#FFB2EF))}60%{filter:brightness(1.1) drop-shadow(0 0 10px var(--chloe-zap,#FFB2EF))}100%{filter:none}}',
      '@keyframes chloe-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
      '@keyframes chloe-bounce{from{transform:translate(-50%,0)}to{transform:translate(-50%,-25%)}}',
      '@media print{.chloe-layer,.chloe-laser{display:none!important}}',
      '@media (prefers-reduced-motion: reduce){.chloe-zzz,.chloe-bang{animation:none}.chloe-zapped{animation-duration:.01ms}}'
    ].join('');
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  var DEFAULT_QUIPS = [
    'Hi! I’m Chloé. I zap boring websites.',
    'Pro tip: collect ideas on Pinterest first. Future-you says thanks.',
    'Pick 4 colors from ColorHunt and you’re basically a designer.',
    'Hit “Enhance prompt”. It’s like a magic wand for words.',
    'Two AIs, one prompt. Let them compete, you pick the winner!',
    'GitHub Pages hosting is free. Free is my favorite price.',
    'A domain for about $12? That’s like two fancy coffees.',
    'You’re doing great. Seriously. Keep going!',
    'Boo! ...Did I scare you? No? Okay, rude.',
    'Teach this to your kids. They’ll build faster than you. Sorry!',
    'Pew pew! Found something shiny.',
    'Layout first, pretty later. Pretty always wins in the end.'
  ];
  var ZAP_QUIPS = ['Pew pew!', 'Zap!', 'Ooh, shiny.', 'Look here!', 'This part matters!', 'Pay attention to this one ✨'];

  var NO_TARGET_QUIPS = ['Nothing to zap here. Saving my laser!', 'Hmm, nothing shiny on this one.', 'Laser on standby.'];

  // Lasers only hit things a deck marks as targets. The fallback is decorative, non-text art
  // (stickers, icons, marked illustrations): never headlines, body copy or photo backgrounds.
  var DEFAULT_TARGET_SELECTOR = '[data-zap], [data-chloe-zap]';
  var FALLBACK_TARGET_SELECTOR = '[data-zap-fallback], .sticker, .icon, svg[aria-hidden="true"]:not(.chloe-layer svg)';

  function isVisibleTarget(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var vw = window.innerWidth, vh = window.innerHeight;
    if (r.right < 16 || r.bottom < 16 || r.left > vw - 16 || r.top > vh - 16) return false;
    var cs = window.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false;
    if (el.closest('.chloe-layer')) return false;
    return true;
  }
  /** Photo / full-bleed layers are never a target (the beam would land on a face). */
  function isPhotoLayer(el) {
    if (el.closest('[data-bleed], [data-chloe-nozap]')) return true;
    var r = el.getBoundingClientRect();
    return /^(IMG|VIDEO|PICTURE|CANVAS)$/.test(el.tagName) && r.width * r.height > window.innerWidth * window.innerHeight * 0.3;
  }

  function defaultTargets() {
    var scope = document;
    if (root.Deck && typeof root.Deck.current === 'function' && root.Deck.current()) scope = root.Deck.current();
    var ok = function (el) { return isVisibleTarget(el) && !isPhotoLayer(el); };
    var list = Array.prototype.slice.call(scope.querySelectorAll(DEFAULT_TARGET_SELECTOR)).filter(ok);
    if (!list.length) list = Array.prototype.slice.call(scope.querySelectorAll(FALLBACK_TARGET_SELECTOR)).filter(function (el) {
      return ok(el) && !/\S/.test(el.textContent || '') ; // decorative only: nothing with text in it
    });
    return list;
  }

  /* ---------------------------------------------------------------
     Perch finder: where to hover while firing so she never sits on
     text or anything marked [data-chloe-avoid].
     --------------------------------------------------------------- */
  var AVOID_SELECTOR = '.deck-hud, .deck-counter, body > nav, body > header';
  var HARD_AVOID_SELECTOR = '[data-chloe-avoid]';     // hard exclusion: never perch on it, never beam across it
  var STRONG_SELECTOR = '.stat, .annot, [data-count], .stat-num, .giant-num';
  var MEDIA_SELECTOR = 'img, video, canvas:not(.chloe-laser), svg[role=img], [role=img], button, a.btn, input, textarea, select';
  function isNarrow() { return hasDOM && (window.innerWidth < 700 || window.innerHeight < 420); }

  // opacity is ignored on purpose: content that is still fading in counts as an obstacle
  function elVisible(el) {
    if (!el) return false;
    if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true });
    var cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  /** Scopes whose contents count as obstacles: the live slide(s) in view, or the whole body. */
  function obstacleScopes() {
    var D = root.Deck;
    if (D && typeof D.current === 'function' && D.current()) {
      if (D.isPresenting) return [D.current()];
      var vh = window.innerHeight;
      var list = (D.slides || []).filter(function (s) { var r = s.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
      return list.length ? list : [D.current()];
    }
    return [document.body];
  }

  /**
   * Collect weighted rects (viewport px) Chloé should not cover.
   * Text line boxes weigh 1 (display type >= 60px and stats / annotations weigh 2), deck UI 1.4,
   * [data-chloe-avoid] 1000 (a hard exclusion), media/controls 0.35
   * (full-bleed backgrounds are skipped: they are behind everything anyway).
   */
  function collectObstacles() {
    var out = [], vw = window.innerWidth, vh = window.innerHeight;
    function push(q, w) {
      if (q.width < 2 || q.height < 2 || q.right < 0 || q.bottom < 0 || q.left > vw || q.top > vh) return;
      out.push({ l: q.left - 4, t: q.top - 4, r: q.right + 4, b: q.bottom + 4, w: w }); // 4px: reveal transforms still settling
    }
    var scopes = obstacleScopes();
    var rg = document.createRange();
    var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
    scopes.forEach(function (sc) {
      var tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT, null, false);
      var n = 0;
      while (tw.nextNode() && n < 4000) {
        var tn = tw.currentNode; n++;
        if (!/\S/.test(tn.nodeValue)) continue;
        var pe = tn.parentElement;
        if (!pe || pe.closest('svg, aside, script, style, noscript, .chloe-layer, [aria-hidden="true"] svg')) continue;
        var vis = seen ? seen.get(pe) : undefined;
        if (vis === undefined) {
          // computed font-size is in stage px (the stage is scaled with a transform), so 60 means display type
          vis = !elVisible(pe) ? 0 : ((parseFloat(window.getComputedStyle(pe).fontSize) || 16) >= 60 || pe.closest(STRONG_SELECTOR)) ? 2 : 1;
          if (seen) seen.set(pe, vis);
        }
        if (!vis) continue;
        rg.selectNodeContents(tn);
        var rs = rg.getClientRects();
        for (var i = 0; i < rs.length; i++) push(rs[i], vis);
      }
      Array.prototype.forEach.call(sc.querySelectorAll(MEDIA_SELECTOR), function (m) {
        if (m.closest('.chloe-layer')) return;
        var r = m.getBoundingClientRect();
        if (r.width * r.height > vw * vh * 0.45) return; // backgrounds / full-bleed
        if (!elVisible(m)) return;
        push(r, 0.35);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(AVOID_SELECTOR), function (a) {
      if (a.closest('.chloe-layer') || !elVisible(a)) return;
      push(a.getBoundingClientRect(), 1.4);
    });
    scopes.forEach(function (sc) {
      Array.prototype.forEach.call(sc.querySelectorAll(HARD_AVOID_SELECTOR), function (a) {
        if (a.closest('.chloe-layer') || !elVisible(a)) return;
        push(a.getBoundingClientRect(), 1000);
      });
    });
    return out;
  }

  /** Stage scale: 1 on a 1920x1080 viewport. */
  function viewK() { return hasDOM ? Math.max(0.4, Math.min(window.innerWidth / 1920, window.innerHeight / 1080)) : 1; }
  /** Length of segment (x0,y0)-(x1,y1) inside rect o (Liang-Barsky clip). */
  function segInRect(x0, y0, x1, y1, o) {
    var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy], q = [x0 - o.l, o.r - x0, y0 - o.t, o.b - y0];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return 0; continue; }
      var r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return 0; if (r > t0) t0 = r; }
      else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
    return (t1 - t0) * Math.sqrt(dx * dx + dy * dy);
  }

  function overlap(a, o) {
    var x = Math.min(a.r, o.r) - Math.max(a.l, o.l);
    if (x <= 0) return 0;
    var y = Math.min(a.b, o.b) - Math.max(a.t, o.t);
    return y > 0 ? x * y : 0;
  }

  /**
   * Choose a top-left for a W x H ghost near `tr` (target rect). Candidates ring the
   * target just outside its box at several gaps, plus viewport-margin fallbacks;
   * each is scored by weighted overlap with obstacles (+ the bubble zone above her)
   * with small tie-breakers for beam length. Least overlap wins.
   */
  function findPerch(tr, W, H, opts) {
    opts = opts || {};
    var vw = window.innerWidth, vh = window.innerHeight, K = viewK();
    // safe inset: never closer than 48 stage px to the screen edge (16px on phones)
    var m = opts.inset != null ? opts.inset : (isNarrow() ? 12 : Math.max(16, 48 * K));
    var top0 = opts.topInset || 0;
    var obs = opts.obstacles || collectObstacles();
    var cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
    var ideal = clamp(Math.max(tr.width, tr.height) * 0.5 + W * 1.6, 180, 520);
    // beams longer than this read as a stray line across the slide: approach first
    var maxBeam = opts.maxBeam != null ? opts.maxBeam : 700 * K;
    // text that belongs to the target itself does not count against the beam
    var tIn = function (o) { var ox = (o.l + o.r) / 2, oy = (o.t + o.b) / 2; return ox >= tr.left - 2 && ox <= tr.right + 2 && oy >= tr.top - 2 && oy <= tr.bottom + 2; };
    var cands = [];
    function add(x, y, kind) {
      x = clamp(x, m, vw - W - m);
      y = clamp(y, m + top0, vh - H - m);
      cands.push({ x: x, y: y, kind: kind });
    }
    if (!opts.edgesOnly) {
      var gaps = [W * 0.35, W * 0.9, W * 1.8, W * 3];
      for (var gi = 0; gi < gaps.length; gi++) {
        var hx = tr.width / 2 + gaps[gi] + W / 2, hy = tr.height / 2 + gaps[gi] + H / 2;
        for (var a = 0; a < 24; a++) {
          var ang = a / 24 * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
          // ray from centre to the inflated box edge
          var t = Math.min(Math.abs(dx) > 1e-6 ? hx / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-6 ? hy / Math.abs(dy) : 1e9);
          add(cx + dx * t - W / 2, cy + dy * t - H / 2, 'ring');
        }
      }
    }
    // margin fallbacks: left / right gutters and top / bottom bands
    for (var s = 0; s <= 8; s++) {
      var fy = m + top0 + (vh - H - 2 * m - top0) * s / 8;
      add(m, fy, 'edge'); add(vw - W - m, fy, 'edge');
      var fx = m + (vw - W - 2 * m) * s / 8;
      add(fx, m + top0, 'edge'); add(fx, vh - H - m, 'edge');
    }
    var area = W * H, best = null;
    var bw = Math.min(460 * K, vw * 0.6), bh = 96 * K; // speech bubble zone above her
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      // pad for the float bob + glow
      var box = { l: c.x - 6, t: c.y - (opts.bob || 10) - 2, r: c.x + W + 6, b: c.y + H + 4 };
      var bub = { l: c.x + W / 2 - bw * 0.8, t: c.y - bh - 18, r: c.x + W / 2 + bw * 0.2, b: c.y - 12 };
      var tgt = { l: tr.left, t: tr.top, r: tr.right, b: tr.bottom };
      var ov = overlap(box, tgt) * 3, bo = 0, bx = 0;
      var ex = c.x + W / 2, ey = c.y + H * 0.33;
      for (var j = 0; j < obs.length; j++) {
        var o = obs[j];
        // beam: what the eye-to-target line crosses (the target's own text excluded)
        if (o.w >= 1 && !tIn(o)) bx += segInRect(ex, ey, cx, cy, o) * Math.min(o.w, 4);
        if (o.r < bub.l && o.r < box.l) continue;
        if (o.l > box.r && o.l > bub.r) continue;
        ov += overlap(box, o) * o.w;
        bo += overlap(bub, o) * o.w;
      }
      var d = Math.sqrt((ex - cx) * (ex - cx) + (ey - cy) * (ey - cy));
      var score = ov / area * 10 + bo / (bw * bh) * 0.6 +
        bx / Math.max(1, W) * 0.8 +
        Math.abs(d - ideal) / ideal * 0.35 +
        (d > maxBeam ? (d - maxBeam) / maxBeam * 4 : 0) +
        (d < 110 ? 1 : 0) + (c.kind === 'edge' ? 0.15 : 0) +
        (ey > cy ? 0.05 : 0); // tiny preference for looking down on the target
      if (!best || score < best.score) best = { x: c.x, y: c.y, score: score, overlap: ov / area, beam: bx };
    }
    return best;
  }

  /**
   * Resting spot: the least-covered spot along the safe margins, preferring `pref`.
   * Returns {x, y, clean} (clean = covers no text).
   */
  function findRest(pref, W, H, m, top0) {
    var vw = window.innerWidth, vh = window.innerHeight, obs = collectObstacles(), best = null;
    var diag = Math.sqrt(vw * vw + vh * vh);
    var cands = [{ x: pref.x, y: pref.y }];
    for (var s = 0; s <= 10; s++) {
      var fy = m + top0 + (vh - H - 2 * m - top0) * s / 10, fx = m + (vw - W - 2 * m) * s / 10;
      cands.push({ x: m, y: fy }, { x: vw - W - m, y: fy }, { x: fx, y: vh - H - m }, { x: fx, y: m + top0 });
    }
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i], x = clamp(c.x, m, vw - W - m), y = clamp(c.y, m + top0, vh - H - m);
      var box = { l: x - 8, t: y - 12, r: x + W + 8, b: y + H + 8 }, ov = 0;
      for (var j = 0; j < obs.length; j++) ov += overlap(box, obs[j]) * obs[j].w;
      var d = Math.sqrt((x - pref.x) * (x - pref.x) + (y - pref.y) * (y - pref.y)) / diag;
      var sc = ov / (W * H) * 10 + d;
      if (!best || sc < best.score) best = { x: x, y: y, score: sc, clean: ov < 1 };
    }
    return best;
  }

  /* ---------------------------------------------------------------
     Laser layer (one per instance; canvas shown only while firing)
     --------------------------------------------------------------- */
  var MAX_LASER_PIXELS = 3840 * 2160; // cap backing store (4K budget)

  /* Optional brand palette for beams / orbs / sparks (Chloe.mount({ palette: ['#FFA300', '#F2541C', ...] })).
     Without one, every colour below is the original rainbow hsl() string, byte for byte. */
  function parseRGB(c) {
    if (Array.isArray(c)) return c.slice(0, 3);
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
    if (m) { var h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    if (hasDOM) { // any other CSS colour: let the browser resolve it
      var cv = document.createElement('canvas'); cv.width = cv.height = 1; var x = cv.getContext('2d');
      x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); var d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
    }
    return [255, 255, 255];
  }
  /** t in [0,1) walks the palette as a loop; lift mixes toward white (0..1). */
  function palColor(pal, t, lift, a) {
    var n = pal.length; t = ((t % 1) + 1) % 1;
    var f = t * n, i = Math.floor(f) % n, u = f - Math.floor(f), A = pal[i], B = pal[(i + 1) % n];
    var rgb = [0, 1, 2].map(function (k) { var v = A[k] + (B[k] - A[k]) * u; return Math.round(v + (255 - v) * (lift || 0)); });
    return a == null ? 'rgb(' + rgb.join(',') + ')' : 'rgba(' + rgb.join(',') + ',' + a + ')';
  }

  function LaserLayer(zIndex, palette) {
    this.pal = palette && palette.length ? palette.map(parseRGB) : null;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chloe-laser';
    this.canvas.setAttribute('aria-hidden', 'true');
    if (zIndex != null) this.canvas.style.zIndex = zIndex;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.hue = 0;
    this.w = 0; this.h = 0; this.scale = 1;
    this.sparks = [];
  }
  LaserLayer.prototype.fit = function () {
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = dpr();
    if (vw * vh * s * s > MAX_LASER_PIXELS) s = Math.sqrt(MAX_LASER_PIXELS / (vw * vh));
    if (vw !== this.w || vh !== this.h || s !== this.scale) {
      this.w = vw; this.h = vh; this.scale = s;
      this.canvas.width = Math.round(vw * s);
      this.canvas.height = Math.round(vh * s);
      this.canvas.style.width = vw + 'px';
      this.canvas.style.height = vh + 'px';
    }
  };
  LaserLayer.prototype.show = function (on) { this.canvas.style.display = on ? 'block' : 'none'; if (!on) this.clear(); };
  LaserLayer.prototype.clear = function () { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); };
  LaserLayer.prototype.burst = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(1.5, 5.5);
      this.sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 1, hue: rand(0, 360), size: Math.round(rand(2, 5)) });
    }
  };
  /**
   * Draw beams from eyes to target. Exact port of laser-beams.tsx drawing,
   * with k = ghost scale factor (1 at the original 64px sprite) and `power` (0..1) for charge-up.
   */
  LaserLayer.prototype.draw = function (eyes, target, k, power) {
    var ctx = this.ctx;
    this.fit();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.hue = (this.hue + 2) % 360;
    var hue = this.hue, pal = this.pal, H = hue / 360;
    var orbPulse = 1 + Math.sin(hue * 0.1) * 0.25;
    var i;
    if (target && power > 0) {
      for (i = 0; i < eyes.length; i++) {
        var ex = eyes[i].x, ey = eyes[i].y;
        var dx = target.x - ex, dy = target.y - ey;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        var px = -dy / len, py = dx / len;
        var pulse = 1 + Math.sin(hue * 0.08) * 0.3;
        var wEye = 7 * pulse * k * power;
        var wTgt = 1.5 * Math.max(1, k * 0.75) * power;
        var grad = ctx.createLinearGradient(ex, ey, target.x, target.y);
        for (var j = 0; j <= 6; j++) grad.addColorStop(j / 6, pal ? palColor(pal, (hue - j * 50 + 360) / 360, 0.08) : 'hsl(' + ((hue - j * 50 + 360) % 360) + ',100%,65%)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(ex + px * (wEye + 3 * k), ey + py * (wEye + 3 * k));
        ctx.lineTo(ex - px * (wEye + 3 * k), ey - py * (wEye + 3 * k));
        ctx.lineTo(target.x - px * (wTgt + 2 * k), target.y - py * (wTgt + 2 * k));
        ctx.lineTo(target.x + px * (wTgt + 2 * k), target.y + py * (wTgt + 2 * k));
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(ex + px * wEye, ey + py * wEye);
        ctx.lineTo(ex - px * wEye, ey - py * wEye);
        ctx.lineTo(target.x - px * wTgt, target.y - py * wTgt);
        ctx.lineTo(target.x + px * wTgt, target.y + py * wTgt);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // impact glow at target
      var ig = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 14 * k * orbPulse);
      ig.addColorStop(0, pal ? palColor(pal, H, 0.8, 0.85 * power) : 'hsla(' + hue + ',100%,92%,' + (0.85 * power) + ')');
      ig.addColorStop(0.4, pal ? palColor(pal, H + 1 / 6, 0.3, 0.35 * power) : 'hsla(' + ((hue + 60) % 360) + ',100%,70%,' + (0.35 * power) + ')');
      ig.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(target.x, target.y, 14 * k * orbPulse, 0, Math.PI * 2); ctx.fill();
    }
    // eye orbs ON TOP of beams
    if (power > 0) {
      for (i = 0; i < eyes.length; i++) {
        var x = eyes[i].x, y = eyes[i].y, R = 16 * orbPulse * k * (0.4 + 0.6 * power), r0 = 6 * orbPulse * k * (0.4 + 0.6 * power);
        var halo = ctx.createRadialGradient(x, y, 0, x, y, R);
        halo.addColorStop(0, pal ? palColor(pal, H, 0.6, 0.6) : 'hsla(' + hue + ',100%,85%,0.6)');
        halo.addColorStop(0.3, pal ? palColor(pal, H + 1 / 6, 0.3, 0.3) : 'hsla(' + ((hue + 60) % 360) + ',100%,70%,0.3)');
        halo.addColorStop(0.6, pal ? palColor(pal, H + 1 / 3, 0.1, 0.1) : 'hsla(' + ((hue + 120) % 360) + ',100%,60%,0.1)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        var core = ctx.createRadialGradient(x, y, 0, x, y, r0);
        core.addColorStop(0, pal ? palColor(pal, H, 0.9, 1) : 'hsla(' + hue + ',100%,95%,1)');
        core.addColorStop(0.5, pal ? palColor(pal, H, 0.5, 0.9) : 'hsla(' + hue + ',100%,80%,0.9)');
        core.addColorStop(1, pal ? palColor(pal, H + 1 / 9, 0.08, 0.4) : 'hsla(' + ((hue + 40) % 360) + ',100%,65%,0.4)');
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // pixel sparks
    for (i = this.sparks.length - 1; i >= 0; i--) {
      var p = this.sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.028;
      if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = pal ? palColor(pal, p.hue / 360, 0.2) : 'hsl(' + p.hue + ',100%,70%)';
      var sz = p.size * Math.max(1, k * 0.6);
      ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
    }
    ctx.globalAlpha = 1;
  };

  /* ---------------------------------------------------------------
     Chloé instance
     --------------------------------------------------------------- */
  var instances = [];

  function ChloeInstance(opts) {
    this.o = Object.assign({
      container: document.body,
      targets: null,               // () => Element[]
      interval: [20000, 30000],    // auto-laser interval (ms or [min,max]); 0/false disables
      firstZap: null,              // ms before the first auto zap (default: random in interval)
      size: 'auto',                // css px width, or 'auto' = clamp(72, 5vw, 160)
      home: 'bottom-right',        // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | {x,y}
      roam: 57000,                 // roam (3 darts + settle) every N ms; 0 disables
      sleepAfter: 0,               // fall asleep after N ms without interaction; 0 disables
      quips: DEFAULT_QUIPS,
      zapQuips: ZAP_QUIPS,
      zapQuipChance: 0.35,
      name: 'Chloé',
      palette: null,               // optional laser colours, e.g. ['#FFA300','#F2541C','#16BFFF']; null = original rainbow
      glow: null,                  // optional glow colour behind her + bubble halo (any CSS colour); null = original pink
      ring: null,                  // optional bubble ring colour; null = var(--gs-base)
      spriteColors: null,          // optional partial override of Chloe.COLORS for the floating sprite
      hotkey: 'l',                 // press to fire a laser at a random target; null disables
      zIndex: null,
      topInset: 0,                 // px at the top she should not perch in (fixed nav)
      flash: true,                 // add .chloe-zapped to the target while it's hit
      approach: true,              // fly near the target before firing
      state: 'idle',
      safeInset: 48,               // stage px she keeps from the screen edge at rest (string homes, roam, perches)
      presentSize: 128,            // size:'auto' in a deck's present mode, in stage px (reads from the back row)
      blink: 'brief',              // 'brief' = open eyes with a quick blink every few seconds; 'classic' = original 2s cycle; false = never
      shadow: false,               // drop shadow + pink under-glow so she reads on light surfaces
      cancelOnSlideChange: true,   // a deck:change kills a laser that is planned or drawing on the old slide
      followDeck: false,           // re-park on every slide (data-chloe-rest="x,y" stage px), hide on [data-chloe-hide]
      revealDelay: 1400,           // ms after a slide change before auto zaps / her return (lets the slide build in)
      noTargetQuips: NO_TARGET_QUIPS
    }, opts || {});
    this.reduced = reducedMotion();
    this.state = this.o.state;
    this.frame = 0;
    this.flipped = false;
    this.pos = { x: 0, y: 0 };
    this.tween = null;
    this.zapping = false;
    this.laserTarget = null;
    this.laserPower = 0;
    this.timers = [];
    this.lastInteraction = Date.now();
    this.stateTimer = null;
    this._slideAt = 0;
    this._zapToken = 0;
    this._build();
    this._bind();
    if (root.Deck && root.Deck.current) { this._lastSlide = root.Deck.current(); var s0 = this._lastSlide; if (s0 && s0.hasAttribute('data-chloe-hide')) this.layer.classList.add('is-hidden'); }
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
    this._schedule();
  }

  ChloeInstance.prototype._build = function () {
    injectStyle();
    var layer = document.createElement('div');
    layer.className = 'chloe-layer';
    layer.setAttribute('data-deck-ui', '');
    if (this.o.zIndex != null) layer.style.zIndex = this.o.zIndex;
    var el = document.createElement('div');
    el.className = 'chloe' + (this.o.shadow ? ' has-shadow' : '');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', this.o.name + ' the ghost');
    el.setAttribute('tabindex', '-1');
    var glow = document.createElement('div');
    glow.className = 'chloe-glow';
    var cv = document.createElement('canvas');
    el.appendChild(glow);
    el.appendChild(cv);
    var bubble = document.createElement('div');
    bubble.className = 'chloe-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    layer.appendChild(el);
    layer.appendChild(bubble);
    var host = this.o.container === document.body || !this.o.container ? document.body : this.o.container;
    host.appendChild(layer);
    this.layer = layer; this.el = el; this.canvas = cv; this.glow = glow; this.bubble = bubble;
    this.ctx = cv.getContext('2d');
    this.laser = new LaserLayer(this.o.zIndex != null ? this.o.zIndex + 1 : null, this.o.palette);
    // optional theming of the DOM glow / bubble ring (CSS custom properties; unset = original pink)
    if (this.o.glow) layer.style.setProperty('--chloe-glow-rgb', parseRGB(this.o.glow).join(','));
    if (this.o.ring) layer.style.setProperty('--chloe-ring', this.o.ring);
    this._resize(true);
  };

  /** Size in CSS px, quantized so each sprite pixel is an integer number of DEVICE pixels. */
  ChloeInstance.prototype._resize = function (initial) {
    // phones: keep her small (about 48px) so she stays out of the content
    var D = root.Deck, want;
    if (this.o.size !== 'auto') want = +this.o.size;
    else if (isNarrow()) want = clamp(window.innerWidth * 0.12, 44, 56);
    else if (D && D.isPresenting) want = clamp(this.o.presentSize * viewK(), 72, 320); // 128px on a 1920 stage, 256 at 4K
    else want = clamp(window.innerWidth * 0.05, 72, 160);
    var d = dpr();
    var cell = Math.max(1, Math.round(want * d / GRID_W));
    this.cell = cell;
    this.cssW = cell * GRID_W / d;
    this.cssH = cell * GRID_H / d;
    this.k = this.cssW / 64; // relative to original 64px sprite
    this.canvas.width = GRID_W * cell;
    this.canvas.height = GRID_H * cell;
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    this.el.style.width = this.cssW + 'px';
    this.el.style.height = this.cssH + 'px';
    this._lastDrawKey = '';
    var h = this._home();
    if (initial) { this.pos = h; }
    else if (!this.tween) { this.pos = { x: clamp(this.pos.x, 0, window.innerWidth - this.cssW), y: clamp(this.pos.y, 0, window.innerHeight - this.cssH) }; }
  };

  ChloeInstance.prototype._home = function () {
    var vw = window.innerWidth, vh = window.innerHeight;
    var m = isNarrow() ? 12 : Math.max(16, (this.o.safeInset || 0) * viewK());
    var h = this.o.home;
    if (h && typeof h === 'object') return { x: h.x, y: h.y };
    // followDeck: the current slide's authored rest spot, else the least-covered spot near the home corner
    var rest = this.o.followDeck ? this._slideRest() : null;
    if (rest) return rest;
    var x = (h + '').indexOf('left') >= 0 ? m : vw - this.cssW - m;
    var y = (h + '').indexOf('top') >= 0 ? m + (this.o.topInset || 0) : vh - this.cssH - m;
    // keep clear of the deck HUD in the bottom-right corner
    var D = root.Deck, hr = D && D.hudRect ? D.hudRect() : null;
    if (hr && (h + '').indexOf('top') < 0 && x + this.cssW > hr.left - 8) y = Math.min(y, hr.top - this.cssH - 16);
    if (this.o.followDeck && !isNarrow()) {
      try { var p = findRest({ x: x, y: y }, this.cssW, this.cssH, m, this.o.topInset || 0); if (p) return p; } catch (e) {}
    }
    return { x: x, y: y };
  };

  /** data-chloe-rest="x,y" on the current slide (stage px, top-left of the sprite) -> viewport px. */
  ChloeInstance.prototype._slideRest = function () {
    var D = root.Deck, sec = D && D.current && D.current();
    var v = sec && sec.getAttribute('data-chloe-rest');
    if (!v || isNarrow()) return null;
    var xy = v.split(',').map(parseFloat);
    if (xy.length !== 2 || isNaN(xy[0]) || isNaN(xy[1])) return null;
    var st = sec.querySelector('.deck-stage') || sec, r = st.getBoundingClientRect(), k = r.width / 1920 || 1;
    if (D.isPresenting) { k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); r = { left: (window.innerWidth - 1920 * k) / 2, top: (window.innerHeight - 1080 * k) / 2 }; }
    var m = Math.max(12, (this.o.safeInset || 0) * k);
    return { x: clamp(r.left + xy[0] * k, m, window.innerWidth - this.cssW - m), y: clamp(r.top + xy[1] * k, m, window.innerHeight - this.cssH - m) };
  };

  ChloeInstance.prototype._bind = function () {
    var self = this;
    var drag = null;
    this._onDown = function (e) {
      e.preventDefault();
      self._touch();
      drag = { sx: e.clientX, sy: e.clientY, ox: self.pos.x, oy: self.pos.y, moved: false, id: e.pointerId };
      try { self.el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    this._onMove = function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!drag.moved) { drag.moved = true; self.tween = null; self.setState('mischief'); }
      self.flipped = e.movementX < 0 ? true : e.movementX > 0 ? false : self.flipped;
      self.pos = { x: drag.ox + dx, y: drag.oy + dy };
    };
    this._onUp = function () {
      if (!drag) return;
      var was = drag; drag = null;
      if (was.moved) {
        self.o.home = { x: self.pos.x, y: self.pos.y };
        self.setState('smug', 1500);
      } else {
        self.setState(pick(['celebrating', 'chat', 'mischief']), 2600);
        self.say(pick(self.o.quips), 0, { force: true });
      }
    };
    this._onDbl = function () { self.zap(); };
    this.el.addEventListener('pointerdown', this._onDown);
    this.el.addEventListener('pointermove', this._onMove);
    this.el.addEventListener('pointerup', this._onUp);
    this.el.addEventListener('pointercancel', this._onUp);
    this.el.addEventListener('dblclick', this._onDbl);
    this._onResize = function () { self._resize(false); };
    window.addEventListener('resize', this._onResize);
    // react to DPR changes (moving between displays / zoom)
    this._watchDpr = function () {
      if (!window.matchMedia) return;
      var mq = window.matchMedia('(resolution: ' + dpr() + 'dppx)');
      var fn = function () { self._resize(false); self._watchDpr(); };
      if (mq.addEventListener) mq.addEventListener('change', fn, { once: true });
    };
    this._watchDpr();
    this._onKey = function (e) {
      if (!self.o.hotkey || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key && e.key.toLowerCase() === self.o.hotkey) { e.preventDefault(); self.zap(); }
    };
    window.addEventListener('keydown', this._onKey);
    this._onAct = function () { self._touch(); };
    window.addEventListener('pointermove', this._onAct, { passive: true });
    window.addEventListener('keydown', this._onAct, { passive: true });
    // deck integration (works with deck.js; harmless without it)
    this._onDeck = function (e) {
      var d = e.detail || {}, sec = d.slide;
      self.layer.classList.toggle('is-hidden', !!(sec && sec.hasAttribute && sec.hasAttribute('data-chloe-hide')));
      if (sec === self._lastSlide) return;
      self._lastSlide = sec;
      self._slideAt = Date.now();
      if (self.o.cancelOnSlideChange) self.cancel();
      if (self.o.followDeck) {
        self.bubble.classList.remove('is-on');
        // she fades while the slide builds in, then lands on the new slide's rest spot
        self.el.classList.add('is-away');
        clearTimeout(self._followT);
        self._followT = setTimeout(function () {
          var h = self._home();
          self.moveTo(h.x, h.y, 0);
          self.el.classList.remove('is-away');
          self._dimCheck();
        }, self.reduced ? 0 : Math.min(self.o.revealDelay, 900));
      }
    };
    this._onDeckMode = function () { self._resize(false); if (self.o.followDeck) { var h = self._home(); self.moveTo(h.x, h.y, 0); } };
    document.addEventListener('deck:change', this._onDeck);
    document.addEventListener('deck:mode', this._onDeckMode);
    // phones: whenever the page settles, dim her if she sits over copy
    this._onScrollDim = function () { if (!isNarrow()) return; clearTimeout(self._dimT); self._dimT = setTimeout(function () { self._dimCheck(); }, 250); };
    window.addEventListener('scroll', this._onScrollDim, { passive: true });
  };

  /** Phones: dim her when her spot covers copy (she never blocks reading). */
  ChloeInstance.prototype._dimCheck = function () {
    if (!isNarrow()) { this.el.classList.remove('is-dim'); return; }
    var box = { l: this.pos.x, t: this.pos.y, r: this.pos.x + this.cssW, b: this.pos.y + this.cssH }, ov = 0;
    try { collectObstacles().forEach(function (o) { if (o.w >= 1 && o.w < 100) ov += overlap(box, o); }); } catch (e) {}
    this.el.classList.toggle('is-dim', ov > 40);
  };

  ChloeInstance.prototype._touch = function () {
    this.lastInteraction = Date.now();
    if (this.state === 'sleeping') this.setState('idle');
  };

  ChloeInstance.prototype._later = function (fn, ms) {
    var self = this;
    var id = setTimeout(function () { self.timers = self.timers.filter(function (t) { return t !== id; }); fn(); }, ms);
    this.timers.push(id);
    return id;
  };

  ChloeInstance.prototype._interval = function () {
    var iv = this.o.interval;
    if (!iv) return 0;
    return Array.isArray(iv) ? rand(iv[0], iv[1]) : iv;
  };

  ChloeInstance.prototype._schedule = function () {
    var self = this;
    if (this.reduced) return; // reduced motion: lasers on demand only, no roaming
    var first = this.o.firstZap != null ? this.o.firstZap : this._interval();
    if (first) {
      var tick = function () {
        // never fire into a slide that is still building in
        var wait = self.o.revealDelay - (Date.now() - self._slideAt);
        if (wait > 0) { self._later(tick, wait + 50); return; }
        if (!document.hidden && !self.zapping && self.state !== 'sleeping') self.zap(null, { auto: true });
        var n = self._interval();
        if (n) self._later(tick, n);
      };
      this._later(tick, first);
    }
    if (this.o.roam) {
      var roamTick = function () {
        if (!document.hidden && !self.zapping && self.state !== 'sleeping') self.roam();
        self._later(roamTick, self.o.roam);
      };
      this._later(roamTick, this.o.roam);
    }
    if (this.o.sleepAfter) {
      this._sleepIv = setInterval(function () {
        if (!self.zapping && self.state === 'idle' && Date.now() - self.lastInteraction > self.o.sleepAfter) self.setState('sleeping');
      }, 1000);
    }
  };

  /** Set sprite state; optional duration returns to idle. */
  ChloeInstance.prototype.setState = function (s, ms) {
    if (STATES.indexOf(s) < 0) s = 'idle';
    this.state = s;
    this.el.setAttribute('data-state', s);
    this._overlays();
    if (this.stateTimer) { clearTimeout(this.stateTimer); this.stateTimer = null; }
    var self = this;
    if (ms) this.stateTimer = setTimeout(function () { self.stateTimer = null; if (!self.zapping) self.setState('idle'); }, ms);
    return this;
  };

  ChloeInstance.prototype._overlays = function () {
    var z = this.el.querySelector('.chloe-zzz'), b = this.el.querySelector('.chloe-bang');
    var cellCss = this.cssW / GRID_W;
    if (this.state === 'sleeping' && !z) {
      z = document.createElement('div'); z.className = 'chloe-zzz'; z.setAttribute('aria-hidden', 'true');
      z.style.fontSize = (cellCss * 5) + 'px';
      z.innerHTML = 'z<span style="font-size:1.4em">z</span><span style="font-size:1.8em">z</span>';
      this.el.appendChild(z);
    } else if (this.state !== 'sleeping' && z) z.remove();
    if (this.state === 'found' && !b) {
      b = document.createElement('div'); b.className = 'chloe-bang'; b.setAttribute('aria-hidden', 'true');
      b.style.fontSize = (cellCss * 8) + 'px'; b.textContent = '!';
      this.el.appendChild(b);
    } else if (this.state !== 'found' && b) b.remove();
  };

  /**
   * Speech bubble. The whole line is laid out (invisibly) before the box opens, so it never grows
   * while typing and its final rect is known up front.
   * opts: instant (bool; default true in a deck's present mode), place ('a' above-left | 'ar' above-right |
   *       'l' | 'r' | 'b' below-left | 'br'; or an array in order of preference), free (no box, marker type),
   *       avoid (rect => bool: return true to reject a placement, e.g. over your headline).
   *       force (show on the least-covered side even when every side covers text; used when she is clicked).
   * With no clean placement she stays quiet (this.lastSay === false).
   */
  ChloeInstance.prototype.say = function (text, ms, opts) {
    var self = this;
    opts = opts || {};
    if (!text) return this;
    var D = root.Deck;
    var instant = opts.instant != null ? opts.instant : !!(D && D.isPresenting);
    var b = this.bubble;
    b.classList.toggle('is-free', !!opts.free);
    b.innerHTML = '<span class="chloe-who">' + this.o.name + '</span><span class="chloe-text"><span class="ct-ghost"></span><span class="ct-live"></span></span>';
    b.querySelector('.ct-ghost').textContent = text;
    var t = b.querySelector('.ct-live');
    // choose the side before showing anything
    var order = opts.place ? [].concat(opts.place) : null;
    this._sayOpts = { order: order, avoid: opts.avoid, force: !!opts.force };
    this._bubPlace = this._pickPlace(order, opts.avoid, opts.force);
    this.lastSay = !!this._bubPlace;
    if (!this._bubPlace) { b.classList.remove('is-on'); return this; }
    b.setAttribute('data-place', this._bubPlace);
    this._placeBubble();
    if (this._typeIv) clearInterval(this._typeIv);
    if (this.reduced || instant) t.textContent = text;
    else {
      var i = 0;
      t.textContent = '';
      var step = Math.max(1, Math.ceil(text.length / 40)); // the whole line lands within about a second
      this._typeIv = setInterval(function () {
        i += step; t.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(self._typeIv); self._typeIv = null; }
      }, 22);
    }
    b.classList.add('is-on'); // text is already set: the box never flashes empty
    if (this._sayT) clearTimeout(this._sayT);
    this._sayT = setTimeout(function () { b.classList.remove('is-on'); }, ms || Math.max(3200, 1800 + text.length * 55));
    return this;
  };

  var PLACES = ['a', 'ar', 'l', 'r', 'b', 'br'];
  /** Bubble rect (viewport px) for a placement with the sprite at (x, y). */
  ChloeInstance.prototype._bubbleRect = function (pl, x, y) {
    var bw = this.bubble.offsetWidth, bh = this.bubble.offsetHeight, W = this.cssW, H = this.cssH, g = 18 * Math.max(0.6, viewK()), l, t;
    if (pl === 'l' || pl === 'r') { l = pl === 'l' ? x - bw - g : x + W + g; t = y + H * 0.45 - bh / 2; }
    else { l = x + W / 2 - bw * (pl === 'ar' || pl === 'br' ? 0.2 : 0.8); t = (pl === 'b' || pl === 'br') ? y + H + g : y - bh - g; }
    return { l: l, t: t, r: l + bw, b: t + bh, w: bw, h: bh };
  };
  /** First placement that fits inside the safe frame and passes `avoid`; else the least-covered one (or null with avoid). */
  ChloeInstance.prototype._pickPlace = function (order, avoid, force) {
    order = (order || []).concat(PLACES.filter(function (p) { return (order || []).indexOf(p) < 0; }));
    var vw = window.innerWidth, vh = window.innerHeight, m = isNarrow() ? 8 : Math.max(12, 48 * viewK());
    var obs = null, best = null;
    // while she is flying, choose for where she will land
    var at = this.tween ? { x: this.tween.tx, y: this.tween.ty } : this.pos;
    for (var i = 0; i < order.length; i++) {
      var q = this._bubbleRect(order[i], at.x, at.y);
      if (q.l < m || q.t < m || q.r > vw - m || q.b > vh - m) continue;
      if (avoid) { if (!avoid(q, order[i])) return order[i]; continue; }
      if (!obs) { try { obs = collectObstacles(); } catch (e) { obs = []; } }
      var ov = 0;
      for (var j = 0; j < obs.length; j++) ov += overlap(q, obs[j]) * obs[j].w;
      if (ov < 1) return order[i];
      if (!best || ov < best.ov) best = { pl: order[i], ov: ov };
    }
    if (avoid) return null;
    // no clean side: stay quiet rather than cover copy (a line she was clicked for still shows)
    return force ? (best ? best.pl : 'a') : null;
  };
  /** Position the open bubble next to her current (drawn) spot, clamped inside the safe frame. */
  ChloeInstance.prototype._placeBubble = function (x, y) {
    var b = this.bubble, pl = this._bubPlace || 'a';
    if (x == null) { x = this.pos.x; y = this.pos.y; }
    var vw = window.innerWidth, vh = window.innerHeight;
    var m = isNarrow() ? 8 : Math.max(12, 48 * viewK());
    var self = this, ghost = { l: x - 4, t: y - 4, r: x + this.cssW + 4, b: y + this.cssH + 4 };
    var fit = function (p) {
      var q = self._bubbleRect(p, x, y);
      var l = clamp(q.l, m, Math.max(m, vw - m - q.w)), t = clamp(q.t, m, Math.max(m, vh - m - q.h));
      return { q: q, l: l, t: t, hit: overlap({ l: l, t: t, r: l + q.w, b: t + q.h }, ghost) > 0 };
    };
    var f = fit(pl);
    // the safe-frame clamp must never push the bubble onto her: switch sides when it would
    if (f.hit && this._sayOpts) { // only for lines opened by this say() (decks that place their own bubble keep their side)
      for (var i = 0; i < PLACES.length; i++) {
        var g = fit(PLACES[i]);
        if (!g.hit) { f = g; pl = PLACES[i]; this._bubPlace = pl; b.setAttribute('data-place', pl); break; }
      }
    }
    var q = f.q, l = f.l, t = f.t;
    if (pl !== 'l' && pl !== 'r') {
      var tail = clamp((x + this.cssW / 2 - l) / Math.max(1, q.w), 0.08, 0.92);
      b.style.setProperty('--tail', (tail * 100) + '%');
      b.style.setProperty('--ox', (tail * 100) + '%');
    }
    b.style.left = snap(l) + 'px';
    b.style.top = snap(t) + 'px';
  };
  /** The rect the bubble would take for `text` (viewport px), without showing it. */
  ChloeInstance.prototype.measureSay = function (text, place) {
    var b = this.bubble, was = b.innerHTML;
    b.innerHTML = '<span class="chloe-who">' + this.o.name + '</span><span class="chloe-text"><span class="ct-ghost"></span></span>';
    b.querySelector('.ct-ghost').textContent = text;
    var r = this._bubbleRect(place || this._pickPlace(null, null), this.pos.x, this.pos.y);
    b.innerHTML = was;
    return r;
  };

  /** Tween to (x,y) in viewport px. Returns Promise. */
  ChloeInstance.prototype.moveTo = function (x, y, dur) {
    var self = this;
    x = clamp(x, 4, window.innerWidth - this.cssW - 4);
    y = clamp(y, 4, window.innerHeight - this.cssH - 4);
    if (Math.abs(x - this.pos.x) > 2) this.flipped = x < this.pos.x;
    if (this.reduced || dur === 0) { this.pos = { x: x, y: y }; this.tween = null; if (isNarrow() && this._onScrollDim) this._onScrollDim(); return Promise.resolve(); }
    return new Promise(function (resolve) {
      self.tween = { fx: self.pos.x, fy: self.pos.y, tx: x, ty: y, t0: performance.now(), d: dur || 1800, done: resolve };
    });
  };

  /** Roam: 3 fast darts across the upper viewport, then settle home (faithful to screenmate). */
  ChloeInstance.prototype.roam = function () {
    var self = this, vw = window.innerWidth, vh = window.innerHeight;
    if (this.reduced || isNarrow()) return Promise.resolve(); // no darting across content on phones
    var m = Math.max(16, (this.o.safeInset || 0) * viewK());
    var dart = function () { return self.moveTo(rand(m, vw - self.cssW - m), rand(m + (self.o.topInset || 0), Math.max(m, vh * 0.55 - self.cssH)), 1400); };
    return dart().then(dart).then(dart).then(function () { var h = self._home(); return self.moveTo(h.x, h.y, 1800); });
  };

  ChloeInstance.prototype.home = function () { var h = this._home(); return this.moveTo(h.x, h.y); };
  ChloeInstance.prototype.sleep = function () { return this.setState('sleeping'); };
  ChloeInstance.prototype.wake = function () { this._touch(); return this.setState('idle'); };

  /** Eye centers in viewport px (tracks the live canvas rect, like laser-beams.tsx). */
  ChloeInstance.prototype._eyes = function () {
    var r = this.canvas.getBoundingClientRect();
    var cols = this.flipped ? [GRID_W - 9.5, GRID_W - 21.5] : [9.5, 21.5];
    var y = r.top + (14 / GRID_H) * r.height;
    return [{ x: r.left + cols[0] / GRID_W * r.width, y: y }, { x: r.left + cols[1] / GRID_W * r.width, y: y }];
  };

  ChloeInstance.prototype._targets = function () {
    var list = typeof this.o.targets === 'function' ? this.o.targets() : this.o.targets;
    if (!list || !list.length) list = defaultTargets();
    return Array.prototype.slice.call(list).filter(isVisibleTarget);
  };

  /**
   * Fire lasers at an element (or a random visible target). Returns a Promise that
   * resolves when the sweep finishes. Sequence: approach -> lock 500ms -> sweep 1.2s.
   */
  ChloeInstance.prototype.zap = function (el, opts) {
    var self = this;
    opts = opts || {};
    if (this.zapping) return this._zapPromise;
    if (!el) el = pick(this._targets());
    if (!el || !el.getBoundingClientRect) {
      // a pressed key is never dead: a wiggle and a quip instead of a beam (auto zaps stay silent)
      if (!opts.auto && !opts.silent) {
        this.setState('mischief', 1400);
        if (!this.reduced && this.canvas.animate) this.canvas.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }], { duration: 620, easing: 'ease-in-out' });
        if (this.o.noTargetQuips && this.o.noTargetQuips.length) this.say(pick(this.o.noTargetQuips), 2600, { force: true });
      }
      return Promise.resolve(false);
    }
    this.zapping = true;
    this._ownZap = true;
    var token = ++this._zapToken;
    var D = root.Deck, slideAt = D && D.current ? D.current() : null;
    // the laser dies if the slide changes, the target leaves the page, or cancel() is called
    var stale = function () {
      if (token !== self._zapToken) return true;
      if (!el.isConnected || !el.getClientRects().length) return true;
      return !!(slideAt && D.current() !== slideAt && D.isPresenting);
    };
    this._touch();
    var vw = window.innerWidth, vh = window.innerHeight;
    var p = Promise.resolve();
    var approach = opts.approach != null ? opts.approach : this.o.approach;
    if (approach) {
      // perch where she covers the least text / [data-chloe-avoid] (margins as fallback)
      var perch = null;
      try {
        perch = findPerch(el.getBoundingClientRect(), this.cssW, this.cssH, { edgesOnly: isNarrow(), topInset: this.o.topInset || 0, bob: 8 * this.k });
      } catch (err) { perch = null; }
      this.lastPerch = perch;
      if (perch) p = this.moveTo(perch.x, perch.y, 1100);
    }
    this._zapPromise = p.then(function () {
      return new Promise(function (resolve) {
        if (stale()) { self._endZap(token); resolve(false); return; }
        self.setState('scanning');
        self.laser.show(true);
        if (self.o.flash) { el.classList.remove('chloe-zapped'); void el.offsetWidth; el.classList.add('chloe-zapped'); }
        if (Math.random() < self.o.zapQuipChance && !opts.silent) self.say(pick(self.o.zapQuips), 1800);
        var t0 = performance.now(), LOCK = self.reduced ? 700 : 500, SWEEP = self.reduced ? 0 : 1200;
        var lastBurst = 0;
        var step = function (now) {
          if (stale()) { self._endZap(token); resolve(false); return; }
          var r = el.getBoundingClientRect();
          var t = now - t0;
          var cyy = r.top + r.height / 2;
          var sweepW = Math.min(r.width * 0.9, 900);
          var startX = r.left + (r.width - sweepW) / 2;
          var tgt, power = 1;
          if (t < LOCK) {
            tgt = { x: r.left + r.width / 2, y: cyy };
            power = Math.min(1, t / 180);
          } else if (t < LOCK + SWEEP) {
            var tt = (t - LOCK) / SWEEP;
            if (tt < 0.7) {
              tgt = { x: startX + easeOutQuad(tt / 0.7) * sweepW, y: cyy };
            } else {
              var pp = (tt - 0.7) / 0.3, e2 = pp * pp;
              tgt = { x: startX + sweepW + e2 * 30 * self.k, y: cyy - e2 * 50 * self.k };
              power = 1 - pp * 0.6;
            }
          } else {
            self.laserTarget = null;
            self.laser.show(false);
            self.laser.sparks = [];
            self.zapping = false;
            self._ownZap = false;
            self.setState('celebrating', 1400);
            if (approach && !opts.stay) self._later(function () { if (!self.zapping && !self.tween) self.home(); }, 1600);
            resolve(true);
            return;
          }
          if (!self.reduced && now - lastBurst > 45) { self.laser.burst(tgt.x, tgt.y, 3); lastBurst = now; }
          self.laserTarget = tgt; self.laserPower = power;
          self.flipped = false; // symmetric eyes; keep face forward while firing
          self.laser.draw(self._eyes(), tgt, self.k, power);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    });
    return this._zapPromise;
  };

  /** Stop a laser this instance started (planned or drawing). Safe to call any time. */
  ChloeInstance.prototype.cancel = function () {
    if (!this._ownZap) return this;
    this._zapToken++;
    this._endZap(this._zapToken);
    return this;
  };
  ChloeInstance.prototype._endZap = function (token) {
    if (token !== this._zapToken && this._ownZap) return;
    this.laserTarget = null;
    this.laser.show(false);
    this.laser.sparks = [];
    this.zapping = false;
    this._ownZap = false;
    if (this.state === 'scanning') this.setState('idle');
  };

  ChloeInstance.prototype._loop = function (now) {
    this.raf = requestAnimationFrame(this._loop);
    // frame counter: 500ms per frame (blink + tail wave). Frame 0 while firing (no blink).
    var f = this.zapping ? 0 : Math.floor(now / 500) % 8;
    // tween
    if (this.tween) {
      var tw = this.tween, p = clamp((now - tw.t0) / tw.d, 0, 1), e = easeOutBack(p);
      this.pos = { x: tw.fx + (tw.tx - tw.fx) * e, y: tw.fy + (tw.ty - tw.fy) * e };
      if (p >= 1) {
        this.tween = null; tw.done();
        if (isNarrow()) this._onScrollDim();
        // landed somewhere new with a line open: re-pick the clean side (or close it)
        if (this.bubble.classList.contains('is-on') && this._sayOpts) {
          var pl = this._pickPlace(this._sayOpts.order, this._sayOpts.avoid, this._sayOpts.force);
          if (pl) { this._bubPlace = pl; this.bubble.setAttribute('data-place', pl); } else this.bubble.classList.remove('is-on');
        }
      }
    }
    // float (ghost-float: 3s, -8px at 64px sprite) + shake for 'found'
    var fy = 0, fx = 0;
    if (!this.reduced) {
      if (this.state === 'idle' || this.state === 'celebrating' || this.state === 'sleeping' || this.state === 'chat' || this.state === 'smug' || this.state === 'mischief' || this.state === 'scanning')
        fy = -(1 - Math.cos(now / 3000 * Math.PI * 2)) / 2 * 8 * this.k;
      if (this.state === 'found') fx = Math.sin(now / 300 * Math.PI * 2) * 4 * this.k;
    }
    var x = snap(this.pos.x + fx), y = snap(this.pos.y + fy);
    this.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    // redraw sprite only when something changed
    // idle face: open eyes with a quick blink every ~4.5s (the original 2s cycle reads as sleepy on a projector)
    if (this.state === 'idle' && this.o.blink !== 'classic') {
      var blinking = this.o.blink && !this.reduced && (now % 4500) < 160;
      if (blinking) f = 3;
      else if (f % 4 === 3) f = (f + 7) % 8;
    }
    var key = this.state + '|' + f + '|' + this.flipped + '|' + this.cell;
    if (key !== this._lastDrawKey) {
      this._lastDrawKey = key;
      drawGrid(this.ctx, getStateGrid(this.state, f), this.cell, this.flipped, this.o.spriteColors);
    }
    // bubble follows Chloé on the side chosen when it opened, inside the safe frame
    if (this.bubble.classList.contains('is-on')) this._placeBubble(x, y);
  };

  ChloeInstance.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    if (this._sleepIv) clearInterval(this._sleepIv);
    if (this._typeIv) clearInterval(this._typeIv);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('pointermove', this._onAct);
    window.removeEventListener('keydown', this._onAct);
    document.removeEventListener('deck:change', this._onDeck);
    document.removeEventListener('deck:mode', this._onDeckMode);
    window.removeEventListener('scroll', this._onScrollDim);
    clearTimeout(this._followT);
    this.layer.remove();
    this.laser.canvas.remove();
    instances = instances.filter(function (i) { return i !== this; }, this);
  };

  /* ---------------------------------------------------------------
     Embeddable sprite (for inside slides). SVG by default = vector crisp
     at any stage scale, 4K and print. Canvas renderer optional.
     --------------------------------------------------------------- */
  function createSprite(opts) {
    opts = Object.assign({ state: 'idle', size: 128, animate: true, flipped: false, glow: false, renderer: 'svg', float: false }, opts || {});
    injectStyle();
    var wrap = document.createElement('div');
    wrap.className = 'chloe-sprite' + (opts.float ? ' anim-ghost-float' : '');
    wrap.style.cssText = 'position:relative;display:inline-block;width:' + opts.size + 'px;height:' + (opts.size * GRID_H / GRID_W) + 'px;line-height:0';
    if (opts.glow) {
      var g = document.createElement('div'); g.className = 'chloe-glow'; wrap.appendChild(g);
    }
    var holder = document.createElement('div');
    holder.style.cssText = 'position:relative;width:100%;height:100%';
    wrap.appendChild(holder);
    var state = opts.state, frame = 0, timer = null, flipped = opts.flipped;
    var cv, ctx;
    function render() {
      if (opts.renderer === 'canvas') {
        if (!cv) {
          cv = document.createElement('canvas'); cv.width = GRID_W * 8; cv.height = GRID_H * 8;
          cv.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;display:block';
          holder.appendChild(cv); ctx = cv.getContext('2d');
        }
        drawGrid(ctx, getStateGrid(state, frame), 8, flipped, opts.colors);
      } else {
        // label lives on the wrapper, not as an SVG <title> text node (keeps text scanners and tooltips quiet)
        holder.innerHTML = toSVG(state, frame, { flipped: flipped, width: '100%', height: '100%', title: false, colors: opts.colors }).replace(' role="img"', ' aria-hidden="true" focusable="false"');
      }
      if (opts.label === false) wrap.setAttribute('aria-hidden', 'true');
      else { wrap.setAttribute('role', 'img'); wrap.setAttribute('aria-label', opts.label || ('Chloé the ghost, ' + state)); }
    }
    render();
    var api = {
      el: wrap,
      setState: function (s) { state = s; render(); return api; },
      setFrame: function (f) { frame = f; render(); return api; },
      setFlipped: function (f) { flipped = !!f; render(); return api; },
      destroy: function () { if (timer) clearInterval(timer); wrap.remove(); }
    };
    if (opts.animate && !reducedMotion()) timer = setInterval(function () { frame = (frame + 1) % 8; render(); }, 500);
    if (opts.mount) opts.mount.appendChild(wrap);
    return api;
  }

  /* ---------------------------------------------------------------
     Public API
     --------------------------------------------------------------- */
  var Chloe = {
    GRID_W: GRID_W,
    GRID_H: GRID_H,
    STATES: STATES.slice(),
    COLORS: COLORS,
    QUIPS: DEFAULT_QUIPS.slice(),
    getStateGrid: getStateGrid,
    drawGrid: drawGrid,
    toSVG: toSVG,
    createSprite: createSprite,
    /** findPerch(targetRect, w, h, opts?) -> {x, y, score, overlap}: least-overlap spot near a target. */
    findPerch: findPerch,
    /** findRest({x,y}, w, h, inset, topInset) -> {x, y, clean}: least-covered resting spot along the margins. */
    findRest: findRest,
    /** collectObstacles() -> [{l,t,r,b,w}]: weighted rects (viewport px) she keeps clear of. */
    collectObstacles: collectObstacles,
    /** Mount the floating screenmate. Returns the instance. */
    mount: function (opts) {
      var inst = new ChloeInstance(opts);
      instances.push(inst);
      return inst;
    },
    /** Convenience wrappers on the most recently mounted instance. */
    get instance() { return instances[instances.length - 1] || null; },
    zap: function (el, opts) { var i = instances[instances.length - 1]; return i ? i.zap(el, opts) : Promise.resolve(false); },
    say: function (t, ms, o) { var i = instances[instances.length - 1]; return i && i.say(t, ms, o); },
    cancel: function () { var i = instances[instances.length - 1]; return i && i.cancel(); },
    setState: function (s, ms) { var i = instances[instances.length - 1]; return i && i.setState(s, ms); },
    roam: function () { var i = instances[instances.length - 1]; return i ? i.roam() : Promise.resolve(); },
    destroy: function () { instances.slice().forEach(function (i) { i.destroy(); }); }
  };

  root.Chloe = Chloe;
  if (typeof module === 'object' && module.exports) module.exports = Chloe;
})(typeof window !== 'undefined' ? window : globalThis);
