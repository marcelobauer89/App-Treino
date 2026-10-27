// Ambiente do app: produção ou desenvolvimento (README → "Ambiente de desenvolvimento").
// O site de desenvolvimento fica em .../App-Treino/dev/ (e no computador, em localhost) e usa um
// projeto Supabase só de testes: nada do que for feito lá chega ao banco, aos logins ou às fotos de produção.
// As chaves publicáveis podem ficar aqui: quem protege os dados é a RLS do banco.
// Nunca coloque aqui a chave secreta (sb_secret_... ou service_role).
(function () {
  var dev = /\/dev\//.test(location.pathname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var projetos = {
    producao: {
      url: 'https://mlovfgbndtpeczgnvivi.supabase.co',
      chave: 'sb_publishable_8w6VXWwfAMpSCSUF9oEOLg_uCOgvZP2',
    },
    // Projeto só de testes (oss-dev).
    desenvolvimento: {
      url: 'https://tnpgxukcrfcwjvzlimkm.supabase.co',
      chave: 'sb_publishable_n7DNm_s14OJbyK_38N76EQ_STCVNe5W',
    },
  };
  var p = dev ? projetos.desenvolvimento : projetos.producao;
  window.AMBIENTE = { dev: dev, url: p.url, chave: p.chave };
  if (!dev) return;

  // Produção e desenvolvimento ficam no mesmo endereço (github.io), então dividem o localStorage.
  // No dev, todas as chaves ganham o prefixo "dev:": sessão, fila de check-ins e marcas não se misturam.
  try {
    var proto = Storage.prototype, ler = proto.getItem, gravar = proto.setItem, apagar = proto.removeItem;
    var chave = function (s, k) { return s === window.localStorage ? 'dev:' + k : k; };
    proto.getItem = function (k) { return ler.call(this, chave(this, k)); };
    proto.setItem = function (k, v) { return gravar.call(this, chave(this, k), v); };
    proto.removeItem = function (k) { return apagar.call(this, chave(this, k)); };
  } catch (_) {}

  // Selo "DEV" no canto, para nunca confundir com o app de verdade (a política aberta dentro do app não repete).
  if (window.top !== window) return;
  document.title = '[DEV] ' + document.title;
  var selo = function () {
    var s = document.createElement('div');
    s.textContent = 'DEV';
    s.setAttribute('aria-label', 'Ambiente de desenvolvimento');
    s.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 4px);right:4px;z-index:2147483647;'
      + 'pointer-events:none;padding:2px 6px;border-radius:4px;background:#d9480f;color:#fff;'
      + 'font:700 10px/1.4 system-ui,sans-serif;letter-spacing:.06em;opacity:.9';
    document.body.appendChild(s);
  };
  if (document.body) selo(); else document.addEventListener('DOMContentLoaded', selo);
})();
