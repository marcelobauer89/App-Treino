const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();

  // 1. Sem configuração
  const c = await H.novaPagina(b, { configurar: false });
  await c.goto(H.PAGINA);
  await c.waitForTimeout(200);
  ok((await txt(c, '#entrar-status')).includes('ainda não está ligado ao Supabase') && await c.isHidden('#entrar-google'), 'unconfigured message');
  ok(await c.isHidden('.nav') && await c.isHidden('#tela-treino'), 'app hidden when unconfigured');

  // 2. Deslogado -> login com Google, com dados locais antigos para migrar
  const local = {
    'bauer-checkins-v1': JSON.stringify([{ id: 'antigo1', tipo: 't1', inicio: '2026-10-14T10:00', fim: '2026-10-14T11:00', semHorario: false, recuperacao: 3, obs: 'local', retroativo: false, series: { 'Remada inversa': [{ carga: 18 }] } }]),
    'bauer-config-v1': JSON.stringify({ tema: 'escuro', diasJiu: [1, 3] }),
    'bauer-perfil-v1': JSON.stringify({ nome: 'Bauer', email: 'velho@x.com', foto: '' }),
  };
  // Conta que já escondeu o aviso dos treinos personalizados neste aparelho.
  const p = await H.novaPagina(b, { logado: false, local: { ...local, 'bauer-novidade-oculta-u1': '1' } });
  await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await p.goto(H.PAGINA);
  await p.waitForSelector('#entrar-google:not([hidden])');
  ok((await txt(p, '#entrar-google')) === 'Continuar com o Google' && await p.isHidden('.nav'), 'login screen');
  await p.screenshot({ path: 's-login.png' });
  await p.click('#entrar-google');
  await H.prontos(p);
  let db = await H.banco(p);
  ok(db.oauth.provider === 'google' && db.oauth.options.redirectTo === H.PAGINA && db.cliente.flowType === 'pkce', 'Google OAuth with PKCE and redirect back', db.oauth.options.redirectTo);
  ok(db.cliente.url === 'https://teste.supabase.co', 'client uses configured URL');
  const s = await H.store(p);
  ok(s.length === 1 && s[0].obs === 'local' && s[0].id !== 'antigo1' && /^[0-9a-f-]{36}$/.test(s[0].id) && s[0].usuario_id === 'u1', 'local check-ins migrated with new UUIDs', s[0] && s[0].id);
  const perfil = db.perfis[0];
  ok(perfil.tema === 'escuro' && perfil.dias_jiu.join() === '1,3' && perfil.nome === 'Bauer', 'local settings migrated to profile');
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await p.evaluate(() => localStorage.getItem('bauer-tema')) === 'escuro', 'theme applied and cached');
  ok((await txt(p, '#atividade')) === 'Treino 1 + Jiu Jitsu', 'jiu days from profile drive the plan', await txt(p, '#atividade'));

  // 3. Gravações chegam ao banco
  await p.locator('.ex').nth(3).locator('.log-btn').click();
  ok(await p.inputValue('#kg-0') === '18', 'prefill from migrated data');
  await p.fill('#kg-0', '20');
  await p.fill('#kg-1', '22,5');
  await p.click('[data-concluir]');
  await H.gravacoes(p);
  let db0 = await H.banco(p);
  const reg = db0.cargas.find((r) => r.treino === 't1');
  ok(reg && reg.usuario_id === 'u1' && reg.series['Remada inversa'][1].carga === 22.5 && !(await H.store(p)).some((x) => !x.fim), 'weights saved to cargas, no check-in', JSON.stringify(reg && reg.series));
  db = await H.banco(p);
  const upserts = db.log.filter((l) => l === 'upsert:cargas').length;
  ok(upserts <= 3, 'weights batched, not one write per key', `${upserts} upserts`);
  await H.voce(p, 'dados');
  await p.fill('#p-nome', 'Marcelo B.');
  await p.press('#p-nome', 'Enter');
  await H.voce(p, 'aparencia');
  await p.locator('#opcoes-tema label', { hasText: 'Claro' }).click();
  await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.perfis[0].nome === 'Marcelo B.' && db.perfis[0].tema === 'claro', 'profile and theme saved');
  await H.voce(p, 'dados');
  ok(await p.getAttribute('#p-email', 'readonly') !== null && await p.inputValue('#p-email') === 'marcelo@exemplo.com', 'e-mail read-only from Google account');
  await H.voce(p, 'privacidade');
  ok((await txt(p, '#conta-email')) === 'marcelo@exemplo.com', 'account section shows e-mail');
  await p.screenshot({ path: 's-voce.png', fullPage: true });

  // 4. Recarregar mantém tudo (vem do banco)
  await p.reload();
  await H.prontos(p);
  ok(await p.inputValue('#p-nome') === 'Marcelo B.' && (await H.store(p)).length === 1 && (await p.locator('.ex').nth(3).locator('.log-btn').innerText()).includes('Hoje: 20 / 22,5'), 'data persists from database after reload');
  db = await H.banco(p);
  ok(db.checkins.length === 1 && db.cargas.length === 1, 'no duplicate migration on reload');

  // 5. Falha ao salvar -> aviso e recarga do servidor
  await p.click('.nav [data-tela="dashboard"]');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.falhar = true; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
  const diaMigrado = db.checkins[0].inicio.slice(0, 10);
  if (diaMigrado < '2026-10-01') await p.click('[data-mes="-1"]');
  await p.click(`[data-dia="${diaMigrado}"]`);
  await p.click('#dia-lista [data-ck]');
  await p.click('[data-excluir]');
  await p.click('[data-excluir-sim]');
  await H.gravacoes(p);
  ok((await txt(p, '#toast')).includes('Não foi possível salvar'), 'failure toast', await txt(p, '#toast'));
  ok((await p.$$eval('#dia-lista .ck-head b', (e) => e.length)) === 1, 'deleted item restored from server after failure');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.falhar = false; localStorage.setItem('mock-supabase', JSON.stringify(d)); });

  // 6. Sair
  await H.voce(p);
  await p.click('#sair');
  await p.waitForSelector('#entrar-google:not([hidden])');
  ok(await p.isHidden('.nav') && await p.isHidden('#tela-voce'), 'signed out shows login and hides app');
  console.log('errors:', [...c.errs, ...p.errs]);
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close();
  srv.close();
})();
