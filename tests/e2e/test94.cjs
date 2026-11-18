// Topo do painel (admin.html): carregamento dentro da margem, foto e nome parados enquanto carrega e barra fixa ao rolar no celular.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ADM = {
  ids: ['u1'], atraso: 800,
  usuarios: [{ id: 'u1', nome: 'Pessoa Exemplo', email: 'pessoa@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 4, semana: null, dias_jiu: [], sem_peso: [] }],
  checkins: [], eventos: [],
};
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();

  for (const [scheme, estilo] of [['light', null], ['dark', 'gelo']]) {
    const tag = `${scheme}${estilo ? '-' + estilo : ''}`;
    const p = await H.novaPagina(b, { scheme, viewport: { width: 375, height: 760 }, local: estilo ? { 'bauer-estilo': estilo } : {}, extra: { admin: ADM } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(ADMIN);
    await p.waitForSelector('.estado.carregando');
    await p.evaluate(() => document.fonts.ready);
    const medir = () => p.evaluate(() => {
      const a = document.getElementById('topo-avatar').getBoundingClientRect();
      const n = document.getElementById('topo-nome').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.estado .esq-card, .estado .esq-kpis, .estado .esq-abas')].map((e) => e.getBoundingClientRect());
      return { av: Math.round(a.top), avH: Math.round(a.height), nome: Math.round(n.top), sw: document.documentElement.scrollWidth - innerWidth,
        dentro: cards.every((r) => r.left >= 15 && r.right <= innerWidth - 15) };
    });
    const antes = await medir();
    ok(antes.sw <= 0, `${tag}: carregando sem rolagem horizontal`, String(antes.sw));
    ok(antes.dentro, `${tag}: cartões do carregamento dentro da margem`);
    ok(antes.avH > 0, `${tag}: foto (ou iniciais) já no topo enquanto carrega`);
    await p.waitForSelector('#painel:not([hidden])');
    await p.waitForTimeout(150);
    const depois = await medir();
    ok(depois.av === antes.av && depois.nome === antes.nome, `${tag}: foto e nome não mudam de lugar ao terminar de carregar`, JSON.stringify([antes, depois]));
    ok(/Administrador/.test(await p.locator('#topo-sub').innerText()), `${tag}: linha Administrador depois de confirmado`);

    // Barra fixa: escondida no alto, aparece ao rolar (foto, nome e Menu), abre a gaveta e some ao voltar ao topo.
    ok(!(await p.locator('#barra-fixa').evaluate((e) => e.classList.contains('visivel'))), `${tag}: barra fixa escondida no alto da página`);
    await p.mouse.wheel(0, 900); await p.waitForTimeout(300);
    const barra = await p.locator('#barra-fixa').evaluate((e) => ({ vis: e.classList.contains('visivel'), top: Math.round(e.getBoundingClientRect().top), nome: document.getElementById('barra-nome').textContent, av: document.getElementById('barra-avatar').textContent,
      topoNome: document.getElementById('topo-nome').textContent, topoAv: document.getElementById('topo-avatar').textContent }));
    ok(barra.vis && barra.top === 0, `${tag}: barra fixa no alto ao rolar`, JSON.stringify(barra));
    ok(barra.nome && barra.nome === barra.topoNome && barra.av && barra.av === barra.topoAv, `${tag}: barra com o mesmo nome e as mesmas iniciais do topo`, JSON.stringify(barra));
    await p.click('#menu-abrir-fixo'); await p.waitForTimeout(200);
    ok(await p.locator('#menu').evaluate((e) => e.classList.contains('aberto')), `${tag}: Menu da barra abre a gaveta`);
    ok(await p.locator('#menu-abrir-fixo').getAttribute('aria-expanded') === 'true', `${tag}: aria-expanded no Menu da barra`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.id) === 'menu-abrir-fixo', `${tag}: foco volta para o Menu da barra`);
    await p.mouse.wheel(0, -3000); await p.waitForTimeout(300);
    ok(!(await p.locator('#barra-fixa').evaluate((e) => e.classList.contains('visivel'))), `${tag}: barra fixa some ao voltar ao topo`);
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.screenshot({ path: `${H.SAIDA}/test94-${tag}.png` }).catch(() => {});
    await p.context().close();
  }

  // Computador: o menu fica à esquerda e a barra fixa não aparece.
  const p = await H.novaPagina(b, { viewport: { width: 1280, height: 800 }, extra: { admin: { ...ADM, atraso: 5 } } });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
  await p.mouse.wheel(0, 900); await p.waitForTimeout(300);
  ok(await p.locator('#barra-fixa').isHidden(), 'computador: sem barra fixa');
  ok(await p.locator('#menu-abrir').isHidden(), 'computador: sem botão Menu');
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
