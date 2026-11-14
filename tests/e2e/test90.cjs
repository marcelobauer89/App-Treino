// Área do personal (personal.html): cadastro com CREF, monitoramento só dos alunos com vínculo, fichas (montar,
// aplicar a alunos e ajustar por aluno), convites com link do app e encerrar acompanhamento. Dados de exemplo.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const PERSONAL = H.PAGINA.replace('index.html', 'personal.html');
const T = new Date('2026-11-14T15:00:00');
const dia = (n, h = '07:00') => { const d = new Date(T); d.setDate(d.getDate() - n); return `${d.toISOString().slice(0, 10)}T${h}:00`; };
const ISO = (n) => new Date(T.getTime() - n * 864e5).toISOString();

// u1 (a conta logada nos testes) é o personal. a1 e a2 são alunos; a3 usa o app, mas não é aluno.
const perfis = () => [
  { id: 'u1', nome: 'Paula Exemplo', email: 'paula@exemplo.com', tema: 'auto' },
  { id: 'a1', nome: 'Aluna Um', email: 'a1@exemplo.com', acompanhado_por: 'u1', ultimo_acesso: ISO(0), acessos: 9, semana: [[], ['t1'], ['jiu'], ['t2'], [], ['t3'], []], treinos: null },
  { id: 'a2', nome: 'Aluno Dois', email: 'a2@exemplo.com', acompanhado_por: 'u1', ultimo_acesso: ISO(10), acessos: 4, semana: null, treinos: null },
  { id: 'a3', nome: 'Pessoa Fora', email: 'a3@exemplo.com', ultimo_acesso: ISO(0), acessos: 20 },
];
const ck = (id, u, tipo, n) => ({ id, usuario_id: u, tipo, inicio: dia(n), fim: dia(n, '08:00'), sem_horario: false, retroativo: false });
const base = (extra = {}) => ({
  perfis: perfis(),
  checkins: [ck('c1', 'a1', 't1', 1), ck('c2', 'a1', 'jiu', 2), ck('c3', 'a1', 't2', 4), ck('c4', 'a2', 't1', 10), ck('c5', 'a2', 't2', 12), ck('c6', 'a3', 't1', 1)],
  cargas: [
    { usuario_id: 'a1', data: dia(40).slice(0, 10), treino: 't1', series: { 'Remada inversa': [{ carga: 20 }] } },
    { usuario_id: 'a1', data: dia(1).slice(0, 10), treino: 't1', series: { 'Remada inversa': [{ carga: 24 }, { carga: 22.5 }] } },
    { usuario_id: 'a3', data: dia(1).slice(0, 10), treino: 't1', series: { Puxada: [{ carga: 99 }] } },
  ],
  eventos: [{ usuario_id: 'a1', tipo: 'recorde', dados: { exercicio: 'Remada inversa' }, criado_em: ISO(1) }],
  profissionais: [{ usuario_id: 'u1', nome: 'Paula Exemplo', cref: '000000-G', uf: 'SP', pedido_em: ISO(5), liberado_em: ISO(4), bloqueado_em: null, limite_alunos: 30 }],
  vinculos: [
    { codigo: 'AAAAA2', personal_id: 'u1', nome: 'Um', criado_em: ISO(20), expira_em: ISO(13), cancelado_em: null, aluno_id: 'a1', aceito_em: ISO(19), encerrado_em: null, encerrado_por: null },
    { codigo: 'AAAAA3', personal_id: 'u1', nome: 'Dois', criado_em: ISO(30), expira_em: ISO(23), cancelado_em: null, aluno_id: 'a2', aceito_em: ISO(29), encerrado_em: null, encerrado_por: null },
  ],
  proximoCodigoPersonal: ['PQR234'],
  ...extra,
});

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. Sem cadastro: pede nome, CREF e UF; depois mostra o pedido aguardando.
  {
    const p = await H.novaPagina(b, { extra: base({ profissionais: [], vinculos: [] }) });
    await p.clock.install({ time: T });
    await p.goto(PERSONAL); await p.waitForSelector('#pf-form');
    ok((await p.locator('#pf-nome').inputValue()) === 'Marcelo Bauer', 'cadastro: nome da conta Google preenchido');
    await p.fill('#pf-cref', ''); await p.click('#pf-enviar'); await p.waitForTimeout(80);
    ok(/CREF/.test(await p.locator('#pf-erro').innerText()), 'cadastro: pede o CREF');
    await p.fill('#pf-cref', '123456-g'); await p.selectOption('#pf-uf', 'RJ'); await p.click('#pf-enviar');
    await p.waitForSelector('text=Pedido enviado');
    const db = await H.banco(p);
    ok(db.profissionais.length === 1 && db.profissionais[0].cref === '123456-G' && db.profissionais[0].uf === 'RJ', 'cadastro: pedido gravado com CREF e UF');
    ok(await p.locator('#painel').isHidden(), 'cadastro: sem liberação, o painel não abre');
    await p.screenshot({ path: `${H.SAIDA}/personal-pedido.png` });
    ok(!p.errs.length, 'cadastro: sem erros na página', p.errs.join(' | '));
    await p.context().close();
  }

  // 2. Liberado: monitoramento só dos alunos, fichas, aplicar, ajustar, convidar e encerrar.
  for (const [scheme, viewport] of [['light', { width: 390, height: 844 }], ['dark', { width: 1280, height: 900 }]]) {
    const p = await H.novaPagina(b, { scheme, viewport, extra: base() });
    await p.clock.install({ time: T });
    await p.goto(PERSONAL); await p.waitForSelector('#painel:not([hidden])');
    await p.waitForTimeout(300);
    const kpis = await p.locator('#kpis').innerText();
    ok(/Alunos ativos/.test(kpis) && !/suári/.test(kpis), `${scheme}: números falam em alunos`, kpis.replace(/\s+/g, ' ').slice(0, 120));
    ok(/2 de 2|1 de 2/.test(kpis), `${scheme}: conta só os alunos com vínculo`);
    ok(/Aluno Dois/.test(await p.locator('#sumiu-lista').innerText()), `${scheme}: Quem sumiu mostra o aluno parado`);
    ok(/Aluna Um/.test(await p.locator('#evoluiu-lista').innerText()), `${scheme}: Quem mais evoluiu mostra o recorde`);
    await p.screenshot({ path: `${H.SAIDA}/personal-geral-${scheme}.png`, fullPage: true });
    await p.click('#tab-usuarios'); await p.waitForTimeout(100);
    const lista = await p.locator('#usuarios-corpo').innerText();
    ok(/Aluna Um/.test(lista) && /Aluno Dois/.test(lista) && !/Pessoa Fora/.test(lista), `${scheme}: Alunos só com quem tem vínculo`);
    ok(!/suári/.test(await p.locator('#aba-usuarios').innerText()), `${scheme}: aba Alunos sem "usuário"`);

    // Fichas: a primeira, a partir do plano pronto.
    await p.click('#tab-fichas'); await p.waitForTimeout(80);
    ok(/ainda não tem fichas/.test(await p.locator('#fichas-lista').innerText()), `${scheme}: fichas vazias explicam o que fazer`);
    await p.click('#ficha-nova'); await p.waitForSelector('#ficha-dialog[open]');
    await p.click('#ficha-salvar'); await p.waitForTimeout(80);
    ok(/nome à ficha/.test(await p.locator('#ficha-erro').innerText()), `${scheme}: ficha sem nome é recusada`);
    await p.selectOption('#pf-modelo', 'plano'); await p.waitForTimeout(80);
    ok((await p.locator('.pf-treino').count()) === 3, `${scheme}: começar do plano pronto traz os 3 treinos`);
    await p.fill('#pf-ficha-nome', 'Base iniciante');
    // Troca a dose do 1º exercício, sobe o 2º e acrescenta um exercício que não está na biblioteca (recusado) e depois um que está.
    await p.locator('.pf-treino[data-t="0"] li[data-x="0"] [data-campo="ex-dose"]').fill('4×12');
    const segundo = await p.locator('.pf-treino[data-t="0"] li[data-x="1"] [data-campo="ex-nome"]').inputValue();
    await p.locator('.pf-treino[data-t="0"] li[data-x="1"] [data-pf-mover="-1"]').click(); await p.waitForTimeout(60);
    ok((await p.locator('.pf-treino[data-t="0"] li[data-x="0"] [data-campo="ex-nome"]').inputValue()) === segundo, `${scheme}: subir exercício muda a ordem`);
    await p.locator('.pf-treino[data-t="2"] [data-pf-ex-mais]').click(); await p.waitForTimeout(60);
    const novo = p.locator('.pf-treino[data-t="2"] li').last().locator('[data-campo="ex-nome"]');
    await novo.fill('Exercício inventado'); await p.click('#ficha-salvar'); await p.waitForTimeout(80);
    ok(/não está na biblioteca/.test(await p.locator('#ficha-erro').innerText()), `${scheme}: exercício fora da biblioteca é recusado`);
    await novo.fill('supino reto'); await novo.dispatchEvent('change'); await p.waitForTimeout(60);
    ok((await novo.inputValue()) === 'Supino reto', `${scheme}: o nome vira o da biblioteca`);
    ok((await p.locator('.pf-treino[data-t="2"] li').last().locator('[data-campo="ex-dose"]').inputValue()) !== '', `${scheme}: séries vêm da biblioteca`);
    await p.locator('#ficha-dialog').screenshot({ path: `${H.SAIDA}/personal-editor-${scheme}.png` });
    await p.click('#ficha-salvar'); await p.waitForFunction(() => !document.querySelector('#ficha-dialog').open);
    await p.waitForTimeout(250);
    let db = await H.banco(p);
    ok(db.fichas.length === 1 && db.fichas[0].nome === 'Base iniciante' && db.fichas[0].treinos['3'].exercicios.some((x) => x.nome === 'Supino reto'), `${scheme}: ficha salva com os 3 treinos`);
    ok(db.fichas[0].treinos['1'].exercicios.some((x) => x.dose === '4×12'), `${scheme}: dose alterada salva`);
    ok(Array.isArray(db.fichas[0].semana) && db.fichas[0].semana[1].includes('t2'), `${scheme}: semana sugerida do plano pronto vai junto`);
    ok(/Base iniciante/.test(await p.locator('#fichas-lista').innerText()), `${scheme}: ficha aparece na lista`);

    // Aplicar a um aluno, com a semana.
    await p.click('[data-ficha-aplicar]'); await p.waitForSelector('#pc-dialog[open]');
    ok(await p.locator('#pc-aplicar').isDisabled(), `${scheme}: aplicar só depois de escolher alunos`);
    await p.check('[name="pc-aluno"][value="a1"]'); await p.check('#pc-semana');
    ok(/1 aluno/.test(await p.locator('#pc-aplicar').innerText()), `${scheme}: botão diz quantos alunos`);
    await p.locator('#pc-dialog').screenshot({ path: `${H.SAIDA}/personal-aplicar-${scheme}.png` });
    await p.click('#pc-aplicar'); await p.waitForFunction(() => !document.querySelector('#pc-dialog').open); await p.waitForTimeout(250);
    db = await H.banco(p);
    const a1 = db.perfis.find((x) => x.id === 'a1');
    ok(a1.ficha_id === db.fichas[0].id && a1.treinos['1'].exercicios[1].dose === '4×12' && a1.treinos_por === 'u1', `${scheme}: aluna recebe a ficha`);
    ok(a1.semana[1].includes('t2') && a1.treinos_anterior && 'treinos' in a1.treinos_anterior, `${scheme}: semana trocada e versão anterior guardada`);
    ok(db.perfis.find((x) => x.id === 'a2').treinos === null, `${scheme}: quem não foi marcado não muda`);

    // Ficha do aluno: treinos atuais, pesos e ajuste só para ela.
    await p.click('#tab-usuarios'); await p.waitForTimeout(80);
    await p.locator('#usuarios-corpo tr[data-usuario="a1"]').click(); await p.waitForSelector('#detalhe[open]');
    const det = await p.locator('#det-corpo').innerText();
    ok(/Base iniciante/.test(det) && /Treinos atuais/.test(det), `${scheme}: detalhe mostra a ficha atual`, det.slice(0, 80));
    ok(/Remada inversa/.test(det) && /Recorde 24 kg/.test(det) && /subiu 4 kg/.test(det), `${scheme}: detalhe mostra o recorde e quanto subiu`);
    ok(/Aluno desde/.test(det) && !/Excluir conta/.test(det) && !/Liberar/.test(det), `${scheme}: detalhe sem as ações do administrador`);
    await p.locator('#detalhe').screenshot({ path: `${H.SAIDA}/personal-aluno-${scheme}.png` });
    await p.click('[data-pf-editar-aluno="a1"]'); await p.waitForSelector('#ficha-dialog[open]');
    ok(/Treinos de Aluna Um/.test(await p.locator('#ficha-title').innerText()), `${scheme}: editor abre com os treinos da aluna`);
    ok(await p.locator('.pf-semana').isHidden(), `${scheme}: semana da aluna só muda se marcar`);
    await p.locator('.pf-treino[data-t="1"] li[data-x="0"] [data-campo="ex-dose"]').fill('5×5');
    await p.click('#ficha-salvar'); await p.waitForFunction(() => !document.querySelector('#ficha-dialog').open); await p.waitForTimeout(300);
    db = await H.banco(p);
    ok(db.perfis.find((x) => x.id === 'a1').treinos['2'].exercicios[0].dose === '5×5', `${scheme}: ajuste chega só à aluna`);
    ok(db.fichas[0].treinos['2'].exercicios[0].dose !== '5×5', `${scheme}: a ficha original não muda`);
    ok(await p.locator('#detalhe[open]').count() === 1 && /ajustada para este aluno/.test(await p.locator('#det-corpo').innerText()), `${scheme}: detalhe reabre marcando o ajuste`);
    await p.click('#detalhe [data-fechar]');

    // Convidar: link do app com ?personal= e o convite aguardando.
    await p.click('#tab-convidar'); await p.waitForTimeout(80);
    await p.fill('#pc-nome', 'Novo aluno'); await p.click('#pc-gerar'); await p.waitForTimeout(200);
    const link = await p.locator('#pc-link').inputValue();
    ok(/\/\?personal=PQR234$/.test(link), `${scheme}: link do convite abre o app com o código`, link);
    ok(/Novo aluno/.test(await p.locator('#pc-aguardando').innerText()), `${scheme}: convite aparece aguardando`);
    ok(/Aluna Um/.test(await p.locator('#pc-historico').innerText()), `${scheme}: convites aceitos listam o aluno`);
    await p.screenshot({ path: `${H.SAIDA}/personal-convidar-${scheme}.png`, fullPage: true });

    // Encerrar o acompanhamento do aluno 2.
    await p.click('#tab-usuarios'); await p.locator('#usuarios-corpo tr[data-usuario="a2"]').click(); await p.waitForSelector('#detalhe[open]');
    await p.click('[data-pf-encerrar="a2"]'); await p.waitForSelector('#pc-dialog[open]');
    await p.click('[data-confirmar]'); await p.waitForTimeout(300);
    db = await H.banco(p);
    ok(db.perfis.find((x) => x.id === 'a2').acompanhado_por === null, `${scheme}: encerrar tira o vínculo`);
    ok(!/Aluno Dois/.test(await p.locator('#usuarios-corpo').innerText()), `${scheme}: aluno encerrado sai da lista`);
    ok(!p.errs.length, `${scheme}: sem erros na página`, p.errs.join(' | '));
    await p.context().close();
  }

  // 3. Monitoramento do administrador: aba Profissionais com o pedido e o botão Liberar.
  {
    const p = await H.novaPagina(b, { extra: base({ admin: { ids: ['u1'] }, profissionais: [{ usuario_id: 'a3', nome: 'Pessoa Fora', cref: '999999-G', uf: 'MG', pedido_em: ISO(1), liberado_em: null, bloqueado_em: null, limite_alunos: 30 }] }) });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA.replace('index.html', 'admin.html#profissionais')); await p.waitForSelector('#painel:not([hidden])');
    await p.waitForTimeout(300);
    ok(await p.locator('#alerta-prof').isVisible() && (await p.locator('#alerta-prof').innerText()) === '1', 'admin: aba mostra 1 pedido aguardando');
    ok(/999999-G\/MG/.test(await p.locator('#prof-lista').innerText()), 'admin: lista mostra o CREF');
    await p.screenshot({ path: `${H.SAIDA}/admin-profissionais.png`, fullPage: true });
    await p.click('[data-prof-liberar="sim"]'); await p.waitForTimeout(300);
    ok(!!(await H.banco(p)).profissionais[0].liberado_em, 'admin: Liberar grava a liberação');
    ok(/Liberado/.test(await p.locator('#prof-lista').innerText()), 'admin: situação muda para Liberado');
    ok(!p.errs.length, 'admin: sem erros na página', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
