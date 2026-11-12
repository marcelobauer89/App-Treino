// Melhorias de UX (Leis de UX, RF-69): progresso "X de N feitos" na Ficha, cartão com os 4 graus e "Última vez", − e + de 0,5 kg na carga,
// atividades da semana primeiro no check-in, semana recolhida no Treino, "Semanas seguidas no plano", Evolução comparando o
// mesmo trecho do mês, botão de check-in que não cobre ações, botões de Meus treinos do mesmo tamanho e, no painel, números
// em destaque, Quem sumiu no fim da Visão geral (como antes), tipos sem check-in numa linha só e Excluir conta só na ficha.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-11-13T10:30:00'; // sexta-feira (Treino 3 na semana padrão)
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '');

// Semana padrão (jiu na terça e na quinta): seg t2, ter jiu, qua t1, qui jiu, sex t3, sáb cardio.
// Três semanas completas (19/10 a 8/11) e a atual pela metade: 3 semanas seguidas no plano.
const PLANO = [[1, 't2'], [2, 'jiu'], [3, 't1'], [4, 'jiu'], [5, 't3'], [6, 'bike']];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function semana(segunda, ate = 6) {
  return PLANO.filter(([dow]) => dow <= ate).map(([dow, tipo]) => {
    const d = new Date(`${segunda}T12:00:00`); d.setDate(d.getDate() + dow - 1);
    return { id: `ck-${ymd(d)}`, usuario_id: 'u1', tipo, inicio: `${ymd(d)}T07:00:00`, fim: `${ymd(d)}T08:00:00`, sem_horario: false, obs: '', retroativo: false, series: {} };
  });
}
const CHECKINS = [...semana('2026-10-19'), ...semana('2026-10-26'), ...semana('2026-11-02'), ...semana('2026-11-09', 4)];

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, checkins: CHECKINS });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);

    // Ficha: progresso do dia.
    const n = await p.locator('#list > li.ex').count();
    ok(n > 0 && (await txt(p, '#count')) === `Treino de hoje: 0 de ${n} exercícios feitos`, `${scheme}: Ficha começa com 0 de ${n} exercícios feitos`, await txt(p, '#count'));
    ok((await p.getAttribute('#ficha-prog', 'aria-valuenow')) === '0' && (await p.getAttribute('#ficha-prog', 'aria-valuemax')) === String(n), `${scheme}: barra de progresso acessível`);

    // Cartão: os 4 graus (hipertrofia, força, explosão e mobilidade) sempre visíveis, como antes.
    const primeiro = p.locator('#list > li.ex').first();
    const graus = await primeiro.locator('.graus dt').allInnerTexts();
    ok(await primeiro.locator('.graus').isVisible() && graus.join('|') === 'Hipertrofia|Força|Explosão|Mobilidade', `${scheme}: os 4 graus visíveis no cartão`, graus.join('|'));

    // Carga: + e − de 0,5 kg, e o progresso sobe ao concluir.
    const comPeso = p.locator('#list > li.ex').nth(2);
    await comPeso.locator('[data-log]').click(); await p.waitForTimeout(150);
    await p.click('[data-passo="0.5"][data-alvo="kg-0"]'); await p.click('[data-passo="0.5"][data-alvo="kg-0"]'); await p.click('[data-passo="0.5"][data-alvo="kg-0"]');
    ok((await p.inputValue('#kg-0')) === '1,5', `${scheme}: + soma 0,5 kg a cada toque`, await p.inputValue('#kg-0'));
    await p.click('[data-passo="-0.5"][data-alvo="kg-0"]');
    ok((await p.inputValue('#kg-0')) === '1', `${scheme}: − tira 0,5 kg`, await p.inputValue('#kg-0'));
    await p.click('[data-concluir]'); await H.gravacoes(p);
    ok((await txt(p, '#count')) === `Treino de hoje: 1 de ${n} exercícios feitos` && (await p.getAttribute('#ficha-prog', 'aria-valuenow')) === '1', `${scheme}: progresso sobe para 1 de ${n}`, await txt(p, '#count'));

    // Semana recolhida no Treino: a tira com 7 dias e a lista ao abrir.
    ok(await p.locator('#semana-tira li').count() === 7 && !(await p.locator('#dias').isVisible()), `${scheme}: semana recolhida com a tira de 7 dias`);
    ok(await p.locator('#semana-tira li.feito').count() === 4, `${scheme}: tira marca os 4 dias feitos`, String(await p.locator('#semana-tira li.feito').count()));
    await p.click('#semana-det > summary'); await p.waitForTimeout(80);
    ok(await p.locator('#dias').isVisible(), `${scheme}: "Ver a semana" abre a lista`);

    // Check-in: atividades da semana primeiro; o resto em "Outras atividades".
    await p.click('#fab-checkin'); await p.waitForTimeout(150);
    const principais = await p.locator('#form-body > fieldset > .opcoes input[name="f-tipo"]').evaluateAll((els) => els.map((e) => e.value));
    ok(['t1', 't2', 't3', 'jiu', 'bike'].every((t) => principais.includes(t)) && !principais.includes('muay'), `${scheme}: tipos da semana na frente`, principais.join(','));
    ok(await p.locator('.mais-tipos input[value="muay"]').count() === 1 && !(await p.locator('.mais-tipos input[value="muay"] + span').isVisible()), `${scheme}: Muay Thai em "Outras atividades", recolhido`);
    await p.click('.mais-tipos summary'); await p.waitForTimeout(60);
    ok(await p.locator('.mais-tipos input[value="muay"] + span').isVisible(), `${scheme}: "Outras atividades" abre as outras`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);

    // Dashboard: semanas seguidas no lugar de "check-ins no total" e sem o "Por tipo" repetido.
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(250);
    const nums = await txt(p, '#numeros');
    ok(/Semanas seguidas no plano 3 semanas/.test(nums) && !/no total/.test(nums), `${scheme}: semanas seguidas no plano`, nums);
    ok(!(await p.locator('#tipos-titulo').isVisible()), `${scheme}: "Por tipo" fica só na Evolução`);
    // Botão de check-in: aberto, não cobre botão nem dia do calendário.
    const cobre = await p.evaluate(() => {
      const fab = document.getElementById('fab-checkin');
      if (fab.classList.contains('encolhido')) return false;
      const r = fab.getBoundingClientRect();
      for (let x = r.left + 8; x <= r.right - 8; x += 10) {
        const el = document.elementsFromPoint(x, r.top + r.height / 2).find((e) => !fab.contains(e));
        if (el && el.closest('button, a[href], input, .cal-dia')) return true;
      }
      return false;
    });
    ok(!cobre, `${scheme}: botão de check-in não cobre ações`);
    await p.screenshot({ path: `${H.SAIDA}/ux-dashboard-${scheme}.png` });

    // Evolução: o mês em andamento compara o mesmo trecho do mês anterior.
    await p.click('[data-dash-aba="evolucao"]').catch(() => p.click('button:has-text("Evolução")'));
    await p.waitForTimeout(250);
    const comp = await txt(p, '#evo-mes-comp');
    ok(comp === '1 a 13 comparado a 1 a 13 de outubro', `${scheme}: Evolução compara 1 a 13 com 1 a 13`, comp);
    // Meus treinos: os botões com o mesmo tamanho do "Personalizar meus treinos".
    await H.voce(p, 'treinos');
    const tam = await p.evaluate(() => ['editar-treinos', 'trocar-jornada'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); const c = getComputedStyle(document.getElementById(id)); return [Math.round(r.width), Math.round(r.height), c.fontSize]; }));
    ok(JSON.stringify(tam[0]) === JSON.stringify(tam[1]), `${scheme}: Mudar meu objetivo do tamanho de Personalizar meus treinos`, JSON.stringify(tam));
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Painel do administrador.
  {
    const ck = (u, tipo, d) => ({ id: `${u}${tipo}${d}`, usuario_id: u, tipo, inicio: `2026-11-${d}T19:00:00`, fim: `2026-11-${d}T20:00:00` });
    const U = (id, nome, acesso) => ({ id, nome, email: `${id}@exemplo.com`, cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: acesso, acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [] });
    const ADM = {
      ids: ['u1'],
      usuarios: [U('u1', 'Pessoa Admin', '2026-11-13T09:00:00Z'), U('u2', 'Pessoa Dois', '2026-11-12T09:00:00Z'), U('u3', 'Pessoa Sumida', '2026-10-20T09:00:00Z')],
      checkins: [ck('u1', 't1', '10'), ck('u2', 'jiu', '11'), ck('u2', 't2', '09'), { ...ck('u3', 'jiu', '01'), inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00' }],
      eventos: [],
    };
    const p = await H.novaPagina(b, { viewport: { width: 1280, height: 900 }, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    const destaques = await p.locator('#kpis .kpi.destaque dt').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    ok(destaques.length === 2 && /Aderência/.test(destaques[0]) && /Usuários ativos/.test(destaques[1]), 'painel: Aderência e Usuários ativos em destaque, primeiro', destaques.join(' | '));
    // Quem sumiu continua como antes: no fim da Visão geral, depois dos gráficos, e sem botão extra.
    const ordem = await p.evaluate(() => {
      const sumiu = document.getElementById('sumiu-titulo'), treinos = document.getElementById('treinos-titulo');
      return !!(treinos.compareDocumentPosition(sumiu) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    ok(ordem && /Pessoa Sumida/.test(await txt(p, '#sumiu-lista')) && !(await p.locator('#sumiu-lista a').count()), 'painel: Quem sumiu no fim da Visão geral, como antes');
    const zerados = await txt(p, '.rt-zerados');
    ok(/Sem check-in no período: .*Muay Thai/.test(zerados) && !/nenhum check-in/.test(await txt(p, '#treinos-lista')), 'painel: tipos sem check-in numa linha só', zerados);
    // Usuários: sem lixeira na tabela; Excluir conta dentro da ficha.
    await p.click('[data-aba="usuarios"]'); await p.waitForTimeout(200);
    ok(await p.locator('#usuarios-corpo .excluir-btn').count() === 0, 'painel: sem lixeira nas linhas da tabela');
    await p.click('#usuarios-corpo tr[data-usuario="u2"] [data-abrir]'); await p.waitForTimeout(200);
    ok(await p.locator('#detalhe [data-excluir="u2"]').isVisible(), 'painel: Excluir conta dentro da ficha do usuário');
    await p.click('#detalhe [data-excluir="u2"]'); await p.waitForTimeout(150);
    ok(await p.locator('#excluir-dialog[open]').count() === 1, 'painel: o botão da ficha abre a confirmação');
    ok(!p.errs.length, 'painel: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
