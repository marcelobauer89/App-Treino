// Tipos de check-in cadastrados no painel (tabela tipos_checkin), Cardio com modalidade (Bike, Corrida) e km,
// botões do editor de treinos do mesmo tamanho e a animação ao salvar focada no treino editado.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
const T = new Date('2026-11-12T15:00:00');
const TIPOS = [
  { id: 'jiu', nome: 'Jiu Jitsu', selo: 'J', cor: null, cor_escura: null, duracao: 60, ordem: 1, ativo: true, modalidades: [] },
  { id: 'muay', nome: 'Muay Thai', selo: 'M', cor: null, cor_escura: null, duracao: 60, ordem: 2, ativo: false, modalidades: [] },
  { id: 'bike', nome: 'Cardio', selo: 'C', cor: null, cor_escura: null, duracao: 30, ordem: 3, ativo: true,
    modalidades: [{ id: 'bike', nome: 'Bike', km: true }, { id: 'corrida', nome: 'Corrida', km: true }, { id: 'eliptico', nome: 'Elíptico', km: false }] },
  { id: 'natacao', nome: 'Natação', selo: 'N', cor: '#0e7490', cor_escura: '#22d3ee', duracao: 45, ordem: 4, ativo: true, modalidades: [] },
];
const tipos = () => JSON.parse(JSON.stringify(TIPOS));
const abrirCheckin = async (p) => { await p.click('#fab-checkin'); await p.waitForTimeout(150); await p.locator('#form-body .mais-tipos summary').click().catch(() => {}); };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. App com os tipos do banco: Natação entra (com a cor dele), Muay Thai desativado sai.
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, extra: { tipos_checkin: tipos() } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await abrirCheckin(p);
    const opcoes = (await p.locator('#form-body .opcao').allInnerTexts()).map((t) => t.split('\n').pop().trim());
    ok(opcoes.includes('Natação') && !opcoes.includes('Muay Thai'), `${scheme}: check-in com Natação e sem o Muay Thai desativado`, opcoes.join(' | '));
    const cor = await p.evaluate(() => getComputedStyle(document.querySelector('#form-body .selo.natacao')).backgroundColor);
    ok(cor === (scheme === 'dark' ? 'rgb(34, 211, 238)' : 'rgb(14, 116, 144)'), `${scheme}: selo da Natação com a cor do tema`, cor);
    ok(!(await p.locator('#f-mod-bloco').count()), `${scheme}: sem modalidade para tipo que não tem`);
    // Cardio: escolhe Corrida e informa os km.
    await p.locator('#form-body .opcao', { hasText: 'Cardio' }).click(); await p.waitForTimeout(100);
    ok(await p.locator('#f-mod-bloco').isVisible() && await p.locator('#f-km-campo').isHidden(), `${scheme}: Cardio mostra as modalidades; km só depois de escolher`);
    ok((await p.locator('#f-dur').inputValue()) === '30', `${scheme}: duração padrão do Cardio`);
    await p.locator('#f-mod-bloco .opcao', { hasText: 'Elíptico' }).click(); await p.waitForTimeout(80);
    ok(await p.locator('#f-km-campo').isHidden(), `${scheme}: Elíptico não pede km`);
    await p.locator('#f-mod-bloco .opcao', { hasText: 'Corrida' }).click(); await p.waitForTimeout(80);
    ok(await p.locator('#f-km-campo').isVisible(), `${scheme}: Corrida pede km`);
    await p.fill('#f-km', 'abc'); await p.click('[data-salvar-form]'); await p.waitForTimeout(100);
    ok(/distância em km/.test(await p.locator('#f-erro').innerText()), `${scheme}: km inválido é recusado`);
    await p.fill('#f-km', '7,5');
    await p.locator('#form-dialog .modal-body, #form-dialog').first().screenshot({ path: `${H.SAIDA}/checkin-cardio-${scheme}.png` }).catch(() => {});
    await p.click('[data-salvar-form]'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await H.gravacoes(p);
    const db = await H.banco(p);
    const c = db.checkins.find((x) => x.tipo === 'bike');
    ok(c && c.modalidade === 'corrida' && Number(c.km) === 7.5, `${scheme}: check-in salvo com Corrida e 7,5 km`, JSON.stringify(c && { m: c.modalidade, km: c.km }));
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(200);
    await p.locator('.ck-head').first().scrollIntoViewIfNeeded().catch(() => {});
    ok(/Corrida · 7,5 km/.test(await p.locator('#dia-lista').innerText()), `${scheme}: Dashboard mostra "Corrida · 7,5 km"`, (await p.locator('#dia-lista').innerText()).replace(/\s+/g, ' '));
    // Minha semana: Natação na paleta, Muay Thai não.
    await H.voce(p, 'semana');
    const paleta = await p.locator('#paleta').innerText();
    ok(/Natação/.test(paleta) && !/Muay Thai/.test(paleta), `${scheme}: Minha semana com os tipos ativos`, paleta.replace(/\s+/g, ' '));
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 2. Banco sem a migração 002 (sem tipos_checkin e sem a coluna km): tipos do app, sem modalidade e o check-in salva.
  {
    const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: { semKm: true } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await abrirCheckin(p);
    const opcoes = (await p.locator('#form-body .opcao').allInnerTexts()).map((t) => t.split('\n').pop().trim());
    ok(opcoes.includes('Muay Thai') && opcoes.includes('Cardio'), 'sem a migração: tipos do app', opcoes.join(' | '));
    await p.locator('#form-body .opcao', { hasText: 'Cardio' }).click(); await p.waitForTimeout(100);
    ok(!(await p.locator('#f-mod-bloco').count()), 'sem a coluna km: sem modalidade no check-in');
    await p.click('[data-salvar-form]'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await H.gravacoes(p);
    ok((await H.banco(p)).checkins.some((x) => x.tipo === 'bike'), 'sem a migração: o check-in de Cardio salva');
    ok(!p.errs.length, 'sem a migração: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Painel: aba Tipos de check-in, cria um tipo e muda as modalidades do Cardio.
  {
    const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: { tipos_checkin: tipos(), admin: { ids: ['u1'], usuarios: [{ id: 'u1', nome: 'Pessoa Admin', email: 'admin@exemplo.com', liberado: true, acessos: 3 }] } } });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    await p.click('#tab-tipos'); await p.waitForTimeout(150);
    const lista = await p.locator('#tp-lista').innerText();
    ok(/Natação/.test(lista) && /Desativado/.test(lista) && /Bike \(km\), Corrida \(km\), Elíptico/.test(lista), 'painel: lista os tipos com modalidades e desativado', lista.replace(/\s+/g, ' '));
    await p.screenshot({ path: `${H.SAIDA}/painel-tipos.png`, fullPage: true });
    await p.click('#tp-novo'); await p.waitForTimeout(100);
    await p.fill('#tp-nome', 'Yoga');
    ok((await p.locator('#tp-selo').inputValue()) === 'Y', 'painel: letra do selo vem do nome');
    await p.fill('#tp-duracao', '50');
    await p.click('#tp-mod-mais'); await p.locator('.tp-mod-nome').last().fill('Hatha');
    await p.locator('#tp-dialog').screenshot({ path: `${H.SAIDA}/painel-tipo-novo.png` }).catch(() => {});
    await p.click('#tp-salvar'); await p.waitForTimeout(300);
    let db = await H.banco(p);
    const yoga = db.tipos_checkin.find((t) => t.id === 'yoga');
    ok(yoga && yoga.duracao === 50 && yoga.selo === 'Y' && yoga.modalidades[0].nome === 'Hatha' && /^#[0-9a-f]{6}$/i.test(yoga.cor), 'painel: Yoga criado', JSON.stringify(yoga));
    ok(/Yoga/.test(await p.locator('#tp-lista').innerText()), 'painel: Yoga aparece na lista');
    // Nome repetido.
    await p.click('#tp-novo'); await p.fill('#tp-nome', 'yoga'); await p.click('#tp-salvar'); await p.waitForTimeout(200);
    ok(/Já existe/.test(await p.locator('#tp-erro').innerText()), 'painel: nome repetido é recusado');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    // Cardio: tira o Elíptico; tipo do app sem cor própria continua sem cor.
    await p.click('[data-tp-editar="bike"]'); await p.waitForTimeout(100);
    await p.locator('.tp-mod').nth(2).locator('[data-tp-mod-tirar]').click();
    await p.click('#tp-salvar'); await p.waitForTimeout(300);
    db = await H.banco(p);
    const bike = db.tipos_checkin.find((t) => t.id === 'bike');
    ok(bike.modalidades.map((m) => m.nome).join(',') === 'Bike,Corrida' && bike.cor === null, 'painel: modalidades do Cardio salvas, sem mudar a cor', JSON.stringify(bike));
    ok(!p.errs.length, 'painel: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 4. Editor: botões do mesmo tamanho; salvar com um exercício novo anima só aquele treino, sem a semana.
  {
    const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.waitForTimeout(200);
    await p.click('[data-ed-treino="2"]'); await p.waitForTimeout(100);
    await p.locator('[data-ed-plano], [data-ed-excluir]').first().scrollIntoViewIfNeeded();
    const larg = await p.locator('.ed-rodape button').evaluateAll((bs) => bs.map((x) => [Math.round(x.getBoundingClientRect().width), Math.round(x.getBoundingClientRect().height)]));
    const corpo = await p.locator('.ed-rodape').evaluate((e) => Math.round(e.getBoundingClientRect().width));
    ok(larg.length && larg.every(([w, h]) => w === corpo && h >= 48), 'editor: Excluir este treino na largura toda, com 48 px', JSON.stringify({ larg, corpo }));
    await p.locator('[data-ed-vista="escolher"]').first().click(); await p.waitForTimeout(150);
    await p.fill('#ed-busca', 'sissy'); await p.click('[data-ed-add="Sissy squat"]');
    await p.locator('.ed-fixo [data-ed-vista="treino"]').click(); await p.waitForTimeout(150);
    await p.click('[data-ed-salvar]'); await p.waitForTimeout(150);
    await p.clock.runFor(2500); await p.waitForTimeout(200);
    const treinos = await p.locator('.mt-treino').allInnerTexts();
    ok(treinos.length === 1 && /Treino 2/.test(treinos[0]), 'animação: só o treino editado', treinos.join(' | ').replace(/\s+/g, ' '));
    ok(/Atualizando Treino 2|Treino 2 atualizado/.test(await p.locator('#jornada-title').innerText()), 'animação: título com o nome do treino', await p.locator('#jornada-title').innerText());
    ok(await p.locator('.mt-novo', { hasText: 'Sissy squat' }).isVisible(), 'animação: exercício novo marcado como Novo');
    ok(!(await p.locator('.mt-semana-box').count()), 'animação: sem a semana (ela não mudou)');
    await p.locator('#jornada-dialog').screenshot({ path: `${H.SAIDA}/animacao-treino-editado.png` }).catch(() => {});
    for (let i = 0; i < 40 && await p.locator('#jornada-dialog[open]').count(); i++) { await p.clock.runFor(500); await p.waitForTimeout(80); }
    ok(!(await p.locator('#jornada-dialog[open]').count()), 'animação: termina e fecha');
    ok(!p.errs.length, 'editor: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
