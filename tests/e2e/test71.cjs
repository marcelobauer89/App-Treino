// Boas-vindas da conta nova em passos: o app → seus dados (privacidade, antes de gravar qualquer escolha) → objetivo.
// Sem fechar sem escolher; "Montar do zero" sem salvar volta para o objetivo; quem já usa não vê nada disso.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
// Conta nova: sem check-ins, sem pesos, plano pronto, boas-vindas nunca escondidas e política ainda não aceita.
const NOVA = (extra = {}) => ({ id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: null, politica_versao: null, ...extra });
const abrir = (b, extra, op = {}) => H.novaPagina(b, { viewport: op.viewport || { width: 390, height: 844 }, scheme: op.scheme, extra })
  .then(async (p) => { await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300); return p; });
const titulo = (p) => p.locator('#jornada-title').innerText().then((t) => t.trim());
const passo = (p) => p.locator('.bv-etapa').innerText().then((t) => t.trim()).catch(() => '');
const perfil = async (p) => (await H.banco(p)).perfis.find((x) => x.id === 'u1');

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await abrir(b, { perfis: [NOVA()] }, { scheme, viewport });
    await p.emulateMedia({ reducedMotion: 'reduce' });

    // Passo 1: o app. A janela separada da política não aparece; nada é gravado.
    ok(await p.isVisible('#jornada-dialog') && !(await p.isVisible('#politica-dialog')), `${tag}: abre as boas-vindas (sem a janela da política)`);
    ok((await titulo(p)) === 'Bem-vindo ao OSS' && (await passo(p)) === 'Etapa 1 de 3', `${tag}: passo 1 de 3`, `${await titulo(p)} / ${await passo(p)}`);
    const corpo = await p.innerText('#jornada-body');
    ok(['Treino do dia', 'Check-in', 'Dashboard', 'Temporizador de descanso', 'Você'].every((x) => corpo.includes(x)), `${tag}: explica o app`);
    ok(!(await p.locator('#jornada-body [data-fechar]').count()) && !(await p.locator('#novidade-ocultar').count()), `${tag}: sem X e sem "Não mostrar de novo"`);
    ok(!(await p.locator('.bv-passos').count()) && (await p.locator('.bv-etapa').count()) === 1, `${tag}: a etapa aparece num lugar só (sem pontinhos)`);
    await p.locator('#jornada-dialog .modal-body').screenshot({ path: `${H.SAIDA}/boas-vindas-1-${tag}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.mouse.click(5, 5); await p.waitForTimeout(100);
    ok(await p.isVisible('#jornada-dialog') && (await titulo(p)) === 'Bem-vindo ao OSS', `${tag}: Esc e toque fora não fecham`);
    await p.waitForTimeout(200);
    ok(!(await perfil(p)).politica_versao, `${tag}: passo 1 não grava a política`);

    // Passo 2: seus dados.
    await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
    ok((await titulo(p)) === 'Seus dados' && (await passo(p)) === 'Etapa 2 de 3', `${tag}: Começar leva a "Seus dados"`, await titulo(p));
    ok(/administrador vê/.test(await p.innerText('#jornada-body')) && await p.isVisible('#jornada-body a[href="privacidade.html"]'), `${tag}: mostra o aviso e o link da política`);
    {
      // Topo: título à esquerda e a etapa à direita, na mesma linha. Rodapé: Voltar à esquerda e o botão à direita, na mesma linha.
      const [t, e, v, bt] = await Promise.all(['#jornada-title', '.bv-etapa', '.bv-rodape [data-jd-voltar]', '[data-jd-entendi]'].map((sel) => p.locator(sel).boundingBox()));
      ok(t && e && e.x > t.x + t.width && Math.abs((e.y + e.height) - (t.y + t.height)) < 14, `${tag}: etapa na linha do título, à direita`);
      ok(v && bt && v.x < bt.x && Math.abs((v.y + v.height / 2) - (bt.y + bt.height / 2)) < 4, `${tag}: Voltar à esquerda na linha do botão`);
    }
    await p.locator('#jornada-dialog .modal-body').screenshot({ path: `${H.SAIDA}/boas-vindas-2-${tag}.png` });
    await p.click('[data-jd-voltar]'); await p.waitForTimeout(100);
    ok((await titulo(p)) === 'Bem-vindo ao OSS', `${tag}: Voltar volta ao passo 1`);
    await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
    await p.click('[data-jd-entendi]'); await p.waitForTimeout(400);
    ok((await perfil(p)).politica_versao, `${tag}: Entendi grava a política`);

    // Passo 3: objetivo.
    ok((await titulo(p)) === 'Qual é o seu objetivo?' && (await passo(p)) === 'Etapa 3 de 3', `${tag}: Entendi leva ao objetivo`, await titulo(p));
    const cartoes = await p.locator('.jornada .jornada-topo b').allInnerTexts();
    ok(cartoes.includes('Jiu Jitsu') && cartoes.includes('Montar do zero') && !cartoes.some((c) => /\(OSS\)|Jiu-jitsu/i.test(c)), `${tag}: "Jiu Jitsu" e "Montar do zero" na lista`, cartoes.join(' | '));
    await p.locator('#jornada-dialog .modal-body').screenshot({ path: `${H.SAIDA}/boas-vindas-3-${tag}.png` });
    // Cabeçalho e rodapé fixos: rolando a lista, título e etapa ficam no topo e o Voltar embaixo, à esquerda.
    await p.locator('#jornada-dialog').evaluate((d) => { d.scrollTop = 700; }); await p.waitForTimeout(100);
    const [cab, rod, dlg] = await Promise.all(['.bv-cabeca', '.bv-rodape', '#jornada-dialog'].map((sel) => p.locator(sel).boundingBox()));
    ok(cab && dlg && Math.abs(cab.y - dlg.y) <= 2, `${tag}: cabeçalho fixo ao rolar`, `${cab && cab.y} / ${dlg && dlg.y}`);
    ok(rod && dlg && Math.abs((rod.y + rod.height) - (dlg.y + dlg.height)) <= 2 && await p.isVisible('.bv-rodape [data-jd-voltar]'), `${tag}: rodapé fixo com o Voltar`);
    await p.screenshot({ path: `${H.SAIDA}/boas-vindas-3-rolado-${tag}.png` });
    await p.locator('#jornada-dialog').evaluate((d) => { d.scrollTop = 0; });
    ok((await p.locator('.bv-cabeca [data-jd-voltar]').count()) === 0, `${tag}: Voltar só embaixo`);
    await p.click('[data-jd-voltar]'); await p.waitForTimeout(100);
    ok((await titulo(p)) === 'Seus dados' && /Continuar/.test(await p.innerText('[data-jd-entendi]')), `${tag}: Voltar do objetivo mostra "Seus dados" com Continuar`);
    await p.click('[data-jd-entendi]'); await p.waitForTimeout(100);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    // Tela cheia: o app (treinos de exemplo) fica escondido atrás das boas-vindas.
    ok(await p.evaluate(() => document.body.classList.contains('bv-ativa') && getComputedStyle(document.querySelector('main.wrap')).visibility === 'hidden'), `${tag}: app escondido atrás das boas-vindas`);
    await p.screenshot({ path: `${H.SAIDA}/boas-vindas-tela-${tag}.png` });

    // Escolher Hipertrofia grava os treinos e encerra as boas-vindas.
    // Escolher só marca; o Confirmar aparece no rodapé.
    ok(!(await p.locator('[data-jd-confirmar]').count()), `${tag}: sem Confirmar antes de escolher`);
    await p.click('[data-jd-marcar="hipertrofia"]'); await p.waitForTimeout(100);
    ok(await p.isVisible('.bv-rodape [data-jd-confirmar]') && (await p.getAttribute('[data-jd-marcar="hipertrofia"]', 'aria-pressed')) === 'true'
      && await p.locator('.jornada.selecionada').count() === 1 && await p.isVisible('#jornada-dialog'), `${tag}: Escolher marca o cartão e mostra Confirmar`);
    ok(!(await perfil(p)).jornada, `${tag}: só marcar não grava`);
    await p.locator('#jornada-dialog .modal-body').screenshot({ path: `${H.SAIDA}/boas-vindas-3-escolhido-${tag}.png` });
    await p.click('[data-jd-confirmar]'); await p.waitForTimeout(250);
    ok(await p.isVisible('.bv-montando') && /Montando/.test(await p.innerText('.bv-montando')), `${tag}: Confirmar abre a animação "Montando seus treinos"`);
    ok((await perfil(p)).jornada === 'hipertrofia', `${tag}: a escolha é gravada ao confirmar`);
    await p.waitForSelector('#jornada-dialog', { state: 'hidden', timeout: 15000 }); await p.waitForTimeout(300);
    const pf = await perfil(p);
    ok(!(await p.isVisible('#jornada-dialog')) && pf.jornada === 'hipertrofia' && pf.novidade_oculta, `${tag}: escolher Hipertrofia grava e fecha`, `${pf.jornada} / ${pf.novidade_oculta}`);
    ok(await p.evaluate(() => !document.body.classList.contains('bv-ativa') && getComputedStyle(document.querySelector('main.wrap')).visibility === 'visible'), `${tag}: depois da escolha, o app aparece`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Animação "Montando seus treinos" com movimento: treinos um a um, semana, "Tudo pronto!" e só então o app.
  for (const scheme of ['light', 'dark']) {
    const p = await abrir(b, { perfis: [NOVA({ politica_versao: '2026-10-27' })] }, { scheme });
    await p.click('[data-jd-comecar]'); await p.click('[data-jd-marcar="hipertrofia"]'); await p.click('[data-jd-confirmar]');
    await p.waitForTimeout(1300);
    const nomes = await p.locator('.mt-treino b').allInnerTexts();
    ok(nomes.length === 4 && (await p.locator('.mt-treino.on').count()) >= 1, `${scheme}: monta os 4 treinos de Hipertrofia, um a um`, nomes.join(' | '));
    ok(/Montando/.test(await p.innerText('#mt-etapa')) && await p.evaluate(() => document.body.classList.contains('bv-ativa')), `${scheme}: etapa anunciada e app ainda escondido`);
    await p.screenshot({ path: `${H.SAIDA}/montando-1-${scheme}.png` });
    await p.waitForSelector('.bv-montando.semana-on', { timeout: 8000 }); await p.waitForTimeout(450);
    await p.screenshot({ path: `${H.SAIDA}/montando-2-${scheme}.png` });
    ok((await p.locator('.mt-treino.feito').count()) === 4 && /semana|pronto/i.test(await p.innerText('#mt-etapa')), `${scheme}: treinos prontos e semana montando`, `${await p.locator('.mt-treino.feito').count()} / ${await p.innerText('#mt-etapa')}`);
    await p.waitForSelector('.bv-montando.pronto', { timeout: 8000 }); await p.waitForTimeout(250);
    ok(/Tudo pronto/.test(await p.innerText('#mt-etapa')), `${scheme}: "Tudo pronto!"`);
    await p.screenshot({ path: `${H.SAIDA}/montando-3-${scheme}.png` });
    await p.waitForSelector('#jornada-dialog', { state: 'hidden', timeout: 8000 }); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.body.classList.contains('bv-ativa')) && (await p.locator('.treino-btn').count()) === 4
      && /Hipertrofia/.test(await p.locator('#toast, .toast').first().innerText().catch(() => '')), `${scheme}: depois da animação, o app com os 4 treinos e o aviso com Desfazer`);
    ok(!p.errs.length, `${scheme}: animação sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Nada registrado antes da privacidade: os eventos de uso só citam as boas-vindas depois do Entendi.
  let p = await abrir(b, { perfis: [NOVA()] });
  await p.waitForTimeout(200);
  await p.click('[data-jd-comecar]'); await p.click('[data-jd-entendi]'); await p.waitForTimeout(100);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))).catch(() => {});
  await p.waitForTimeout(11500);
  let db = await H.banco(p);
  const tipos = (db.eventos || []).map((e) => e.tipo);
  const iPol = tipos.indexOf('politica_aceita'); const iJor = tipos.indexOf('jornadas_abertas');
  ok(iPol >= 0 && iJor > iPol && !tipos.includes('novidade_treinos'), 'eventos: política aceita antes de abrir os objetivos', tipos.join(','));
  await p.context().close();

  // Política já aceita: só 2 passos (o app → objetivo).
  p = await abrir(b, { perfis: [NOVA({ politica_versao: '2026-10-27' })] });
  ok((await passo(p)) === 'Etapa 1 de 2', 'política já aceita: 2 passos', await passo(p));
  await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
  ok((await titulo(p)) === 'Qual é o seu objetivo?', 'política já aceita: Começar vai direto ao objetivo');
  await p.context().close();

  // Banco sem a coluna da política: também 2 passos, sem erro.
  const semCol = NOVA(); delete semCol.politica_versao;
  p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: { perfis: [semCol] } });
  await p.addInitScript(() => {
    const d = JSON.parse(localStorage.getItem('mock-supabase') || 'null');
    if (d && d.perfis) { d.perfis.forEach((x) => { delete x.politica_versao; }); localStorage.setItem('mock-supabase', JSON.stringify(d)); }
  });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  ok((await passo(p)) === 'Etapa 1 de 2' && !p.errs.length, 'sem a coluna da política: 2 passos, sem erro', `${await passo(p)} ${p.errs.join(' | ')}`);
  await p.context().close();

  // Montar do zero: sair do editor sem salvar volta ao objetivo; salvar encerra as boas-vindas.
  p = await abrir(b, { perfis: [NOVA({ politica_versao: '2026-10-27' })] });
  await p.click('[data-jd-comecar]'); await H.escolherBV(p, 'zero');
  ok(await p.isVisible('#editor-dialog') && !(await p.isVisible('#jornada-dialog')), 'Montar do zero abre o editor');
  ok(await p.evaluate(() => document.body.classList.contains('bv-ativa')), 'Montar do zero: app continua escondido');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  if (await p.locator('[data-ed-sair-sim]').count()) { await p.click('[data-ed-sair-sim]'); await p.waitForTimeout(150); }
  ok(await p.isVisible('#jornada-dialog') && (await titulo(p)) === 'Qual é o seu objetivo?', 'sair sem salvar volta ao objetivo');
  ok(!(await perfil(p)).novidade_oculta, 'sair sem salvar não encerra as boas-vindas');
  await H.escolherBV(p, 'zero');
  await p.locator('#editor-body [data-ed-add]').first().click(); await p.waitForTimeout(100);
  const salvar = p.locator('[data-ed-salvar]');
  if (!(await salvar.isVisible())) { await p.locator('[data-ed-vista="treino"]').first().click().catch(() => {}); await p.waitForTimeout(100); }
  await salvar.click(); await p.waitForTimeout(400);
  ok(!(await p.isVisible('#editor-dialog')) && !(await p.isVisible('#jornada-dialog')) && (await perfil(p)).novidade_oculta, 'salvar os treinos encerra as boas-vindas');
  ok(await p.evaluate(() => !document.body.classList.contains('bv-ativa')), 'salvar os treinos mostra o app');
  ok(!p.errs.length, 'montar do zero: sem erros', p.errs.join(' | '));
  await p.context().close();

  // Quem já usa: sem boas-vindas; "Mudar meu objetivo" continua com X e fecha.
  p = await abrir(b, { perfis: [NOVA({ politica_versao: '2026-10-27', novidade_oculta: '2026-10-01T00:00:00Z' })],
    checkins: [{ id: 'c1', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T10:00:00', fim: '2026-10-20T11:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] });
  ok(!(await p.isVisible('#jornada-dialog')), 'quem já usa: sem boas-vindas');
  await H.voce(p, 'treinos');
  await p.click('#trocar-jornada'); await p.waitForTimeout(150);
  ok((await titulo(p)) === 'Mudar meu objetivo' && (await p.locator('#jornada-body [data-fechar]').count()) === 1 && !(await p.locator('.bv-etapa').count()), 'Mudar meu objetivo: com X e sem passos');
  await p.click('#jornada-body [data-fechar]'); await p.waitForTimeout(150);
  ok(!(await p.isVisible('#jornada-dialog')), 'Mudar meu objetivo fecha no X');
  await p.context().close();

  // Link de teste só no dev: /dev/?boas-vindas abre as 3 etapas mesmo numa conta que já usa; na produção, nada.
  const USADA = { perfis: [NOVA({ politica_versao: '2026-10-27', novidade_oculta: '2026-10-01T00:00:00Z' })],
    checkins: [{ id: 'c1', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T10:00:00', fim: '2026-10-20T11:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] };
  for (const dev of [true, false]) {
    p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, dev, extra: USADA });
    // No dev, o app lê o localStorage com o prefixo "dev:" (como no test53).
    if (dev) await p.context().addInitScript(() => {
      const ler = Storage.prototype.getItem.bind(localStorage);
      if (!sessionStorage.getItem('dev-semeado')) { localStorage.setItem('dev:mock-supabase', ler('mock-supabase')); sessionStorage.setItem('dev-semeado', '1'); }
    });
    await p.goto(`${H.PAGINA}?boas-vindas`); await H.prontos(p); await p.waitForTimeout(300);
    if (dev) {
      ok(await p.isVisible('#jornada-dialog') && (await passo(p)) === 'Etapa 1 de 3', 'dev ?boas-vindas: conta que já usa vê as 3 etapas', await passo(p));
      ok(!(await p.evaluate(() => location.search.includes('boas-vindas'))), 'dev: o parâmetro sai do endereço');
      await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
      ok((await titulo(p)) === 'Seus dados' && /Continuar/.test(await p.innerText('[data-jd-entendi]')), 'dev: "Seus dados" com Continuar (política já aceita)');
    } else {
      ok(!(await p.isVisible('#jornada-dialog')), 'produção ?boas-vindas: não abre nada');
    }
    ok(!p.errs.length, `?boas-vindas (${dev ? 'dev' : 'produção'}): sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
