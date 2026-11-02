// Resumo semanal: o painel conta só quem vai receber (liberado e abriu o app nas últimas 4 semanas) e explica quem ficou de fora.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const AGORA = '2026-10-21T15:00:00'; // quarta: próximo envio sexta 23/10
const usuario = (id, nome, extra = {}) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-20T10:00:00Z', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, ...extra });
const ADM = {
  ids: ['u1'],
  usuarios: [
    usuario('u1', 'Marcelo'),
    usuario('u2', 'Ana', { ultimo_acesso: '2026-09-26T10:00:00Z' }),          // 27 dias antes da sexta: recebe
    usuario('u3', 'Bruno', { ultimo_acesso: '2026-09-10T10:00:00Z' }),        // sumiu (antes e depois do envio de 16/10)
    usuario('u4', 'Carla', { liberado: false }),                              // não liberado
    usuario('u5', 'Davi', { emails_resumo: false }),                          // desligou
    usuario('u6', 'Eva', { acessos: 0, ultimo_acesso: null }),                // nunca usou
  ],
  checkins: [], eventos: [], convites: [],
  emails: [{ usuario_id: 'u1', tipo: 'resumo_semanal', referencia: '2026-10-15', enviado_em: '2026-10-16T12:00:05Z', aberto_em: null, aberturas: 0, clicado_em: null, cliques: 0 }],
};
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    await p.click('#tab-emails'); await p.waitForTimeout(300);
    const prox = await txt(p, '#proximo-envio');
    ok(/vai para 2 pessoas: Marcelo, Ana\./.test(prox), `${scheme}: próximo resumo conta só quem vai receber`, prox);
    const fora = await txt(p, '#aba-emails');
    ok(/Bruno \(sem abrir o app há 4 semanas ou mais\)/.test(fora), `${scheme}: quem sumiu aparece com o motivo`);
    ok(/Carla \(não liberado\)/.test(fora), `${scheme}: não liberado aparece com o motivo`);
    ok(/Davi \(desligou o resumo\)/.test(fora) && /Eva \(ainda não usou o app\)/.test(fora), `${scheme}: motivos antigos continuam`);
    await p.screenshot({ path: `${H.SAIDA}/emails-regra-${scheme}.png`, fullPage: true });
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
