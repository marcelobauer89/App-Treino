// Surf: check-in, fora da semana padrão, Minha semana opcional, Dashboard e painel.
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
    ok(!/Surf/.test(await txt(p, '#dias')), `${scheme}: surf não está na semana padrão`);
    // Check-in
    await p.click('#fab-checkin');
    await p.click('#form-body .mais-tipos summary'); // RF-69: Surf fica em "Outras atividades"
    const opcoes = (await p.locator('#form-body .opcao').allInnerTexts()).map((t) => t.replace(/\s+/g, ''));
    ok(opcoes.join('|').includes('CCardio|MMuayThai|SSurf|FFutebol|VFutvôlei'), `${scheme}: Surf no check-in, entre muay thai e futebol`, opcoes.join('|'));
    await p.check('input[name="f-tipo"][value="surf"]', { force: true });
    ok((await p.inputValue('#f-dur')) === '90', `${scheme}: duração padrão 90 min`, await p.inputValue('#f-dur'));
    await p.waitForTimeout(300); await p.screenshot({ path: `${H.SAIDA}/surf-form-${scheme}.png` });
    await p.click('[data-salvar-form]'); await H.gravacoes(p);
    let db = await H.banco(p);
    ok(db.checkins.some((c) => c.tipo === 'surf'), `${scheme}: check-in de surf gravado`);
    ok(/Check-in de Surf salvo/.test(await txt(p, '#toast')), `${scheme}: toast`, await txt(p, '#toast'));
    // Dashboard
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    ok((await p.locator('.cal-dia.hoje .selo.surf').count()) === 1 && (await txt(p, '.cal-dia.hoje .selo.surf')) === 'S', `${scheme}: selo S no calendário`);
    ok(/Surf/.test(await txt(p, '.legenda-cal')), `${scheme}: legenda do calendário`);
    ok(/Surf 1 extra/.test(await txt(p, '#metas')), `${scheme}: "Esta semana" conta como extra`, await txt(p, '#metas'));
    ok(/Surf 1/.test(await txt(p, '#barras')) && (await txt(p, '#barras')).indexOf('Muay Thai') < (await txt(p, '#barras')).indexOf('Surf'), `${scheme}: barras do mês`, await txt(p, '#barras'));
    const cor = await p.locator('.cal-dia.hoje .selo.surf').evaluate((e) => getComputedStyle(e).backgroundColor);
    ok(cor === 'rgb(200, 74, 164)', `${scheme}: cor do selo`, cor);
    await p.screenshot({ path: `${H.SAIDA}/surf-dash-${scheme}.png`, fullPage: true });
    // Minha semana: surf na paleta, colocar na quarta
    await H.voce(p, 'semana');
    ok((await p.locator('#paleta [data-arrastar="surf"]').count()) === 1, `${scheme}: Surf na paleta da semana`);
    await p.click('[data-adicionar="3"]');
    await p.click('[data-escolher="surf"]');
    await p.click('#ativ-body [data-fechar]'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(db.perfis[0].semana[3].includes('surf'), `${scheme}: surf salvo na quarta`, JSON.stringify(db.perfis[0].semana));
    await p.click('[data-tela="treino"]'); await p.waitForTimeout(150);
    ok(/Treino 1 \+ Surf/.test(await txt(p, '#atividade')), `${scheme}: título do dia`, await txt(p, '#atividade'));
    await p.click('#semana-det > summary'); await p.waitForTimeout(80); // RF-69: a semana começa recolhida
    ok(/Surf/.test(await p.locator('#dias .dia.hoje .tag-feito').innerText().catch(() => '')), `${scheme}: dia marca surf como feito`, await txt(p, '#dias .dia.hoje'));
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    ok(/Surf 1 de 1/.test(await txt(p, '#metas')), `${scheme}: meta "1 de 1" com surf no plano`, await txt(p, '#metas'));
    ok(p.errs.length === 0, `${scheme}: sem erros no app`, p.errs.join(' | '));
    await p.context().close();
  }
  // Painel
  const ADM = {
    ids: ['u1'],
    usuarios: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] }],
    checkins: [{ usuario_id: 'u1', tipo: 'surf', inicio: '2026-10-20T07:00:00', fim: '2026-10-20T08:30:00' }],
    eventos: [{ usuario_id: 'u1', tipo: 'checkin_criado', dados: { tipo: 'surf' }, criado_em: '2026-10-20T08:30:00Z' }],
  };
  const a = await H.novaPagina(b, { extra: { admin: ADM }, viewport: { width: 1280, height: 900 } });
  await a.clock.install({ time: T });
  await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
  ok(/Surf/.test(await txt(a, '.legenda')), 'painel: legenda com Surf');
  ok((await a.locator('#g1 [style*="--surf"], #g1 [fill*="--surf"]').count()) >= 1, 'painel: segmento de surf no gráfico');
  ok(a.errs.length === 0, 'painel: sem erros', a.errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
