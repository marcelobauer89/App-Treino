// Registro de acesso ao abrir o app.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const rpcs = async (p) => (await H.banco(p)).log.filter((l) => l === 'rpc:registrar_acesso').length;
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const p = await H.novaPagina(b);
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  ok(await rpcs(p) === 1, 'opening the app registers one access');
  ok((await H.banco(p)).perfis[0].acessos === 1, 'profile counter updated');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(await rpcs(p) === 2, 'each opening calls the function (30 min rule is in the database)');
  ok(!p.errs.length, 'no errors', p.errs.join());
  await p.context().close();
  // volta do Google: INITIAL_SESSION + SIGNED_IN
  const q = await H.novaPagina(b, { extra: { doisEventos: true } });
  await q.goto(H.PAGINA); await H.prontos(q); await q.waitForTimeout(300);
  ok(await rpcs(q) === 1, 'Google return (two auth events) counts once', String(await rpcs(q)));
  await q.context().close();
  // deslogado: não chama
  const l = await H.novaPagina(b, { logado: false });
  await l.goto(H.PAGINA); await l.waitForSelector('#entrar-google:not([hidden])'); await l.waitForTimeout(200);
  ok(await rpcs(l) === 0, 'login screen does not register access');
  await l.context().close();
  // banco sem a função
  const r = await H.novaPagina(b, { extra: { semFuncaoAcesso: true } });
  await r.goto(H.PAGINA); await H.prontos(r); await r.waitForTimeout(300);
  ok(await r.isVisible('#tela-treino') && await r.isHidden('#toast') && !r.errs.length, 'missing function: app opens silently', r.errs.join());
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
