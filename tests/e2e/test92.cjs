// Mudar meu objetivo: quem ajustou os treinos vê, junto do Confirmar, que os ajustes não ficam guardados para depois.
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
  const aviso = async (p) => ((await p.locator('.bv-rodape .jd-aviso').count()) ? (await p.innerText('.bv-rodape .jd-aviso')).trim() : '');

  // Objetivo ajustado: trocar avisa que voltar traz os treinos originais; "Voltar ao original" avisa que os ajustes saem.
  let p = await abrirTroca({ jornada: 'hipertrofia', treinos: PROPRIO });
  await p.click('[data-jd-marcar="forca"]');
  let t = await aviso(p);
  ok(t.startsWith('Você ajustou os treinos de Hipertrofia.') && t.includes('vêm como eram originalmente') && t.includes('cargas e check-ins continuam salvos'), 'ajustado: aviso ao trocar de objetivo', t);
  ok(await p.isVisible('.bv-rodape [data-jd-confirmar]'), 'o Confirmar continua no rodapé');
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'sem rolagem lateral');
  await p.screenshot({ path: `${H.SAIDA}/troca-aviso-390.png` });
  await p.click('[data-jd-marcar="hipertrofia"]');
  t = await aviso(p);
  ok(t.startsWith('Os ajustes que você fez em Hipertrofia serão trocados pelos treinos originais.'), 'ajustado: aviso ao voltar ao original', t);
  ok(!p.errs.length, 'sem erros', p.errs.join(' | '));
  await p.context().close();

  // Treinos montados do zero (sem objetivo).
  p = await abrirTroca({ treinos: PROPRIO }, 1280);
  await p.click('[data-jd-marcar="mobilidade"]');
  t = await aviso(p);
  ok(t.startsWith('Você montou seus próprios treinos.'), 'montados do zero: aviso ao trocar', t);
  await p.context().close();

  // Sem ajustes (plano pronto ou objetivo como veio): troca sem aviso.
  for (const [nome, perfil] of [['plano pronto', {}], ['objetivo Jiu Jitsu sem ajustes', { jornada: 'jiu' }]]) {
    p = await abrirTroca(perfil);
    await p.click('[data-jd-marcar="hipertrofia"]');
    ok(!(await aviso(p)) && await p.isVisible('.bv-rodape [data-jd-confirmar]'), `${nome}: sem aviso, só o Confirmar`);
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
