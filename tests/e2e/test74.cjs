// Painel → aba Exercícios: lista do catálogo, busca, grupos e objetivos, criar, editar, renomear (avisa quem usa),
// vídeo por link, nome repetido recusado, desativar e banco sem o SQL do catálogo. Cadastro com campos no padrão
// (séries por campos, PSE em lista, níveis em botões, nome padronizado, objetivos) numa janela em tela cheia no celular.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const USUARIOS = [{ id: 'u1', nome: 'Pessoa Admin', email: 'admin@exemplo.com', liberado: true, acessos: 3 }];
async function abrir(b, { scheme = 'light', viewport = { width: 390, height: 844 }, semCatalogo = false } = {}) {
  const c = H.catalogo();
  const extra = { admin: { ids: ['u1'], usuarios: USUARIOS, usos: { Puxada: 3, 'Puxada frontal': 3, Superman: 2 } }, videos: [{ exercicio: 'Puxada', video_id: 'vidPuxada01' }] };
  if (!semCatalogo) Object.assign(extra, { exercicios: c.exercicios, jornadas: c.jornadas });
  const p = await H.novaPagina(b, { scheme, viewport, extra });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
  await p.click('#tab-exercicios'); await p.waitForTimeout(150);
  return p;
}
const linhas = (p) => p.locator('#ex-lista .ex-item b').allInnerTexts();

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await abrir(b, { scheme, viewport });
    ok(await p.locator('#aba-exercicios').isVisible() && /#exercicios$/.test(p.url()), `${tag}: aba Exercícios abre (e fica no endereço)`);
    ok((await linhas(p)).length === 136, `${tag}: lista os 136 exercícios`, String((await linhas(p)).length));
    ok(/136 exercícios ativos · 1 com vídeo/.test(await txt(p, '#ex-resumo')), `${tag}: resumo com ativos e vídeos`, await txt(p, '#ex-resumo'));
    ok(await p.locator('#ex-lista [data-ex-editar] svg').count() === 136 && !/Editar/.test(await txt(p, '#ex-lista')), `${tag}: editar é o ícone de lápis`);
    ok(/em 3 contas/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Puxada"))')) && /com vídeo/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Puxada"))')), `${tag}: mostra o uso e o vídeo de cada um`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    await p.screenshot({ path: `${H.SAIDA}/admin-exercicios-${tag}.png` });

    // Busca e grupo
    await p.fill('#ex-busca', 'agachamento com barra'); await p.waitForTimeout(80);
    ok((await linhas(p)).join('|') === 'Agachamento', `${tag}: busca acha pelos outros nomes`, (await linhas(p)).join('|'));
    // Filtros: só a busca à vista; grupos, objetivos e situação abrem no botão Filtros.
    ok(await p.locator('#ex-filtros-dialog[open]').count() === 0 && await p.locator('#ex-busca').isVisible() && await p.locator('#ex-filtrar').isVisible(), `${tag}: só a busca e o botão Filtros à vista`);
    // O balão do "i" abre colado no título.
    await p.click('[data-info="info-ex"]'); await p.waitForTimeout(80);
    const bi = await p.locator('[data-info="info-ex"]').boundingBox(), bb = await p.locator('#info-ex').boundingBox();
    ok(bb && bb.y - (bi.y + bi.height) < 40 && bb.y > bi.y && bb.x >= 0 && bb.x + bb.width <= viewport.width, `${tag}: balão do "i" perto do botão`, `${Math.round(bb.y - bi.y)}px abaixo`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(60);
    await p.fill('#ex-busca', ''); await p.click('#ex-filtrar'); await p.waitForTimeout(80);
    ok(await p.locator('#ex-filtros-dialog[open]').count() === 1 && await p.locator('#ex-grupos').isVisible(), `${tag}: botão Filtros abre os filtros numa janela`);
    await p.locator('#ex-filtros-dialog').screenshot({ path: `${H.SAIDA}/admin-exercicios-filtros-${tag}.png` });
    await p.click('[data-ex-grupo="Pescoço"]'); await p.waitForTimeout(80);
    ok((await linhas(p)).length === 136 && await p.locator('#ex-filtros-n').isHidden() && /^Filtrar · 3 exercícios$/.test((await p.locator('#ex-filtros-ver').innerText()).trim()), `${tag}: escolher na janela não filtra ainda (o botão mostra quantos vão ficar)`, await p.locator('#ex-filtros-ver').innerText());
    await p.click('#ex-filtros-ver'); await p.waitForTimeout(80);
    const pescoco = await linhas(p);
    ok(await p.locator('#ex-filtros-dialog[open]').count() === 0 && pescoco.length === 3 && (await p.locator('#ex-filtros-n').innerText()) === '1', `${tag}: Filtrar aplica, fecha e mostra 1 filtro ativo`, pescoco.join('|'));
    // Fechar sem Filtrar descarta a escolha.
    await p.click('#ex-filtrar'); await p.click('[data-ex-sit="sem-video"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    ok((await linhas(p)).join('|') === pescoco.join('|'), `${tag}: fechar sem Filtrar não muda a lista`);
    await p.click('#ex-filtrar');
    ok(await p.getAttribute('[data-ex-sit="todos"]', 'aria-pressed') === 'true' && await p.getAttribute('[data-ex-grupo="Pescoço"]', 'aria-pressed') === 'true', `${tag}: reabrir mostra os filtros aplicados`);
    await p.click('#ex-limpar'); await p.waitForTimeout(80);
    ok((await linhas(p)).length === 3, `${tag}: Limpar só vale depois de Filtrar`);
    await p.click('[data-ex-sit="sem-video"]'); await p.click('#ex-filtros-ver'); await p.waitForTimeout(80);
    ok((await linhas(p)).length === 135 && !(await linhas(p)).includes('Puxada'), `${tag}: filtro sem vídeo`, String((await linhas(p)).length));
    await p.click('#ex-filtrar'); await p.click('#ex-limpar'); await p.click('#ex-filtros-ver'); await p.waitForTimeout(80);
    ok(await p.locator('#ex-filtros-n').isHidden() && (await linhas(p)).length === 136, `${tag}: Limpar e Filtrar volta a lista inteira`);

    // Editar a Puxada: renomear avisa quem usa; o vídeo vai por link.
    await p.click('[data-ex-editar="Puxada"]'); await p.waitForTimeout(120);
    ok(await p.locator('#ex-dialog[open]').count() === 1 && (await p.inputValue('#ex-nome')) === 'Puxada' && (await p.inputValue('#ex-video')) === 'vidPuxada01', `${tag}: editar abre com os dados`);
    ok(await p.locator('#ex-aviso').isHidden(), `${tag}: sem aviso antes de mudar o nome`);
    await p.fill('#ex-nome', 'Puxada frontal');
    ok(/3 contas têm este exercício nos treinos\. O nome novo aparece no treino delas, e as cargas e o histórico continuam ligados/.test(await txt(p, '#ex-aviso')), `${tag}: renomear avisa quantas contas usam`, await txt(p, '#ex-aviso'));
    ok((await p.locator('.ex-nivel').first().locator('.ex-seg span').allInnerTexts()).join('|') === 'Baixa|Média|Alta', `${tag}: níveis na ordem Baixa, Média, Alta`);
    ok(await p.inputValue('#ex-series') === '3' && await p.inputValue('#ex-valor') === '10' && await p.inputValue('#ex-pse') === '8' && await p.isChecked('input[name="ex-hipertrofia"][value="alta"]') && await p.isChecked('input[name="ex-obj"][value="hipertrofia"]'), `${tag}: abre com séries, PSE, níveis e objetivos nos campos`);
    const caixa = await p.locator('#ex-dialog').boundingBox();
    ok(viewport.width < 720 ? Math.abs(caixa.height - viewport.height) <= 1 && Math.abs(caixa.width - viewport.width) <= 1 : caixa.width >= 700 && caixa.height >= 700, `${tag}: janela em tela cheia no celular (grande no computador)`, `${Math.round(caixa.width)}×${Math.round(caixa.height)}`);
    ok(await p.locator('.ex-rodape #ex-salvar').isVisible() && await p.locator('.ex-topo h2').isVisible(), `${tag}: título e Salvar sempre à vista`);
    await p.fill('#ex-video', 'https://youtube.com/shorts/abcdefghijk?si=x');
    await p.locator('#ex-dialog').screenshot({ path: `${H.SAIDA}/admin-exercicio-editar-${tag}.png` });
    await p.click('#ex-salvar'); await p.waitForTimeout(250);
    let db = await H.banco(p);
    const px = db.exercicios.find((e) => e.nome === 'Puxada frontal');
    ok(px && px.nomes_antigos.includes('Puxada') && !db.exercicios.some((e) => e.nome === 'Puxada'), `${tag}: renomeado guarda o nome antigo`);
    ok(db.videos.some((v) => v.exercicio === 'Puxada frontal' && v.video_id === 'abcdefghijk') && !db.videos.some((v) => v.exercicio === 'Puxada'), `${tag}: vídeo pelo link do YouTube`);
    ok(await p.locator('#ex-dialog[open]').count() === 0 && /Puxada frontal salvo/.test(await txt(p, '#toast')), `${tag}: fecha e avisa`);
    ok(/antes: Puxada/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Puxada frontal"))')), `${tag}: lista mostra o nome antigo`);

    // Novo exercício: nome repetido e vídeo inválido são recusados antes de gravar.
    await p.click('#ex-novo'); await p.waitForTimeout(120);
    await p.fill('#ex-nome', 'supino  RETO'); await p.selectOption('#ex-grupo', 'Peito'); await p.click('#ex-salvar'); await p.waitForTimeout(100);
    ok(/Já existe um exercício com esse nome: Supino reto/.test(await txt(p, '#ex-erro')), `${tag}: nome repetido (maiúsculas e espaços) é recusado`, await txt(p, '#ex-erro'));
    await p.fill('#ex-nome', 'Remada no anel'); await p.fill('#ex-video', 'https://exemplo.com/video'); await p.click('#ex-salvar'); await p.waitForTimeout(100);
    ok(/Não reconheci o vídeo/.test(await txt(p, '#ex-erro')), `${tag}: vídeo inválido é recusado`);
    await p.fill('#ex-video', ''); await p.fill('#ex-nome', '  remada   no anel '); await p.locator('#ex-nome').blur();
    ok(await p.inputValue('#ex-nome') === 'Remada no anel', `${tag}: nome padronizado ao sair do campo`, await p.inputValue('#ex-nome'));
    await p.fill('#ex-series', '3'); await p.fill('#ex-valor', '10-12'); await p.locator('#ex-valor').blur(); await p.check('#ex-lado');
    ok(/No app: 3×10–12 \/ lado/.test(await txt(p, '#ex-dose-previa')), `${tag}: séries por campos geram o padrão`, await txt(p, '#ex-dose-previa'));
    await p.fill('#ex-valor', 'dez'); await p.click('#ex-salvar'); await p.waitForTimeout(100);
    ok(/Confira as séries/.test(await txt(p, '#ex-erro')), `${tag}: séries fora do padrão são recusadas`);
    await p.fill('#ex-valor', '12');
    await p.selectOption('#ex-pse', '7');
    await p.check('input[name="ex-forca"][value="alta"]', { force: true }); await p.check('input[name="ex-obj"][value="forca"]', { force: true });
    await p.fill('#ex-why', 'Puxada com instabilidade.'); await p.fill('#ex-var', 'remada nas argolas,  Remada no TRX'); await p.locator('#ex-var').blur();
    await p.locator('#ex-dialog').screenshot({ path: `${H.SAIDA}/admin-exercicio-novo-${tag}.png` });
    await p.click('#ex-salvar'); await p.waitForTimeout(250);
    db = await H.banco(p);
    const novo = db.exercicios.find((e) => e.nome === 'Remada no anel');
    ok(novo && novo.grupo === 'Peito' && novo.dose === '3×12 / lado' && novo.pse === 7 && novo.forca === 'alta' && novo.variacoes.join('|') === 'Remada nas argolas|Remada no TRX' && novo.objetivos.join('|') === 'forca' && novo.ativo, `${tag}: cria com todos os campos no padrão`, JSON.stringify(novo));
    ok(/Força e potência/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Remada no anel"))')), `${tag}: lista mostra o objetivo`);
    await p.click('#ex-filtrar'); await p.click('[data-ex-obj="forca"]'); await p.click('#ex-filtros-ver'); await p.waitForTimeout(80);
    const daForca = await linhas(p);
    ok(daForca.includes('Remada no anel') && daForca.includes('Deadlift') && !daForca.includes('Escorpião'), `${tag}: filtro por objetivo`, String(daForca.length));
    await p.click('#ex-filtrar'); await p.click('#ex-limpar'); await p.click('#ex-filtros-ver'); await p.waitForTimeout(80);
    // Formato que não cabe nos campos (texto livre) abre em "Outro formato" e continua igual.
    await p.click('[data-ex-editar="Cardio curto intervalado"]'); await p.waitForTimeout(120);
    ok(await p.isChecked('#ex-dose-livre') && await p.locator('#ex-dose').isVisible() && await p.locator('#ex-dose-campos').isHidden(), `${tag}: formato livre abre em "Outro formato"`, await p.inputValue('#ex-dose'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok((await linhas(p)).includes('Remada no anel') && /137 exercícios ativos/.test(await txt(p, '#ex-resumo')), `${tag}: novo aparece na lista`);

    // Desativar o Superman: avisa que continua em quem tem e marca na lista.
    await p.click('[data-ex-editar="Superman"]'); await p.waitForTimeout(120);
    await p.uncheck('#ex-ativo');
    ok(/2 contas têm este exercício nos treinos\. Desativado, ele sai da lista de escolha, mas continua/.test(await txt(p, '#ex-aviso')), `${tag}: desativar avisa`, await txt(p, '#ex-aviso'));
    await p.click('#ex-salvar'); await p.waitForTimeout(250);
    db = await H.banco(p);
    ok(db.exercicios.find((e) => e.nome === 'Superman').ativo === false && /Desativado/.test(await txt(p, '#ex-lista .ex-item:has(b:has-text("Superman"))')) && /Superman desativado/.test(await txt(p, '#toast')), `${tag}: desativado marcado na lista`);
    ok(/1 desativado/.test(await txt(p, '#ex-resumo')), `${tag}: resumo conta o desativado`);

    // Excluir: exercício em uso só pode ser desativado; o de um objetivo pronto é recusado; o livre sai de vez.
    await p.click('[data-ex-editar="Puxada frontal"]'); await p.waitForTimeout(120);
    await p.click('#ex-excluir'); await p.waitForTimeout(80);
    ok(/está nos treinos de 3 contas/.test(await txt(p, '#ex-excluir-caixa')) && !(await p.locator('[data-ex-excluir-sim]').count()), `${tag}: em uso, não exclui e sugere desativar`);
    await p.click('[data-ex-desativar]'); await p.waitForTimeout(60);
    ok(!(await p.isChecked('#ex-ativo')), `${tag}: Desativar desmarca o Ativo`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.click('[data-ex-editar="Face pull"]'); await p.waitForTimeout(120);
    await p.click('#ex-excluir'); await p.click('[data-ex-excluir-sim]'); await p.waitForTimeout(200);
    ok(/Faz parte do objetivo pronto/.test(await txt(p, '#ex-erro')) && (await H.banco(p)).exercicios.some((e) => e.nome === 'Face pull'), `${tag}: exercício de objetivo pronto não é excluído`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.click('[data-ex-editar="Sissy squat"]'); await p.waitForTimeout(120);
    await p.click('#ex-excluir'); await p.waitForTimeout(80);
    await p.locator('#ex-dialog').screenshot({ path: `${H.SAIDA}/admin-exercicio-excluir-${tag}.png` });
    await p.click('[data-ex-excluir-sim]'); await p.waitForTimeout(250);
    ok(!(await H.banco(p)).exercicios.some((e) => e.nome === 'Sissy squat') && !(await linhas(p)).includes('Sissy squat') && /Sissy squat excluído/.test(await txt(p, '#toast')), `${tag}: exclui o exercício livre`);
    // Lixeira na própria lista: livre exclui; em uso oferece desativar.
    await p.click('[data-ex-apagar="Abdominal infra"]'); await p.waitForTimeout(120);
    ok(await p.locator('#ex-apagar-dialog[open]').count() === 1 && /Excluir Abdominal infra\?/.test(await txt(p, '#ex-apagar-title')), `${tag}: lixeira da lista pede confirmação`);
    await p.locator('#ex-apagar-dialog').screenshot({ path: `${H.SAIDA}/admin-exercicio-lixeira-${tag}.png` });
    await p.click('#ex-apagar-sim'); await p.waitForTimeout(250);
    ok(!(await H.banco(p)).exercicios.some((e) => e.nome === 'Abdominal infra') && !(await linhas(p)).includes('Abdominal infra') && /Abdominal infra excluído/.test(await txt(p, '#toast')), `${tag}: lixeira exclui o exercício livre`);
    await p.click('[data-ex-apagar="Puxada frontal"]'); await p.waitForTimeout(120);
    ok(/Não dá para excluir Puxada frontal/.test(await txt(p, '#ex-apagar-title')) && /treinos de 3 contas/.test(await txt(p, '#ex-apagar-dialog')) && !(await p.locator('#ex-apagar-sim').count()), `${tag}: lixeira em exercício em uso não exclui`);
    await p.click('#ex-apagar-desativar'); await p.waitForTimeout(250);
    ok((await H.banco(p)).exercicios.find((e) => e.nome === 'Puxada frontal').ativo === false && /Puxada frontal desativado/.test(await txt(p, '#toast')), `${tag}: lixeira oferece Desativar`);
    await p.click('[data-ex-apagar="Face pull"]'); await p.click('#ex-apagar-sim'); await p.waitForTimeout(200);
    ok(/Faz parte do objetivo pronto/.test(await txt(p, '#ex-apagar-erro')) && await p.locator('#ex-apagar-dialog[open]').count() === 1, `${tag}: lixeira mostra o motivo quando o banco recusa`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    // Erro do banco aparece na janela e nada fecha.
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.admin.falharSalvarExercicio = true; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
    await p.click('[data-ex-editar="Remada no anel"]'); await p.waitForTimeout(120); await p.click('#ex-salvar'); await p.waitForTimeout(200);
    ok(await p.locator('#ex-dialog[open]').count() === 1 && /falha simulada/.test(await txt(p, '#ex-erro')) && !(await p.locator('#ex-salvar').isDisabled()), `${tag}: erro ao salvar fica na janela`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // Banco sem o SQL do catálogo: explica o que fazer.
  {
    const p = await abrir(b, { semCatalogo: true });
    ok(/rode de novo o supabase\/schema\.sql/.test(await txt(p, '#ex-lista')) && await p.locator('#ex-novo').isDisabled(), 'sem o SQL: explica e não deixa criar');
    ok(!p.errs.length, 'sem o SQL: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
