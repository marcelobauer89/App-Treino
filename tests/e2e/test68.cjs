// Calistenia retirada: nenhuma opção, legenda ou cor no app e no painel; check-ins "cali" que sobrarem são ignorados sem erro.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-11-02T20:00:00');
const sobra = { id: 'c-cali', usuario_id: 'u1', tipo: 'cali', inicio: '2026-11-02T07:00:00', fim: '2026-11-02T08:00:00', sem_horario: false, obs: '', retroativo: false, series: {} };
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  const p = await H.novaPagina(b, { checkins: [sobra], extra: { perfis: [{ id: 'u1', nome: 'Ana', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], semana: [[], ['t1', 'cali'], ['jiu'], ['t2'], ['jiu'], ['t3'], ['cali']] }] } });
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  ok(!/Calistenia/.test(await p.locator('body').innerText()), 'app: nada de Calistenia na tela Treino');
  await p.click('#fab-checkin');
  await p.locator('#form-body .mais-tipos summary').click().catch(() => {}); // RF-69: as outras atividades ficam recolhidas
  const opcoes = (await p.locator('#form-body .opcao').allInnerTexts()).join('|');
  ok(!/Calistenia/.test(opcoes) && /Surf/.test(opcoes), 'check-in sem a opção Calistenia', opcoes.replace(/\s+/g, ' '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
  const dash = await p.locator('#tela-dashboard').innerText();
  ok(!/Calistenia/.test(dash) && !(await p.locator('.selo.cali').count()), 'Dashboard sem Calistenia (legenda, barras, calendário)');
  await H.voce(p, 'semana');
  ok(!(await p.locator('[data-arrastar="cali"]').count()) && !/Calistenia/.test(await p.locator('#tela-voce').innerText()), 'Minha semana sem Calistenia');
  ok(!p.errs.length, 'app: check-in "cali" que sobrou não quebra nada', p.errs.join(' | '));
  await p.context().close();

  const ADM = { ids: ['u1'], usuarios: [{ id: 'u1', nome: 'Marcelo', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-11-02T10:00:00Z', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, videos_liberados: false }],
    checkins: [{ usuario_id: 'u1', tipo: 'cali', inicio: '2026-11-02T07:00:00', fim: '2026-11-02T08:00:00' }, { usuario_id: 'u1', tipo: 'jiu', inicio: '2026-11-01T19:00:00', fim: '2026-11-01T20:00:00' }], eventos: [], emails: [], convites: [] };
  const a = await H.novaPagina(b, { extra: { admin: ADM }, viewport: { width: 1280, height: 900 } });
  await a.clock.install({ time: T });
  await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
  ok(!/Calistenia/.test(await a.locator('#painel').innerText()), 'painel sem Calistenia');
  ok(/Jiu Jitsu/.test(await a.locator('#treinos-lista').innerText()), 'painel conta os outros check-ins normalmente');
  ok(!a.errs.length, 'painel: sem erros', a.errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
