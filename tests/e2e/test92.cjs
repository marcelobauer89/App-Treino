// Mudar meu objetivo: quem ajustou os treinos confirma a troca numa mensagem no centro da tela,
// que avisa que os ajustes não ficam guardados para depois. Sem ajustes, a troca segue direto.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const BASE = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [], novidade_oculta: '2026-10-01T00:00:00Z' };
const PROPRIO = { 1: { nome: 'Inferiores', subtitulo: 'Glúteo', exercicios: [{ nome: 'Elevação de quadril', dose: '3×10', pse: 8 }] },
  2: { nome: 'Superiores', subtitulo: 'Braços', exercicios: [{ nome: 'Tríceps na corda', dose: '3×12', pse: 8 }] } };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  const abrirTroca = async (perfil, width = 390) => {
    const p = await H.novaPagina(b, { viewport: { width, height: 844 }, extra: { perfis: [{ ...BASE, ...perfil }], checkins: [], cargas: [] } });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
    await H.voce(p, 'treinos'); await p.click('#trocar-jornada'); await p.waitForTimeout(100);
    return p;
  };
  const confirmar = async (p, id) => { await p.click(`[data-jd-marcar="${id}"]`); await p.click('[data-jd-confirmar]'); await p.waitForTimeout(150); };
  const msg = async (p) => ((await p.locator('#troca-dialog[open]').count()) ? (await p.innerText('#troca-body')).trim() : '');

  // Objetivo ajustado: o rodapé tem só o Confirmar; a mensagem aparece ao confirmar, no centro da tela.
  let p = await abrirTroca({ jornada: 'hipertrofia', treinos: PROPRIO });
  await p.click('[data-jd-marcar="forca"]');
  ok(!(await p.locator('.bv-rodape p').count()) && !(await p.locator('#troca-dialog[open]').count()), 'ajustado: sem aviso antes de tocar em Confirmar');
  await p.click('[data-jd-confirmar]'); await p.waitForTimeout(150);
  let t = await msg(p);
  ok(t.startsWith('Trocar de objetivo?') && t.includes('Você ajustou os treinos de Hipertrofia.') && t.includes('vêm como eram originalmente') && t.includes('cargas e check-ins continuam salvos'), 'ajustado: mensagem de confirmação ao trocar', t);
  const caixa = await p.locator('#troca-dialog').boundingBox();
  ok(caixa && Math.abs((caixa.y + caixa.height / 2) - 422) < 40 && Math.abs((caixa.x + caixa.width / 2) - 195) < 4, 'mensagem no centro da tela no celular', JSON.stringify(caixa));
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'sem rolagem lateral');
  await p.screenshot({ path: `${H.SAIDA}/troca-confirma-390.png` });
  // Cancelar: nada muda e a lista continua aberta com a escolha marcada.
  await p.click('#troca-dialog [data-fechar]'); await p.waitForTimeout(100);
  let db = await H.banco(p);
  ok(!(await p.locator('#troca-dialog[open]').count()) && await p.isVisible('#jornada-dialog') && db.perfis[0].jornada === 'hipertrofia'
    && JSON.stringify(db.perfis[0].treinos) === JSON.stringify(PROPRIO), 'Cancelar: nada muda e a lista continua aberta');
  // Esc também cancela só a mensagem.
  await p.click('[data-jd-confirmar]'); await p.waitForTimeout(100);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.locator('#troca-dialog[open]').count()) && await p.isVisible('#jornada-dialog'), 'Esc fecha só a mensagem');
  // Trocar objetivo: segue com a troca.
  await p.click('[data-jd-confirmar]'); await p.waitForTimeout(100);
  await p.click('#troca-dialog [data-troca-sim]');
  await p.waitForSelector('#jornada-dialog', { state: 'hidden', timeout: 15000 }); await H.gravacoes(p);
  db = await H.banco(p);
  ok(db.perfis[0].jornada === 'forca', 'Trocar objetivo: troca para Força e potência', db.perfis[0].jornada);
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();

  // Voltar ao original do mesmo objetivo.
  p = await abrirTroca({ jornada: 'hipertrofia', treinos: PROPRIO });
  await confirmar(p, 'hipertrofia');
  t = await msg(p);
  ok(t.startsWith('Voltar ao original?') && t.includes('Os ajustes que você fez em Hipertrofia serão trocados pelos treinos originais.'), 'ajustado: mensagem ao voltar ao original', t);
  await p.context().close();

  // Treinos montados do zero (sem objetivo), no computador.
  p = await abrirTroca({ treinos: PROPRIO }, 1280);
  await confirmar(p, 'mobilidade');
  t = await msg(p);
  ok(t.includes('Você montou seus próprios treinos. Eles serão trocados pelos treinos de Mobilidade e prevenção.'), 'montados do zero: mensagem ao trocar', t);
  await p.context().close();

  // Sem ajustes (plano pronto ou objetivo como veio): troca direto, sem mensagem.
  for (const [nome, perfil] of [['plano pronto', {}], ['objetivo Jiu Jitsu sem ajustes', { jornada: 'jiu' }]]) {
    p = await abrirTroca(perfil);
    await confirmar(p, 'hipertrofia');
    ok(!(await p.locator('#troca-dialog[open]').count()) && await p.isVisible('.bv-montando'), `${nome}: troca direto, sem mensagem`);
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
