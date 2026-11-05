// Check-ins de Futebol (selo F) e Futvôlei (selo V): no formulário, na celebração com a cor própria, na Minha semana,
// no Dashboard (metas da semana e barras do mês), na legenda do calendário e no painel do administrador.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T20:00:00'; // quarta-feira
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '');
// Semana com futebol na terça e futvôlei no sábado (além do padrão).
const SEMANA = [['bike'], ['t2'], ['jiu', 'futebol'], ['t1'], ['jiu'], ['t3'], ['futvolei']];

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, celebracao: true, extra: { perfis: [{ id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], semana: SEMANA }] } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);

    // Formulário: as duas opções novas, com o selo.
    await p.click('#fab-checkin'); await p.waitForTimeout(100);
    for (const [t, nome, selo] of [['futebol', 'Futebol', 'F'], ['futvolei', 'Futvôlei', 'V']]) {
      const op = p.locator(`input[name="f-tipo"][value="${t}"]`);
      const rot = await p.locator(`#form-body .opcao:has(input[value="${t}"])`).innerText().catch(() => '');
      ok(await op.count() === 1 && rot.includes(nome) && rot.includes(selo), `${scheme}: opção ${nome} no check-in`, rot.replace(/\s+/g, ' '));
    }
    // Check-in de futebol: celebração na cor do futebol.
    await p.check('input[name="f-tipo"][value="futebol"]', { force: true });
    await p.fill('#f-data', '2026-10-27'); await p.fill('#f-inicio', '19:00');
    await p.click('[data-salvar-form]'); await p.waitForTimeout(250);
    const cor = await p.evaluate(() => getComputedStyle(document.querySelector('.cel')).getPropertyValue('--cor').trim());
    ok((await p.getAttribute('.cel', 'data-grupo')) === 'futebol' && (await txt(p, '.cel-tipo')) === 'Futebol', `${scheme}: celebração do futebol`, cor);
    const db = await H.banco(p);
    ok(db.checkins.some((c) => c.tipo === 'futebol' && c.inicio.startsWith('2026-10-27T19:00')), `${scheme}: check-in de futebol gravado`);
    await p.click('[data-cel-fechar]'); await p.waitForTimeout(150);
    // Duração padrão de 90 min.
    ok(db.checkins.some((c) => c.tipo === 'futebol' && /20:30/.test(c.fim || '')), `${scheme}: futebol com 1 h 30 min por padrão`, (db.checkins.find((c) => c.tipo === 'futebol') || {}).fim);

    // Cores próprias (diferentes entre si e das outras atividades).
    const cores = await p.evaluate(() => ['musc', 'jiu', 'bike', 'muay', 'surf', 'futebol', 'futvolei'].map((g) => getComputedStyle(document.documentElement).getPropertyValue(`--${g}`).trim()));
    ok(cores.every(Boolean) && new Set(cores).size === 7, `${scheme}: cada atividade com a sua cor`, cores.slice(5).join(' '));

    // Dashboard: metas da semana com futebol e futvôlei (estão na semana) e as barras do mês.
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(200);
    const metas = await txt(p, '#metas');
    ok(/Futebol 1 de 1/.test(metas) && /Futvôlei 0 de 1/.test(metas), `${scheme}: metas da semana`, metas);
    ok(/Futebol/.test(await txt(p, '#barras')) && /Futvôlei/.test(await txt(p, '#barras')), `${scheme}: barras do mês`);
    ok(/Futebol/.test(await txt(p, '.legenda-cal')) && /Futvôlei/.test(await txt(p, '.legenda-cal')), `${scheme}: legenda do calendário`);
    await p.screenshot({ path: `${H.SAIDA}/futebol-dashboard-${scheme}.png`, fullPage: true });

    // Minha semana: as duas na paleta e no dia certo.
    await H.voce(p, 'semana');
    ok(await p.locator('#paleta [data-arrastar="futebol"]').count() === 1 && await p.locator('#paleta [data-arrastar="futvolei"]').count() === 1, `${scheme}: paleta da semana com futebol e futvôlei`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Painel: os tipos novos no gráfico e no ranking de treinos.
  {
    const ck = (u, tipo, d) => ({ id: `${u}${tipo}${d}`, usuario_id: u, tipo, inicio: `2026-10-${d}T19:00:00`, fim: `2026-10-${d}T20:30:00` });
    const U = (id, nome) => ({ id, nome, email: `${id}@exemplo.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T12:00:00Z', acessos: 3, semana: null, dias_jiu: [], sem_peso: [] });
    const ADM = { ids: ['u1'], usuarios: [U('u1', 'Pessoa Admin'), U('u2', 'Pessoa Dois')], checkins: [ck('u2', 'futebol', 26), ck('u2', 'futebol', 27), ck('u2', 'futvolei', 27)], eventos: [] };
    const p = await H.novaPagina(b, { viewport: { width: 1280, height: 900 }, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    await p.click('[data-periodo="7"]'); await p.waitForTimeout(200);
    const legenda = await txt(p, '.legenda');
    ok(/Futebol/.test(legenda) && /Futvôlei/.test(legenda), 'painel: legenda do gráfico', legenda);
    const rk = await txt(p, '#treinos-lista');
    ok(/Futebol/.test(rk) && /Futvôlei/.test(rk), 'painel: treinos mais feitos com futebol e futvôlei', rk);
    ok(!p.errs.length, 'painel: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
