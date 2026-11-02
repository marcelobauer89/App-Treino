// Recordes pessoais no exercício.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const card = (p, nome) => p.locator('.ex', { has: p.locator('h3', { hasText: nome }) });
const seloVisivel = (p, n) => p.locator(`#kg-${n} ~ .selo-recorde`).isVisible();
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const cargas = [
      { usuario_id: 'u1', data: '2026-10-07', treino: 't1', series: { Puxada: [{ carga: 50 }, { carga: 60 }, { carga: 55 }], Superman: [{ carga: 0 }] } },
      { usuario_id: 'u1', data: '2026-10-14', treino: 't1', series: { Puxada: [{ carga: 55 }, { carga: 60 }, { carga: 60 }], 'Remada inversa': [{ carga: 0 }] } },
    ];
    const legado = { id: 'L', usuario_id: 'u1', tipo: 't1', inicio: '2026-09-30T12:00:00', fim: '2026-09-30T13:00:00', sem_horario: true, recuperacao: null, obs: '', retroativo: true, ultima_serie: null, series: { 'Rosca bíceps': [{ carga: 12 }] } };
    const p = await H.novaPagina(b, { scheme, checkins: [legado], extra: { cargas } });
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') }); // quarta: Treino 1
    await p.goto(H.PAGINA); await H.prontos(p); await p.evaluate(() => document.fonts.ready);
    // linha de recorde no painel (60 kg, primeira vez em 07/10)
    await card(p, 'Puxada').locator('.log-btn').click();
    ok((await txt(p, '.log-recorde')) === 'Recorde: 60 kg em 07/10', `${scheme}: record line`, await txt(p, '.log-recorde'));
    ok(!(await seloVisivel(p, 0)) && !(await seloVisivel(p, 1)), `${scheme}: prefilled equal values are not records`);
    await p.fill('#kg-1', '60');
    ok(!(await seloVisivel(p, 1)), `${scheme}: tie is not a record`);
    await p.fill('#kg-2', '62,5');
    ok(await seloVisivel(p, 2), `${scheme}: badge shows while typing above record`);
    await p.waitForTimeout(400); await p.screenshot({ path: `rec-${scheme}-painel.png` });
    await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
    ok((await txt(p, '#toast')) === 'Novo recorde em Puxada: 62,5 kg (antes 60 kg).', `${scheme}: toast on conclude`, await txt(p, '#toast'));
    const btn = card(p, 'Puxada').locator('.log-btn');
    ok(await btn.locator('.trofeu').count() === 1 && (await btn.innerText()).includes('62,5'), `${scheme}: trophy on card`);
    ok((await btn.locator('.sr-only').textContent()).includes('novo recorde'), `${scheme}: screen-reader text`);
    await btn.scrollIntoViewIfNeeded(); await p.screenshot({ path: `rec-${scheme}-card.png` });
    if (scheme === 'light') {
      // reabrir e concluir sem mudar: sem novo aviso
      await btn.click(); await p.evaluate(() => { document.getElementById('toast').hidden = true; });
      ok((await txt(p, '.log-recorde')).includes('60 kg'), 'record line still the previous record (to beat today)');
      await p.click('[data-concluir]'); await p.waitForTimeout(100);
      ok(await p.isHidden('#toast'), 'no toast when reopening without increase');
      // primeiro registro não é recorde (Remada só tinha 0)
      await card(p, 'Remada inversa').locator('.log-btn').click();
      ok(await p.locator('.log-recorde').count() === 0, 'no record line without previous weight > 0');
      await p.fill('#kg-0', '20');
      ok(!(await seloVisivel(p, 0)), 'first real weight is not a record');
      await p.click('[data-concluir]'); await p.waitForTimeout(100);
      ok(await card(p, 'Remada inversa').locator('.trofeu').count() === 0 && await p.isHidden('#toast'), 'no trophy/toast on first weight');
      // recorde vindo de check-in antigo
      await card(p, 'Rosca bíceps').locator('.log-btn').click();
      ok((await txt(p, '.log-recorde')).includes('12 kg em 30/09'), 'record includes legacy check-in weights');
      await p.click('#log-dialog [data-fechar]');
      // sem peso: sem recorde
      await card(p, 'Superman').locator('.log-btn').click();
      await p.locator('#log-dialog .sem-peso-linha').click(); await H.gravacoes(p);
      ok(await p.locator('.log-recorde').count() === 0, 'no-weight exercise has no record');
      await p.click('#log-dialog [data-fechar]');
      // pelo Dashboard: editar 14/10 para 65 vira recorde naquele dia e muda o "a bater" de hoje
      const ck = { id: 'c14', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-14T10:00:00', fim: '2026-10-14T11:00:00', sem_horario: false, recuperacao: null, obs: '', retroativo: true, ultima_serie: null, series: {} };
      await p.evaluate((ck) => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.checkins.push(ck); localStorage.setItem('mock-supabase', JSON.stringify(d)); }, ck);
      await p.reload(); await H.prontos(p);
      await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(300);
      await p.click('[data-dia="2026-10-14"]'); await p.click('#dia-lista [data-ck="c14"]');
      await p.locator('.ck-ex-btn', { hasText: 'Puxada' }).click();
      ok((await txt(p, '.log-recorde')).includes('60 kg em 07/10'), 'dashboard panel: record before that day');
      await p.fill('#kg-0', '65'); ok(await seloVisivel(p, 0), 'dashboard panel: badge');
      await p.click('[data-concluir]'); await p.waitForTimeout(100); await H.gravacoes(p);
      ok((await txt(p, '#toast')).includes('Novo recorde em Puxada: 65 kg'), 'dashboard edit toast');
      ok(await p.locator('#tela-dashboard .trofeu').count() === 0, 'no record UI in the dashboard itself');
      await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(200);
      ok(await card(p, 'Puxada').locator('.trofeu').count() === 0, 'today 62,5 no longer a record after past 65');
      await card(p, 'Puxada').locator('.log-btn').click();
      ok((await txt(p, '.log-recorde')).includes('65 kg em 14/10'), 'record to beat updated');
      await p.click('#log-dialog [data-fechar]');
      ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'no horizontal scroll');
    }
    ok(!p.errs.length, `${scheme}: no errors`, p.errs.join());
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
