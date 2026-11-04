// Meus treinos: mudar a ordem dos exercícios arrastando a alça (mouse, toque e teclado).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const nomes = (p) => p.locator('.ed-ex .ed-ex-nome b').allInnerTexts().then((l) => l.map((t) => t.replace(/^\d+/, '').trim()));
async function arrastar(p, de, para, { soltar = true, passos = 12 } = {}) {
  const a = await p.locator(`[data-ed-alca="${de}"]`).boundingBox();
  const alvo = await p.locator('.ed-ex').nth(para).boundingBox();
  const x = a.x + a.width / 2, y0 = a.y + a.height / 2;
  const y1 = alvo.y + alvo.height / 2 + (para > de ? 10 : -10);
  await p.mouse.move(x, y0); await p.mouse.down();
  await p.mouse.move(x, y0 + (y1 > y0 ? 6 : -6));
  await p.mouse.move(x, y1, { steps: passos });
  if (soltar) await p.mouse.up();
}
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 390, height: 844 }], ['dark', { width: 1280, height: 900 }]]) {
    const p = await H.novaPagina(b, { scheme, viewport: vp });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await H.voce(p, 'treinos');
    await p.click('#editar-treinos'); await p.waitForTimeout(400);
    const antes = await nomes(p);
    ok((await p.locator('.ed-alca').count()) === antes.length && /arraste para mudar a ordem/.test(await p.locator('#ed-dica-ordem').innerText()), `${scheme}: alça em cada exercício e dica`);
    // Mouse: 1º para a 3ª posição
    await arrastar(p, 0, 2, { soltar: false });
    ok(await p.locator('.ed-ex.ed-arrastando').count() === 1, `${scheme}: cartão levantado durante o arrasto`);
    await p.waitForTimeout(250); await p.screenshot({ path: `${H.SAIDA}/ordem-${scheme}.png` });
    await p.mouse.up(); await p.waitForTimeout(100);
    let depois = await nomes(p);
    ok(depois.join('|') === [antes[1], antes[2], antes[0], ...antes.slice(3)].join('|'), `${scheme}: arrastar com o mouse muda a ordem`, depois.slice(0, 4).join(', '));
    ok((await p.locator('.ed-ex .ed-num').first().innerText()) === '01' && (await p.locator('[data-ed-pos]').nth(2).locator('.ed-num').innerText()) === '03', `${scheme}: números refeitos`);
    // Último para o topo
    const n = depois.length;
    await p.locator(`[data-ed-alca="${n - 1}"]`).scrollIntoViewIfNeeded();
    {
      const al = await p.locator(`[data-ed-alca="${n - 1}"]`).boundingBox();
      const dlg = await p.locator('#editor-dialog').boundingBox();
      const x = al.x + al.width / 2;
      await p.mouse.move(x, al.y + 20); await p.mouse.down();
      await p.mouse.move(x, al.y + 10);
      await p.mouse.move(x, dlg.y + 20, { steps: 15 });
      // Segura perto do topo: a lista rola sozinha até o começo.
      for (let k = 0; k < 40 && await p.locator('#editor-dialog').evaluate((d) => d.scrollTop) > 0; k++) {
        await p.waitForTimeout(50); await p.mouse.move(x, dlg.y + 19 + (k % 2));
      }
      await p.mouse.move(x, dlg.y + 4); await p.waitForTimeout(50);
      await p.mouse.up();
    }
    await p.waitForTimeout(100);
    const d2 = await nomes(p);
    ok(d2[0] === depois[n - 1] && d2.length === n, `${scheme}: arrastar do fim ao topo (com rolagem)`, d2[0]);
    // Esc cancela o arrasto e não fecha o editor
    const antesEsc = await nomes(p);
    await arrastar(p, 0, 3, { soltar: false });
    await p.keyboard.press('Escape'); await p.mouse.up(); await p.waitForTimeout(100);
    ok((await nomes(p)).join('|') === antesEsc.join('|') && await p.locator('#editor-dialog[open]').isVisible(), `${scheme}: Esc cancela o arrasto sem fechar o editor`);
    // Teclado
    await p.locator('[data-ed-alca="0"]').focus();
    await p.keyboard.press('ArrowDown');
    const d3 = await nomes(p);
    ok(d3[1] === antesEsc[0] && await p.evaluate(() => document.activeElement.dataset.edAlca) === '1', `${scheme}: seta para baixo no teclado move e mantém o foco`);
    ok(/posição 2 de/.test(await p.locator('#ed-anuncio').textContent()), `${scheme}: leitor de tela anuncia a nova posição`);
    await p.keyboard.press('ArrowUp');
    ok((await nomes(p))[0] === antesEsc[0], `${scheme}: seta para cima volta`);
    // Toque (pointer events de toque)
    const t0 = await nomes(p);
    await p.evaluate(() => {
      const alca = document.querySelector('[data-ed-alca="0"]');
      const r = alca.getBoundingClientRect(), alvo = document.querySelectorAll('.ed-ex')[1].getBoundingClientRect();
      const ev = (tipo, y) => alca.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: r.x + 10, clientY: y, isPrimary: true }));
      ev('pointerdown', r.y + 20);
      for (let k = 1; k <= 10; k++) ev('pointermove', r.y + 20 + (alvo.y + alvo.height / 2 + 10 - r.y - 20) * k / 10);
      ev('pointerup', alvo.y + alvo.height / 2 + 10);
    });
    await p.waitForTimeout(100);
    ok((await nomes(p))[1] === t0[0], `${scheme}: arrastar com o dedo muda a ordem`);
    // Tocar na alça sem arrastar não muda nada
    const t1 = await nomes(p);
    await p.click('[data-ed-alca="2"]');
    ok((await nomes(p)).join('|') === t1.join('|'), `${scheme}: tocar sem arrastar não muda a ordem`);
    // Salvar grava a ordem
    await H.salvarEditor(p); await H.gravacoes(p);
    const db = await H.banco(p);
    // O editor abre no treino do dia (depende da data): confere o treino que estava aberto.
    ok(db.perfis[0].treinos && Object.values(db.perfis[0].treinos).some((t) => t.exercicios.map((e) => e.nome).join('|') === t1.join('|')), `${scheme}: ordem salva no banco`);
    await p.click('[data-tela="treino"]'); await p.waitForTimeout(150);
    const ficha = await p.locator('#list .ex h3').allInnerTexts();
    ok(ficha.join('|') === t1.join('|'), `${scheme}: ficha segue a nova ordem`);
    ok(p.errs.length === 0, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
