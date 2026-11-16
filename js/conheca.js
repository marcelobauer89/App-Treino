// Landing page do produto (conheca.html): abas "Para quem é", borda do topo ao rolar e botão fixo no celular.
(function () {
  // ---------- Abas ----------
  var abas = Array.prototype.slice.call(document.querySelectorAll('.aba[role="tab"]'));
  function escolher(aba, focar) {
    abas.forEach(function (a) {
      var sel = a === aba;
      a.setAttribute('aria-selected', String(sel));
      a.tabIndex = sel ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !sel;
    });
    if (focar) aba.focus();
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () { escolher(aba); });
    aba.addEventListener('keydown', function (e) {
      var n = abas.length, alvo = null;
      if (e.key === 'ArrowRight') alvo = abas[(i + 1) % n];
      else if (e.key === 'ArrowLeft') alvo = abas[(i - 1 + n) % n];
      else if (e.key === 'Home') alvo = abas[0];
      else if (e.key === 'End') alvo = abas[n - 1];
      if (alvo) { e.preventDefault(); escolher(alvo, true); }
    });
  });

  // ---------- Topo e botão fixo ----------
  var topo = document.querySelector('.topo');
  var fixo = document.getElementById('cta-fixo');
  var heroCta = document.getElementById('cta-hero');
  var final = document.querySelector('.final');
  function rolou() { if (topo) topo.classList.toggle('rolou', window.scrollY > 8); }
  window.addEventListener('scroll', rolou, { passive: true });
  rolou();
  if (fixo && heroCta && 'IntersectionObserver' in window) {
    var heroVisivel = true, finalVisivel = false;
    var atualizar = function () { fixo.hidden = heroVisivel || finalVisivel; };
    new IntersectionObserver(function (es) { heroVisivel = es[0].isIntersecting; atualizar(); }).observe(heroCta);
    if (final) new IntersectionObserver(function (es) { finalVisivel = es[0].isIntersecting; atualizar(); }).observe(final);
  }
})();
