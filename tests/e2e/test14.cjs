const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
    await p.goto(H.PAGINA); await H.prontos(p);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    const card = p.locator('.ex').nth(3);
    const centro = (r) => r.x + r.width / 2;
    const c = await card.boundingBox(), d = await card.locator('.ex-pontos').boundingBox(), t = await card.locator('.ex-dica').boundingBox();
    console.log(scheme, '| card', centro(c).toFixed(1), '| dots', centro(d).toFixed(1), '| dica', centro(t).toFixed(1), '| dica abaixo dos dots:', t.y >= d.y + d.height - 1,
      '| OK:', Math.abs(centro(c) - centro(d)) <= 2 && Math.abs(centro(c) - centro(t)) <= 2);
    await card.locator('.ex-nav').scrollIntoViewIfNeeded();
    await card.screenshot({ path: `d-${scheme}.png` });
    console.log('errors:', p.errs);
  }
  await b.close(); srv.close();
})();
