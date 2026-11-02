const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    const ctx = p.context();
    await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(H.APOIO, 'thumb.jpg')) }));
    await ctx.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ contentType: 'text/html', body: `<body style="margin:0;background:#c0392b;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh">PLAYER ${new URL(r.request().url()).pathname.split('/').pop()}</body>` }));
    await p.clock.install({ time: new Date('2026-10-21T10:00:00') }); // quarta: Treino 1
    await p.goto(H.PAGINA);
    await H.prontos(p);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    if (scheme === 'light') {
      ok(await p.locator('a.video').count() === 0 && (await p.locator('#app-main button:text-is("Vídeo"), #app-main a:text-is("Vídeo"), button:text-is("Vídeo")').count()) === 0, 'old Vídeo button removed');
      const nCarrosseis = await p.locator('.ex-slides').count();
      ok(nCarrosseis === 7, 'carousel only on exercises with video (7 of 8 in Treino 1)', `${nCarrosseis}`);
      const rosca = p.locator('.ex', { has: p.locator('h3', { hasText: /^Rosca bíceps$/ }) });
      ok(await rosca.locator('.ex-slides').count() === 0 && await rosca.locator('.ex-nav').count() === 0, 'no carousel for exercise without video');
      const remada = p.locator('.ex').nth(3);
      const sl = remada.locator('.ex-slides');
      const h0 = await sl.evaluate((s) => s.offsetHeight);
      ok(await remada.locator('iframe').count() === 0 && (await remada.locator('.ex-dica').innerText()) === 'Deslize para ver a execução', 'starts on info, no iframe loaded');
      ok((await remada.locator('.video-quadro img').getAttribute('src')) === 'https://i.ytimg.com/vi/U8po_799Nks/hqdefault.jpg', 'thumbnail URL');
      ok((await remada.locator('.video-link').getAttribute('href')) === 'https://www.youtube.com/shorts/U8po_799Nks', 'Abrir no YouTube link');
      await sl.scrollIntoViewIfNeeded();
      await p.screenshot({ path: 'v-card-info.png' });
      // deslizar (rolagem horizontal)
      await sl.evaluate((s) => s.scrollTo({ left: s.clientWidth }));
      await p.waitForTimeout(500);
      const src = await remada.locator('iframe').getAttribute('src');
      ok(src && src.includes('/embed/U8po_799Nks?') && /autoplay=1&mute=1&loop=1&playlist=U8po_799Nks&playsinline=1/.test(src), 'swipe loads muted autoplay loop iframe', src);
      const h1 = await sl.evaluate((s) => s.offsetHeight);
      ok(h1 > h0 && (await remada.locator('.ex-ponto[aria-current="true"]').getAttribute('data-ponto')) === '1' && (await remada.locator('.ex-dica').innerText()) === 'Deslize para voltar', 'height, dots and hint follow the video panel', `${h0}→${h1}`);
      await sl.scrollIntoViewIfNeeded();
      await p.screenshot({ path: 'v-card-video.png' });
      // salvar um peso só grava o peso (sem check-in): o cartão continua no vídeo
      await remada.locator('.log-btn').click();
      await p.fill('#kg-0', '20');
      await p.click('[data-concluir]');
      await p.waitForTimeout(400);
      const remada2 = p.locator('.ex').nth(3);
      ok(await remada2.locator('.ex-slides').evaluate((s) => Math.round(s.scrollLeft / s.clientWidth)) === 1 && await remada2.locator('iframe').count() === 1, 'card stays on video after list redraw');
      ok(!(await p.locator('#ativo').isVisible()) && (await remada2.locator('.log-btn').innerText()).includes('Hoje: 20'), 'weight saved without starting a check-in');
      // pontinho volta para as informações e remove o vídeo
      await remada2.locator('[data-ponto="0"]').click();
      await p.waitForTimeout(700);
      ok(await remada2.locator('iframe').count() === 0 && (await remada2.locator('.ex-ponto[aria-current="true"]').getAttribute('data-ponto')) === '0', 'dot returns to info and unloads video');
      // trocar de tela remove vídeos carregados
      await remada2.locator('[data-ponto="1"]').click();
      await p.waitForTimeout(700);
      await p.click('.nav [data-tela="dashboard"]');
      await p.waitForTimeout(300);
      ok(await p.locator('#tela-treino iframe').count() === 0, 'leaving the screen unloads the video');
      await p.click('.nav [data-tela="treino"]');
      await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'no horizontal page scroll');
    } else {
      const remada = p.locator('.ex').nth(3);
      await remada.locator('.ex-slides').evaluate((s) => s.scrollTo({ left: s.clientWidth }));
      await p.waitForTimeout(500);
      await remada.locator('.ex-slides').scrollIntoViewIfNeeded();
      await p.screenshot({ path: 'v-card-video-dark.png' });
    }
    console.log(scheme, 'errors:', p.errs);
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); srv.close();
})();
