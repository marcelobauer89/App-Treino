// Abas do monitoramento, Saúde do app (erros) e E-mails (resumo semanal).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ev = (u, tipo, quando, dados = {}) => ({ usuario_id: u, tipo, dados, criado_em: quando });
const AGORA = '2026-10-23T15:00:00';
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-23T14:00:00', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true },
    { id: 'u2', nome: 'Ana Souza', email: 'a@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-23T10:00:00', acessos: 3, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true },
    { id: 'u3', nome: 'Bruno Lima', email: 'b@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-01T10:00:00', acessos: 2, semana: null, dias_jiu: [], sem_peso: [], emails_resumo: false },
    { id: 'u4', nome: 'Carla Dias', email: 'c@x.com', cadastro: '2026-10-20T12:00:00Z', ultimo_acesso: null, acessos: 0, semana: null, dias_jiu: [], sem_peso: [], emails_resumo: true },
  ],
  checkins: [],
  eventos: [
    // erros: 3 iguais (2 usuários, hoje e ontem), 1 de salvar há 5 dias, 1 antigo (fora de 7 dias)
    ev('u1', 'erro', '2026-10-23T13:00:00', { origem: 'js', mensagem: "Cannot read properties of undefined (reading 'nome')", navegador: 'Safari', sistema: 'iOS' }),
    ev('u2', 'erro', '2026-10-23T09:30:00', { origem: 'js', mensagem: "Cannot read properties of undefined (reading 'nome')", navegador: 'Safari', sistema: 'iOS' }),
    ev('u1', 'erro', '2026-10-22T20:00:00', { origem: 'js', mensagem: "Cannot read properties of undefined (reading 'nome')", navegador: 'Chrome', sistema: 'Android' }),
    ev('u2', 'erro', '2026-10-18T10:00:00', { origem: 'salvar', mensagem: 'permission denied for table cargas', navegador: 'Chrome', sistema: 'Android' }),
    ev('u1', 'erro', '2026-10-05T10:00:00', { origem: 'presenca', mensagem: 'CHANNEL_ERROR: Unauthorized', navegador: 'Safari', sistema: 'macOS' }),
    ev('u2', 'sessao_perdida', '2026-10-21T08:00:00', { navegador: 'Instagram', sistema: 'iOS', horas_desde: 30 }),
    ev('u1', 'sessao_perdida', '2026-10-20T08:00:00', { navegador: 'Instagram', sistema: 'iOS', horas_desde: 50 }),
    ev('u2', 'sessao_perdida', '2026-10-19T08:00:00', { navegador: 'Safari', sistema: 'iOS', horas_desde: 200 }),
    ev('u1', 'sessao', '2026-10-23T14:00:00', {}),
    // ruído de rede de versões antigas do app: não conta
    ev('u1', 'erro', '2026-10-23T14:48:00', { origem: 'presenca', mensagem: 'CHANNEL_ERROR: channel error: transport failure', navegador: 'Chrome', sistema: 'iOS' }),
    ev('u2', 'erro', '2026-10-21T20:11:00', { origem: 'presenca', mensagem: 'CHANNEL_ERROR: channel error: transport failure (não reconectou em 30 s)', navegador: 'Safari', sistema: 'iOS' }),
  ],
  emails: [
    { usuario_id: 'u1', tipo: 'resumo_semanal', referencia: '2026-10-22', enviado_em: '2026-10-23T12:00:05Z', aberto_em: '2026-10-23T12:10:00Z', aberturas: 2, clicado_em: '2026-10-23T12:11:00Z', cliques: 1 },
    { usuario_id: 'u2', tipo: 'resumo_semanal', referencia: '2026-10-22', enviado_em: '2026-10-23T12:00:06Z', aberto_em: '2026-10-23T13:00:00Z', aberturas: 1, clicado_em: null, cliques: 0 },
    { usuario_id: 'u3', tipo: 'resumo_semanal', referencia: '2026-10-15', enviado_em: '2026-10-16T12:00:05Z', aberto_em: null, aberturas: 0, clicado_em: null, cliques: 0 },
    { usuario_id: 'u1', tipo: 'resumo_semanal', referencia: '2026-10-15', enviado_em: '2026-10-16T12:00:06Z', aberto_em: null, aberturas: 0, clicado_em: null, cliques: 0 },
  ],
};
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    // abas
    const nomes = [];
    for (const t of await p.locator('[role="tab"]').all()) nomes.push((await t.evaluate((e) => e.querySelector('.aba-longo') ? e.querySelector('.aba-longo').textContent : e.textContent)).trim());
    ok(nomes.join('|').replace(/Convites\d*/, 'Convites') === 'Visão geral|Usuários|Saúde do app|E-mails|Convites|Exercícios', `${tag}: 6 abas`, nomes.join('|'));
    const vis = await p.locator('[role="tab"]').evaluateAll((ts) => ts.map((t) => { const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
    ok(vis.every(Boolean), `${tag}: as 6 abas cabem na tela`);
    if (viewport.width < 720) ok(await p.locator('#tab-geral .aba-curto').isVisible() && (await p.getByRole('tab', { name: 'Visão geral' }).count()) === 1, `${tag}: rótulo curto no celular, nome completo acessível`);
    ok(await p.locator('#aba-geral').isVisible() && await p.locator('#aba-usuarios').isHidden() && await p.locator('#tab-geral').getAttribute('aria-selected') === 'true', `${tag}: começa na visão geral`);
    ok(await txt(p, '#alerta-saude') === '3' && (await p.locator('#alerta-saude').getAttribute('aria-label')) === '3 erros críticos nas últimas 24 horas', `${tag}: bolinha com 3 erros em 24 h`, await txt(p, '#alerta-saude'));
    await p.click('#tab-usuarios');
    ok(await p.locator('#aba-usuarios').isVisible() && await p.locator('#aba-geral').isHidden() && (await p.evaluate(() => location.hash)) === '#usuarios', `${tag}: aba usuários e endereço`);
    await p.locator('#tab-usuarios').focus(); await p.keyboard.press('ArrowRight');
    ok(await p.locator('#aba-saude').isVisible() && await p.evaluate(() => document.activeElement.id) === 'tab-saude', `${tag}: seta para a direita troca de aba`);
    await p.keyboard.press('End');
    ok(await p.locator('#aba-exercicios').isVisible(), `${tag}: End vai para a última`);
    await p.keyboard.press('Home');
    ok(await p.locator('#aba-geral').isVisible() && (await p.evaluate(() => location.hash)) === '', `${tag}: Home volta à primeira`);
    // Saúde, 7 dias
    await p.click('[data-periodo="7"]');
    await p.click('#tab-saude');
    const ks = (await p.locator('#kpis-saude .kpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(ks.length === 2 && /^Erros críticos 4/.test(ks[0]) && /^Usuários afetados 2 de 4/.test(ks[1]), `${tag}: números da saúde (7 dias)`, ks.join(' | '));
    ok(await p.locator('#kpis-saude .delta.desce').count() >= 1, `${tag}: mais erros aparece em vermelho`);
    const grupos = p.locator('#erros-lista .item-lista');
    ok(await grupos.count() === 2, `${tag}: 2 grupos de erro`);
    const g1 = (await grupos.first().innerText()).replace(/\s+/g, ' ');
    ok(/Cannot read properties of undefined \(reading 'nome'\) 3 vezes/.test(g1) && g1.includes('Acontecendo agora') && g1.includes('2 usuários') && g1.includes('Safari · iOS') && g1.includes('última há 2 h'), `${tag}: grupo principal`, g1);
    const g2 = (await grupos.nth(1).innerText()).replace(/\s+/g, ' ');
    ok(g2.includes('Falha ao salvar') && !g2.includes('Acontecendo agora') && g2.includes('rode de novo o supabase/schema.sql'), `${tag}: grupo antigo sem selo, com dica do banco`, g2);
    ok(!g1.includes('schema.sql'), `${tag}: erro de programação sem dica do banco`);
    await grupos.first().locator('[data-erro]').click();
    const occ = await grupos.first().locator('.item-detalhe li').allInnerTexts();
    ok(occ.length === 3 && occ[0].includes('Marcelo Bauer') && occ[1].includes('Ana Souza') && await grupos.first().locator('[data-erro]').getAttribute('aria-expanded') === 'true', `${tag}: ocorrências com usuário`, occ.join(' / ').replace(/\s+/g, ' '));
    ok(!(await txt(p, '#erros-lista')).includes('transport failure'), `${tag}: transport failure não aparece nos grupos`);
    await grupos.first().locator('[data-abrir-usuario]').nth(1).click();
    await p.waitForSelector('#detalhe[open]');
    ok((await txt(p, '#det-nome')) === 'Ana Souza', `${tag}: tocar no nome abre o detalhe`);
    ok((await txt(p, '#detalhe')).includes('resumo por e-mail ligado'), `${tag}: detalhe mostra o resumo`);
    ok(!(await txt(p, '#detalhe')).includes('transport failure'), `${tag}: nem na atividade do usuário`);
    await p.click('[data-fechar]');
    ok((await p.locator('#sessoes-lista').count()) === 0 && !/Sessões perdidas/.test(await txt(p, '#aba-saude')), `${tag}: sem sessões perdidas na saúde`);
    await p.click('[data-alternar="g3"]');
    const tg = (await p.locator('#g3-tabela tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(tg.length === 7 && tg[6].endsWith(' 2') && tg[5].endsWith(' 1'), `${tag}: erros por dia`, tg.join(' | '));
    await p.click('[data-alternar="g3"]');
    await p.locator('#aba-saude .info').first().click();
    ok(await p.locator('.info-txt:not([hidden])').count() === 1, `${tag}: info na saúde`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    await p.screenshot({ path: `saude-${tag}.png`, fullPage: true });
    await p.click('[data-periodo="hoje"]');
    ok(/^Erros críticos 2/.test(await txt(p, '#kpis-saude .kpi')) && (await txt(p, '#g3-titulo')) === 'Erros críticos por hora', `${tag}: saúde com Hoje`);
    await p.click('[data-periodo="30"]');
    ok(/^Erros críticos 4/.test(await txt(p, '#kpis-saude .kpi')), `${tag}: em 30 dias, presença não conta como erro`, await txt(p, '#kpis-saude .kpi'));
    // E-mails, 30 dias
    await p.click('#tab-emails');
    const prox = await txt(p, '#proximo-envio');
    ok(prox.includes('Próximo resumo semanal') && prox.includes('Sexta, 30 de out, às 9h') && prox.includes('daqui a 6 dias e 21 h') && prox.includes('Resume de 23 de out a 29 de out') && prox.includes('2 pessoas: Marcelo, Ana'), `${tag}: cartão do próximo envio`, prox);
    const ke = (await p.locator('#kpis-emails .kpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(/^Enviados 4/.test(ke[0]) && /^Abertos 50 ?%/.test(ke[1]) && /^Clicaram 25 ?%/.test(ke[2]) && /^Resumo desligado 1 de 4/.test(ke[3]), `${tag}: números dos e-mails`, ke.join(' | '));
    const eds = (await p.locator('#envios-lista .item-lista').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(eds.length === 2 && eds[0].startsWith('Semana de 16 de out a 22 de out 2 enviados') && eds[0].includes('abertos 2 (100%)') && eds[0].includes('cliques 1 (50%)'), `${tag}: lista de envios`, eds.join(' | '));
    ok(await p.locator('#envios-lista .item-lista').first().getAttribute('aria-current') === 'true', `${tag}: semana mais recente selecionada`);
    let dest = (await p.locator('#destinatarios .item-lista').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(dest.length === 2 && dest[0].startsWith('Marcelo Bauer Clicou') && dest[0].includes('2 aberturas') && dest[1].startsWith('Ana Souza Abriu'), `${tag}: quem recebeu, por situação`, dest.join(' | '));
    const naoRec = await txt(p, '#destinatarios .nota');
    ok(naoRec.includes('Bruno Lima (desligou o resumo)') && naoRec.includes('Carla Dias (ainda não usou o app)'), `${tag}: quem não recebeu e por quê`, naoRec);
    await p.screenshot({ path: `emails-${tag}.png`, fullPage: true });
    await p.locator('[data-edicao="2026-10-15"]').click();
    dest = (await p.locator('#destinatarios .item-lista').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok((await txt(p, '#dest-titulo')).includes('9 de out a 15 de out') && dest.every((d) => d.includes('Enviado')) && dest.length === 2, `${tag}: trocar de semana`, dest.join(' | '));
    await p.click('[data-periodo="hoje"]');
    ok(await p.locator('#envios-lista .item-lista').count() === 1, `${tag}: Hoje mostra só o envio de hoje`);
    await p.click('[data-periodo="7"]');
    // recarregar mantém a aba
    await p.reload(); await p.waitForSelector('#painel:not([hidden])');
    ok(await p.locator('#aba-emails').isVisible() && await p.locator('#tab-emails').getAttribute('aria-selected') === 'true', `${tag}: recarregar mantém a aba`);
    // visão geral volta com gráficos desenhados na largura certa
    await p.click('#tab-geral');
    const w = await p.locator('#g1 svg, #g1 .vazio-graf').first().evaluate((e) => e.getBoundingClientRect().width);
    ok(w > 200, `${tag}: gráficos aparecem ao voltar`, String(w));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0 && p.errs.length === 0, `${tag}: sem rolagem e sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Próximo envio: véspera e no próprio dia
  for (const [quando, esperado] of [['2026-10-22T20:00:00', /Amanhã, sexta, 23 de out, às 9h.*daqui a 16 h/], ['2026-10-23T11:30:00', /Hoje, sexta, 23 de out, às 9h.*daqui a 30 min/], ['2026-10-23T12:00:00', /Sexta, 30 de out, às 9h/]]) {
    const q = await H.novaPagina(b, { extra: { admin: ADM } });
    await q.clock.install({ time: new Date(`${quando}Z`) });
    await q.goto(ADMIN + '#emails'); await q.waitForSelector('#painel:not([hidden])');
    const t = await txt(q, '#proximo-envio');
    ok(esperado.test(t), `próximo envio em ${quando}Z`, t);
    if (quando.startsWith('2026-10-22')) {
      await q.clock.runFor(61 * 60000); await q.waitForTimeout(100);
      ok((await txt(q, '#proximo-envio')).includes('daqui a 14 h e 59 min'), 'contagem atualiza sozinha', await txt(q, '#proximo-envio'));
    }
    await q.context().close();
  }

  // banco sem admin_emails
  const p = await H.novaPagina(b, { extra: { admin: { ...ADM, semEmails: true } } });
  await p.goto(ADMIN + '#emails'); await p.waitForSelector('#painel:not([hidden])');
  ok((await txt(p, '#emails-aviso')).includes('rode de novo o supabase/schema.sql') && await p.locator('#aba-emails').isVisible(), 'sem admin_emails: aviso na aba');
  await p.click('#tab-usuarios');
  ok(await p.locator('#usuarios-corpo tr').count() === 4 && p.errs.length === 0, 'sem admin_emails: resto funciona', p.errs.join(' | '));
  await p.context().close();
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
