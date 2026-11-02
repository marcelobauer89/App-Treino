// Admin → Convites: convites utilizados (com liberados por pedido) e excluir convites.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const dia = 864e5, agora = Date.now(), iso = (d) => new Date(agora - d * dia).toISOString();
const ADM = () => ({
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: iso(90), ultimo_acesso: iso(0), acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [], liberado: true, liberado_como: null },
    { id: 'u2', nome: 'Alessandra Machado', email: 'alessandra@exemplo.com', cadastro: iso(3), ultimo_acesso: iso(0), acessos: 3, semana: null, dias_jiu: [], sem_peso: [], liberado: true, liberado_como: 'pedido', liberado_em: iso(1) },
    { id: 'u3', nome: 'Bia Lima', email: 'bia@exemplo.com', cadastro: iso(5), ultimo_acesso: iso(2), acessos: 5, semana: null, dias_jiu: [], sem_peso: [], liberado: true, liberado_como: 'convite', liberado_em: iso(4) },
  ],
  checkins: [], eventos: [],
  convites: [
    { codigo: 'K7P2QX', nome: 'Ana', criado_em: iso(1), expira_em: iso(-6), usado_em: null, cancelado_em: null, usado_por: null },
    { codigo: 'USADO2', nome: 'Bia', criado_em: iso(6), expira_em: iso(-1), usado_em: iso(4), cancelado_em: null, usado_por: 'u3' },
    { codigo: 'VELHO3', nome: 'Caio', criado_em: iso(10), expira_em: iso(3), usado_em: null, cancelado_em: null, usado_por: null },
  ],
});
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const [scheme, vp] of [['light', { width: 375, height: 800 }], ['dark', { width: 1280, height: 900 }]]) {
    const tag = `${scheme}-${vp.width}`;
    const p = await H.novaPagina(b, { scheme, viewport: vp, extra: { admin: ADM() } });
    await p.goto(ADMIN + '#convites'); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    const ger = await txt(p, '#convites-lista'), uti = await txt(p, '#utilizados-lista');
    ok(/K7P2QX/.test(ger) && /VELHO3/.test(ger) && !/USADO2/.test(ger), `${tag}: gerados sem os usados`, ger);
    ok(/Alessandra Machado/.test(uti) && /Pedido de acesso/.test(uti) && /Bia Lima/.test(uti) && /USADO2/.test(uti), `${tag}: utilizados com convite usado e a Alessandra (pedido)`, uti);
    ok(uti.indexOf('Alessandra') < uti.indexOf('Bia Lima'), `${tag}: mais recente primeiro`);
    ok((await p.locator('#utilizados-lista .conv-item').filter({ hasText: 'Alessandra' }).locator('[data-excluir-convite]').count()) === 0, `${tag}: pedido de acesso sem lixeira`);
    ok((await p.locator('#convites-lista [data-excluir-convite]').count()) === 2 && (await p.locator('#utilizados-lista [data-excluir-convite]').count()) === 1, `${tag}: lixeira em todos os convites`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(sw, `${tag}: sem rolagem horizontal`);
    await p.screenshot({ path: `${H.SAIDA}/conv-utilizados-${tag}.png`, fullPage: true });
    // Tocar no nome abre o detalhe
    await p.click('#utilizados-lista [data-abrir-usuario="u2"]'); await p.waitForTimeout(200);
    ok(await p.locator('#detalhe').isVisible() && /Alessandra/.test(await txt(p, '#detalhe')), `${tag}: nome abre o detalhe`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    // Excluir convite usado
    await p.click('#utilizados-lista [data-excluir-convite="USADO2"]');
    ok(await p.locator('#conv-excluir-dialog').isVisible() && /continua usando o app/.test(await txt(p, '#conv-excluir-body')), `${tag}: confirmação explica que a pessoa continua`, await txt(p, '#conv-excluir-body'));
    await p.screenshot({ path: `${H.SAIDA}/conv-excluir-${tag}.png` });
    await p.click('[data-fechar-conv] >> nth=1'); await p.waitForTimeout(100);
    ok(await p.locator('#conv-excluir-dialog').isHidden() && /USADO2/.test(await txt(p, '#utilizados-lista')), `${tag}: cancelar não exclui`);
    await p.click('#utilizados-lista [data-excluir-convite="USADO2"]'); await p.click('#conv-excluir-sim'); await p.waitForTimeout(300);
    let u2 = await txt(p, '#utilizados-lista');
    ok(!/USADO2/.test(u2) && /Alessandra/.test(u2) && /Convite excluído/.test(await txt(p, '#toast')), `${tag}: convite usado excluído`, u2);
    // Excluir convite aguardando
    await p.click('#convites-lista [data-excluir-convite="K7P2QX"]');
    ok(/link para de funcionar/.test(await txt(p, '#conv-excluir-body')), `${tag}: aviso do link para convite aguardando`);
    await p.click('#conv-excluir-sim'); await p.waitForTimeout(300);
    ok(!/K7P2QX/.test(await txt(p, '#convites-lista')), `${tag}: convite aguardando excluído`);
    ok(p.errs.length === 0, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Sem a função no banco
  const s = await H.novaPagina(b, { extra: { admin: ADM(), semExcluirConvite: true } });
  await s.goto(ADMIN + '#convites'); await s.waitForSelector('#painel:not([hidden])'); await s.waitForTimeout(300);
  await s.click('#convites-lista [data-excluir-convite="K7P2QX"]'); await s.click('#conv-excluir-sim'); await s.waitForTimeout(200);
  ok(/rode de novo o supabase\/schema.sql/.test(await txt(s, '#conv-excluir-erro')) && /K7P2QX/.test(await txt(s, '#convites-lista')), 'sem a função: erro amigável e nada some');
  // Liberar um pedido passa a aparecer em utilizados
  const adm = ADM(); adm.usuarios.push({ id: 'u4', nome: 'Davi Rocha', email: 'davi@exemplo.com', cadastro: iso(0), ultimo_acesso: iso(0), acessos: 1, semana: null, dias_jiu: [], sem_peso: [], liberado: false, acesso_pedido_em: iso(0) });
  const l = await H.novaPagina(b, { extra: { admin: adm } });
  await l.goto(ADMIN + '#convites'); await l.waitForSelector('#painel:not([hidden])'); await l.waitForTimeout(300);
  await l.click('[data-liberar="u4"]'); await l.waitForTimeout(500);
  ok(/Davi Rocha/.test(await txt(l, '#utilizados-lista')), 'liberar um pedido aparece em utilizados', await txt(l, '#utilizados-lista'));
  ok(s.errs.length === 0 && l.errs.length === 0, 'sem erros', s.errs.concat(l.errs).join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
