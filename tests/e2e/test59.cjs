// Abdominal: busca por "abdominal"/"abdômen"/"barriga" mostra o grupo; grupo aparece como "Core e abdômen"; 10 abdominais clássicos.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const NOVOS = ['Prancha', 'Prancha lateral', 'Abdominal supra', 'Abdominal infra', 'Abdominal bicicleta', 'Abdominal na polia', 'Roda abdominal', 'Elevação de pernas na barra', 'Dead bug', 'Hollow hold'];
const itens = (p) => p.locator('.ed-bib-item').evaluateAll((ls) => ls.map((l) => l.querySelector('b').textContent.trim()));
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { perfis: [{ id: 'u1', nome: 'Ana', email: 'a@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: '2026-10-01T00:00:00Z', treinos: null }] } });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.click('[data-ed-vista="escolher"]'); await p.waitForTimeout(150);
    ok((await p.locator('[data-ed-grupo="Core"]').innerText()) === 'Core e abdômen', `${tag}: grupo aparece como "Core e abdômen"`);
    await p.click('[data-ed-grupo="Core"]'); await p.waitForTimeout(80);
    const core = await itens(p);
    ok(core.length === 31 && NOVOS.every((n) => core.includes(n)), `${tag}: Core e abdômen com 31, incluindo os 10 abdominais`, String(core.length));
    ok(/^Core e abdômen ·/.test(await p.locator('[data-ed-add="Prancha"] small').first().innerText()), `${tag}: item mostra "Core e abdômen"`);
    await p.click('[data-ed-grupo="todos"]');
    for (const termo of ['abdominal', 'Abdômen', 'abdome', 'barriga']) {
      await p.fill('#ed-busca', termo); await p.waitForTimeout(60);
      const r = await itens(p);
      ok(r.length === 31 && r.includes('Superman') && r.includes('L-sit') && r.includes('Abdominal supra'), `${tag}: busca "${termo}" mostra todo o Core e abdômen`, String(r.length));
    }
    for (const [termo, esperado] of [['abdominal supra', 'Abdominal supra'], ['ab wheel', 'Roda abdominal'], ['canoa', 'Hollow hold'], ['prancha', 'Prancha']]) {
      await p.fill('#ed-busca', termo); await p.waitForTimeout(60);
      const r = await itens(p);
      ok(r.includes(esperado) && r.length < 10, `${tag}: busca "${termo}" acha ${esperado}`, r.join('|'));
    }
    await p.fill('#ed-busca', 'abd'); await p.waitForTimeout(60);
    const abd = await itens(p);
    ok(abd.includes('Superman') && abd.includes('Cadeira abdutora') && abd.length === 36, `${tag}: "abd" (digitando) já mostra o grupo e os nomes com abd (abdução, abdutora)`, String(abd.length));
    await p.fill('#ed-busca', 'ab'); await p.waitForTimeout(60);
    ok((await itens(p)).length < 31, `${tag}: com 2 letras não abre o grupo inteiro`);
    await p.fill('#ed-busca', 'abdominal'); await p.waitForTimeout(80);
    if (viewport.width === 390) await p.screenshot({ path: `${H.SAIDA}/abdominal-${scheme}.png` });
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
