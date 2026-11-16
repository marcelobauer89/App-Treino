// Landing page do produto (conheca.html): seções, botões, abas "Para quem é", menu do Entrar (aluno ou personal), dois botões fixos no celular, claro e escuro, sem rolagem lateral e link na tela de login.
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
      const og = await p.evaluate(() => ({ img: document.querySelector('meta[property="og:image"]').content, w: document.querySelector('meta[property="og:image:width"]').content, h: document.querySelector('meta[property="og:image:height"]').content, card: document.querySelector('meta[name="twitter:card"]').content }));
      const imgOk = (await p.request.get(URL_LANDING.replace('conheca.html', 'icones/compartilhar.png'))).ok();
      ok(/\/icones\/compartilhar\.png$/.test(og.img) && og.w === '1200' && og.h === '630' && og.card === 'summary_large_image' && imgOk, `${tag}: imagem de compartilhamento 1200×630`, JSON.stringify(og));
      ok(await p.isVisible('h1') && /num só lugar\. Decisões guiadas por dados/.test(await p.textContent('h1')), `${tag}: hero com o título de tudo num só lugar e dados`);
      ok(/cada treino e cada exercício/.test(await p.textContent('.hero-sub')) && /e muito mais\.$/.test((await p.textContent('.hero-sub')).trim()), `${tag}: apoio fala de treino e exercício e deixa os tipos em aberto`);
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

      // Entrar no menu: abre as opções aluno e personal; fecha com Esc e ao clicar fora.
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(100);
      ok(await p.isHidden('#entrar-menu') && await p.getAttribute('#entrar-btn', 'aria-expanded') === 'false', `${tag}: menu do Entrar começa fechado`);
      await p.click('#entrar-btn');
      const opcoes = await p.locator('#entrar-menu a').evaluateAll((as) => as.map((a) => a.querySelector('b').textContent + '>' + a.getAttribute('href')));
      ok(await p.isVisible('#entrar-menu') && opcoes.join('|') === 'Eu treino>./|Sou personal>personal.html', `${tag}: Entrar mostra Eu treino e Sou personal`, opcoes.join('|'));
      ok(await p.evaluate(() => document.activeElement.textContent.includes('Eu treino')), `${tag}: foco vai para a primeira opção`);
      await p.keyboard.press('ArrowDown');
      ok(await p.evaluate(() => document.activeElement.textContent.includes('Sou personal')), `${tag}: seta para baixo vai para Sou personal`);
      await p.keyboard.press('Escape');
      ok(await p.isHidden('#entrar-menu') && await p.evaluate(() => document.activeElement.id) === 'entrar-btn', `${tag}: Esc fecha o menu e volta o foco`);
      await p.click('#entrar-btn'); await p.mouse.click(5, 400);
      ok(await p.isHidden('#entrar-menu'), `${tag}: clicar fora fecha o menu`);

      // Botões fixos: só no celular, assim que a página rola, e somem na chamada final.
      ok(await p.isHidden('#cta-fixo'), `${tag}: sem botões fixos no topo`);
      await p.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' })); await p.waitForTimeout(250);
      ok(nome === 'celular' ? await p.isVisible('#cta-fixo') : await p.isHidden('#cta-fixo'), `${tag}: botões fixos ${nome === 'celular' ? 'aparecem' : 'não aparecem'} ao começar a rolar`);
      if (nome === 'celular') {
        const fixos = await p.locator('#cta-fixo a').evaluateAll((as) => as.map((a) => a.textContent + '>' + a.getAttribute('href')));
        ok(fixos.join('|') === 'Começar grátis>./|Sou personal>personal.html', `${tag}: botões fixos de aluno e de personal`, fixos.join('|'));
      }
      await p.evaluate(() => document.querySelector('.final').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(250);
      ok(await p.isHidden('#cta-fixo'), `${tag}: botões fixos somem na chamada final`);

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
