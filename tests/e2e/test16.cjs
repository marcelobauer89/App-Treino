const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
    await p.goto(H.PAGINA); await H.prontos(p);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    const card = p.locator('.ex').nth(3);
    const sl = card.locator('.ex-slides');
    await sl.evaluate((s) => s.scrollTo({ left: s.clientWidth }));
    await p.waitForTimeout(500);
    const h3 = card.locator('h3');
    const box = await h3.boundingBox(), cardBox = await card.boundingBox();
    const dentro = box && box.x >= cardBox.x && box.x + box.width <= cardBox.x + cardBox.width;
    ok(await h3.isVisible() && (await h3.innerText()) === 'Remada inversa' && dentro, `${scheme}: name stays visible on the video panel`);
    ok(await card.locator('.ex-slides .ex-topo').count() === 0 && await card.locator('.ex-topo').count() === 1, `${scheme}: name is outside the carousel, not duplicated`);
    ok((await card.locator('.ex-dose').innerText()).includes('3×10'), `${scheme}: dose and PSE stay too`);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: `n-video-${scheme}.png` });
    if (scheme === 'light') {
      const rosca = p.locator('.ex', { has: p.locator('h3', { hasText: /^Rosca bíceps$/ }) });
      ok(await rosca.locator('.ex-topo').count() === 1 && await rosca.locator('.ex-why').count() === 1, 'card without video unchanged');
    }
    console.log(scheme, 'errors:', p.errs);
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); srv.close();
})();
