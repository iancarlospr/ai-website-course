(function () {
  var fns = { print: function () { window.print(); }, skipShow: function (el) { el.style.left = '8px'; }, skipHide: function (el) { el.style.left = '-999px'; } };
  var els = document.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) {
    var el = els[i], attrs = el.attributes;
    for (var j = 0; j < attrs.length; j++) {
      var a = attrs[j]; if (a.name.indexOf('data-h-') !== 0) continue;
      (function (el, ev, fn) { if (fn) el.addEventListener(ev, function () { fn(el); }); })(el, a.name.slice(7), fns[a.value]);
    }
  }
})();
