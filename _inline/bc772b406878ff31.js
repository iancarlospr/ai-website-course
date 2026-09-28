
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy-text]'); if (!b) return;
  var t = b.getAttribute('data-copy-text');
  var done = function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
  var fb = function () { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fb); else fb();
});
