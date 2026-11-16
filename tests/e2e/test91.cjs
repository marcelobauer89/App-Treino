// Landing page do produto (conheca.html): seções, botões, abas "Para quem é", botão fixo no celular, claro e escuro, sem rolagem lateral e link na tela de login.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const URL_LANDING = H.PAGINA.replace('index.html', 'conheca.html');

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    for (const [nome, viewport] of [['celular', { width: 375, height: 760 }], ['computador', { width: 1280, height: 800 }]]) {
      const tag = `${scheme}/${nome}`;
      const ctx = await b.newContext({ viewport, colorScheme: scheme });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      await p.addInitScript(() => { window.__violacoes = []; document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`)); });
      await p.goto(URL_LANDING); await p.waitForLoadState('load');

      ok(/Gestão de Treinos/.test(await p.title()), `${tag}: título com o nome do produto`);
      ok(await p.isVisible('h1'), `${tag}: hero visível`);
      for (const id of ['problema', 'como-funciona', 'funcionalidades', 'para-quem', 'personal', 'depoimentos', 'planos', 'duvidas']) ok(await p.locator('#' + id).count() === 1, `${tag}: seção ${id}`);
      ok(await p.getAttribute('#cta-hero', 'href') === './' && /Começar grátis/.test(await p.textContent('#cta-hero')), `${tag}: botão principal leva ao app`);
      ok(await p.locator('a[href="personal.html"]').count() >= 2, `${tag}: links para a área do personal`);
      ok(await p.locator('a[href="privacidade.html"]').count() >= 1, `${tag}: link para a Política de Privacidade`);
      ok(await p.locator('.semana-dias .dia').count() === 7, `${tag}: semana com 7 dias`);
      ok(/ilustrativos/.test(await p.textContent('.dep-nota')), `${tag}: depoimentos marcados como exemplo`);
      const esportes = await p.locator('ol.esportes li').allTextContents();
      ok(esportes.map((e) => e.trim()).join('|') === 'Musculação|Jiu Jitsu|Muay thai|Surf|Futebol|Futvôlei|Cardio' && await p.locator('ol.esportes li svg').count() === 7, `${tag}: Tudo junto lista os 7 esportes em ordem, cada um com ícone`, esportes.join('|'));
      ok(await p.locator('.passos > li').count() === 5 && /Decida com base nos dados/.test(await p.textContent('.passos > li:last-child')), `${tag}: etapa final de decisão com base nos dados`);
      ok(await p.locator('.mini-ind > div').count() === 4 && !(await p.locator('.mini-cal').count()), `${tag}: Dashboard com indicadores de exemplo, sem o calendário`);
      const duvidas = await p.locator('#duvidas summary').allTextContents();
      ok(duvidas.includes('Que treinos e esportes o app acompanha?') && !duvidas.some((d) => /Jiu Jitsu/.test(d)), `${tag}: dúvida abrangente sobre treinos e esportes`, duvidas.join('|'));
      const planos = await p.locator('.plano h3').allTextContents();
      ok(planos.join('|') === 'Atleta|Personal Start|Personal Pro|Academia e equipe', `${tag}: quatro planos`, planos.join('|'));
      ok(/R\$ 29,90/.test(await p.textContent('.plano-destaque')), `${tag}: preço do Personal Pro`);
      const larg = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      ok(larg[0] <= larg[1], `${tag}: sem rolagem para o lado`, larg.join('>'));
      const fundo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(scheme === 'dark' ? fundo === 'rgb(15, 17, 21)' : fundo === 'rgb(243, 244, 246)', `${tag}: fundo do tema`, fundo);

      // Abas "Para quem é": clique e setas do teclado.
      await p.click('#aba-personal');
      ok(await p.isVisible('#painel-personal') && await p.isHidden('#painel-atleta') && await p.getAttribute('#aba-personal', 'aria-selected') === 'true', `${tag}: aba Personal trainer abre o painel`);
      await p.focus('#aba-personal'); await p.keyboard.press('ArrowRight');
      ok(await p.isVisible('#painel-aluno') && await p.evaluate(() => document.activeElement.id) === 'aba-aluno', `${tag}: seta para a direita vai para Aluno de personal`);
      await p.keyboard.press('ArrowRight');
      ok(await p.isVisible('#painel-atleta'), `${tag}: seta volta para a primeira aba`);

      // Dúvidas abrem e fecham.
      await p.click('#duvidas summary >> nth=0');
      ok(await p.locator('#duvidas details >> nth=0').evaluate((d) => d.open), `${tag}: dúvida abre`);

      // Botão fixo: só no celular, depois do hero e antes da chamada final.
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(150);
      ok(await p.isHidden('#cta-fixo'), `${tag}: sem botão fixo no topo`);
      await p.evaluate(() => document.getElementById('funcionalidades').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(250);
      ok(nome === 'celular' ? await p.isVisible('#cta-fixo') : await p.isHidden('#cta-fixo'), `${tag}: botão fixo ${nome === 'celular' ? 'aparece' : 'não aparece'} ao rolar`);
      await p.evaluate(() => document.querySelector('.final').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(250);
      ok(await p.isHidden('#cta-fixo'), `${tag}: botão fixo some na chamada final`);

      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await p.screenshot({ path: `${H.SAIDA}/test91-${scheme}-${nome}.png` });
      const v = await p.evaluate(() => window.__violacoes);
      ok(!v.length, `${tag}: nenhuma violação de CSP`, v.join(' | '));
      ok(!errs.length, `${tag}: sem erros`, errs.join(' | '));
      await ctx.close();
    }
  }

  // Tela de login do app: link para conhecer o produto.
  const l = await H.novaPagina(b, { logado: false });
  await l.goto(H.PAGINA); await l.waitForSelector('#entrar-conheca:not([hidden])');
  ok(await l.getAttribute('#entrar-conheca a', 'href') === 'conheca.html', 'login: link "Conheça o Gestão de Treinos"');

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
