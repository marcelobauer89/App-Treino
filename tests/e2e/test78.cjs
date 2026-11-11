// Aviso de novidade da Evolução: aparece ao abrir o app para quem já usa (não para conta nova), com a ilustração,
// os três destaques, "Ver minha evolução" (abre Dashboard → Evolução), "Agora não" (volta na próxima abertura) e
// "Não mostrar esta novidade de novo" (grava perfis.novidades_ocultas e não volta mais).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = (p, s) => p.locator(s).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '');
const ck = (id, tipo, dia) => ({ id, usuario_id: 'u1', tipo, inicio: `${dia}T07:00:00`, fim: `${dia}T08:00:00`, sem_horario: false, obs: '', retroativo: false, series: {} });
const PERFIL = { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidades_ocultas: [] };
async function abrir(b, { scheme = 'light', viewport = { width: 390, height: 844 }, checkins = [ck('a', 't1', '2026-11-02')], perfil = {} } = {}) {
  const p = await H.novaPagina(b, { scheme, viewport, checkins, extra: { perfis: [{ ...PERFIL, ...perfil }] } });
  await p.clock.install({ time: new Date('2026-11-11T20:00:00') });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(400);
  return p;
}
const aberto = (p) => p.locator('#novidade-evo-dialog[open]').count().then((n) => n > 0);

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await abrir(b, { scheme, viewport });
    ok(await aberto(p), `${tag}: aviso da Evolução aparece ao abrir o app`);
    ok((await txt(p, '#novidade-evo-title')) === 'Sua evolução, mês a mês' && /Novidade/i.test(await txt(p, '#novidade-evo-body .novidade-selo')), `${tag}: título e selo`);
    ok(await p.locator('.nov-evo-ilustra svg .evo-barra').count() === 5 && /Resumo Evolução/.test(await txt(p, '.nov-evo-abas')), `${tag}: ilustração com o atalho e as colunas`);
    const itens = await p.locator('.nov-evo-lista li b').allInnerTexts();
    ok(itens.join('|') === 'Seus treinos mês a mês|Quanto falta para o plano|Seus pesos e a hora de subir a carga', `${tag}: três destaques`, itens.join('|'));
    ok(await p.locator('#novidade-evo-ocultar').isVisible() && !(await p.locator('#novidade-evo-ocultar').isChecked()) && (await p.locator('#novidade-evo-body .novidade-ocultar').boundingBox()).height >= 44, `${tag}: caixa "não mostrar" desmarcada, alvo de 44 px`);
    const caixa = await p.locator('#novidade-evo-body').boundingBox();
    ok(caixa.width <= viewport.width && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: cabe na tela`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // "Ver minha evolução": abre Dashboard → Evolução e registra o evento; sem marcar, volta ao abrir de novo.
  {
    const p = await abrir(b);
    await p.click('[data-novidade-evo="ver"]'); await p.waitForTimeout(300);
    ok(!(await aberto(p)) && (await p.evaluate(() => location.hash)) === '#dashboard/evolucao' && await p.locator('#dash-evolucao').isVisible(), '"Ver minha evolução" abre Dashboard → Evolução');
    await H.gravacoes(p); await p.clock.runFor(11000); await p.waitForTimeout(150);
    let db = await H.banco(p);
    ok(db.eventos.some((e) => e.tipo === 'novidade_evolucao' && e.dados.escolha === 'viu') && db.eventos.some((e) => e.tipo === 'novidade_evolucao' && e.dados.escolha === 'ver' && e.dados.ocultou === false), 'eventos: viu e ver');
    ok(!(db.perfis[0].novidades_ocultas || []).includes('evolucao'), 'sem marcar a caixa, nada fica oculto');
    await p.reload(); await H.prontos(p); await p.waitForTimeout(400);
    ok(await aberto(p), 'sem marcar, o aviso volta na próxima abertura');
    // "Agora não" com a caixa marcada: grava e não volta mais (e fica na tela em que estava).
    await p.evaluate(() => { location.hash = '#treino'; }); await p.waitForTimeout(100);
    await p.click('#novidade-evo-body .novidade-ocultar'); await p.click('[data-novidade-evo="depois"]'); await H.gravacoes(p);
    db = await H.banco(p);
    ok(!(await aberto(p)) && (db.perfis[0].novidades_ocultas || []).includes('evolucao'), '"Não mostrar de novo" fica salvo no perfil');
    ok((await p.evaluate(() => location.hash)) === '#treino', '"Agora não" fica na tela atual');
    await p.reload(); await H.prontos(p); await p.waitForTimeout(400);
    ok(!(await aberto(p)), 'depois de ocultar, não aparece mais');
    ok(!p.errs.length, 'respostas: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Fechar no X também conta como resposta (e não oculta).
  {
    const p = await abrir(b);
    await p.click('#novidade-evo-body [data-fechar]'); await H.gravacoes(p); await p.clock.runFor(11000); await p.waitForTimeout(150);
    const db = await H.banco(p);
    ok(!(await aberto(p)) && db.eventos.some((e) => e.tipo === 'novidade_evolucao' && e.dados.escolha === 'fechou'), 'fechar no X registra "fechou"');
    await p.context().close();
  }

  // Quem já ocultou não vê; conta nova (sem check-ins nem pesos) vê as boas-vindas, não este aviso.
  {
    let p = await abrir(b, { perfil: { novidades_ocultas: ['evolucao'] } });
    ok(!(await aberto(p)), 'já ocultou: não aparece');
    await p.context().close();
    p = await abrir(b, { checkins: [] });
    ok(!(await aberto(p)), 'conta nova: não aparece');
    await p.context().close();
  }

  // Banco sem a coluna (SQL ainda não rodado): a escolha fica guardada no aparelho.
  {
    const p = await abrir(b, { perfil: { novidades_ocultas: undefined } });
    ok(await aberto(p), 'sem a coluna: aviso aparece');
    await p.click('#novidade-evo-body .novidade-ocultar'); await p.click('[data-novidade-evo="depois"]'); await H.gravacoes(p);
    await p.evaluate(() => { const db = JSON.parse(localStorage.getItem('mock-supabase')); delete db.perfis[0].novidades_ocultas; localStorage.setItem('mock-supabase', JSON.stringify(db)); });
    await p.reload(); await H.prontos(p); await p.waitForTimeout(400);
    ok(!(await aberto(p)), 'sem a coluna: ocultar vale pelo aparelho');
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
