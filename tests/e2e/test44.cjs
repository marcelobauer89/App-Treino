// LGPD: aviso da política, observações só com o interruptor de Privacidade, sem recuperação, baixar meus dados e fonte local.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const fs = require('fs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const CK = [{ id: 'c1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00', sem_horario: false, recuperacao: 4, obs: 'ombro doeu', retroativo: false, series: {} }];
const base = { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: 'data:image/jpeg;base64,AAAA', tema: 'auto', dias_jiu: [2, 4] };
async function abrir(b, perfil, op = {}) {
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, ...op, extra: { perfis: [{ ...base, ...perfil }], checkins: CK, cargas: [{ usuario_id: 'u1', data: '2026-10-20', treino: 't1', series: { 'Puxada': [{ carga: 30 }] } }], eventos: [{ usuario_id: 'u1', tipo: 'tela', dados: { tela: 'treino' } }, { usuario_id: 'u2', tipo: 'tela', dados: {} }], ...(op.extra || {}) } });
  p.reqs = []; p.on('request', (r) => p.reqs.push(r.url()));
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  return p;
}
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    // Aviso da política para quem já usa
    let p = await abrir(b, { politica_versao: null, consentimento_saude: null, novidade_oculta: null }, { scheme });
    ok(await p.locator('#politica-dialog[open]').isVisible() && /Atualizamos nossa Política/.test(await txt(p, '#politica-title')), `${scheme}: aviso da política aparece`);
    ok(/anexar uma foto ao check-in/.test(await txt(p, '#politica-body')) && /só você vê; o administrador não/.test(await txt(p, '#politica-body')), `${scheme}: aviso explica a mudança`);
    ok(!(await p.locator('#novidade-dialog[open]').count()), `${scheme}: aviso de treinos não aparece junto`);
    ok((await p.getAttribute('#politica-body a', 'href')) === 'privacidade.html', `${scheme}: link para a política completa`);
    await p.waitForTimeout(300); await p.screenshot({ path: `${H.SAIDA}/lgpd-aviso-${scheme}.png` });
    await p.click('[data-politica-ok]'); await H.gravacoes(p);
    ok((await H.banco(p)).perfis[0].politica_versao === '2026-10-27', `${scheme}: "Entendi" grava a versão`);
    ok(await p.locator('#novidade-dialog[open]').isVisible(), `${scheme}: depois vem o aviso de treinos`);
    await p.click('#novidade-body [data-fechar]');
    await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
    ok(!(await p.locator('#politica-dialog[open]').count()), `${scheme}: aviso da política não volta`);
    await p.click('#novidade-body [data-fechar]').catch(() => {});
    // Check-in sem recuperação e, sem consentimento, sem observação (e sem perguntar nada)
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(!(await p.locator('#f-obs').count()) && !(await p.locator('input[name="f-rec"]').count()) && !/Recupera|consentimento|Concordo/i.test(await txt(p, '#form-body')), `${scheme}: check-in sem recuperação, sem observação e sem pergunta`);
    await p.waitForTimeout(250); await p.screenshot({ path: `${H.SAIDA}/lgpd-checkin-${scheme}.png` });
    await p.click('[data-salvar-form]'); await H.gravacoes(p);
    let db = await H.banco(p);
    const novo = db.checkins.find((c) => c.id !== 'c1');
    ok(novo && !('recuperacao' in novo) && novo.obs === '', `${scheme}: check-in salvo sem recuperação nem observação`, JSON.stringify(novo));
    ok((await H.banco(p)).perfis[0].consentimento_saude == null, `${scheme}: nada é perguntado nem gravado sobre consentimento`);
    // Dashboard: sem recuperação média, com dias com treino
    await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(200);
    ok(!/Recupera/i.test(await txt(p, '#numeros')) && /Dias com treino em/.test(await txt(p, '#numeros')), `${scheme}: números sem recuperação`, await txt(p, '#numeros'));
    ok(!/recupera/i.test(await txt(p, '#dia-lista')), `${scheme}: detalhe do dia sem recuperação`);
    // Privacidade: ligar consentimento
    await H.voce(p, 'privacidade'); await p.waitForTimeout(250);
    ok(/O que o administrador vê/.test(await txt(p, '.priv-resumo')) && !/Mundo/i.test(await txt(p, '.voce-pagina[data-pagina="privacidade"]')), `${scheme}: Privacidade explica o monitoramento (sem Mundo ao vivo)`);
    ok(!(await p.locator('#saude-consent').isChecked()) && /Registrar observações nos check-ins/.test(await txt(p, '.voce-pagina[data-pagina="privacidade"]')), `${scheme}: interruptor de observações desligado por padrão`);
    ok(!/recupera/i.test(await txt(p, '.voce-pagina[data-pagina="privacidade"]')), `${scheme}: Privacidade não fala mais de recuperação`);
    await p.waitForTimeout(250); await p.screenshot({ path: `${H.SAIDA}/lgpd-privacidade-${scheme}.png`, fullPage: true });
    await p.locator('#saude-consent').click(); await H.gravacoes(p);
    ok((await H.banco(p)).perfis[0].consentimento_saude === 'sim', `${scheme}: ligar grava o consentimento`);
    await p.click('.nav [data-tela="treino"]'); await p.waitForTimeout(150);
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(await p.locator('#f-obs').isVisible() && !(await p.locator('input[name="f-rec"]').count()), `${scheme}: com consentimento, só a observação aparece`);
    await p.keyboard.press('Escape');
    // Desligar: sem confirmação, desliga e apaga as observações na hora
    await H.voce(p, 'privacidade'); await p.waitForTimeout(250);
    await p.locator('#saude-consent').click(); await H.gravacoes(p);
    ok(!(await p.locator('#saude-consent').isChecked()) && !(await p.locator('.ed-confirma, [data-saude-parar]').count()), `${scheme}: desligar não pede confirmação`);
    db = await H.banco(p);
    ok(db.perfis[0].consentimento_saude === 'nao' && db.checkins.every((c) => !c.obs) && /desligadas e apagadas/.test(await txt(p, '#toast')), `${scheme}: desligar apaga as observações`, await txt(p, '#toast'));
    await p.click('.nav [data-tela="treino"]'); await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(!(await p.locator('#f-obs').count()), `${scheme}: desligado, a observação some do check-in`);
    await p.keyboard.press('Escape'); await H.voce(p, 'privacidade'); await p.waitForTimeout(200);
    // Baixar meus dados
    const [down] = await Promise.all([p.waitForEvent('download'), p.click('#baixar-dados')]);
    const caminho = await down.path();
    const j = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    ok(/^gestao-de-treinos-meus-dados-\d{4}-\d{2}-\d{2}\.json$/.test(down.suggestedFilename()), `${scheme}: nome do arquivo`, down.suggestedFilename());
    ok(j.perfil.email === 'marcelo@exemplo.com' && j.perfil.tem_foto === true && !('foto' in j.perfil) && j.checkins.length === 2 && j.cargas.length === 1 && j.eventos.length >= 1 && j.eventos.every((e) => e.tipo) && Array.isArray(j.emails_enviados), `${scheme}: arquivo com perfil (sem foto), check-ins, cargas, eventos e e-mails`);
    ok(!JSON.stringify(j).includes('u2'), `${scheme}: só os dados da própria pessoa`);
    ok(/Arquivo baixado/.test(await txt(p, '#baixar-status')), `${scheme}: confirmação do download`);
    // Fonte local
    ok(!p.reqs.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)) && p.reqs.some((u) => /\/fonts\/archivo-latin\.woff2$/.test(u)), `${scheme}: fonte carregada do próprio app, sem o Google`, p.reqs.filter((u) => /font|woff|css/.test(u)).join(' '));
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
    // Conta nova: a privacidade vem dentro das boas-vindas ("Seus dados"), antes da escolha dos treinos.
    p = await abrir(b, { politica_versao: null, consentimento_saude: null, novidade_oculta: null }, { scheme, extra: { checkins: [], cargas: [] } });
    await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
    ok(/Seus dados/.test(await txt(p, '#jornada-title')) && /administrador vê/.test(await txt(p, '#jornada-body')) && !(await p.isVisible('#politica-dialog')), `${scheme}: conta nova vê "Seus dados" nas boas-vindas`);
    await p.context().close();
    // Conta nova que já escolheu os treinos (sem boas-vindas) e não aceitou a política: "Antes de começar".
    p = await abrir(b, { politica_versao: null, consentimento_saude: null, novidade_oculta: '2026-10-01T00:00:00Z' }, { scheme, extra: { checkins: [], cargas: [] } });
    ok(/Antes de começar/.test(await txt(p, '#politica-title')), `${scheme}: sem boas-vindas, a janela "Antes de começar"`);
    await p.context().close();
    // Tela de entrada com link
    p = await H.novaPagina(b, { scheme, logado: false });
    await p.goto(H.PAGINA); await p.waitForTimeout(300);
    ok(/Ao entrar, você concorda com a Política de Privacidade/.test(await txt(p, '#entrar-privacidade')) && (await p.getAttribute('#entrar-privacidade a', 'href')) === 'privacidade.html', `${scheme}: entrada com link para a política`);
    await p.context().close();
    // Página da política
    p = await H.novaPagina(b, { scheme, viewport: { width: 390, height: 844 } });
    p.reqs = []; p.on('request', (r) => p.reqs.push(r.url()));
    await p.goto(H.PAGINA.replace('index.html', 'privacidade.html')); await p.waitForTimeout(300);
    const corpo = await txt(p, 'main');
    ok(['Quem cuida dos seus dados', 'Que dados guardamos', 'O que o administrador vê', 'Com quem compartilhamos', 'Por quanto tempo', 'Seus direitos', 'marcelobauer.mbb@gmail.com'].every((t) => corpo.includes(t)), `${scheme}: política com todas as seções e o contato`);
    ok(!/mundo ao vivo|pixel art/i.test(corpo), `${scheme}: política não menciona o Mundo ao vivo`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && !p.reqs.some((u) => /fonts\.g/.test(u)), `${scheme}: sem rolagem horizontal e sem fonte do Google`);
    await p.screenshot({ path: `${H.SAIDA}/lgpd-politica-${scheme}.png` });
    await p.context().close();
  }
  // Banco antigo (sem as colunas novas): sem aviso e campos de saúde como antes
  {
    const p = await abrir(b, { politica_versao: undefined, consentimento_saude: undefined });
    ok(!(await p.locator('#politica-dialog[open]').count()), 'schema antigo: sem aviso da política');
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(await p.locator('#f-obs').isVisible() && !(await p.locator('input[name="f-rec"]').count()), 'schema antigo: observação como antes, sem recuperação');
    await p.context().close();
  }
  // Painel sem recuperação
  {
    const ADM = { ids: ['u1'], usuarios: [{ id: 'u1', nome: 'Marcelo', email: 'm@x', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-21T11:00:00Z', acessos: 4, semana: null, dias_jiu: [2, 4], sem_peso: [], liberado: true }],
      checkins: [{ usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00', recuperacao: 4 }], eventos: [] };
    const a = await H.novaPagina(b, { viewport: { width: 1280, height: 900 }, extra: { admin: ADM } });
    a.reqs = []; a.on('request', (r) => a.reqs.push(r.url()));
    await a.goto(ADMIN); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
    await a.click('#tab-usuarios'); await a.click('#usuarios-corpo tr[data-usuario="u1"] [data-abrir]'); await a.waitForTimeout(300);
    ok(/Check-in de Jiu Jitsu/.test(await txt(a, '#det-atividade')) && !/recupera/i.test(await txt(a, '#det-atividade')), 'painel: atividade sem a recuperação');
    ok(!a.reqs.some((u) => /fonts\.g/.test(u)), 'painel: sem fonte do Google');
    ok(!a.errs.length, 'painel: sem erros', a.errs.join(' | '));
    await a.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
