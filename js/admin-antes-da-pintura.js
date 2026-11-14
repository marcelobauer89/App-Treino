// Roda no <head> do admin.html, antes da primeira pintura (fora do HTML por causa da CSP).
(function () {
  // Mesmo tema escolhido no app (Você → Aparência), aplicado antes da primeira pintura.
  try {
    var temaSalvo = localStorage.getItem('bauer-tema');
    if (temaSalvo === 'claro') document.documentElement.dataset.theme = 'light';
    if (temaSalvo === 'escuro') document.documentElement.dataset.theme = 'dark';
    var estiloSalvo = localStorage.getItem('bauer-estilo');
    if (estiloSalvo && estiloSalvo !== 'padrao' && /^[a-z_]+$/.test(estiloSalvo)) document.documentElement.dataset.estilo = estiloSalvo;
  } catch (_) {}
})();
