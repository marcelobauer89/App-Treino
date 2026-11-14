// Roda no <head> do index.html, antes da primeira pintura (fora do HTML por causa da CSP).
(function () {
  // Aplica o tema escolhido antes da primeira pintura, para a tela não piscar.
  try {
    var temaSalvo = localStorage.getItem('bauer-tema');
    if (temaSalvo === 'claro') document.documentElement.dataset.theme = 'light';
    if (temaSalvo === 'escuro') document.documentElement.dataset.theme = 'dark';
    // Quem já deslizou um cartão não precisa mais da dica.
    if (localStorage.getItem('bauer-deslizou')) document.documentElement.classList.add('ja-deslizou');
  } catch (_) {}
})();
