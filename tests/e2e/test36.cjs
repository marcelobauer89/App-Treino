// Treinos personalizados: aviso "Baita atualização", editor Meus treinos, até 5 treinos e compatibilidade.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const T = new Date('2026-10-21T15:00:00'); // quarta
const PERFIL = { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_treinos: null, novidade_oculta: null, treinos: null };
const ANTIGO = [{ id: 'c1', usuario_id: 'u1', tipo: 't2', inicio: '2026-10-19T10:00:00', fim: '2026-10-19T11:00:00', sem_horario: false, recuperacao: 4, obs: '', retroativo: false, series: {} }];
const CARGAS = [{ usuario_id: 'u1', data: '2026-10-19', treino: 't2', series: { 'Supino no chão': [{ carga: 20 }, { carga: 22 }, null] } }];
const SHOT = (n) => `${H.SAIDA}/${n}.png`;
const salvar = (p) => p.click('[data-ed-salvar]');

async function abrir(b, extra = {}, op = {}) {
  const p = await H.novaPagina(b, { extra: { perfis: [{ ...PERFIL, ...(extra.perfil || {}) }], checkins: extra.checkins ?? ANTIGO, cargas: extra.cargas ?? CARGAS }, ...op });
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  return p;
}

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();

  // ---------- Biblioteca ----------
  let p = await abrir(b, { perfil: { novidade_oculta: '2026-10-01T00:00:00Z' } });
  await H.voce(p, 'treinos');
  await p.click('#editar-treinos');
  await p.click('[data-ed-vista="escolher"]');
  const nomes = await p.locator('.ed-bib-item b').allInnerTexts();
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  ok(nomes.length === 136, 'biblioteca com 136 exercícios', String(nomes.length));
  ok(new Set(nomes.map(norm)).size === nomes.length, 'sem nomes repetidos (sem acento/maiúsculas)');
  const html = require('fs').readFileSync(H.RAIZ + '/index.html', 'utf8');
  const blocos = [...html.matchAll(/\{ nome: '([^']+)', grupo: '([^']+)', dose: '([^']+)', pse: (\d+), H: '(\w+)', M: '(\w+)', F: '(\w+)', E: '(\w+)',\s+why: '([^']+)' \}/g)];
  ok(blocos.length === 136, 'todos os exercícios com o formato completo', String(blocos.length));
  ok(blocos.every((m) => [5, 6, 7, 8].every((k) => ['alta', 'media', 'baixa'].includes(m[k])) && +m[4] >= 1 && +m[4] <= 10 && m[9].length > 20), 'níveis, PSE e explicação válidos');
  ok(!/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|CPF:/.test(html), 'nada dos dados pessoais dos PDFs no app');
  await p.fill('#ed-busca', 'zercher');
  ok((await p.locator('.ed-bib-item').count()) === 2, 'busca "zercher" acha 2', String(await p.locator('.ed-bib-item').count()));
  await p.fill('#ed-busca', 'CÓCORAS');
  ok((await p.locator('.ed-bib-item').count()) === 3, 'busca sem diferenciar acento e maiúsculas');
  await p.fill('#ed-busca', '');
  await p.click('[data-ed-grupo="Pescoço"]');
  ok((await p.locator('.ed-bib-item').count()) === 3, 'filtro por grupo Pescoço');
  ok(p.errs.length === 0, 'sem erros (biblioteca)', p.errs.join(' | '));
  await p.context().close();

  // ---------- Usuário antigo: aviso e "Manter" ----------
  // Já tinha respondido ao aviso antigo (novidade_treinos), mas nunca pediu para ocultar: vê de novo.
  p = await abrir(b, { perfil: { novidade_treinos: '2026-10-01T22:00:00Z' } });
  ok(await p.locator('#novidade-dialog[open]').isVisible(), 'aviso aparece para quem já usa');
  ok((await txt(p, '#novidade-title')) === 'Baita atualização!', 'título Baita atualização!');
  ok(/Personalizar meus treinos/.test(await txt(p, '#novidade-body')) && /Manter meu treino atual/.test(await txt(p, '#novidade-body')), 'duas opções: personalizar ou manter');
  ok(await p.locator('#novidade-ocultar').isVisible() && !(await p.locator('#novidade-ocultar').isChecked()) && /Não mostrar esta mensagem de novo/.test(await txt(p, '.novidade-ocultar')), 'caixa "Não mostrar esta mensagem de novo", desmarcada');
  ok((await p.locator('.novidade-ocultar').boundingBox()).height >= 44, 'caixa com alvo de toque de 44 px');
  {
    const caixa = await p.locator('.novidade-ocultar').boundingBox();
    const corpo = await p.locator('#novidade-body').boundingBox();
    ok(caixa.x + caixa.width < corpo.x + corpo.width - 40, 'área da caixa não ocupa a linha inteira', `${caixa.width} de ${corpo.width}`);
    await p.mouse.click(corpo.x + corpo.width - 30, caixa.y + caixa.height / 2);
    ok(!(await p.locator('#novidade-ocultar').isChecked()), 'tocar no espaço vazio ao lado não marca a caixa');
  }
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-novidade-light') });
  await p.click('[data-novidade="manter"]'); await H.gravacoes(p);
  let db = await H.banco(p);
  ok(db.perfis[0].novidade_treinos > '2026-10-02' && !db.perfis[0].novidade_oculta && db.perfis[0].treinos == null, 'manter sem marcar grava a resposta, não oculta e não muda os treinos');
  await p.clock.runFor(11000); await p.waitForTimeout(150); db = await H.banco(p);
  ok(db.eventos.some((e) => e.tipo === 'novidade_treinos' && e.dados.escolha === 'manter' && e.dados.ocultou === false), 'evento novidade_treinos: manter, sem ocultar');
  ok((await p.locator('.treino-btn').count()) === 3, 'continua com os 3 treinos');
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  ok(!(await p.locator('#novidade-dialog[open]').count()), 'trocar de tela não reabre o aviso');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(await p.locator('#novidade-dialog[open]').isVisible(), 'sem marcar, o aviso aparece de novo ao abrir o app');
  // X sem marcar: volta também.
  await p.click('#novidade-body [data-fechar]'); await H.gravacoes(p);
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(await p.locator('#novidade-dialog[open]').isVisible(), 'fechar no X sem marcar: aparece de novo');
  // Marca e mantém: não aparece mais.
  await p.click('.novidade-ocultar');
  ok(await p.locator('#novidade-ocultar').isChecked(), 'tocar no texto marca a caixa');
  await p.waitForTimeout(300); await p.screenshot({ path: SHOT('pt-novidade-marcada') });
  await p.click('[data-novidade="manter"]'); await H.gravacoes(p);
  db = await H.banco(p);
  ok(!!db.perfis[0].novidade_oculta, 'marcar e manter grava novidade_oculta');
  await p.clock.runFor(11000); await p.waitForTimeout(150);
  ok((await H.banco(p)).eventos.some((e) => e.tipo === 'novidade_treinos' && e.dados.ocultou === true), 'evento registra que ocultou');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(!(await p.locator('#novidade-dialog[open]').count()), 'com a caixa marcada, não aparece mais');
  await p.context().close();

  // ---------- Marcar e fechar no X também oculta ----------
  p = await abrir(b);
  await p.check('#novidade-ocultar');
  await p.keyboard.press('Escape'); await H.gravacoes(p);
  ok(!!(await H.banco(p)).perfis[0].novidade_oculta, 'marcar e fechar (Esc) oculta');
  await p.context().close();

  // ---------- Banco sem a coluna nova: o aviso aparece mesmo assim ----------
  const vis = (p, v) => p.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  p = await H.novaPagina(b, { extra: { checkins: ANTIGO, perfis: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: undefined }] } });
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  ok(await p.locator('#novidade-dialog[open]').isVisible(), 'banco sem a coluna novidade_oculta: aviso aparece');
  await p.click('[data-novidade="manter"]'); await H.gravacoes(p);
  ok(!(await p.locator('.toast:not([hidden])').count()) || !/schema/.test(await txt(p, '#toast')), 'responder não mostra erro de banco');
  // Volta do segundo plano: em menos de 30 min não reabre; depois de 30 min, reabre.
  await vis(p, 'hidden'); await p.clock.runFor(5 * 60000); await vis(p, 'visible'); await p.waitForTimeout(100);
  ok(!(await p.locator('#novidade-dialog[open]').count()), 'voltar ao app em 5 min não reabre');
  await vis(p, 'hidden'); await p.clock.runFor(31 * 60000); await vis(p, 'visible'); await p.waitForTimeout(100);
  ok(await p.locator('#novidade-dialog[open]').isVisible(), 'voltar ao app depois de 30 min reabre o aviso');
  // Gravação falhando (sem a coluna): marcar ainda esconde, pelo navegador.
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.falhar = true; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
  await p.check('#novidade-ocultar'); await p.click('[data-novidade="manter"]'); await H.gravacoes(p);
  ok(!/Não foi possível|schema/.test(await txt(p, '#toast').catch(() => '')), 'falha ao gravar não mostra erro');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(!(await p.locator('#novidade-dialog[open]').count()), 'marcado com o banco falhando: não aparece mais neste aparelho');
  await vis(p, 'hidden'); await p.clock.runFor(31 * 60000); await vis(p, 'visible'); await p.waitForTimeout(100);
  ok(!(await p.locator('#novidade-dialog[open]').count()), 'marcado: não reabre ao voltar ao app');
  await p.context().close();

  // Com outra janela aberta por cima, não reabre ao voltar.
  p = await abrir(b);
  await p.click('#novidade-body [data-fechar]');
  await p.click('#fab-checkin');
  await vis(p, 'hidden'); await p.clock.runFor(31 * 60000); await vis(p, 'visible'); await p.waitForTimeout(100);
  ok(!(await p.locator('#novidade-dialog[open]').count()) && await p.locator('#form-dialog[open]').isVisible(), 'não abre por cima de outra janela');
  await p.context().close();

  // ---------- Personalizar ----------
  p = await abrir(b);
  await p.click('[data-novidade="personalizar"]');
  ok(await p.locator('#editor-dialog[open]').isVisible(), 'personalizar abre o editor');
  ok((await p.locator('[data-ed-treino]').count()) === 3, 'editor começa com os 3 treinos atuais');
  // Layout: sem setas, Séries e PSE iguais, botão flutuante como o do check-in.
  ok((await p.locator('[data-ed-mover], .ed-mover').count()) === 0 && !/setas/.test(await txt(p, '#editor-body')), 'sem setas de subir e descer');
  {
    const est = (sel) => p.locator(sel).first().evaluate((el) => {
      const c = getComputedStyle(el), r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), borda: c.borderTopColor + c.borderTopWidth + c.borderRadius, fundo: c.backgroundColor, fonte: c.fontSize + c.fontWeight + c.fontFamily, cor: c.color };
    });
    const a1 = await est('[data-ed-dose="0"]'), b1 = await est('[data-ed-pse="0"]');
    ok(JSON.stringify(a1) === JSON.stringify(b1), 'Séries e PSE com o mesmo tamanho e estilo', `${JSON.stringify(a1)} | ${JSON.stringify(b1)}`);
  }
  const fab = p.locator('.ed-fab');
  ok(await fab.isVisible() && (await txt(p, '.ed-fab')) === 'Adicionar exercício' && (await fab.locator('svg').count()) === 1, 'botão flutuante "+ Adicionar exercício"');
  {
    const f = await fab.boundingBox(), sv = await p.locator('[data-ed-salvar]').boundingBox();
    ok(f.y + f.height <= sv.y, 'botão flutuante fica acima do Salvar treinos');
  }
  await p.locator('#editor-dialog').evaluate((d) => { d.scrollTop = 400; d.dispatchEvent(new Event('scroll')); });
  await p.waitForTimeout(300);
  ok(await fab.evaluate((el) => el.classList.contains('encolhido')) && (await fab.boundingBox()).width <= 60, 'rolar para baixo encolhe o botão', String((await fab.boundingBox()).width));
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-editor-rolado-light') });
  await p.locator('#editor-dialog').evaluate((d) => { d.scrollTop = 100; d.dispatchEvent(new Event('scroll')); });
  await p.waitForTimeout(300);
  ok(!(await fab.evaluate((el) => el.classList.contains('encolhido'))), 'rolar para cima mostra o texto de novo');
  await p.locator('#editor-dialog').evaluate((d) => { d.scrollTop = 0; d.dispatchEvent(new Event('scroll')); });
  await fab.click();
  ok(await p.locator('#ed-busca').isVisible() && !(await p.locator('.ed-fab').count()), 'botão abre a biblioteca e some nela');
  await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-editor-light') });
  // Treino 1: tira o primeiro, sobe o último, muda séries e PSE.
  await p.click('[data-ed-treino="1"]');
  await p.click('[data-ed-remover="0"]');
  await p.fill('[data-ed-dose="0"]', '4×12');
  await p.selectOption('[data-ed-pse="0"]', '9');
  // Novo treino com 2 exercícios.
  await p.click('[data-ed-novo]');
  ok(await p.locator('#ed-busca').isVisible(), 'novo treino abre a biblioteca');
  await p.fill('#ed-busca', 'zercher');
  await p.click('[data-ed-add="Agachamento Zercher"]');
  ok((await p.getAttribute('[data-ed-add="Agachamento Zercher"]', 'aria-pressed')) === 'true', 'exercício marcado como adicionado');
  await p.fill('#ed-busca', '');
  await p.click('[data-ed-grupo="Costas"]');
  await p.click('[data-ed-add="Barra fixa"]');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-biblioteca-light') });
  await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await p.fill('#ed-nome', 'Treino D');
  await p.fill('#ed-sub', 'Pernas e costas');
  ok((await txt(p, '[data-ed-treino="4"]')).includes('Treino D'), 'aba do editor acompanha o nome');
  await salvar(p); await H.gravacoes(p);
  db = await H.banco(p);
  const tr = db.perfis[0].treinos;
  ok(tr && Object.keys(tr).join() === '1,2,3,4', 'salvo com 4 treinos', JSON.stringify(Object.keys(tr || {})));
  ok(tr['4'].nome === 'Treino D' && tr['4'].subtitulo === 'Pernas e costas' && tr['4'].exercicios.map((e) => e.nome).join() === 'Agachamento Zercher,Barra fixa', 'treino novo salvo', JSON.stringify(tr['4']));
  ok(tr['1'].exercicios[0].dose === '4×12' && tr['1'].exercicios[0].pse === 9 && tr['1'].exercicios[0].nome === 'Carregada na marcha', 'dose e PSE salvos', JSON.stringify(tr['1'].exercicios[0]));
  ok(Object.keys(tr['1'].exercicios[0]).sort().join() === 'dose,nome,pse', 'banco guarda só nome, dose e PSE');
  ok(!db.perfis[0].novidade_oculta, 'salvar treinos não oculta o aviso');
  ok(/Treinos salvos/.test(await txt(p, '#toast')) && /semana/.test(await txt(p, '#toast')), 'toast lembra de pôr na semana', await txt(p, '#toast'));
  ok((await p.locator('.treino-btn').count()) === 4 && await p.locator('#treinos.muitos').count() === 1, '4 abas, rolando para o lado');
  await p.click('[data-treino="4"]');
  ok((await p.locator('#list .ex').count()) === 2 && (await txt(p, '#list .ex h3')) === 'Agachamento Zercher', 'ficha do Treino D com os exercícios');
  ok((await p.locator('#sobre .sobre').count()) === 0, 'treino montado não mostra "Sobre"');
  await p.click('[data-treino="2"]');
  ok((await p.locator('#sobre .sobre').count()) === 1, 'Treino 2 sem mudanças continua com "Sobre"');
  await p.click('[data-treino="1"]');
  ok((await p.locator('#sobre .sobre').count()) === 0, 'Treino 1 alterado perde o "Sobre"');
  ok((await txt(p, '#list .ex .ex-dose')).startsWith('4×12'), 'ficha mostra a nova dose');
  await p.click('[data-treino="4"]');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-ficha4-light') });
  // Check-in e pesos no Treino 4.
  await p.click('#fab-checkin');
  ok(await p.locator('input[name="f-tipo"][value="t4"]').isChecked(), 'check-in já vem no Treino D');
  ok((await txt(p, '#form-body')).includes('Treino D'), 'formulário mostra o nome do treino');
  await p.click('[data-salvar-form]'); await H.gravacoes(p);
  await p.click('#list [data-log="0"]');
  await p.fill('#kg-0', '40'); await p.click('[data-concluir]'); await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.checkins.some((c) => c.tipo === 't4'), 'check-in t4 gravado');
  ok(db.cargas.some((c) => c.treino === 't4' && c.series['Agachamento Zercher'][0].carga === 40), 'peso no t4 gravado');
  // Semana: Treino D na paleta e aviso de que ficou fora.
  await H.voce(p, 'semana');
  ok((await p.locator('#paleta [data-arrastar="t4"]').count()) === 1, 'Treino D na paleta da semana');
  ok(/Treino D ficou fora da semana/.test(await txt(p, '#avisos-semana')), 'aviso de treino fora da semana', await txt(p, '#avisos-semana'));
  await H.voce(p, 'treinos');
  ok((await p.locator('#meus-treinos li').count()) === 4 && /montou/.test(await txt(p, '#meus-treinos-nota')), 'Você → Meus treinos lista os 4');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-voce-light'), fullPage: true });

  // Excluir o Treino 2 (que está na segunda-feira da semana).
  await p.click('#editar-treinos');
  await p.click('[data-ed-treino="2"]');
  await p.click('[data-ed-excluir]');
  ok(/continuam salvos/.test(await txt(p, '.ed-confirma')), 'confirma exclusão avisando que o histórico fica');
  await p.click('[data-ed-excluir-sim]');
  ok((await p.locator('[data-ed-treino]').count()) === 3, 'treino some do rascunho');
  await salvar(p); await H.gravacoes(p);
  db = await H.banco(p);
  ok(Object.keys(db.perfis[0].treinos).join() === '1,3,4', 'Treino 2 excluído', Object.keys(db.perfis[0].treinos).join());
  ok(Array.isArray(db.perfis[0].semana) && !db.perfis[0].semana.flat().includes('t2'), 'Treino 2 saiu da semana salva', JSON.stringify(db.perfis[0].semana));
  ok(/saiu da sua semana/.test(await txt(p, '#toast')), 'toast avisa que saiu da semana');
  // Histórico do treino excluído continua no Dashboard.
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  await p.click('[data-dia="2026-10-19"]');
  ok((await txt(p, '.ck-head')).includes('Treino 2'), 'check-in antigo continua com o nome Treino 2');
  await p.click('.ck-head');
  ok(/Supino no chão\s*20 \/ 22/.test(await txt(p, '.ck-ex')), 'pesos do treino excluído aparecem no detalhe', await txt(p, '.ck-ex'));
  await p.click('.ck-ex [data-editar-ex="0"]');
  ok((await txt(p, '#log-title')) === 'Supino no chão', 'dá para corrigir o peso do treino excluído');
  await p.keyboard.press('Escape');
  await p.click('[data-editar]');
  ok(await p.locator('input[name="f-tipo"][value="t2"]').isChecked(), 'editar check-in do treino excluído mantém o tipo');
  await p.keyboard.press('Escape');
  ok((await txt(p, '#barras')).includes('Treino 2'), 'barras do mês contam o treino excluído');

  // Sair sem salvar pede confirmação.
  await H.voce(p, 'treinos');
  await p.click('#editar-treinos');
  await p.click('[data-ed-remover="0"]');
  await p.click('#editor-body [data-fechar]');
  ok(/Sair sem salvar/.test(await txt(p, '.ed-confirma')), 'fechar com mudanças pede confirmação');
  await p.click('[data-ed-cancelar]');
  ok(await p.locator('#editor-dialog[open]').isVisible(), 'continuar editando mantém o editor');
  await p.keyboard.press('Escape');
  await p.click('[data-ed-sair-sim]');
  ok(!(await p.locator('#editor-dialog[open]').count()) && (await H.banco(p)).perfis[0].treinos['1'].exercicios.length === 7, 'sair sem salvar descarta');

  // Limite de 6 treinos.
  await p.click('#editar-treinos');
  await p.click('[data-ed-novo]'); await p.click('[data-ed-add="Stiff"]'); await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await p.click('[data-ed-novo]'); await p.click('[data-ed-add="Salto"]'); await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await p.click('[data-ed-novo]'); await p.click('[data-ed-add="Sissy squat"]'); await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  ok((await p.locator('[data-ed-treino]').count()) === 6 && await p.locator('[data-ed-novo]').isDisabled(), 'no 6º treino o + Novo fica desligado');
  // Treino vazio não salva.
  await salvar(p); await H.gravacoes(p);
  db = await H.banco(p);
  ok(Object.keys(db.perfis[0].treinos).join() === '1,2,3,4,5,6', '6 treinos salvos (o novo reaproveita o 2)', Object.keys(db.perfis[0].treinos).join());
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-voce5-light') });
  await p.click('[data-tela="treino"]'); await p.waitForTimeout(100);
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-abas5-light') });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal da página com 6 abas');

  // Voltar ao plano pronto.
  await H.voce(p, 'treinos');
  await p.click('#editar-treinos');
  await p.click('[data-ed-plano]');
  await p.click('[data-ed-plano-sim]');
  ok((await p.locator('[data-ed-treino]').count()) === 3, 'rascunho volta aos 3 treinos do plano');
  await salvar(p); await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.perfis[0].treinos === null, 'plano pronto salva treinos vazio (null)');
  await p.click('[data-tela="treino"]'); await p.waitForTimeout(100);
  ok((await p.locator('#sobre .sobre').count()) === 1 && (await p.locator('.treino-btn').count()) === 3, 'plano pronto com "Sobre" de volta');
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok((await txt(p, '#novidade-title')) === 'Baita atualização!', 'depois de salvar, sem marcar, o aviso volta');
  await p.click('#novidade-body [data-fechar]');
  ok(p.errs.length === 0, 'sem erros (personalizar)', p.errs.join(' | '));
  await p.context().close();

  // ---------- Conta nova ----------
  p = await abrir(b, { checkins: [], cargas: [] });
  ok((await txt(p, '#jornada-title')) === 'Bem-vindo ao OSS', 'conta nova vê as boas-vindas');
  await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
  ok((await txt(p, '#jornada-title')) === 'Qual é o seu objetivo?', 'conta nova vê a escolha de como começar');
  ok((await p.locator('#jornada-body .jornada').count()) === 5, 'jornadas prontas e montar do zero');
  ok(!(await p.locator('#novidade-ocultar').count()) && !(await p.locator('#jornada-body [data-fechar]').count()), 'boas-vindas sem caixa e sem X');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-nova-light') });
  await H.escolherBV(p, 'zero');
  ok(await p.locator('#ed-busca').isVisible(), 'montar abre direto a biblioteca');
  await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await salvar(p);
  ok(/sem exercícios/.test(await txt(p, '#ed-erro')), 'treino vazio não salva', await txt(p, '#ed-erro'));
  await p.click('[data-ed-vista="escolher"]');
  await p.click('[data-ed-add="Barra fixa"]'); await p.click('[data-ed-add="Paralela"]');
  await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
  await salvar(p); await H.gravacoes(p);
  db = await H.banco(p);
  ok(Object.keys(db.perfis[0].treinos).join() === '1' && db.perfis[0].treinos['1'].exercicios.length === 2, 'conta nova com 1 treino montado');
  ok((await p.locator('.treino-btn').count()) === 1 && (await txt(p, '#atividade')).length > 0, 'tela Treino com 1 aba');
  ok(!(await H.banco(p)).perfis[0].semana || !(await H.banco(p)).perfis[0].semana.flat().some((t) => /^t[23]$/.test(t)), 'semana sem treinos que não existem');
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#novidade-dialog')) && !(await p.isVisible('#jornada-dialog')), 'conta nova que montou os treinos nas boas-vindas não vê mais avisos');
  ok(p.errs.length === 0, 'sem erros (conta nova)', p.errs.join(' | '));
  await p.context().close();

  p = await abrir(b, { checkins: [], cargas: [] });
  await p.click('[data-jd-comecar]');
  await H.escolherBV(p, 'jiu'); await H.gravacoes(p);
  ok((await H.banco(p)).perfis[0].treinos == null && (await p.locator('.treino-btn').count()) === 3, 'conta nova com o plano pronto');
  await p.context().close();

  // ---------- Escuro, 390 px ----------
  p = await abrir(b, {}, { scheme: 'dark', viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-novidade-dark') });
  await p.click('[data-novidade="personalizar"]');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-editor-dark') });
  await p.click('[data-ed-vista="escolher"]');
  await p.waitForTimeout(400); await p.screenshot({ path: SHOT('pt-biblioteca-dark') });
  ok(await p.evaluate(() => document.getElementById('editor-body').scrollWidth <= document.getElementById('editor-body').clientWidth), 'editor sem rolagem horizontal');
  ok(p.errs.length === 0, 'sem erros (escuro)', p.errs.join(' | '));
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
