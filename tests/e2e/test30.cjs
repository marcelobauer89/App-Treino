// Resumo semanal por e-mail: interruptor em Você → Conta e volta do link de descadastro.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const perfil = async (p) => (await H.banco(p)).perfis.find((x) => x.id === 'u1');
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    await p.goto(H.PAGINA + '#voce/notificacoes'); await H.prontos(p);
    const chave = p.locator('#resumo-email');
    ok(await chave.isVisible() && await chave.isChecked(), `${scheme}: ligado por padrão (perfil sem a coluna = ligado)`);
    ok((await p.locator('.resumo-email-linha').innerText()).includes('Toda sexta, às 9h'), `${scheme}: texto explica quando chega`);
    ok(await chave.getAttribute('role') === 'switch' && (await p.getByRole('switch', { name: /Resumo semanal por e-mail/ }).count()) === 1, `${scheme}: nome acessível`);
    await p.locator('.resumo-email-linha').click(); await p.waitForTimeout(150);
    ok(!(await chave.isChecked()) && (await perfil(p)).emails_resumo === false, `${scheme}: desligar salva`);
    ok((await p.locator('#toast').innerText()).includes('não vai mais receber'), `${scheme}: toast ao desligar`);
    await p.screenshot({ path: `resumo-${scheme}.png` });
    await p.reload(); await H.prontos(p);
    ok(!(await p.locator('#resumo-email').isChecked()), `${scheme}: continua desligado ao recarregar`);
    await p.locator('.resumo-email-linha').click(); await p.waitForTimeout(150);
    ok((await perfil(p)).emails_resumo === true && (await p.locator('#toast').innerText()).includes('toda sexta'), `${scheme}: religar salva`);
    await p.waitForTimeout(100);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0 && p.errs.length === 0, `${scheme}: sem rolagem e sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // banco sem a coluna
  let p = await H.novaPagina(b, { extra: { semColunaEmailsResumo: true } });
  await p.goto(H.PAGINA + '#voce/notificacoes'); await H.prontos(p);
  await p.locator('.resumo-email-linha').click(); await p.waitForTimeout(200);
  ok((await p.locator('#toast').innerText()).includes('rode de novo o supabase/schema.sql'), 'sem coluna: aviso para rodar o schema', await p.locator('#toast').innerText());
  await p.context().close();
  // volta do link de descadastro
  p = await H.novaPagina(b, { extra: { perfis: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], emails_resumo: false }] } });
  await p.goto(H.PAGINA + '?resumo=desligado'); await H.prontos(p);
  ok((await p.locator('#toast').innerText()).includes('não vai mais receber o resumo semanal'), 'volta do descadastro mostra aviso');
  ok(!(await p.evaluate(() => location.search)).includes('resumo'), 'limpa o parâmetro da barra de endereço');
  await H.voce(p, 'notificacoes');
  ok(!(await p.locator('#resumo-email').isChecked()), 'interruptor aparece desligado');
  ok(p.errs.length === 0, 'sem erros', p.errs.join(' | '));
  await p.context().close();
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
