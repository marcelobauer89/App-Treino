// Opção "Sem peso" por exercício.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const card = (p, nome) => p.locator('.ex', { has: p.locator('h3', { hasText: nome }) });
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const cargas = [{ usuario_id: 'u1', data: '2026-10-21', treino: 't1', series: { Superman: [{ carga: 5 }] } }];
    const aberto = { id: 'ab', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-21T09:30:00', fim: null, sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: {} };
    const p = await H.novaPagina(b, { scheme, checkins: scheme === 'light' ? [aberto] : [], extra: { cargas } });
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') }); // quarta: Treino 1
    await p.goto(H.PAGINA); await H.prontos(p); await p.evaluate(() => document.fonts.ready);
    const sup = card(p, 'Superman');
    ok((await txt(p, '.ex:nth-child(7) .log-btn')).includes('Hoje: 5'), `${scheme}: weight shown before`);
    await sup.locator('.log-btn').click();
    ok(await p.isVisible('#log-dialog [data-sem-peso]') && await p.isVisible('#kg-0'), `${scheme}: switch and inputs visible`);
    await p.screenshot({ path: `sp-${scheme}-off.png` });
    await p.locator('#log-dialog .sem-peso-linha').click();
    await H.gravacoes(p);
    ok(await p.locator('#log-dialog [data-campo]').count() === 0 && (await txt(p, '#log-body')).includes('Feito hoje'), `${scheme}: inputs hidden when checked`);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.matches('[data-sem-peso]')), `${scheme}: focus stays on switch`);
    let db = await H.banco(p);
    ok(JSON.stringify(db.perfis[0].sem_peso) === '["Superman"]', `${scheme}: saved to profile`, JSON.stringify(db.perfis[0].sem_peso));
    await p.screenshot({ path: `sp-${scheme}-on.png` });
    await p.click('[data-concluir]');
    await p.waitForTimeout(100); // o cartão é atualizado no evento "close" do painel
    ok((await txt(p, '.ex:nth-child(7) .log-btn')) === 'Feito hoje' && await p.isHidden('#log-dialog'), `${scheme}: no-weight exercise with weight today shows Feito hoje`, await txt(p, '.ex:nth-child(7) .log-btn'));
    ok((await txt(p, '.ex:nth-child(1) .log-btn')) === 'Terminei o exercício', `${scheme}: button renamed`, await txt(p, '.ex:nth-child(1) .log-btn'));
    ok((await H.banco(p)).cargas[0].series.Superman[0].carga === 5, `${scheme}: old weight kept`);
    await sup.scrollIntoViewIfNeeded(); await p.screenshot({ path: `sp-${scheme}-card.png` });
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, `${scheme}: no horizontal scroll`);
    if (scheme === 'light') {
      // encerrar: resumo ignora Superman (7 de 8 pedem peso)
      await p.click('#ativo [data-encerrar]');
      ok((await txt(p, '#enc-body')).includes('1 de 8 exercícios feitos'), 'finish summary counts done exercises', (await txt(p, '#enc-body')).slice(0, 100));
      await p.click('[data-confirmar-enc]'); await H.gravacoes(p);
      // dashboard detalhe
      await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(300);
      await p.click('#dia-lista [data-ck]');
      ok((await txt(p, '.ck-corpo')).includes('Superman 5 kg') || (await txt(p, '.ck-corpo')).includes('Superman'), 'dashboard detail lists exercise');
      await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(200);
      // persiste após recarregar e em outro dia
      await p.clock.setSystemTime(new Date('2026-10-28T10:00:00'));
      await p.reload(); await H.prontos(p);
      ok((await txt(p, '.ex:nth-child(7) .log-btn')) === 'Terminei o exercício', 'next week: no-weight exercise asks to finish');
      // terminar exercício sem peso: marca como feito, sem pedir peso
      await card(p, 'Superman').locator('.log-btn').click();
      ok(await p.locator('#log-dialog [data-campo]').count() === 0 && (await txt(p, '#log-body')).includes('toque em Concluir para marcar como feito'), 'no-weight panel asks to conclude');
      await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
      ok((await txt(p, '.ex:nth-child(7) .log-btn')) === 'Feito hoje', 'concluded no-weight exercise shows Feito hoje');
      let reg = (await H.banco(p)).cargas.find((r) => r.data === '2026-10-28');
      ok(reg && JSON.stringify(reg.series.Superman) === '[{"feito":true}]', 'saved as feito', JSON.stringify(reg && reg.series));
      await p.screenshot({ path: 'sp-light-feito.png' });
      await card(p, 'Superman').locator('.log-btn').click();
      ok((await txt(p, '#log-body')).includes('Feito hoje'), 'panel shows done');
      await p.screenshot({ path: 'sp-light-painel-feito.png' });
      await p.click('[data-desfazer]'); await H.gravacoes(p);
      ok((await txt(p, '#log-body')).includes('toque em Concluir'), 'undo returns to not done');
      reg = (await H.banco(p)).cargas.find((r) => r.data === '2026-10-28');
      ok(!reg.series.Superman, 'undo removes feito');
      await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
      ok((await txt(p, '.ex:nth-child(7) .log-btn')) === 'Feito hoje', 'concluded again');
      await p.reload(); await H.prontos(p);
      ok((await txt(p, '.ex:nth-child(7) .log-btn')) === 'Feito hoje', 'done persists after reload');
      // desmarcar volta os campos
      await card(p, 'Superman').locator('.log-btn').click();
      await p.locator('#log-dialog .sem-peso-linha').click(); await H.gravacoes(p);
      ok(await p.isVisible('#kg-0') && await p.inputValue('#kg-0') === '5' && (await p.inputValue('#kg-1')) === '', 'unchecking brings inputs back with last weight (feito ignored)');
      db = await H.banco(p);
      ok(JSON.stringify(db.perfis[0].sem_peso) === '[]', 'unchecked saved');
      // teclado: espaço no switch
      await p.focus('#log-dialog [data-sem-peso]'); await p.keyboard.press('Space'); await H.gravacoes(p);
      ok(await p.locator('#log-dialog [data-campo]').count() === 0, 'keyboard toggles the switch');
      await p.click('[data-concluir]');
      // detalhe mostra "sem peso" para exercício sem carga
      await p.clock.setSystemTime(new Date('2026-10-28T11:00:00'));
      await p.click('#fab-checkin'); await p.click('[data-salvar-form]'); await H.gravacoes(p);
      await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(300);
      ok(await p.locator('#dia-lista [data-ck]').count() === 1, 'check-in saved');
    }
    ok(!p.errs.length, `${scheme}: no errors`, p.errs.join());
    await p.context().close();
  }
  // detalhe "sem peso" num dia com outro peso registrado
  const d = await H.novaPagina(b, { checkins: [{ id: 'c', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-21T08:00:00', fim: '2026-10-21T09:00:00', sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: {} }],
    extra: { perfis: [{ id: 'u1', nome: 'M', email: 'm@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], sem_peso: ['Superman'] }], cargas: [{ usuario_id: 'u1', data: '2026-10-21', treino: 't1', series: { Puxada: [{ carga: 40 }] } }] } });
  await d.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await d.goto(H.PAGINA + '#dashboard'); await H.prontos(d); await d.waitForTimeout(300);
  await d.click('#dia-lista [data-ck]');
  const det = await txt(d, '.ck-corpo');
  ok(det.includes('Superman sem peso') && det.includes('Escorpião sem registro'), 'detail shows "sem peso" vs "sem registro"', det.slice(0, 200));
  await d.context().close();
  // banco sem a coluna
  const r = await H.novaPagina(b, { extra: { semColunaSemPeso: true } });
  await r.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await r.goto(H.PAGINA); await H.prontos(r);
  await card(r, 'Superman').locator('.log-btn').click();
  await r.locator('#log-dialog .sem-peso-linha').click(); await H.gravacoes(r); await r.waitForTimeout(100);
  ok((await txt(r, '#toast')).includes('Para salvar essa opção, rode de novo o supabase/schema.sql'), 'missing column message', await txt(r, '#toast'));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
