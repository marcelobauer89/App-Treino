// Política aberta dentro do app: sem sair, sem recarregar.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 390, height: 844 }], ['dark', { width: 1280, height: 900 }]]) {
    const tag = `${scheme}-${vp.width}`;
    const p = await H.novaPagina(b, { scheme, viewport: vp });
    await p.goto(H.PAGINA); await H.prontos(p);
    await p.evaluate(() => { window.__marca = 1; });
    await H.voce(p, 'privacidade');
    let novas = 0; p.context().on('page', () => novas++);
    await p.click('.priv-link');
    await p.waitForSelector('#politica-ver[open]');
    const f = p.frameLocator('#politica-frame');
    await f.locator('#s1').waitFor();
    ok(novas === 0, `${tag}: não abre aba nova`);
    ok(await f.locator('#voltar').isHidden() && await f.locator('h1').isHidden(), `${tag}: sem Voltar e título dentro da janela`);
    ok((await f.locator('a[href^="mailto"]').first().getAttribute('target')) === '_blank', `${tag}: links da política abrem fora`);
    const sw = await f.locator('html').evaluate((h) => h.scrollWidth <= h.clientWidth);
    ok(sw, `${tag}: sem rolagem horizontal`);
    await p.waitForTimeout(300); await p.screenshot({ path: `${H.SAIDA}/politica-ver-${tag}.png` });
    await p.click('#politica-ver [data-fechar]');
    ok(await p.isHidden('#politica-ver') && await p.evaluate(() => window.__marca === 1 && location.hash === '#voce/privacidade'), `${tag}: fechar volta para Privacidade sem recarregar`);
    await p.click('.priv-link'); await p.keyboard.press('Escape');
    ok(await p.isHidden('#politica-ver'), `${tag}: Esc fecha`);
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Aviso da política: "Ler a política completa" abre por cima do aviso; fechar volta ao aviso.
  const a = await H.novaPagina(b, { extra: { perfis: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', politica_versao: null }] } });
  await a.goto(H.PAGINA); await H.prontos(a);
  await a.waitForSelector('#politica-dialog[open]');
  await a.click('#politica-dialog .priv-link'); await a.waitForSelector('#politica-ver[open]');
  await a.keyboard.press('Escape');
  ok(await a.isHidden('#politica-ver') && await a.isVisible('#politica-dialog'), 'aviso: Esc fecha só a política e o aviso continua');
  // Tela de entrada (deslogado)
  const l = await H.novaPagina(b, { logado: false });
  await l.goto(H.PAGINA); await l.waitForSelector('#entrar-privacidade:not([hidden])');
  await l.click('#entrar-privacidade a'); await l.waitForSelector('#politica-ver[open]');
  ok(true, 'entrada: política abre dentro do app');
  ok(l.errs.length === 0, 'entrada: sem erros', l.errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
