// Legenda do calendário e "Por tipo no mês" (Dashboard): só as atividades da semana montada pela pessoa e as que
// tiveram check-in no mês exibido. Ex.: semana com Treino 1, Jiu Jitsu e Cardio mostra só esses três.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T20:00:00'; // quarta-feira
const PERFIL = { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4] };
const barrasDoMes = (p) => p.locator('#barras .barra').allInnerTexts().then((ls) => ls.map((t) => t.replace(/\s+/g, ' ').trim().replace(/^\S+ /, '')));
const itens = (p) => p.locator('#legenda-cal li').allInnerTexts().then((ls) => ls.map((t) => t.replace(/\s+/g, ' ').trim()));
async function abrir(b, { scheme = 'light', semana, checkins = [] }) {
  const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, checkins, extra: { perfis: [{ ...PERFIL, semana }] } });
  await p.clock.install({ time: new Date(AGORA) });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(250);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(200);
  return p;
}
const ck = (id, tipo, dia) => ({ id, usuario_id: 'u1', tipo, inicio: `${dia}T19:00:00`, fim: `${dia}T20:30:00`, sem_horario: false, obs: '', retroativo: false, series: {} });

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    // 1. Semana com Treino 1, Jiu Jitsu e Cardio, sem check-ins: só esses três.
    let p = await abrir(b, { scheme, semana: [[], ['t1'], ['jiu'], [], ['jiu'], [], ['bike']] });
    let l = await itens(p);
    ok(l.join('|') === '1 Treino 1|J Jiu Jitsu|C Cardio', `${scheme}: só Treino 1, Jiu Jitsu e Cardio`, l.join('|'));
    ok(!/Muay|Surf|Futebol|Futvôlei/.test(l.join()), `${scheme}: sem Muay Thai, Surf, Futebol e Futvôlei`);
    // "Por tipo no mês": a mesma regra (semana montada + check-ins do mês).
    let barras = await barrasDoMes(p);
    ok(barras.join('|') === 'Treino 1 0|Jiu Jitsu 0|Cardio 0', `${scheme}: por tipo no mês só com Treino 1, Jiu Jitsu e Cardio`, barras.join('|'));
    await p.locator('.cal').screenshot({ path: `${H.SAIDA}/legenda-cal-${scheme}.png` });
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();

    // 2. Check-in avulso de futebol no mês: entra na legenda; no mês anterior (sem ele), sai.
    p = await abrir(b, { scheme, semana: [[], ['t1'], ['jiu'], [], ['jiu'], [], ['bike']], checkins: [ck('f1', 'futebol', '2026-10-25')] });
    l = await itens(p);
    ok(l.join('|') === '1 Treino 1|J Jiu Jitsu|F Futebol|C Cardio', `${scheme}: futebol avulso no mês entra, na ordem das atividades`, l.join('|'));
    barras = await barrasDoMes(p);
    ok(barras.join('|') === 'Treino 1 0|Jiu Jitsu 0|Futebol 1|Cardio 0', `${scheme}: por tipo no mês com o futebol avulso`, barras.join('|'));
    await p.click('[data-mes="-1"]'); await p.waitForTimeout(120);
    l = await itens(p);
    ok(!l.join().includes('Futebol') && l.length === 3, `${scheme}: no mês sem o check-in, futebol sai`, l.join('|'));
    ok(!(await barrasDoMes(p)).join().includes('Futebol'), `${scheme}: por tipo no mês sem o futebol no mês anterior`);
    ok(!p.errs.length, `${scheme}: avulso sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Vários treinos de musculação numa linha só, com os selos de cada um.
  let p = await abrir(b, { semana: [[], ['t2'], ['jiu'], ['t1'], [], ['t3'], []] });
  let l = await itens(p);
  ok(l[0] === '1 2 3 Musculação' && l.length === 2, 'treinos 1, 2 e 3 numa linha "Musculação"', l.join('|'));
  await p.context().close();

  // 4. Semana vazia e mês sem check-in: legenda escondida.
  p = await abrir(b, { semana: [[], [], [], [], [], [], []] });
  ok(await p.locator('#legenda-cal').isHidden(), 'sem nada na semana nem no mês: legenda escondida');
  ok(/Nenhum treino na sua semana nem check-in neste mês/.test(await p.locator('#barras').innerText()), 'sem nada: por tipo no mês com a mensagem');
  await p.context().close();

  // 5. Mudar a semana em Você atualiza a legenda ao voltar para o Dashboard.
  p = await abrir(b, { semana: [[], ['t1'], [], [], [], [], []] });
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('mock-supabase'));
    d.perfis[0].semana = [[], ['t1'], ['muay'], [], [], [], []];
    localStorage.setItem('mock-supabase', JSON.stringify(d));
  });
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
  l = await itens(p);
  ok(l.join('|') === '1 Treino 1|M Muay Thai', 'semana nova (com Muay Thai) aparece na legenda', l.join('|'));
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
