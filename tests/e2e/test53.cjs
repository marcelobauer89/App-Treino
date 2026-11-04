// Ambiente de desenvolvimento: selo DEV, título, banco de testes, localStorage separado; produção sem nada disso.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    // Produção
    let p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, local: { 'bauer-x': 'producao' } });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    ok(!/DEV/.test(await p.title()) && !(await p.getByText('DEV', { exact: true }).count()), `${scheme}: produção sem selo nem [DEV]`);
    ok((await p.title()) === 'Gestão de Treinos' && (await p.getAttribute('meta[property="og:title"]', 'content')) === 'Gestão de Treinos', `${scheme}: nome "Gestão de Treinos" no título e no compartilhamento`, await p.title());
    ok((await p.evaluate(() => localStorage.getItem('bauer-x'))) === 'producao', `${scheme}: produção lê as chaves sem prefixo`);
    ok(!p.errs.length, `${scheme}: produção sem erros`, p.errs.join(' | '));
    await p.context().close();

    // Desenvolvimento: o banco falso e as chaves locais ficam com o prefixo dev:
    p = await H.novaPagina(b, { scheme, dev: true, viewport: { width: 390, height: 844 }, local: { 'bauer-x': 'producao' } });
    await p.context().addInitScript(() => {
      const ler = Storage.prototype.getItem.bind(localStorage);
      if (!sessionStorage.getItem('dev-semeado')) {
        localStorage.setItem('dev:mock-supabase', ler('mock-supabase'));
        localStorage.setItem('dev:bauer-x', 'dev');
        sessionStorage.setItem('dev-semeado', '1');
      }
    });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    ok(/^\[DEV\] /.test(await p.title()), `${scheme}: título com [DEV]`, await p.title());
    const selo = p.getByText('DEV', { exact: true });
    ok(await selo.isVisible(), `${scheme}: selo DEV visível`);
    ok((await p.evaluate(() => localStorage.getItem('bauer-x'))) === 'dev', `${scheme}: dev lê dev:bauer-x, não o da produção`);
    await p.evaluate(() => localStorage.setItem('x-teste', '1'));
    const chaves = await p.evaluate(() => Object.keys(localStorage));
    ok(chaves.includes('dev:x-teste') && !chaves.includes('x-teste'), `${scheme}: dev grava com prefixo dev:`);
    ok(chaves.includes('bauer-x') && (await p.evaluate(() => Storage.prototype.getItem.call(sessionStorage, 'dev-semeado'))) === '1', `${scheme}: produção intocada e sessionStorage sem prefixo`);
    ok(await p.evaluate(() => window.AMBIENTE.dev && window.AMBIENTE.url === 'https://teste.supabase.co'), `${scheme}: usa o projeto de testes`);
    ok(!p.errs.length, `${scheme}: dev sem erros`, p.errs.join(' | '));
    await p.screenshot({ path: `${H.SAIDA}/dev-${scheme}.png` });
    // Painel no dev
    await p.goto(ADMIN); await p.waitForTimeout(600);
    ok(/^\[DEV\] /.test(await p.title()) && await p.getByText('DEV', { exact: true }).isVisible(), `${scheme}: painel também com DEV`);
    await p.screenshot({ path: `${H.SAIDA}/dev-admin-${scheme}.png` });
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
