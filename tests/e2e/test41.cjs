// Cartões da ficha depois de salvar treinos pela aba Você: o painel de informações tem que aparecer inteiro.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 } });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await p.click('[data-treino="3"]'); await p.waitForTimeout(200);
    await H.voce(p, 'treinos');
    await p.click('#editar-treinos'); await p.waitForTimeout(300);
    await p.click('[data-ed-novo]');
    await p.click('[data-ed-add="Agachamento Zercher"]'); await p.click('[data-ed-add="Stiff"]'); await p.click('[data-ed-add="Cócoras"]');
    await p.locator('.ed-fixo [data-ed-vista="treino"]').click();
    await p.click('[data-ed-salvar]'); await H.gravacoes(p);
    await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(400);
    for (const id of ['atual', '4', '3', '1']) {
      if (id !== 'atual') { await p.click(`[data-treino="${id}"]`); await p.waitForTimeout(300); }
      const r = await p.$$eval('#list .ex', (els) => els.map((li) => {
        const why = li.querySelector('.ex-why'), sl = li.querySelector('.ex-slides');
        const vis = (el) => { if (!el) return false; const a = el.getBoundingClientRect(), c = (sl || li).getBoundingClientRect(); return a.height > 0 && a.bottom <= c.bottom + 1; };
        return { nome: li.querySelector('h3').textContent, why: vis(why), graus: vis(li.querySelector('.graus')), alt: sl ? sl.offsetHeight : -1 };
      }));
      const ruins = r.filter((x) => !x.why || !x.graus);
      ok(r.length > 0 && !ruins.length, `${scheme}: Treino ${id} — explicação e níveis visíveis em todos os cartões`, ruins.map((x) => `${x.nome}(${x.alt})`).join(', '));
    }
    await p.click('[data-treino="4"]'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${H.SAIDA}/ficha-apos-salvar-${scheme}.png` });
    ok(p.errs.length === 0, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
