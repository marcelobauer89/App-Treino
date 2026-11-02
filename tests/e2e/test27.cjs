// Dashboard de monitoramento (admin.html).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ck = (id, u, tipo, inicio) => ({ id, usuario_id: u, tipo, inicio, fim: inicio.replace(/T(\d\d)/, (m, h) => `T${String(+h + 1).padStart(2, '0')}`), sem_horario: false, recuperacao: 4, retroativo: false });
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: [[], ['t1'], ['t2', 'jiu'], ['bike'], ['t3', 'jiu'], [], []], dias_jiu: [2, 4], sem_peso: ['Superman', 'Prancha'] },
    { id: 'u2', nome: 'Ana Souza', email: 'ana@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-10T12:00:00Z', acessos: 12, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u3', nome: 'Bruno Lima', email: 'bruno@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-09-01T12:00:00Z', acessos: 1, semana: null, dias_jiu: [], sem_peso: [] },
    { id: 'u4', nome: '', email: 'novo@exemplo.com', cadastro: '2026-10-20T12:00:00Z', ultimo_acesso: null, acessos: 0, semana: null, dias_jiu: [2, 4], sem_peso: [] },
  ],
  checkins: [
    ck('c1', 'u1', 't1', '2026-10-20T07:00:00'), ck('c2', 'u1', 'jiu', '2026-10-21T19:00:00'), ck('c3', 'u1', 't2', '2026-10-14T07:00:00'),
    ck('c4', 'u1', 'bike', '2026-10-01T07:00:00'), ck('c5', 'u2', 't1', '2026-10-10T08:00:00'), ck('c6', 'u2', 'jiu', '2026-09-28T08:00:00'),
  ],
  eventos: [
    { usuario_id: 'u1', tipo: 'sessao', dados: { navegador: 'Safari', sistema: 'iOS', instalado: true }, criado_em: '2026-10-21T10:00:00Z' },
    { usuario_id: 'u1', tipo: 'recorde', dados: { exercicio: 'Supino' }, criado_em: '2026-10-20T10:30:00Z' },
    { usuario_id: 'u1', tipo: 'sessao_perdida', dados: { horas_desde: 30, navegador: 'Instagram', sistema: 'iOS' }, criado_em: '2026-10-19T10:00:00Z' },
    { usuario_id: 'u1', tipo: 'tela', dados: { tela: 'dashboard' }, criado_em: '2026-10-19T10:01:00Z' },
  ],
};
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const T = new Date('2026-10-21T15:00:00');

  // 1. Deslogado: botão de entrar com redirect para admin.html
  let p = await H.novaPagina(b, { logado: false });
  await p.clock.install({ time: T });
  await p.goto(ADMIN); await p.waitForSelector('#entrar');
  ok(await p.locator('#painel').isHidden(), 'painel escondido sem login');
  await p.click('#entrar'); await p.waitForTimeout(100);
  let db = await H.banco(p);
  ok(db.oauth && db.oauth.options.redirectTo.endsWith('/admin.html'), 'redirectTo admin.html', db.oauth && db.oauth.options.redirectTo);
  await p.context().close();

  // 2. Logado mas não admin
  p = await H.novaPagina(b, { extra: { admin: { ...ADM, ids: [] } } });
  await p.clock.install({ time: T });
  await p.goto(ADMIN); await p.waitForSelector('text=Acesso restrito');
  ok(await p.locator('#painel').isHidden(), 'não admin não vê painel');
  db = await H.banco(p);
  ok(!db.log.includes('rpc:admin_usuarios'), 'não chama admin_* sem ser admin');
  ok(p.errs.length === 0, 'sem erros (não admin)', p.errs.join(' | '));
  await p.context().close();

  // 3. Falha ao carregar
  p = await H.novaPagina(b, { extra: { admin: { ...ADM, falhar: true } } });
  await p.goto(ADMIN); await p.waitForSelector('#tentar');
  ok(/Não foi possível/.test(await txt(p, '#estado')), 'estado de erro com tentar de novo');
  await p.context().close();

  // 4. Admin, celular e computador, claro e escuro
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 360, height: 760 }, { width: 1280, height: 900 }]) {
    p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: T });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    const tag = `${scheme}-${viewport.width}`;
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0, `${tag}: sem rolagem horizontal`, String(sw));
    // Números: 2 colunas no celular, último na linha inteira; texto curto só no celular
    const caixas = await p.locator('#kpis .kpi').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
    const ctxs = await p.locator('#kpis .kpi .ctx').allInnerTexts();
    const larguraKpis = await p.locator('#kpis').evaluate((e) => e.getBoundingClientRect().width);
    if (viewport.width < 720) {
      ok(caixas[0].y === caixas[1].y && caixas[2].y === caixas[3].y && caixas[2].y > caixas[0].y && caixas[0].x < caixas[1].x, `${tag}: números em 2 colunas`);
      ok(Math.abs(caixas[4].w - larguraKpis) < 1 && caixas[4].y > caixas[2].y, `${tag}: último card na linha inteira`);
      ok(!/nos últimos/.test(ctxs.join(' ')) && /do planejado/.test(ctxs[3]) && !/semana montada/.test(ctxs[3]), `${tag}: textos curtos`, ctxs.join(' | ').replace(/\s+/g, ' '));
      const kpisAlt = await p.locator('#kpis').evaluate((e) => e.getBoundingClientRect().height);
      ok(kpisAlt < 520, `${tag}: 7 números ocupam menos de 520 px`, String(Math.round(kpisAlt)));
      // Cartão compacto
      await p.click('#tab-usuarios'); 
      const alts = await p.locator('#usuarios-corpo tr').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      ok(alts.every((h) => h < 100), `${tag}: cartões abaixo de 100 px`, alts.join(','));
      const resumo = await txt(p, '#usuarios-corpo tr:first-child .resumo-cel');
      ok(resumo === 'hoje · 4 check-ins · 16% do plano', `${tag}: resumo do cartão`, resumo);
      ok(await p.locator('#usuarios-corpo td[data-rotulo="Acessos"]').first().isHidden(), `${tag}: colunas extras ocultas`);
      const sit = await p.locator('#usuarios-corpo tr:first-child .situacao').boundingBox();
      const nome = await p.locator('#usuarios-corpo tr:first-child .quem b').boundingBox();
      ok(sit.y < nome.y + nome.height && sit.x > nome.x, `${tag}: situação na linha do nome, à direita`);
      ok(await txt(p, '#usuarios-corpo tr:nth-child(4) .resumo-cel') === 'sem uso · 0 check-ins · 0% do plano', `${tag}: resumo de quem nunca usou`);
    } else {
      ok(caixas.length === 7 && new Set(caixas.map((c) => Math.round(c.y))).size === 2 && caixas.slice(0, 4).every((c) => c.y === caixas[0].y), `${tag}: 7 números em 2 linhas (4 + 3) no computador`);
      ok(/nos últimos 30 dias/.test(ctxs[0]) && /semana montada/.test(ctxs[3]), `${tag}: textos longos no computador`);
      await p.click('#tab-usuarios'); 
      ok(await p.locator('#usuarios th').count() === 8 && await p.locator('#usuarios thead').isVisible() && await p.locator('#usuarios-corpo .resumo-cel').first().isHidden(), `${tag}: tabela intacta`);
    }
    await p.click('#tab-geral'); 
    // "Tudo": sem período anterior, sem variação e sem "null"
    await p.click('[data-periodo="tudo"]');
    const kTudo = await p.locator('#kpis .kpi').allInnerTexts();
    ok(!kTudo.join(' ').includes('null') && await p.locator('#kpis .delta').count() === 0 && !kTudo.some((k) => /·\s*$/.test(k.trim())), `${tag}: Tudo sem null nem variação`, kTudo.join(' | ').replace(/\s+/g, ' '));
    if (viewport.width >= 720) ok(/desde o início/.test(kTudo[0]), `${tag}: Tudo mostra "desde o início"`);
    await p.click('[data-periodo="30"]');
    if (scheme === 'light' && viewport.width === 375) {
      const k = await p.locator('#kpis .kpi').allInnerTexts();
      ok(/2\s*de 4/.test(k[0]), 'ativos 30d = 2 de 4', k[0]);
      ok(/^Check-ins\s*6/.test(k[1].trim()), 'check-ins 30d = 6', k[1]);
      ok(/50%/.test(k[4]) && /1 de 2/.test(k[4]), 'retenção: 1 de 2', k[4]);
      ok(/Atualizado às \d\d:\d\d/.test(await txt(p, '#atualizado')), 'atualizado às');
      await p.click('[data-periodo="7"]');
      const k7 = await p.locator('#kpis .kpi').allInnerTexts();
      ok(/1\s*de 4/.test(k7[0]) && /^Check-ins\s*2/.test(k7[1].trim()), '7 dias: 1 ativo, 2 check-ins', k7.slice(0, 2).join(' / '));
      ok(/\d/.test(k7[1]) && await p.locator('#kpis .delta').count() >= 3, 'delta vs período anterior');
      await p.click('[data-periodo="90"]');
      ok((await txt(p, '#g1-titulo')).includes('semana'), '90 dias agrupa por semana');
      await p.click('[data-periodo="30"]');
      // tabela do gráfico
      await p.click('[data-alternar="g1"]');
      ok(await p.locator('#g1-tabela').isVisible() && await p.locator('#g1').isHidden(), 'ver tabela');
      const linha20 = await p.locator('#g1-tabela tr', { hasText: '20' }).first().innerText();
      ok(/1\s+0\s+0\s+0\s+0\s+1/.test(linha20.replace(/\t/g, ' ')), 'tabela: 20/out 1 musc', linha20);
      await p.click('[data-alternar="g1"]');
      // situações
      await p.click('#tab-usuarios'); 
      const sit = await p.locator('#usuarios-corpo .situacao').allInnerTexts();
      ok(sit.join('|') === 'Ativo|Em risco|Inativo|Nunca usou', 'situações ordenadas por último uso', sit.join('|'));
      // busca
      await p.fill('#busca', 'ana'); 
      ok(await p.locator('#usuarios-corpo tr').count() === 1, 'busca filtra');
      await p.fill('#busca', 'zzz');
      ok((await txt(p, '#usuarios-corpo')).includes('Nenhum usuário encontrado'), 'busca vazia');
      await p.fill('#busca', '');
      // ordenação mobile
      await p.selectOption('#ordenar-cel', 'nome');
      const nomes = await p.locator('#usuarios-corpo .quem b').allInnerTexts();
      ok(nomes[0] === 'Ana Souza', 'ordenar por nome', nomes.join(','));
      // CSV
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csv')]);
      const csv = require('fs').readFileSync(await dl.path(), 'utf8');
      ok(csv.split('\n').length === 6 && csv.includes('"ana@exemplo.com"') && dl.suggestedFilename().startsWith('usuarios-2026-10-21'), 'CSV exportado', dl.suggestedFilename());
      // detalhe
      await p.locator('#usuarios-corpo tr', { hasText: 'Marcelo' }).click();
      await p.waitForSelector('#detalhe[open]');
      const det = await txt(p, '#detalhe');
      ok(det.includes('Superman') && det.includes('Novo recorde em Supino') && det.includes('Precisou entrar de novo'), 'detalhe: sem peso, recorde, sessão perdida');
      ok(!det.includes('Abriu a tela'), 'detalhe sem eventos de tela');
      ok(det.includes('último treino 21 de out'), 'detalhe mostra último treino');
      ok(await p.locator('.mapa i[data-n="1"]').count() === 4, 'mapa com 4 dias de check-in', String(await p.locator('.mapa i[data-n="1"]').count()));
      await p.waitForTimeout(400); await p.screenshot({ path: `adm-${tag}-detalhe.png` });
      await p.click('[data-fechar]');
      ok(!(await p.locator('#detalhe').evaluate((d) => d.open)), 'fecha detalhe');
    }
    await p.click('#tab-geral'); 
    await p.screenshot({ path: `adm-${tag}.png`, fullPage: true });
    if (viewport.width === 1280) {
      await p.locator('#g1 svg').hover({ position: { x: 500, y: 100 } });
      ok(await p.locator('#g1 .dica').isVisible(), `${tag}: dica no hover`);
      await p.screenshot({ path: `adm-${tag}-dica.png` });
      await p.click('#tab-usuarios'); 
      await p.locator('#usuarios th[data-col="acessos"] button').click();
      ok((await p.locator('#usuarios-corpo .quem b').first().innerText()) === 'Marcelo Bauer', 'ordenar por acessos (desc)');
      ok(await p.locator('#usuarios th[data-col="acessos"]').getAttribute('aria-sort') === 'descending', 'aria-sort');
    }
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
