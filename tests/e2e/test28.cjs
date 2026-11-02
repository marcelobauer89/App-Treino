// On-line agora: presença publicada pelo app e mostrada ao vivo no admin.html.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const visibilidade = (p, v) => p.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u2', nome: 'Ana Souza', email: 'ana@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-21T12:00:00Z', acessos: 12, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u3', nome: 'Bruno Lima', email: 'bruno@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-09-01T12:00:00Z', acessos: 1, semana: null, dias_jiu: [], sem_peso: [] },
  ],
  checkins: [], eventos: [],
};
const T = new Date('2026-10-21T15:00:00');
const presenca = (p, topico, meta) => p.evaluate(([t, m]) => {
  const d = JSON.parse(localStorage.getItem('mock-supabase'));
  d.presenca = d.presenca || {};
  if (m) d.presenca[t] = { [t.slice(7)]: [m] }; else delete d.presenca[t];
  localStorage.setItem('mock-supabase', JSON.stringify(d));
}, [topico, meta]);
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();

  // ---------- App: publica a presença ----------
  let p = await H.novaPagina(b);
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  let db = await H.banco(p);
  const canal = (db.canais || []).find((c) => c.topico === 'online:u1');
  ok(canal && canal.opcoes.config.private === true && canal.opcoes.config.presence.key === 'u1' && canal.opcoes.config.presence.enabled === true, 'canal privado online:u1 com presença ligada', JSON.stringify(canal));
  ok(db.log.includes('on:presence:online:u1'), 'app registra ouvinte de presença');
  ok(db.log.includes('realtime:setAuth') && db.log.includes('track:online:u1:treino'), 'track na tela treino', db.log.filter((l) => /track|realtime/.test(l)).join(','));
  const meta = db.presenca['online:u1'].u1[0];
  ok(meta.tela === 'treino' && !Number.isNaN(Date.parse(meta.desde)) && meta.sistema, 'meta com tela, desde e sistema', JSON.stringify(meta));
  ok(Object.keys(meta).filter((k) => k !== 'acao').sort().join() === 'desde,sistema,tela', 'presença não leva dados pessoais (acao vem do Mundo ao vivo)', Object.keys(meta).join());
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  db = await H.banco(p);
  ok(db.presenca['online:u1'].u1[0].tela === 'dashboard', 'troca de tela atualiza presença');
  await visibilidade(p, 'hidden'); await p.waitForTimeout(100);
  db = await H.banco(p);
  ok(!db.presenca['online:u1'] && db.log.includes('untrack:online:u1'), 'esconder faz untrack');
  await visibilidade(p, 'visible'); await p.waitForTimeout(100);
  db = await H.banco(p);
  ok(db.presenca['online:u1'] && db.presenca['online:u1'].u1[0].tela === 'dashboard', 'voltar faz track de novo');
  ok(db.presenca['online:u1'].u1[0].desde > meta.desde, 'desde reinicia ao voltar');
  ok((db.canais || []).filter((c) => c.topico === 'online:u1').length === 1, 'um canal só (sem duplicar)');
  await H.voce(p); await p.click('#sair'); await p.waitForTimeout(300);
  db = await H.banco(p);
  ok(!db.presenca['online:u1'] && db.log.includes('removeChannel:realtime:online:u1'), 'sair remove presença e canal');
  ok(p.errs.length === 0, 'app sem erros', p.errs.join(' | '));
  await p.context().close();

  // Erros de presença registrados (o lote de eventos vai quando a página some).
  const errosPresenca = async (p) => { await visibilidade(p, 'hidden'); await p.waitForTimeout(150); await visibilidade(p, 'visible');
    return ((await H.banco(p)).eventos || []).filter((e) => e.tipo === 'erro' && e.dados.origem === 'presenca').map((e) => e.dados.mensagem); };
  const T0 = new Date('2026-10-23T10:00:00');

  // Falha permanente: só vira erro se não reconectar em 30 s
  p = await H.novaPagina(b, { extra: { realtimeFalhar: true } });
  await p.clock.install({ time: T0 });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  db = await H.banco(p);
  ok(!db.log.some((l) => l.startsWith('track:')) && p.errs.length === 0, 'Realtime falhando: app segue sem erros', p.errs.join(' | '));
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  ok(p.errs.length === 0, 'Realtime falhando: trocar de tela sem erros');
  await p.clock.runFor(20000); await p.waitForTimeout(50);
  let msgs = await p.evaluate(() => (JSON.parse(localStorage.getItem('mock-supabase')).eventos || []).filter((e) => e.tipo === 'erro').length);
  ok(msgs === 0, 'falha: nada registrado antes de 30 s');
  await p.clock.runFor(11000); await p.waitForTimeout(50);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0, 'falha do On-line agora não é registrada como erro (não é crítico)', JSON.stringify(msgs));
  await p.context().close();

  // Queda passageira: cai e volta em 2 s, nenhum erro
  p = await H.novaPagina(b, { extra: { realtimeOscila: true } });
  await p.clock.install({ time: T0 });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(100);
  await p.clock.runFor(2500); await p.waitForTimeout(100);
  db = await H.banco(p);
  ok(db.log.includes('track:online:u1:treino'), 'oscilação: reconecta e publica a presença');
  await p.clock.runFor(35000); await p.waitForTimeout(50);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0 && p.errs.length === 0, 'oscilação: nenhum erro registrado', JSON.stringify(msgs));
  await p.context().close();

  // Queda de rede que não volta ("transport failure"): não é registrada
  p = await H.novaPagina(b, { extra: { realtimeTransporte: true } });
  await p.clock.install({ time: T0 });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  await p.clock.runFor(40000); await p.waitForTimeout(50);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0 && p.errs.length === 0, 'transport failure: nunca registrado', JSON.stringify(msgs));
  await p.context().close();

  // Falha com a página escondida: ignorada
  p = await H.novaPagina(b, { extra: { realtimeFalhar: true } });
  await p.clock.install({ time: T0 });
  await p.addInitScript(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  await p.clock.runFor(40000); await p.waitForTimeout(50);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0, 'falha em segundo plano: ignorada', JSON.stringify(msgs));
  await p.context().close();

  // track recusado com o canal conectado: erro na hora
  p = await H.novaPagina(b, { extra: { trackFalhar: true } });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0, 'track recusado também não vira erro', JSON.stringify(msgs));
  ok(p.errs.length === 0, 'track recusado: sem erros na página', p.errs.join(' | '));
  await p.context().close();

  // track com tempo esgotado e o canal conectado: rede, não registra
  p = await H.novaPagina(b, { extra: { trackTimeout: true } });
  await p.clock.install({ time: T0 });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  await p.clock.runFor(35000); await p.waitForTimeout(50);
  msgs = await errosPresenca(p);
  ok(msgs.length === 0, 'track timed out com canal conectado: nenhum erro', JSON.stringify(msgs));
  await p.context().close();

  // App normal: nenhum erro de presença
  p = await H.novaPagina(b);
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(150);
  await visibilidade(p, 'hidden'); await p.waitForTimeout(150);
  db = await H.banco(p);
  ok(!(db.eventos || []).some((e) => e.tipo === 'erro'), 'app normal: sem evento de erro');
  await p.context().close();

  // ---------- Admin ----------
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: T });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    await p.waitForTimeout(300);
    ok((await txt(p, '#online')).includes('Ninguém on-line agora') && (await txt(p, '#on-status')) === 'Ao vivo', `${tag}: ninguém on-line, ao vivo`);
    db = await H.banco(p);
    const tops = (db.canais || []).map((c) => c.topico).sort().join();
    ok(tops === 'online:u1,online:u2,online:u3' && db.canais.every((c) => c.opcoes.config.private), `${tag}: um canal privado por usuário`, tops);
    await presenca(p, 'online:u1', { tela: 'treino', desde: '2026-10-21T14:48:00', sistema: 'iOS' });
    await presenca(p, 'online:u2', { tela: 'dashboard', desde: '2026-10-21T14:57:30', sistema: 'Android' });
    await p.waitForTimeout(400);
    ok((await txt(p, '#on-titulo')).includes('· 2'), `${tag}: contagem 2`, await txt(p, '#on-titulo'));
    const itens = await p.locator('#on-corpo li').allInnerTexts();
    ok(itens.length === 2 && /Ana Souza\s*Dashboard · há 2 min/.test(itens[0]) && /Marcelo Bauer\s*Treino · há 12 min/.test(itens[1]), `${tag}: nomes, telas e tempo`, itens.join(' | ').replace(/\n/g, ' '));
    const onAv = await p.locator('#usuarios-corpo tr').evaluateAll((trs) => trs.map((tr) => `${tr.dataset.usuario}:${tr.querySelector('.avatar').classList.contains('on')}`));
    ok(onAv.sort().join() === 'u1:true,u2:true,u3:false', `${tag}: ponto nos avatares certos`, onAv.join());
    ok(await p.locator('#usuarios-corpo tr[data-usuario="u3"] .on-sr').isHidden() && (await p.locator('#usuarios-corpo tr[data-usuario="u1"] .on-sr').textContent()).includes('on-line'), `${tag}: texto para leitor de tela`);
    const anim = await p.locator('#on-titulo .ponto').evaluate((e) => getComputedStyle(e).animationName);
    ok(anim === 'pulso', `${tag}: ponto pulsa`, anim);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0, `${tag}: sem rolagem horizontal`, String(sw));
    await p.screenshot({ path: `on-${tag}.png` });
    if (scheme === 'light' && viewport.width === 375) {
      // abre o detalhe pela faixa
      await p.locator('#on-corpo button', { hasText: 'Marcelo' }).click();
      await p.waitForSelector('#detalhe[open]'); await p.waitForTimeout(400);
      ok((await txt(p, '#det-online')).includes('On-line · Treino · há 12 min'), 'detalhe mostra on-line', await txt(p, '#det-online'));
      await p.screenshot({ path: `on-${tag}-detalhe.png` });
      await presenca(p, 'online:u1', null); await p.waitForTimeout(400);
      ok((await txt(p, '#det-online')) === '', 'detalhe atualiza ao sair');
      await p.click('[data-fechar]');
      ok((await txt(p, '#on-titulo')).includes('· 1') && await p.locator('#on-corpo li').count() === 1, 'faixa cai para 1 sem recarregar');
      // ponto pulsando na aba Visão geral quando outra aba está aberta
      ok(await p.locator('#aba-online').isHidden(), 'na visão geral, sem ponto na aba');
      await p.click('#tab-usuarios');
      ok(await p.locator('#aba-online').isVisible() && await p.locator('#aba-online').evaluate((e) => getComputedStyle(e).animationName) === 'pulso'
        && (await p.locator('#aba-online').getAttribute('aria-label')) === '1 pessoa on-line agora', 'outra aba: ponto pulsando na Visão geral');
      await p.locator('#tab-geral').screenshot({ path: 'aba-online.png' });
      await p.click('#tab-saude');
      ok(await p.locator('#aba-online').isVisible(), 'ponto continua em outra aba');
      await p.click('#tab-geral');
      // tempos atualizam
      await p.clock.runFor(60000); await p.waitForTimeout(100);
      ok((await txt(p, '#on-corpo li')).includes('há 3 min'), 'tempo atualiza sozinho', await txt(p, '#on-corpo li'));
      await presenca(p, 'online:u2', null); await p.waitForTimeout(400);
      ok((await txt(p, '#online')).includes('Ninguém on-line agora') && await p.locator('#on-titulo .ponto').evaluate((e) => getComputedStyle(e).animationName) === 'none', 'vazio: ponto parado');
      await p.click('#tab-emails');
      ok(await p.locator('#aba-online').isHidden(), 'ninguém on-line: sem ponto na aba');
      await p.click('#tab-geral');
      // Atualizar não duplica canais
      await p.click('#atualizar'); await p.waitForTimeout(300);
      db = await H.banco(p);
      ok(db.canais.length === 3, 'Atualizar não duplica canais', String(db.canais.length));
    }
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Admin com reduced-motion
  p = await H.novaPagina(b, { extra: { admin: ADM, presenca: { 'online:u2': { u2: [{ tela: 'voce', desde: new Date().toISOString(), sistema: 'iOS' }] } } } });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(ADMIN); await p.waitForSelector('#on-corpo li');
  ok(await p.locator('#on-titulo .ponto').evaluate((e) => getComputedStyle(e).animationName) === 'none', 'reduced-motion: sem animação');
  ok((await txt(p, '#on-corpo li')).includes('Você · agora mesmo'), 'tela Você, agora mesmo', await txt(p, '#on-corpo li'));
  await p.context().close();

  // Admin com parte dos canais recusada
  p = await H.novaPagina(b, { extra: { admin: ADM, realtimeFalharTopicos: ['online:u3'] } });
  p.on('console', () => {});
  await p.goto(ADMIN); await p.waitForSelector('#ver-erro-online');
  ok((await txt(p, '#on-status')).startsWith('Ao vivo em 2 de 3 usuários'), 'parcial: Ao vivo em 2 de 3', await txt(p, '#on-status'));
  ok(await p.locator('.on-erro').isHidden(), 'detalhe do erro começa oculto');
  await p.click('#ver-erro-online');
  const det = await txt(p, '.on-erro');
  ok(/Não conectou: Bruno Lima\. Erro: CHANNEL_ERROR: Unauthorized: You do not have permissions to read from this Channel topic: online:u3/.test(det), 'detalhe com usuário e erro', det);
  ok((await txt(p, '#ver-erro-online')) === 'Ocultar detalhes', 'botão alterna');
  await presenca(p, 'online:u1', { tela: 'treino', desde: new Date().toISOString(), sistema: 'iOS' }); await p.waitForTimeout(400);
  ok(await p.locator('#on-corpo li').count() === 1 && await p.locator('.on-erro').isVisible(), 'parcial: lista e detalhe juntos');
  await p.screenshot({ path: 'on-parcial.png' });
  await p.context().close();

  // Admin com Realtime falhando
  p = await H.novaPagina(b, { extra: { admin: ADM, realtimeFalhar: true } });
  await p.goto(ADMIN); await p.waitForSelector('#tentar-online');
  ok((await txt(p, '#online')).includes('Ao vivo indisponível') && await p.locator('#usuarios-corpo tr').count() === 3, 'Realtime falhando: aviso e resto do painel funciona');
  ok(/Erro: CHANNEL_ERROR: Unauthorized/.test(await txt(p, '.on-erro')), 'falha total mostra o erro', await txt(p, '.on-erro'));
  await p.click('#tentar-online'); await p.waitForTimeout(200);
  ok(await p.locator('#tentar-online').isVisible(), 'tentar de novo continua mostrando aviso');
  ok(p.errs.length === 0, 'falhando: sem erros', p.errs.join(' | '));
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
