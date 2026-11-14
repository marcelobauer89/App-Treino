// Temporizador de descanso: ligado em Você → Temporizador (salvo na conta), botão flutuante só na tela Treino,
// janela para escolher o tempo, contador com −15 s / +15 s / Pular, vibração e aviso no fim.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const PERFIL = (extra = {}) => ({ id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], ...extra });
const LIGADO = { ativo: true, segundos: 60, vibrar: true };
const abrir = async (b, extra, op = {}) => {
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, ...op, extra });
  await p.addInitScript(() => {
    window.__vibrou = []; navigator.vibrate = (x) => { window.__vibrou.push(x); return true; };
    // Áudio falso: conta os bipes tocados pelo <audio> (som principal, toca no silencioso do iPhone),
    // o trecho mudo que libera o áudio no toque e os bipes da reserva (Web Audio).
    window.__bipes = 0; window.__mudo = 0; window.__reserva = 0; window.__playFalha = false;
    HTMLMediaElement.prototype.play = function () {
      if (window.__playFalha && this.dataset.som === 'bipe') return Promise.reject(new Error('NotAllowedError'));
      if (this.dataset.som === 'bipe') window.__bipes += 3;
      if (this.dataset.som === 'mudo') window.__mudo++;
      return Promise.resolve();
    };
    const no = () => ({ connect: (d) => d, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: {} });
    window.AudioContext = class { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() { return Promise.resolve(); } createGain() { return no(); }
      createOscillator() { return { ...no(), type: '', start: () => { window.__reserva++; }, stop() {} }; } };
  });
  await p.clock.install({ time: new Date('2026-10-28T18:00:00') });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  return p;
};
const contador = (p) => p.locator('#desc-contador').innerText();

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. Ligado por padrão (conta sem nada salvo): botão na tela Treino; desligar em Você salva na conta e some com o botão.
  let p = await abrir(b, { perfis: [PERFIL()] });
  ok(await p.isVisible('#fab-descanso'), 'padrão: botão flutuante na tela Treino');
  await H.voce(p);
  ok(/1 min 30/.test(await p.innerText('#valor-temporizador')), 'lista de Você mostra "1 min 30"', await p.innerText('#valor-temporizador'));
  ok(await p.isHidden('#fab-descanso'), 'botão não aparece fora da tela Treino');
  await H.voce(p, 'temporizador');
  ok(await p.isChecked('#temp-ativo') && await p.isVisible('#temp-opcoes') && (await p.locator('#temp-tempos .chip').count()) === 6, 'padrão: ligado, com os 6 tempos');
  ok((await p.getAttribute('#temp-tempos [data-temp-padrao="90"]', 'aria-pressed')) === 'true', 'padrão marcado: 1 min 30');
  await p.click('#temp-tempos [data-temp-padrao="45"]'); await H.gravacoes(p);
  let db = await H.banco(p);
  let t = db.perfis.find((x) => x.id === 'u1').temporizador;
  ok(t && t.ativo === true && t.segundos === 45 && t.vibrar === true && t.som === true, 'salvo na conta (som e vibração ligados)', JSON.stringify(t));
  await p.locator('label:has(#temp-ativo)').first().click(); await H.gravacoes(p);
  ok(await p.isHidden('#temp-opcoes'), 'desligado: opções escondidas');
  db = await H.banco(p); t = db.perfis.find((x) => x.id === 'u1').temporizador;
  ok(t && t.ativo === false, 'desligar fica salvo na conta', JSON.stringify(t));
  await p.clock.runFor(11000); await p.waitForTimeout(100); db = await H.banco(p);
  ok((db.eventos || []).some((e) => e.tipo === 'temporizador' && e.dados.ativo === false), 'evento temporizador registrado');
  await p.click('[data-tela="treino"]'); await p.waitForTimeout(150);
  ok(await p.isHidden('#fab-descanso'), 'desligado: sem botão na tela Treino');
  ok(!p.errs.length, 'configuração: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 1b. Conta que desligou: continua desligado ao abrir.
  p = await abrir(b, { perfis: [PERFIL({ temporizador: { ativo: false, segundos: 90, vibrar: true, som: true } })] });
  ok(await p.isHidden('#fab-descanso'), 'quem desligou não vê o botão');
  await H.voce(p);
  ok(/Desligado/.test(await p.innerText('#valor-temporizador')), 'lista de Você mostra "Desligado"');
  await p.context().close();

  // 2. Janela, contador e fim (claro/escuro, celular/computador).
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    p = await abrir(b, { perfis: [PERFIL({ temporizador: LIGADO })] }, { scheme, viewport });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    ok(await p.isVisible('#fab-descanso'), `${tag}: botão visível com a conta já ligada`);
    const fab = await p.locator('#fab-descanso').boundingBox();
    ok(fab && fab.width >= 44 && fab.height >= 44, `${tag}: botão com 44 px ou mais`);
    const ck = await p.locator('#fab-checkin').boundingBox();
    ok(ck && Math.abs((fab.x + fab.width) - (ck.x + ck.width)) <= 1 && fab.y + fab.height <= ck.y - 8 && ck.y - (fab.y + fab.height) <= 16,
      `${tag}: no canto direito, logo acima do check-in`, `fab ${JSON.stringify(fab)} check-in ${JSON.stringify(ck)}`);
    if (scheme === 'light' && viewport.width === 390) await p.screenshot({ path: `${H.SAIDA}/descanso-tela-${tag}.png` });
    await p.click('#fab-descanso'); await p.waitForTimeout(100);
    ok(await p.isVisible('#descanso-dialog'), `${tag}: abre a janela`);
    ok((await p.getAttribute('#descanso-body [data-desc-tempo="60"]', 'aria-pressed')) === 'true', `${tag}: janela já marca o padrão (1 min)`);
    await p.locator('#descanso-dialog .modal-body').screenshot({ path: `${H.SAIDA}/descanso-parado-${tag}.png` });
    await p.click('#descanso-body [data-desc-tempo="30"]');
    await p.click('[data-desc-iniciar]'); await p.waitForTimeout(50);
    ok((await contador(p)) === '0:30', `${tag}: começa em 0:30`, await contador(p));
    // 10,3 s: o contador da tela se atualiza a cada 250 ms; ler bem na virada do segundo podia pegar o 0:21 ainda.
    await p.clock.runFor(10300); await p.waitForTimeout(50);
    ok((await contador(p)) === '0:20', `${tag}: desce com o tempo`, await contador(p));
    await p.click('[data-desc-ajuste="15"]');
    ok((await contador(p)) === '0:35', `${tag}: +15 s`, await contador(p));
    await p.click('[data-desc-ajuste="-15"]');
    ok((await contador(p)) === '0:20', `${tag}: −15 s`, await contador(p));
    await p.locator('#descanso-dialog .modal-body').screenshot({ path: `${H.SAIDA}/descanso-rodando-${tag}.png` });
    await p.click('#descanso-body [data-fechar]:not(.modal-close)');
    ok(!(await p.isVisible('#descanso-dialog')) && (await p.innerText('#fab-descanso-tempo')) === '0:20', `${tag}: fechar deixa rodando, tempo no botão`, await p.innerText('#fab-descanso-tempo'));
    await p.locator('#fab-descanso').screenshot({ path: `${H.SAIDA}/descanso-fab-${tag}.png` });
    await p.clock.runFor(21000); await p.waitForTimeout(80);
    ok((await p.evaluate(() => window.__vibrou.length)) === 1, `${tag}: vibra no fim`);
    ok((await p.evaluate(() => window.__mudo)) >= 1, `${tag}: libera o áudio no toque de iniciar`);
    ok((await p.evaluate(() => window.__bipes)) === 3 && (await p.evaluate(() => window.__reserva)) === 0, `${tag}: toca o som no fim pelo áudio (3 bipes)`, String(await p.evaluate(() => window.__bipes)));
    ok(await p.locator('#fab-descanso').evaluate((e) => e.classList.contains('acabou')) && await p.isHidden('#fab-descanso-tempo'), `${tag}: botão avisa o fim`);
    await p.click('#fab-descanso'); await p.waitForTimeout(80);
    ok(/Bora para a próxima série/.test(await p.innerText('#descanso-body')) && /Novo descanso/.test(await p.innerText('[data-desc-iniciar]')), `${tag}: janela mostra o fim e "Novo descanso"`);
    ok((await p.getAttribute('#descanso-body [data-desc-tempo="30"]', 'aria-pressed')) === 'true', `${tag}: Novo descanso repete o tempo usado (30 s)`);
    await p.locator('#descanso-dialog .modal-body').screenshot({ path: `${H.SAIDA}/descanso-fim-${tag}.png` });
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Pular, recarregar no meio e vibração desligada.
  p = await abrir(b, { perfis: [PERFIL({ temporizador: { ativo: true, segundos: 120, vibrar: false, som: false } })] });
  await p.click('#fab-descanso'); await p.click('[data-desc-iniciar]');
  await p.clock.runFor(30000); await p.waitForTimeout(50);
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(/^1:(30|29)$/.test(await p.innerText('#fab-descanso-tempo')), 'recarregar continua o descanso', await p.innerText('#fab-descanso-tempo'));
  await p.click('#fab-descanso'); await p.click('[data-desc-pular]'); await p.waitForTimeout(50);
  ok(await p.isVisible('[data-desc-iniciar]') && await p.isHidden('#fab-descanso-tempo'), 'Pular para o descanso');
  await p.click('[data-desc-iniciar]'); await p.clock.runFor(121000); await p.waitForTimeout(50);
  ok((await p.evaluate(() => window.__vibrou.length)) === 0 && (await p.evaluate(() => window.__bipes)) === 0 && (await p.evaluate(() => window.__reserva)) === 0 && /Bora/.test(await p.innerText('#descanso-body')), 'som e vibração desligados: só o aviso na tela');
  await p.clock.runFor(11000); await p.waitForTimeout(100); db = await H.banco(p);
  const desc = (db.eventos || []).filter((e) => e.tipo === 'descanso').map((e) => e.dados.acao).join(' ');
  ok(/pulado/.test(desc) && /completo/.test(desc) && /iniciado/.test(desc), 'eventos de descanso registrados', desc.slice(0, 200));
  ok(!p.errs.length, 'pular/recarregar: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 3b. Se o áudio for recusado, toca os bipes pela reserva (Web Audio).
  p = await abrir(b, { perfis: [PERFIL({ temporizador: { ativo: true, segundos: 30, vibrar: true, som: true } })] });
  await p.evaluate(() => { window.__playFalha = true; });
  await p.click('#fab-descanso'); await p.click('[data-desc-iniciar]');
  await p.clock.runFor(31000); await p.waitForTimeout(100);
  ok((await p.evaluate(() => window.__reserva)) === 3, 'áudio recusado: bipes pela reserva', String(await p.evaluate(() => window.__reserva)));
  ok(!p.errs.length, 'reserva: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 4. Banco sem a coluna: vem ligado e desligar funciona sem mensagem de erro (vale nesta sessão).
  p = await abrir(b, { perfis: [PERFIL()], semColunas: ['temporizador'] });
  ok(await p.isVisible('#fab-descanso'), 'sem a coluna: botão aparece (padrão ligado)');
  await H.voce(p, 'temporizador');
  await p.locator('label:has(#temp-ativo)').first().click(); await H.gravacoes(p);
  await p.click('[data-tela="treino"]'); await p.waitForTimeout(150);
  ok(await p.isHidden('#fab-descanso') && !/Não deu para salvar|erro/i.test(await p.locator('.toast, #toast').first().innerText().catch(() => '')), 'sem a coluna: desligar funciona sem erro');
  ok(!p.errs.length, 'sem a coluna: sem erros', p.errs.join(' | '));
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
