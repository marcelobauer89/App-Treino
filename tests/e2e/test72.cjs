// Check-in visual: cartões com o ícone de cada atividade no formulário e a celebração em tela cheia
// (ícone animado da atividade, resumo e o nº do treino na semana) ao salvar um check-in novo e ao encerrar um treino.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T20:00:00'; // quarta-feira
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.trim()).catch(() => '');
const abrir = async (b, op = {}) => {
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, celebracao: true, ...op });
  await p.clock.install({ time: new Date(AGORA) });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  return p;
};
// Novo check-in de um tipo numa data (início 07:00, para não sobrepor).
async function checkin(p, tipo, data) {
  await p.click('#fab-checkin'); await p.waitForTimeout(100);
  await p.check(`input[name="f-tipo"][value="${tipo}"]`, { force: true });
  await p.fill('#f-data', data); await p.fill('#f-inicio', '07:00');
  await p.click('[data-salvar-form]'); await p.waitForTimeout(250);
}

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. Formulário com cartões e ícones; celebração do surf com Continuar.
  for (const scheme of ['light', 'dark']) {
    const p = await abrir(b, { scheme });
    await p.click('#fab-checkin'); await p.waitForTimeout(100);
    const cards = await p.locator('#form-body .opcao-card').count();
    ok(cards >= 7 && (await p.locator('#form-body .opcao-card .ic-tipo').count()) === cards, `${scheme}: tipos em cartões, cada um com ícone`, String(cards));
    await p.locator('#form-dialog .modal-body').screenshot({ path: `${H.SAIDA}/checkin-form-${scheme}.png` });
    await p.click('#form-body [data-fechar]');
    await checkin(p, 'surf', '2026-10-28');
    ok(await p.isVisible('#celebra-dialog') && (await p.getAttribute('.cel', 'data-grupo')) === 'surf', `${scheme}: celebração do surf em tela cheia`);
    ok((await txt(p, '#cel-title')) === 'Check-in feito!' && (await txt(p, '.cel-tipo')) === 'Surf' && /Hoje · 07:00 às/.test(await txt(p, '.cel-info')), `${scheme}: título, tipo e horário`, await txt(p, '.cel-info'));
    ok(/1º treino da semana/.test(await txt(p, '.cel-semana')) && await p.locator('.cel-mar').count() === 1, `${scheme}: 1º treino da semana e o mar do surf`);
    ok(await p.evaluate(() => document.body.classList.contains('bv-ativa')), `${scheme}: app escondido atrás`);
    const db = await H.banco(p);
    ok(db.checkins.some((c) => c.tipo === 'surf'), `${scheme}: check-in gravado na hora`);
    await p.clock.runFor(1500); await p.waitForTimeout(100);
    await p.screenshot({ path: `${H.SAIDA}/celebra-surf-${scheme}.png` });
    await p.click('[data-cel-fechar]'); await p.waitForTimeout(150);
    ok(!(await p.isVisible('#celebra-dialog')) && /Check-in de Surf salvo/.test(await txt(p, '#toast')) && await p.evaluate(() => !document.body.classList.contains('bv-ativa')),
      `${scheme}: Continuar fecha e mostra o aviso`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${scheme}: sem rolagem lateral`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 2. Cada atividade com o seu ícone; fecha sozinha; contagem da semana.
  {
    const p = await abrir(b);
    const casos = [['t1', 'musc', '2026-10-26'], ['jiu', 'jiu', '2026-10-27'], ['muay', 'muay', '2026-10-27'], ['bike', 'bike', '2026-10-28']];
    let n = 0;
    for (const [tipo, grupo, data] of casos) {
      if (tipo === 'muay') await p.fill('#f-inicio', '07:00').catch(() => {});
      await checkin(p, tipo, data);
      if (tipo === 'muay' && await p.isVisible('#f-erro')) { await p.fill('#f-inicio', '18:00'); await p.click('[data-salvar-form]'); await p.waitForTimeout(250); }
      n++;
      ok((await p.getAttribute('.cel', 'data-grupo')) === grupo && await p.locator('.cel-icone .ic-tipo').count() === 1, `${tipo}: celebração com o ícone de ${grupo}`);
      ok(new RegExp(`${n}º treino da semana`).test(await txt(p, '.cel-semana')), `${tipo}: ${n}º treino da semana`, await txt(p, '.cel-semana'));
      await p.clock.runFor(1500); await p.waitForTimeout(100);
      await p.screenshot({ path: `${H.SAIDA}/celebra-${grupo}.png` });
      await p.clock.runFor(3500); await p.waitForTimeout(150);
      ok(!(await p.isVisible('#celebra-dialog')), `${tipo}: fecha sozinha em poucos segundos`);
    }
    // Check-in de outro dia mostra a data no lugar de "Hoje".
    await checkin(p, 'jiu', '2026-10-20');
    ok(!/Hoje/.test(await txt(p, '.cel-info')) && /1º treino da semana/.test(await txt(p, '.cel-semana')), 'outro dia: mostra a data e conta a semana daquele dia', await txt(p, '.cel-info'));
    await p.click('[data-cel-fechar]');
    ok(!p.errs.length, 'atividades: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Encerrar um treino em andamento: "Treino concluído!".
  {
    const p = await abrir(b, { checkins: [{ id: 'a1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-28T18:30:00', fim: null, sem_horario: false, obs: '', retroativo: false, series: {} }] });
    await p.click('#ativo [data-encerrar]'); await p.waitForTimeout(100);
    await p.click('[data-confirmar-enc]'); await p.waitForTimeout(250);
    ok(await p.isVisible('#celebra-dialog') && (await txt(p, '#cel-title')) === 'Treino concluído!' && (await p.getAttribute('.cel', 'data-grupo')) === 'jiu', 'encerrar: "Treino concluído!" com o ícone do Jiu Jitsu');
    ok(/18:30 às 20:00 · 1 h 30 min/.test(await txt(p, '.cel-info')), 'encerrar: horário e duração', await txt(p, '.cel-info'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(!(await p.isVisible('#celebra-dialog')) && /encerrado/.test(await txt(p, '#toast')), 'Esc fecha e mostra o aviso de encerrado');
    ok(!p.errs.length, 'encerrar: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 4. Editar um check-in não celebra.
  {
    const p = await abrir(b, { checkins: [{ id: 'e1', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-28T07:00:00', fim: '2026-10-28T08:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] });
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(150);
    await p.click('#dia-lista [data-ck]').catch(() => {}); await p.click('[data-editar]').catch(() => {});
    await p.waitForTimeout(100);
    if (await p.isVisible('#form-dialog')) {
      await p.click('[data-salvar-form]'); await p.waitForTimeout(250);
      ok(!(await p.isVisible('#celebra-dialog')) && /atualizado/.test(await txt(p, '#toast')), 'editar: sem celebração');
    } else ok(false, 'editar: formulário de edição abriu');
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
