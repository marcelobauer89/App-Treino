// Convites: só entra quem foi convidado (link ?convite=), tela de convidados, pedir acesso e aba Convites no painel.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const dia = 864e5;
const CONVITES = () => [
  { codigo: 'K7P2QX', nome: 'Ana', criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 7 * dia).toISOString(), usado_em: null, cancelado_em: null },
  { codigo: 'USADO2', nome: 'Bia', criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 7 * dia).toISOString(), usado_em: new Date().toISOString(), cancelado_em: null, usado_por: 'outro' },
  { codigo: 'VELHO3', nome: 'Caio', criado_em: new Date(Date.now() - 9 * dia).toISOString(), expira_em: new Date(Date.now() - 2 * dia).toISOString(), usado_em: null, cancelado_em: null },
];
const NOVO = { id: 'u1', nome: 'Ana Souza', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], liberado: false, acesso_pedido_em: null };
async function abrirApp(b, { url = H.PAGINA, perfil = NOVO, local = {}, scheme = 'light', vp = { width: 390, height: 844 }, extra = {} } = {}) {
  const p = await H.novaPagina(b, { scheme, viewport: vp, local, extra: { perfis: [{ ...perfil }], convites: CONVITES(), ...extra } });
  await p.goto(url); await p.waitForTimeout(400);
  return p;
}
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    // Sem convite: tela de convidados
    let p = await abrirApp(b, { scheme });
    ok(await p.locator('#convite-form').isVisible() && /só para convidados/.test(await txt(p, '#entrar-status')) && await p.locator('.nav').isHidden(), `${scheme}: sem convite vê a tela de convidados e não o app`);
    await p.screenshot({ path: `${H.SAIDA}/convite-tela-${scheme}.png` });
    // Código errado, expirado, usado
    for (const [cod, re] of [['ABC', /Não encontramos/], ['velho3', /expirou/], ['USADO2', /já foi usado/]]) {
      await p.fill('#convite-codigo', cod); await p.click('#convite-usar'); await p.waitForTimeout(150);
      ok(re.test(await txt(p, '#convite-erro')), `${scheme}: código ${cod} mostra o motivo`, await txt(p, '#convite-erro'));
    }
    // Pedir acesso
    await p.click('#convite-pedir'); await p.waitForTimeout(150);
    ok(/Pedido de acesso enviado/.test(await txt(p, '#convite-pedido')) && await p.locator('#convite-pedir').isHidden() && !!(await H.banco(p)).perfis[0].acesso_pedido_em, `${scheme}: pedir acesso grava e mostra a confirmação`);
    await p.reload(); await p.waitForTimeout(400);
    ok(/Pedido de acesso enviado/.test(await txt(p, '#convite-pedido')), `${scheme}: ao reabrir, continua mostrando o pedido enviado`);
    await p.screenshot({ path: `${H.SAIDA}/convite-pedido-${scheme}.png` });
    // Código certo digitado (minúsculo, com espaço)
    await p.fill('#convite-codigo', ' k7p2qx '); await p.click('#convite-usar'); await H.prontos(p); await p.waitForTimeout(300);
    let db = await H.banco(p);
    ok(db.perfis[0].liberado === true && db.convites[0].usado_em && await p.locator('.nav').isVisible(), `${scheme}: código certo libera e abre o app`);
    ok(/Convite aceito/.test(await txt(p, '#toast')), `${scheme}: aviso "Convite aceito"`);
    await p.context().close();
    // Link com convite: guarda, faz login e usa sozinho
    p = await H.novaPagina(b, { scheme, logado: false, extra: { convites: CONVITES() } });
    await p.goto(H.PAGINA + '?convite=K7P2QX'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => location.search)).includes('convite') && await p.evaluate(() => localStorage.getItem('bauer-convite')) === 'K7P2QX', `${scheme}: link guarda o convite e limpa a barra de endereço`);
    ok(/Você foi convidado/.test(await txt(p, '#entrar-status')), `${scheme}: tela de entrada diz que a pessoa foi convidada`);
    await p.screenshot({ path: `${H.SAIDA}/convite-entrada-${scheme}.png` });
    // simula a volta do Google com a conta nova (bloqueada)
    await p.evaluate((perfil) => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.sessao = { user: { id: 'u1', email: 'ana@exemplo.com', user_metadata: { full_name: 'Ana Souza' } } }; d.perfis = [perfil]; localStorage.setItem('mock-supabase', JSON.stringify(d)); }, NOVO);
    await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
    db = await H.banco(p);
    ok(db.perfis[0].liberado === true && db.convites[0].usado_por === 'u1' && await p.evaluate(() => !localStorage.getItem('bauer-convite')), `${scheme}: depois do login o convite é usado sozinho`);
    await p.context().close();
    // Link com convite já usado
    p = await abrirApp(b, { scheme, local: { 'bauer-convite': 'USADO2' } });
    ok(await p.locator('#convite-form').isVisible() && /já foi usado/.test(await txt(p, '#convite-erro')), `${scheme}: convite usado leva à tela com o motivo`);
    await p.context().close();
    // Usuário antigo (liberado) entra direto; admin bloqueado entra direto
    p = await abrirApp(b, { scheme, perfil: { ...NOVO, liberado: true } }); await H.prontos(p);
    ok(await p.locator('.nav').isVisible(), `${scheme}: quem já usa entra direto`);
    await p.context().close();
    p = await abrirApp(b, { scheme, extra: { admin: { ids: ['u1'] } } }); await H.prontos(p);
    ok(await p.locator('.nav').isVisible(), `${scheme}: administrador entra direto`);
    // Banco antigo (sem a coluna): entra como antes
    await p.context().close();
    p = await abrirApp(b, { scheme, perfil: { id: 'u1', nome: 'X', email: 'x@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], liberado: undefined } }); await H.prontos(p);
    ok(await p.locator('.nav').isVisible(), `${scheme}: sem a coluna no banco, entra como antes`);
    // Sair na tela de convidados
    await p.context().close();
    p = await abrirApp(b, { scheme });
    await p.click('#convite-sair'); await p.waitForSelector('#entrar-google:not([hidden])', { timeout: 4000 }).catch(() => {});
    ok(await p.locator('#entrar-google').isVisible(), `${scheme}: Sair volta para a entrada`);
    ok(!p.errs.length, `${scheme}: app sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // ---------- Painel ----------
  const ADM = () => ({
    ids: ['u1'],
    usuarios: [
      { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [], liberado: true },
      { id: 'u2', nome: 'Ana Souza', email: 'ana@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-21T12:00:00Z', acessos: 12, semana: null, dias_jiu: [2, 4], sem_peso: [], liberado: true },
      { id: 'u3', nome: 'Bruno Lima', email: 'bruno@exemplo.com', cadastro: '2026-10-20T12:00:00Z', ultimo_acesso: '2026-10-20T12:00:00Z', acessos: 1, semana: null, dias_jiu: [], sem_peso: [], liberado: false, acesso_pedido_em: new Date().toISOString() },
      { id: 'u4', nome: 'Caio Melo', email: 'caio@exemplo.com', cadastro: '2026-10-20T12:00:00Z', ultimo_acesso: null, acessos: 1, semana: null, dias_jiu: [], sem_peso: [], liberado: false, acesso_pedido_em: null },
    ],
    checkins: [], eventos: [], convites: [{ codigo: 'USADO2', nome: 'Ana', criado_em: '2026-10-10T12:00:00Z', expira_em: '2026-10-17T12:00:00Z', usado_em: '2026-10-11T12:00:00Z', cancelado_em: null, usado_por: 'u2' }],
    proximoCodigo: ['K7P2QX', 'M3N4P5'],
  });
  for (const [scheme, vp] of [['light', { width: 1280, height: 900 }], ['dark', { width: 390, height: 844 }]]) {
    const a = await H.novaPagina(b, { scheme, viewport: vp, extra: { admin: ADM() } });
    await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
    ok((await txt(a, '#alerta-convites')) === '1' && await a.locator('#alerta-convites').isVisible(), `${scheme}: selo com 1 pedido na aba Convites`);
    await a.click('#tab-convites'); await a.waitForTimeout(200);
    ok(/Bruno Lima/.test(await txt(a, '#pedidos-lista')) && !/Caio/.test(await txt(a, '#pedidos-lista')), `${scheme}: pedidos de acesso listados`);
    ok(/Ana Souza/.test(await txt(a, '#utilizados-lista')), `${scheme}: convite usado mostra quem usou`);
    await a.fill('#conv-nome', 'João'); await a.click('#conv-gerar'); await a.waitForTimeout(300);
    const link = await a.inputValue('#conv-link');
    ok(/\/\?convite=K7P2QX$/.test(link) && /João/.test(await txt(a, '#conv-gerado')), `${scheme}: gerar convite mostra o link`, link);
    const wa = decodeURIComponent((await a.getAttribute('#conv-whats', 'href')).split('text=')[1]);
    ok(/^Oi, João! Te convidei para o OSS/.test(wa) && wa.includes(link), `${scheme}: WhatsApp com mensagem e link`);
    ok(/João K7P2QX Aguardando/.test(await txt(a, '#convites-lista')), `${scheme}: convite novo aparece aguardando`, await txt(a, '#convites-lista'));
    await a.screenshot({ path: `${H.SAIDA}/convites-admin-${scheme}-${vp.width}.png`, fullPage: true });
    await a.click('[data-cancelar-convite="K7P2QX"]'); await a.waitForTimeout(300);
    ok(/João K7P2QX Cancelado/.test(await txt(a, '#convites-lista')), `${scheme}: cancelar convite`);
    await a.click('#pedidos-lista [data-liberar="u3"]'); await a.waitForTimeout(500);
    let db = await H.banco(a);
    ok(db.admin.usuarios.find((u) => u.id === 'u3').liberado === true && /Nenhum pedido/.test(await txt(a, '#pedidos-lista')) && await a.locator('#alerta-convites').isHidden(), `${scheme}: liberar pedido`);
    // Usuários: situação Bloqueado e bloquear/liberar no detalhe
    await a.click('#tab-usuarios'); await a.waitForTimeout(200);
    ok(/Bloqueado/.test(await txt(a, '#usuarios-corpo tr[data-usuario="u4"]')), `${scheme}: situação Bloqueado na lista`);
    await a.click('#usuarios-corpo tr[data-usuario="u2"] [data-abrir]'); await a.waitForTimeout(300);
    await a.click('[data-bloquear="u2"]'); await a.waitForTimeout(500);
    db = await H.banco(a);
    ok(db.admin.usuarios.find((u) => u.id === 'u2').liberado === false && await a.locator('[data-liberar="u2"]').isVisible(), `${scheme}: bloquear no detalhe`);
    await a.click('[data-liberar="u2"]'); await a.waitForTimeout(500);
    ok((await H.banco(a)).admin.usuarios.find((u) => u.id === 'u2').liberado === true, `${scheme}: liberar no detalhe`);
    ok(a.errs.length === 0, `${scheme}: painel sem erros`, a.errs.join(' | '));
    await a.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
