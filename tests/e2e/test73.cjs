// Catálogo no banco (exercicios e jornadas): o app usa o que vem do banco, guarda uma cópia no aparelho
// e não muda os treinos de quem já usa (renomeado aparece com o nome novo, com as cargas do nome antigo; desativado continua em quem o tem).
// Também: o catálogo é buscado de novo ao voltar para o app e o filtro "Do meu objetivo".
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-10-28T15:00:00'); // quarta-feira: no plano pronto é dia do Treino 1
const PERFIL = { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], treinos: null };

// Catálogo mudado pelo painel: Puxada renomeada, Superman desativado, um exercício novo, outra explicação
// no Agachamento, um objetivo com outro resumo e o Força e potência desativado.
function catalogoMudado() {
  const c = H.catalogo();
  const ex = (n) => c.exercicios.find((e) => e.nome === n);
  Object.assign(ex('Puxada'), { nome: 'Puxada frontal', nomes_antigos: ['Puxada'] });
  ex('Superman').ativo = false;
  ex('Agachamento').explicacao = 'Explicação nova vinda do banco.';
  c.exercicios.push({ nome: 'Exercício novo de teste', grupo: 'Core', dose: '3×12', pse: 7, hipertrofia: 'media', mobilidade: 'baixa', forca: 'alta', explosao: 'baixa', explicacao: 'Criado no painel.', variacoes: ['Novo apelido'], nomes_antigos: [], ativo: true });
  c.jornadas.find((j) => j.id === 'hipertrofia').dados.resumo = 'Resumo novo do banco.';
  c.jornadas.find((j) => j.id === 'forca').ativo = false;
  return c;
}
async function abrir(b, { perfil = PERFIL, catalogo = catalogoMudado(), extra = {}, local = {}, scheme = 'light', viewport = { width: 390, height: 844 } } = {}) {
  const p = await H.novaPagina(b, { scheme, viewport, local, extra: { perfis: [{ ...perfil }], ...(catalogo || {}), ...extra } });
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(250);
  return p;
}
const nomesNoTreino = (p) => p.locator('.ex-topo h3').allInnerTexts();
async function biblioteca(p) {
  await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.click('[data-ed-vista="escolher"]'); await p.waitForTimeout(150);
  return p.locator('.ed-bib-item').evaluateAll((ls) => ls.map((l) => ({ nome: l.querySelector('b').textContent.trim(), dentro: l.getAttribute('aria-pressed') === 'true' })));
}

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  // A carga inicial do schema.sql é a mesma lista que vem no app (supabase/gerar-catalogo.cjs).
  const conf = require('child_process').spawnSync(process.execPath, [require('path').join(H.RAIZ, 'supabase', 'gerar-catalogo.cjs'), '--conferir'], { encoding: 'utf8' });
  ok(conf.status === 0, 'schema.sql com o mesmo catálogo do app', (conf.stdout + conf.stderr).trim());

  // 1. Plano pronto com o catálogo mudado: a lista do Treino 1 é a mesma, com os detalhes do banco.
  for (const scheme of ['light', 'dark']) {
    const p = await abrir(b, { scheme, extra: { videos: [{ exercicio: 'Puxada frontal', video_id: 'vidPuxadaA1' }] } });
    const nomes = await nomesNoTreino(p);
    ok(nomes.includes('Puxada frontal') && nomes.includes('Superman') && !nomes.includes('Puxada') && nomes.length === 8, `${scheme}: plano pronto com os mesmos exercícios, o renomeado com o nome novo e o desativado`, nomes.join(', '));
    ok(await p.locator('[data-video="vidPuxadaA1"]').count() === 1, `${scheme}: o vídeo do exercício renomeado aparece pelo nome antigo`);
    const sup = p.locator('.exercicio, li', { has: p.locator('h3', { hasText: /^Superman$/ }) }).first();
    ok(/cadeia posterior/i.test(await sup.innerText().catch(() => '')), `${scheme}: exercício desativado segue completo (explicação e níveis)`);
    const db = await H.banco(p);
    ok(db.perfis[0].treinos === null || db.perfis[0].treinos === undefined, `${scheme}: nada é gravado nos treinos da conta ao abrir`);
    ok(db.log.includes('select:exercicios') && db.log.includes('select:jornadas'), `${scheme}: busca o catálogo no banco`);
    const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('bauer-catalogo') || 'null'));
    ok(guardado && guardado.exercicios.some((e) => e.nome === 'Exercício novo de teste'), `${scheme}: guarda a cópia do catálogo no aparelho`);
    await p.screenshot({ path: `${H.SAIDA}/catalogo-treino-${scheme}.png` });

    // Editor: a biblioteca vem do banco (novo e renomeado aparecem, desativado não).
    const lista = await biblioteca(p);
    const tem = (n) => lista.find((x) => x.nome === n);
    ok(tem('Exercício novo de teste') && tem('Puxada frontal') && !tem('Puxada') && !tem('Superman'), `${scheme}: biblioteca com o novo e o renomeado, sem o desativado`, String(lista.length));
    ok(lista.length === 136, `${scheme}: 136 na lista (135 ativos de antes + 1 novo)`, String(lista.length));
    ok(tem('Puxada frontal') && tem('Puxada frontal').dentro, `${scheme}: o renomeado aparece como já no treino`);
    await p.fill('#ed-busca', 'apelido'); await p.waitForTimeout(80);
    ok((await p.locator('.ed-bib-item b').allInnerTexts()).join('|') === 'Exercício novo de teste', `${scheme}: busca pelos outros nomes do banco`);
    await p.fill('#ed-busca', ''); await p.waitForTimeout(80);
    // Tocar no renomeado tira o exercício (o de nome antigo) do treino, sem duplicar.
    await p.click('[data-ed-add="Puxada frontal"]'); await p.waitForTimeout(80);
    ok(!(await p.evaluate(() => [...document.querySelectorAll('.ed-ex-nome b')].some((b) => /Puxada/.test(b.textContent)))), `${scheme}: tocar no renomeado tira o de nome antigo, sem duplicar`);
    await p.screenshot({ path: `${H.SAIDA}/catalogo-editor-${scheme}.png` });
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 2. Treinos próprios com o nome antigo e cargas: continuam iguais; o Agachamento mostra a explicação nova.
  {
    const treinos = { 1: { nome: 'Treino A', subtitulo: 'Costas', exercicios: [{ nome: 'Puxada', dose: '4×8', pse: 9 }, { nome: 'Superman', dose: '3×30 s', pse: 7 }, { nome: 'Agachamento', dose: '5×5', pse: 8 }] } };
    const cargas = [{ usuario_id: 'u1', data: '2026-10-21', treino: 't1', series: { Puxada: [{ carga: 50 }] } }];
    const p = await abrir(b, { perfil: { ...PERFIL, treinos, semana: [[], [], [], ['t1'], [], [], []] }, extra: { cargas } });
    const nomes = await nomesNoTreino(p);
    ok(nomes.join('|') === 'Puxada frontal|Superman|Agachamento', 'treinos próprios: mesmos exercícios, na mesma ordem, o renomeado com o nome novo', nomes.join('|'));
    const txt = await p.locator('main').first().innerText();
    ok(/4×8/.test(txt) && /PSE 9/.test(txt), 'treinos próprios: dose e PSE da conta');
    ok(/Explicação nova vinda do banco/.test(txt), 'treinos próprios: detalhes do exercício vêm do catálogo');
    await p.click('#list [data-log="0"]'); await p.waitForTimeout(150);
    ok(/Última vez: 50/.test(await p.locator('#log-dialog .log-hint').innerText().catch(() => '')) && await p.inputValue('#kg-0') === '50', 'treinos próprios: a carga salva com o nome antigo continua (Última vez: 50 kg)');
    ok((await p.locator('#log-title').innerText()).trim() === 'Puxada frontal', 'treinos próprios: janela de pesos com o nome novo');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const db = await H.banco(p);
    ok(JSON.stringify(db.perfis[0].treinos) === JSON.stringify(treinos) && JSON.stringify(db.cargas) === JSON.stringify(cargas), 'treinos próprios: nada muda no banco');
    ok(!p.errs.length, 'treinos próprios: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Objetivos do banco: resumo novo, desativado fora da lista, mas quem já tem continua com ele.
  {
    const p = await abrir(b, { perfil: { ...PERFIL, jornada: 'forca', treinos: JSON.parse(JSON.stringify(H.catalogo().jornadas.find((j) => j.id === 'forca').dados.treinos)) } });
    await H.voce(p);
    ok(/Força e potência/.test(await p.locator('#valor-treinos').innerText()), 'objetivo desativado: quem tem continua vendo o nome', await p.locator('#valor-treinos').innerText());
    await H.voce(p, 'treinos'); await p.click('#trocar-jornada'); await p.waitForTimeout(200);
    const cartoes = await p.locator('#jornada-dialog .jornada-topo b').allInnerTexts();
    ok(!cartoes.includes('Força e potência') && cartoes.includes('Hipertrofia'), 'objetivo desativado sai da lista de escolha', cartoes.join(', '));
    ok(/Resumo novo do banco/.test(await p.locator('#jornada-dialog').innerText()), 'objetivo com o resumo do banco');
    await p.screenshot({ path: `${H.SAIDA}/catalogo-objetivos.png` });
    ok(!p.errs.length, 'objetivos: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 4. Sem internet para o catálogo: usa a cópia guardada; sem cópia e sem tabela, usa a lista do app.
  {
    const guardado = JSON.stringify({ exercicios: catalogoMudado().exercicios, jornadas: catalogoMudado().jornadas });
    let p = await abrir(b, { local: { 'bauer-catalogo': guardado }, extra: { falharCatalogo: true } });
    let lista = await biblioteca(p);
    ok(lista.some((x) => x.nome === 'Exercício novo de teste') && !lista.some((x) => x.nome === 'Superman'), 'sem internet: usa a cópia guardada no aparelho');
    ok(!p.errs.length, 'sem internet: sem erros', p.errs.join(' | '));
    await p.context().close();
    p = await abrir(b, { catalogo: null });
    lista = await biblioteca(p);
    ok(lista.length === 136 && lista.some((x) => x.nome === 'Superman') && lista.some((x) => x.nome === 'Puxada'), 'banco sem o catálogo (SQL não rodado): lista que vem no app', String(lista.length));
    ok(!(await p.evaluate(() => localStorage.getItem('bauer-catalogo'))), 'banco sem o catálogo: não guarda cópia');
    ok(!p.errs.length, 'sem catálogo: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 5. Volta para o app depois de uma mudança no painel: o card já mostra o nome novo, sem fechar o app.
  {
    const p = await abrir(b);
    ok((await nomesNoTreino(p)).includes('Remada inversa'), 'antes da mudança: Remada inversa');
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); const e = d.exercicios.find((x) => x.nome === 'Remada inversa'); e.nomes_antigos = ['Remada inversa']; e.nome = 'Remada invertida na barra'; e.explicacao = 'Explicação mudada agora.'; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
    await p.clock.fastForward(130000);
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(300);
    const nomes = await nomesNoTreino(p);
    ok(nomes.includes('Remada invertida na barra') && !nomes.includes('Remada inversa') && /Explicação mudada agora/.test(await p.locator('main').first().innerText()), 'ao voltar para o app: card com o nome e a explicação novos', nomes.join(', '));
    ok((await H.banco(p)).perfis[0].treinos == null, 'ao voltar: nada gravado na conta');
    ok(!p.errs.length, 'ao voltar: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // 6. Filtro "Do meu objetivo" na biblioteca do editor.
  {
    const p = await abrir(b, { perfil: { ...PERFIL, jornada: 'hipertrofia' } });
    await biblioteca(p);
    ok(/Do meu objetivo \(Hipertrofia\)/.test(await p.locator('[data-ed-grupo="objetivo"]').innerText().catch(() => '')), 'chip "Do meu objetivo (Hipertrofia)"');
    await p.click('[data-ed-grupo="objetivo"]'); await p.waitForTimeout(100);
    const doObj = await p.locator('.ed-bib-item b').allInnerTexts();
    ok(doObj.includes('Supino reto') && doObj.includes('Agachamento') && !doObj.includes('Escorpião') && doObj.length < 60, 'filtro mostra só os exercícios marcados para o objetivo', `${doObj.length}`);
    await p.screenshot({ path: `${H.SAIDA}/catalogo-objetivo.png` });
    ok(!p.errs.length, 'objetivo: sem erros', p.errs.join(' | '));
    await p.context().close();
    // Sem objetivo na conta, sem o chip.
    const q = await abrir(b);
    await biblioteca(q);
    ok(!(await q.locator('[data-ed-grupo="objetivo"]').count()), 'sem objetivo na conta: sem o chip');
    await q.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
