// Muay Thai: check-in, Minha semana, Dashboard e painel.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const T = new Date('2026-10-21T20:00:00'); // quarta
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    // Check-in
    await p.click('#fab-checkin');
    const opcoes = await p.locator('#form-body .opcao').allInnerTexts();
    ok(opcoes.map((t) => t.replace(/\s+/g, '')).join('|').includes('JJiuJitsu|MMuayThai|SSurf|CCardio'), `${scheme}: Muay Thai no check-in, entre jiu e cardio`, opcoes.join('|'));
    await p.check('input[name="f-tipo"][value="muay"]', { force: true });
    ok((await p.inputValue('#f-dur')) === '60', `${scheme}: duração padrão 60 min`);
    await p.waitForTimeout(300); await p.screenshot({ path: `${H.SAIDA}/muay-form-${scheme}.png` });
    await p.click('[data-salvar-form]'); await H.gravacoes(p);
    let db = await H.banco(p);
    ok(db.checkins.some((c) => c.tipo === 'muay'), `${scheme}: check-in de muay thai gravado`);
    ok(/Check-in de Muay Thai salvo/.test(await txt(p, '#toast')), `${scheme}: toast`);
    // Dashboard
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    ok((await p.locator('.cal-dia.hoje .selo.muay').count()) === 1 && (await txt(p, '.cal-dia.hoje .selo.muay')) === 'M', `${scheme}: selo M no calendário`);
    ok(/Muay Thai/.test(await txt(p, '.legenda-cal')), `${scheme}: legenda do calendário`);
    ok(/Muay Thai 1 extra/.test(await txt(p, '#metas')), `${scheme}: "Esta semana" conta como extra (fora do plano)`, await txt(p, '#metas'));
    ok(/Muay Thai 1/.test(await txt(p, '#barras')) && /^1 Treino 1/.test(await txt(p, '#barras')), `${scheme}: barras do mês, treinos primeiro`, await txt(p, '#barras'));
    await p.click('.ck-head'); await p.waitForTimeout(100);
    ok((await txt(p, '.ck-head')).includes('Muay Thai'), `${scheme}: detalhe do dia`);
    await p.screenshot({ path: `${H.SAIDA}/muay-dash-${scheme}.png`, fullPage: true });
    // Minha semana: põe muay thai na quarta
    await H.voce(p, 'semana');
    ok((await p.locator('#paleta [data-arrastar="muay"]').count()) === 1, `${scheme}: Muay Thai na paleta da semana`);
    await p.click('[data-adicionar="3"]');
    await p.click('[data-escolher="muay"]');
    await p.click('#ativ-body [data-fechar]'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(db.perfis[0].semana[3].includes('muay'), `${scheme}: muay thai salvo na quarta`, JSON.stringify(db.perfis[0].semana));
    await p.click('[data-tela="treino"]'); await p.waitForTimeout(150);
    ok(/Treino 1 \+ Muay Thai/.test(await txt(p, '#atividade')), `${scheme}: título do dia`, await txt(p, '#atividade'));
    const qua = p.locator('#dias .dia.hoje');
    ok(/Muay Thai/.test(await txt(p, '#dias .dia.hoje')) && /muay thai/i.test(await txt(p, '#dias .dia.hoje .dia-info')), `${scheme}: semana mostra muay thai planejado`, await txt(p, '#dias .dia.hoje'));
    ok(/Muay Thai/.test(await qua.locator('.tag-feito').innerText().catch(() => '')), `${scheme}: dia marca muay thai como feito`, await txt(p, '#dias .dia.hoje'));
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    ok(/Muay Thai 1 de 1/.test(await txt(p, '#metas')), `${scheme}: meta "1 de 1" com muay thai no plano`, await txt(p, '#metas'));
    await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
    ok((await H.banco(p)).perfis[0].semana[3].includes('muay'), `${scheme}: semana com muay thai continua depois de recarregar`);
    ok(p.errs.length === 0, `${scheme}: sem erros no app`, p.errs.join(' | '));
    await p.context().close();
  }

  // Painel: gráfico empilhado com muay thai
  const ADM = {
    ids: ['u1'],
    usuarios: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] }],
    checkins: [
      { usuario_id: 'u1', tipo: 'muay', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00' },
      { usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T07:00:00', fim: '2026-10-20T08:00:00' },
    ],
    eventos: [{ usuario_id: 'u1', tipo: 'checkin_criado', dados: { tipo: 'muay' }, criado_em: '2026-10-20T19:00:00Z' }],
  };
  const a = await H.novaPagina(b, { extra: { admin: ADM }, viewport: { width: 1280, height: 900 } });
  await a.clock.install({ time: T });
  await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
  ok(/Muay Thai/.test(await txt(a, 'body')), 'painel: legenda com Muay Thai');
  ok((await a.locator('#g1 [style*="--muay"], #g1 [fill*="--muay"]').count()) >= 1, 'painel: segmento de muay thai no gráfico');
  await a.screenshot({ path: `${H.SAIDA}/muay-admin.png` });
  ok(a.errs.length === 0, 'painel: sem erros', a.errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
