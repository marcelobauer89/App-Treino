// Você em lista (como os Ajustes do celular): perfil no topo, grupos de opções e uma tela para cada.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 390, height: 844 }], ['dark', { width: 390, height: 844 }], ['dark', { width: 1280, height: 900 }]]) {
    const tag = `${scheme}-${vp.width}`;
    const p = await H.novaPagina(b, { scheme, viewport: vp });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await p.click('.nav [data-tela="voce"]'); await p.waitForTimeout(150);
    ok(await p.locator('#voce-menu').isVisible() && (await p.locator('.voce-pagina:not([hidden])').count()) === 0, `${tag}: Você abre na lista`);
    ok((await txt(p, '#voce-menu-nome')) === 'Marcelo Bauer' && (await txt(p, '#voce-menu-email')) === 'marcelo@exemplo.com' && (await txt(p, '#voce-menu-avatar')) === 'MB', `${tag}: perfil no topo com foto, nome e e-mail`);
    // "Instalar o app" (#grupo-instalar) só aparece quando o navegador oferece a instalação: fica fora desta conta (test84).
    const rotulos = await p.locator('.voce-grupo:not(#grupo-instalar) .voce-linha .voce-rotulo').allInnerTexts();
    ok(rotulos.join('|') === 'Meus treinos|Minha semana|Meu personal|Aparência|Temporizador|Notificações|Privacidade|Sair da conta|Excluir conta', `${tag}: opções em grupos`, rotulos.join('|'));
    ok((await p.locator('.voce-grupo:not(#grupo-instalar)').count()) === 3, `${tag}: 3 grupos`);
    ok((await txt(p, '#valor-treinos')) === 'Plano pronto' && (await txt(p, '#valor-semana')) === '6 atividades' && (await txt(p, '#valor-aparencia')) === 'Automático' && (await txt(p, '#valor-notificacoes')) === 'Resumo ligado', `${tag}: valor à direita de cada opção`);
    ok((await p.locator('.voce-grupo:not(#grupo-instalar) .voce-linha:not(.perigo) .voce-chev').count()) === 7 && (await p.locator('.voce-grupo:not(#grupo-instalar) .voce-linha .voce-ic').count()) === 9, `${tag}: ícone e seta nas linhas`);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('sair')).color) !== await p.evaluate(() => getComputedStyle(document.querySelector('[data-voce="semana"]')).color), `${tag}: Sair em vermelho`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: sem rolagem horizontal`);
    {
      const alt = await p.locator('.voce-linha').first().boundingBox();
      ok(alt.height >= 56, `${tag}: linhas com 56 px de altura`);
    }
    await p.waitForTimeout(200); await p.screenshot({ path: `${H.SAIDA}/voce-menu-${tag}.png`, fullPage: true });
    // Abrir cada opção e voltar
    for (const [pag, titulo, campo] of [['dados', 'Dados pessoais', '#p-nome'], ['aparencia', 'Aparência', '#opcoes-tema'], ['treinos', 'Meus treinos', '#editar-treinos'], ['semana', 'Minha semana', '#dias-cfg'], ['temporizador', 'Temporizador', '#temp-ativo'], ['notificacoes', 'Notificações', '#resumo-email'], ['privacidade', 'Privacidade', '#conta-email']]) {
      await p.click(`[data-voce="${pag}"]`); await p.waitForTimeout(100);
      ok(await p.evaluate(() => location.hash) === `#voce/${pag}` && (await txt(p, `#pag-${pag}-titulo`)) === titulo && await p.locator(campo).isVisible() && await p.locator('#voce-menu').isHidden(), `${tag}: ${titulo} abre a própria tela`);
      await p.click(`.voce-pagina[data-pagina="${pag}"] [data-voltar]`); await p.waitForTimeout(150);
      ok(await p.locator('#voce-menu').isVisible() && await p.evaluate(() => location.hash) === '#voce', `${tag}: "‹ Você" volta para a lista`);
    }
    // Voltar do navegador / celular
    await p.click('[data-voce="aparencia"]'); await p.waitForTimeout(100);
    await p.locator('#opcoes-tema label', { hasText: 'Escuro' }).click(); await H.gravacoes(p);
    await p.goBack(); await p.waitForTimeout(150);
    ok(await p.locator('#voce-menu').isVisible() && (await txt(p, '#valor-aparencia')) === 'Escuro', `${tag}: voltar do navegador volta para a lista, com o valor atualizado`);
    // Aba Você a partir de uma opção volta para a lista
    await p.click('[data-voce="notificacoes"]'); await p.waitForTimeout(100);
    await p.locator('.resumo-email-linha').click(); await H.gravacoes(p);
    await p.click('.nav [data-tela="voce"]'); await p.waitForTimeout(150);
    ok(await p.locator('#voce-menu').isVisible() && (await txt(p, '#valor-notificacoes')) === 'Desligadas', `${tag}: tocar em Você na barra volta para a lista`);
    // Link direto
    await p.goto(H.PAGINA + '#voce/semana'); await H.prontos(p); await p.waitForTimeout(150);
    ok(await p.locator('#dias-cfg').isVisible(), `${tag}: link direto para uma opção`);
    await p.click('.voce-pagina[data-pagina="semana"] [data-voltar]'); await p.waitForTimeout(150);
    ok(await p.locator('#voce-menu').isVisible(), `${tag}: voltar de um link direto vai para a lista`);
    await p.click('[data-voce="semana"]'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${H.SAIDA}/voce-semana-${tag}.png` });
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
