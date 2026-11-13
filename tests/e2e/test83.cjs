// App instalável (PWA): manifesto e ícones, service worker só em https e, com ele, o app abre sem internet (cópia dos arquivos).
const { chromium } = require('playwright');
const fs = require('fs');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };

(async () => {
  // Manifesto e ícones.
  const m = JSON.parse(fs.readFileSync(H.RAIZ + '/manifest.webmanifest', 'utf8'));
  ok(m.name === 'Gestão de Treinos' && m.start_url === './' && m.scope === './' && m.display === 'standalone', 'manifesto: nome, início, escopo e tela cheia');
  ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'manifesto: ícones 192, 512 e maskable');
  ok(m.icons.every((i) => fs.existsSync(`${H.RAIZ}/${i.src}`)) && fs.existsSync(`${H.RAIZ}/icones/apple-touch-icon.png`), 'arquivos dos ícones existem');

  const srv = await H.servidor(); const b = await chromium.launch();
  let p = await H.novaPagina(b, { logado: false });
  await p.goto(H.PAGINA); await p.waitForSelector('#entrar-google', { timeout: 15000 });
  ok(await p.locator('link[rel="manifest"][href="manifest.webmanifest"]').count() === 1 && await p.locator('link[rel="apple-touch-icon"]').count() === 1, 'index.html liga o manifesto e o ícone do iPhone');
  // Em http (computador) o app não registra o service worker.
  await p.waitForTimeout(300);
  ok(await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length) === 0, 'localhost (http): sem service worker');
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();

  // Com o service worker (registrado à mão aqui): depois de abrir uma vez, abre sem internet.
  p = await H.novaPagina(b, { logado: false });
  await p.goto(H.PAGINA); await p.waitForSelector('#entrar-google', { timeout: 15000 });
  await p.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await p.reload(); await p.waitForSelector('#entrar-google', { timeout: 15000 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controla a página');
  const guardados = await p.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map((r) => new URL(r.url).pathname); });
  ok(guardados.some((u) => u.endsWith('/css/app.css')) && guardados.some((u) => u.endsWith('/js/inicio.js')) && !guardados.some((u) => u.endsWith('versao.json')), 'guarda css/ e js/ (não o versao.json)', guardados.join(','));
  await p.context().setOffline(true);
  await p.reload().catch(() => {}); await p.waitForTimeout(800);
  const titulo = await p.locator('.entrar-titulo').textContent().catch(() => '');
  ok(await p.locator('#tela-entrar').count() === 1 && titulo === 'Gestão de Treinos', 'sem internet: o app abre com a cópia dos arquivos', titulo);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#tela-entrar')).backgroundColor) === 'rgb(219, 39, 119)', 'sem internet: com os estilos (css/app.css)');
  await p.context().close();
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
