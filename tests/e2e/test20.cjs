// Pesos independentes do check-in: persistência, pesos antigos e banco sem a tabela cargas.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ex = (p, nome) => p.locator('.ex', { has: p.locator('h3', { hasText: nome }) });
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const T = '2026-10-21T10:00:00'; // quarta: Treino 1

  // persiste depois de recarregar e não cria check-in
  const p = await H.novaPagina(b);
  await p.clock.install({ time: new Date(T) });
  await p.goto(H.PAGINA); await H.prontos(p);
  await ex(p, 'Remada inversa').locator('.log-btn').click();
  await p.fill('#kg-0', '22,5'); await p.fill('#kg-1', '25');
  await p.click('[data-concluir]'); await H.gravacoes(p);
  await p.reload(); await H.prontos(p);
  ok((await txt(p, '.ex:nth-child(4) .log-btn')).includes('Hoje: 22,5 / 25 / – kg'), 'weights persist after reload', await txt(p, '.ex:nth-child(4) .log-btn'));
  let db = await H.banco(p);
  ok(db.checkins.length === 0 && db.cargas.length === 1, 'only cargas row, no check-in');
  // no dia seguinte vira "Última vez" e pré-preenche
  await p.clock.setSystemTime(new Date('2026-10-28T10:00:00'));
  await p.reload(); await H.prontos(p);
  await ex(p, 'Remada inversa').locator('.log-btn').click();
  ok(await p.inputValue('#kg-0') === '22,5' && (await txt(p, '#log-dialog .log-hint')).includes('22,5 / 25 / –'), 'next week prefill from cargas', await txt(p, '#log-dialog .log-hint'));
  await p.click('#log-dialog [data-fechar]');
  ok(!p.errs.length, 'no errors', p.errs.join());
  await p.context().close();

  // check-in antigo de hoje com pesos: editar uma série mantém as outras e o Dashboard mostra tudo
  const antigo = { id: 'c1', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-21T08:00:00', fim: '2026-10-21T09:00:00', sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: { 'Remada inversa': [{ carga: 20 }, { carga: 20 }, { carga: 20 }], Puxada: [{ carga: 40 }] } };
  const q = await H.novaPagina(b, { checkins: [antigo] });
  await q.clock.install({ time: new Date(T) });
  await q.goto(H.PAGINA); await H.prontos(q);
  ok((await txt(q, '.ex:nth-child(4) .log-btn')).includes('Hoje: 20 / 20 / 20 kg'), 'legacy weights in check-in shown as today');
  await ex(q, 'Remada inversa').locator('.log-btn').click();
  await q.fill('#kg-2', '25'); await q.click('[data-concluir]'); await H.gravacoes(q);
  ok((await txt(q, '.ex:nth-child(4) .log-btn')).includes('Hoje: 20 / 20 / 25 kg'), 'edit keeps other series');
  db = await H.banco(q);
  ok(JSON.stringify(db.checkins[0].series) === JSON.stringify(antigo.series), 'legacy check-in untouched');
  await q.click('.nav [data-tela="dashboard"]');
  await q.waitForFunction(() => !document.getElementById('tela-dashboard').hidden);
  await q.click('#dia-lista [data-ck]');
  const det = await txt(q, '.ck-corpo');
  ok(det.includes('Remada inversa 20 / 20 / 25 kg') && det.includes('Puxada 40'), 'dashboard detail merges legacy and new weights', det.slice(0, 160));
  await q.context().close();

  // banco sem a tabela cargas: app abre e avisa ao salvar
  const r = await H.novaPagina(b, { extra: { semTabelaCargas: true } });
  await r.clock.install({ time: new Date(T) });
  await r.goto(H.PAGINA); await H.prontos(r);
  ok(await r.isVisible('#tela-treino'), 'app opens without cargas table');
  await ex(r, 'Remada inversa').locator('.log-btn').click();
  await r.fill('#kg-0', '20'); await r.click('[data-concluir]'); await H.gravacoes(r); await r.waitForTimeout(100);
  ok((await txt(r, '#toast')).includes('Para salvar os pesos, rode de novo o supabase/schema.sql'), 'missing table message', await txt(r, '#toast'));
  await r.context().close();

  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
