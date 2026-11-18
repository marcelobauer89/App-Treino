// Integrações (Você → Integrações): check-in automático vindo do app do dojo. Escondida por padrão: a linha só
// aparece com app parceiro cadastrado e com a integração liberada pelo administrador (painel → Usuários → detalhe); Conectar mostra o código de vínculo uma vez; Desconectar pede confirmação; o check-in que veio do
// parceiro aparece no Dashboard com "via <nome do app>".
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const PARCEIROS = [{ id: 'dojo', nome: 'App do dojo', tipo_checkin: 'jiu' }];
const LIBERADA = [{ id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], integracoes_liberadas: true }];
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
const usuario = (id, nome, integracoes) => ({ id, nome, email: `${id}@exemplo.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T10:00:00', acessos: 5, semana: null, dias_jiu: [], sem_peso: [], emails_resumo: true, liberado: true, acesso_pedido_em: null, liberado_como: 'convite', liberado_em: '2026-08-01T12:00:00Z', videos_liberados: false, integracoes_liberadas: integracoes });
const pad = (n) => String(n).padStart(2, '0');
const hojeAs = (h) => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${h}`; };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // Sem app parceiro cadastrado, banco sem a migração, ou integração não liberada pelo administrador (o padrão):
  // a linha não aparece e nada quebra.
  for (const extra of [{}, { semIntegracoes: true }, { parceiros: PARCEIROS }]) {
    const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await H.voce(p);
    ok(!(await p.isVisible('#linha-integracoes')), `${extra.parceiros ? 'não liberada pelo administrador' : extra.semIntegracoes ? 'sem migração' : 'sem parceiro'}: linha Integrações escondida`);
    ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Com o app do dojo: conectar, ver o código, copiar, gerar outro e desconectar.
  let p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: { perfis: LIBERADA, parceiros: PARCEIROS, proximosCodigos: ['GT-ABCD-2345', 'GT-WXYZ-6789'] } });
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  await H.voce(p);
  ok(await p.isVisible('#linha-integracoes') && (await p.innerText('#valor-integracoes')).trim() === 'Nenhuma', 'linha Integrações com "Nenhuma"');
  await H.voce(p, 'integracoes'); await p.waitForTimeout(150);
  let t = (await p.innerText('#integracoes')).replace(/\s+/g, ' ');
  ok(t.includes('App do dojo') && t.includes('Check-in automático de Jiu Jitsu') && t.includes('Toque em Conectar'), 'cartão do App do dojo explica o que faz', t);
  await p.click('[data-int-conectar="dojo"]'); await p.waitForTimeout(250);
  ok((await p.innerText('#int-codigo-dojo')).trim() === 'GT-ABCD-2345', 'Conectar mostra o código de vínculo');
  t = (await p.innerText('#integracoes')).replace(/\s+/g, ' ');
  ok(t.includes('aparece só agora') && !t.includes('Gerar novo código'), 'avisa que o código aparece uma vez', t);
  await p.click('[data-int-copiar="dojo"]'); await p.waitForTimeout(150);
  const copiado = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(copiado === 'GT-ABCD-2345' || (await p.locator('.toast').innerText().catch(() => '')).includes('GT-ABCD-2345'), 'Copiar código', copiado);
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'sem rolagem lateral');
  await p.screenshot({ path: `${H.SAIDA}/integracoes-codigo-390.png` });
  let db = await H.banco(p);
  ok(db.integracoes.length === 1 && db.integracoes[0].parceiro === 'dojo', 'integração criada no banco');

  // Ao voltar, o código não aparece mais: "Conectado desde…" com Gerar novo código e Desconectar.
  await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
  await H.voce(p);
  ok((await p.innerText('#valor-integracoes')).trim() === 'Conectado', 'linha mostra "Conectado"');
  await H.voce(p, 'integracoes'); await p.waitForTimeout(150);
  t = (await p.innerText('#integracoes')).replace(/\s+/g, ' ');
  ok(t.includes('Conectado desde') && t.includes('Nenhum check-in recebido ainda') && !(await p.locator('#int-codigo-dojo').count()), 'conectado: sem o código, com a data', t);
  await p.click('[data-int-conectar="dojo"]'); await p.waitForTimeout(250);
  ok((await p.innerText('#int-codigo-dojo')).trim() === 'GT-WXYZ-6789', 'Gerar novo código troca o código');
  await p.click('[data-int-desconectar="dojo"]'); await p.waitForTimeout(100);
  t = (await p.innerText('#integracoes')).replace(/\s+/g, ' ');
  ok(t.includes('Desconectar o App do dojo?') && t.includes('Os que já vieram continuam'), 'Desconectar pede confirmação', t);
  await p.click('[data-int-desconectar-nao]'); await p.waitForTimeout(100);
  ok(!(await p.locator('[data-int-desconectar-sim]').count()), 'Continuar conectado fecha a confirmação');
  await p.click('[data-int-desconectar="dojo"]'); await p.waitForTimeout(100);
  await p.click('[data-int-desconectar-sim="dojo"]'); await p.waitForTimeout(300);
  db = await H.banco(p);
  ok(!db.integracoes.length && (await p.isVisible('[data-int-conectar="dojo"]')), 'desconectado: volta o Conectar');
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();

  // Check-in recebido do dojo: Dashboard mostra "via App do dojo"; o do app não ganha o rótulo.
  p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra: {
    perfis: LIBERADA, parceiros: PARCEIROS,
    integracoes: [{ usuario_id: 'u1', parceiro: 'dojo', codigo: 'GT-ABCD-2345', criado_em: '2026-11-01T12:00:00Z', ultimo_checkin_em: new Date().toISOString() }],
    checkins: [
      { id: 'c-dojo', usuario_id: 'u1', tipo: 'jiu', inicio: hojeAs('07:00:00'), fim: hojeAs('08:00:00'), sem_horario: false, obs: '', retroativo: false, series: {}, origem: 'dojo', id_externo: 'aula-1' },
      { id: 'c-app', usuario_id: 'u1', tipo: 'muay', inicio: hojeAs('06:00:00'), fim: hojeAs('06:30:00'), sem_horario: false, obs: '', retroativo: false, series: {}, origem: 'app' },
    ] } });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(250);
  t = (await p.locator('#dia-lista').innerText()).replace(/\s+/g, ' ');
  ok((t.match(/via App do dojo/g) || []).length === 1, 'Dashboard: check-in do dojo com "via App do dojo" (só ele)', t);
  await H.voce(p, 'integracoes'); await p.waitForTimeout(150);
  ok((await p.innerText('#integracoes')).includes('Último check-in recebido em'), 'mostra quando chegou o último check-in');
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();

  // Painel: o administrador libera e tira a integração na ficha do usuário; a lista mostra o selo "Dojo".
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `admin-${viewport.width}`;
    const ADM = { ids: ['u1'], usuarios: [usuario('u1', 'Admin', false), usuario('u2', 'Ana', false), usuario('u3', 'Bruno', true)], checkins: [], eventos: [], emails: [], convites: [] };
    p = await H.novaPagina(b, { viewport, extra: { admin: ADM } });
    await p.emulateMedia({ reducedMotion: 'reduce' }); // a ficha sobe animada no celular (igual ao test65)
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
    await H.aba(p, 'usuarios').catch(() => {});
    await p.waitForTimeout(150);
    ok((await p.locator('[data-usuario="u3"] .tag-videos', { hasText: 'Dojo' }).count()) === 1
      && (await p.locator('[data-usuario="u2"] .tag-videos', { hasText: 'Dojo' }).count()) === 0, `${tag}: selo Dojo só em quem está liberado`);
    await p.click('[data-abrir="u2"]'); await p.waitForTimeout(200);
    ok(/Não liberada/.test(await p.locator('#det-integracoes-t + .det-acesso').innerText()), `${tag}: ficha mostra "Não liberada"`);
    await p.locator('#det-integracoes-t').scrollIntoViewIfNeeded();
    await p.locator('section[aria-labelledby="det-integracoes-t"]').screenshot({ path: `${H.SAIDA}/integracoes-admin-${tag}.png` });
    await p.click('[data-liberar-integracoes="sim"]'); await p.waitForTimeout(400);
    let db = await H.banco(p);
    ok(db.admin.usuarios.find((u) => u.id === 'u2').integracoes_liberadas === true
      && db.log.some((l) => l.startsWith('admin_liberar_integracoes:{"alvo":"u2","liberar":true')), `${tag}: Liberar integração chama a função`);
    ok(/Liberada/.test(await p.locator('#det-integracoes-t + .det-acesso').innerText()) && await p.locator('[data-liberar-integracoes="nao"]').isVisible(), `${tag}: ficha atualiza para Liberada`);
    await p.click('[data-liberar-integracoes="nao"]'); await p.waitForTimeout(400);
    db = await H.banco(p);
    ok(db.admin.usuarios.find((u) => u.id === 'u2').integracoes_liberadas === false && await p.locator('[data-liberar-integracoes="sim"]').isVisible(), `${tag}: Tirar integração volta ao padrão`);
    ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} falha(s)` : '\nIntegrações: tudo OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
