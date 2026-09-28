
(function () {
  'use strict';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = [].slice.call(document.querySelectorAll('[data-deck]'));

  // Shaders start after first paint so they never block it
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    if (window.BgShaders) try { BgShaders.autoMount(); } catch (e) {}
  }); });

  // Hover preview: cycle the slide thumbnails
  cards.forEach(function (card) {
    var shot = card.querySelector('.shot');
    var imgs = [].slice.call(shot.querySelectorAll('img'));
    var dots = [].slice.call(shot.querySelectorAll('.dots i'));
    var i = 0, iv = null;
    function show(n) {
      i = n % imgs.length;
      imgs.forEach(function (im, k) { im.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }
    function start() { if (iv || REDUCED) return; show(i + 1); iv = setInterval(function () { show(i + 1); }, 1500); }
    function stop() { clearInterval(iv); iv = null; show(0); }
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', function (e) { if (!card.contains(e.relatedTarget)) stop(); });

    // Subtle tilt toward the pointer
    if (!REDUCED) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = 'perspective(1600px) rotateX(' + (-y * 3).toFixed(2) + 'deg) rotateY(' + (x * 3).toFixed(2) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    }
  });

  // Chloé floats around and lasers each card on hover
  if (!window.Chloe) return;
  var chloe = Chloe.mount({
    interval: [18000, 26000],
    firstZap: 5000,
    roam: 57000,
    zapQuipChance: 0.25,
    quips: ['Pick one! Or both. I won’t tell.', 'Boo! Ready to build a website?', 'Press L and I fire my lasers.', 'Cinematic or bento? Tough call.', 'I’m a ghost, but your website will be very real.'],
    targets: function () { return [].slice.call(document.querySelectorAll('[data-zap-card]')).filter(function (el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }); }
  });
  var lastZap = 0;
  cards.forEach(function (card, k) {
    card.addEventListener('mouseenter', function () {
      var now = Date.now();
      if (!chloe || chloe.zapping || now - lastZap < 2500) return;
      lastZap = now;
      chloe.zap(card.querySelector('.shot'), { silent: true }).then(function () {
        if (Math.random() < .5) chloe.say(k === 0 ? 'Ooh, cinematic. Very movie night.' : 'Bento boxes! Snacks for your eyes.', 2400);
      });
    });
  });
})();
