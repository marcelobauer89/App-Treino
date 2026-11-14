// Aluno do personal no app: convite ?personal= (aceitar libera a conta e pula a escolha de objetivo), Meus treinos só
// de leitura, recado do personal na ficha, aviso de treinos novos e Você → Meu personal (encerrar). Dados de exemplo.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-11-14T15:00:00');
const ISO = (n) => new Date(T.getTime() - n * 864e5).toISOString();
const PROF = { usuario_id: 'p1', nome: 'Paula Exemplo', cref: '000000-G', uf: 'SP', pedido_em: ISO(9), liberado_em: ISO(8), bloqueado_em: null, limite_alunos: 30 };
const convite = (extra = {}) => ({ codigo: 'PQR234', personal_id: 'p1', nome: '', criado_em: ISO(1), expira_em: ISO(-6), cancelado_em: null, aluno_id: null, aceito_em: null, encerrado_em: null, encerrado_por: null, ...extra });
const TREINOS = { 1: { nome: 'Treino A', subtitulo: 'Peito', recado: 'Suba a carga do supino quando fizer as 10', exercicios: [{ nome: 'Supino reto', dose: '4×10', pse: 8 }] } };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. Conta nova sem acesso abre o link do personal: vê nome e CREF, aceita e entra no app sem a escolha de objetivo.
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { personal: true, scheme, viewport: { width: 390, height: 844 },
      extra: { perfis: [{ id: 'u1', nome: 'Aluna Nova', email: 'nova@exemplo.com', liberado: false, novidade_oculta: null }], profissionais: [PROF], vinculos: [convite()] } });
    await p.clock.install({ time: T });
    await p.goto(`${H.PAGINA}?personal=pqr234`); await p.waitForSelector('#personal-dialog[open]');
    const txt = await p.locator('#personal-body').innerText();
    ok(/Paula Exemplo quer acompanhar/.test(txt) && /CREF 000000-G\/SP/.test(txt), `${scheme}: convite mostra o personal e o CREF`);
    ok(/Nunca vê/.test(txt) && /observações/.test(txt), `${scheme}: convite diz o que o personal nunca vê`);
    ok(!/personal=/.test(await p.evaluate(() => location.search)), `${scheme}: o código sai do endereço`);
    await p.locator('#personal-dialog').screenshot({ path: `${H.SAIDA}/aluno-convite-${scheme}.png` });
    await p.click('[data-personal="aceitar"]'); await H.prontos(p); await p.waitForTimeout(300);
    const db = await H.banco(p);
    ok(db.perfis[0].liberado === true && db.perfis[0].acompanhado_por === 'p1' && db.vinculos[0].aluno_id === 'u1', `${scheme}: aceitar libera a conta e cria o vínculo`);
    ok(!(await p.locator('#jornada-dialog[open]').count()) && !(await p.locator('#novidade-dialog[open]').count()), `${scheme}: sem escolha de objetivo (quem monta é o personal)`);
    await H.voce(p, 'personal'); await p.waitForTimeout(150);
    const mp = await p.locator('#meu-personal').innerText();
    ok(/Paula Exemplo/.test(mp) && /CREF 000000-G\/SP/.test(mp), `${scheme}: Você → Meu personal mostra quem acompanha`, mp.slice(0, 80));
    await p.locator('#tela-voce').screenshot({ path: `${H.SAIDA}/aluno-meu-personal-${scheme}.png` });
    ok(!p.errs.length, `${scheme}: sem erros na página`, p.errs.join(' | '));
    await p.context().close();
  }

  // 2. Já é aluno: treinos do personal com recado, aviso de treinos novos, Meus treinos só de leitura e encerrar.
  {
    const p = await H.novaPagina(b, { personal: true, viewport: { width: 390, height: 844 },
      extra: { perfis: [{ id: 'u1', nome: 'Aluna', email: 'aluna@exemplo.com', acompanhado_por: 'p1', treinos_por: 'p1', treinos_em: ISO(0), treinos: TREINOS }],
        profissionais: [PROF], vinculos: [convite({ aluno_id: 'u1', aceito_em: ISO(3) })] } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    ok(/Paula Exemplo atualizou seus treinos|Seu personal atualizou seus treinos/.test(await p.locator('#toast').innerText()), 'aviso de treinos novos do personal');
    ok(/Recado do seu personal: Suba a carga do supino/.test(await p.locator('#sobre').innerText()), 'recado do personal na tela Treino');
    await H.voce(p); await p.waitForTimeout(100);
    ok(/Do seu personal/.test(await p.locator('#valor-treinos').innerText()) && /Paula Exemplo/.test(await p.locator('#valor-personal').innerText()), 'lista de Você mostra o personal');
    await H.voce(p, 'treinos'); await p.waitForTimeout(100);
    ok(await p.locator('#editar-treinos').isHidden() && await p.locator('#trocar-jornada').isHidden(), 'Meus treinos sem editar nem mudar objetivo');
    ok(/montados por Paula Exemplo/.test(await p.locator('#meus-treinos-nota').innerText()), 'Meus treinos explica quem monta');
    // Recarregar não repete o aviso.
    await p.reload(); await H.prontos(p); await p.waitForTimeout(300);
    ok(!/atualizou seus treinos/.test(await p.locator('#toast').innerText().catch(() => '')), 'o aviso aparece uma vez só');
    await H.voce(p, 'personal'); await p.waitForTimeout(100);
    await p.click('#mp-encerrar'); await p.waitForTimeout(80);
    ok(/deixa de ver os seus dados/.test(await p.locator('#meu-personal').innerText()), 'encerrar pede confirmação na tela');
    await p.click('#mp-encerrar-sim'); await p.waitForTimeout(300);
    const db = await H.banco(p);
    ok(db.perfis[0].acompanhado_por === null && !!db.vinculos[0].encerrado_em && db.vinculos[0].encerrado_por === 'aluno', 'encerrar tira o vínculo');
    ok(/não tem personal/.test(await p.locator('#meu-personal').innerText()), 'Meu personal fica vazio');
    ok(JSON.stringify(db.perfis[0].treinos) === JSON.stringify(TREINOS), 'os treinos continuam com a aluna');
    await H.voce(p, 'treinos'); await p.waitForTimeout(100);
    ok(await p.locator('#editar-treinos').isVisible(), 'depois de encerrar, volta a editar os treinos');
    ok(!p.errs.length, 'sem erros na página', p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Convite que não vale: explica o motivo; sem acesso, cai na tela de convidados.
  {
    const p = await H.novaPagina(b, { personal: true, extra: { perfis: [{ id: 'u1', nome: 'Visitante', email: 'v@exemplo.com', liberado: false }], profissionais: [PROF], vinculos: [convite({ expira_em: ISO(1) })] } });
    await p.clock.install({ time: T });
    await p.goto(`${H.PAGINA}?personal=PQR234`); await p.waitForSelector('#personal-dialog[open]');
    ok(/expirou/.test(await p.locator('#personal-body').innerText()), 'convite vencido explica o motivo');
    await p.click('[data-personal="nao"]'); await p.waitForTimeout(300);
    ok(/só para convidados/.test(await p.locator('body').innerText()), 'sem acesso, mostra a tela de convidados');
    ok(!(await H.banco(p)).perfis[0].liberado, 'convite vencido não libera');
    await p.context().close();
  }

  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
