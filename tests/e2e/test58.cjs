// Até 6 treinos: editor libera o 6º e trava o 7º; o 6º aparece na tela Treino, na semana e no check-in; salva no banco.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-10-29T15:00:00');
const ex = (nome) => ({ nome, dose: '3×10', pse: 8 });
const CINCO = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, { nome: `Treino ${'ABCDE'[n - 1]}`, subtitulo: '', exercicios: [ex('Agachamento'), ex('Puxada')] }]));
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, extra: { perfis: [{ id: 'u1', nome: 'Marcelo', email: 'm@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: '2026-10-01T00:00:00Z', treinos: CINCO }] } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.waitForTimeout(150);
    ok(/Até 6 treinos/.test(await p.locator('#editor-body').innerText()), `${scheme}: editor diz "Até 6 treinos"`);
    ok(await p.locator('[data-ed-novo]').isEnabled(), `${scheme}: com 5 treinos, "+ Novo treino" liberado`);
    await p.click('[data-ed-novo]'); await p.waitForTimeout(200);
    await p.fill('#ed-busca', 'sissy'); await p.click('[data-ed-add="Sissy squat"]');
    await p.locator('.ed-fixo [data-ed-vista="treino"]').click(); await p.waitForTimeout(150);
    ok((await p.locator('[data-ed-treino]').count()) === 6, `${scheme}: 6 treinos no editor`);
    ok(await p.locator('[data-ed-novo]').isDisabled(), `${scheme}: com 6, "+ Novo treino" travado`);
    await p.screenshot({ path: `${H.SAIDA}/seis-editor-${scheme}.png` });
    await H.salvarEditor(p); await p.waitForTimeout(400); await H.gravacoes(p);
    const db = await H.banco(p);
    ok(Object.keys(db.perfis[0].treinos || {}).join(',') === '1,2,3,4,5,6' && db.perfis[0].treinos['6'].exercicios[0].nome === 'Sissy squat', `${scheme}: 6º treino salvo no banco`, Object.keys(db.perfis[0].treinos || {}).join(','));
    // Tela Treino
    await p.click('[data-tela="treino"]'); await p.waitForTimeout(200);
    ok((await p.locator('[data-treino]').count()) === 6, `${scheme}: 6 abas na tela Treino`);
    await p.click('[data-treino="6"]'); await p.waitForTimeout(150);
    ok(/Sissy squat/.test(await p.locator('#list').innerText()), `${scheme}: aba do 6º mostra os exercícios`);
    await p.screenshot({ path: `${H.SAIDA}/seis-treino-${scheme}.png` });
    // Minha semana e check-in
    await H.voce(p, 'semana'); await p.waitForTimeout(150);
    ok((await p.locator('#paleta [data-arrastar="t6"]').count()) === 1, `${scheme}: 6º treino na paleta da semana`);
    await p.click('[data-tela="treino"]'); await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok((await p.locator('input[name="f-tipo"][value="t6"]').count()) === 1, `${scheme}: check-in oferece o 6º treino`);
    await p.check('input[name="f-tipo"][value="t6"]'); await p.click('[data-salvar-form]'); await H.gravacoes(p);
    const c = (await H.banco(p)).checkins.at(-1);
    ok(c && c.tipo === 't6', `${scheme}: check-in do 6º treino salvo`, c && c.tipo);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
