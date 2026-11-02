// Painel: carregamento com esqueleto, etapas, entrada em cascata, botão Atualizar girando e movimento reduzido.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const usuario = (id, nome) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-29T10:00:00Z', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true });
const ADM = (atraso) => ({ ids: ['u1'], atraso, usuarios: [usuario('u1', 'Marcelo'), usuario('u2', 'Ana')], checkins: [{ usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-28T19:00:00', fim: '2026-10-28T20:00:00' }], eventos: [], emails: [], convites: [] });
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM(1200) } });
    const etapas = [];
    await p.exposeFunction('anotar', (t) => etapas.push(t));
    await p.addInitScript(() => {
      new MutationObserver(() => { const e = document.getElementById('esq-etapa'); if (e && window.__ult !== e.textContent) { window.__ult = e.textContent; window.anotar(e.textContent); } })
        .observe(document, { subtree: true, childList: true, characterData: true });
    });
    await p.goto(ADMIN);
    await p.waitForSelector('#estado.carregando .esq', { timeout: 5000 });
    ok(await p.locator('#estado').getAttribute('aria-busy') === 'true' && await p.locator('.esq').getAttribute('aria-hidden') === 'true', `${tag}: esqueleto com aria-busy e blocos escondidos do leitor`);
    ok((await p.locator('.esq-barras i').count()) === 24 && (await p.locator('.esq-card').count()) >= 7, `${tag}: KPIs, gráficos com barras e lista no molde`);
    const larg = await p.evaluate(() => [document.querySelector('.esq').getBoundingClientRect().width, document.getElementById('estado').getBoundingClientRect().width]);
    ok(Math.abs(larg[0] - larg[1]) < 2, `${tag}: esqueleto ocupa a largura toda`, larg.join(' / '));
    const anim = await p.locator('.esq-barras i').first().evaluate((e) => getComputedStyle(e).animationName);
    ok(anim === 'barra', `${tag}: barras animadas`, anim);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${H.SAIDA}/carregando-${tag}.png` });
    await p.waitForSelector('#painel:not([hidden])', { timeout: 8000 });
    ok(etapas.join(' > ') === 'Conferindo seu acesso… > Buscando usuários, check-ins e e-mails… > Montando os gráficos…', `${tag}: etapas na ordem`, etapas.join(' > '));
    ok(await p.locator('#painel').evaluate((e) => e.classList.contains('entra')) && (await p.locator('#painel .entra-item').count()) >= 5, `${tag}: painel entra em cascata`, String(await p.locator('#painel .entra-item').count()));
    ok(await p.locator('#estado').isHidden() && !(await p.locator('#estado').getAttribute('aria-busy')), `${tag}: esqueleto some`);
    await p.waitForTimeout(150); await p.screenshot({ path: `${H.SAIDA}/entrando-${tag}.png` });
    await p.waitForTimeout(1200);
    ok(!(await p.locator('#painel.entra, #painel .entra-item').count()), `${tag}: cascata termina e limpa as classes`);
    // Atualizar: ícone gira, sem esqueleto
    await p.click('#atualizar'); await p.waitForTimeout(200);
    ok(await p.locator('#atualizar').evaluate((e) => e.classList.contains('girando')) && await p.locator('#estado').isHidden() && await p.locator('#painel').isVisible(), `${tag}: Atualizar gira o ícone e mantém o painel`);
    await p.waitForTimeout(1500);
    ok(!(await p.locator('#atualizar').evaluate((e) => e.classList.contains('girando'))) && !(await p.locator('#painel.entra').count()), `${tag}: depois de atualizar, para de girar e não refaz a cascata`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Movimento reduzido: nada anima
  {
    const p = await H.novaPagina(b, { extra: { admin: ADM(800) } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(ADMIN); await p.waitForSelector('#estado.carregando .esq');
    const a = await p.locator('.esq-barras i').first().evaluate((e) => getComputedStyle(e).animationName);
    const brilho = await p.locator('.esq-b').first().evaluate((e) => getComputedStyle(e, '::after').animationName);
    ok(a === 'none' && brilho === 'none', 'movimento reduzido: esqueleto parado', `${a}/${brilho}`);
    await p.waitForSelector('#painel:not([hidden])');
    const k = await p.locator('#painel .abas').evaluate((e) => getComputedStyle(e).animationName);
    ok(k === 'none', 'movimento reduzido: sem cascata', k);
    await p.context().close();
  }
  // Login e acesso restrito: sem esqueleto
  {
    let p = await H.novaPagina(b, { logado: false, extra: { admin: ADM(5) } });
    await p.goto(ADMIN); await p.waitForTimeout(500);
    ok((await p.locator('#entrar').count()) === 1 && !(await p.locator('.esq').count()), 'sem login: botão Entrar, sem esqueleto');
    await p.context().close();
    p = await H.novaPagina(b, { extra: { admin: { ...ADM(5), ids: ['outro'] } } });
    await p.goto(ADMIN); await p.waitForTimeout(500);
    ok(/Acesso restrito/.test(await p.locator('#estado').innerText()) && !(await p.locator('.esq').count()) && !(await p.locator('#estado').getAttribute('aria-busy')), 'acesso restrito: sem esqueleto');
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
