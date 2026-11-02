// Saúde do app só com erros críticos: o painel ignora o que é normal e o app nem registra.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const AGORA = '2026-10-23T15:00:00';
const ev = (u, tipo, quando, dados = {}) => ({ usuario_id: u, tipo, dados: { navegador: 'Safari', sistema: 'iOS', ...dados }, criado_em: quando });
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: AGORA, acessos: 40, semana: null, dias_jiu: [], sem_peso: [] },
    { id: 'u2', nome: 'Alessandra Machado', email: 'a@x.com', cadastro: '2026-10-20T12:00:00Z', ultimo_acesso: AGORA, acessos: 3, semana: null, dias_jiu: [], sem_peso: [] },
  ],
  checkins: [],
  eventos: [
    ev('u1', 'erro', '2026-10-23T14:00:00', { origem: 'presenca', mensagem: 'CHANNEL_ERROR: Unauthorized (não reconectou em 30 s)' }),
    ev('u1', 'erro', '2026-10-23T13:00:00', { origem: 'salvar', mensagem: 'TypeError: Failed to fetch' }),
    ev('u2', 'erro', '2026-10-23T12:00:00', { origem: 'promessa', mensagem: 'Load failed' }),
    ev('u2', 'erro', '2026-10-23T11:00:00', { origem: 'js', mensagem: 'Script error.' }),
    ev('u2', 'erro', '2026-10-23T10:30:00', { origem: 'js', mensagem: 'ResizeObserver loop completed with undelivered notifications.' }),
    ev('u2', 'erro', '2026-10-23T10:00:00', { origem: 'salvar', mensagem: 'The network connection was lost.' }),
    ev('u2', 'sessao_perdida', '2026-10-23T09:00:00', { horas_desde: 30 }),
    ev('u1', 'erro', '2026-10-23T08:00:00', { origem: 'js', mensagem: "Cannot read properties of undefined (reading 'tipo')" }),
    ev('u2', 'erro', '2026-10-22T20:00:00', { origem: 'salvar', mensagem: 'column perfis.surf does not exist' }),
  ],
};
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 375, height: 800 }], ['dark', { width: 1280, height: 900 }]]) {
    const tag = `${scheme}-${vp.width}`;
    const p = await H.novaPagina(b, { scheme, viewport: vp, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN + '#saude'); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    ok(await txt(p, '#alerta-saude') === '2', `${tag}: bolinha conta só os 2 críticos`, await txt(p, '#alerta-saude'));
    const ks = (await p.locator('#kpis-saude .kpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(ks.length === 2 && /^Erros críticos 2/.test(ks[0]) && /^Usuários afetados 2 de 2/.test(ks[1]), `${tag}: cartões`, ks.join(' | '));
    const lista = await txt(p, '#erros-lista');
    ok(/reading 'tipo'/.test(lista) && /perfis\.surf/.test(lista), `${tag}: os 2 críticos aparecem`, lista);
    ok(!/Failed to fetch|Load failed|Script error|ResizeObserver|network connection|CHANNEL_ERROR/.test(lista), `${tag}: erros comuns não aparecem`);
    ok((await p.locator('#erros-lista .item-dica').count()) === 1 && /schema\.sql/.test(await txt(p, '#erros-lista .item-dica')), `${tag}: dica do banco só no erro de banco`);
    ok(/só aparecem falhas do app/.test(await txt(p, '#aba-saude .saude-nota')), `${tag}: nota explica a regra`);
    ok(!/Sessões perdidas|Falhas do ao vivo/.test(await txt(p, '#aba-saude')), `${tag}: sem sessões perdidas e falhas do ao vivo`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(sw, `${tag}: sem rolagem horizontal`);
    await p.screenshot({ path: `${H.SAIDA}/saude-critica-${tag}.png`, fullPage: true });
    // Detalhe do usuário: sessão perdida sem alerta, erros comuns fora
    await p.click('#tab-usuarios'); await p.waitForTimeout(150);
    await p.click('#usuarios-corpo tr[data-usuario="u2"]'); await p.waitForSelector('#detalhe[open]');
    const det = await txt(p, '#detalhe');
    ok(!/Load failed|Script error|network connection/.test(det), `${tag}: detalhe sem erros comuns`);
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // App: erro comum não grava; erro real grava.
  const a = await H.novaPagina(b, {});
  await a.goto(H.PAGINA); await H.prontos(a); await a.waitForTimeout(300);
  await a.evaluate(() => {
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new TypeError('Failed to fetch') }));
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('Load failed') }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    window.dispatchEvent(new ErrorEvent('error', { message: "TypeError: Cannot read properties of null (reading 'x')" }));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Object.defineProperty && await a.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await a.waitForTimeout(800);
  const db = await H.banco(a);
  const erros = (db.eventos || []).filter((e) => e.tipo === 'erro').map((e) => e.dados.mensagem);
  ok(erros.length === 1 && /reading 'x'/.test(erros[0]), 'app: só o erro real é registrado', JSON.stringify(erros));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
