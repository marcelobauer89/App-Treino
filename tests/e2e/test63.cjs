// Jornadas prontas: conta nova escolhe, quem já usa fica com o que tem, troca com confirmação e Desfazer.
const { chromium } = require('playwright');
const fs = require('fs');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const S = H.SAIDA;
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.trim());
const NOVA = { id: 'u1', nome: 'Ana', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: null };
// Treino personalizado de uma pessoa (como o da Jô): tem que continuar idêntico.
const PROPRIO = { 1: { nome: 'Inferiores', subtitulo: 'Glúteo', exercicios: [{ nome: 'Elevação de quadril', dose: '3×10', pse: 8 }, { nome: 'Agachamento búlgaro', dose: '3×10', pse: 8 }] },
  2: { nome: 'Superiores', subtitulo: 'Braços', exercicios: [{ nome: 'Tríceps na corda', dose: '3×12', pse: 8 }] } };
const SEMANA_PROPRIA = [[], ['t1'], ['jiu'], ['t2'], ['jiu'], ['t1'], []];
const abrir = (b, extra, op = {}) => H.novaPagina(b, { viewport: op.viewport || { width: 390, height: 844 }, scheme: op.scheme, extra })
  .then(async (p) => { await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300); return p; });

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // Dados: todo exercício das jornadas existe na biblioteca, sem repetir no treino, e cabe nas regras do banco.
  let p = await abrir(b, { perfis: [{ ...NOVA, novidade_oculta: '2026-10-01T00:00:00Z' }], checkins: [{ id: 'c0', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-01T19:00:00', fim: '2026-10-01T20:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] });
  const html = fs.readFileSync(H.RAIZ + '/index.html', 'utf8');
  const bloco = html.slice(html.indexOf('const JORNADAS = ['), html.indexOf('const jornadaPorId'));
  const nomes = [...bloco.matchAll(/exJ\('([^']+)'/g)].map((m) => m[1]);
  // Os nomes da biblioteca saem do próprio HTML (PLANO_PADRAO + EXERCICIOS_EXTRAS).
  const nomesBib = new Set([...html.slice(html.indexOf('const PLANO_PADRAO'), html.indexOf('const chaveExercicio')).matchAll(/\{ nome: '([^']+)', grupo:/g)].map((m) => m[1]));
  const fora = [...new Set(nomes.filter((n) => !nomesBib.has(n)))];
  ok(nomes.length >= 60 && !fora.length, 'todo exercício das jornadas está na biblioteca', fora.join(', '));
  const porTreino = [...bloco.matchAll(/exercicios: \[([\s\S]*?)\]/g)].map((m) => [...m[1].matchAll(/exJ\('([^']+)'/g)].map((x) => x[1]));
  ok(porTreino.length === 10 && porTreino.every((t) => t.length >= 3 && t.length <= 15 && new Set(t).size === t.length), '10 treinos, 3 a 15 exercícios, sem repetir', porTreino.map((t) => t.length).join(','));
  // O plano pronto não mudou (comparado com a cópia guardada antes das jornadas).
  const planoAntes = fs.readFileSync(`${H.APOIO}/plano-padrao.txt`, 'utf8');
  const planoAgora = html.slice(html.indexOf('const PLANO_PADRAO = {'), html.indexOf('const EXERCICIOS_EXTRAS'));
  ok(planoAntes === planoAgora, 'PLANO_PADRAO idêntico ao de antes');
  await p.context().close();

  // 1. Quem já usa com treino personalizado: nada muda, sem tela de escolha.
  p = await abrir(b, { perfis: [{ ...NOVA, novidade_oculta: null, treinos: PROPRIO, semana: SEMANA_PROPRIA }],
    checkins: [{ id: 'c1', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T10:00:00', fim: '2026-10-20T11:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] });
  let db = await H.banco(p);
  ok(!(await p.locator('#jornada-dialog[open]').count()), 'conta personalizada: sem tela de jornadas');
  ok(JSON.stringify(db.perfis[0].treinos) === JSON.stringify(PROPRIO) && JSON.stringify(db.perfis[0].semana) === JSON.stringify(SEMANA_PROPRIA) && !db.perfis[0].jornada, 'conta personalizada: treinos e semana idênticos');
  ok((await p.locator('.treino-btn').count()) === 2, 'conta personalizada: os 2 treinos dela na tela');
  await p.context().close();

  // 2. Quem usa o plano pronto e já tem check-ins: continua com ele, sem tela de escolha.
  p = await abrir(b, { perfis: [{ ...NOVA, novidade_oculta: '2026-10-01T00:00:00Z' }],
    checkins: [{ id: 'c2', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T10:00:00', fim: '2026-10-20T11:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] });
  db = await H.banco(p);
  ok(!(await p.locator('#jornada-dialog[open]').count()) && db.perfis[0].treinos == null && (await p.locator('.treino-btn').count()) === 3, 'plano pronto com check-ins: continua igual');
  await H.voce(p, 'treinos');
  ok(/plano pronto/.test(await txt(p, '#meus-treinos-nota')), 'Meus treinos: plano pronto', await txt(p, '#meus-treinos-nota'));
  await p.context().close();

  // 3. Conta nova: vê as jornadas, abre "Ver treinos" e escolhe Hipertrofia.
  for (const scheme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      p = await abrir(b, { perfis: [NOVA], checkins: [], cargas: [] }, { scheme, viewport: { width, height: 844 } });
      const tag = `${scheme} ${width}`;
      await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
      ok((await txt(p, '#jornada-title')) === 'Qual é o seu objetivo?' && (await p.locator('#jornada-body > .jornadas > .jornada').count()) === 5, `${tag}: conta nova vê 4 jornadas + montar do zero`);
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
      await p.screenshot({ path: `${S}/jornadas-${scheme}-${width}.png` });
      await p.click('[data-jd-ver="hipertrofia"]');
      ok((await p.locator('#jornada-treinos-hipertrofia h4').count()) === 4 && (await p.getAttribute('[data-jd-ver="hipertrofia"]', 'aria-expanded')) === 'true', `${tag}: Ver treinos mostra os 4 treinos`);
      ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.jdVer === 'hipertrofia'), `${tag}: foco fica no botão`);
      await p.locator('#jornada-treinos-hipertrofia').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${S}/jornadas-ver-${scheme}-${width}.png` });
      await H.escolherBV(p, 'hipertrofia'); await H.gravacoes(p);
      db = await H.banco(p);
      const per = db.perfis[0];
      ok(!(await p.locator('#jornada-dialog[open]').count()) && per.jornada === 'hipertrofia' && Object.keys(per.treinos).join() === '1,2,3,4', `${tag}: escolheu Hipertrofia, 4 treinos gravados`, JSON.stringify(per.jornada));
      ok(JSON.stringify(per.semana) === JSON.stringify([[], ['t1'], ['jiu', 't2'], [], ['jiu', 't3'], ['t4'], ['bike']]), `${tag}: semana sugerida com os dias de jiu mantidos`, JSON.stringify(per.semana));
      ok(per.novidade_oculta, `${tag}: boas-vindas não voltam`);
      ok((await p.locator('.treino-btn').count()) === 4 && (await p.locator('#sobre .sobre').count()) === 1, `${tag}: 4 abas e "Sobre o treino" da jornada`);
      ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
      if (scheme === 'light' && width === 390) {
        await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
        ok(!(await p.locator('#jornada-dialog[open], #novidade-dialog[open]').count()) && (await p.locator('.treino-btn').count()) === 4, 'recarregar: continua com a jornada, sem aviso');
        await H.voce(p, 'treinos');
        ok(/Seu objetivo é Hipertrofia\./.test(await txt(p, '#meus-treinos-nota')), 'Meus treinos: jornada Hipertrofia', await txt(p, '#meus-treinos-nota'));
        // Personalizar: tira um exercício e salva.
        await p.click('#editar-treinos');
        await p.click('[data-ed-remover="0"]');
        await H.salvarEditor(p); await H.gravacoes(p);
        ok(/personalizados por você/.test(await txt(p, '#meus-treinos-nota')) && (await H.banco(p)).perfis[0].jornada === 'hipertrofia', 'personalizar: jornada continua, agora personalizada');
        await p.evaluate(() => { location.hash = '#voce'; }); await p.waitForTimeout(100);
        ok((await txt(p, '#valor-treinos')) === 'Hipertrofia (personalizada)', 'lista de Você mostra (personalizada)', await txt(p, '#valor-treinos'));
        await p.screenshot({ path: `${S}/jornadas-voce.png` });
      }
      await p.context().close();
    }
  }

  // 4. Trocar de jornada (conta personalizada): confirma, troca, e o Desfazer volta exatamente ao de antes.
  p = await abrir(b, { perfis: [{ ...NOVA, novidade_oculta: '2026-10-01T00:00:00Z', treinos: PROPRIO, semana: SEMANA_PROPRIA }] });
  await H.voce(p, 'treinos');
  await p.click('#trocar-jornada');
  ok((await txt(p, '#jornada-title')) === 'Mudar meu objetivo' && !(await p.locator('#jornada-body #novidade-ocultar').count()), 'Mudar meu objetivo abre sem a caixa de boas-vindas');
  ok(!(await p.locator('[data-jd-confirmar]').count()), 'sem Confirmar antes de escolher');
  await p.click('[data-jd-marcar="mobilidade"]');
  ok(await p.isVisible('.bv-rodape [data-jd-confirmar]') && !(await p.locator('.bv-rodape p').count())
    && (await p.getAttribute('[data-jd-marcar="mobilidade"]', 'aria-pressed')) === 'true', 'Escolher marca e mostra só o Confirmar no rodapé');
  await p.screenshot({ path: `${S}/jornadas-confirmar.png` });
  await p.click('[data-jd-marcar="mobilidade"]');
  db = await H.banco(p);
  ok(JSON.stringify(db.perfis[0].treinos) === JSON.stringify(PROPRIO) && !(await p.locator('[data-jd-confirmar]').count()), 'desmarcar não muda nada');
  await p.click('[data-jd-marcar="mobilidade"]'); await p.click('[data-jd-confirmar]'); await p.waitForTimeout(200);
  ok(await p.isVisible('.bv-montando') && await p.evaluate(() => document.body.classList.contains('bv-ativa')), 'Confirmar mostra a animação em tela cheia');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await p.isVisible('.bv-montando'), 'a animação não fecha no Esc');
  await p.waitForSelector('#jornada-dialog', { state: 'hidden', timeout: 15000 }); await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.perfis[0].jornada === 'mobilidade' && db.perfis[0].treinos['3'].nome === 'Pegada', 'trocou para Mobilidade e prevenção');
  ok(JSON.stringify(db.perfis[0].semana) === JSON.stringify([[], ['t1'], ['jiu'], ['t2'], ['jiu'], ['t3'], []]), 'semana com os treinos novos e o jiu mantido', JSON.stringify(db.perfis[0].semana));
  ok(JSON.stringify(db.perfis[0].treinos_anterior.treinos) === JSON.stringify(PROPRIO), 'treinos de antes guardados');
  await p.click('.toast-acao'); await H.gravacoes(p);
  db = await H.banco(p);
  ok(JSON.stringify(db.perfis[0].treinos) === JSON.stringify(PROPRIO) && JSON.stringify(db.perfis[0].semana) === JSON.stringify(SEMANA_PROPRIA) && !db.perfis[0].jornada, 'Desfazer volta aos treinos e à semana de antes', JSON.stringify(db.perfis[0].jornada));
  ok(!p.errs.length, 'troca: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 5. Conta nova: as boas-vindas não fecham sem escolher; sair do app sem escolher deixa a escolha para a próxima vez.
  p = await abrir(b, { perfis: [NOVA], checkins: [], cargas: [] });
  await p.keyboard.press('Escape'); await H.gravacoes(p);
  ok(await p.locator('#jornada-dialog[open]').count() === 1, 'Esc não fecha as boas-vindas');
  ok(!(await H.banco(p)).perfis[0].novidade_oculta && (await H.banco(p)).perfis[0].treinos == null, 'sem escolher: nada muda');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
  ok(await p.locator('#jornada-dialog[open]').count() === 1, 'a escolha volta na próxima abertura');
  await p.click('[data-jd-comecar]');
  await H.escolherBV(p, 'zero');
  ok(await p.locator('#ed-busca').isVisible(), 'Montar do zero abre a biblioteca');
  await p.context().close();

  // 6. Banco sem a coluna jornada: escolher funciona e grava os treinos.
  p = await abrir(b, { perfis: [NOVA], checkins: [], cargas: [], semColunas: ['jornada'] });
  await p.click('[data-jd-comecar]');
  await H.escolherBV(p, 'forca'); await H.gravacoes(p);
  db = await H.banco(p);
  ok(Object.keys(db.perfis[0].treinos).length === 3 && !('jornada' in db.perfis[0]) && db.log.includes('update:perfis'), 'sem a coluna jornada: treinos gravados mesmo assim');
  ok(!p.errs.length, 'sem a coluna: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 7. Coluna criada sem a permissão de gravar (grant antigo): os treinos são gravados mesmo assim, sem aviso de erro.
  p = await abrir(b, { perfis: [{ ...NOVA, jornada: null }], checkins: [], cargas: [], semPermissao: ['jornada'] });
  await p.click('[data-jd-comecar]');
  await H.escolherBV(p, 'hipertrofia'); await H.gravacoes(p); await p.waitForTimeout(300);
  db = await H.banco(p);
  ok(Object.keys(db.perfis[0].treinos || {}).join() === '1,2,3,4' && !db.perfis[0].jornada, 'sem permissão na coluna jornada: treinos gravados mesmo assim', JSON.stringify(db.perfis[0].treinos && Object.keys(db.perfis[0].treinos)));
  ok(!/Não foi possível salvar/.test(await p.locator('#toast').innerText().catch(() => '')) && (await p.locator('.treino-btn').count()) === 4, 'sem permissão: sem aviso de erro e com os 4 treinos');
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
