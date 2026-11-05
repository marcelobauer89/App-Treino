// Visão geral: "Sumiram" + "Quem sumiu" (possíveis churn: sem usar o app há 7+ dias, não só sem check-in) e "Recordes" + "Quem mais evoluiu".
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const AGORA = new Date('2026-10-27T15:00:00');
const dia = (n) => { const d = new Date(AGORA); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const ck = (u, n, tipo = 't1') => ({ usuario_id: u, tipo, inicio: `${dia(n)}T19:00:00`, fim: `${dia(n)}T20:00:00` });
const rec = (u, n, ex) => ({ usuario_id: u, tipo: 'recorde', dados: { treino: 't1', exercicio: ex }, criado_em: `${dia(n)}T20:00:00Z` });
const U = (id, nome, ultimo = AGORA.toISOString()) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: ultimo, acessos: 10, semana: null, dias_jiu: [], sem_peso: [] });
const sessao = (u, n) => ({ usuario_id: u, tipo: 'sessao', dados: {}, criado_em: `${dia(n)}T12:00:00Z` });
const ADM = {
  ids: ['u1'],
  usuarios: [U('u1', 'Marcelo Bauer'), U('u2', 'Alessandra Machado', `${dia(2)}T12:00:00Z`), U('u3', 'Bruno Lima'), U('u4', 'Carla Dias', `${dia(40)}T12:00:00Z`), U('u5', 'Davi Rocha', `${dia(3)}T12:00:00Z`), U('u6', 'Eva Nunes', null),
    U('u20', 'Fábio Souza', `${dia(9)}T12:00:00Z`), U('u21', 'Gabi Torres', `${dia(8)}T12:00:00Z`)],
  checkins: [
    ck('u1', 20), // admin: nunca aparece em "sumiu"
    ck('u2', 9, 'jiu'), ck('u2', 12), ck('u2', 15), ck('u2', 19), ck('u2', 22), ck('u2', 26), // check-in há 9 dias, mas usou o app há 2 (pesos): não sumiu
    ck('u3', 1), ck('u3', 10), // treinou ontem: não sumiu
    ck('u4', 40), // parou há mais de 4 semanas: fora
    ck('u5', 8, 'surf'), ck('u5', 14), ck('u5', 21), // check-in há 8 dias, recorde há 3: não sumiu
    // u6 nunca usou
    ck('u20', 9, 'jiu'), ck('u20', 12), ck('u20', 15), ck('u20', 19), ck('u20', 22), ck('u20', 26), // sumiu: sem usar há 9 dias, usava 2×/sem
    // u21 só abria o app (sem check-in): sumiu há 8 dias, usava 1×/sem
  ],
  eventos: [
    rec('u2', 2, 'Puxada'), rec('u2', 3, 'Supino no chão'), rec('u2', 4, 'Puxada'), rec('u2', 5, 'Agachamento'), rec('u2', 6, 'Remada inversa'),
    rec('u3', 1, 'Puxada'), rec('u3', 2, 'Deadlift'),
    rec('u5', 3, 'Agachamento'),
    rec('u3', 10, 'Puxada'), // período anterior (7 dias)
    rec('u4', 45, 'Puxada'), // fora de 30 dias
    sessao('u21', 8), sessao('u21', 14), sessao('u21', 21),
  ],
};
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 375, height: 800 }], ['dark', { width: 1280, height: 900 }]]) {
    const tag = `${scheme}-${vp.width}`;
    const p = await H.novaPagina(b, { scheme, viewport: vp, extra: { admin: ADM } });
    await p.clock.install({ time: AGORA });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    await p.click('[data-periodo="7"]'); await p.waitForTimeout(200);
    const ks = (await p.locator('#kpis .kpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const kS = ks.find((k) => k.startsWith('Sumiram')) || '', kR = ks.find((k) => k.startsWith('Recordes')) || '';
    ok(ks.length === 7, `${tag}: 7 cartões`, String(ks.length));
    ok(/^Sumiram 2 de 5/.test(kS) && /sem usar/.test(kS), `${tag}: cartão Sumiram (2 de 5 que usaram o app em 4 semanas)`, kS);
    ok(/^Recordes 8/.test(kR) && /3 pessoas/.test(kR) && /mais que o período anterior/.test(kR), `${tag}: cartão Recordes (7 dias) com delta`, kR);
    const sumiu = (await p.locator('#sumiu-lista .item-lista').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(sumiu.length === 2 && /^Fábio Souza 9 dias/.test(sumiu[0]) && /último uso há 9 dias/.test(sumiu[0]) && /último check-in há 9 dias \(Jiu Jitsu\)/.test(sumiu[0]) && /usava o app 2× por semana/.test(sumiu[0])
      && /^Gabi Torres 8 dias/.test(sumiu[1]) && /nunca fez check-in/.test(sumiu[1]) && /usava o app 1× por semana/.test(sumiu[1]), `${tag}: lista de quem sumiu (sem usar o app), ordem pelo ritmo`, sumiu.join(' | '));
    ok(!/Marcelo|Alessandra|Bruno|Carla|Davi|Eva/.test(await txt(p, '#sumiu-lista')), `${tag}: fora admin, quem usou o app sem check-in (Alessandra, Davi), quem treinou ontem, quem parou há muito e quem nunca usou`);
    const ev = (await p.locator('#evoluiu-lista .item-lista').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(ev.length === 3 && /^Alessandra Machado 5 recordes/.test(ev[0]) && /Puxada, Supino no chão, Agachamento e mais 1/.test(ev[0]) && /^Bruno Lima 2 recordes/.test(ev[1]) && /^Davi Rocha 1 recorde/.test(ev[2]), `${tag}: ranking de recordes`, ev.join(' | '));
    ok((await p.locator('#evoluiu-exercicios').count()) === 0 && !/Exercícios com mais recordes/.test(await txt(p, '#aba-geral')), `${tag}: sem a linha de exercícios com mais recordes`);
    for (const [h, info] of [['#sumiu-titulo', '#info-sumiu'], ['#evoluiu-titulo', '#info-evoluiu']]) {
      ok((await p.locator(`.cartao ${h}`).count()) === 1, `${tag}: título ${h} dentro do cartão`);
      ok(await p.locator(info).isHidden(), `${tag}: descrição ${info} escondida`);
      await p.click(`[data-info="${info.slice(1)}"]`);
      ok(await p.locator(info).isVisible() && (await txt(p, info)).length > 40, `${tag}: "i" mostra a descrição ${info}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(100);
      ok(await p.locator(info).isHidden(), `${tag}: Esc esconde ${info}`);
    }
    ok(!/kg/.test(await txt(p, '#evoluiu-lista')), `${tag}: sem pesos`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: sem rolagem horizontal`);
    await p.screenshot({ path: `${H.SAIDA}/geral-novas-${tag}.png`, fullPage: true });
    // Período muda recordes, não "sumiu"
    await p.click('[data-periodo="30"]'); await p.waitForTimeout(200);
    ok(/^Recordes 9/.test(await txt(p, '#kpis .kpi:nth-child(7)')) && /^Sumiram 2 de 5/.test(await txt(p, '#kpis .kpi:nth-child(6)')), `${tag}: 30 dias conta 9 recordes; sumiram igual`, await txt(p, '#kpis .kpi:nth-child(7)'));
    await p.click('[data-periodo="hoje"]'); await p.waitForTimeout(200);
    ok(/Nenhum recorde no período/.test(await txt(p, '#evoluiu-lista')), `${tag}: período sem recordes`);
    // Nome abre o detalhe
    await p.click('#sumiu-lista [data-abrir-usuario="u20"]'); await p.waitForSelector('#detalhe[open]');
    ok((await txt(p, '#det-nome')) === 'Fábio Souza', `${tag}: nome abre o detalhe`);
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Ver todos (mais de 5 no ranking) e lista vazia de sumidos
  const muitos = JSON.parse(JSON.stringify(ADM));
  muitos.usuarios = muitos.usuarios.filter((u) => !['u20', 'u21'].includes(u.id));
  for (let i = 7; i <= 13; i++) { muitos.usuarios.push(U(`u${i}`, `Pessoa ${i}`)); muitos.eventos.push(rec(`u${i}`, 1, 'Halo')); }
  muitos.checkins = [ck('u2', 1), ck('u3', 2)];
  const q = await H.novaPagina(b, { extra: { admin: muitos }, viewport: { width: 1280, height: 900 } });
  await q.clock.install({ time: AGORA });
  await q.goto(ADMIN); await q.waitForSelector('#painel:not([hidden])'); await q.waitForTimeout(300);
  ok((await q.locator('#evoluiu-lista .item-lista').count()) === 5 && /Ver todos \(10\)/.test(await txt(q, '[data-evoluiu-todos]')), 'ranking mostra 5 e "Ver todos"');
  await q.click('[data-evoluiu-todos]');
  ok((await q.locator('#evoluiu-lista .item-lista').count()) === 10 && /Mostrar menos/.test(await txt(q, '[data-evoluiu-todos]')), 'Ver todos mostra o ranking inteiro');
  ok(/Ninguém sumiu/.test(await txt(q, '#sumiu-lista')), 'ninguém sumiu: mensagem', await txt(q, '#sumiu-lista'));
  ok(q.errs.length === 0, 'sem erros', q.errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
