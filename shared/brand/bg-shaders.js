/* =================================================================
   bg-shaders.js — resolution-aware animated backgrounds (vanilla)
   Ported from AlphaScan:
     'ambient' — os/bedroom-wallpaper.tsx light spills + vignette + anti-banding dither
     'contour' — packages/video OutroParticles terrain (fbm + ridges, contour lines,
                 grid, radar sweep) recolored to the pink system, AA via fwidth
     'dither'  — os/managed-window.tsx DitherTitlebar (exact Bayer 8x8) as a live,
                 wave-animated field; optional transparent background for overlays
   Plus window.Dither — exact canvas port of the DitherTitlebar (static).
   Architecture: ONE shared offscreen WebGL context renders each visible instance,
   then blits into that instance's own 2D canvas (no context limits, prints reliably).
   Classic script (works from file://). Globals: window.BgShaders, window.Dither
   ================================================================= */
(function (root) {
  'use strict';

  var BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];

  function reducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* -- color parsing (any CSS color incl. oklch / var()) ----------- */
  var _cc;
  function toRGB(c, el) {
    if (Array.isArray(c)) return c.map(function (v) { return v > 1 ? v / 255 : v; });
    if (typeof c === 'string' && c.indexOf('var(') === 0) {
      var name = c.slice(4, -1).trim();
      c = getComputedStyle(el || document.documentElement).getPropertyValue(name).trim() || '#000';
    }
    if (!_cc) { _cc = document.createElement('canvas'); _cc.width = _cc.height = 1; }
    var x = _cc.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1);
    var d = x.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  /* =================================================================
     Dither — exact DitherTitlebar port (2D canvas, static)
     ================================================================= */
  var Dither = {
    BAYER8: BAYER8,
    /**
     * Paint a Bayer-dithered gradient into a canvas sized to `el`.
     * opts: { color:'#FFB2EF', bg:'rgb(18,15,19)'|'transparent', pixel:2 (css px),
     *         direction:'down'|'up'|'left'|'right', height, width }
     */
    paint: function (canvas, opts) {
      opts = Object.assign({ color: '#FFB2EF', bg: 'rgb(18,15,19)', pixel: 2, direction: 'down' }, opts || {});
      var parent = canvas.parentElement;
      var w = opts.width || (parent ? parent.offsetWidth : 300);
      var h = opts.height || (parent ? parent.offsetHeight : 40);
      var cols = Math.ceil(w / opts.pixel), rows = Math.ceil(h / opts.pixel);
      canvas.width = cols; canvas.height = rows;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.style.imageRendering = 'pixelated';
      var ctx = canvas.getContext('2d');
      var fg = toRGB(opts.color).map(function (v) { return Math.round(v * 255); });
      var transparent = opts.bg === 'transparent';
      var bg = transparent ? [0, 0, 0] : toRGB(opts.bg).map(function (v) { return Math.round(v * 255); });
      var img = ctx.createImageData(cols, rows), d = img.data;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var g;
          switch (opts.direction) {
            case 'up': g = y / rows; break;
            case 'right': g = 1 - x / cols; break;
            case 'left': g = x / cols; break;
            default: g = 1.0 - (y / rows);
          }
          var on = g > BAYER8[y % 8][x % 8] / 64;
          var i = (y * cols + x) * 4;
          var c = on ? fg : bg;
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
          d[i + 3] = on || !transparent ? 255 : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas;
    },
    /** Create a titlebar-style strip element (40px tall by default) and append to `parent`. */
    strip: function (parent, opts) {
      opts = Object.assign({ height: 40 }, opts || {});
      var wrap = document.createElement('div');
      wrap.style.cssText = 'overflow:hidden;line-height:0;height:' + opts.height + 'px';
      var cv = document.createElement('canvas');
      wrap.appendChild(cv); parent.appendChild(wrap);
      var paint = function () { Dither.paint(cv, Object.assign({}, opts, { width: wrap.offsetWidth, height: opts.height })); };
      paint();
      if (window.ResizeObserver) new ResizeObserver(paint).observe(wrap);
      return wrap;
    }
  };

  /* =================================================================
     GLSL
     ================================================================= */
  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  var COMMON = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform float uSeed;uniform float uIntensity;',
    'uniform vec3 uVoid;uniform vec3 uPink;uniform float uScale;uniform float uOff;',
    'float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    // anti-banding: +/-1.5/255 per channel (bedroom-wallpaper.tsx)
    'vec3 deband(vec3 c){vec2 q=gl_FragCoord.xy+uSeed*17.0;return c+vec3(hash12(q),hash12(q+31.7),hash12(q+71.3))*(3.0/255.0)-(1.5/255.0);}'
  ].join('\n');

  var NOISE = [
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    'vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;',
    'vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
    'i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    'float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);',
    'vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
    'vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    'vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
    'vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    'vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
    'return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}'
  ].join('\n');

  var FRAG = {};

  // -- ambient: BedroomWallpaper light spills, slowly drifting ----------
  FRAG.ambient = COMMON + '\n' + [
    'uniform float uAccent;',
    'vec3 spill(vec2 uv,vec2 c,vec2 r,vec3 col,float a,float e){vec2 d=(uv-c)/r;float dist=length(d);float t=clamp(1.0-dist/e,0.0,1.0);return col*t*t*a;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;uv.y=1.0-uv.y;float t=uTime;',
    ' vec3 c=uVoid*255.0;',
    ' vec2 w1=vec2(sin(t*.050),cos(t*.043))*.035;vec2 w2=vec2(cos(t*.037),sin(t*.061))*.05;vec2 w3=vec2(sin(t*.029+1.3),cos(t*.047))*.04;',
    ' vec3 add=vec3(0.0);',
    ' add+=spill(uv,vec2(.5,-.1)+w1,vec2(1.0,.5),vec3(38.,43.,60.),.25,.7);',
    ' add+=spill(uv,vec2(.1,.85)+w2,vec2(.6,.5),vec3(62.,35.,50.),.12,.7);',
    ' add+=spill(uv,vec2(.9,.15)+w3,vec2(.5,.6),vec3(32.,37.,52.),.10,.65);',
    ' add+=spill(uv,vec2(.5,.45)-w1,vec2(.4,.35),vec3(48.,28.,40.),.08,.7);',
    // accent: an optional pink bloom (0 = faithful wallpaper)
    ' add+=spill(uv,vec2(.78,.72)+w3*1.5,vec2(.55,.5),uPink*255.0,.10*uAccent,.8);',
    ' c+=add*uIntensity;',
    ' vec2 v=(uv-.5)/vec2(.75,.65);float vd=length(v);if(vd>.3){float vf=min(1.0,(vd-.3)/.7);c*=1.0-vf*.6;}',
    ' gl_FragColor=vec4(deband(c/255.0),1.0);',
    '}'
  ].join('\n');

  // -- contour: pink topographic terrain (OutroParticles, lightened) ----
  FRAG.contour = COMMON + '\n' + NOISE + '\n' + [
    'uniform float uGrid;uniform float uSweep;uniform vec3 uHigh;uniform float uZoom;uniform float uDetail;',
    'float fbm(vec3 p){float v=0.0;float a=.5;float f=1.0;float warp=snoise(p*.5+vec3(3.7,1.2,0.0))*.3;p.xy+=warp;',
    ' for(int i=0;i<4;i++){v+=a*snoise(p*f);f*=2.04;a*=.48;}return v;}',
    'float ridge(vec3 p){float v=0.0;float a=.5;float f=1.0;float pr=1.0;for(int i=0;i<3;i++){float n=1.0-abs(snoise(p*f));n*=n;v+=n*a*pr;pr=n;f*=2.1;a*=.45;}return v;}',
    'float terrain(vec2 uv,float t){vec3 p=vec3(uv*1.4,t*.02);float h=fbm(p)*.6;h+=ridge(p*1.1+vec3(10.,20.,0.))*.35*uDetail;',
    ' float valley=snoise(vec3(uv*1.1,t*.015));h+=smoothstep(.15,0.0,abs(valley))*(-.12);return h;}',
    // anti-aliased iso-lines via fwidth; px = line width in DEVICE px
    'float iso(float h,float interval,float px){float v=h/interval;float d=abs(fract(v+.5)-.5);float w=max(fwidth(v),1e-5);return 1.0-smoothstep(w*px*.5,w*(px*.5+1.0),d);}',
    'float gridl(vec2 uv,float s,float px){vec2 v=uv/s;vec2 d=abs(fract(v+.5)-.5);vec2 w=max(fwidth(v),vec2(1e-5));vec2 g=1.0-smoothstep(w*px*.5,w*(px*.5+1.0),d);return max(g.x,g.y);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;vec2 asp=vec2(uRes.x/uRes.y,1.0);vec2 uvA=uv*asp;float t=uTime;',
    // pattern density fixed in CSS/stage px (1080 reference), not per element
    ' vec2 sp=gl_FragCoord.xy/max(uScale,1e-3)/1080.0;',
    ' vec2 tuv=sp*uZoom+vec2(t*.008,t*.005)+uOff*.37;',
    ' float h=terrain(tuv,t);',
    ' vec3 n=normalize(vec3(-dFdx(h)*uRes.y*.35,-dFdy(h)*uRes.y*.35,1.0));',
    ' float shade=pow(dot(n,normalize(vec3(.7,.5,.9)))*.5+.5,1.4);',
    ' float e=clamp((h+.6)/1.2,0.0,1.0);',
    ' vec3 col=mix(uVoid,uHigh,smoothstep(.2,.95,e));',
    ' col*=(.55+shade*.75);',
    ' float lw=uScale;',
    ' float minor=iso(h,.06,1.0*lw);float major=iso(h,.24,2.0*lw);',
    ' col=mix(col,uPink*.55,minor*.28*uIntensity);',
    ' col=mix(col,uPink,major*.55*uIntensity);',
    ' float gMaj=gridl(tuv,.5,1.0*lw);float gMin=gridl(tuv,.125,1.0*lw);',
    ' col=mix(col,uPink*.35,gMin*.10*uGrid);col=mix(col,uPink*.5,gMaj*.22*uGrid);',
    ' vec2 sc=vec2(.5*asp.x,.5);vec2 d=uvA-sc;float a=atan(d.y,d.x);float diff=mod(a-t*.6+3.14159,6.28318)-3.14159;',
    ' float sw=(smoothstep(.6,0.0,diff)*smoothstep(-.05,0.0,diff)+exp(-abs(diff)*3.0)*step(0.0,diff)*.4)*uSweep;',
    ' col+=uPink*sw*.07;',
    ' float vig=smoothstep(0.0,.7,1.0-length((uv-.5)*1.5));col*=vig*.8+.2;',
    ' gl_FragColor=vec4(deband(col),1.0);',
    '}'
  ].join('\n');

  // -- dither: Bayer 8x8 field (exact matrix via 8x8 texture) -----------
  FRAG.dither = COMMON + '\n' + [
    'uniform sampler2D uBayer;uniform float uPx;uniform float uDir;uniform float uWave;uniform float uTransparent;uniform float uLevel;',
    'void main(){',
    ' vec2 cell=floor(gl_FragCoord.xy/uPx);',
    ' vec2 cells=ceil(uRes/uPx);',
    ' vec2 uv=(cell+.5)/cells;uv.y=1.0-uv.y;', // top-left origin like the canvas version
    ' float g;',
    ' if(uDir<.5) g=1.0-uv.y; else if(uDir<1.5) g=uv.y; else if(uDir<2.5) g=1.0-uv.x; else if(uDir<3.5) g=uv.x; else g=1.0-length((uv-.5)*vec2(uRes.x/uRes.y,1.0))*1.25;',
    ' g=g*uLevel+uWave*(sin(uv.x*6.2831*1.3+uTime*.9)*.06+sin(uv.y*6.2831*.9-uTime*.7)*.05+sin((uv.x+uv.y)*6.2831*2.1+uTime*1.3)*.025);',
    ' vec2 bc=mod(vec2(cell.x,cells.y-1.0-cell.y),8.0);',
    ' float th=texture2D(uBayer,(bc+.5)/8.0).r*255.0/64.0;',
    ' float on=step(th,g-1e-4);',
    ' if(uTransparent>.5){gl_FragColor=vec4(uPink*on,on);}',
    ' else gl_FragColor=vec4(mix(uVoid,uPink,on),1.0);',
    '}'
  ].join('\n');

  var TYPE_DEFAULTS = {
    ambient: { fps: 24, maxPixels: 1920 * 1080, intensity: 1, accent: 0 },
    contour: { fps: 30, maxPixels: 2560 * 1440, intensity: 1, grid: 1, sweep: 1, zoom: 1, detail: 1, high: 'oklch(0.30 0.06 340)' },
    dither: { fps: 20, maxPixels: 3840 * 2160, pixel: 2, direction: 'down', wave: 1, transparent: false, level: 1 }
  };
  var DIRS = { down: 0, up: 1, right: 2, left: 3, radial: 4 };

  /* =================================================================
     Shared GL
     ================================================================= */
  var G = null;
  function gl() {
    if (G !== null) return G;
    var cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    var ctx = cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!ctx) { G = false; return G; }
    ctx.getExtension('OES_standard_derivatives');
    var buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    // Bayer texture
    var tex = ctx.createTexture();
    var data = new Uint8Array(64);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) data[y * 8 + x] = BAYER8[y][x];
    ctx.bindTexture(ctx.TEXTURE_2D, tex);
    ctx.pixelStorei(ctx.UNPACK_ALIGNMENT, 1);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.LUMINANCE, 8, 8, 0, ctx.LUMINANCE, ctx.UNSIGNED_BYTE, data);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.REPEAT);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.REPEAT);
    G = { canvas: cv, gl: ctx, buf: buf, bayer: tex, programs: {} };
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); G = null; });
    return G;
  }
  function program(type) {
    var g = gl();
    if (!g) return null;
    if (g.programs[type]) return g.programs[type];
    var c = g.gl;
    function sh(kind, src) {
      var s = c.createShader(kind); c.shaderSource(s, src); c.compileShader(s);
      if (!c.getShaderParameter(s, c.COMPILE_STATUS)) { console.error('[bg-shaders] ' + type + ': ' + c.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(c.VERTEX_SHADER, VERT), fs = sh(c.FRAGMENT_SHADER, FRAG[type]);
    if (!vs || !fs) return (g.programs[type] = null);
    var p = c.createProgram(); c.attachShader(p, vs); c.attachShader(p, fs); c.linkProgram(p);
    if (!c.getProgramParameter(p, c.LINK_STATUS)) { console.error('[bg-shaders] link ' + c.getProgramInfoLog(p)); return (g.programs[type] = null); }
    var u = {};
    ['uRes', 'uTime', 'uSeed', 'uOff', 'uIntensity', 'uVoid', 'uPink', 'uScale', 'uAccent', 'uGrid', 'uSweep', 'uHigh', 'uZoom', 'uDetail', 'uBayer', 'uPx', 'uDir', 'uWave', 'uTransparent', 'uLevel'].forEach(function (n) { u[n] = c.getUniformLocation(p, n); });
    g.programs[type] = { p: p, u: u, a: c.getAttribLocation(p, 'p') };
    return g.programs[type];
  }

  /* =================================================================
     Instances
     ================================================================= */
  var instances = [];
  var running = false;
  var io = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { var inst = e.target.__bgShader; if (inst) inst.visible = e.isIntersecting; });
  }, { rootMargin: '10% 0px' }) : null;

  function Instance(host, opts) {
    var type = opts.type || 'ambient';
    this.host = host;
    this.o = Object.assign({ speed: 1, colors: {}, time: null, static: false }, TYPE_DEFAULTS[type] || {}, opts, { type: type });
    this.visible = !io;
    this.paused = false;
    this.t0 = performance.now() - (this.o.time != null ? this.o.time * 1000 / this.o.speed : Math.random() * 20000);
    this.last = 0;
    this.dirty = true;
    this.seed = Math.random() * 100;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var cv = document.createElement('canvas');
    cv.className = 'bgs-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;' + (type === 'dither' ? 'image-rendering:pixelated;' : '');
    host.insertBefore(cv, host.firstChild);
    this.canvas = cv;
    this.ctx = cv.getContext('2d');
    host.__bgShader = this;
    this.refreshColors();
    if (io) io.observe(host);
    if (!program(type)) this._fallback();
  }
  Instance.prototype.refreshColors = function () {
    var c = this.o.colors || {};
    this.cVoid = toRGB(c.void || 'var(--gs-void)', this.host);
    this.cPink = toRGB(c.pink || 'var(--gs-base)', this.host);
    this.cHigh = toRGB(c.high || this.o.high || 'oklch(0.30 0.06 340)', this.host);
    if (this.cVoid.join() === '0,0,0' && !c.void) this.cVoid = [8 / 255, 8 / 255, 8 / 255];
    if (this.cPink.join() === '0,0,0' && !c.pink) this.cPink = [1, 178 / 255, 239 / 255];
    this.dirty = true;
  };
  Instance.prototype._fallback = function () {
    this.failed = true;
    this.canvas.remove();
    this.host.style.background = this.o.type === 'dither'
      ? 'linear-gradient(180deg,#FFB2EF,#080808)'
      : 'radial-gradient(ellipse at 70% 80%, rgba(255,178,239,.12), transparent 60%), radial-gradient(ellipse at 50% 0%, rgba(38,43,60,.5), transparent 70%), #080808';
  };
  Instance.prototype.renderable = function () {
    if (this.failed || this.paused) return false;
    if (!this.visible || document.hidden) return false;
    var de = document.documentElement;
    if (de.classList.contains('deck-present') && !de.classList.contains('deck-overview')) {
      var s = this.host.closest('[data-slide]');
      if (s && !s.classList.contains('is-active') && !s.classList.contains('is-leaving')) return false;
    }
    return true;
  };
  /** Compute backing size: element's on-screen size * DPR, capped to maxPixels. */
  Instance.prototype.fit = function (forceW) {
    var r = this.host.getBoundingClientRect();
    var cssW = this.host.offsetWidth || r.width, cssH = this.host.offsetHeight || r.height;
    if (!cssW || !cssH) return false;
    var W, H;
    if (forceW) { W = forceW; H = Math.round(forceW * cssH / cssW); }
    else {
      var d = window.devicePixelRatio || 1;
      W = Math.round(Math.max(r.width, 1) * d); H = Math.round(Math.max(r.height, 1) * d);
      var mp = this.o.maxPixels;
      if (W * H > mp) { var s = Math.sqrt(mp / (W * H)); W = Math.round(W * s); H = Math.round(H * s); }
    }
    // uScale: device px per stage/css px (keeps line + dither-pixel widths visually constant)
    this.scale = W / cssW;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; this.dirty = true; }
    return true;
  };
  Instance.prototype.time = function (now) {
    if (this.o.static || reducedMotion()) return this.o.time != null ? this.o.time : 8;
    return (now - this.t0) / 1000 * this.o.speed;
  };
  Instance.prototype.draw = function (t) {
    var g = gl(); if (!g) return this._fallback();
    var pr = program(this.o.type); if (!pr) return this._fallback();
    var c = g.gl, W = this.canvas.width, H = this.canvas.height;
    if (g.canvas.width < W || g.canvas.height < H) {
      g.canvas.width = Math.max(g.canvas.width, W); g.canvas.height = Math.max(g.canvas.height, H);
    }
    // drivers may cap the drawing buffer below the requested size: never draw past it
    var bw = c.drawingBufferWidth, bh = c.drawingBufferHeight;
    if (bw < W || bh < H) {
      var k = Math.min(bw / W, bh / H);
      W = Math.floor(W * k); H = Math.floor(H * k);
      this.canvas.width = W; this.canvas.height = H;
      this.scale = (this.scale || 1) * k;
    }
    var srcY = bh - H;
    c.viewport(0, 0, W, H);
    c.useProgram(pr.p);
    c.bindBuffer(c.ARRAY_BUFFER, g.buf);
    c.enableVertexAttribArray(pr.a);
    c.vertexAttribPointer(pr.a, 2, c.FLOAT, false, 0, 0);
    var u = pr.u, o = this.o;
    c.uniform2f(u.uRes, W, H);
    c.uniform1f(u.uTime, t);
    c.uniform1f(u.uSeed, this.seed + (reducedMotion() || o.static ? 0 : t % 7));
    if (u.uOff) c.uniform1f(u.uOff, this.seed);
    c.uniform1f(u.uIntensity, o.intensity != null ? +o.intensity : 1);
    c.uniform3fv(u.uVoid, this.cVoid);
    c.uniform3fv(u.uPink, this.cPink);
    c.uniform1f(u.uScale, Math.max(1, this.scale || 1));
    if (u.uAccent) c.uniform1f(u.uAccent, +o.accent || 0);
    if (u.uGrid) c.uniform1f(u.uGrid, o.grid != null ? +o.grid : 1);
    if (u.uSweep) c.uniform1f(u.uSweep, o.sweep != null ? +o.sweep : 1);
    if (u.uHigh) c.uniform3fv(u.uHigh, this.cHigh);
    if (u.uZoom) c.uniform1f(u.uZoom, o.zoom != null ? +o.zoom : 1);
    if (u.uDetail) c.uniform1f(u.uDetail, o.detail != null ? +o.detail : 1);
    if (u.uBayer) { c.activeTexture(c.TEXTURE0); c.bindTexture(c.TEXTURE_2D, g.bayer); c.uniform1i(u.uBayer, 0); }
    if (u.uPx) c.uniform1f(u.uPx, Math.max(1, Math.round((+o.pixel || 2) * (this.scale || 1))));
    if (u.uDir) c.uniform1f(u.uDir, DIRS[o.direction] != null ? DIRS[o.direction] : 0);
    if (u.uWave) c.uniform1f(u.uWave, reducedMotion() ? 0 : +o.wave || 0);
    if (u.uTransparent) c.uniform1f(u.uTransparent, o.transparent ? 1 : 0);
    if (u.uLevel) c.uniform1f(u.uLevel, o.level != null ? +o.level : 1);
    c.clearColor(0, 0, 0, 0); c.clear(c.COLOR_BUFFER_BIT);
    c.drawArrays(c.TRIANGLES, 0, 3);
    this.ctx.clearRect(0, 0, W, H);
    // GL origin is bottom-left: our W x H region sits at the bottom of the shared canvas
    this.ctx.drawImage(g.canvas, 0, srcY, W, H, 0, 0, W, H);
    this.dirty = false;
    this.drawn = true;
  };
  Instance.prototype.tick = function (now) {
    if (!this.renderable()) return;
    var animate = !(this.o.static || reducedMotion());
    if (!animate && this.drawn && !this.dirty) { this.fit(); if (!this.dirty) return; }
    if (animate && now - this.last < 1000 / this.o.fps - 2) return;
    this.last = now;
    if (!this.fit()) return;
    this.draw(this.time(now));
  };
  Instance.prototype.set = function (opts) { Object.assign(this.o, opts || {}); if (opts && (opts.colors || opts.high)) this.refreshColors(); this.dirty = true; return this; };
  Instance.prototype.pause = function () { this.paused = true; return this; };
  Instance.prototype.resume = function () { this.paused = false; this.dirty = true; return this; };
  /** Render one high-res still (e.g. for print / 4K). width in device px (default 3840). */
  Instance.prototype.renderStill = function (width, time) {
    if (this.failed) return;
    this.fit(width || 3840);
    this.draw(time != null ? time : this.time(performance.now()));
    this.stillLocked = true;
  };
  Instance.prototype.destroy = function () {
    if (io) io.unobserve(this.host);
    this.canvas.remove();
    delete this.host.__bgShader;
    instances = instances.filter(function (i) { return i !== this; }, this);
  };

  function loop(now) {
    if (!instances.length) { running = false; return; }
    requestAnimationFrame(loop);
    if (BgShaders.printing) return;
    for (var i = 0; i < instances.length; i++) {
      try { instances[i].tick(now); } catch (e) { console.error('[bg-shaders]', e); instances[i].failed = true; }
    }
  }

  var BgShaders = {
    types: Object.keys(FRAG),
    printing: false,
    /**
     * Mount an animated background into `host` (canvas inserted as first child, absolutely filling it).
     * opts: { type:'ambient'|'contour'|'dither', speed, fps, maxPixels, intensity, colors:{void,pink,high},
     *         static, time,  ambient: accent;  contour: grid, sweep, high;
     *         dither: pixel (css px), direction ('down'|'up'|'left'|'right'|'radial'), wave, transparent, level }
     */
    mount: function (host, opts) {
      if (typeof host === 'string') host = document.querySelector(host);
      if (!host) return null;
      if (host.__bgShader) return host.__bgShader;
      var inst = new Instance(host, opts || {});
      instances.push(inst);
      if (!running) { running = true; requestAnimationFrame(loop); }
      return inst;
    },
    /** Mount every [data-bg-shader] under root. data-* attributes become options. */
    autoMount: function (rootEl) {
      var out = [];
      (rootEl || document).querySelectorAll('[data-bg-shader]').forEach(function (el) {
        var d = el.dataset, o = { type: d.bgShader };
        ['speed', 'fps', 'intensity', 'accent', 'grid', 'sweep', 'zoom', 'detail', 'pixel', 'wave', 'level', 'maxPixels', 'time'].forEach(function (k) { if (d[k] != null) o[k] = parseFloat(d[k]); });
        if (d.direction) o.direction = d.direction;
        if (d.transparent != null) o.transparent = d.transparent !== 'false';
        if (d.static != null) o.static = d.static !== 'false';
        if (d.colorVoid || d.colorPink || d.colorHigh) o.colors = { void: d.colorVoid, pink: d.colorPink, high: d.colorHigh };
        out.push(BgShaders.mount(el, o));
      });
      return out;
    },
    /** Render every instance once at print/4K resolution. Call before window.print() / page.pdf(). */
    renderStills: function (opts) {
      opts = opts || {};
      BgShaders.printing = true;
      instances.forEach(function (i) { i.renderStill(opts.width || 3840, opts.time); });
    },
    /** Resume live rendering after renderStills. */
    resumeLive: function () {
      BgShaders.printing = false;
      instances.forEach(function (i) { i.stillLocked = false; i.dirty = true; });
    },
    get instances() { return instances.slice(); }
  };

  window.addEventListener('beforeprint', function () { BgShaders.renderStills(); });
  window.addEventListener('afterprint', function () { BgShaders.resumeLive(); });
  document.addEventListener('visibilitychange', function () { instances.forEach(function (i) { i.dirty = true; }); });

  root.BgShaders = BgShaders;
  root.Dither = Dither;
})(window);
