/* =====================================================================
   OriginKit slots: mounts the four components into the Step 02 slide
   (design-c-ipr/js/originkit/index.js, loaded LAST by the generator).
   Slots come from _src/build.mjs okSlot(): #ok-butterfly (big card),
   #ok-wordmark, #ok-carousel, #ok-border. The slide markup already
   carries each card's name label (.ok-bar / .ok-l), so the components
   mount with label: false. Missing slots are skipped silently.
   ===================================================================== */
(function () {
  'use strict';
  var OK = window.OriginKit || {};
  // RoundCarousel cards: the Marisol drafts from Steps 7-8 rendered at a phone viewport (390 x 844 @3x, cropped 9:16),
  // five heroes + five further-down sections, so the vertical cards show whole screens (img/originkit/phone-*.webp)
  var PHONES = [
    ['bolt', 'Bolt'], ['arena-a', 'arena A'], ['stitch-light', 'Stitch light'], ['arena-b', 'arena B'],
    ['stitch-dark', 'Stitch dark'], ['bolt-flavors', 'Bolt'], ['arena-a-flavors', 'arena A'], ['stitch-light-where', 'Stitch light'],
    ['arena-b-flavors', 'arena B'], ['stitch-dark-book', 'Stitch dark']
  ];
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function one(id, fn) {
    var el = document.getElementById(id);
    if (!el || el._okMounted) return;
    try { el._okMounted = fn(el) || true; } catch (e) { if (window.console) console.warn('OriginKit ' + id + ':', e); }
  }

  function mountAll() {
    if (!OK._core) return;
    one('ok-butterfly', function (el) { return OK.ButterflyDrift && OK.ButterflyDrift.mount(el, { label: false }); });
    one('ok-wordmark', function (el) { return OK.VectorWordmark && OK.VectorWordmark.mount(el, { text: 'Build today', label: false }); });
    one('ok-carousel', function (el) {
      // 4K-class screens get the 1170 px (3x) phones, phones / laptops the 585s (the cards are supersampled either way)
      var hi = Math.max(window.innerWidth, (window.screen && screen.width) || 0) * (window.devicePixelRatio || 1) >= 2600;
      var items = PHONES.map(function (d) { return { src: (window.OriginKitBase || '') + 'img/originkit/phone-' + d[0] + (hi ? '-1170.webp' : '-585.webp'), alt: d[1] + ' draft of the Piraguas de Marisol site, on a phone', label: d[1] }; });
      return OK.RoundCarousel && OK.RoundCarousel.mount(el, { items: items, label: false });
    });
    one('ok-border', function (el) {
      var cta = document.createElement('span');
      cta.className = 'okx-cta'; cta.setAttribute('data-ok-target', '');
      cta.innerHTML = 'Book the cart ' + ARROW;
      el.appendChild(cta);
      return OK.PulsatingBorder && OK.PulsatingBorder.mount(el, { target: cta, label: false });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
})();
