// Meus treinos: Desfazer depois de salvar e "Restaurar versão anterior" (perfis.treinos_anterior).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const T = new Date('2026-10-21T15:00:00'); // quarta
async function excluirTreino1(p) {
  await H.voce(p, 'treinos');
  await p.click('#editar-treinos'); await p.waitForTimeout(300);
  await p.click('[data-ed-treino="1"]');
  await p.click('[data-ed-excluir]'); await p.click('[data-ed-excluir-sim]');
  await H.salvarEditor(p); await H.gravacoes(p);
}
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await excluirTreino1(p);
    let db = await H.banco(p);
    ok(Object.keys(db.perfis[0].treinos).join() === '2,3' && !db.perfis[0].semana[3].includes('t1'), `${scheme}: Treino 1 excluído (e saiu da quarta)`);
    const ant = db.perfis[0].treinos_anterior;
    ok(ant && Object.keys(ant.treinos).join() === '1,2,3' && ant.semana[3].includes('t1') && ant.em, `${scheme}: versão anterior gravada com treinos e semana`);
    ok(/Treinos salvos/.test(await txt(p, '#toast')) && await p.locator('#toast .toast-acao').isVisible() && (await txt(p, '#toast .toast-acao')) === 'Desfazer', `${scheme}: aviso com Desfazer`);
    await p.waitForTimeout(200); await p.screenshot({ path: `${H.SAIDA}/desfazer-${scheme}.png` });
    await p.click('#toast .toast-acao'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(db.perfis[0].treinos === null && db.perfis[0].semana[3].includes('t1'), `${scheme}: Desfazer volta ao plano pronto com o Treino 1 na quarta`, JSON.stringify(db.perfis[0].treinos));
    ok(Object.keys(db.perfis[0].treinos_anterior.treinos).join() === '2,3', `${scheme}: a versão desfeita vira a anterior`);
    ok(/Treinos restaurados/.test(await txt(p, '#toast')), `${scheme}: aviso de restaurado`);
    await H.voce(p); await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(150);
    ok((await p.locator('.treino-btn').count()) === 3 && (await txt(p, '#atividade')) === 'Treino 1' && (await p.locator('#sobre .sobre').count()) === 1, `${scheme}: ficha com o Treino 1 de volta (com "Sobre")`);
    // O Desfazer some depois de 8 s
    await excluirTreino1(p);
    await p.clock.runFor(9000); await p.waitForTimeout(100);
    ok(await p.locator('#toast').isHidden(), `${scheme}: o Desfazer some depois de 8 s`);
    // Restaurar versão anterior depois de recarregar
    await p.reload(); await H.prontos(p); await p.waitForTimeout(200);
    await H.voce(p, 'treinos');
    ok(/Restaurar versão anterior \(salva em 21\/10 às 15:0\d\)/.test(await txt(p, '#treinos-anterior')), `${scheme}: botão Restaurar versão anterior com a data`, await txt(p, '#treinos-anterior'));
    await p.click('[data-anterior]');
    ok(/Treino 1, Treino 2 e Treino 3/.test(await txt(p, '.anterior-confirma')), `${scheme}: confirmação mostra os treinos da versão anterior`, await txt(p, '.anterior-confirma'));
    await p.waitForTimeout(200); await p.screenshot({ path: `${H.SAIDA}/anterior-${scheme}.png` });
    await p.click('[data-anterior-nao]');
    ok(await p.locator('[data-anterior]').isVisible(), `${scheme}: cancelar não muda nada`);
    await p.click('[data-anterior]'); await p.click('[data-anterior-sim]'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(db.perfis[0].treinos === null && db.perfis[0].semana[3].includes('t1') && (await p.locator('#meus-treinos li').count()) === 3, `${scheme}: restaurar traz o Treino 1 de volta`);
    ok(p.errs.length === 0, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Banco sem a coluna treinos_anterior: salvar continua funcionando, e o Desfazer também (na sessão)
  {
    const p = await H.novaPagina(b, { extra: { semColunas: ['treinos_anterior'] } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await excluirTreino1(p);
    let db = await H.banco(p);
    ok(db.perfis[0].treinos && Object.keys(db.perfis[0].treinos).join() === '2,3' && !('treinos_anterior' in db.perfis[0]), 'sem a coluna: os treinos são salvos mesmo assim');
    ok(!/schema/.test(await txt(p, '#toast')), 'sem a coluna: nenhum aviso de erro');
    await p.click('#toast .toast-acao'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(db.perfis[0].treinos === null, 'sem a coluna: Desfazer funciona');
    ok(p.errs.length === 0, 'sem a coluna: sem erros', p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
