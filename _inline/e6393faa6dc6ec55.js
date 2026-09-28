
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy-text]'); if (!b) return;
  var t = b.getAttribute('data-copy-text');
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(function () {
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove();
  }).then(function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); });
});
