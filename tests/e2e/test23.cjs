// Editar check-in e pesos pelo Dashboard.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ck = (id, tipo, ini, fim, extra = {}) => ({ id, usuario_id: 'u1', tipo, inicio: ini, fim, sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: {}, ...extra });
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const checkins = [
      ck('a', 't1', '2026-10-19T17:35:00', '2026-10-19T18:25:00', { recuperacao: 4 }),
      ck('j', 'jiu', '2026-10-19T19:00:00', '2026-10-19T20:00:00'),
      ck('s', 't1', '2026-10-12T12:00:00', '2026-10-12T13:00:00', { sem_horario: true, retroativo: true }),
    ];
    const cargas = [
      { usuario_id: 'u1', data: '2026-10-19', treino: 't1', series: { Puxada: [{ carga: 45 }, { carga: 55 }, { carga: 60 }], Superman: [{ feito: true }] } },
      { usuario_id: 'u1', data: '2026-10-12', treino: 't1', series: { Puxada: [{ carga: 40 }, { carga: 50 }, { carga: 50 }] } },
      { usuario_id: 'u1', data: '2026-10-21', treino: 't1', series: { Puxada: [{ carga: 70 }] } },
    ];
    const p = await H.novaPagina(b, { scheme, checkins, extra: { cargas, perfis: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], sem_peso: ['Superman'] }] } });
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
    await p.goto(H.PAGINA + '#dashboard'); await H.prontos(p); await p.evaluate(() => document.fonts.ready);
    await p.click('[data-dia="2026-10-19"]');
    await p.click('#dia-lista [data-ck="a"]');
    ok(await p.isVisible('[data-editar="a"]') && await p.locator('.ck-ex-btn').count() === 8, `${scheme}: edit button and tappable exercises`);
    await p.locator('#dia-lista').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `ed-${scheme}-detalhe.png` });
    // pesos daquele dia
    await p.locator('.ck-ex-btn', { hasText: 'Puxada' }).click();
    ok(await p.isVisible('#log-dialog') && (await txt(p, '.log-quando')).includes('19 de outubro'), `${scheme}: panel shows the check-in date`);
    ok(await p.inputValue('#kg-0') === '45' && await p.inputValue('#kg-2') === '60', `${scheme}: panel shows that day's weights (not today's 70)`);
    ok((await txt(p, '#log-dialog .log-hint')).includes('40 / 50 / 50'), `${scheme}: Última vez uses earlier dates only`, await txt(p, '#log-dialog .log-hint'));
    await p.waitForTimeout(400); await p.screenshot({ path: `ed-${scheme}-painel.png` });
    await p.fill('#kg-2', '62,5'); await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
    let db = await H.banco(p);
    const r19 = db.cargas.find((r) => r.data === '2026-10-19');
    ok(r19.series.Puxada[2].carga === 62.5 && db.cargas.find((r) => r.data === '2026-10-21').series.Puxada[0].carga === 70, `${scheme}: saved on that date only`);
    ok((await txt(p, '.ck-corpo')).includes('Puxada 45 / 55 / 62,5 kg') && await p.isVisible('[data-editar="a"]'), `${scheme}: detail updated and still expanded`);
    if (scheme === 'light') {
      // sem peso: desfazer o feito daquele dia
      await p.locator('.ck-ex-btn', { hasText: 'Superman' }).click();
      ok((await txt(p, '#log-body')).includes('Feito em 19 de outubro'), 'no-weight panel uses the date', await txt(p, '#log-body'));
      await p.click('[data-desfazer]'); await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
      ok((await txt(p, '.ck-corpo')).includes('Superman feito (sem peso)'), 'concluding again keeps done');
      await p.locator('.ck-ex-btn', { hasText: 'Superman' }).click();
      await p.click('[data-desfazer]'); await p.click('#log-dialog [data-fechar]'); await p.waitForTimeout(100); await H.gravacoes(p);
      ok((await txt(p, '.ck-corpo')).includes('Superman sem peso'), 'undo done for that day');
      // editar dados do check-in
      await p.click('[data-editar="a"]');
      ok((await txt(p, '#form-title')) === 'Editar check-in' && await p.inputValue('#f-inicio') === '17:35' && await p.inputValue('#f-dur') === '50', 'form prefilled');
      await p.waitForTimeout(400); await p.screenshot({ path: 'ed-light-form.png' });
      await p.fill('#f-inicio', '19:30'); await p.click('[data-salvar-form]');
      ok((await txt(p, '#f-erro')).includes('sobrepõe ao Jiu Jitsu'), 'overlap with another check-in refused');
      await p.fill('#f-inicio', '17:00'); await p.fill('#f-dur', '70');
      ok(await p.locator('input[name="f-rec"]').count() === 0, 'sem recuperação no formulário');
      await p.fill('#f-obs', 'Ajustei o horário');
      await p.click('[data-salvar-form]'); await H.gravacoes(p);
      db = await H.banco(p);
      const a = db.checkins.filter((c) => c.id === 'a');
      ok(a.length === 1 && db.checkins.length === 3 && a[0].inicio.startsWith('2026-10-19T17:00') && a[0].fim.startsWith('2026-10-19T18:10') && a[0].obs === 'Ajustei o horário', 'same record updated, no duplicate', JSON.stringify(a[0]).slice(0, 160));
      ok((await txt(p, '#toast')).includes('atualizado') && (await txt(p, '#dia-lista')).includes('Das 17:00 às 18:10'), 'list shows new time');
      // editar sem mudar o horário: não acusa sobreposição consigo mesmo
      await p.click('[data-editar="a"]'); await p.click('[data-salvar-form]');
      ok(await p.isHidden('#form-dialog'), 'saving without changes is fine (no self-overlap)');
      // data futura recusada; mudar a data move no calendário
      await p.click('[data-editar="a"]');
      await p.fill('#f-data', '2026-10-25'); await p.click('[data-salvar-form]');
      ok((await txt(p, '#f-erro')).includes('não pode ser no futuro'), 'future date refused');
      await p.fill('#f-data', '2026-10-20'); await p.click('[data-salvar-form]'); await H.gravacoes(p);
      ok((await txt(p, '[data-dia="2026-10-20"] .cal-selos')) === '1' && (await txt(p, '#dia-titulo')).includes('20 de outubro'), 'moved to the new date');
      ok((await H.banco(p)).checkins.find((c) => c.id === 'a').retroativo === true, 'retroativo recomputed');
      // sem horário ganha horário
      await p.click('[data-dia="2026-10-12"]'); await p.click('#dia-lista [data-ck="s"]');
      await p.click('[data-editar="s"]');
      ok(await p.inputValue('#f-inicio') === '12:00' && await p.inputValue('#f-dur') === '60', 'no-time check-in prefilled');
      await p.click('[data-salvar-form]'); await H.gravacoes(p);
      ok((await H.banco(p)).checkins.find((c) => c.id === 's').sem_horario === false && (await txt(p, '#dia-lista')).includes('Das 12:00 às 13:00'), 'no-time check-in gets time');
      // tela Treino continua usando hoje
      await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(200);
      await p.locator('.ex', { has: p.locator('h3', { hasText: 'Puxada' }) }).locator('.log-btn').click();
      ok(await p.inputValue('#kg-0') === '70' && await p.locator('.log-quando').count() === 0, 'Treino screen panel still uses today');
      await p.click('#log-dialog [data-fechar]');
      ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'no horizontal scroll');
    }
    ok(!p.errs.length, `${scheme}: no errors`, p.errs.join());
    await p.context().close();
  }
  // check-in aberto: sem botão de editar
  const q = await H.novaPagina(b, { checkins: [ck('o', 't2', '2026-10-21T09:00:00', null)] });
  await q.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await q.goto(H.PAGINA + '#dashboard'); await H.prontos(q); await q.waitForTimeout(300);
  await q.click('#dia-lista [data-ck="o"]');
  ok(await q.locator('[data-editar]').count() === 0 && await q.locator('.ck-acoes [data-encerrar]').count() === 1, 'open check-in: no edit, has Encerrar');
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
