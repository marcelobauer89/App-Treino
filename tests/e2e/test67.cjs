// Painel com mais de 1.000 eventos e check-ins: busca em páginas e não perde os mais novos (ex.: objetivo escolhido hoje).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-11-02T15:00:00';
const usuario = (id, nome) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-11-02T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, videos_liberados: false });
// 2.500 eventos antigos (tela) e, por último, a escolha de hoje.
const antigos = Array.from({ length: 2500 }, (_, i) => ({ usuario_id: 'u2', tipo: 'tela', dados: { tela: 'treino' }, criado_em: new Date(Date.parse('2026-10-05T10:00:00Z') + i * 60000).toISOString() }));
const eventos = [...antigos, { usuario_id: 'u1', tipo: 'jornada_escolhida', dados: { jornada: 'hipertrofia', origem: 'trocar' }, criado_em: '2026-11-02T13:00:00Z' }];
const checkins = Array.from({ length: 1200 }, (_, i) => ({ usuario_id: 'u2', tipo: 'jiu', inicio: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T07:00:00`, fim: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T08:00:00` }))
  .concat([{ usuario_id: 'u1', tipo: 'surf', inicio: '2026-11-02T07:00:00', fim: '2026-11-02T08:00:00' }]);
const ADM = { ids: ['u1'], usuarios: [usuario('u1', 'Marcelo'), usuario('u2', 'Ana')], checkins, eventos, emails: [], convites: [] };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 1280, height: 900 }, extra: { admin: ADM, maxLinhas: 1000 } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])', { timeout: 20000 }); await p.waitForTimeout(300);
    const db = await H.banco(p);
    const paginas = db.log.filter((l) => l.startsWith('range:admin_eventos:'));
    ok(paginas.join(',') === 'range:admin_eventos:0-999,range:admin_eventos:1000-1999,range:admin_eventos:2000-2999', `${scheme}: eventos buscados em 3 páginas`, paginas.join(','));
    ok(db.log.filter((l) => l.startsWith('range:admin_checkins:')).length === 2, `${scheme}: check-ins buscados em 2 páginas`);
    const lista = await p.locator('#jornadas-lista li').evaluateAll((ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
    ok(/Hipertrofia ?1 ?100% 1 pessoa · 1 na troca/.test(lista[0] || ''), `${scheme}: Objetivos escolhidos mostra a escolha de hoje`, lista[0]);
    ok(/Surf/.test(await p.locator('#treinos-lista').innerText()), `${scheme}: check-in de hoje (depois dos 1.200) entra em Treinos mais feitos`);
    await p.click('#tab-usuarios'); await p.waitForTimeout(150);
    await p.click('[data-abrir="u1"]'); await p.waitForTimeout(200);
    ok(/Escolheu o objetivo Hipertrofia/.test(await p.locator('#det-atividade').innerText()), `${scheme}: atividade recente mostra a escolha`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Sem limite (menos de 1.000): uma página só, como antes.
  const p = await H.novaPagina(b, { extra: { admin: { ...ADM, eventos: eventos.slice(-10), checkins: checkins.slice(-5) } } });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
  ok((await H.banco(p)).log.filter((l) => l.startsWith('range:admin_eventos:')).length === 1, 'poucos eventos: uma página só');
  await p.context().close();
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
