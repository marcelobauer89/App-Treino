// Dashboard → Evolução: treinos por mês (colunas empilhadas por tipo, 6 meses), resumo do mês escolhido com a
// comparação com o mês anterior, quais treinos foram e as maiores cargas de cada exercício (variação, novo, recorde).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-11-11T20:00:00'; // quarta-feira
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '');
const SEMANA = [[], ['t1'], ['jiu'], ['t2'], ['jiu'], ['bike'], []]; // 6 por semana
const ck = (id, tipo, dia, ini = '07:00', fim = '08:00') => ({ id, usuario_id: 'u1', tipo, inicio: `${dia}T${ini}:00`, fim: `${dia}T${fim}:00`, sem_horario: false, obs: '', retroativo: false, series: {} });
const CHECKINS = [
  // setembro: 3
  ck('s1', 't1', '2026-09-08'), ck('s2', 'jiu', '2026-09-09'), ck('s3', 't1', '2026-09-15'),
  // outubro: 6 (4 musc, 1 jiu, 1 cardio)
  ck('o1', 't1', '2026-10-05'), ck('o2', 't2', '2026-10-07'), ck('o3', 't1', '2026-10-12'), ck('o4', 't2', '2026-10-14'),
  ck('o5', 'jiu', '2026-10-15'), ck('o6', 'bike', '2026-10-16', '07:00', '07:30'),
  // novembro: 4 (2 musc, 1 jiu, 1 futebol avulso)
  ck('n1', 't1', '2026-11-02'), ck('n2', 'jiu', '2026-11-03'), ck('n3', 't2', '2026-11-04'), ck('n4', 'futebol', '2026-11-07', '09:00', '10:30'),
];
const CARGAS = [
  { usuario_id: 'u1', data: '2026-09-08', treino: 't1', series: { Puxada: [{ carga: 30 }], 'Remada inversa': [{ carga: 10 }] } },
  { usuario_id: 'u1', data: '2026-10-05', treino: 't1', series: { Puxada: [{ carga: 35 }, { carga: 37.5 }], 'Remada inversa': [{ carga: 10 }] } },
  { usuario_id: 'u1', data: '2026-10-07', treino: 't2', series: { 'Supino no chão': [{ carga: 20 }] } },
  { usuario_id: 'u1', data: '2026-11-02', treino: 't1', series: { Puxada: [{ carga: 40 }], 'Remada inversa': [{ carga: 10 }] } },
  { usuario_id: 'u1', data: '2026-11-04', treino: 't2', series: { 'Supino no chão': [{ carga: 17.5 }], Desenvolvimento: [{ carga: 12 }] } },
];
// Os testes abrem o app como dev (prod: true abre como produção).
async function abrir(b, { scheme = 'light', viewport = { width: 390, height: 844 }, checkins = CHECKINS, cargas = CARGAS, extra = {}, url = H.PAGINA, prod = false } = {}) {
  const p = await H.novaPagina(b, { scheme, viewport, checkins, dev: !prod, semearDev: !prod, extra: { perfis: [{ id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], semana: SEMANA }], cargas, ...extra } });
  await p.clock.install({ time: new Date(AGORA) });
  await p.goto(url); await H.prontos(p); await p.waitForTimeout(250);
  return p;
}
const colunas = (p) => p.locator('.evo-col').evaluateAll((gs) => gs.map((g) => `${g.dataset.evoMes}:${g.querySelector('.evo-total').textContent}`));

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await abrir(b, { scheme, viewport });
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    ok(await p.getAttribute('#dash-aba-resumo', 'aria-selected') === 'true' && await p.locator('#dash-resumo').isVisible() && await p.locator('#dash-evolucao').isHidden(), `${tag}: Dashboard abre no Resumo`);
    await p.click('#dash-aba-evolucao'); await p.waitForTimeout(250);
    ok(await p.locator('#dash-evolucao').isVisible() && await p.locator('#dash-resumo').isHidden() && (await p.evaluate(() => location.hash)) === '#dashboard/evolucao', `${tag}: aba Evolução (e no endereço)`);
    const cols = await colunas(p);
    ok(cols.join(',') === '2026-06:0,2026-07:0,2026-08:0,2026-09:3,2026-10:6,2026-11:4', `${tag}: 6 meses com o total de cada um`, cols.join(','));
    ok(await p.getAttribute('[data-evo-mes="2026-11"]', 'aria-pressed') === 'true' && (await txt(p, '#evo-mes-titulo')) === 'Novembro de 2026', `${tag}: mês atual selecionado`);
    // Outubro: 4 pedaços (musc, jiu, cardio) empilhados
    ok(await p.locator('[data-evo-mes="2026-10"] .evo-barra [class^="evo-"]').count() === 3, `${tag}: outubro empilhado em 3 tipos`);
    const leg = await p.locator('#evo-legenda li').allInnerTexts();
    ok(leg.map((t) => t.trim().split('\n').pop().trim()).join('|') === 'Musculação|Jiu Jitsu|Futebol|Cardio', `${tag}: legenda só com os tipos dos meses`, leg.join('|'));
    // Resumo de novembro (mês em andamento), comparado ao mesmo trecho de outubro (1 a 11: 2 treinos em 2 dias), RF-69.
    const num = (await txt(p, '#evo-numeros')).replace(/(\d)([▲▼])/g, '$1 $2');
    ok(/Treinos 4 ▲ 2/.test(num) && /Dias com treino 4 ▲ 2/.test(num), `${tag}: números de novembro com a comparação`, num);
    ok((await txt(p, '#evo-mes-comp')) === '1 a 11 comparado a 1 a 11 de outubro', `${tag}: compara o mesmo trecho do mês anterior`, await txt(p, '#evo-mes-comp'));
    // Plano em novembro até dia 11: seg 2,9 (t1) ter 3,10 (jiu) qua 4,11 (t2) qui 5 (jiu) sex 6 (bike) = 8 → 4/8 = 50%
    ok(/Do plano 50 %/.test(num.replace(/(\d)%/, '$1 %')), `${tag}: % do plano no mês atual (até hoje)`, num);
    const quais = await txt(p, '#evo-quais');
    ok(/Musculação 2 Treino 1 · 1×, Treino 2 · 1×/.test(quais) && /Jiu Jitsu 1/.test(quais) && /Futebol 1/.test(quais), `${tag}: quais foram, com os treinos de musculação`, quais);
    const pesos = await p.locator('#evo-pesos li').allInnerTexts();
    const pz = pesos.map((t) => t.replace(/\s+/g, ' ').trim());
    ok(pz[0] && /^1 ?Puxada 🏆 40 kg recorde em 2 de nov · ▲ 10 kg desde set \(30 kg\)/.test(pz[0]), `${tag}: Puxada é o maior peso, com o recorde e quanto subiu desde o primeiro registro`, pz[0]);
    ok(pz.map((t) => t.replace(/^\d+ ?/, '').split(' ')[0]).join(',') === 'Puxada,Supino,Desenvolvimento,Remada', `${tag}: maiores pesos de todo o histórico, do mais pesado para o mais leve`, pz.join(' | '));
    ok(await p.locator('#evo-pesos-todos').isHidden(), `${tag}: com 4 exercícios, sem "Ver todos"`);
    ok((await txt(p, '#evo-pesos-titulo')) === 'Seus maiores pesos' && (await txt(p, '#evo-parados-titulo')) === 'Pesos estagnados', `${tag}: títulos dos cards de pesos`);
    ok(pz.some((t) => /^\d+ ?Supino no chão 20 kg recorde em 7 de out · último treino: 17,5 kg/.test(t)) && pz.some((t) => /^\d+ ?Desenvolvimento 12 kg recorde em 4 de nov$/.test(t)) && pz.some((t) => /^\d+ ?Remada inversa 10 kg recorde em 8 de set · mesma carga desde set/.test(t)), `${tag}: recorde geral, último treino abaixo e mesma carga`, pz.join(' | '));
    ok(!pz.some((t) => /Desenvolvimento 🏆/.test(t)) && !pz.some((t) => /Supino no chão 🏆/.test(t)), `${tag}: primeiro registro e recorde antigo sem troféu`);
    // Quanto falta: novembro tem 21 treinos no plano (seg 5, ter 4, qua 4, qui 4, sex 4); 4 feitos; 20 dias contando hoje.
    const falta = await txt(p, '#evo-falta');
    ok(/^Faltam 17 treinos para fechar novembro com 100% do plano/.test(falta) && /4 de 21 treinos do plano feitos · 20 dias pela frente, contando hoje · no ritmo de agora, você fecha com 50%/.test(falta), `${tag}: quanto falta no mês`, falta);
    ok((await txt(p, '#evo-quais-titulo')) === 'O que você treinou', `${tag}: título "O que você treinou"`);
    // Seu plano no mês: o mais pulado primeiro.
    const plano = (await p.locator('#evo-plano li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(plano.join(' | ') === 'C Cardio sexta 0 de 1 | J Jiu Jitsu terça e quinta 1 de 3 | 1 Treino 1 segunda 1 de 2 | 2 Treino 2 quarta 1 de 2', `${tag}: seu plano no mês, o mais pulado primeiro`, plano.join(' | '));
    ok(await p.locator('#evo-plano li:first-child .seg i').count() === 1 && await p.locator('#evo-plano li:nth-child(2) .seg i.on').count() === 1, `${tag}: um tracinho por vez prevista`);
    ok(/^💡 A quinta é o dia que você mais pula nos últimos 3 meses \(treinou em 1 de 9\)/.test(await txt(p, '#evo-dica')) && await p.getAttribute('#evo-dica a', 'href') === '#voce/semana', `${tag}: dica do dia que mais falha, com o atalho`, await txt(p, '#evo-dica'));
    // Hora de subir a carga?: parado há 3 meses (com a sugestão) e o que caiu.
    const par = (await p.locator('#evo-parados li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(par.length === 1 && /^Remada inversa 9 sem 10 kg Sem subir desde 8 de set \(9 semanas, 2 treinos depois\)\. Se as séries estão fáceis, tente 12 kg\./.test(par[0]), `${tag}: pesos estagnados de todo o histórico (Supino tem só 1 treino depois do recorde)`, par.join(' | '));
    await p.screenshot({ path: `${H.SAIDA}/evolucao-${tag}.png`, fullPage: true });
    // Tocar em outubro muda o resumo.
    await p.click('[data-evo-mes="2026-10"]'); await p.waitForTimeout(120);
    ok((await txt(p, '#evo-mes-titulo')) === 'Outubro de 2026' && /Treinos 6 ?▲ 3/.test(await txt(p, '#evo-numeros')), `${tag}: tocar em outubro mostra outubro`, await txt(p, '#evo-numeros'));
    ok(/Musculação 4 Treino 1 · 2×, Treino 2 · 2×/.test(await txt(p, '#evo-quais')), `${tag}: outubro, quais foram`);
    ok(await p.locator('#evo-falta').isHidden() && await p.locator('#evo-dica').isHidden(), `${tag}: mês passado sem "quanto falta" e sem dica`);
    ok((await p.locator('#evo-parados li').count()) === 1 && /^Remada inversa/.test(await txt(p, '#evo-parados li')), `${tag}: estagnados não mudam com o mês escolhido`, await txt(p, '#evo-parados li'));
    ok((await txt(p, '#evo-plano-quando')) === 'mês inteiro' && /^J Jiu Jitsu terça e quinta 1 de 9/.test(await txt(p, '#evo-plano li')), `${tag}: plano de outubro no mês inteiro`, await txt(p, '#evo-plano li'));
    // Tabela
    await p.click('#evo-tabela-btn'); await p.waitForTimeout(80);
    const tab = await txt(p, '#evo-tabela');
    ok(/Outubro 2026 4 1 0 1 6/.test(tab), `${tag}: Ver tabela com os números`, tab);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Setas de 6 em 6 meses; a seguinte fica desligada no mês atual; a anterior para no primeiro check-in.
  {
    const p = await abrir(b, { url: `${H.PAGINA}#dashboard/evolucao`, checkins: [...CHECKINS, ck('a1', 't1', '2026-03-10')] });
    ok(await p.locator('#dash-evolucao').isVisible(), 'endereço #dashboard/evolucao abre direto na Evolução');
    ok(await p.locator('[data-evo-nav="1"]').isDisabled() && !(await p.locator('[data-evo-nav="-1"]').isDisabled()), 'no mês atual só dá para voltar');
    await p.click('[data-evo-nav="-1"]'); await p.waitForTimeout(120);
    const cols = await colunas(p);
    ok(cols[0] === '2025-12:0' && cols[5] === '2026-05:0' && cols[3] === '2026-03:1', 'seta volta 6 meses', cols.join(','));
    ok(await p.locator('[data-evo-nav="-1"]').isDisabled() === false || cols[0] <= '2026-03', 'anterior desliga ao passar do primeiro check-in');
    ok((await txt(p, '#evo-mes-titulo')) === 'Maio de 2026', 'ao trocar de meses, seleciona o último mês da janela');
    const ev = (await H.banco(p)).eventos || [];
    ok(!p.errs.length, 'setas: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Conta nova: mensagem de incentivo.
  {
    const p = await abrir(b, { checkins: [], cargas: [] });
    await p.click('[data-tela="dashboard"]'); await p.click('#dash-aba-evolucao'); await p.waitForTimeout(150);
    ok(/Faça o primeiro check-in/.test(await txt(p, '#evo-quais')) && /Nenhum peso registrado/.test(await txt(p, '#evo-pesos')), 'conta nova: mensagens');
    ok(await p.locator('[data-evo-nav="-1"]').isDisabled(), 'conta nova: sem meses para trás');
    ok(/Registre os pesos/.test(await txt(p, '#evo-parados')) && await p.locator('#evo-dica').isHidden(), 'conta nova: estagnados com a mensagem e sem dica');
    ok(!p.errs.length, 'conta nova: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Exercício renomeado no catálogo: nome novo e o histórico junto.
  {
    const c = H.catalogo();
    Object.assign(c.exercicios.find((e) => e.nome === 'Puxada'), { nome: 'Puxada frontal', nomes_antigos: ['Puxada'] });
    const cargas = [...CARGAS, { usuario_id: 'u1', data: '2026-11-09', treino: 't1', series: { 'Puxada frontal': [{ carga: 42.5 }] } }];
    const p = await abrir(b, { cargas, extra: c });
    await p.click('[data-tela="dashboard"]'); await p.click('#dash-aba-evolucao'); await p.waitForTimeout(150);
    const pz = (await p.locator('#evo-pesos li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    ok(pz.some((t) => /^\d+ ?Puxada frontal 🏆 42,5 kg recorde em 9 de nov · ▲ 12,5 kg desde set/.test(t)) && !pz.some((t) => /^\d+ ?Puxada \d/.test(t)), 'renomeado: nome novo e o histórico do nome antigo junto', pz.join(' | '));
    ok(!p.errs.length, 'renomeado: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Produção: a Evolução também aparece, com o histórico da conta; #dashboard/evolucao abre direto nela.
  {
    const p = await abrir(b, { prod: true, url: `${H.PAGINA}#dashboard/evolucao` });
    ok(await p.locator('.dash-abas').isVisible() && await p.locator('#dash-evolucao').isVisible() && await p.locator('#dash-resumo').isHidden(), 'produção: aba Evolução aparece e abre pelo endereço');
    ok((await colunas(p)).join(',') === '2026-06:0,2026-07:0,2026-08:0,2026-09:3,2026-10:6,2026-11:4', 'produção: meses com o histórico da conta', (await colunas(p)).join(','));
    ok(!p.errs.length, 'produção: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
