// Minha semana: avisos pela organização da semana (foco de cada treino × esportes) e paleta opaca no estilo Gelo.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const perfil = (semana) => ({ id: 'u1', nome: 'Pessoa Exemplo', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [], semana });
// Plano pronto: Treino 1 = costas, Treino 2 = ombros, Treino 3 = pernas. Índices: 0 = domingo.
const CASOS = [
  ['pernas na véspera do futebol', [[], ['t1'], [], ['t2'], [], ['t3'], ['futebol']],
    ['No sábado tem Futebol e, na véspera, o Treino 3 (pernas).', 'pare 2 ou 3 repetições antes da falha']],
  ['pernas e futvôlei no mesmo dia', [[], ['t1'], [], ['t2'], ['t3', 'futvolei'], [], []],
    ['Na quinta o Treino 3 (pernas) e o Futvôlei caem no mesmo dia.', 'faça o Futvôlei primeiro']],
  ['costas e jiu no mesmo dia', [[], ['t1', 'jiu'], [], ['t2'], [], ['t3'], []],
    ['Na segunda o Treino 1 (costas) e o Jiu Jitsu caem no mesmo dia.', 'costas e pegada cansadas']],
  ['ombros na véspera do surf', [['surf'], ['t1'], [], ['t3'], [], [], ['t2']],
    ['No domingo tem Surf e, na véspera, o Treino 2 (ombros).', 'remada']],
  ['futebol na véspera de pernas', [[], ['t1'], ['futebol'], ['t3'], [], ['t2'], []],
    ['Depois do Futebol da terça, as pernas podem chegar doloridas ao Treino 3 da quarta']],
  ['pernas com cardio', [[], ['t3', 'bike'], [], ['t1'], [], ['t2'], []],
    ['Na segunda você terá Treino 3 e Cardio. Faça a musculação primeiro', 'prefira bike a corrida']],
  ['dois esportes no mesmo dia', [[], ['t1'], [], ['t2'], [], ['t3'], ['jiu', 'muay']],
    ['No sábado você terá Jiu Jitsu e Muay Thai, dois treinos intensos no mesmo dia.']],
  ['mesmo foco em dias seguidos', [[], ['t1'], ['t3'], ['t3'], [], ['t2'], []],
    ['O Treino 3 cai em dias seguidos (terça e quarta).', 'aparece 2 vezes']],
];

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const [nome, semana, esperados] of CASOS) {
    const p = await H.novaPagina(b, { extra: { perfis: [perfil(semana)] } });
    await p.clock.install({ time: new Date('2026-10-19T09:00:00') });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    const av = ((await p.locator('#avisos-semana').innerText()) || '').replace(/\s+/g, ' ');
    ok(esperados.every((e) => av.includes(e)), nome, av);
    await p.context().close();
  }
  // Semana sem conflito: sem avisos (o plano pronto continua limpo).
  {
    const p = await H.novaPagina(b, { extra: { perfis: [perfil([[], ['t2'], ['jiu'], ['t1'], ['jiu'], ['t3'], ['bike']])] } });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    ok((await p.locator('#avisos-semana').innerText()).trim() === '', 'semana do plano pronto sem avisos', await p.locator('#avisos-semana').innerText());
    await p.context().close();
  }
  // Gelo: a paleta presa no topo é opaca (os dias não aparecem por trás ao rolar).
  const p = await H.novaPagina(b, { scheme: 'dark', viewport: { width: 390, height: 600 }, local: { 'bauer-estilo': 'gelo' }, extra: { perfis: [perfil([[], ['t1'], ['jiu'], ['t2'], ['jiu'], ['t1', 'bike'], ['jiu', 't2']])] } });
  await p.goto(H.PAGINA + '#voce/semana');
  await H.prontos(p);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => scrollBy(0, 400));
  await p.waitForTimeout(150);
  const cor = await p.evaluate(() => [getComputedStyle(document.getElementById('paleta')).backgroundColor, getComputedStyle(document.querySelector('#paleta .ativ')).backgroundColor]);
  ok(cor.every((c) => /^rgb\(/.test(c)), 'gelo: paleta e atividades com fundo opaco', cor.join(' | '));
  await p.screenshot({ path: `${H.SAIDA}/semana-gelo-rolada.png` });
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
