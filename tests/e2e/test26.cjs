// Eventos de uso enviados ao banco.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const eventos = async (p) => (await H.banco(p)).eventos;
const tipos = async (p) => (await eventos(p)).map((e) => e.tipo);
const esconder = (p) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
const card = (p, nome) => p.locator('.ex', { has: p.locator('h3', { hasText: nome }) });
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const p = await H.novaPagina(b);
  await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await p.goto(H.PAGINA); await H.prontos(p);
  ok((await eventos(p)).length === 0, 'events are batched (nothing sent immediately)');
  await p.clock.runFor(10500); await p.waitForTimeout(100);
  let ev = await eventos(p);
  const sess = ev.find((e) => e.tipo === 'sessao');
  ok(sess && sess.usuario_id === 'u1' && sess.dados.navegador && sess.dados.sistema && 'instalado' in sess.dados && sess.dados.login === false, 'sessao event with device info', JSON.stringify(sess && sess.dados));
  ok(ev.some((e) => e.tipo === 'tela' && e.dados.tela === 'treino'), 'tela treino');
  ok(!ev.some((e) => e.tipo === 'sessao_perdida'), 'no lost session on normal open');
  ok((await H.banco(p)).log.filter((l) => l === 'insert:eventos').length === 1, 'sent in one batch');
  // exercício com peso + recorde
  await card(p, 'Puxada').locator('.log-btn').click();
  await p.fill('#kg-0', '40'); await p.click('[data-concluir]'); await p.waitForTimeout(50);
  await card(p, 'Superman').locator('.log-btn').click();
  await p.locator('#log-dialog .sem-peso-linha').click(); await p.click('[data-concluir]'); await p.waitForTimeout(50);
  // check-in pelo botão verde
  await p.click('#fab-checkin'); await p.click('[data-salvar-form]'); await p.waitForTimeout(50);
  // dashboard, editar e excluir
  await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(100);
  await p.click('#dia-lista [data-ck]'); await p.click('[data-editar]'); await p.click('[data-salvar-form]'); await p.waitForTimeout(50);
  await p.click('[data-excluir]'); await p.click('[data-excluir-sim]'); await p.waitForTimeout(50);
  // você: tema
  await H.voce(p, 'aparencia');
  await p.locator('#opcoes-tema label', { hasText: 'Escuro' }).click();
  await esconder(p); await p.waitForTimeout(150);
  ev = await eventos(p);
  const t = ev.map((e) => e.tipo);
  const ex = ev.filter((e) => e.tipo === 'exercicio_concluido');
  ok(ex.length === 2 && ex.some((e) => e.dados.exercicio === 'Puxada' && e.dados.sem_peso === false && e.dados.com_carga === true && e.dados.origem === 'treino') && ex.some((e) => e.dados.exercicio === 'Superman' && e.dados.sem_peso === true), 'exercicio_concluido events', JSON.stringify(ex.map((e) => e.dados)));
  ok(ev.some((e) => e.tipo === 'sem_peso' && e.dados.exercicio === 'Superman' && e.dados.ativo === true), 'sem_peso event');
  ok(ev.some((e) => e.tipo === 'checkin_criado' && e.dados.tipo === 't1' && e.dados.origem === 'treino' && e.dados.retroativo === false), 'checkin_criado with origin');
  ok(t.includes('checkin_editado') && t.includes('checkin_excluido'), 'edit and delete events');
  ok(ev.some((e) => e.tipo === 'tela' && e.dados.tela === 'dashboard') && ev.some((e) => e.tipo === 'tela' && e.dados.tela === 'voce'), 'tela events');
  ok(ev.some((e) => e.tipo === 'tema' && e.dados.tema === 'escuro'), 'tema event');
  ok(!JSON.stringify(ev).includes('"carga"') && !JSON.stringify(ev).includes('40'), 'no loads or weights in events');
  ok(ev.every((e) => e.usuario_id === 'u1'), 'all events of the user');
  // semana: várias mudanças seguidas = 1 evento
  await H.voce(p, 'semana');
  await p.locator('#dias-cfg [data-remover="1:t2"]').click();
  await p.locator('#dias-cfg [data-remover="3:t1"]').click();
  await p.clock.runFor(3500); await esconder(p); await p.waitForTimeout(150);
  ok((await tipos(p)).filter((x) => x === 'semana_alterada').length === 1, 'semana_alterada debounced');
  // erro de JS
  // Erro solto na página (sem <script> inline, que a CSP bloqueia).
  await p.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught Error: falha de teste' })));
  await esconder(p); await p.waitForTimeout(150);
  ok((await eventos(p)).some((e) => e.tipo === 'erro' && e.dados.origem === 'js' && e.dados.mensagem.includes('falha de teste')), 'js error event');
  // sair: envia e limpa marca de sessão
  await H.voce(p);
  await p.click('#sair');
  for (let k = 0; k < 10 && await p.isHidden('#tela-entrar'); k++) { await p.clock.runFor(50); await p.waitForTimeout(20); }
  ok((await tipos(p)).includes('saiu') && await p.evaluate(() => localStorage.getItem('bauer-sessao')) === null, 'saiu event, session mark cleared');
  ok(!p.errs.filter((e) => !e.includes('falha de teste')).length, 'no other errors', p.errs.join());
  await p.context().close();

  // sessão perdida: marca de sessão existente e volta do Google com ?code
  const q = await H.novaPagina(b, { local: { 'bauer-sessao': JSON.stringify({ id: 'u1', visto: Date.now() - 5 * 36e5 }) } });
  await q.goto(H.PAGINA + '?code=abc'); await H.prontos(q); await esconder(q); await q.waitForTimeout(200);
  const perdida = (await eventos(q)).find((e) => e.tipo === 'sessao_perdida');
  ok(perdida && perdida.dados.horas_desde >= 4 && perdida.dados.navegador, 'sessao_perdida after re-login without signing out', JSON.stringify(perdida && perdida.dados));
  ok((await eventos(q)).find((e) => e.tipo === 'sessao').dados.login === true, 'sessao marks login');
  await q.context().close();
  // sem a tabela: app normal, sem aviso, para de tentar
  const r = await H.novaPagina(b, { extra: { semTabelaEventos: true } });
  await r.goto(H.PAGINA); await H.prontos(r); await esconder(r); await r.waitForTimeout(200);
  await r.click('.nav [data-tela="dashboard"]'); await esconder(r); await r.waitForTimeout(200);
  const tentativas = (await H.banco(r)).log.filter((l) => l === 'insert:eventos').length;
  ok(tentativas === 1 && await r.isHidden('#toast') && !r.errs.length, 'missing table: silent, stops after first try', String(tentativas));
  // aviso de privacidade
  await H.voce(r, 'privacidade');
  ok((await txt(r, '#tela-voce')).includes('O que o administrador vê'), 'privacy note in Você');
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
