// Fundo dos estilos de cor (app e painel): numa camada presa à tela, sem "background-attachment: fixed" (o Safari do
// iPhone ignora e repetia o degradê em faixas), cobrindo a tela inteira mesmo em página curta e no fim de página longa.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ESTILOS = ['neon', 'brasa', 'cyber', 'ultra', 'gelo', 'violeta', 'miami', 'lua_de_sangue'];
const medir = (p) => p.evaluate(() => {
  const antes = getComputedStyle(document.body, '::before');
  const corpo = getComputedStyle(document.body);
  return {
    pos: antes.position, img: antes.backgroundImage !== 'none', anexo: antes.backgroundAttachment,
    alto: parseFloat(antes.height) >= innerHeight - 1, corpoImg: corpo.backgroundImage,
    htmlCor: getComputedStyle(document.documentElement).backgroundColor,
  };
});
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const estilo of ESTILOS) {
    // Painel sem login: página curta, mais baixa que a tela.
    let p = await H.novaPagina(b, { scheme: 'dark', logado: false, viewport: { width: 390, height: 844 }, local: { 'bauer-estilo': estilo } });
    await p.goto(H.PAGINA.replace('index.html', 'admin.html')); await p.waitForSelector('#entrar');
    let m = await medir(p);
    ok(m.pos === 'fixed' && m.img && m.alto && !/fixed/.test(m.anexo), `painel ${estilo}: fundo numa camada fixa que cobre a tela`, JSON.stringify(m));
    ok(m.corpoImg === 'none' && m.htmlCor !== 'rgba(0, 0, 0, 0)', `painel ${estilo}: sem degradê no body e com cor de fundo na página`, JSON.stringify(m));
    await p.context().close();

    // App: página longa, rolada até o fim.
    p = await H.novaPagina(b, { scheme: 'dark', viewport: { width: 390, height: 844 } });
    await p.goto(H.PAGINA); await H.prontos(p);
    await p.evaluate((e) => { document.documentElement.dataset.estilo = e; }, estilo);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(100);
    m = await medir(p);
    ok(m.pos === 'fixed' && m.img && m.alto && !/fixed/.test(m.anexo) && m.corpoImg === 'none', `app ${estilo}: fundo numa camada fixa no fim da página`, JSON.stringify(m));
    ok(p.errs.length === 0, `app ${estilo}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
