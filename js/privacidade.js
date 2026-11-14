// Script do privacidade.html (fora do HTML por causa da CSP).
(function () {
  // Mesmo tema escolhido no app (Você → Aparência).
  try {
    var temaSalvo = localStorage.getItem('bauer-tema');
    if (temaSalvo === 'claro') document.documentElement.dataset.theme = 'light';
    if (temaSalvo === 'escuro') document.documentElement.dataset.theme = 'dark';
  } catch (_) {}
  // Área do personal desligada neste ambiente (ambiente.js): o que fala dela some e vale a data da versão anterior.
  if (!(window.AMBIENTE && window.AMBIENTE.areaPersonal)) {
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('[data-area-personal]').forEach(function (el) { el.hidden = true; });
      document.querySelectorAll('[data-sem-personal]').forEach(function (el) { el.hidden = false; });
    });
  }
  // Aberta dentro do app (janela da política): sem o "Voltar" nem o título, que já estão na janela.
  if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add('embed');
})();

// Depois que a página carrega: links e o botão "Voltar".
document.addEventListener('DOMContentLoaded', function () {
  // Dentro do app, os links da política abrem fora da janela (o site em outra aba, o e-mail no app de e-mail).
  if (document.documentElement.classList.contains('embed')) {
    document.querySelectorAll('main a:not(#voltar)').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
  }
  // A política abre numa aba nova a partir do app: "Voltar" fecha esta aba e volta para o app
  // como estava, sem carregar tudo de novo. Aberta direto pelo link, volta pelo histórico ou abre o app.
  document.getElementById('voltar').addEventListener('click', function (e) {
    var doApp = false;
    try { doApp = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (_) {}
    if (history.length <= 1) {
      e.preventDefault();
      window.close();
      // Se o navegador não deixar fechar, segue para o app.
      setTimeout(function () { location.href = './'; }, 300);
    } else if (doApp) {
      e.preventDefault();
      history.back();
    }
  });
});
