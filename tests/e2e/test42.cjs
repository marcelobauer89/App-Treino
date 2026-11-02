// Excluir conta: pelo app (Você → Excluir conta) e pelo monitoramento (lixeira em cada usuário).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const CK = [{ id: 'c1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00', sem_horario: false, recuperacao: 4, obs: '', retroativo: false, series: {} }];
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  // ---------- App ----------
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 }, extra: { checkins: CK, cargas: [{ usuario_id: 'u1', data: '2026-10-20', treino: 't1', series: {} }] } });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
    await H.voce(p);
    ok(await p.locator('#excluir-conta').isVisible() && (await txt(p, '#excluir-conta')) === 'Excluir conta', `${scheme}: opção Excluir conta em Você`);
    await p.click('#excluir-conta'); await p.waitForTimeout(300);
    const corpo = await txt(p, '#excluir-body');
    ok((await txt(p, '#excluir-title')) === 'Excluir sua conta?' && /check-ins/.test(corpo) && /recordes/.test(corpo) && /treinos que você montou/.test(corpo) && /Não dá para desfazer/.test(corpo) && /dar um tempo/.test(corpo), `${scheme}: modal explica o que se perde e a alternativa`);
    ok(await p.locator('#excluir-sim').isDisabled(), `${scheme}: botão de excluir desligado até marcar "Entendi"`);
    await p.screenshot({ path: `${H.SAIDA}/excluir-app-${scheme}.png` });
    // Cancelar não exclui
    await p.click('#excluir-body [data-fechar].btn-sec');
    ok(!(await p.locator('#excluir-dialog[open]').count()) && (await H.banco(p)).perfis.length === 1, `${scheme}: "Quero continuar treinando" fecha sem excluir`);
    // Erro (função ainda não existe no banco)
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.semExcluir = true; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
    await p.click('#excluir-conta'); await p.check('#excluir-entendi'); await p.click('#excluir-sim'); await p.waitForTimeout(200);
    ok(/ainda não foi ligada/.test(await txt(p, '#excluir-erro')) && await p.locator('#excluir-dialog[open]').isVisible(), `${scheme}: sem a função no banco, avisa e não sai da conta`);
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.semExcluir = false; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
    // Exclui
    await p.click('#excluir-sim');
    await p.waitForSelector('#entrar-google:not([hidden])', { timeout: 5000 }).catch(() => {});
    const db = await H.banco(p);
    ok((db.contasExcluidas || []).includes('u1') && !db.perfis.length && !db.checkins.length && !db.cargas.length, `${scheme}: conta e dados apagados`);
    ok(await p.locator('#entrar-google').isVisible() && /Sua conta foi excluída/.test(await txt(p, '#toast')), `${scheme}: volta para a tela de entrada com aviso de despedida`, await txt(p, '#toast'));
    ok(await p.evaluate(() => !localStorage.getItem('bauer-sessao')), `${scheme}: limpa a marca de sessão do aparelho`);
    await p.screenshot({ path: `${H.SAIDA}/excluir-app-fim-${scheme}.png` });
    ok(!p.errs.filter((e) => !/excluir_conta/.test(e)).length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // ---------- Admin ----------
  const ADM = {
    ids: ['u1'],
    usuarios: [
      { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] },
      { id: 'u2', nome: 'Ana Souza', email: 'ana@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-21T12:00:00Z', acessos: 12, semana: null, dias_jiu: [2, 4], sem_peso: [] },
      { id: 'u3', nome: 'Bruno Lima', email: 'bruno@exemplo.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-09-01T12:00:00Z', acessos: 1, semana: null, dias_jiu: [], sem_peso: [] },
    ],
    checkins: [{ usuario_id: 'u2', tipo: 'jiu', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00' }], eventos: [],
  };
  for (const [scheme, vp] of [['light', { width: 1280, height: 900 }], ['dark', { width: 390, height: 844 }]]) {
    const a = await H.novaPagina(b, { scheme, viewport: vp, extra: { admin: JSON.parse(JSON.stringify(ADM)) } });
    await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
    await a.click('#tab-usuarios').catch(() => {}); await a.waitForTimeout(200);
    ok((await a.locator('#usuarios-corpo [data-excluir]').count()) === 2 && await a.locator('#usuarios-corpo tr[data-usuario="u1"] .excluir-btn').isDisabled(), `${scheme}: lixeira em cada usuário (a própria conta desligada)`);
    await a.click('#usuarios-corpo [data-excluir="u2"]'); await a.waitForTimeout(300);
    ok(!(await a.locator('#detalhe[open]').count()), `${scheme}: lixeira não abre o detalhe do usuário`);
    const corpo = await txt(a, '#excluir-body');
    ok((await txt(a, '#excluir-title')) === 'Excluir a conta de Ana Souza?' && /check-ins/.test(corpo) && /Não dá para desfazer/.test(corpo) && /Se Ana entrar de novo/.test(corpo), `${scheme}: mesma confirmação, com o nome da pessoa`);
    ok(await a.locator('#excluir-sim').isDisabled(), `${scheme}: botão desligado até marcar "Entendi"`);
    await a.check('#excluir-entendi');
    await a.screenshot({ path: `${H.SAIDA}/excluir-admin-${scheme}-${vp.width}.png` });
    await a.click('#excluir-sim'); await a.waitForTimeout(500);
    const db = await H.banco(a);
    ok((db.contasExcluidas || []).includes('u2') && !(await a.locator('#usuarios-corpo tr[data-usuario="u2"]').count()), `${scheme}: Ana excluída e some da lista`);
    ok(/A conta de Ana Souza foi excluída/.test(await txt(a, '#toast')), `${scheme}: aviso de exclusão`);
    // Erro do servidor aparece na modal
    await a.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.admin.falharExcluir = true; localStorage.setItem('mock-supabase', JSON.stringify(d)); });
    await a.click('#usuarios-corpo [data-excluir="u3"]'); await a.check('#excluir-entendi'); await a.click('#excluir-sim'); await a.waitForTimeout(300);
    ok(/Não foi possível excluir: falha simulada/.test(await txt(a, '#excluir-erro')) && (await a.locator('#usuarios-corpo tr[data-usuario="u3"]').count()) === 1, `${scheme}: erro aparece na modal e nada é apagado`);
    await a.click('#excluir-body .btn-sec');
    ok(a.errs.length === 0, `${scheme}: painel sem erros`, a.errs.join(' | '));
    await a.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
