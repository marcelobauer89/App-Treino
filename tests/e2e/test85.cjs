// PWA, etapa 2 (RF-04): uso sem internet. Cópia dos dados no aparelho, fila de envio guardada que sai quando a
// conexão volta, abertura sem internet com a sessão vencida e Sair bloqueado com mudanças ainda não enviadas.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = (p, s) => p.locator(s).innerText().catch(() => '');
// Liga ou desliga a "internet": o banco falso falha como o navegador e o navigator.onLine acompanha.
const rede = (p, ligada, extra = {}) => p.evaluate(([ligada, extra]) => {
  const d = JSON.parse(localStorage.getItem('mock-supabase'));
  Object.assign(d, { semRede: !ligada }, extra);
  localStorage.setItem('mock-supabase', JSON.stringify(d));
  localStorage.setItem('teste-offline', ligada ? '0' : '1');
  window.dispatchEvent(new Event(ligada ? 'online' : 'offline'));
}, [ligada, extra]);
const local = (p, k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => localStorage.getItem('teste-offline') !== '1' });
  });
  await p.clock.install({ time: new Date('2026-10-19T09:00:00') }); // segunda: Treino 2
  await p.goto(H.PAGINA); await H.prontos(p);

  // 1. Com internet: a cópia dos dados fica no aparelho, sem selo.
  const copia = await local(p, 'bauer-copia-u1');
  ok(copia && copia.p && copia.p.id === 'u1' && Array.isArray(copia.c), 'cópia dos dados guardada no aparelho');
  ok((await local(p, 'bauer-copia-usuario') || {}).id === 'u1', 'conta guardada para abrir sem internet');
  ok(await p.locator('#pendentes').isHidden(), 'com internet: sem o selo');

  // 2. Sem internet: o check-in fica salvo no aparelho e aparece na tela.
  await rede(p, false);
  await p.click('#fab-checkin');
  await p.click('#form-dialog label.opcao:has(input[value="jiu"])');
  await p.click('[data-salvar-form]');
  await H.gravacoes(p);
  let db = await H.banco(p);
  ok(db.checkins.length === 0, 'sem internet: nada chegou ao servidor');
  const pend = await local(p, 'bauer-pendentes-u1');
  ok(Array.isArray(pend) && pend.length === 1 && pend[0].t === 'checkin' && pend[0].linha.tipo === 'jiu', 'check-in guardado na fila do aparelho', JSON.stringify(pend));
  ok(/Sem internet: ficou guardado no aparelho e será salvo na sua conta assim que a internet voltar/.test(await txt(p, '#toast')), 'aviso de guardado no aparelho', await txt(p, '#toast'));
  ok(await p.locator('#pendentes svg.pendentes-ic').count() === 1 && /será salva na sua conta assim que a internet voltar/.test(await txt(p, '#pendentes')), 'faixa com ícone de sem wi-fi e frase de quando volta', await txt(p, '#pendentes'));
  ok(/1 alteração guardada/.test(await txt(p, '#pendentes')), 'selo com 1 alteração guardada', await txt(p, '#pendentes'));
  ok(!/Não foi possível salvar/.test(await txt(p, '#toast')), 'sem internet não recarrega nem descarta');
  await p.screenshot({ path: `${H.SAIDA}/offline-selo.png` });

  // 3. Sair com mudança não enviada: bloqueado, com aviso.
  await H.voce(p);
  await p.click('#sair'); await H.gravacoes(p);
  ok(await p.locator('#tela-voce').isVisible() && /ainda não foram enviadas/.test(await txt(p, '#toast')), 'Sair bloqueado com mudança não enviada', await txt(p, '#toast'));

  // 4. Fecha e abre sem internet, com a sessão vencida: abre com a cópia, já com o check-in.
  // O login demora 30 s para responder (a biblioteca tentando renovar): o app não espera por ele.
  await rede(p, false, { sessaoVencida: true, atrasoSessao: 30000 });
  await p.reload(); await H.prontos(p);
  ok(await p.locator('#tela-entrar').isHidden(), 'sem internet e sessão vencida: o app abre na hora com a cópia');
  ok(/1 alteração guardada/.test(await txt(p, '#pendentes')), 'selo continua depois de reabrir', await txt(p, '#pendentes'));
  const naTela = await p.evaluate(() => checkins.map((c) => c.tipo));
  ok(naTela.length === 1 && naTela[0] === 'jiu', 'check-in feito sem internet continua na tela', JSON.stringify(naTela));

  // 5. Mais uma mudança sem internet: peso de um exercício (fila com 2).
  await p.click('.nav [data-tela="treino"]');
  await p.locator('.ex .log-btn').first().click();
  await p.fill('#kg-0', '20');
  await p.click('[data-concluir]');
  await H.gravacoes(p);
  const pend2 = await local(p, 'bauer-pendentes-u1') || [];
  ok(pend2.length === 2 && pend2.some((x) => x.t === 'carga'), 'peso também entra na fila', JSON.stringify(pend2.map((x) => x.t)));
  ok(/2 alterações guardadas/.test(await txt(p, '#pendentes')), 'faixa: 2 alterações', await txt(p, '#pendentes'));
  // Pesos em mais dois exercícios do mesmo treino: um pedido só, mas cada exercício conta como uma alteração.
  for (const i of [1, 2]) {
    await p.locator('.ex .log-btn').nth(i).click();
    await p.fill('#kg-0', String(30 + i));
    await p.click('[data-concluir]');
    await H.gravacoes(p);
  }
  // Corrigir o peso de um exercício já contado não soma de novo.
  await p.locator('.ex .log-btn').first().click();
  await p.fill('#kg-0', '21');
  await p.click('[data-concluir]');
  await H.gravacoes(p);
  const pend3 = await local(p, 'bauer-pendentes-u1') || [];
  ok(pend3.length === 2, 'pesos do mesmo treino continuam num pedido só', JSON.stringify(pend3.map((x) => x.t)));
  ok(/4 alterações guardadas/.test(await txt(p, '#pendentes')), 'faixa conta cada exercício: 4 alterações', await txt(p, '#pendentes'));
  await p.screenshot({ path: `${H.SAIDA}/offline-faixa-4.png` });

  // 5b. Wi-Fi sem internet (o aparelho diz que está on-line) e o login demorando: abre com a cópia depois de 3 s.
  await p.evaluate(() => localStorage.setItem('teste-offline', '0'));
  await p.reload();
  await p.waitForTimeout(300);
  ok(await p.locator('#tela-entrar').isVisible(), 'Wi-Fi sem internet: espera o login por alguns segundos');
  await p.clock.runFor(3200);
  await H.prontos(p);
  ok(/4 alterações guardadas/.test(await txt(p, '#pendentes')), 'Wi-Fi sem internet: abre com a cópia e as 4 alterações', await txt(p, '#pendentes'));
  // A resposta do login chega ("sem sessão", a renovação falhou): o app continua aberto.
  await p.clock.runFor(30000); await p.waitForTimeout(200);
  ok(await p.locator('#tela-entrar').isHidden() && await p.locator('.nav').isVisible(), 'login responde sem sessão sem internet: continua no app');

  // 6. A internet volta: a fila sai sozinha, na ordem, e o selo some.
  await rede(p, true, { sessaoVencida: false });
  await H.gravacoes(p); await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.checkins.length === 1 && db.checkins[0].tipo === 'jiu', 'internet de volta: check-in enviado', JSON.stringify(db.checkins.map((c) => c.tipo)));
  ok((db.cargas || []).length === 1 && Object.keys(db.cargas[0].series).length === 3, 'internet de volta: pesos dos 3 exercícios enviados', JSON.stringify(db.cargas));
  ok(!(await local(p, 'bauer-pendentes-u1')), 'fila do aparelho vazia');
  ok(await p.locator('#pendentes').isHidden(), 'selo some');
  ok(/suas alterações foram enviadas/.test(await txt(p, '#toast')), 'aviso de enviado', await txt(p, '#toast'));

  // 7. Sair com tudo enviado: apaga a cópia do aparelho.
  await H.voce(p);
  await p.click('#sair');
  await p.waitForSelector('#entrar-google:not([hidden])');
  ok(!(await local(p, 'bauer-copia-u1')) && !(await local(p, 'bauer-copia-usuario')), 'ao sair, a cópia dos dados é apagada');
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
