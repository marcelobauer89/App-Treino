const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const errs = [];

  // Volta do Google com dois eventos e dados locais antigos: carrega e migra uma vez só.
  const local = { 'bauer-checkins-v1': JSON.stringify([{ id: 'a', tipo: 't1', inicio: '2026-10-14T10:00', fim: '2026-10-14T11:00', series: {} }, { id: 'b', tipo: 'jiu', inicio: '2026-10-15T19:00', fim: '2026-10-15T20:00', series: {} }]) };
  const p = await H.novaPagina(b, { local, extra: { doisEventos: true } });
  await p.goto(H.PAGINA + '?code=abc123');
  await H.prontos(p);
  await p.waitForTimeout(400);
  const db = await H.banco(p);
  ok(db.log.filter((l) => l === 'select:checkins').length === 1, 'data loaded once despite two auth events', db.log.join(','));
  ok(db.checkins.length === 2, 'migration ran once (no duplicates)', `${db.checkins.length} check-ins`);
  ok(!(await p.evaluate(() => location.search)).includes('code='), 'code removed from address bar');
  errs.push(...p.errs);

  // Erro devolvido na URL (ex.: usuário fora da lista de teste do Google).
  const e = await H.novaPagina(b, { logado: false });
  await e.goto(H.PAGINA + '?error=access_denied&error_code=403&error_description=Access+denied+by+Google');
  await e.waitForSelector('#entrar-erro:not([hidden])');
  ok((await txt(e, '#entrar-erro')) === 'Não foi possível concluir o login: Access denied by Google' && await e.isVisible('#entrar-google'), 'URL error shown on login screen', await txt(e, '#entrar-erro'));
  ok((await e.evaluate(() => location.search)) === '', 'error params cleaned from URL');
  await e.screenshot({ path: 's-login-erro.png' });
  errs.push(...e.errs);

  // Troca do código falhou no Supabase.
  const f = await H.novaPagina(b, { logado: false, extra: { erroInit: 'invalid flow state, no valid flow state found' } });
  await f.goto(H.PAGINA + '?code=abc123');
  await f.waitForSelector('#entrar-erro:not([hidden])');
  ok((await txt(f, '#entrar-erro')).includes('invalid flow state'), 'code exchange error shown', await txt(f, '#entrar-erro'));
  errs.push(...f.errs);

  // Código na URL mas sem sessão e sem erro (login começou em outro navegador).
  const g = await H.novaPagina(b, { logado: false });
  await g.goto(H.PAGINA + '?code=abc123');
  await g.waitForSelector('#entrar-erro:not([hidden])');
  ok((await txt(g, '#entrar-erro')).includes('Abra o app direto no Chrome ou no Safari'), 'missing verifier explained', await txt(g, '#entrar-erro'));
  errs.push(...g.errs);

  // Abertura normal sem login: sem mensagem de erro.
  const n = await H.novaPagina(b, { logado: false });
  await n.goto(H.PAGINA);
  await n.waitForSelector('#entrar-google:not([hidden])');
  ok(await n.isHidden('#entrar-erro'), 'no error on a normal visit');
  errs.push(...n.errs);

  console.log('errors:', errs);
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); srv.close();
})();
