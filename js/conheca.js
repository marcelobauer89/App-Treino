// Landing page do produto (conheca.html): menu do Entrar (aluno ou personal), abas "Para quem é", borda do topo ao rolar e botões fixos no celular.
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

  // ---------- Entrar: aluno ou personal ----------
  var entrar = document.getElementById('entrar-btn');
  var menu = document.getElementById('entrar-menu');
  function abrirMenu(abrir) {
    menu.hidden = !abrir;
    entrar.setAttribute('aria-expanded', String(abrir));
  }
  if (entrar && menu) {
    entrar.addEventListener('click', function () {
      abrirMenu(menu.hidden);
      if (!menu.hidden) menu.querySelector('a').focus();
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.entrar')) abrirMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { abrirMenu(false); entrar.focus(); } });
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var itens = Array.prototype.slice.call(menu.querySelectorAll('a'));
      var i = itens.indexOf(document.activeElement);
      e.preventDefault();
      itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length].focus();
    });
  }

  // ---------- Topo e botões fixos ----------
  // No celular, os dois botões (aluno e personal) aparecem assim que a página rola e somem na chamada final.
  var topo = document.querySelector('.topo');
  var fixo = document.getElementById('cta-fixo');
  var final = document.querySelector('.final');
  var finalVisivel = false;
  function rolou() {
    var y = window.scrollY;
    if (topo) topo.classList.toggle('rolou', y > 8);
    if (fixo) fixo.hidden = y < 40 || finalVisivel;
  }
  window.addEventListener('scroll', rolou, { passive: true });
  if (final && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { finalVisivel = es[0].isIntersecting; rolou(); }).observe(final);
  }
  rolou();
})();
