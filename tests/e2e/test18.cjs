// Nova tela de login: tamanhos, temas, estados, largura do botão, foco e rolagem.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const tamanhos = [['375', 375, 760], ['360', 360, 640], ['1280', 1280, 800]];
  for (const scheme of ['light', 'dark']) for (const [nome, w, h] of tamanhos) {
    const p = await H.novaPagina(b, { logado: false, scheme });
    await p.setViewportSize({ width: w, height: h });
    await p.goto(H.PAGINA);
    await p.waitForSelector('#entrar-google:not([hidden])');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btn: r('#entrar-google').width, corpo: r('.entrar-corpo').width,
        titulo: r('#entrar-titulo'), arte: r('.entrar-arte'), credito: r('.credito').bottom, carga: !document.getElementById('entrar-carga').hidden,
        priv: !document.getElementById('entrar-privacidade').hidden, label: document.getElementById('entrar-google').innerText.trim() };
    });
    ok(m.sw === w, `${scheme} ${nome}: no horizontal scroll`, m.sw);
    ok(m.sh <= h + 1, `${scheme} ${nome}: fits without vertical scroll`, `${m.sh} vs ${h}`);
    if (w < 900) ok(Math.abs(m.btn - (m.corpo - 40)) < 2, `${scheme} ${nome}: full-width button`, `${m.btn}/${m.corpo}`);
    ok(m.label === 'Continuar com o Google' && m.priv && !m.carga, `${scheme} ${nome}: login state`);
    await p.screenshot({ path: `l-${scheme}-${nome}.png` });
    if (scheme === 'light' && nome === '375') {
      await p.keyboard.press('Tab');
      const foco = await p.evaluate(() => document.activeElement.id + '|' + getComputedStyle(document.activeElement).outlineStyle);
      ok(foco === 'entrar-google|solid', 'keyboard focus ring on Google button', foco);
    }
    ok(!p.errs.length, `${scheme} ${nome}: no errors`, p.errs.join());
    await p.context().close();
  }
  // Tela de entrada "Gestão de Treinos" fixa: igual no claro, no escuro e com qualquer estilo de cores.
  const visual = async (scheme, local) => {
    const q = await H.novaPagina(b, { logado: false, scheme, local, viewport: { width: 390, height: 844 } });
    await q.goto(H.PAGINA); await q.waitForSelector('#entrar-google:not([hidden])'); await q.waitForTimeout(300);
    const v = await q.evaluate(() => ({
      fundo: getComputedStyle(document.getElementById('tela-entrar')).backgroundColor,
      arte: getComputedStyle(document.querySelector('.entrar-arte')).backgroundImage,
      titulo: document.getElementById('entrar-titulo').textContent.trim(),
      cor: getComputedStyle(document.getElementById('entrar-status')).color,
      lema: document.querySelector('.entrar-lema').textContent.replace(/\s+/g, ' ').trim(),
    }));
    await q.screenshot({ path: `${H.SAIDA}/entrada-${scheme}-${local['bauer-estilo'] || 'padrao'}.png` });
    await q.context().close();
    return v;
  };
  const base = await visual('light', {});
  ok(base.titulo === 'Gestão de Treinos' && base.lema === 'Treine. Registre. Evolua.' && /gradient/.test(base.arte), 'entrada: Gestão de Treinos com o degradê', JSON.stringify(base));
  for (const [scheme, local] of [['dark', { 'bauer-tema': 'escuro' }], ['dark', { 'bauer-tema': 'escuro', 'bauer-estilo': 'cyber' }], ['light', { 'bauer-estilo': 'violeta' }]]) {
    const v = await visual(scheme, local);
    ok(JSON.stringify(v) === JSON.stringify(base), `entrada igual com ${scheme} ${JSON.stringify(local)}`, JSON.stringify(v));
  }
  // estados
  const c = await H.novaPagina(b, { logado: false, configurar: false });
  await c.goto(H.PAGINA); await c.waitForTimeout(400);
  ok(await c.isHidden('#entrar-google') && await c.isHidden('#entrar-privacidade') && await c.isHidden('#entrar-carga'), 'config state');
  await c.screenshot({ path: 'l-config.png' }); await c.context().close();
  const e = await H.novaPagina(b, { logado: false });
  await e.goto(H.PAGINA + '?error=server_error&error_description=Unable+to+exchange+external+code'); await e.waitForSelector('#entrar-google:not([hidden])');
  ok(await e.isVisible('#entrar-erro') && await e.isVisible('#entrar-privacidade'), 'login error state', await e.innerText('#entrar-erro'));
  await e.screenshot({ path: 'l-erro.png' }); await e.context().close();
  // carregando: segura o select dos dados
  const l = await H.novaPagina(b);
  // Atrasa a biblioteca do Supabase (falsa) para a tela ficar no estado de carregamento.
  await l.route(/\/js\/vendor\/supabase-[\d.]+\.js$/, async (r) => { await new Promise((ok) => setTimeout(ok, 1200)); r.fallback(); });
  const nav = l.goto(H.PAGINA).catch(() => {});
  await l.waitForSelector('#entrar-carga', { state: 'attached' });
  await l.evaluate(() => document.fonts.ready);
  await l.screenshot({ path: 'l-carregando.png' });
  const viu = await l.evaluate(() => new Promise((ok) => { const t = Date.now(); (function v() { const c = document.getElementById('entrar-carga'); if (c && !c.hidden) return ok(true); if (Date.now() - t > 2000) return ok(false); requestAnimationFrame(v); })(); }));
  ok(viu, 'loading bar shows while loading');
  await nav; await l.context().close();
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
