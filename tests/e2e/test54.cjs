// Painel: card "Treinos mais feitos" (ranking por tipo de treino, segue o período).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T15:00:00';
const ck = (u, tipo, dia) => ({ usuario_id: u, tipo, inicio: `${dia}T19:00:00`, fim: `${dia}T20:00:00` });
const usuario = (id, nome) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true });
const ADM = {
  ids: ['u1'],
  usuarios: [usuario('u1', 'Marcelo'), usuario('u2', 'Ana'), usuario('u3', 'Bruno')],
  checkins: [
    ck('u1', 't1', '2026-10-27'), ck('u2', 't1', '2026-10-26'), ck('u1', 't1', '2026-10-20'), ck('u1', 't2', '2026-10-21'), ck('u1', 't2', '2026-10-14'),
    ck('u1', 'jiu', '2026-10-27'), ck('u2', 'jiu', '2026-10-22'), ck('u3', 'jiu', '2026-10-15'), ck('u3', 'jiu', '2026-10-08'),
    ck('u3', 'bike', '2026-10-25'), ck('u2', 'surf', '2026-10-24'),
    ck('u2', 'jiu', '2026-08-20'), // fora dos 30 dias, dentro dos 90
  ],
  eventos: [], emails: [], convites: [],
};
const linhas = (p) => p.locator('#treinos-lista li').evaluateAll((ls) => ls.map((l) => ({
  nome: l.querySelector('.rt-nome').textContent.trim(), num: l.querySelector('.rt-num').textContent.replace(/\s+/g, ' ').trim(),
  sub: l.querySelector('.rt-sub').textContent.trim(), larg: l.querySelector('.rt-barra') ? l.querySelector('.rt-barra').getBoundingClientRect().width : 0, zerado: l.classList.contains('zerado') })));
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    ok(await p.locator('#treinos-titulo').isVisible() && (await p.locator('#treinos-titulo').textContent()) === 'Treinos mais feitos', `${tag}: card na visão geral`);
    let l = await linhas(p);
    ok(l.map((x) => x.nome).join('|') === 'Musculação|Jiu Jitsu|Cardio|Surf|Muay Thai|Futebol|Futvôlei', `${tag}: ordem do mais feito ao menos (30 dias)`, l.map((x) => x.nome).join('|'));
    ok(l[0].num === '545%' && l[1].num === '436%' && l[2].num === '19%' && l[4].num === '00%', `${tag}: números e porcentagens`, l.map((x) => x.num).join(' / '));
    ok(l[0].sub === '2 pessoas · Treino 1: 3 · Treino 2: 2' && l[1].sub === '3 pessoas' && l[2].sub === '1 pessoa' && l[4].sub === 'nenhum check-in', `${tag}: pessoas e detalhe da musculação`, l.map((x) => x.sub).join(' / '));
    ok(l[0].larg > l[1].larg && l[1].larg > l[2].larg && Math.abs(l[2].larg - l[3].larg) < 1 && l[4].larg === 0 && l[4].zerado, `${tag}: barras proporcionais, sem barra quando zero`, l.map((x) => Math.round(x.larg)).join(','));
    const cores = await p.locator('#treinos-lista .rt-barra').evaluateAll((bs) => bs.map((x) => getComputedStyle(x).backgroundColor));
    ok(new Set(cores).size === 4, `${tag}: uma cor por tipo`, cores.join(' '));
    // info
    await p.click('[data-info="info-treinos"]');
    ok(await p.locator('#info-treinos').isVisible() && /porcentagem/.test(await p.locator('#info-treinos').textContent()), `${tag}: botão i explica o card`);
    await p.click('[data-info="info-treinos"]');
    await p.locator('#treinos-titulo').scrollIntoViewIfNeeded();
    await p.locator('#treinos-titulo').evaluate((e) => e.closest('section').scrollIntoView({ block: 'center' }));
    await p.locator('#treinos-titulo').evaluate((e) => e.closest('section')).then(() => {});
    await p.locator('section:has(#treinos-titulo)').screenshot({ path: `${H.SAIDA}/treinos-${tag}.png` });
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sobra <= 0, `${tag}: sem rolagem lateral`, String(sobra));
    // 90 dias: jiu empata com musculação
    await p.click('[data-periodo="90"]'); await p.waitForTimeout(200);
    l = await linhas(p);
    ok(l[0].num === '542%' && l[1].nome === 'Jiu Jitsu' && l[1].num === '542%' && l[1].sub === '3 pessoas', `${tag}: segue o período (90 dias)`, l.map((x) => x.nome + ' ' + x.num).join(' / '));
    // Hoje: nada
    await p.click('[data-periodo="hoje"]'); await p.waitForTimeout(200);
    ok(/Nenhum check-in no período/.test(await p.locator('#treinos-lista').textContent()), `${tag}: período sem check-in`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
