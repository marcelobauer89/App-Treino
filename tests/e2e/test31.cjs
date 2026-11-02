// Filtro "Hoje" e ícones de informação nos gráficos (admin.html).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ck = (id, u, tipo, inicio) => ({ id, usuario_id: u, tipo, inicio, fim: null, sem_horario: false, recuperacao: 4, retroativo: false });
// 21/10/2026 é quarta-feira (getDay 3).
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T07:05:00', acessos: 40, semana: [[], ['t1'], ['t1'], ['t2', 'jiu'], ['t3'], [], []], dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u2', nome: 'Ana Souza', email: 'a@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-21T07:30:00', acessos: 12, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u3', nome: 'Bruno Lima', email: 'b@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-21T13:05:00', acessos: 3, semana: [[], ['t1'], [], [], [], [], []], dias_jiu: [], sem_peso: [] },
  ],
  checkins: [ck('c1', 'u1', 't2', '2026-10-21T07:10:00'), ck('c2', 'u1', 'jiu', '2026-10-21T12:30:00'), ck('c3', 'u2', 't1', '2026-10-21T07:40:00'), ck('c4', 'u1', 't1', '2026-10-20T08:00:00')],
  eventos: [{ usuario_id: 'u3', tipo: 'sessao', dados: {}, criado_em: '2026-10-21T13:05:00' }, { usuario_id: 'u1', tipo: 'sessao', dados: {}, criado_em: '2026-10-21T07:05:00' }],
};
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: new Date('2026-10-21T15:00:00') });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    const botoes = await p.locator('[data-periodo]').allInnerTexts();
    ok(botoes.join('|') === 'Hoje|7 dias|30 dias|90 dias|Tudo', `${tag}: botões de período`, botoes.join('|'));
    await p.click('[data-periodo="hoje"]');
    ok(await p.locator('[data-periodo="hoje"]').getAttribute('aria-pressed') === 'true', `${tag}: Hoje pressionado`);
    const k = (await p.locator('#kpis .kpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(/^Usuários ativos 3 de 3/.test(k[0]) && /2 mais que o período anterior/.test(k[0]), `${tag}: 3 ativos hoje, +2 vs ontem`, k[0]);
    ok(/^Check-ins 3/.test(k[1]) && /2 mais/.test(k[1]), `${tag}: 3 check-ins, +2`, k[1]);
    ok(/^Treinos por usuário 1,0/.test(k[2]) && !/semana/.test(k[2]), `${tag}: treinos por usuário`, k[2]);
    ok(/^Aderência ao plano 100 ?%/.test(k[3]), `${tag}: aderência pelo plano do dia (descanso fora)`, k[3]);
    if (viewport.width >= 720) ok(k[0].includes('hoje') && k[3].includes('planejado para hoje'), `${tag}: textos de hoje`);
    await p.locator('#kpis .info').first().click();
    ok((await txt(p, '#info-k1')).includes('A seta compara com ontem'), `${tag}: balão compara com ontem`);
    await p.locator('#kpis .info').nth(3).click();
    ok((await txt(p, '#info-k4')).includes('para hoje') && (await txt(p, '#info-k4')).includes('dia de descanso'), `${tag}: balão de aderência explica hoje`);
    await p.keyboard.press('Escape');
    // gráficos por hora
    ok((await txt(p, '#g1-titulo')) === 'Check-ins por hora' && (await txt(p, '#g2-titulo')) === 'Usuários ativos por hora', `${tag}: títulos por hora`);
    ok((await txt(p, '#g2-nota')) === 'Ativo: abriu o app ou fez check-in na hora.', `${tag}: nota na hora`);
    await p.click('[data-alternar="g1"]');
    const t1 = (await p.locator('#g1-tabela tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(t1.length === 24 && t1[7] === '07h–08h 2 0 0 0 0 2' && t1[12] === '12h–13h 0 1 0 0 0 1' && t1[23].startsWith('23h–00h'), `${tag}: tabela de check-ins por hora`, `${t1.length} ${t1[7]} | ${t1[12]}`);
    await p.click('[data-alternar="g1"]');
    await p.click('[data-alternar="g2"]');
    const t2 = (await p.locator('#g2-tabela tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(t2[7] === '07h–08h 2' && t2[12] === '12h–13h 1' && t2[13] === '13h–14h 1' && t2[8] === '08h–09h 0', `${tag}: ativos por hora`, `${t2[7]} | ${t2[12]} | ${t2[13]}`);
    await p.click('[data-alternar="g2"]');
    // usuários: descanso aparece como —
    await p.click('#tab-usuarios');
    await p.fill('#busca', 'bruno');
    ok((await txt(p, '#usuarios-corpo')).includes('—'), `${tag}: aderência — em dia de descanso`, await txt(p, '#usuarios-corpo'));
    await p.fill('#busca', '');
    await p.click('#tab-geral');
    // ícones dos gráficos
    const ig = p.locator('.graficos:not(.listas-geral) .info');
    ok(await ig.count() === 4, `${tag}: 4 ícones nos gráficos (check-ins, ativos, treinos mais feitos, jornadas)`);
    await ig.nth(0).click();
    let g = await txt(p, '#info-g1');
    ok(g.includes('cada hora de hoje') && g.includes('Cada cor é um tipo de treino'), `${tag}: info check-ins (hora)`, g.slice(0, 60));
    const bx = await p.locator('#info-g1').boundingBox(); const cx = await p.locator('#info-g1').evaluate((e) => e.parentElement.getBoundingClientRect().right);
    ok(bx.x >= 0 && bx.x + bx.width <= Math.min(viewport.width - 16, cx) + 0.5, `${tag}: balão do gráfico dentro do card`, `${Math.round(bx.x)}..${Math.round(bx.x + bx.width)}`);
    if (viewport.width === 375 || scheme === 'dark') await p.screenshot({ path: `hoje-${tag}-info.png` });
    await ig.nth(1).click();
    ok(await p.locator('.info-txt:not([hidden])').count() === 1 && (await txt(p, '#info-g2')).includes('Cada pessoa conta uma vez'), `${tag}: um aberto por vez (gráficos)`);
    await p.keyboard.press('Escape');
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: Esc fecha`);
    await p.locator('#kpis .info').first().click(); await ig.nth(0).click();
    ok(await p.locator('.info-txt:not([hidden])').count() === 1 && await p.locator('#info-g1').isVisible(), `${tag}: abrir gráfico fecha o do KPI`);
    await p.mouse.click(3, 3);
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: tocar fora fecha`);
    // CSV
    await p.click('#tab-usuarios');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csv')]);
    ok(dl.suggestedFilename() === 'usuarios-2026-10-21-hoje.csv', `${tag}: CSV hoje`, dl.suggestedFilename());
    await p.screenshot({ path: `hoje-${tag}.png`, fullPage: true });
    await p.click('#tab-geral');
    // outras unidades
    await p.click('[data-periodo="30"]');
    ok((await txt(p, '#info-g1')).includes('cada dia do período') && (await txt(p, '#g2-nota')).endsWith('no dia.') && (await txt(p, '#g1-titulo')) === 'Check-ins por dia', `${tag}: 30 dias por dia`);
    ok(/^Treinos por semana/.test(await txt(p, '#kpis .kpi:nth-child(3)')), `${tag}: 30 dias volta a treinos por semana`);
    await p.click('[data-periodo="90"]');
    ok((await txt(p, '#info-g1')).includes('cada semana do período') && (await txt(p, '#info-g1')).includes('de segunda a domingo') && (await txt(p, '#g2-nota')).endsWith('na semana.'), `${tag}: 90 dias por semana`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0 && p.errs.length === 0, `${tag}: sem rolagem e sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
