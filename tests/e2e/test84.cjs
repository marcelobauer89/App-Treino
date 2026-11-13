// PWA, etapa 1: manifesto do dev com "[DEV]", metas do iPhone, aviso sem internet com nova tentativa sozinha
// e a linha "Instalar o app" em Você (Android com o pedido do navegador, iPhone com o passo a passo, some se já instalado).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const IPHONE = devices['iPhone 13'].userAgent;
const abrirVoce = async (p) => { await p.click('[data-tela="voce"]'); await p.waitForTimeout(250); };
// Pedido de instalação falso do Chrome (beforeinstallprompt), disparado depois que o app abre.
const pedidoFalso = () => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.falso = true;
  e.prompt = () => { window.__pediu = (window.__pediu || 0) + 1; };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
};

(async () => {
  const dev = JSON.parse(fs.readFileSync(H.RAIZ + '/manifest-dev.webmanifest', 'utf8'));
  ok(dev.name === '[DEV] Gestão de Treinos' && dev.scope === './', 'manifesto do dev com [DEV]');
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    // Produção: manifesto normal e metas do iPhone.
    let p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 } });
    // O Chromium dos testes às vezes oferece a instalação de verdade: aqui só vale o pedido falso.
    await p.addInitScript(() => window.addEventListener('beforeinstallprompt', (e) => { if (!e.falso) e.stopImmediatePropagation(); }, true));
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    ok(await p.getAttribute('link[rel="manifest"]', 'href') === 'manifest.webmanifest', `${scheme}: produção usa manifest.webmanifest`);
    ok(await p.getAttribute('meta[name="apple-mobile-web-app-capable"]', 'content') === 'yes' && await p.locator('meta[name="apple-mobile-web-app-status-bar-style"]').count() === 1, `${scheme}: metas do iPhone`);
    // Chromium sem pedido de instalação (computador): a linha não aparece.
    await abrirVoce(p);
    ok(await p.locator('#grupo-instalar').isHidden(), `${scheme}: sem pedido do navegador, sem a linha`);
    // Android: o navegador oferece a instalação; a linha aparece e o toque abre o pedido.
    await p.evaluate(pedidoFalso); await p.waitForTimeout(100);
    ok(await p.locator('#instalar-app').isVisible(), `${scheme}: com o pedido do navegador, a linha aparece`);
    await p.locator('#voce-menu').screenshot({ path: `${H.SAIDA}/instalar-linha-${scheme}.png` });
    await p.click('#instalar-app'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => window.__pediu) === 1, `${scheme}: toque abre o pedido de instalação`);
    ok(await p.locator('#grupo-instalar').isHidden(), `${scheme}: instalou, a linha some`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();

    // iPhone (Safari): a linha aparece e mostra o passo a passo.
    p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, userAgent: IPHONE });
    await p.goto(H.PAGINA); await H.prontos(p); await abrirVoce(p);
    ok(await p.locator('#instalar-app').isVisible(), `${scheme}: iPhone mostra "Instalar o app"`);
    await p.click('#instalar-app'); await p.waitForTimeout(250);
    const txt = await p.locator('#instalar-dialog').innerText();
    ok(/Compartilhar/.test(txt) && /Adicionar à Tela de Início/.test(txt), `${scheme}: passo a passo do Safari`);
    await p.locator('#instalar-dialog .modal-body').screenshot({ path: `${H.SAIDA}/instalar-iphone-${scheme}.png` });
    await p.click('#instalar-dialog .modal-done'); await p.waitForTimeout(150);
    ok(!(await p.locator('#instalar-dialog[open]').count()), `${scheme}: "Entendi" fecha`);
    await p.context().close();

    // Já instalado (aberto da tela inicial): a linha não aparece.
    p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, userAgent: IPHONE });
    await p.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await p.goto(H.PAGINA); await H.prontos(p); await abrirVoce(p);
    ok(await p.locator('#grupo-instalar').isHidden(), `${scheme}: app já instalado, sem a linha`);
    await p.context().close();

    // Dev: manifesto com [DEV].
    p = await H.novaPagina(b, { scheme, dev: true, viewport: { width: 390, height: 844 } });
    await p.goto(H.PAGINA); await p.waitForTimeout(500);
    ok(await p.getAttribute('link[rel="manifest"]', 'href') === 'manifest-dev.webmanifest', `${scheme}: dev usa manifest-dev.webmanifest`);
    await p.context().close();
  }

  // Sem internet ao abrir: aviso amigável e nova tentativa sozinha quando a conexão volta.
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: { falharLeitura: 1 } });
  await p.addInitScript(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !window.__offline }); window.__offline = true; });
  await p.goto(H.PAGINA); await p.waitForSelector('#entrar-tentar:not([hidden])', { timeout: 15000 });
  ok(/sem internet/.test(await p.locator('#entrar-status').innerText()), 'sem internet: aviso amigável', await p.locator('#entrar-status').innerText());
  await p.screenshot({ path: `${H.SAIDA}/sem-internet.png` });
  await p.evaluate(() => { window.__offline = false; window.dispatchEvent(new Event('online')); });
  await H.prontos(p);
  ok(await p.locator('#tela-entrar').isHidden(), 'internet voltou: o app abre sozinho');
  await p.context().close();
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
