// Painel → aba Exercícios: lista do catálogo, busca e grupos, criar, editar, renomear (avisa quem usa),
// vídeo por link, nome repetido recusado, desativar e banco sem o SQL do catálogo.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const USUARIOS = [{ id: 'u1', nome: 'Pessoa Admin', email: 'admin@exemplo.com', liberado: true, acessos: 3 }];
async function abrir(b, { scheme = 'light', viewport = { width: 390, height: 844 }, semCatalogo = false } = {}) {
  const c = H.catalogo();
  const extra = { admin: { ids: ['u1'], usuarios: USUARIOS, usos: { Puxada: 3, Superman: 2 } }, videos: [{ exercicio: 'Puxada', video_id: 'vidPuxada01' }] };
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
    ok(/em 3 contas/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Puxada"))')) && /com vídeo/.test(await txt(p, '#ex-lista .ex-item:has(b:text-is("Puxada"))')), `${tag}: mostra o uso e o vídeo de cada um`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    await p.screenshot({ path: `${H.SAIDA}/admin-exercicios-${tag}.png` });

    // Busca e grupo
    await p.fill('#ex-busca', 'agachamento com barra'); await p.waitForTimeout(80);
    ok((await linhas(p)).join('|') === 'Agachamento', `${tag}: busca acha pelos outros nomes`, (await linhas(p)).join('|'));
    await p.fill('#ex-busca', ''); await p.click('[data-ex-grupo="Pescoço"]'); await p.waitForTimeout(80);
    const pescoco = await linhas(p);
    ok(pescoco.length >= 1 && pescoco.length < 10, `${tag}: filtro por grupo`, pescoco.join('|'));
    await p.click('[data-ex-grupo="todos"]'); await p.waitForTimeout(80);

    // Editar a Puxada: renomear avisa quem usa; o vídeo vai por link.
    await p.click('[data-ex-editar="Puxada"]'); await p.waitForTimeout(120);
    ok(await p.locator('#ex-dialog[open]').count() === 1 && (await p.inputValue('#ex-nome')) === 'Puxada' && (await p.inputValue('#ex-video')) === 'vidPuxada01', `${tag}: editar abre com os dados`);
    ok(await p.locator('#ex-aviso').isHidden(), `${tag}: sem aviso antes de mudar o nome`);
    await p.fill('#ex-nome', 'Puxada frontal');
    ok(/3 contas têm este exercício nos treinos\. Elas continuam com ele, com o nome de antes/.test(await txt(p, '#ex-aviso')), `${tag}: renomear avisa quantas contas usam`, await txt(p, '#ex-aviso'));
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
    await p.fill('#ex-video', ''); await p.fill('#ex-dose', '3×12'); await p.fill('#ex-pse', '7');
    await p.selectOption('#ex-forca', 'alta'); await p.fill('#ex-why', 'Puxada com instabilidade.'); await p.fill('#ex-var', 'Remada nas argolas, Remada no TRX');
    await p.click('#ex-salvar'); await p.waitForTimeout(250);
    db = await H.banco(p);
    const novo = db.exercicios.find((e) => e.nome === 'Remada no anel');
    ok(novo && novo.grupo === 'Peito' && novo.dose === '3×12' && novo.pse === 7 && novo.forca === 'alta' && novo.variacoes.join('|') === 'Remada nas argolas|Remada no TRX' && novo.ativo, `${tag}: cria com todos os campos`, JSON.stringify(novo));
    ok((await linhas(p)).includes('Remada no anel') && /137 exercícios ativos/.test(await txt(p, '#ex-resumo')), `${tag}: novo aparece na lista`);

    // Desativar o Superman: avisa que continua em quem tem e marca na lista.
    await p.click('[data-ex-editar="Superman"]'); await p.waitForTimeout(120);
    await p.uncheck('#ex-ativo');
    ok(/2 contas têm este exercício nos treinos\. Desativado, ele sai da lista de escolha, mas continua/.test(await txt(p, '#ex-aviso')), `${tag}: desativar avisa`, await txt(p, '#ex-aviso'));
    await p.click('#ex-salvar'); await p.waitForTimeout(250);
    db = await H.banco(p);
    ok(db.exercicios.find((e) => e.nome === 'Superman').ativo === false && /Desativado/.test(await txt(p, '#ex-lista .ex-item:has(b:has-text("Superman"))')) && /Superman desativado/.test(await txt(p, '#toast')), `${tag}: desativado marcado na lista`);
    ok(/1 desativado/.test(await txt(p, '#ex-resumo')), `${tag}: resumo conta o desativado`);

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
