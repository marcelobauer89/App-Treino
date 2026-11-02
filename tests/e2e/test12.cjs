const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { logado: false, scheme });
    await p.goto(H.PAGINA);
    await p.waitForSelector('#entrar-google:not([hidden])');
    await p.evaluate(() => document.fonts.ready);
    const a = p.locator('.credito a');
    console.log(scheme, '|', (await p.innerText('.credito')).trim(), '|', await a.getAttribute('href'), await a.getAttribute('target'), await a.getAttribute('rel'),
      '| plano removido:', !(await p.content()).includes('Plano de 6 semanas'), '| erros:', p.errs.length);
    await p.screenshot({ path: `s-login-${scheme}.png` });
  }
  await b.close(); srv.close();
})();
