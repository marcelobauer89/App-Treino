// Ícone de informação dos números principais (admin.html).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ADM = {
  ids: ['u1'],
  usuarios: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] }],
  checkins: [], eventos: [],
};
// RF-69: Aderência ao plano e Usuários ativos vêm primeiro (em destaque).
const ESPERADO = [/semana montada em Você/, /abriram o app ou fizeram check-in/, /Total de check-ins/, /check-ins do período ÷ usuários ativos ÷ semanas/, /entre 8 e 14 dias atrás/, /não abriram nem registraram nada nos últimos 7 dias/, /superou o próprio peso máximo/];
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: new Date('2026-10-21T15:00:00') });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    const botoes = p.locator('#kpis .info');
    ok(await botoes.count() === 7, `${tag}: 7 ícones`);
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: balões começam fechados`);
    const alvo = await botoes.first().evaluate((b) => { const r = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after'); return r.width - parseFloat(a.left) - parseFloat(a.right); });
    ok(alvo >= 44, `${tag}: área de toque ≥ 44 px`, String(alvo));
    for (let i = 0; i < 7; i += 1) {
      await botoes.nth(i).click();
      const balao = p.locator(`#info-k${i + 1}`);
      const t = await balao.innerText();
      ok(await balao.isVisible() && ESPERADO[i].test(t), `${tag}: balão ${i + 1} explica`, t.slice(0, 60));
      ok(await botoes.nth(i).getAttribute('aria-expanded') === 'true' && await p.locator('.info-txt:not([hidden])').count() === 1, `${tag}: só um aberto`);
      const r = await balao.boundingBox();
      const kr = await p.locator('#kpis').boundingBox();
      ok(r.x >= 0 && r.x + r.width <= Math.min(viewport.width - 16, kr.x + kr.width) + 0.5, `${tag}: balão ${i + 1} dentro da tela`, `${Math.round(r.x)}..${Math.round(r.x + r.width)}`);
      if (i === 1 || i === 4) await p.screenshot({ path: `info-${tag}-${i + 1}.png` });
      if (i < 6) { await p.keyboard.press('Escape'); }
    }
    // tocar no balão fecha
    await botoes.nth(3).click(); await p.locator('#info-k4').click();
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: tocar no balão fecha`);
    await botoes.nth(1).click();
    ok((await p.locator('#info-k2').innerText()).includes('compara com os 30 dias anteriores'), `${tag}: texto cita o período`);
    // fecha tocando fora
    await p.mouse.click(5, 5);
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: fecha ao tocar fora`);
    // tocar de novo fecha
    await botoes.nth(2).click(); await botoes.nth(2).click();
    ok(await p.locator('.info-txt:not([hidden])').count() === 0, `${tag}: tocar de novo fecha`);
    // Esc fecha e devolve o foco
    await botoes.nth(0).click(); await p.keyboard.press('Escape');
    ok(await p.locator('.info-txt:not([hidden])').count() === 0 && await botoes.nth(0).evaluate((b) => b === document.activeElement), `${tag}: Esc fecha e devolve o foco`);
    // Tudo
    await p.click('[data-periodo="tudo"]');
    await p.locator('#kpis .info').first().click();
    ok((await p.locator('#info-k1').innerText()).includes('No período Tudo não há comparação'), `${tag}: texto do Tudo`);
    ok((await p.locator('#kpis .kpi').first().innerText()).indexOf('null') < 0, `${tag}: sem null`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0, `${tag}: sem rolagem horizontal`, String(sw));
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
